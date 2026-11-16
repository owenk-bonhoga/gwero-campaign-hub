import { deleteCookie, getCookie, setCookie } from "@tanstack/react-start/server";
import { secureTokenHash } from "./secure-share-security";

const production = process.env["NODE_ENV"] === "production";
const cookieName = production ? "__Host-gwero_secure_share" : "gwero_secure_share";

export function readSecureShareCookie() {
  return getCookie(cookieName) || "";
}
export function setSecureShareCookie(token: string) {
  setCookie(cookieName, token, {
    httpOnly: true,
    secure: production,
    sameSite: "lax",
    path: "/",
    maxAge: 12 * 60 * 60,
  });
}
export function clearSecureShareCookie() {
  deleteCookie(cookieName, { path: "/", secure: production });
}

export async function readSecureShareSession(slug?: string) {
  const token = readSecureShareCookie();
  if (!token) return null;
  const { getPool } = await import("./db.server");
  const [rows] = await getPool().execute(
    `SELECT s.token_hash AS session_hash, s.verified_at, s.expires_at AS session_expires_at,
            r.id AS recipient_id, r.share_id, r.name, r.email, r.allow_download, r.revoked_at,
            sh.title, sh.description, sh.slug, sh.status, sh.expires_at, sh.mailbox_id
       FROM secure_document_share_sessions s
       JOIN secure_document_share_recipients r ON r.id=s.recipient_id
       JOIN secure_document_shares sh ON sh.id=r.share_id
      WHERE s.token_hash=? AND s.expires_at>CURRENT_TIMESTAMP(3)
        AND r.revoked_at IS NULL AND sh.status='active'
        AND (sh.expires_at IS NULL OR sh.expires_at>CURRENT_TIMESTAMP(3)) LIMIT 1`,
    [secureTokenHash(token)],
  );
  const session = (rows as Array<Record<string, string | number | boolean | Date | null>>)[0];
  return session && (!slug || session["slug"] === slug) ? session : null;
}

export async function requireVerifiedSecureShare(slug?: string) {
  const session = await readSecureShareSession(slug);
  if (!session || !session["verified_at"]) throw new Error("Secure document access is required.");
  return session;
}
