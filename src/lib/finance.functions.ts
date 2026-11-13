import { createServerFn } from "@tanstack/react-start";
import type { PoolConnection } from "mysql2/promise";
import {
  calculateFinanceLines,
  buildAccrualJournal,
  roundMoney,
  type FinanceLineInput,
  type FinanceTransactionType,
  type TaxTreatment,
} from "./finance-ledger";
import { permissionMiddleware } from "./auth.middleware";

const permission = permissionMiddleware("finance.manage");
const allowedSources = new Set(["bid", "rfp", "rfq", "eoi", "project", "job", "task", "client"]);
type AttachmentInput = { path: string; name: string; type: string; size: number };
type FinanceDbTransaction = {
  id: string;
  transaction_number: string;
  transaction_type: string;
  status: string;
  transaction_date: string;
  description: string;
  currency: string;
  total_amount: number;
  paid_amount: number;
  tax_recoverable: boolean;
  source_type: string | null;
  source_id: string | null;
  [key: string]: string | number | boolean | null;
};
type FinanceDbLine = {
  transaction_id: string;
  account_id: string;
  description: string;
  quantity: number;
  unit_amount: number;
  net_amount: number;
  tax_rate: number;
  tax_amount: number;
  total_amount: number;
  [key: string]: string | number | boolean | null;
};
type FinanceDbAttachment = {
  transaction_id: string;
  [key: string]: string | number | boolean | null;
};
type FinanceDbPayment = {
  transaction_id: string;
  [key: string]: string | number | boolean | null;
};
type FinanceDbJournal = {
  id: string;
  [key: string]: string | number | boolean | null;
};
type FinanceDbJournalLine = {
  account_id: string;
  description: string | null;
  debit: number;
  credit: number;
  currency: string;
  source_type: string | null;
  source_id: string | null;
  [key: string]: string | number | boolean | null;
};
type SerializableRow = Record<string, string | number | boolean | null>;
export type FinanceTransactionInput = {
  id?: string;
  type: FinanceTransactionType;
  date: string;
  dueDate?: string;
  description: string;
  counterparty?: string;
  reference?: string;
  currency: string;
  taxTreatment: TaxTreatment;
  taxRecoverable?: boolean;
  sourceType?: string;
  sourceId?: string;
  clientId?: string;
  projectId?: string;
  notes?: string;
  lines: FinanceLineInput[];
  attachments?: AttachmentInput[];
};

