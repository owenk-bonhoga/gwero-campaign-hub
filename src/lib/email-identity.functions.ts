import { validateContract } from "./input-contract";
import { createServerFn } from "@tanstack/react-start";
import { authMiddleware } from "./auth.middleware";
import { cleanEmailHtml, requireMailboxAccess } from "./email-identity.server";
import { mayResumeMailboxSetup } from "./mailbox-policy";

const permission = authMiddleware;

async function pool() {
  return (await import("./db.server")).getPool();
}

export const getEmailIdentityWorkspace = createServerFn({ method: "GET" })
  .middleware([permission])
  .handler(async ({ context }) => {
    const db = await pool();
    const { getSecretStatus } = await import("./settings.server");
    const [
      mailboxes,
      signatures,
      users,
      access,
      googleId,
      googleSecret,
      microsoftId,
      microsoftSecret,
    ] = await Promise.all([
      db.execute(
        `SELECT m.id, m.name, m.from_email, m.from_name, m.provider, m.smtp_host, m.smtp_port,
                m.smtp_secure, m.smtp_username, m.imap_host, m.imap_port, m.imap_username,
                m.last_status, m.created_by, ma.can_send,
                IF(m.created_by = ?, TRUE, FALSE) AS can_manage,
                IF(m.created_by = ?, TRUE, FALSE) AS is_owner,
                ma.is_default,
                ma.active_signature_id
           FROM mailboxes m
           LEFT JOIN mailbox_access ma ON ma.mailbox_id = m.id AND ma.user_id = ?
          WHERE m.created_by = ? OR ma.user_id IS NOT NULL
          ORDER BY ma.is_default DESC, m.name`,
        [context.user.id, context.user.id, context.user.id, context.user.id],
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
          WHERE m.created_by = ? ORDER BY u.full_name`,
        [context.user.id],
      ),
      getSecretStatus("google_oauth_client_id"),
      getSecretStatus("google_oauth_client_secret"),
      getSecretStatus("microsoft_oauth_client_id"),
      getSecretStatus("microsoft_oauth_client_secret"),
    ]);
    return JSON.parse(
      JSON.stringify({
        mailboxes: mailboxes[0],
        signatures: signatures[0],
        users: users[0],
        access: access[0],
        userId: context.user.id,
        providerAvailability: {
          google: googleId === "configured" && googleSecret === "configured",
          microsoft: microsoftId === "configured" && microsoftSecret === "configured",
        },
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
    }) => validateContract(data, "saveMailbox"),
  )
  .handler(async ({ data, context }) => {
    const db = await pool();
    const email = data.email.trim().toLowerCase();
    let id = data.id || crypto.randomUUID();
    let resumeExisting = false;
    if (!data.name.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email))
      throw new Error("Add a valid account name and email address.");
    if (data.id) {
      await requireMailboxAccess(db, id, context.user, true);
    } else {
      const [existingRows] = await db.execute(
        "SELECT id, created_by FROM mailboxes WHERE from_email = ? LIMIT 1",
        [email],
      );
      const existing = (existingRows as Array<{ id: string; created_by: string | null }>)[0];
      if (existing) {
        if (!mayResumeMailboxSetup(existing.created_by, context.user.id))
          throw new Error(
            "That mailbox is connected by another Gwero user. Ask that person to share sending access.",
          );
        id = existing.id;
        resumeExisting = true;
      }
    }
    const smtp = data.provider === "smtp";
    const values = [
      data.name.trim(),
      email,
      data.fromName?.trim() || null,
      data.provider,
      smtp ? data.smtpHost?.trim() || null : null,
      smtp ? Number(data.smtpPort || 587) : null,
      smtp && Number(data.smtpPort) === 465,
      smtp ? data.username?.trim() || null : null,
      smtp ? data.imapHost?.trim() || null : null,
      smtp ? Number(data.imapPort || 993) : null,
      smtp ? data.username?.trim() || null : null,
    ];
    try {
      if (data.id || resumeExisting) {
        await db.execute(
          `UPDATE mailboxes SET name=?,from_email=?,from_name=?,provider=?,smtp_host=?,smtp_port=?,
             smtp_secure=?,smtp_username=?,imap_host=?,imap_port=?,imap_username=?
           WHERE id=? AND created_by=?`,
          [...values, id, context.user.id],
        );
      } else {
        await db.execute(
          `INSERT INTO mailboxes
            (id,name,from_email,from_name,provider,smtp_host,smtp_port,smtp_secure,smtp_username,
             imap_host,imap_port,imap_username,created_by) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
          [id, ...values, context.user.id],
        );
      }
    } catch (error) {
      if ((error as { code?: string }).code === "ER_DUP_ENTRY") {
        const [collisionRows] = await db.execute(
          "SELECT id, created_by FROM mailboxes WHERE from_email = ? LIMIT 1",
          [email],
        );
        const collision = (collisionRows as Array<{ id: string; created_by: string | null }>)[0];
        if (collision && mayResumeMailboxSetup(collision.created_by, context.user.id)) {
          id = collision.id;
          await db.execute(
            `UPDATE mailboxes SET name=?,from_email=?,from_name=?,provider=?,smtp_host=?,smtp_port=?,
               smtp_secure=?,smtp_username=?,imap_host=?,imap_port=?,imap_username=?
             WHERE id=? AND created_by=?`,
            [...values, id, context.user.id],
          );
        } else {
          throw new Error(
            "That mailbox is connected by another Gwero user. Ask that person to share sending access.",
          );
        }
      } else {
        throw error;
      }
    }
    await db.execute(
      `INSERT INTO mailbox_access (mailbox_id, user_id, can_send, can_manage, is_default, granted_by)
       VALUES (?, ?, TRUE, TRUE, NOT EXISTS(SELECT 1 FROM mailbox_access x WHERE x.user_id = ?), ?)
       ON DUPLICATE KEY UPDATE can_send = TRUE, can_manage = TRUE`,
      [id, context.user.id, context.user.id, context.user.id],
    );
    return { id };
  });

