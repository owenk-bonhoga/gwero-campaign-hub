import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

function key() {
  const value = process.env["SETTINGS_ENCRYPTION_KEY"];
  if (!value) throw new Error("SETTINGS_ENCRYPTION_KEY is required for mailbox secrets.");
  return createHash("sha256").update(value).digest();
}
const prefix = "gwero:v1:";
export function encryptMailboxSecret(value: string): string {
  if (value.startsWith(prefix)) {
    decryptMailboxSecret(value);
    return value;
  }
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const content = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  return prefix + [iv, cipher.getAuthTag(), content].map((v) => v.toString("base64")).join(":");
}
export function decryptMailboxSecret(value: string): string {
  if (!value.startsWith(prefix)) return value;
  const [iv, tag, content] = value.slice(prefix.length).split(":");
  if (!iv || !tag || !content) throw new Error("Invalid encrypted mailbox secret.");
  const decipher = createDecipheriv("aes-256-gcm", key(), Buffer.from(iv, "base64"));
  decipher.setAuthTag(Buffer.from(tag, "base64"));
  return Buffer.concat([
    decipher.update(Buffer.from(content, "base64")),
    decipher.final(),
  ]).toString("utf8");
}
export function decryptMailboxRow<T extends object>(row: T): T {
  const result = { ...row } as Record<string, unknown>;
  for (const name of [
    "smtp_password",
    "imap_password",
    "oauth_access_token",
    "oauth_refresh_token",
  ])
    if (typeof result[name] === "string") result[name] = decryptMailboxSecret(result[name]);
  return result as T;
}
