import fs from "node:fs";
import { createHash } from "node:crypto";
import mysql from "mysql2/promise";
const database = process.env.DB_NAME || "gwero_crm";
if (!/^[a-zA-Z0-9_]+$/.test(database)) throw new Error("Invalid DB_NAME");
const connectionOptions = {
  user: process.env.DB_USER || process.env.USER || "root",
  password: process.env.DB_PASSWORD,
  database,
  ...(process.env.DB_SOCKET || (!process.env.DB_HOST && process.platform === "darwin")
    ? { socketPath: process.env.DB_SOCKET || "/tmp/mysql.sock" }
    : {
        host: process.env.DB_HOST || "127.0.0.1",
        port: Number(process.env.DB_PORT || 3306),
      }),
};
const db = await mysql.createConnection(connectionOptions);
try {
  const sql = fs.readFileSync(
    new URL("../database/security-20261012.sql", import.meta.url),
    "utf8",
  );
  for (const statement of sql
    .split(";")
    .map((v) => v.trim())
    .filter(Boolean))
    await db.query(statement);
  const [columns] = await db.query(
    "SELECT COLUMN_NAME FROM information_schema.columns WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='attachment_files' AND COLUMN_NAME='uploaded_by'",
  );
  if (!columns.length)
    await db.query("ALTER TABLE attachment_files ADD COLUMN uploaded_by CHAR(36) NULL");
  const checksum = createHash("sha256").update(sql).digest("hex");
  await db.execute(
    `INSERT INTO schema_migrations (id, checksum) VALUES (?, ?)
     ON DUPLICATE KEY UPDATE checksum = VALUES(checksum)`,
    ["security-20261012", checksum],
  );
  console.log("Security migration completed.");
} finally {
  await db.end();
}
