import type { Pool } from "mysql2/promise";

const uuid = /^[0-9a-f]{8}-[0-9a-f-]{27}$/i;

export type AccessibleMailbox = {
  id: string;
  name: string;
  provider: string;
  from_email: string;
  from_name: string | null;
  smtp_host: string | null;
  smtp_port: number | null;
  smtp_secure: boolean;
  smtp_username: string | null;
  imap_host: string | null;
  imap_port: number | null;
  imap_username: string | null;
  created_by: string | null;
  can_send: boolean | null;
  can_manage: boolean | null;
  is_default: boolean | null;
  active_signature_id: string | null;
};

export function cleanEmailHtml(value: string) {
  return String(value || "")
    .replace(/<\s*(script|iframe|object|embed|form|meta|link)[^>]*>[\s\S]*?<\s*\/\s*\1\s*>/gi, "")
    .replace(/<\s*(script|iframe|object|embed|form|meta|link)\b[^>]*\/?\s*>/gi, "")
    .replace(/\son[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, "")
    .replace(/javascript\s*:/gi, "");
}

export async function requireMailboxAccess(
  db: Pool,
  mailboxId: string,
  user: { id: string; roleName: string | null },
  manage = false,
) {
  if (!uuid.test(mailboxId)) throw new Error("Invalid sending account.");
  const [rows] = await db.execute(
    `SELECT m.*, ma.can_send, ma.can_manage, ma.is_default, ma.active_signature_id
       FROM mailboxes m
       LEFT JOIN mailbox_access ma ON ma.mailbox_id = m.id AND ma.user_id = ?
      WHERE m.id = ? AND (
        m.created_by = ? OR ma.user_id IS NOT NULL OR (m.created_by IS NULL AND ? = 1)
      ) LIMIT 1`,
    [user.id, mailboxId, user.id, user.roleName === "Administrator" ? 1 : 0],
  );
  const mailbox = (rows as AccessibleMailbox[])[0];
  if (!mailbox || (manage && mailbox["created_by"] !== user.id && !mailbox["can_manage"]))
    throw new Error(
      manage ? "You cannot manage this sending account." : "Sending account unavailable.",
    );
  if (!manage && mailbox["created_by"] !== user.id && !mailbox["can_send"])
    throw new Error("You do not have permission to send from this account.");
  return mailbox;
}

function textFromHtml(value: string) {
  return value
    .replace(/<br\s*\/?\s*>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/\n\s+/g, "\n")
    .trim();
}

export async function applyActiveEmailSignature(
  db: Pool,
  userId: string,
  mailboxId: string,
  html: string,
  text: string,
) {
  const [rows] = await db.execute(
    `SELECT s.signature_type, s.content_html, s.content_text, s.image_url
       FROM mailbox_access ma
       JOIN email_signatures s ON s.id = ma.active_signature_id
      WHERE ma.mailbox_id = ? AND ma.user_id = ? AND s.owner_id = ? LIMIT 1`,
    [mailboxId, userId, userId],
  );
  const signature = (
    rows as Array<{
      signature_type: string;
      content_html: string | null;
      content_text: string | null;
      image_url: string | null;
    }>
  )[0];
  if (!signature) return { html, text };
  const image = signature.image_url
    ? `<div style="margin-top:8px"><img src="${String(signature.image_url).replace(/["<>]/g, "")}" alt="Email signature" style="max-width:420px;height:auto" /></div>`
    : "";
  const signatureHtml = cleanEmailHtml(signature.content_html || "") + image;
  const signatureText =
    signature.content_text?.trim() || textFromHtml(signature.content_html || "") || "";
  return {
    html: `${html}<div data-gwero-signature="true" style="margin-top:20px">${signatureHtml}</div>`,
    text: `${text.trim()}\n\n${signatureText}`.trim(),
  };
}
