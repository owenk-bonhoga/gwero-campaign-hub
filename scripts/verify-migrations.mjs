import mysql from "mysql2/promise";

const database = process.env.DB_NAME || "gwero_crm";
if (!/^[a-zA-Z0-9_]+$/.test(database)) throw new Error("Invalid DB_NAME");

const connection = await mysql.createConnection({
  user: process.env.DB_USER || process.env.USER || "root",
  password: process.env.DB_PASSWORD || "",
  database,
  ...(process.env.DB_SOCKET || (!process.env.DB_HOST && process.platform === "darwin")
    ? { socketPath: process.env.DB_SOCKET || "/tmp/mysql.sock" }
    : {
        host: process.env.DB_HOST || "127.0.0.1",
        port: Number(process.env.DB_PORT || 3306),
      }),
});

const requiredTables = [
  "attachment_files",
  "document_categories",
  "document_versions",
  "document_access",
  "document_marks",
  "document_mark_applications",
  "portal_accounts",
  "bidaf_buyer_links",
  "bidaf_opportunity_links",
  "bidaf_sync_state",
  "cost_sheet_columns",
  "cost_sheet_supplier_quotes",
  "organization_locations",
  "opportunity_comment_mentions",
  "schema_migrations",
  "security_login_limits",
  "supplier_quotes",
  "finance_accounts",
  "finance_transactions",
  "finance_transaction_lines",
  "finance_journal_entries",
  "finance_journal_lines",
  "finance_transaction_attachments",
  "finance_transaction_payments",
];

const requiredColumns = [
  ["attachment_files", "uploaded_by"],
  ["documents", "category_id"],
  ["documents", "owner_id"],
  ["documents", "status"],
  ["cost_sheets", "column_rules"],
  ["cost_sheet_items", "attachments"],
  ["cost_sheet_items", "custom_values"],
  ["prospect_contacts", "location"],
  ["finance_transactions", "source_type"],
  ["finance_transactions", "tax_treatment"],
  ["finance_transactions", "payment_status"],
];

try {
  const [tables] = await connection.query(
    `SELECT TABLE_NAME FROM information_schema.TABLES
      WHERE TABLE_SCHEMA = ? AND TABLE_NAME IN (${requiredTables.map(() => "?").join(", ")})`,
    [database, ...requiredTables],
  );
  const foundTables = new Set(tables.map((row) => row.TABLE_NAME));
  const missingTables = requiredTables.filter((table) => !foundTables.has(table));

  const missingColumns = [];
  for (const [table, column] of requiredColumns) {
    const [rows] = await connection.query(
      `SELECT 1 FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND COLUMN_NAME = ? LIMIT 1`,
      [database, table, column],
    );
    if (!rows.length) missingColumns.push(`${table}.${column}`);
  }

  if (missingTables.length || missingColumns.length) {
    throw new Error(
      `Migration verification failed. Missing tables: ${missingTables.join(", ") || "none"}; missing columns: ${missingColumns.join(", ") || "none"}`,
    );
  }
  console.log(
    `Migration verification passed (${requiredTables.length} tables, ${requiredColumns.length} columns).`,
  );
} finally {
  await connection.end();
}
