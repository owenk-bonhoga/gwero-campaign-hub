import { validateContract } from "./input-contract";
import { randomUUID } from "node:crypto";
import type { RowDataPacket } from "mysql2/promise";
import { createServerFn } from "@tanstack/react-start";
import { permissionMiddleware } from "./auth.middleware";
import type {
  PortalAccountInput,
  PortalAccountSummary,
  PortalCredentials,
} from "./portal-accounts.types";

const portalPermission = permissionMiddleware("accounts.manage");
const secretKey = (id: string) => `portal_account:${id}`;

function clean(value: unknown, limit: number) {
  return String(value ?? "")
    .trim()
    .slice(0, limit);
}

function safeUrl(value: unknown) {
  const url = clean(value, 1000);
  if (!url) return "";
  const parsed = new URL(url);
  if (!["http:", "https:"].includes(parsed.protocol))
    throw new Error("Portal links must use HTTP or HTTPS.");
  return parsed.toString();
}

function credentialsFrom(value: unknown): PortalCredentials {
  const source = (value && typeof value === "object" ? value : {}) as Record<string, unknown>;
  return {
    loginIdentifier: clean(source["loginIdentifier"], 500),
    accountNumber: clean(source["accountNumber"], 500),
    password: String(source["password"] ?? "").slice(0, 2000),
    recoveryEmail: clean(source["recoveryEmail"], 500),
    recoveryPhone: clean(source["recoveryPhone"], 200),
  };
}

export const listPortalAccounts = createServerFn({ method: "GET" })
  .middleware([portalPermission])
  .handler(async () => {
    const { getPool } = await import("./db.server");
    const [rows] = await getPool().execute(
      `SELECT pa.id, pa.portal_name, pa.category, pa.portal_url, pa.website_url,
              pa.notes, pa.status, pa.updated_at, COALESCE(u.full_name, 'Unknown') AS created_by_name,
              EXISTS(SELECT 1 FROM app_secrets s WHERE s.secret_key = CONCAT('portal_account:', pa.id)) AS has_credentials
         FROM portal_accounts pa
         LEFT JOIN system_users u ON u.id = pa.created_by
        WHERE pa.status <> 'archived'
        ORDER BY pa.portal_name`,
    );
    return (rows as RowDataPacket[]).map((row): PortalAccountSummary => ({
      id: String(row["id"]),
      portalName: String(row["portal_name"] || ""),
      category: String(row["category"] || "Other"),
      portalUrl: String(row["portal_url"] || ""),
      websiteUrl: String(row["website_url"] || ""),
      notes: String(row["notes"] || ""),
      status: String(row["status"] || "active"),
      createdByName: String(row["created_by_name"] || "Unknown"),
      updatedAt: new Date(row["updated_at"] as string).toISOString(),
      hasCredentials: Boolean(row["has_credentials"]),
    }));
  });

export const revealPortalCredentials = createServerFn({ method: "POST" })
  .middleware([portalPermission])
  .validator((data: { id: string }) =>
    validateContract({ id: clean(data?.id, 36) }, "revealPortalCredentials"),
  )
  .handler(async ({ data }) => {
    const { getPool } = await import("./db.server");
    const [rows] = await getPool().execute(
      "SELECT id FROM portal_accounts WHERE id = ? AND status <> 'archived' LIMIT 1",
      [data.id],
    );
    if (!(rows as RowDataPacket[])[0]) throw new Error("Portal account not found.");
    const { getSecret } = await import("./settings.server");
    const encrypted = await getSecret(secretKey(data.id));
    if (!encrypted) return credentialsFrom(null);
    try {
      return credentialsFrom(JSON.parse(encrypted));
    } catch {
      throw new Error("These stored credentials cannot be read. Save them again.");
    }
  });

export const savePortalAccount = createServerFn({ method: "POST" })
  .middleware([portalPermission])
  .validator((data: PortalAccountInput) => validateContract(data, "savePortalAccount"))
  .handler(async ({ data, context }) => {
    const id = clean(data.id, 36) || randomUUID();
    const portalName = clean(data.portalName, 200);
    if (!portalName) throw new Error("Portal name is required.");
    const values = {
      category: clean(data.category, 80) || "Other",
      portalUrl: safeUrl(data.portalUrl),
      websiteUrl: safeUrl(data.websiteUrl),
      notes: clean(data.notes, 5000),
    };
    const { getPool } = await import("./db.server");
    const db = getPool();
    if (data.id) {
      const [result] = await db.execute(
        `UPDATE portal_accounts
            SET portal_name = ?, category = ?, portal_url = ?, website_url = ?, notes = ?, updated_by = ?
          WHERE id = ? AND status <> 'archived'`,
        [
          portalName,
          values.category,
          values.portalUrl || null,
          values.websiteUrl || null,
          values.notes || null,
          context.user.id,
          id,
        ],
      );
      if (!(result as { affectedRows: number }).affectedRows)
        throw new Error("Portal account not found.");
    } else {
      await db.execute(
        `INSERT INTO portal_accounts
          (id, portal_name, category, portal_url, website_url, notes, status, created_by, updated_by)
         VALUES (?, ?, ?, ?, ?, ?, 'active', ?, ?)`,
        [
          id,
          portalName,
          values.category,
          values.portalUrl || null,
          values.websiteUrl || null,
          values.notes || null,
          context.user.id,
          context.user.id,
        ],
      );
    }
    if (data.credentials) {
      const { setSecret } = await import("./settings.server");
      await setSecret(secretKey(id), JSON.stringify(credentialsFrom(data.credentials)));
    }
    return { id };
  });

export const archivePortalAccount = createServerFn({ method: "POST" })
  .middleware([portalPermission])
  .validator((data: { id: string }) =>
    validateContract({ id: clean(data?.id, 36) }, "archivePortalAccount"),
  )
  .handler(async ({ data, context }) => {
    const { getPool } = await import("./db.server");
    const [result] = await getPool().execute(
      "UPDATE portal_accounts SET status = 'archived', updated_by = ? WHERE id = ?",
      [context.user.id, data.id],
    );
    if (!(result as { affectedRows: number }).affectedRows)
      throw new Error("Portal account not found.");
    return { ok: true };
  });
