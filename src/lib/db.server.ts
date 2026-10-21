import { randomUUID } from "node:crypto";
import mysql, { type Pool } from "mysql2/promise";
import { createDb, type DbInput, type DbResult } from "./db-query";
import type { TableName } from "./db.types";
import { withDatabaseReadRetry } from "./database-resilience";

const fields: Record<TableName, string[]> = {
  prospects: [
    "id",
    "email",
    "first_name",
    "last_name",
    "company",
    "job_title",
    "phone",
    "status",
    "notes",
    "extra",
    "source_file",
    "category_id",
    "website",
    "linkedin_url",
    "fit_score",
    "fit_reason",
    "last_contact_at",
    "logo_path",
    "canonical_key",
    "industry",
    "address",
    "city",
    "country",
    "registration_number",
    "employee_count",
    "created_at",
    "updated_at",
  ],
  clients: [
    "id",
    "name",
    "company",
    "email",
    "phone",
    "website",
    "industry",
    "status",
    "address",
    "notes",
    "prospect_id",
    "logo_path",
    "created_at",
    "updated_at",
  ],
  mailboxes: [
    "id",
    "name",
    "from_email",
    "from_name",
    "provider",
    "smtp_host",
    "smtp_port",
    "smtp_secure",
    "smtp_username",
    "imap_host",
    "imap_port",
    "imap_username",
    "is_default",
    "last_sync_at",
    "last_status",
    "created_at",
  ],
  mailbox_secrets: [
    "mailbox_id",
    "smtp_password",
    "imap_password",
    "oauth_access_token",
    "oauth_refresh_token",
    "oauth_expires_at",
    "updated_at",
  ],
  campaigns: [
    "id",
    "name",
    "subject",
    "body_html",
    "mailbox_id",
    "cc",
    "bcc",
    "attachments",
    "track_opens",
    "track_clicks",
    "status",
    "campaign_type",
    "objective",
    "owner_id",
    "approval_required",
    "approved_by",
    "approved_at",
    "scheduled_at",
    "completed_at",
    "timezone",
    "daily_limit",
    "stop_on_reply",
    "stop_on_bounce",
    "audience_rules",
    "sent_at",
    "created_at",
    "updated_at",
  ],
  campaign_recipients: [
    "id",
    "campaign_id",
    "prospect_id",
    "contact_id",
    "status",
    "error",
    "message_id",
    "sent_at",
    "opened_at",
    "open_count",
    "clicked_at",
    "click_count",
    "replied_at",
    "current_step",
    "next_action_at",
    "stopped_reason",
    "last_activity_at",
    "converted_at",
    "attempt_count",
    "created_at",
  ],
  campaign_steps: [
    "id",
    "campaign_id",
    "step_order",
    "step_type",
    "name",
    "delay_amount",
    "delay_unit",
    "subject",
    "body_html",
    "attachments",
    "task_instructions",
    "is_active",
    "created_at",
    "updated_at",
  ],
  campaign_events: [
    "id",
    "campaign_id",
    "recipient_id",
    "event_type",
    "detail",
    "actor_id",
    "created_at",
  ],
  email_suppressions: ["id", "email", "reason", "source", "campaign_id", "notes", "created_at"],
  deals: [
    "id",
    "title",
    "client_id",
    "prospect_id",
    "value",
    "currency",
    "stage",
    "probability",
    "expected_close_date",
    "owner",
    "notes",
    "created_at",
    "updated_at",
  ],
  agreements: [
    "id",
    "client_id",
    "deal_id",
    "title",
    "agreement_type",
    "status",
    "start_date",
    "end_date",
    "value",
    "currency",
    "billing_cycle",
    "response_time_hours",
    "resolution_time_hours",
    "coverage_hours",
    "auto_renew",
    "notes",
    "created_at",
    "updated_at",
  ],
  agreement_items: [
    "id",
    "agreement_id",
    "description",
    "quantity",
    "unit_price",
    "created_at",
    "updated_at",
  ],
  activities: [
    "id",
    "entity_type",
    "entity_id",
    "activity_type",
    "body",
    "occurred_at",
    "created_at",
    "updated_at",
  ],
  replies: [
    "id",
    "mailbox_id",
    "prospect_id",
    "contact_id",
    "campaign_id",
    "opportunity_type",
    "opportunity_id",
    "from_email",
    "subject",
    "snippet",
    "body",
    "body_html",
    "attachments",
    "received_at",
    "external_id",
    "created_at",
  ],
  quotations: [
    "id",
    "quote_number",
    "title",
    "client_id",
    "deal_id",
    "status",
    "currency",
    "issue_date",
    "valid_until",
    "tax_rate",
    "discount",
    "notes",
    "created_at",
    "updated_at",
  ],
  quotation_items: [
    "id",
    "quotation_id",
    "description",
    "quantity",
    "unit_price",
    "created_at",
    "updated_at",
  ],
  projects: [
    "id",
    "name",
    "code",
    "client_id",
    "manager",
    "status",
    "start_date",
    "end_date",
    "budget",
    "currency",
    "progress",
    "description",
    "created_at",
    "updated_at",
  ],
  bids: [
    "id",
    "reference",
    "title",
    "buyer",
    "client_id",
    "status",
    "closing_date",
    "submission_date",
    "value",
    "currency",
    "bond_amount",
    "notes",
    "created_at",
    "updated_at",
  ],
  cost_sheets: [
    "id",
    "name",
    "client_id",
    "quotation_id",
    "bid_id",
    "project_id",
    "status",
    "currency",
    "notes",
    "created_at",
    "updated_at",
  ],
  cost_sheet_items: [
    "id",
    "cost_sheet_id",
    "category",
    "description",
    "quantity",
    "unit_cost",
    "markup_percent",
    "custom_values",
    "attachments",
    "created_at",
    "updated_at",
  ],
  cost_sheet_columns: [
    "id",
    "cost_sheet_id",
    "name",
    "column_key",
    "data_type",
    "default_value",
    "formula_expression",
    "display_order",
    "created_at",
    "updated_at",
  ],
  jobs: [
    "id",
    "title",
    "client_id",
    "project_id",
    "job_type",
    "assignee",
    "priority",
    "status",
    "scheduled_date",
    "completed_at",
    "notes",
    "created_at",
    "updated_at",
  ],
  tasks: [
    "id",
    "title",
    "entity_type",
    "entity_id",
    "assignee",
    "priority",
    "status",
    "due_date",
    "notes",
    "created_at",
    "updated_at",
  ],
  suppliers: [
    "id",
    "name",
    "contact_name",
    "email",
    "phone",
    "category",
    "notes",
    "created_at",
    "updated_at",
  ],
  supplier_quotes: [
    "id",
    "supplier_id",
    "source_name",
    "quote_reference",
    "quote_date",
    "valid_until",
    "currency",
    "amount",
    "notes",
    "attachment_path",
    "attachment_name",
    "attachment_type",
    "attachment_size",
    "created_by",
    "created_at",
    "updated_at",
  ],
  cost_sheet_supplier_quotes: ["cost_sheet_id", "supplier_quote_id", "created_by", "created_at"],
  purchase_orders: [
    "id",
    "po_number",
    "supplier_id",
    "project_id",
    "status",
    "order_date",
    "expected_date",
    "currency",
    "notes",
    "created_at",
    "updated_at",
  ],
  purchase_order_items: [
    "id",
    "purchase_order_id",
    "description",
    "quantity",
    "unit_price",
    "received_quantity",
    "created_at",
    "updated_at",
  ],
  prequalifications: [
    "id",
    "reference",
    "title",
    "buyer",
    "client_id",
    "category",
    "submission_type",
    "status",
    "submitted_date",
    "valid_until",
    "due_date",
    "value",
    "currency",
    "response_channel",
    "submission_email",
    "submission_cc",
    "delivery_location",
    "portal_url",
    "portal_username",
    "submission_instructions",
    "submission_time",
    "cost_sheet_id",
    "submitted_at",
    "outcome",
    "notes",
    "created_at",
    "updated_at",
  ],
  requests: [
    "id",
    "reference",
    "title",
    "issuer",
    "client_id",
    "request_type",
    "status",
    "received_date",
    "due_date",
    "value",
    "currency",
    "scope",
    "created_at",
    "updated_at",
  ],
  marketing_activities: [
    "id",
    "name",
    "channel",
    "status",
    "start_date",
    "end_date",
    "budget",
    "spend",
    "leads",
    "currency",
    "notes",
    "created_at",
    "updated_at",
  ],
  documents: [
    "id",
    "title",
    "category",
    "entity_type",
    "entity_id",
    "owner",
    "version",
    "file_url",
    "issue_date",
    "expiry_date",
    "notes",
    "created_at",
    "updated_at",
  ],
  vacancies: [
    "id",
    "title",
    "department",
    "employment_type",
    "status",
    "openings",
    "location",
    "closing_date",
    "description",
    "created_at",
    "updated_at",
  ],
  applicants: [
    "id",
    "vacancy_id",
    "full_name",
    "email",
    "phone",
    "stage",
    "rating",
    "resume_url",
    "notes",
    "created_at",
    "updated_at",
  ],
  employees: [
    "id",
    "employee_number",
    "full_name",
    "email",
    "phone",
    "job_title",
    "avatar_url",
    "department",
    "employment_type",
    "status",
    "start_date",
    "end_date",
    "base_salary",
    "currency",
    "notes",
    "created_at",
    "updated_at",
  ],
  leave_requests: [
    "id",
    "employee_id",
    "leave_type",
    "start_date",
    "end_date",
    "days",
    "status",
    "reason",
    "created_at",
    "updated_at",
  ],
  payroll_runs: [
    "id",
    "period",
    "pay_date",
    "status",
    "currency",
    "notes",
    "created_at",
    "updated_at",
  ],
  payroll_items: [
    "id",
    "payroll_run_id",
    "employee_id",
    "gross",
    "allowances",
    "deductions",
    "tax",
    "net",
    "created_at",
    "updated_at",
  ],
  invoices: [
    "id",
    "invoice_number",
    "client_id",
    "quotation_id",
    "project_id",
    "status",
    "issue_date",
    "due_date",
    "amount",
    "tax",
    "paid_amount",
    "currency",
    "notes",
    "created_at",
    "updated_at",
  ],
  expenses: [
    "id",
    "description",
    "category",
    "vendor",
    "amount",
    "currency",
    "expense_date",
    "project_id",
    "status",
    "notes",
    "created_at",
    "updated_at",
  ],
  payments: [
    "id",
    "invoice_id",
    "amount",
    "currency",
    "paid_at",
    "method",
    "reference",
    "created_at",
    "updated_at",
  ],
  system_settings: [
    "id",
    "setting_key",
    "setting_group",
    "setting_value",
    "created_at",
    "updated_at",
  ],
  app_secrets: ["id", "secret_key", "encrypted_value", "created_at", "updated_at"],
  email_templates: [
    "id",
    "name",
    "event_key",
    "subject",
    "body_html",
    "is_active",
    "created_at",
    "updated_at",
  ],
  roles: ["id", "name", "description", "is_system", "created_at", "updated_at"],
  permissions: ["id", "permission_key", "name", "module", "created_at"],
  role_permissions: ["id", "role_id", "permission_id", "created_at"],
  system_users: [
    "id",
    "full_name",
    "email",
    "role_id",
    "status",
    "last_login_at",
    "password_hash",
    "created_at",
    "updated_at",
  ],
  auth_sessions: ["id", "user_id", "token_hash", "expires_at", "created_at"],
  prospect_contacts: [
    "id",
    "prospect_id",
    "first_name",
    "last_name",
    "email",
    "phone",
    "raw_phone",
    "gender",
    "job_title",
    "avatar_url",
    "location",
    "location_source_url",
    "location_is_inferred",
    "is_primary",
    "created_at",
    "updated_at",
  ],
  client_contacts: [
    "id",
    "client_id",
    "first_name",
    "last_name",
    "email",
    "phone",
    "raw_phone",
    "gender",
    "job_title",
    "avatar_url",
    "location",
    "location_source_url",
    "location_is_inferred",
    "is_primary",
    "created_at",
    "updated_at",
  ],
  prospect_categories: ["id", "name", "description", "offerings", "created_at", "updated_at"],
  prospect_interactions: [
    "id",
    "prospect_id",
    "contact_id",
    "interaction_type",
    "direction",
    "subject",
    "body",
    "body_html",
    "attachments",
    "message_id",
    "occurred_at",
    "created_at",
  ],
  notifications: [
    "id",
    "user_id",
    "notification_type",
    "title",
    "body",
    "action_url",
    "entity_type",
    "entity_id",
    "read_at",
    "email_sent_at",
    "created_at",
  ],
  notification_preferences: [
    "user_id",
    "in_app_enabled",
    "email_enabled",
    "email_delay_minutes",
    "updated_at",
  ],
  page_notes: [
    "id",
    "page_key",
    "title",
    "body",
    "color",
    "is_pinned",
    "is_open",
    "position_x",
    "position_y",
    "width",
    "height",
    "z_index",
    "created_by",
    "updated_by",
    "created_at",
    "updated_at",
  ],
  page_note_mentions: ["note_id", "user_id", "created_at"],
  ai_prospect_searches: ["id", "prompt", "search_context", "results_json", "status", "created_at"],
};
const jsonFields: Record<string, string[]> = {
  prospects: ["extra"],
  campaigns: ["cc", "bcc", "attachments", "audience_rules"],
  campaign_steps: ["attachments"],
  system_settings: ["setting_value"],
  ai_prospect_searches: ["results_json"],
  replies: ["attachments"],
  prospect_interactions: ["attachments"],
  cost_sheet_items: ["custom_values", "attachments"],
};
const booleanFields: Record<string, string[]> = {
  mailboxes: ["smtp_secure", "is_default"],
  campaigns: [
    "track_opens",
    "track_clicks",
    "approval_required",
    "stop_on_reply",
    "stop_on_bounce",
  ],
  campaign_steps: ["is_active"],
  agreements: ["auto_renew"],
  email_templates: ["is_active"],
  roles: ["is_system"],
  prospect_contacts: ["is_primary", "location_is_inferred"],
  client_contacts: ["is_primary", "location_is_inferred"],
  notification_preferences: ["in_app_enabled", "email_enabled"],
  page_notes: ["is_pinned", "is_open"],
};
const publicTables = new Set<TableName>([
  "prospects",
  "clients",
  "mailboxes",
  "campaigns",
  "campaign_recipients",
  "campaign_steps",
  "campaign_events",
  "email_suppressions",
  "deals",
  "agreements",
  "agreement_items",
  "activities",
  "replies",
  "quotations",
  "quotation_items",
  "projects",
  "bids",
  "cost_sheets",
  "cost_sheet_items",
  "cost_sheet_columns",
  "jobs",
  "tasks",
  "suppliers",
  "purchase_orders",
  "purchase_order_items",
  "prequalifications",
  "requests",
  "marketing_activities",
  "documents",
  "vacancies",
  "applicants",
  "employees",
  "leave_requests",
  "payroll_runs",
  "payroll_items",
  "invoices",
  "expenses",
  "payments",
  "system_settings",
  "email_templates",
  "roles",
  "permissions",
  "role_permissions",
  "prospect_contacts",
  "client_contacts",
  "prospect_categories",
  "prospect_interactions",
  "page_notes",
  "page_note_mentions",
  "ai_prospect_searches",
]);
let pool: Pool | undefined;

