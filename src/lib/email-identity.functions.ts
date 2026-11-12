import { createServerFn } from "@tanstack/react-start";
import { permissionMiddleware } from "./auth.middleware";
import { cleanEmailHtml, requireMailboxAccess } from "./email-identity.server";

const permission = permissionMiddleware("campaigns.manage");

async function pool() {
  return (await import("./db.server")).getPool();
}

export const getEmailIdentityWorkspace = createServerFn({ method: "GET" })
  .middleware([permission])
  .handler(async ({ context }) => {
    const db = await pool();
    const [mailboxes, signatures, users, access] = await Promise.all([
      db.execute(
        `SELECT m.id, m.name, m.from_email, m.from_name, m.provider, m.smtp_host, m.smtp_port,
                m.smtp_secure, m.smtp_username, m.imap_host, m.imap_port, m.imap_username,
                m.last_status, m.created_by, ma.can_send,
                IF(m.created_by = ? OR ma.can_manage = TRUE OR (m.created_by IS NULL AND ? = 1), TRUE, FALSE) AS can_manage,
                ma.is_default,
                ma.active_signature_id
           FROM mailboxes m
           LEFT JOIN mailbox_access ma ON ma.mailbox_id = m.id AND ma.user_id = ?
          WHERE m.created_by = ? OR ma.user_id IS NOT NULL OR (m.created_by IS NULL AND ? = 1)
          ORDER BY ma.is_default DESC, m.name`,
        [
          context.user.id,
          context.user.roleName === "Administrator" ? 1 : 0,
          context.user.id,
          context.user.id,
          context.user.roleName === "Administrator" ? 1 : 0,
        ],
      ),
      db.execute(
        `SELECT s.* FROM email_signatures s
          WHERE s.owner_id = ? ORDER BY s.updated_at DESC`,
        [context.user.id],
      ),
      db.execute(
        "SELECT id, full_name, email FROM system_users WHERE status = 'active' ORDER BY full_name",
      ),
      db.execute(
        `SELECT ma.mailbox_id, ma.user_id, ma.can_send, ma.can_manage, u.full_name, u.email
           FROM mailbox_access ma JOIN system_users u ON u.id = ma.user_id
           JOIN mailboxes m ON m.id = ma.mailbox_id
          WHERE m.created_by = ? OR (m.created_by IS NULL AND ? = 1) OR EXISTS(
            SELECT 1 FROM mailbox_access mine WHERE mine.mailbox_id = m.id AND mine.user_id = ? AND mine.can_manage = TRUE
          ) ORDER BY u.full_name`,
        [context.user.id, context.user.roleName === "Administrator" ? 1 : 0, context.user.id],
      ),
    ]);
    return JSON.parse(
      JSON.stringify({
        mailboxes: mailboxes[0],
        signatures: signatures[0],
        users: users[0],
        access: access[0],
        userId: context.user.id,
      }),
    );
  });

export const saveMailbox = createServerFn({ method: "POST" })
  .middleware([permission])
  .validator(
    (data: {
      id?: string;
      name: string;
      email: string;
      fromName?: string;
      provider: string;
      smtpHost?: string;
      smtpPort?: number;
      username?: string;
      imapHost?: string;
      imapPort?: number;
    }) => data,
  )
  .handler(async ({ data, context }) => {
    const db = await pool();
    const id = data.id || crypto.randomUUID();
    if (!data.name.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email))
      throw new Error("Add a valid account name and email address.");
    if (data.id) await requireMailboxAccess(db, id, context.user, true);
    const smtp = data.provider === "smtp";
    await db.execute(
      `INSERT INTO mailboxes
        (id, name, from_email, from_name, provider, smtp_host, smtp_port, smtp_secure,
         smtp_username, imap_host, imap_port, imap_username, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE name = VALUES(name), from_email = VALUES(from_email),
         from_name = VALUES(from_name), provider = VALUES(provider), smtp_host = VALUES(smtp_host),
         smtp_port = VALUES(smtp_port), smtp_secure = VALUES(smtp_secure),
         smtp_username = VALUES(smtp_username), imap_host = VALUES(imap_host),
         imap_port = VALUES(imap_port), imap_username = VALUES(imap_username)`,
      [
        id,
        data.name.trim(),
        data.email.trim().toLowerCase(),
        data.fromName?.trim() || null,
        data.provider,
        smtp ? data.smtpHost?.trim() || null : null,
        smtp ? Number(data.smtpPort || 587) : null,
        smtp && Number(data.smtpPort) === 465,
        smtp ? data.username?.trim() || null : null,
        smtp ? data.imapHost?.trim() || null : null,
        smtp ? Number(data.imapPort || 993) : null,
        smtp ? data.username?.trim() || null : null,
        context.user.id,
      ],
    );
    await db.execute(
      `INSERT INTO mailbox_access (mailbox_id, user_id, can_send, can_manage, is_default, granted_by)
       VALUES (?, ?, TRUE, TRUE, NOT EXISTS(SELECT 1 FROM mailbox_access x WHERE x.user_id = ?), ?)
       ON DUPLICATE KEY UPDATE can_send = TRUE, can_manage = TRUE`,
      [id, context.user.id, context.user.id, context.user.id],
    );
    return { id };
  });

