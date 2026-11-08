import { randomUUID } from "node:crypto";
import { createServerFn } from "@tanstack/react-start";
import type { PoolConnection } from "mysql2/promise";
import { permissionMiddleware } from "./auth.middleware";
import {
  columnKey,
  costSheetSystemColumnKeys,
  evaluateCostSheetFormula,
  formulaIdentifiers,
  normalizeCostSheetColumnRules,
  type CostSheetSystemColumnRules,
} from "./cost-sheet-formula";
import {
  systemCostSheetTemplates,
  type CostSheetTemplateColumn,
  type CostSheetTemplateDefinition,
} from "./cost-sheet-templates";

export type CostSheetAttachment = {
  path: string;
  name: string;
  type: string;
  size: number;
};

export type CostSheetColumn = {
  id: string;
  cost_sheet_id: string;
  name: string;
  column_key: string;
  data_type: "text" | "number" | "formula";
  default_value: string | null;
  formula_expression: string | null;
  display_order: number;
};

export type CostSheetItem = {
  id: string;
  cost_sheet_id: string;
  category: string;
  description: string;
  quantity: number;
  unit_cost: number;
  markup_percent: number;
  custom_values: Record<string, string | number>;
  attachments: CostSheetAttachment[];
  created_at: string;
  updated_at: string;
};

export type CostSheetRecord = {
  id: string;
  name: string;
  client_id: string | null;
  quotation_id: string | null;
  bid_id: string | null;
  project_id: string | null;
  status: string;
  currency: string;
  notes: string | null;
  column_rules: CostSheetSystemColumnRules;
  client_name: string | null;
  client_logo: string | null;
  created_at: string;
  updated_at: string;
};

export type CostSheetSourceQuote = {
  id: string;
  supplier_id: string | null;
  source_name: string;
  supplier_name: string | null;
  quote_reference: string | null;
  quote_date: string | null;
  valid_until: string | null;
  currency: string;
  amount: number;
  notes: string | null;
  attachment_path: string | null;
  attachment_name: string | null;
  attachment_type: string | null;
  attachment_size: number | null;
  is_linked: number;
};

export type CostSheetWorkspaceData = {
  sheet: CostSheetRecord;
  columns: CostSheetColumn[];
  items: CostSheetItem[];
  sourceQuotes: CostSheetSourceQuote[];
};

export type CostSheetDirectoryRecord = {
  id: string;
  name: string;
  status: string;
  currency: string;
  client_id: string | null;
  client_name: string | null;
  client_logo: string | null;
  opportunity_kind: string | null;
  opportunity_title: string | null;
  item_count: number;
  updated_at: string;
};

export type CostSheetTemplateRecord = CostSheetTemplateDefinition & {
  created_by?: string | null;
  updated_at?: string;
};

type ItemInput = {
  costSheetId: string;
  itemId?: string;
  category: string;
  description: string;
  quantity: number;
  unitCost: number;
  markupPercent: number;
  customValues: Record<string, string | number>;
  attachments: CostSheetAttachment[];
};

const builtInFormulaKeys = new Set<string>(costSheetSystemColumnKeys);

