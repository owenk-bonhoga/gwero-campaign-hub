import { validateContract } from "./input-contract";
import { createServerFn } from "@tanstack/react-start";
import { permissionMiddleware } from "./auth.middleware";
import {
  safeHashEqual,
  secureOtp,
  secureOtpHash,
  secureToken,
  secureTokenHash,
} from "./secure-share-security";

const permission = permissionMiddleware("documents.manage");
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f-]{27}$/i;
const serial = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;
type SerializableValue = string | number | boolean | null;
type SerializableRow = Record<string, SerializableValue>;
const escapeHtml = (value: string) =>
  value.replace(
    /[&<>"']/g,
    (character) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" })[character] ||
      character,
  );
const cleanText = (value: unknown, max = 1000) =>
  String(value || "")
    .trim()
    .slice(0, max);
const shareSecret = () => process.env["SESSION_SECRET"] || "";
const origin = () => (process.env["APP_URL"] || "https://os.gwerosolutions.com").replace(/\/$/, "");
async function pool() {
  return (await import("./db.server")).getPool();
}
function rows<T>(result: unknown): T[] {
  return (result as [T[]])[0];
}

export type SecureShareRecipientInput = {
  name: string;
  email: string;
  message?: string;
  allowDownload: boolean;
};
export type CreateSecureShareInput = {
  title: string;
  description?: string;
  slug?: string;
  expiresAt?: string;
  mailboxId: string;
  emailSubject: string;
  emailMessage?: string;
  documentIds: string[];
  recipients: SecureShareRecipientInput[];
};

function invitationHtml(input: {
  name: string;
  title: string;
  description: string;
  message: string;
  link: string;
  expiresAt: string | null;
}) {
  return `<div style="font-family:Arial,sans-serif;max-width:640px;margin:auto;color:#172033"><h1 style="font-size:24px">${escapeHtml(input.title)}</h1><p>Hello ${escapeHtml(input.name)},</p>${input.message ? `<p>${escapeHtml(input.message)}</p>` : ""}<p>${escapeHtml(input.description)}</p><p><a href="${escapeHtml(input.link)}" style="display:inline-block;background:#6d28d9;color:white;text-decoration:none;padding:12px 20px;border-radius:8px">Open secure documents</a></p>${input.expiresAt ? `<p style="color:#667085;font-size:13px">Access expires ${escapeHtml(new Date(input.expiresAt).toLocaleString("en-MW", { timeZone: "Africa/Blantyre" }))}.</p>` : ""}<p style="color:#667085;font-size:13px">This personal link identifies you. A six-digit code sent to this email address is still required.</p></div>`;
}

async function logEvent(
  db: Awaited<ReturnType<typeof pool>>,
  input: { shareId: string; recipientId?: string; itemId?: string; type: string; detail?: string },
) {
  await db.execute(
    "INSERT INTO secure_document_share_events (id,share_id,recipient_id,item_id,event_type,detail) VALUES (?,?,?,?,?,?)",
    [
      crypto.randomUUID(),
      input.shareId,
      input.recipientId || null,
      input.itemId || null,
      input.type,
      input.detail || null,
    ],
  );
}

async function deliverInvitation(
  db: Awaited<ReturnType<typeof pool>>,
  input: { shareId: string; recipientId: string; rawToken: string },
) {
  const result = rows<Record<string, string | boolean | null>>(
    await db.query(
      `SELECT sh.title,sh.description,sh.slug,sh.expires_at,sh.mailbox_id,sh.email_subject,sh.email_message,r.name,r.email,r.message,r.allow_download FROM secure_document_shares sh JOIN secure_document_share_recipients r ON r.share_id=sh.id WHERE sh.id=? AND r.id=? LIMIT 1`,
      [input.shareId, input.recipientId],
    ),
  )[0];
  if (!result) throw new Error("Secure share recipient not found.");
  const link = `${origin()}/s/${result["slug"]}?k=${input.rawToken}`;
  const message = cleanText(result["message"] || result["email_message"], 3000);
  const html = invitationHtml({
    name: String(result["name"]),
    title: String(result["title"]),
    description: String(result["description"] || "Documents have been shared with you securely."),
    message,
    link,
    expiresAt: result["expires_at"] ? String(result["expires_at"]) : null,
  });
  const { sendSecureShareEmail } = await import("./secure-share-mail.server");
  await sendSecureShareEmail(db, {
    mailboxId: String(result["mailbox_id"]),
    to: String(result["email"]),
    subject: String(result["email_subject"]),
    html,
    text: `${result["title"]}\n\n${message}\n\n${link}`,
    messageId: `<secure-share-${input.recipientId}@gwero-os>`,
  });
  await db.execute(
    "UPDATE secure_document_share_recipients SET invited_at=CURRENT_TIMESTAMP(3) WHERE id=?",
    [input.recipientId],
  );
  await logEvent(db, {
    shareId: input.shareId,
    recipientId: input.recipientId,
    type: "invitation_sent",
    detail: `Download ${result["allow_download"] ? "allowed" : "disabled"}`,
  });
  return link;
}

export const getSecureShareWorkspace = createServerFn({ method: "GET" })
  .middleware([permission])
  .handler(async ({ context }) => {
    const db = await pool();
    const [shares, documents, mailboxes] = await Promise.all([
      db.query(
        `SELECT sh.*,u.full_name AS created_by_name,(SELECT COUNT(*) FROM secure_document_share_items i WHERE i.share_id=sh.id) document_count,(SELECT COUNT(*) FROM secure_document_share_recipients r WHERE r.share_id=sh.id AND r.revoked_at IS NULL) recipient_count FROM secure_document_shares sh JOIN system_users u ON u.id=sh.created_by WHERE ?=1 OR sh.created_by=? ORDER BY sh.created_at DESC`,
        [context.user.roleName === "Administrator" ? 1 : 0, context.user.id],
      ),
      db.query(
        `SELECT d.id,d.title,d.owner_id,v.id version_id,v.version_number,v.file_name,v.content_type,v.file_size FROM documents d JOIN document_versions v ON v.document_id=d.id AND v.version_number=(SELECT MAX(v2.version_number) FROM document_versions v2 WHERE v2.document_id=d.id) LEFT JOIN document_access da ON da.document_id=d.id AND da.user_id=? WHERE ?=1 OR d.owner_id=? OR d.owner_id IS NULL OR da.access_level IN ('edit','manage') ORDER BY d.title`,
        [context.user.id, context.user.roleName === "Administrator" ? 1 : 0, context.user.id],
      ),
      db.query(
        `SELECT m.id,m.name,m.from_email,m.provider,ma.is_default FROM mailboxes m JOIN mailbox_access ma ON ma.mailbox_id=m.id WHERE ma.user_id=? AND ma.can_send=TRUE ORDER BY ma.is_default DESC,m.name`,
        [context.user.id],
      ),
    ]);
    const shareRows = rows<SerializableRow>(shares);
    const ids = shareRows.map((item) => String(item["id"]));
    let items: SerializableRow[] = [];
    let recipients: SerializableRow[] = [];
    let events: SerializableRow[] = [];
    if (ids.length) {
      const marks = ids.map(() => "?").join(",");
      [items, recipients, events] = await Promise.all([
        db
          .query(
            `SELECT i.*,d.title,v.file_name,v.version_number,v.file_size,v.content_type FROM secure_document_share_items i JOIN documents d ON d.id=i.document_id JOIN document_versions v ON v.id=i.version_id WHERE i.share_id IN (${marks}) ORDER BY i.display_order`,
            ids,
          )
          .then((result) => rows<SerializableRow>(result)),
        db
          .query(
            `SELECT id,share_id,name,email,message,allow_download,invited_at,last_seen_at,revoked_at,created_at FROM secure_document_share_recipients WHERE share_id IN (${marks}) ORDER BY created_at`,
            ids,
          )
          .then((result) => rows<SerializableRow>(result)),
        db
          .query(
            `SELECT e.*,r.name recipient_name,r.email recipient_email FROM secure_document_share_events e LEFT JOIN secure_document_share_recipients r ON r.id=e.recipient_id WHERE e.share_id IN (${marks}) ORDER BY e.created_at DESC LIMIT 500`,
            ids,
          )
          .then((result) => rows<SerializableRow>(result)),
      ]);
    }
    return serial({
      shares: shareRows.map((share) => ({
        ...share,
        items: items.filter((item) => item["share_id"] === share["id"]),
        recipients: recipients.filter((item) => item["share_id"] === share["id"]),
        events: events.filter((item) => item["share_id"] === share["id"]),
      })),
      documents: rows<SerializableRow>(documents),
      mailboxes: rows<SerializableRow>(mailboxes),
    });
  });

export const createSecureShare = createServerFn({ method: "POST" })
  .middleware([permission])
  .validator((data: CreateSecureShareInput) => validateContract(data, "createSecureShare"))
  .handler(async ({ data, context }) => {
    const title = cleanText(data.title, 200);
    if (!title) throw new Error("A secure share title is required.");
    if (!data.documentIds.length) throw new Error("Choose at least one document.");
    if (!data.recipients.length) throw new Error("Add at least one recipient.");
    if (data.recipients.length > 100)
      throw new Error("A secure share can have up to 100 recipients.");
    const slugBase = cleanText(data.slug || title, 160)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");
    const slug = `${slugPattern.test(slugBase) ? slugBase : "documents"}-${secureToken().slice(0, 8)}`;
    const expires = data.expiresAt ? new Date(data.expiresAt) : null;
    if (expires && (!Number.isFinite(expires.getTime()) || expires <= new Date()))
      throw new Error("Expiry must be in the future.");
    for (const recipient of data.recipients) {
      recipient.email = recipient.email.trim().toLowerCase();
      if (!emailPattern.test(recipient.email) || /[\r\n]/.test(recipient.email))
        throw new Error(`Invalid recipient email: ${recipient.email}`);
      if (!cleanText(recipient.name, 200)) throw new Error("Every recipient needs a name.");
    }
    const unique = new Set(data.recipients.map((item) => item.email));
    if (unique.size !== data.recipients.length)
      throw new Error("Each recipient email can appear only once.");
    const db = await pool();
    const { requireMailboxAccess } = await import("./email-identity.server");
    await requireMailboxAccess(db, data.mailboxId, context.user);
    const connection = await db.getConnection();
    const shareId = crypto.randomUUID();
    const pending: Array<{ id: string; token: string }> = [];
    try {
      await connection.beginTransaction();
      await connection.execute(
        `INSERT INTO secure_document_shares (id,title,description,slug,expires_at,mailbox_id,email_subject,email_message,created_by) VALUES (?,?,?,?,?,?,?,?,?)`,
        [
          shareId,
          title,
          cleanText(data.description, 4000) || null,
          slug,
          expires ? expires.toISOString().slice(0, 19).replace("T", " ") : null,
          data.mailboxId,
          cleanText(data.emailSubject, 255) || `Secure documents: ${title}`,
          cleanText(data.emailMessage, 4000) || null,
          context.user.id,
        ],
      );
      for (const [index, documentId] of [...new Set(data.documentIds)].entries()) {
        if (!uuidPattern.test(documentId)) throw new Error("Invalid document selection.");
        const document = rows<{ id: string; version_id: string }>(
          await connection.query(
            `SELECT d.id,v.id version_id FROM documents d JOIN document_versions v ON v.document_id=d.id AND v.version_number=(SELECT MAX(v2.version_number) FROM document_versions v2 WHERE v2.document_id=d.id) LEFT JOIN document_access da ON da.document_id=d.id AND da.user_id=? WHERE d.id=? AND (?=1 OR d.owner_id=? OR d.owner_id IS NULL OR da.access_level IN ('edit','manage')) LIMIT 1`,
            [
              context.user.id,
              documentId,
              context.user.roleName === "Administrator" ? 1 : 0,
              context.user.id,
            ],
          ),
        )[0];
        if (!document)
          throw new Error("A selected document is unavailable or has no managed version.");
        await connection.execute(
          "INSERT INTO secure_document_share_items (id,share_id,document_id,version_id,display_order) VALUES (?,?,?,?,?)",
          [crypto.randomUUID(), shareId, document.id, document.version_id, index],
        );
      }
      for (const recipient of data.recipients) {
        const id = crypto.randomUUID();
        const token = secureToken();
        pending.push({ id, token });
        await connection.execute(
          `INSERT INTO secure_document_share_recipients (id,share_id,name,email,message,access_token_hash,allow_download) VALUES (?,?,?,?,?,?,?)`,
          [
            id,
            shareId,
            cleanText(recipient.name, 200),
            recipient.email,
            cleanText(recipient.message, 3000) || null,
            secureTokenHash(token),
            recipient.allowDownload,
          ],
        );
      }
      await connection.commit();
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
    const failures: string[] = [];
    const links: Record<string, string> = {};
    for (const recipient of pending) {
      try {
        links[recipient.id] = await deliverInvitation(db, {
          shareId,
          recipientId: recipient.id,
          rawToken: recipient.token,
        });
      } catch (error) {
        failures.push(error instanceof Error ? error.message : "Invitation failed");
        await logEvent(db, {
          shareId,
          recipientId: recipient.id,
          type: "invitation_failed",
          ...(failures.at(-1) ? { detail: failures.at(-1)! } : {}),
        });
      }
    }
    return { id: shareId, slug, links, failures };
  });

export const resendSecureShareInvitation = createServerFn({ method: "POST" })
  .middleware([permission])
  .validator((data: { recipientId: string }) =>
    validateContract(data, "resendSecureShareInvitation"),
  )
  .handler(async ({ data, context }) => {
    const db = await pool();
    const recipient = rows<{ id: string; share_id: string; created_by: string }>(
      await db.query(
        `SELECT r.id,r.share_id,sh.created_by FROM secure_document_share_recipients r JOIN secure_document_shares sh ON sh.id=r.share_id WHERE r.id=? AND r.revoked_at IS NULL AND (?=1 OR sh.created_by=?) LIMIT 1`,
        [data.recipientId, context.user.roleName === "Administrator" ? 1 : 0, context.user.id],
      ),
    )[0];
    if (!recipient) throw new Error("Recipient not found.");
    const token = secureToken();
    await db.execute("UPDATE secure_document_share_recipients SET access_token_hash=? WHERE id=?", [
      secureTokenHash(token),
      recipient.id,
    ]);
    await db.execute("DELETE FROM secure_document_share_sessions WHERE recipient_id=?", [
      recipient.id,
    ]);
    const link = await deliverInvitation(db, {
      shareId: recipient.share_id,
      recipientId: recipient.id,
      rawToken: token,
    });
    return { link };
  });

export const addSecureShareRecipient = createServerFn({ method: "POST" })
  .middleware([permission])
  .validator((data: { shareId: string; recipient: SecureShareRecipientInput }) =>
    validateContract(data, "addSecureShareRecipient"),
  )
  .handler(async ({ data, context }) => {
    const db = await pool();
    const email = data.recipient.email.trim().toLowerCase();
    const name = cleanText(data.recipient.name, 200);
    if (!name || !emailPattern.test(email) || /[\r\n]/.test(email))
      throw new Error("Enter a valid recipient name and email.");
    const share = rows<{ id: string }>(
      await db.query(
        "SELECT id FROM secure_document_shares WHERE id=? AND status='active' AND (?=1 OR created_by=?) LIMIT 1",
        [data.shareId, context.user.roleName === "Administrator" ? 1 : 0, context.user.id],
      ),
    )[0];
    if (!share) throw new Error("Active secure share not found.");
    const id = crypto.randomUUID();
    const token = secureToken();
    try {
      await db.execute(
        "INSERT INTO secure_document_share_recipients (id,share_id,name,email,message,access_token_hash,allow_download) VALUES (?,?,?,?,?,?,?)",
        [
          id,
          share.id,
          name,
          email,
          cleanText(data.recipient.message, 3000) || null,
          secureTokenHash(token),
          data.recipient.allowDownload,
        ],
      );
    } catch (error) {
      if ((error as { code?: string }).code === "ER_DUP_ENTRY")
        throw new Error("This email address is already a recipient of the secure share.");
      throw error;
    }
    try {
      const link = await deliverInvitation(db, {
        shareId: share.id,
        recipientId: id,
        rawToken: token,
      });
      return { id, link };
    } catch (error) {
      await logEvent(db, {
        shareId: share.id,
        recipientId: id,
        type: "invitation_failed",
        detail: error instanceof Error ? error.message.slice(0, 500) : "Invitation failed",
      });
      throw new Error(
        "Recipient added, but the invitation could not be sent. Use resend to retry.",
      );
    }
  });

export const updateSecureShareStatus = createServerFn({ method: "POST" })
  .middleware([permission])
  .validator((data: { id: string; status: "active" | "revoked" }) =>
    validateContract(data, "updateSecureShareStatus"),
  )
  .handler(async ({ data, context }) => {
    const db = await pool();
    const [result] = await db.execute(
      "UPDATE secure_document_shares SET status=? WHERE id=? AND (?=1 OR created_by=?)",
      [data.status, data.id, context.user.roleName === "Administrator" ? 1 : 0, context.user.id],
    );
    if (!(result as { affectedRows: number }).affectedRows)
      throw new Error("Secure share not found.");
    if (data.status === "revoked")
      await db.execute(
        "DELETE s FROM secure_document_share_sessions s JOIN secure_document_share_recipients r ON r.id=s.recipient_id WHERE r.share_id=?",
        [data.id],
      );
    await logEvent(db, {
      shareId: data.id,
      type: data.status === "revoked" ? "share_revoked" : "share_reactivated",
    });
    return { id: data.id };
  });

export const updateSecureShareRecipient = createServerFn({ method: "POST" })
  .middleware([permission])
  .validator((data: { id: string; allowDownload?: boolean; revoked?: boolean }) =>
    validateContract(data, "updateSecureShareRecipient"),
  )
  .handler(async ({ data, context }) => {
    const db = await pool();
    const recipient = rows<{ id: string; share_id: string }>(
      await db.query(
        `SELECT r.id,r.share_id FROM secure_document_share_recipients r JOIN secure_document_shares sh ON sh.id=r.share_id WHERE r.id=? AND (?=1 OR sh.created_by=?) LIMIT 1`,
        [data.id, context.user.roleName === "Administrator" ? 1 : 0, context.user.id],
      ),
    )[0];
    if (!recipient) throw new Error("Recipient not found.");
    if (typeof data.allowDownload === "boolean")
      await db.execute("UPDATE secure_document_share_recipients SET allow_download=? WHERE id=?", [
        data.allowDownload,
        data.id,
      ]);
    if (typeof data.revoked === "boolean") {
      await db.execute(
        `UPDATE secure_document_share_recipients SET revoked_at=${data.revoked ? "CURRENT_TIMESTAMP(3)" : "NULL"} WHERE id=?`,
        [data.id],
      );
      if (data.revoked)
        await db.execute("DELETE FROM secure_document_share_sessions WHERE recipient_id=?", [
          data.id,
        ]);
    }
    await logEvent(db, {
      shareId: recipient.share_id,
      recipientId: data.id,
      type: data.revoked
        ? "recipient_revoked"
        : typeof data.revoked === "boolean"
          ? "recipient_restored"
          : "download_permission_changed",
      ...(typeof data.allowDownload === "boolean"
        ? { detail: data.allowDownload ? "Download allowed" : "Download disabled" }
        : {}),
    });
    return { id: data.id };
  });

export type PublicSecureShareState = {
  found: boolean;
  expired: boolean;
  identified: boolean;
  verified: boolean;
  title: string;
  description: string;
  email: string;
  allowDownload: boolean;
  documents: Array<{ id: string; name: string; type: string; size: number; url: string }>;
};
export const openSecureShare = createServerFn({ method: "POST" })
  .validator((data: { slug: string; token?: string }) => validateContract(data, "openSecureShare"))
  .handler(async ({ data }): Promise<PublicSecureShareState> => {
    const db = await pool();
    const share = rows<SerializableRow>(
      await db.query(
        "SELECT *,status!='active' OR (expires_at IS NOT NULL AND expires_at<=CURRENT_TIMESTAMP(3)) expired FROM secure_document_shares WHERE slug=? LIMIT 1",
        [data.slug],
      ),
    )[0];
    const empty = {
      found: false,
      expired: false,
      identified: false,
      verified: false,
      title: "",
      description: "",
      email: "",
      allowDownload: false,
      documents: [],
    };
    if (!share) return empty;
    if (data.token && /^[a-f0-9]{64}$/.test(data.token) && !share["expired"]) {
      const recipient = rows<{ id: string }>(
        await db.query(
          "SELECT id FROM secure_document_share_recipients WHERE share_id=? AND access_token_hash=? AND revoked_at IS NULL LIMIT 1",
          [share["id"], secureTokenHash(data.token)],
        ),
      )[0];
      if (recipient) {
        const { readSecureShareCookie, setSecureShareCookie } =
          await import("./secure-share-session.server");
        const old = readSecureShareCookie();
        if (old)
          await db.execute("DELETE FROM secure_document_share_sessions WHERE token_hash=?", [
            secureTokenHash(old),
          ]);
        const sessionToken = secureToken();
        await db.execute(
          "INSERT INTO secure_document_share_sessions (token_hash,recipient_id,expires_at) VALUES (?,?,DATE_ADD(CURRENT_TIMESTAMP(3),INTERVAL 12 HOUR))",
          [secureTokenHash(sessionToken), recipient.id],
        );
        setSecureShareCookie(sessionToken);
        await logEvent(db, {
          shareId: String(share["id"]),
          recipientId: recipient.id,
          type: "invitation_opened",
        });
      }
    }
    const { readSecureShareSession } = await import("./secure-share-session.server");
    const session = await readSecureShareSession(data.slug);
    const verified = Boolean(session?.["verified_at"] && !share["expired"]);
    let documents: PublicSecureShareState["documents"] = [];
    if (verified) {
      documents = rows<SerializableRow>(
        await db.query(
          `SELECT i.id,v.file_name,v.content_type,v.file_size FROM secure_document_share_items i JOIN document_versions v ON v.id=i.version_id WHERE i.share_id=? ORDER BY i.display_order`,
          [share["id"]],
        ),
      ).map((item) => ({
        id: String(item["id"]),
        name: String(item["file_name"]),
        type: String(item["content_type"]),
        size: Number(item["file_size"]),
        url: `/api/secure-share/document/${item["id"]}`,
      }));
    }
    return serial({
      found: true,
      expired: Boolean(share["expired"]),
      identified: Boolean(session),
      verified,
      title: String(share["title"]),
      description: String(share["description"] || ""),
      email: String(session?.["email"] || ""),
      allowDownload: Boolean(session?.["allow_download"]),
      documents,
    });
  });

export const requestSecureShareOtp = createServerFn({ method: "POST" })
  .validator((data: { slug: string }) => validateContract(data, "requestSecureShareOtp"))
  .handler(async ({ data }) => {
    const db = await pool();
    const { readSecureShareSession } = await import("./secure-share-session.server");
    const session = await readSecureShareSession(data.slug);
    if (!session) throw new Error("Open your personal invitation link first.");
    const connection = await db.getConnection();
    const code = secureOtp();
    const id = crypto.randomUUID();
    try {
      await connection.beginTransaction();
      await connection.query(
        "SELECT id FROM secure_document_share_recipients WHERE id=? FOR UPDATE",
        [session["recipient_id"]],
      );
      const limit = rows<{ count: number; recent: number }>(
        await connection.query(
          `SELECT COUNT(*) count,MAX(created_at)>DATE_SUB(CURRENT_TIMESTAMP(3),INTERVAL 60 SECOND) recent FROM secure_document_share_otps WHERE recipient_id=? AND created_at>DATE_SUB(CURRENT_TIMESTAMP(3),INTERVAL 1 HOUR)`,
          [String(session["recipient_id"])],
        ),
      )[0];
      if (Number(limit?.recent) || Number(limit?.count) >= 10)
        throw new Error("Please wait before requesting another code.");
      await connection.execute(
        "UPDATE secure_document_share_otps SET consumed_at=CURRENT_TIMESTAMP(3) WHERE session_hash=? AND consumed_at IS NULL",
        [String(session["session_hash"])],
      );
      await connection.execute(
        "INSERT INTO secure_document_share_otps (id,recipient_id,session_hash,code_hash,expires_at) VALUES (?,?,?,?,DATE_ADD(CURRENT_TIMESTAMP(3),INTERVAL 10 MINUTE))",
        [
          id,
          String(session["recipient_id"]),
          String(session["session_hash"]),
          secureOtpHash(code, String(session["session_hash"]), shareSecret()),
        ],
      );
      await connection.commit();
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
    const { sendSecureShareEmail } = await import("./secure-share-mail.server");
    try {
      await sendSecureShareEmail(db, {
        mailboxId: String(session["mailbox_id"]),
        to: String(session["email"]),
        subject: `Your Gwero secure document code`,
        html: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:auto"><p>Hello ${escapeHtml(String(session["name"]))},</p><p>Your code for <strong>${escapeHtml(String(session["title"]))}</strong> is:</p><p style="font-size:32px;font-weight:bold;letter-spacing:7px;color:#6d28d9">${code}</p><p>This code expires in 10 minutes and works only in the browser that requested it.</p></div>`,
        text: `Your secure document code is ${code}. It expires in 10 minutes.`,
        messageId: `<secure-otp-${id}@gwero-os>`,
      });
      await logEvent(db, {
        shareId: String(session["share_id"]),
        recipientId: String(session["recipient_id"]),
        type: "otp_sent",
      });
    } catch (error) {
      await db.execute(
        "UPDATE secure_document_share_otps SET consumed_at=CURRENT_TIMESTAMP(3) WHERE id=?",
        [id],
      );
      throw error;
    }
    return { ok: true };
  });

export const verifySecureShareOtp = createServerFn({ method: "POST" })
  .validator((data: { slug: string; code: string }) =>
    validateContract(data, "verifySecureShareOtp"),
  )
  .handler(async ({ data }) => {
    if (!/^\d{6}$/.test(data.code)) throw new Error("Enter the six-digit code.");
    const db = await pool();
    const { readSecureShareSession } = await import("./secure-share-session.server");
    const session = await readSecureShareSession(data.slug);
    if (!session) throw new Error("This secure session is unavailable.");
    const connection = await db.getConnection();
    try {
      await connection.beginTransaction();
      const otp = rows<{ id: string; code_hash: string; attempts: number; expired: number }>(
        await connection.query(
          `SELECT *,expires_at<=CURRENT_TIMESTAMP(3) expired FROM secure_document_share_otps WHERE session_hash=? AND consumed_at IS NULL ORDER BY created_at DESC LIMIT 1 FOR UPDATE`,
          [session["session_hash"]],
        ),
      )[0];
      if (!otp || otp.expired || otp.attempts >= 5)
        throw new Error("The code expired or reached its attempt limit. Request a new one.");
      await connection.execute(
        "UPDATE secure_document_share_otps SET attempts=attempts+1 WHERE id=?",
        [otp.id],
      );
      const actual = secureOtpHash(data.code, String(session["session_hash"]), shareSecret());
      if (!safeHashEqual(otp.code_hash, actual)) {
        await connection.commit();
        throw new Error("Incorrect code. Please try again.");
      }
      await connection.execute(
        "UPDATE secure_document_share_otps SET consumed_at=CURRENT_TIMESTAMP(3) WHERE id=?",
        [otp.id],
      );
      await connection.execute(
        "UPDATE secure_document_share_sessions SET verified_at=CURRENT_TIMESTAMP(3) WHERE token_hash=?",
        [String(session["session_hash"])],
      );
      await connection.execute(
        "UPDATE secure_document_share_recipients SET last_seen_at=CURRENT_TIMESTAMP(3) WHERE id=?",
        [String(session["recipient_id"])],
      );
      await connection.commit();
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
    await logEvent(db, {
      shareId: String(session["share_id"]),
      recipientId: String(session["recipient_id"]),
      type: "access_verified",
    });
    return { ok: true };
  });

export const leaveSecureShare = createServerFn({ method: "POST" }).handler(async () => {
  const db = await pool();
  const { readSecureShareCookie, clearSecureShareCookie } =
    await import("./secure-share-session.server");
  const token = readSecureShareCookie();
  if (token)
    await db.execute("DELETE FROM secure_document_share_sessions WHERE token_hash=?", [
      secureTokenHash(token),
    ]);
  clearSecureShareCookie();
  return { ok: true };
});