const connectTimeoutMs = Math.max(
  1_000,
  Math.min(Number(process.env["DB_CONNECT_TIMEOUT_MS"] || 5_000), 15_000),
);
const queryTimeoutMs = Math.max(
  1_000,
  Math.min(Number(process.env["DB_QUERY_TIMEOUT_MS"] || 5_000), 15_000),
);

export function getPool() {
  if (!pool) {
    const database = process.env["DB_NAME"] || "gwero_crm";
    if (!/^[a-zA-Z0-9_]+$/.test(database)) throw new Error("Invalid DB_NAME");
    pool = mysql.createPool({
      database,
      user: process.env["DB_USER"] || process.env["USER"] || "root",
      password: process.env["DB_PASSWORD"] || "",
      charset: "utf8mb4_unicode_ci",
      ...(process.env["DB_SOCKET"] || (!process.env["DB_HOST"] && process.platform === "darwin")
        ? { socketPath: process.env["DB_SOCKET"] || "/tmp/mysql.sock" }
        : {
            host: process.env["DB_HOST"] || "127.0.0.1",
            port: Number(process.env["DB_PORT"] || 3306),
          }),
      waitForConnections: true,
      connectionLimit: 10,
      maxIdle: 10,
      idleTimeout: 60_000,
      queueLimit: 100,
      connectTimeout: connectTimeoutMs,
      enableKeepAlive: true,
      keepAliveInitialDelay: 0,
      dateStrings: true,
      decimalNumbers: true,
    });
  }
  return pool;
}