function parseJson<T>(value: unknown, fallback: T): T {
  if (value && typeof value === "object") return value as T;
  if (typeof value !== "string" || !value.trim()) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function serialize<T>(rows: T) {
  return JSON.parse(JSON.stringify(rows)) as T;
}

function normalizeTemplateColumns(value: unknown): CostSheetTemplateColumn[] {
  const parsed = parseJson<CostSheetTemplateColumn[]>(value, []);
  return parsed
    .filter(
      (entry) =>
        entry &&
        typeof entry.name === "string" &&
        typeof entry.column_key === "string" &&
        ["text", "number", "formula"].includes(entry.data_type),
    )
    .map((entry, index) => ({
      name: entry.name.trim(),
      column_key: columnKey(entry.column_key),
      data_type: entry.data_type,
      default_value: entry.data_type === "formula" ? null : entry.default_value,
      formula_expression:
        entry.data_type === "formula" ? String(entry.formula_expression || "").toLowerCase() : null,
      display_order: Number.isFinite(Number(entry.display_order))
        ? Number(entry.display_order)
        : index,
    }))
    .filter((entry) => entry.name && entry.column_key);
}

async function resolveTemplate(
  db: Awaited<ReturnType<(typeof import("./db.server"))["getPool"]>>,
  templateId: string,
): Promise<CostSheetTemplateRecord | null> {
  const system = systemCostSheetTemplates.find((template) => template.id === templateId);
  if (system) return system;
  const [rows] = await db.execute("SELECT * FROM cost_sheet_templates WHERE id = ? LIMIT 1", [
    templateId,
  ]);
  const template = (rows as Array<Record<string, unknown>>)[0];
  if (!template) return null;
  return {
    id: String(template["id"]),
    name: String(template["name"]),
    description: String(template["description"] || ""),
    currency: String(template["currency"] || "MWK"),
    column_rules: normalizeCostSheetColumnRules(template["column_rules"]),
    columns: normalizeTemplateColumns(template["columns_json"]),
    is_system: false,
    created_by: template["created_by"] ? String(template["created_by"]) : null,
    updated_at: String(template["updated_at"] || ""),
  };
}

async function insertTemplateColumns(
  connection: PoolConnection,
  costSheetId: string,
  columns: CostSheetTemplateColumn[],
) {
  for (const templateColumn of columns) {
    await connection.execute(
      `INSERT INTO cost_sheet_columns
        (id, cost_sheet_id, name, column_key, data_type, default_value, formula_expression, display_order)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE name = VALUES(name), data_type = VALUES(data_type),
         default_value = VALUES(default_value), formula_expression = VALUES(formula_expression),
         display_order = VALUES(display_order)`,
      [
        randomUUID(),
        costSheetId,
        templateColumn.name,
        templateColumn.column_key,
        templateColumn.data_type,
        templateColumn.default_value,
        templateColumn.formula_expression,
        templateColumn.display_order,
      ],
    );
  }
}

function validateNumber(value: number, label: string) {
  if (!Number.isFinite(value)) throw new Error(`${label} must be a valid number.`);
}

function validateAttachments(attachments: CostSheetAttachment[]) {
  if (attachments.length > 12) throw new Error("A line item can contain up to 12 images.");
  for (const attachment of attachments) {
    if (!attachment.type.startsWith("image/"))
      throw new Error("Only image attachments are allowed.");
    if (!attachment.path || !attachment.name) throw new Error("An image attachment is incomplete.");
  }
}

function validateFormulaGraph(columns: CostSheetColumn[], rulesInput: unknown) {
  const rules = normalizeCostSheetColumnRules(rulesInput);
  const calculableColumns = columns.filter((column) => column.data_type !== "text");
  const available = new Set([
    ...builtInFormulaKeys,
    ...calculableColumns.map((column) => column.column_key),
  ]);
  const formulaDependencies = new Map<string, string[]>();
  const formulas = [
    ...(["line_cost", "sell_price", "gross_profit"] as const).map((key) => ({
      key,
      expression: rules[key].formulaExpression || "",
    })),
    ...columns
      .filter((column) => column.data_type === "formula")
      .map((column) => ({ key: column.column_key, expression: column.formula_expression || "" })),
  ];
  const formulaKeys = new Set(formulas.map((formula) => formula.key));
  const validationContext = Object.fromEntries([...available].map((key) => [key, 1]));
  for (const formula of formulas) {
    const expression = formula.expression.trim();
    const identifiers = formulaIdentifiers(expression);
    for (const identifier of identifiers)
      if (!available.has(identifier)) throw new Error(`Unknown formula column "${identifier}".`);
    evaluateCostSheetFormula(expression, validationContext);
    formulaDependencies.set(
      formula.key,
      identifiers.filter((identifier) => formulaKeys.has(identifier)),
    );
  }
  const visiting = new Set<string>();
  const visited = new Set<string>();
  const visit = (key: string) => {
    if (visiting.has(key))
      throw new Error("Formula columns cannot reference each other in a circle.");
    if (visited.has(key)) return;
    visiting.add(key);
    for (const dependency of formulaDependencies.get(key) || []) visit(dependency);
    visiting.delete(key);
    visited.add(key);
  };
  for (const key of formulaDependencies.keys()) visit(key);
}

export const getCostSheetWorkspace = createServerFn({ method: "GET" })
  .middleware([permissionMiddleware("opportunities.manage")])
  .validator((data: { costSheetId: string }) => data)
  .handler(async ({ data }) => {
    const { getPool } = await import("./db.server");
    const db = getPool();
    const [[sheetRows], [columnRows], [itemRows], [quoteRows]] = await Promise.all([
      db.execute(
        `SELECT cs.*,
                COALESCE(c.name,
                  (SELECT linked.name FROM bids b JOIN clients linked ON linked.id = b.client_id WHERE b.cost_sheet_id = cs.id ORDER BY b.updated_at DESC LIMIT 1),
                  (SELECT linked.name FROM prequalifications p JOIN clients linked ON linked.id = p.client_id WHERE p.cost_sheet_id = cs.id ORDER BY p.updated_at DESC LIMIT 1),
                  (SELECT linked.name FROM requests r JOIN clients linked ON linked.id = r.client_id WHERE r.cost_sheet_id = cs.id ORDER BY r.updated_at DESC LIMIT 1)) AS client_name,
                COALESCE(c.logo_path,
                  (SELECT linked.logo_path FROM bids b JOIN clients linked ON linked.id = b.client_id WHERE b.cost_sheet_id = cs.id ORDER BY b.updated_at DESC LIMIT 1),
                  (SELECT linked.logo_path FROM prequalifications p JOIN clients linked ON linked.id = p.client_id WHERE p.cost_sheet_id = cs.id ORDER BY p.updated_at DESC LIMIT 1),
                  (SELECT linked.logo_path FROM requests r JOIN clients linked ON linked.id = r.client_id WHERE r.cost_sheet_id = cs.id ORDER BY r.updated_at DESC LIMIT 1)) AS client_logo
           FROM cost_sheets cs
           LEFT JOIN clients c ON c.id = cs.client_id
          WHERE cs.id = ? LIMIT 1`,
        [data.costSheetId],
      ),
      db.execute(
        `SELECT * FROM cost_sheet_columns
          WHERE cost_sheet_id = ? ORDER BY display_order ASC, created_at ASC`,
        [data.costSheetId],
      ),
      db.execute(
        `SELECT * FROM cost_sheet_items
          WHERE cost_sheet_id = ? ORDER BY created_at ASC`,
        [data.costSheetId],
      ),
      db.execute(
        `SELECT q.*, s.name AS supplier_name,
                CASE WHEN l.cost_sheet_id IS NULL THEN 0 ELSE 1 END AS is_linked
           FROM supplier_quotes q
           LEFT JOIN suppliers s ON s.id = q.supplier_id
           LEFT JOIN cost_sheet_supplier_quotes l
             ON l.supplier_quote_id = q.id AND l.cost_sheet_id = ?
          ORDER BY is_linked DESC, COALESCE(q.quote_date, DATE(q.created_at)) DESC`,
        [data.costSheetId],
      ),
    ]);
    const sheet = (sheetRows as unknown as CostSheetRecord[])[0];
    if (!sheet) throw new Error("Cost sheet not found.");
    sheet.column_rules = normalizeCostSheetColumnRules(sheet.column_rules);
    const items = (itemRows as Array<Record<string, unknown>>).map((row) => ({
      ...row,
      custom_values: parseJson<Record<string, string | number>>(row["custom_values"], {}),
      attachments: parseJson<CostSheetAttachment[]>(row["attachments"], []),
    })) as unknown as CostSheetItem[];
    return serialize<CostSheetWorkspaceData>({
      sheet,
      columns: columnRows as unknown as CostSheetColumn[],
      items,
      sourceQuotes: quoteRows as unknown as CostSheetSourceQuote[],
    });
  });

export const setCostSheetSourceQuote = createServerFn({ method: "POST" })
  .middleware([permissionMiddleware("opportunities.manage")])
  .validator((data: { costSheetId: string; quoteId: string; linked: boolean }) => data)
  .handler(async ({ data, context }) => {
    const { getPool } = await import("./db.server");
    const db = getPool();
    if (data.linked) {
      const [quoteRows] = await db.execute("SELECT id FROM supplier_quotes WHERE id = ? LIMIT 1", [
        data.quoteId,
      ]);
      if (!(quoteRows as Array<{ id: string }>).length) throw new Error("Quotation not found.");
      await db.execute(
        `INSERT IGNORE INTO cost_sheet_supplier_quotes
          (cost_sheet_id, supplier_quote_id, created_by) VALUES (?, ?, ?)`,
        [data.costSheetId, data.quoteId, context.user.id],
      );
    } else {
      await db.execute(
        "DELETE FROM cost_sheet_supplier_quotes WHERE cost_sheet_id = ? AND supplier_quote_id = ?",
        [data.costSheetId, data.quoteId],
      );
    }
    return { ok: true };
  });

export const saveCostSheetItem = createServerFn({ method: "POST" })
  .middleware([permissionMiddleware("opportunities.manage")])
  .validator((data: ItemInput) => data)
  .handler(async ({ data }) => {
    if (!data.description.trim()) throw new Error("Add an item description.");
    validateNumber(data.quantity, "Quantity");
    validateNumber(data.unitCost, "Unit cost");
    validateNumber(data.markupPercent, "Markup");
    if (data.quantity < 0 || data.unitCost < 0)
      throw new Error("Quantity and unit cost cannot be negative.");
    validateAttachments(data.attachments || []);
    const { getPool } = await import("./db.server");
    const db = getPool();
    const itemId = data.itemId || randomUUID();
    const [existingRows] = await db.execute(
      `SELECT id FROM cost_sheet_items WHERE id = ? AND cost_sheet_id = ? LIMIT 1`,
      [itemId, data.costSheetId],
    );
    const itemExists = (existingRows as Array<{ id: string }>).length > 0;
    if (itemExists) {
      const [result] = await db.execute(
        `UPDATE cost_sheet_items
            SET category = ?, description = ?, quantity = ?, unit_cost = ?, markup_percent = ?,
                custom_values = ?, attachments = ?
          WHERE id = ? AND cost_sheet_id = ?`,
        [
          data.category.trim() || "other",
          data.description.trim(),
          data.quantity,
          data.unitCost,
          data.markupPercent,
          JSON.stringify(data.customValues || {}),
          JSON.stringify(data.attachments || []),
          itemId,
          data.costSheetId,
        ],
      );
    } else {
      await db.execute(
        `INSERT INTO cost_sheet_items
          (id, cost_sheet_id, category, description, quantity, unit_cost, markup_percent,
           custom_values, attachments)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          itemId,
          data.costSheetId,
          data.category.trim() || "other",
          data.description.trim(),
          data.quantity,
          data.unitCost,
          data.markupPercent,
          JSON.stringify(data.customValues || {}),
          JSON.stringify(data.attachments || []),
        ],
      );
    }
    return { id: itemId };
  });

export const deleteCostSheetItem = createServerFn({ method: "POST" })
  .middleware([permissionMiddleware("opportunities.manage")])
  .validator((data: { costSheetId: string; itemId: string }) => data)
  .handler(async ({ data }) => {
    const { getPool } = await import("./db.server");
    const [result] = await getPool().execute(
      "DELETE FROM cost_sheet_items WHERE id = ? AND cost_sheet_id = ?",
      [data.itemId, data.costSheetId],
    );
    if (!(result as { affectedRows: number }).affectedRows) throw new Error("Line item not found.");
    return { deleted: true };
  });

export const saveCostSheetColumn = createServerFn({ method: "POST" })
  .middleware([permissionMiddleware("opportunities.manage")])
  .validator(
    (data: {
      costSheetId: string;
      columnId?: string;
      name: string;
      key: string;
      dataType: "text" | "number" | "formula";
      defaultValue: string;
      formulaExpression: string;
    }) => data,
  )
  .handler(async ({ data }) => {
    if (!data.name.trim()) throw new Error("Add a column name.");
    const key = columnKey(data.key || data.name);
    if (!key) throw new Error("Add a valid column reference key.");
    if (builtInFormulaKeys.has(key)) throw new Error(`"${key}" is reserved by the cost sheet.`);
    if (!["text", "number", "formula"].includes(data.dataType))
      throw new Error("Select a valid column type.");
    if (
      data.dataType === "number" &&
      data.defaultValue &&
      !Number.isFinite(Number(data.defaultValue))
    )
      throw new Error("The default value must be a number.");
    if (data.dataType === "formula" && !data.formulaExpression.trim())
      throw new Error("Enter the formula for this column.");

    const { getPool } = await import("./db.server");
    const db = getPool();
    const [[rows], [sheetRows]] = await Promise.all([
      db.execute(
        "SELECT * FROM cost_sheet_columns WHERE cost_sheet_id = ? ORDER BY display_order ASC",
        [data.costSheetId],
      ),
      db.execute("SELECT column_rules FROM cost_sheets WHERE id = ? LIMIT 1", [data.costSheetId]),
    ]);
    const existing = rows as CostSheetColumn[];
    const sheet = (sheetRows as Array<{ column_rules: unknown }>)[0];
    if (!sheet) throw new Error("Cost sheet not found.");
    const current = data.columnId ? existing.find((column) => column.id === data.columnId) : null;
    if (data.columnId && !current) throw new Error("Custom column not found.");
    if (existing.some((column) => column.column_key === key && column.id !== data.columnId))
      throw new Error(`The reference key "${key}" is already in use.`);
    const candidate: CostSheetColumn = {
      id: data.columnId || randomUUID(),
      cost_sheet_id: data.costSheetId,
      name: data.name.trim(),
      column_key: current?.column_key || key,
      data_type: data.dataType,
      default_value: data.dataType === "formula" ? null : data.defaultValue.trim() || null,
      formula_expression:
        data.dataType === "formula" ? data.formulaExpression.trim().toLowerCase() : null,
      display_order: current?.display_order ?? existing.length,
    };
    validateFormulaGraph(
      [...existing.filter((column) => column.id !== candidate.id), candidate],
      sheet.column_rules,
    );

    if (data.columnId) {
      await db.execute(
        `UPDATE cost_sheet_columns
            SET name = ?, data_type = ?, default_value = ?, formula_expression = ?
          WHERE id = ? AND cost_sheet_id = ?`,
        [
          candidate.name,
          candidate.data_type,
          candidate.default_value,
          candidate.formula_expression,
          candidate.id,
          data.costSheetId,
        ],
      );
    } else {
      await db.execute(
        `INSERT INTO cost_sheet_columns
          (id, cost_sheet_id, name, column_key, data_type, default_value, formula_expression, display_order)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          candidate.id,
          data.costSheetId,
          candidate.name,
          candidate.column_key,
          candidate.data_type,
          candidate.default_value,
          candidate.formula_expression,
          candidate.display_order,
        ],
      );
    }
    return { id: candidate.id, key: candidate.column_key };
  });