async function pool() {
  return (await import("./db.server")).getPool();
}
function serial<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}
function rows<T>(result: unknown): T[] {
  return (result as [T[]])[0];
}
function validDate(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}
function number(prefix: string) {
  return `${prefix}-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
}

export const getFinanceWorkspace = createServerFn({ method: "GET" })
  .middleware([permission])
  .validator((data?: { sourceType?: string; sourceId?: string }) => data || {})
  .handler(async ({ data }) => {
    const db = await pool();
    const filter =
      data.sourceType && data.sourceId ? "WHERE t.source_type = ? AND t.source_id = ?" : "";
    const params = filter ? [data.sourceType, data.sourceId] : [];
    const [accountResult, currencyResult, transactionResult, sourceResult] = await Promise.all([
      db.query(
        "SELECT id, code, name, account_type, normal_balance, is_system FROM finance_accounts WHERE is_active = TRUE ORDER BY code",
      ),
      db.query(
        "SELECT code, name, symbol, is_default FROM currencies WHERE is_active = TRUE ORDER BY is_default DESC, sort_order, code",
      ),
      db.query(
        `SELECT t.*, COALESCE(c.company, c.name) AS client_name, p.name AS project_name, u.full_name AS created_by_name,
                CASE t.source_type
                  WHEN 'bid' THEN b.title WHEN 'eoi' THEN COALESCE(pre.title, pre.buyer)
                  WHEN 'rfp' THEN req.title WHEN 'rfq' THEN req.title
                  WHEN 'project' THEN source_project.name WHEN 'job' THEN j.title WHEN 'task' THEN task.title
                  WHEN 'client' THEN COALESCE(source_client.company, source_client.name) ELSE NULL END AS source_title
           FROM finance_transactions t
           LEFT JOIN clients c ON c.id=t.client_id LEFT JOIN projects p ON p.id=t.project_id
           LEFT JOIN system_users u ON u.id=t.created_by
           LEFT JOIN bids b ON t.source_type='bid' AND b.id=t.source_id
           LEFT JOIN prequalifications pre ON t.source_type='eoi' AND pre.id=t.source_id
           LEFT JOIN requests req ON t.source_type IN ('rfp','rfq') AND req.id=t.source_id
           LEFT JOIN projects source_project ON t.source_type='project' AND source_project.id=t.source_id
           LEFT JOIN jobs j ON t.source_type='job' AND j.id=t.source_id
           LEFT JOIN tasks task ON t.source_type='task' AND task.id=t.source_id
           LEFT JOIN clients source_client ON t.source_type='client' AND source_client.id=t.source_id
           ${filter} ORDER BY t.transaction_date DESC, t.created_at DESC LIMIT 500`,
        params,
      ),
      db.query(
        `SELECT 'bid' source_type, id source_id, title, client_id FROM bids WHERE archived_at IS NULL
         UNION ALL SELECT request_type, id, title, client_id FROM requests WHERE request_type IN ('rfp','rfq') AND archived_at IS NULL
         UNION ALL SELECT 'eoi', id, COALESCE(title,buyer), client_id FROM prequalifications WHERE archived_at IS NULL
         UNION ALL SELECT 'project', id, name, client_id FROM projects
         UNION ALL SELECT 'job', id, title, client_id FROM jobs
         UNION ALL SELECT 'task', id, title, NULL FROM tasks
         UNION ALL SELECT 'client', id, COALESCE(company,name), id FROM clients
         ORDER BY title LIMIT 1000`,
      ),
    ]);
    const transactions = rows<FinanceDbTransaction>(transactionResult);
    const ids = transactions.map((item) => item.id);
    let lineRows: FinanceDbLine[] = [];
    let attachmentRows: FinanceDbAttachment[] = [];
    let paymentRows: FinanceDbPayment[] = [];
    if (ids.length) {
      const placeholders = ids.map(() => "?").join(",");
      [lineRows, attachmentRows, paymentRows] = await Promise.all([
        db
          .query(
            `SELECT l.*, a.code account_code, a.name account_name FROM finance_transaction_lines l JOIN finance_accounts a ON a.id=l.account_id WHERE l.transaction_id IN (${placeholders}) ORDER BY l.line_order`,
            ids,
          )
          .then((result) => rows<FinanceDbLine>(result)),
        db
          .query(
            `SELECT * FROM finance_transaction_attachments WHERE transaction_id IN (${placeholders}) ORDER BY created_at`,
            ids,
          )
          .then((result) => rows<FinanceDbAttachment>(result)),
        db
          .query(
            `SELECT p.*, a.name cash_account_name FROM finance_transaction_payments p JOIN finance_accounts a ON a.id=p.cash_account_id WHERE p.transaction_id IN (${placeholders}) ORDER BY payment_date`,
            ids,
          )
          .then((result) => rows<FinanceDbPayment>(result)),
      ]);
    }
    const enriched = transactions.map((transaction) => ({
      ...transaction,
      lines: lineRows.filter((line) => line.transaction_id === transaction.id),
      attachments: attachmentRows.filter(
        (attachment) => attachment.transaction_id === transaction.id,
      ),
      payments: paymentRows.filter((payment) => payment.transaction_id === transaction.id),
    }));
    const posted = enriched.filter((item) => item.status === "posted");
    const revenue = posted
      .filter((item) => item.transaction_type === "revenue")
      .reduce((sum, item) => sum + Number(item.total_amount), 0);
    const expenses = posted
      .filter((item) => item.transaction_type === "expense")
      .reduce((sum, item) => sum + Number(item.total_amount), 0);
    const receivable = posted
      .filter((item) => item.transaction_type === "revenue")
      .reduce((sum, item) => sum + Number(item.total_amount) - Number(item.paid_amount), 0);
    const payable = posted
      .filter((item) => item.transaction_type === "expense")
      .reduce((sum, item) => sum + Number(item.total_amount) - Number(item.paid_amount), 0);
    return serial({
      accounts: rows<SerializableRow>(accountResult),
      currencies: rows<SerializableRow>(currencyResult),
      transactions: enriched,
      sources: rows<SerializableRow>(sourceResult),
      metrics: {
        revenue: roundMoney(revenue),
        expenses: roundMoney(expenses),
        profit: roundMoney(revenue - expenses),
        receivable: roundMoney(receivable),
        payable: roundMoney(payable),
      },
    });
  });

export const saveFinanceTransaction = createServerFn({ method: "POST" })
  .middleware([permission])
  .validator((data: FinanceTransactionInput) => data)
  .handler(async ({ data, context }) => {
    if (!data.description.trim() || !validDate(data.date))
      throw new Error("Description and a valid transaction date are required.");
    if (!data.lines.length) throw new Error("Add at least one transaction line.");
    if (data.sourceType && !allowedSources.has(data.sourceType))
      throw new Error("Invalid related activity type.");
    const calculation = calculateFinanceLines(data.lines, data.taxTreatment);
    const db = await pool();
    const connection = await db.getConnection();
    try {
      await connection.beginTransaction();
      const id = data.id || crypto.randomUUID();
      if (data.id) {
        const existing = rows<{ status: string }>(
          await connection.query("SELECT status FROM finance_transactions WHERE id=? FOR UPDATE", [
            id,
          ]),
        )[0];
        if (existing && existing.status !== "draft")
          throw new Error(
            "Posted or voided transactions cannot be edited. Void and recreate them instead.",
          );
      }
      const existingNumber = rows<{ transaction_number: string }>(
        await connection.query("SELECT transaction_number FROM finance_transactions WHERE id=?", [
          id,
        ]),
      )[0]?.transaction_number;
      const transactionNumber = existingNumber || number(data.type === "expense" ? "EXP" : "REV");
      await connection.execute(
        `INSERT INTO finance_transactions (id,transaction_number,transaction_type,status,transaction_date,due_date,description,counterparty,reference,currency,subtotal,tax_amount,total_amount,payment_status,tax_treatment,tax_rate,tax_recoverable,source_type,source_id,client_id,project_id,notes,created_by)
         VALUES (?,?,?,'draft',?,?,?,?,?,?,?,?,?,'unpaid',?,?,?,?,?,?,?,?,?)
         ON DUPLICATE KEY UPDATE transaction_type=VALUES(transaction_type),transaction_date=VALUES(transaction_date),due_date=VALUES(due_date),description=VALUES(description),counterparty=VALUES(counterparty),reference=VALUES(reference),currency=VALUES(currency),subtotal=VALUES(subtotal),tax_amount=VALUES(tax_amount),total_amount=VALUES(total_amount),tax_treatment=VALUES(tax_treatment),tax_rate=VALUES(tax_rate),tax_recoverable=VALUES(tax_recoverable),source_type=VALUES(source_type),source_id=VALUES(source_id),client_id=VALUES(client_id),project_id=VALUES(project_id),notes=VALUES(notes)`,
        [
          id,
          transactionNumber,
          data.type,
          data.date,
          data.dueDate || null,
          data.description.trim(),
          data.counterparty?.trim() || null,
          data.reference?.trim() || null,
          data.currency,
          calculation.subtotal,
          calculation.taxAmount,
          calculation.totalAmount,
          data.taxTreatment,
          Math.max(...calculation.lines.map((line) => Number(line.taxRate || 0)), 0),
          Boolean(data.taxRecoverable),
          data.sourceType || null,
          data.sourceId || null,
          data.clientId || null,
          data.projectId || null,
          data.notes?.trim() || null,
          context.user.id,
        ],
      );
      await connection.execute("DELETE FROM finance_transaction_lines WHERE transaction_id=?", [
        id,
      ]);
      for (const [index, line] of calculation.lines.entries())
        await connection.execute(
          "INSERT INTO finance_transaction_lines (id,transaction_id,line_order,account_id,description,quantity,unit_amount,net_amount,tax_rate,tax_amount,total_amount) VALUES (?,?,?,?,?,?,?,?,?,?,?)",
          [
            crypto.randomUUID(),
            id,
            index,
            line.accountId,
            line.description.trim(),
            line.quantity,
            line.unitAmount,
            line.netAmount,
            line.taxRate,
            line.taxAmount,
            line.totalAmount,
          ],
        );
      for (const attachment of data.attachments || [])
        await connection.execute(
          "INSERT INTO finance_transaction_attachments (id,transaction_id,attachment_path,file_name,content_type,file_size,created_by) VALUES (?,?,?,?,?,?,?)",
          [
            crypto.randomUUID(),
            id,
            attachment.path,
            attachment.name,
            attachment.type,
            attachment.size,
            context.user.id,
          ],
        );
      await connection.commit();
      return { id, transactionNumber };
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  });

async function systemAccounts(connection: PoolConnection) {
  const result = await connection.query(
    "SELECT id,code FROM finance_accounts WHERE code IN ('1000','1100','1150','2000','2100')",
  );
  const map = Object.fromEntries(
    rows<{ id: string; code: string }>(result).map((item) => [item.code, item.id]),
  );
  for (const code of ["1000", "1100", "1150", "2000", "2100"])
    if (!map[code]) throw new Error(`System account ${code} is missing.`);
  return map as Record<string, string>;
}

export const postFinanceTransaction = createServerFn({ method: "POST" })
  .middleware([permission])
  .validator((data: { id: string }) => data)
  .handler(async ({ data, context }) => {
    const db = await pool();
    const connection = await db.getConnection();
    try {
      await connection.beginTransaction();
      const transaction = rows<FinanceDbTransaction>(
        await connection.query("SELECT * FROM finance_transactions WHERE id=? FOR UPDATE", [
          data.id,
        ]),
      )[0];
      if (!transaction) throw new Error("Transaction not found.");
      if (transaction.status !== "draft") throw new Error("Only draft transactions can be posted.");
      const lines = rows<FinanceDbLine>(
        await connection.query(
          "SELECT * FROM finance_transaction_lines WHERE transaction_id=? ORDER BY line_order",
          [data.id],
        ),
      );
      const accounts = await systemAccounts(connection);
      const journal = buildAccrualJournal({
        type: String(transaction.transaction_type) as FinanceTransactionType,
        description: String(transaction.description),
        taxRecoverable: Boolean(transaction.tax_recoverable),
        lines: lines.map((line) => ({
          accountId: String(line.account_id),
          description: String(line.description),
          quantity: Number(line.quantity),
          unitAmount: Number(line.unit_amount),
          netAmount: Number(line.net_amount),
          taxRate: Number(line.tax_rate),
          taxAmount: Number(line.tax_amount),
          totalAmount: Number(line.total_amount),
        })),
        receivableAccountId: accounts["1100"]!,
        payableAccountId: accounts["2000"]!,
        inputTaxAccountId: accounts["1150"]!,
        outputTaxAccountId: accounts["2100"]!,
      });
      const journalId = crypto.randomUUID();
      await connection.execute(
        "INSERT INTO finance_journal_entries (id,journal_number,transaction_id,entry_date,description,posted_by) VALUES (?,?,?,?,?,?)",
        [
          journalId,
          number("JRN"),
          data.id,
          transaction.transaction_date,
          transaction.description,
          context.user.id,
        ],
      );
      for (const line of journal)
        await connection.execute(
          "INSERT INTO finance_journal_lines (id,journal_entry_id,account_id,description,debit,credit,currency,source_type,source_id) VALUES (?,?,?,?,?,?,?,?,?)",
          [
            crypto.randomUUID(),
            journalId,
            line.accountId,
            line.description,
            line.debit,
            line.credit,
            transaction.currency,
            transaction.source_type,
            transaction.source_id,
          ],
        );
      await connection.execute(
        "UPDATE finance_transactions SET status='posted',approved_by=?,approved_at=NOW(3),posted_at=NOW(3) WHERE id=?",
        [context.user.id, data.id],
      );
      await connection.commit();
      return { id: data.id };
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  });

export const recordFinancePayment = createServerFn({ method: "POST" })
  .middleware([permission])
  .validator(
    (data: {
      id: string;
      date: string;
      amount: number;
      method?: string;
      reference?: string;
      notes?: string;
    }) => data,
  )
  .handler(async ({ data, context }) => {
    if (!validDate(data.date) || !Number.isFinite(Number(data.amount)) || Number(data.amount) <= 0)
      throw new Error("Enter a valid payment date and amount.");
    const db = await pool();
    const connection = await db.getConnection();
    try {
      await connection.beginTransaction();
      const transaction = rows<FinanceDbTransaction>(
        await connection.query("SELECT * FROM finance_transactions WHERE id=? FOR UPDATE", [
          data.id,
        ]),
      )[0];
      if (!transaction || transaction.status !== "posted")
        throw new Error("Only posted transactions can receive payments.");
      const amount = roundMoney(Number(data.amount));
      const remaining = roundMoney(
        Number(transaction.total_amount) - Number(transaction.paid_amount),
      );
      if (amount > remaining)
        throw new Error(`Payment cannot exceed the outstanding amount of ${remaining.toFixed(2)}.`);
      const accounts = await systemAccounts(connection);
      const isRevenue = transaction.transaction_type === "revenue";
      const journalId = crypto.randomUUID();
      await connection.execute(
        "INSERT INTO finance_transaction_payments (id,transaction_id,payment_date,amount,method,reference,cash_account_id,notes,created_by) VALUES (?,?,?,?,?,?,?,?,?)",
        [
          crypto.randomUUID(),
          data.id,
          data.date,
          amount,
          data.method || null,
          data.reference || null,
          accounts["1000"]!,
          data.notes || null,
          context.user.id,
        ],
      );
      await connection.execute(
        "INSERT INTO finance_journal_entries (id,journal_number,transaction_id,entry_date,description,posted_by) VALUES (?,?,?,?,?,?)",
        [
          journalId,
          number("PAY"),
          data.id,
          data.date,
          `${isRevenue ? "Receipt" : "Payment"}: ${transaction.description}`,
          context.user.id,
        ],
      );
      const sides: Array<[string, number, number]> = isRevenue
        ? [
            [accounts["1000"]!, amount, 0],
            [accounts["1100"]!, 0, amount],
          ]
        : [
            [accounts["2000"]!, amount, 0],
            [accounts["1000"]!, 0, amount],
          ];
      for (const [accountId, debit, credit] of sides)
        await connection.execute(
          "INSERT INTO finance_journal_lines (id,journal_entry_id,account_id,description,debit,credit,currency,source_type,source_id) VALUES (?,?,?,?,?,?,?,?,?)",
          [
            crypto.randomUUID(),
            journalId,
            accountId,
            transaction.description,
            debit,
            credit,
            transaction.currency,
            transaction.source_type,
            transaction.source_id,
          ],
        );
      const paid = roundMoney(Number(transaction.paid_amount) + amount);
      const status = paid >= Number(transaction.total_amount) ? "paid" : "part_paid";
      await connection.execute(
        "UPDATE finance_transactions SET paid_amount=?,payment_status=? WHERE id=?",
        [paid, status, data.id],
      );
      await connection.commit();
      return { id: data.id };
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  });

export const deleteFinanceDraft = createServerFn({ method: "POST" })
  .middleware([permission])
  .validator((data: { id: string }) => data)
  .handler(async ({ data }) => {
    const db = await pool();
    const [result] = await db.execute(
      "DELETE FROM finance_transactions WHERE id=? AND status='draft'",
      [data.id],
    );
    if (!Number((result as { affectedRows: number }).affectedRows))
      throw new Error("Only draft transactions can be deleted.");
    return { id: data.id };
  });

export const voidFinanceTransaction = createServerFn({ method: "POST" })
  .middleware([permission])
  .validator((data: { id: string; reason: string }) => data)
  .handler(async ({ data, context }) => {
    if (!data.reason.trim()) throw new Error("A void reason is required for the audit trail.");
    const db = await pool();
    const connection = await db.getConnection();
    try {
      await connection.beginTransaction();
      const transaction = rows<FinanceDbTransaction>(
        await connection.query("SELECT * FROM finance_transactions WHERE id=? FOR UPDATE", [
          data.id,
        ]),
      )[0];
      if (!transaction || transaction.status !== "posted")
        throw new Error("Only posted transactions can be voided.");
      if (Number(transaction.paid_amount) > 0)
        throw new Error("Reverse recorded payments before voiding this transaction.");
      const original = rows<FinanceDbJournal>(
        await connection.query(
          "SELECT * FROM finance_journal_entries WHERE transaction_id=? AND reversal_of IS NULL ORDER BY posted_at LIMIT 1",
          [data.id],
        ),
      )[0];
      if (!original) throw new Error("Original journal entry not found.");
      const lines = rows<FinanceDbJournalLine>(
        await connection.query("SELECT * FROM finance_journal_lines WHERE journal_entry_id=?", [
          original.id,
        ]),
      );
      const reversalId = crypto.randomUUID();
      await connection.execute(
        "INSERT INTO finance_journal_entries (id,journal_number,transaction_id,entry_date,description,reversal_of,posted_by) VALUES (?,?,?,?,?,?,?)",
        [
          reversalId,
          number("REVERSAL"),
          data.id,
          new Date().toISOString().slice(0, 10),
          `Void: ${transaction.description}`,
          original.id,
          context.user.id,
        ],
      );
      for (const line of lines)
        await connection.execute(
          "INSERT INTO finance_journal_lines (id,journal_entry_id,account_id,description,debit,credit,currency,source_type,source_id) VALUES (?,?,?,?,?,?,?,?,?)",
          [
            crypto.randomUUID(),
            reversalId,
            line.account_id,
            `Reversal · ${line.description || transaction.description}`,
            line.credit,
            line.debit,
            line.currency,
            line.source_type,
            line.source_id,
          ],
        );
      await connection.execute("UPDATE finance_journal_entries SET status='reversed' WHERE id=?", [
        original.id,
      ]);
      await connection.execute(
        "UPDATE finance_transactions SET status='voided',voided_at=NOW(3),void_reason=? WHERE id=?",
        [data.reason.trim(), data.id],
      );
      await connection.commit();
      return { id: data.id };
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  });