export async function executeRead(sql: string, values: unknown[] = []) {
  return withDatabaseReadRetry(
    () => getPool().execute({ sql, timeout: queryTimeoutMs }, values as never[]),
    { attempts: 2, delayMs: 100 },
  );
}

function assertColumn(table: TableName, column: string) {
  if (!fields[table].includes(column)) throw new Error(`Invalid ${table} column: ${column}`);
  return `\`${column}\``;
}
function decode(table: TableName, row: Record<string, unknown>) {
  const result = { ...row };
  for (const key of jsonFields[table] || [])
    if (typeof result[key] === "string") {
      try {
        result[key] = JSON.parse(result[key] as string);
      } catch {
        result[key] = null;
      }
    }
  for (const key of booleanFields[table] || [])
    if (key in result) result[key] = Boolean(result[key]);
  return result;
}
function encode(table: TableName, key: string, value: unknown) {
  if (value === undefined) return null;
  if (jsonFields[table]?.includes(key)) return JSON.stringify(value ?? (key === "extra" ? {} : []));
  if (typeof value === "boolean") return value ? 1 : 0;
  if (typeof value === "string" && /^\d{4}-\d\d-\d\dT/.test(value))
    return value.replace("T", " ").replace(/Z$/, "").slice(0, 23);
  return value;
}
function where(input: DbInput) {
  const clauses: string[] = [];
  const params: unknown[] = [];
  for (const filter of input.filters) {
    const column = assertColumn(input.table, filter.column);
    if (filter.op === "eq") {
      clauses.push(filter.value === null ? `${column} IS NULL` : `${column} = ?`);
      if (filter.value !== null) params.push(filter.value);
    } else {
      const values = Array.isArray(filter.value) ? filter.value : [];
      clauses.push(values.length ? `${column} IN (${values.map(() => "?").join(",")})` : "FALSE");
      params.push(...values);
    }
  }
  return { sql: clauses.length ? ` WHERE ${clauses.join(" AND ")}` : "", params };
}
async function rows(table: TableName, clause: string, params: unknown[] = []) {
  const [result] = await executeRead(`SELECT * FROM \`${table}\`${clause}`, params);
  return (result as Array<Record<string, unknown>>).map((row) => decode(table, row));
}
async function enrich(table: TableName, input: DbInput, selected: Array<Record<string, unknown>>) {
  const projection = input.columns || "";
  if (table === "campaigns" && projection.includes("campaign_recipients(")) {
    for (const row of selected)
      row["campaign_recipients"] = await rows("campaign_recipients", " WHERE campaign_id = ?", [
        row["id"],
      ]);
  }
  if (table === "campaigns" && projection.includes("campaign_steps(")) {
    for (const row of selected)
      row["campaign_steps"] = await rows(
        "campaign_steps",
        " WHERE campaign_id = ? ORDER BY step_order ASC",
        [row["id"]],
      );
  }
  if (table === "campaign_recipients" && projection.includes("prospects(")) {
    for (const row of selected)
      row["prospects"] =
        (await rows("prospects", " WHERE id = ? LIMIT 1", [row["prospect_id"]]))[0] || null;
  }
  if ((table === "deals" || table === "agreements") && projection.includes("clients(")) {
    for (const row of selected)
      row["clients"] = row["client_id"]
        ? (await rows("clients", " WHERE id = ? LIMIT 1", [row["client_id"]]))[0] || null
        : null;
  }
  if (table === "replies") {
    if (projection.includes("prospects("))
      for (const row of selected)
        row["prospects"] = row["prospect_id"]
          ? (await rows("prospects", " WHERE id = ? LIMIT 1", [row["prospect_id"]]))[0] || null
          : null;
    if (projection.includes("campaigns("))
      for (const row of selected)
        row["campaigns"] = row["campaign_id"]
          ? (await rows("campaigns", " WHERE id = ? LIMIT 1", [row["campaign_id"]]))[0] || null
          : null;
  }
  return selected;
}