export const setMailboxUserAccess = createServerFn({ method: "POST" })
  .middleware([permission])
  .validator(
    (data: { mailboxId: string; userId: string; canSend: boolean; canManage: boolean }) => data,
  )
  .handler(async ({ data, context }) => {
    const db = await pool();
    await requireMailboxAccess(db, data.mailboxId, context.user, true);
    if (!data.canSend && !data.canManage) {
      await db.execute("DELETE FROM mailbox_access WHERE mailbox_id = ? AND user_id = ?", [
        data.mailboxId,
        data.userId,
      ]);
    } else {
      await db.execute(
        `INSERT INTO mailbox_access (mailbox_id, user_id, can_send, can_manage, granted_by)
         VALUES (?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE can_send = VALUES(can_send), can_manage = VALUES(can_manage), granted_by = VALUES(granted_by)`,
        [data.mailboxId, data.userId, data.canSend, data.canManage, context.user.id],
      );
    }
    return { ok: true };
  });

export const deleteMailbox = createServerFn({ method: "POST" })
  .middleware([permission])
  .validator((data: { id: string }) => data)
  .handler(async ({ data, context }) => {
    const db = await pool();
    await requireMailboxAccess(db, data.id, context.user, true);
    await db.execute("DELETE FROM mailboxes WHERE id = ?", [data.id]);
    return { ok: true };
  });

export const setDefaultMailbox = createServerFn({ method: "POST" })
  .middleware([permission])
  .validator((data: { mailboxId: string }) => data)
  .handler(async ({ data, context }) => {
    const db = await pool();
    await requireMailboxAccess(db, data.mailboxId, context.user);
    await db.execute("UPDATE mailbox_access SET is_default = FALSE WHERE user_id = ?", [
      context.user.id,
    ]);
    await db.execute(
      `INSERT INTO mailbox_access (mailbox_id, user_id, can_send, is_default, granted_by)
       VALUES (?, ?, TRUE, TRUE, ?) ON DUPLICATE KEY UPDATE is_default = TRUE`,
      [data.mailboxId, context.user.id, context.user.id],
    );
    return { ok: true };
  });

export const saveEmailSignature = createServerFn({ method: "POST" })
  .middleware([permission])
  .validator(
    (data: {
      id?: string;
      mailboxId: string;
      name: string;
      type: string;
      html?: string;
      text?: string;
      imageUrl?: string;
    }) => data,
  )
  .handler(async ({ data, context }) => {
    const db = await pool();
    await requireMailboxAccess(db, data.mailboxId, context.user);
    const id = data.id || crypto.randomUUID();
    if (!data.name.trim()) throw new Error("Signature name is required.");
    if (data.id) {
      const [owned] = await db.execute(
        "SELECT id FROM email_signatures WHERE id = ? AND owner_id = ?",
        [id, context.user.id],
      );
      if (!(owned as Array<{ id: string }>)[0]) throw new Error("Signature not found.");
    }
    const type = ["text", "html", "image", "mixed"].includes(data.type) ? data.type : "html";
    const imageUrl = /^https:\/\//i.test(data.imageUrl || "") ? String(data.imageUrl) : null;
    await db.execute(
      `INSERT INTO email_signatures
        (id, mailbox_id, owner_id, name, signature_type, content_html, content_text, image_url, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE mailbox_id = VALUES(mailbox_id), name = VALUES(name),
         signature_type = VALUES(signature_type), content_html = VALUES(content_html),
         content_text = VALUES(content_text), image_url = VALUES(image_url)`,
      [
        id,
        data.mailboxId,
        context.user.id,
        data.name.trim(),
        type,
        cleanEmailHtml(data.html || ""),
        data.text?.trim() || null,
        imageUrl,
        context.user.id,
      ],
    );
    return { id };
  });

export const activateEmailSignature = createServerFn({ method: "POST" })
  .middleware([permission])
  .validator((data: { mailboxId: string; signatureId?: string | null }) => data)
  .handler(async ({ data, context }) => {
    const db = await pool();
    await requireMailboxAccess(db, data.mailboxId, context.user);
    if (data.signatureId) {
      const [rows] = await db.execute(
        "SELECT id FROM email_signatures WHERE id = ? AND mailbox_id = ? AND owner_id = ? LIMIT 1",
        [data.signatureId, data.mailboxId, context.user.id],
      );
      if (!(rows as Array<{ id: string }>)[0]) throw new Error("Signature not found.");
    }
    await db.execute(
      "UPDATE mailbox_access SET active_signature_id = ? WHERE mailbox_id = ? AND user_id = ?",
      [data.signatureId || null, data.mailboxId, context.user.id],
    );
    return { ok: true };
  });

export const deleteEmailSignature = createServerFn({ method: "POST" })
  .middleware([permission])
  .validator((data: { id: string }) => data)
  .handler(async ({ data, context }) => {
    await (
      await pool()
    ).execute("DELETE FROM email_signatures WHERE id = ? AND owner_id = ?", [
      data.id,
      context.user.id,
    ]);
    return { ok: true };
  });
