import { requirePageAccess } from "./page-access.server";
import { gatewayFetch } from "./crm.functions";
import { getPool, serverDb } from "./db.server";
import { buildMime } from "./mime.server";
import { smtpSend } from "./smtp.server";

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => {
    const entities: Record<string, string> = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#039;",
    };
    return entities[character] || character;
  });
}

export type NotificationEmailResult = {
  sent: number;
  failed?: number;
  skipped?: string;
};

export async function sendPendingNotificationEmails(options?: {
  notificationIds?: string[];
  ignoreDelay?: boolean;
}): Promise<NotificationEmailResult> {
  const { data: mailbox } = await serverDb
    .from("mailboxes")
    .select("*")
    .order("is_default", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!mailbox) return { sent: 0, skipped: "No sending account configured" };
  const { data: secret } = await serverDb
    .from("mailbox_secrets")
    .select("*")
    .eq("mailbox_id", mailbox.id)
    .maybeSingle();
  const notificationIds = [...new Set(options?.notificationIds || [])].filter(Boolean);
  if (options?.notificationIds && !notificationIds.length) return { sent: 0 };
  const idFilter = notificationIds.length
    ? `AND n.id IN (${notificationIds.map(() => "?").join(",")})`
    : "";
  const delayFilter = options?.ignoreDelay
    ? ""
    : "AND TIMESTAMPADD(MINUTE, COALESCE(p.email_delay_minutes, 60), n.created_at) <= CURRENT_TIMESTAMP(3)";
  const [rows] = await getPool().execute(
    `SELECT n.id, n.title, n.body, n.action_url, u.email, u.full_name, u.id AS user_id, u.role_id
       FROM notifications n
       JOIN system_users u ON u.id = n.user_id AND u.status = 'active'
       LEFT JOIN notification_preferences p ON p.user_id = u.id
      WHERE n.read_at IS NULL AND n.email_sent_at IS NULL
        AND COALESCE(p.email_enabled, TRUE) = TRUE
        ${idFilter}
        ${delayFilter}
      ORDER BY n.created_at ASC LIMIT 100`,
    notificationIds,
  );
  let sent = 0;
  let failed = 0;
  for (const row of rows as Array<{
    id: string;
    title: string;
    body: string;
    action_url: string | null;
    email: string;
    full_name: string;
    user_id: string;
    role_id: string | null;
  }>) {
    if (row.action_url) {
      const [allowed] = await getPool().execute(
        "SELECT p.permission_key FROM role_permissions rp JOIN permissions p ON p.id=rp.permission_id WHERE rp.role_id=?",
        [row.role_id],
      );
      try {
        await requirePageAccess(row.action_url, {
          id: row.user_id,
          fullName: row.full_name,
          email: row.email,
          roleId: row.role_id,
          roleName: null,
          permissions: (allowed as Array<{ permission_key: string }>).map((p) => p.permission_key),
        });
      } catch {
        continue;
      }
    }
    const origin = (process.env["APP_URL"] || "https://os.gwerosolutions.com").replace(/\/$/, "");
    const actionUrl = row.action_url ? new URL(row.action_url, origin).toString() : origin;
    const html = `<p>Hello ${escapeHtml(row.full_name)},</p><p>${escapeHtml(row.body)}</p><p><a href="${escapeHtml(actionUrl)}">Open in Gwero OS</a></p>`;
    const messageId = `<notification-${row.id}@gwero-crm>`;
    const [claim] = await getPool().execute(
      `UPDATE notifications SET email_sent_at = CURRENT_TIMESTAMP(3)
        WHERE id = ? AND read_at IS NULL AND email_sent_at IS NULL`,
      [row.id],
    );
    if (!(claim as { affectedRows?: number }).affectedRows) continue;
    try {
      if (mailbox.provider === "smtp") {
        const raw = buildMime({
          from: mailbox.from_email,
          fromName: mailbox.from_name,
          to: row.email,
          subject: row.title,
          html,
          text: `${row.body}\n\n${actionUrl}`,
          messageId,
        });
        await smtpSend(
          {
            host: mailbox.smtp_host || "",
            port: mailbox.smtp_port || 587,
            secure: mailbox.smtp_secure,
            username: mailbox.smtp_username || "",
            password: secret?.smtp_password || "",
          },
          { from: mailbox.from_email, envelopeFrom: mailbox.from_email, to: row.email, raw },
        );
      } else {
        if (!secret) throw new Error("Mailbox credentials are missing");
        if (mailbox.provider === "gmail" || mailbox.provider === "google") {
          const raw = buildMime({
            from: mailbox.from_email,
            fromName: mailbox.from_name,
            to: row.email,
            subject: row.title,
            html,
            text: `${row.body}\n\n${actionUrl}`,
            messageId,
          });
          const response = await gatewayFetch("gmail", secret, "/gmail/v1/users/me/messages/send", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ raw: Buffer.from(raw).toString("base64url") }),
          });
          if (!response.ok) throw new Error(await response.text());
        } else {
          const response = await gatewayFetch("outlook", secret, "/me/sendMail", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
              message: {
                subject: row.title,
                body: { contentType: "HTML", content: html },
                toRecipients: [{ emailAddress: { address: row.email } }],
              },
            }),
          });
          if (!response.ok) throw new Error(await response.text());
        }
      }
      sent += 1;
    } catch (error) {
      failed += 1;
      await getPool().execute(
        "UPDATE notifications SET email_sent_at = NULL WHERE id = ? AND read_at IS NULL",
        [row.id],
      );
      console.error(`Notification email ${row.id} failed`, error);
    }
  }
  return { sent, failed };
}

export async function runNotificationEscalations() {
  return sendPendingNotificationEmails();
}