async function execute(input: DbInput, allowSecrets: boolean): Promise<DbResult<unknown>> {
  try {
    if (
      !Object.prototype.hasOwnProperty.call(fields, input.table) ||
      (!allowSecrets && !publicTables.has(input.table))
    )
      throw new Error("Table is not available");
    const table = input.table;
    const condition = where(input);
    const db = getPool();
    if (input.action === "select") {
      const order = input.orderBy
        ? ` ORDER BY ${assertColumn(table, input.orderBy)} ${input.ascending === false ? "DESC" : "ASC"}`
        : "";
      const limit = ` LIMIT ${Math.max(1, Math.min(Number(input.limit) || 10000, 10000))}`;
      const selected = await rows(table, condition.sql + order + limit, condition.params);
      return { data: await enrich(table, input, selected), error: null };
    }
    if (input.action === "insert" || input.action === "upsert") {
      const values = Array.isArray(input.values) ? input.values : [input.values || {}];
      if (!values.length || values.length > 10000) throw new Error("Invalid row count");
      const inserted: Array<Record<string, unknown>> = [];
      for (const item of values) {
        const record = { ...item };
        if (table !== "mailbox_secrets" && !record["id"]) record["id"] = randomUUID();
        if (table === "prospects" && record["extra"] === undefined) record["extra"] = {};
        if (table === "campaigns") {
          record["cc"] ??= [];
          record["bcc"] ??= [];
          record["attachments"] ??= [];
        }
        const keys = Object.keys(record);
        if (!keys.length) throw new Error("Empty row");
        const cols = keys.map((key) => assertColumn(table, key));
        const params = keys.map((key) => encode(table, key, record[key]));
        const update =
          input.action === "upsert"
            ? ` ON DUPLICATE KEY UPDATE ${
                keys
                  .filter((key) => key !== "id" && key !== "mailbox_id")
                  .map((key) => `${assertColumn(table, key)} = VALUES(${assertColumn(table, key)})`)
                  .join(", ") || `${cols[0]} = ${cols[0]}`
              }`
            : "";
        await db.execute(
          `INSERT INTO \`${table}\` (${cols.join(", ")}) VALUES (${keys.map(() => "?").join(", ")})${update}`,
          params as never[],
        );
        const lookup = table === "mailbox_secrets" ? "mailbox_id" : input.conflict || "id";
        const found = await rows(table, ` WHERE ${assertColumn(table, lookup)} = ? LIMIT 1`, [
          record[lookup],
        ]);
        if (found[0]) inserted.push(found[0]);
      }
      return { data: inserted, error: null };
    }
    if (!input.filters.length) throw new Error("Update and delete require a filter");
    if (input.action === "delete") {
      await db.execute(`DELETE FROM \`${table}\`${condition.sql}`, condition.params as never[]);
      return { data: [], error: null };
    }
    if (input.action === "update") {
      const record = (Array.isArray(input.values) ? input.values[0] : input.values) || {};
      const keys = Object.keys(record);
      if (!keys.length) throw new Error("Empty update");
      const setters = keys.map((key) => `${assertColumn(table, key)} = ?`).join(", ");
      await db.execute(`UPDATE \`${table}\` SET ${setters}${condition.sql}`, [
        ...keys.map((key) => encode(table, key, record[key])),
        ...condition.params,
      ] as never[]);
      return { data: await rows(table, condition.sql, condition.params), error: null };
    }
    throw new Error("Unsupported database action");
  } catch (error) {
    return {
      data: [],
      error: { message: error instanceof Error ? error.message : "Database error" },
    };
  }
}

export const serverDb = createDb((input) => execute(input, true));
export const runClientQuery = (input: DbInput) => execute(input, false);
