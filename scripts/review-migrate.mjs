import mysql from "mysql2/promise";
import { decryptMailboxSecret, encryptMailboxSecret } from "../src/lib/secret-crypto.ts";

const db = await mysql.createConnection({
  host: process.env.DB_HOST || "127.0.0.1",
  port: Number(process.env.DB_PORT || 3306),
  database: process.env.DB_NAME || "gwero_crm",
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD || "",
  ...(process.env.DB_SOCKET ? { socketPath: process.env.DB_SOCKET } : {}),
});
try {
  for (const column of ["claimed_at", "dispatch_started_at"]) {
    const [found] = await db.execute(
      "SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='campaign_recipients' AND COLUMN_NAME=?",
      [column],
    );
    if (!found.length)
      await db.query(`ALTER TABLE campaign_recipients ADD COLUMN ${column} DATETIME(3) NULL`);
  }
  await db.beginTransaction();
  const [rows] =
    process.argv.includes("--encrypt-mailboxes") || process.argv.includes("--decrypt-mailboxes")
      ? await db.query("SELECT * FROM mailbox_secrets FOR UPDATE")
      : [[]];
  const names = ["smtp_password", "imap_password", "oauth_access_token", "oauth_refresh_token"];
  if (rows.some((row) => names.some((name) => row[name])) && !process.env.SETTINGS_ENCRYPTION_KEY)
    throw new Error("Set the stable SETTINGS_ENCRYPTION_KEY before migrating mailbox secrets.");
  for (const row of rows) {
    const fields = names.filter((name) => typeof row[name] === "string" && row[name]);
    if (fields.length)
      await db.execute(
        `UPDATE mailbox_secrets SET ${fields.map((name) => `${name}=?`).join(",")} WHERE mailbox_id=?`,
        [
          ...fields.map((name) =>
            process.argv.includes("--decrypt-mailboxes")
              ? decryptMailboxSecret(row[name])
              : encryptMailboxSecret(row[name]),
          ),
          row.mailbox_id,
        ],
      );
  }
  await db.commit();
  console.log(
    "Review migration completed: queue recovery fields. Mailbox encryption runs explicitly after the compatible runtime is active.",
  );
} catch (error) {
  await db.rollback();
  throw error;
} finally {
  await db.end();
}