export const saveCostSheetColumnRules = createServerFn({ method: "POST" })
  .middleware([permissionMiddleware("opportunities.manage")])
  .validator((data: { costSheetId: string; rules: CostSheetSystemColumnRules }) => data)
  .handler(async ({ data }) => {
    for (const key of costSheetSystemColumnKeys)
      if (!data.rules[key]?.label?.trim()) throw new Error(`Add a label for ${key}.`);
    for (const key of ["line_cost", "sell_price", "gross_profit"] as const)
      if (!data.rules[key]?.formulaExpression?.trim())
        throw new Error(`Add a formula for ${data.rules[key]?.label || key}.`);
    const rules = normalizeCostSheetColumnRules(data.rules);
    for (const key of ["quantity", "unit_cost", "markup_percent"] as const) {
      const value = rules[key].defaultValue;
      if (!Number.isFinite(value)) throw new Error(`${rules[key].label} needs a valid default.`);
      if (value! < 0) throw new Error(`${rules[key].label} default cannot be negative.`);
    }
    for (const key of ["line_cost", "sell_price", "gross_profit"] as const)
      if (!rules[key].formulaExpression?.trim())
        throw new Error(`Add a formula for ${rules[key].label}.`);

    const { getPool } = await import("./db.server");
    const db = getPool();
    const [columns] = await db.execute(
      "SELECT * FROM cost_sheet_columns WHERE cost_sheet_id = ? ORDER BY display_order ASC",
      [data.costSheetId],
    );
    validateFormulaGraph(columns as CostSheetColumn[], rules);
    const [result] = await db.execute("UPDATE cost_sheets SET column_rules = ? WHERE id = ?", [
      JSON.stringify(rules),
      data.costSheetId,
    ]);
    if (!(result as { affectedRows: number }).affectedRows)
      throw new Error("Cost sheet not found.");
    return { updated: true };
  });