export const updateMailboxProfile = createServerFn({ method: "POST" })
  .middleware([permission])
  .validator((data: { id: string; name: string; fromName?: string }) =>
    validateContract(data, "updateMailboxProfile"),
  )
  .handler(async ({ data, context }) => {
    const db = await pool();
    await requireMailboxAccess(db, data.id, context.user, true);
    if (!data.name.trim()) throw new Error("Account name is required.");
    await db.execute(
      "UPDATE mailboxes SET name = ?, from_name = ? WHERE id = ? AND created_by = ?",
      [data.name.trim(), data.fromName?.trim() || null, data.id, context.user.id],
    );
    return { ok: true };
  });

export const setMailboxUserAccess = createServerFn({ method: "POST" })
  .middleware([permission])
  .validator((data: { mailboxId: string; userId: string; canSend: boolean; canManage?: boolean }) =>
    validateContract(data, "setMailboxUserAccess"),
  )
  .handler(async ({ data, context }) => {
    const db = await pool();
    await requireMailboxAccess(db, data.mailboxId, context.user, true);
    if (data.userId === context.user.id)
      throw new Error("Your owner access cannot be shared or revoked.");
    if (!data.canSend) {
      await db.execute("DELETE FROM mailbox_access WHERE mailbox_id = ? AND user_id = ?", [
        data.mailboxId,
        data.userId,
      ]);
    } else {
      await db.execute(
        `INSERT INTO mailbox_access (mailbox_id, user_id, can_send, can_manage, granted_by)
         VALUES (?, ?, TRUE, FALSE, ?)
         ON DUPLICATE KEY UPDATE can_send = TRUE, can_manage = FALSE, granted_by = VALUES(granted_by)`,
        [data.mailboxId, data.userId, context.user.id],
      );
    }
    return { ok: true };
  });

export const deleteMailbox = createServerFn({ method: "POST" })
  .middleware([permission])
  .validator((data: { id: string }) => validateContract(data, "deleteMailbox"))
  .handler(async ({ data, context }) => {
    const db = await pool();
    await requireMailboxAccess(db, data.id, context.user, true);
    const connection = await db.getConnection();
    try {
      await connection.beginTransaction();
      const [owned] = await connection.execute(
        "SELECT id FROM mailboxes WHERE created_by = ? FOR UPDATE",
        [context.user.id],
      );
      const remaining = (owned as Array<{ id: string }>).filter(
        (mailbox) => mailbox.id !== data.id,
      );
      if (!remaining.length) throw new Error("Keep at least one sending account connected.");
      await connection.execute("DELETE FROM mailboxes WHERE id = ? AND created_by = ?", [
        data.id,
        context.user.id,
      ]);
      const [defaults] = await connection.execute(
        "SELECT mailbox_id FROM mailbox_access WHERE user_id = ? AND is_default = TRUE LIMIT 1",
        [context.user.id],
      );
      if (!(defaults as Array<{ mailbox_id: string }>)[0])
        await connection.execute(
          "UPDATE mailbox_access SET is_default = TRUE WHERE mailbox_id = ? AND user_id = ?",
          [remaining[0]!.id, context.user.id],
        );
      await connection.commit();
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
    return { ok: true };
  });

export const setDefaultMailbox = createServerFn({ method: "POST" })
  .middleware([permission])
  .validator((data: { mailboxId: string }) => validateContract(data, "setDefaultMailbox"))
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
    }) => validateContract(data, "saveEmailSignature"),
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
  .validator((data: { mailboxId: string; signatureId?: string | null }) =>
    validateContract(data, "activateEmailSignature"),
  )
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
  .validator((data: { id: string }) => validateContract(data, "deleteEmailSignature"))
  .handler(async ({ data, context }) => {
    await (
      await pool()
    ).execute("DELETE FROM email_signatures WHERE id = ? AND owner_id = ?", [
      data.id,
      context.user.id,
    ]);
    return { ok: true };
  });
