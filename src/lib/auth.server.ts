import {
  createHash,
  randomBytes,
  randomUUID,
  scrypt as scryptCallback,
  timingSafeEqual,
} from "node:crypto";
import { promisify } from "node:util";
import { deleteCookie, getCookie, setCookie } from "@tanstack/react-start/server";
import { executeRead, getPool } from "./db.server";

const scrypt = promisify(scryptCallback);
const SESSION_DAYS = 7;
const production = process.env["NODE_ENV"] === "production";
const cookieName = production ? "__Host-gwero_session" : "gwero_session";

export type AuthUser = {
  id: string;
  fullName: string;
  email: string;
  roleId: string | null;
  roleName: string | null;
  permissions: string[];
};

function tokenHash(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export async function hashPassword(password: string) {
  if (password.length < 10) throw new Error("Password must be at least 10 characters.");
  const salt = randomBytes(16);
  const derived = (await scrypt(password, salt, 64)) as Buffer;
  return `scrypt:${salt.toString("base64")}:${derived.toString("base64")}`;
}

export async function verifyPassword(stored: string | null | undefined, password: string) {
  const value =
    stored ||
    "scrypt:AAAAAAAAAAAAAAAAAAAAAA==:AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA==";
  const [, saltValue, hashValue] = value.split(":");
  if (!saltValue || !hashValue) return false;
  const expected = Buffer.from(hashValue, "base64");
  const actual = (await scrypt(
    password,
    Buffer.from(saltValue, "base64"),
    expected.length,
  )) as Buffer;
  return expected.length === actual.length && timingSafeEqual(expected, actual) && Boolean(stored);
}

export async function currentUser(): Promise<AuthUser | null> {
  const token = getCookie(cookieName);
  if (!token) return null;
  const [rows] = await executeRead(
    `SELECT u.id, u.full_name, u.email, u.role_id, r.name AS role_name
       FROM auth_sessions s
       JOIN system_users u ON u.id = s.user_id
       LEFT JOIN roles r ON r.id = u.role_id
      WHERE s.token_hash = ? AND s.expires_at > CURRENT_TIMESTAMP(3) AND u.status = 'active'
      LIMIT 1`,
    [tokenHash(token)],
  );
  const row = (
    rows as Array<{
      id: string;
      full_name: string;
      email: string;
      role_id: string | null;
      role_name: string | null;
    }>
  )[0];
  if (!row) return null;
  const [permissionRows] = await executeRead(
    `SELECT p.permission_key
       FROM role_permissions rp
       JOIN permissions p ON p.id = rp.permission_id
      WHERE rp.role_id = ?`,
    [row.role_id],
  );
  return {
    id: String(row.id),
    fullName: String(row.full_name),
    email: String(row.email),
    roleId: row.role_id ? String(row.role_id) : null,
    roleName: row.role_name ? String(row.role_name) : null,
    permissions: (permissionRows as Array<{ permission_key: string }>).map(
      (item) => item.permission_key,
    ),
  };
}

export async function issueSession(userId: string) {
  const token = randomBytes(32).toString("base64url");
  const expires = new Date(Date.now() + SESSION_DAYS * 86_400_000);
  const db = getPool();
  await db.execute(
    "DELETE FROM auth_sessions WHERE user_id = ? OR expires_at <= CURRENT_TIMESTAMP(3)",
    [userId],
  );
  await db.execute(
    "INSERT INTO auth_sessions (id, user_id, token_hash, expires_at) VALUES (?, ?, ?, ?)",
    [randomUUID(), userId, tokenHash(token), expires],
  );
  setCookie(cookieName, token, {
    httpOnly: true,
    secure: production,
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_DAYS * 86_400,
  });
}

export async function revokeCurrentSession() {
  const token = getCookie(cookieName);
  if (token)
    await getPool().execute("DELETE FROM auth_sessions WHERE token_hash = ?", [tokenHash(token)]);
  deleteCookie(cookieName, { path: "/", secure: production });
}

export async function requireUser(permission?: string) {
  const user = await currentUser();
  if (!user) throw new Error("Authentication required");
  if (permission && !user.permissions.includes(permission)) throw new Error("Permission denied");
  return user;
}