export const deleteCostSheetColumn = createServerFn({ method: "POST" })
  .middleware([permissionMiddleware("opportunities.manage")])
  .validator((data: { costSheetId: string; columnId: string }) => data)
  .handler(async ({ data }) => {
    const { getPool } = await import("./db.server");
    const db = getPool();
    const connection = await db.getConnection();
    try {
      await connection.beginTransaction();
      const [columnRows] = await connection.execute(
        "SELECT column_key FROM cost_sheet_columns WHERE id = ? AND cost_sheet_id = ? LIMIT 1",
        [data.columnId, data.costSheetId],
      );
      const column = (columnRows as Array<{ column_key: string }>)[0];
      if (!column) throw new Error("Custom column not found.");
      const [sheetRows] = await connection.execute(
        "SELECT column_rules FROM cost_sheets WHERE id = ? LIMIT 1",
        [data.costSheetId],
      );
      const rules = normalizeCostSheetColumnRules(
        (sheetRows as Array<{ column_rules: unknown }>)[0]?.column_rules,
      );
      for (const key of ["line_cost", "sell_price", "gross_profit"] as const)
        if (formulaIdentifiers(rules[key].formulaExpression || "").includes(column.column_key))
          throw new Error(`Remove the reference from ${rules[key].label} first.`);
      const [dependentRows] = await connection.execute(
        `SELECT name, formula_expression FROM cost_sheet_columns
          WHERE cost_sheet_id = ? AND data_type = 'formula' AND id <> ?`,
        [data.costSheetId, data.columnId],
      );
      for (const dependent of dependentRows as Array<{ name: string; formula_expression: string }>)
        if (formulaIdentifiers(dependent.formula_expression || "").includes(column.column_key))
          throw new Error(`Remove the reference from formula column "${dependent.name}" first.`);

      const [itemRows] = await connection.execute(
        "SELECT id, custom_values FROM cost_sheet_items WHERE cost_sheet_id = ?",
        [data.costSheetId],
      );
      for (const item of itemRows as Array<{ id: string; custom_values: string | null }>) {
        const values = parseJson<Record<string, string | number>>(item.custom_values, {});
        delete values[column.column_key];
        await connection.execute("UPDATE cost_sheet_items SET custom_values = ? WHERE id = ?", [
          JSON.stringify(values),
          item.id,
        ]);
      }
      await connection.execute("DELETE FROM cost_sheet_columns WHERE id = ?", [data.columnId]);
      await connection.commit();
      return { deleted: true };
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  });

export const updateCostSheet = createServerFn({ method: "POST" })
  .middleware([permissionMiddleware("opportunities.manage")])
  .validator((data: { costSheetId: string; name: string; status: string; notes: string }) => data)
  .handler(async ({ data }) => {
    if (!data.name.trim()) throw new Error("Add a cost sheet name.");
    if (!["draft", "approved", "archived"].includes(data.status))
      throw new Error("Select a valid status.");
    const { getPool } = await import("./db.server");
    await getPool().execute("UPDATE cost_sheets SET name = ?, status = ?, notes = ? WHERE id = ?", [
      data.name.trim(),
      data.status,
      data.notes.trim() || null,
      data.costSheetId,
    ]);
    return { updated: true };
  });

export const deleteCostSheet = createServerFn({ method: "POST" })
  .middleware([permissionMiddleware("opportunities.manage")])
  .validator((data: { costSheetId: string }) => data)
  .handler(async ({ data }) => {
    if (!data.costSheetId) throw new Error("Cost sheet not found.");
    const { getPool } = await import("./db.server");
    const connection = await getPool().getConnection();
    try {
      await connection.beginTransaction();
      const [sheetRows] = await connection.execute(
        "SELECT id FROM cost_sheets WHERE id = ? LIMIT 1 FOR UPDATE",
        [data.costSheetId],
      );
      if (!(sheetRows as Array<{ id: string }>).length) throw new Error("Cost sheet not found.");

      // Opportunities remain intact; only their link to the removed working sheet is cleared.
      await connection.execute("UPDATE bids SET cost_sheet_id = NULL WHERE cost_sheet_id = ?", [
        data.costSheetId,
      ]);
      await connection.execute(
        "UPDATE prequalifications SET cost_sheet_id = NULL WHERE cost_sheet_id = ?",
        [data.costSheetId],
      );
      await connection.execute("UPDATE requests SET cost_sheet_id = NULL WHERE cost_sheet_id = ?", [
        data.costSheetId,
      ]);
      const [result] = await connection.execute("DELETE FROM cost_sheets WHERE id = ?", [
        data.costSheetId,
      ]);
      if (!(result as { affectedRows: number }).affectedRows)
        throw new Error("Cost sheet not found.");
      await connection.commit();
      return { deleted: true };
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  });

export const getCostSheetDirectory = createServerFn({ method: "GET" })
  .middleware([permissionMiddleware("opportunities.manage")])
  .handler(async () => {
    const { getPool } = await import("./db.server");
    const [rows] = await getPool().query(
      `SELECT cs.id, cs.name, cs.status, cs.currency, cs.client_id, cs.updated_at,
              COALESCE(direct_client.name,
                (SELECT c.name FROM bids b JOIN clients c ON c.id = b.client_id
                  WHERE b.cost_sheet_id = cs.id ORDER BY b.updated_at DESC LIMIT 1),
                (SELECT c.name FROM prequalifications p JOIN clients c ON c.id = p.client_id
                  WHERE p.cost_sheet_id = cs.id ORDER BY p.updated_at DESC LIMIT 1),
                (SELECT c.name FROM requests r JOIN clients c ON c.id = r.client_id
                  WHERE r.cost_sheet_id = cs.id ORDER BY r.updated_at DESC LIMIT 1)) AS client_name,
              COALESCE(direct_client.logo_path,
                (SELECT c.logo_path FROM bids b JOIN clients c ON c.id = b.client_id
                  WHERE b.cost_sheet_id = cs.id ORDER BY b.updated_at DESC LIMIT 1),
                (SELECT c.logo_path FROM prequalifications p JOIN clients c ON c.id = p.client_id
                  WHERE p.cost_sheet_id = cs.id ORDER BY p.updated_at DESC LIMIT 1),
                (SELECT c.logo_path FROM requests r JOIN clients c ON c.id = r.client_id
                  WHERE r.cost_sheet_id = cs.id ORDER BY r.updated_at DESC LIMIT 1)) AS client_logo,
              CASE
                WHEN EXISTS (SELECT 1 FROM bids b WHERE b.cost_sheet_id = cs.id OR b.id = cs.bid_id) THEN 'Bid'
                WHEN EXISTS (SELECT 1 FROM prequalifications p WHERE p.cost_sheet_id = cs.id) THEN 'EOI'
                WHEN EXISTS (SELECT 1 FROM requests r WHERE r.cost_sheet_id = cs.id AND r.request_type = 'rfp') THEN 'RFP'
                WHEN EXISTS (SELECT 1 FROM requests r WHERE r.cost_sheet_id = cs.id AND r.request_type = 'rfq') THEN 'RFQ'
                ELSE NULL
              END AS opportunity_kind,
              COALESCE(
                (SELECT b.title FROM bids b WHERE b.cost_sheet_id = cs.id OR b.id = cs.bid_id
                  ORDER BY b.updated_at DESC LIMIT 1),
                (SELECT COALESCE(p.title, p.buyer) FROM prequalifications p
                  WHERE p.cost_sheet_id = cs.id ORDER BY p.updated_at DESC LIMIT 1),
                (SELECT r.title FROM requests r WHERE r.cost_sheet_id = cs.id
                  ORDER BY r.updated_at DESC LIMIT 1)) AS opportunity_title,
              (SELECT COUNT(*) FROM cost_sheet_items i WHERE i.cost_sheet_id = cs.id) AS item_count
         FROM cost_sheets cs
         LEFT JOIN clients direct_client ON direct_client.id = cs.client_id
        ORDER BY cs.updated_at DESC`,
    );
    return serialize(rows as CostSheetDirectoryRecord[]);
  });

export const getCostSheetTemplates = createServerFn({ method: "GET" })
  .middleware([permissionMiddleware("opportunities.manage")])
  .handler(async () => {
    const { getPool } = await import("./db.server");
    const [rows] = await getPool().query(
      "SELECT * FROM cost_sheet_templates ORDER BY updated_at DESC, name ASC",
    );
    const custom = (rows as Array<Record<string, unknown>>).map(
      (template): CostSheetTemplateRecord => ({
        id: String(template["id"]),
        name: String(template["name"]),
        description: String(template["description"] || ""),
        currency: String(template["currency"] || "MWK"),
        column_rules: normalizeCostSheetColumnRules(template["column_rules"]),
        columns: normalizeTemplateColumns(template["columns_json"]),
        is_system: false,
        created_by: template["created_by"] ? String(template["created_by"]) : null,
        updated_at: String(template["updated_at"] || ""),
      }),
    );
    return serialize([...systemCostSheetTemplates, ...custom]);
  });

export const createCostSheet = createServerFn({ method: "POST" })
  .middleware([permissionMiddleware("opportunities.manage")])
  .validator(
    (data: {
      name: string;
      clientId?: string;
      currency: string;
      notes?: string;
      templateId?: string;
    }) => data,
  )
  .handler(async ({ data }) => {
    if (!data.name.trim()) throw new Error("Add a cost sheet name.");
    const { getPool } = await import("./db.server");
    const db = getPool();
    const template = data.templateId ? await resolveTemplate(db, data.templateId) : null;
    if (data.templateId && !template) throw new Error("Cost sheet template not found.");
    const id = randomUUID();
    const connection = await db.getConnection();
    try {
      await connection.beginTransaction();
      await connection.execute(
        `INSERT INTO cost_sheets
          (id, name, client_id, status, currency, notes, column_rules)
         VALUES (?, ?, ?, 'draft', ?, ?, ?)`,
        [
          id,
          data.name.trim(),
          data.clientId || null,
          data.currency || template?.currency || "MWK",
          data.notes?.trim() || null,
          JSON.stringify(template?.column_rules || normalizeCostSheetColumnRules(undefined)),
        ],
      );
      if (template) await insertTemplateColumns(connection, id, template.columns);
      await connection.commit();
      return { id };
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  });

export const saveCostSheetAsTemplate = createServerFn({ method: "POST" })
  .middleware([permissionMiddleware("opportunities.manage")])
  .validator((data: { costSheetId: string; name: string; description?: string }) => data)
  .handler(async ({ data, context }) => {
    if (!data.name.trim()) throw new Error("Add a template name.");
    const { getPool } = await import("./db.server");
    const db = getPool();
    const [[sheetRows], [columnRows]] = await Promise.all([
      db.execute("SELECT currency, column_rules FROM cost_sheets WHERE id = ? LIMIT 1", [
        data.costSheetId,
      ]),
      db.execute(
        `SELECT name, column_key, data_type, default_value, formula_expression, display_order
           FROM cost_sheet_columns WHERE cost_sheet_id = ? ORDER BY display_order, created_at`,
        [data.costSheetId],
      ),
    ]);
    const sheet = (sheetRows as Array<{ currency: string; column_rules: unknown }>)[0];
    if (!sheet) throw new Error("Cost sheet not found.");
    const id = randomUUID();
    await db.execute(
      `INSERT INTO cost_sheet_templates
        (id, name, description, currency, column_rules, columns_json, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        data.name.trim(),
        data.description?.trim() || null,
        sheet.currency || "MWK",
        JSON.stringify(normalizeCostSheetColumnRules(sheet.column_rules)),
        JSON.stringify(normalizeTemplateColumns(columnRows)),
        context.user.id,
      ],
    );
    return { id };
  });

export const applyCostSheetTemplate = createServerFn({ method: "POST" })
  .middleware([permissionMiddleware("opportunities.manage")])
  .validator((data: { costSheetId: string; templateId: string }) => data)
  .handler(async ({ data }) => {
    const { getPool } = await import("./db.server");
    const db = getPool();
    const template = await resolveTemplate(db, data.templateId);
    if (!template) throw new Error("Cost sheet template not found.");
    const [existingRows] = await db.execute(
      "SELECT * FROM cost_sheet_columns WHERE cost_sheet_id = ? ORDER BY display_order, created_at",
      [data.costSheetId],
    );
    const mergedColumns = new Map(
      (existingRows as CostSheetColumn[]).map((entry) => [entry.column_key, entry]),
    );
    for (const entry of template.columns) {
      const existing = mergedColumns.get(entry.column_key);
      mergedColumns.set(entry.column_key, {
        ...entry,
        id: existing?.id || randomUUID(),
        cost_sheet_id: data.costSheetId,
      });
    }
    validateFormulaGraph([...mergedColumns.values()], template.column_rules);
    const connection = await db.getConnection();
    try {
      await connection.beginTransaction();
      const [result] = await connection.execute(
        "UPDATE cost_sheets SET column_rules = ? WHERE id = ?",
        [JSON.stringify(template.column_rules), data.costSheetId],
      );
      if (!(result as { affectedRows: number }).affectedRows)
        throw new Error("Cost sheet not found.");
      await insertTemplateColumns(connection, data.costSheetId, template.columns);
      await connection.commit();
      return { updated: true };
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  });

export const deleteCostSheetTemplate = createServerFn({ method: "POST" })
  .middleware([permissionMiddleware("opportunities.manage")])
  .validator((data: { templateId: string }) => data)
  .handler(async ({ data }) => {
    if (data.templateId.startsWith("system-"))
      throw new Error("Built-in templates cannot be deleted.");
    const { getPool } = await import("./db.server");
    const [result] = await getPool().execute("DELETE FROM cost_sheet_templates WHERE id = ?", [
      data.templateId,
    ]);
    if (!(result as { affectedRows: number }).affectedRows) throw new Error("Template not found.");
    return { deleted: true };
  });
