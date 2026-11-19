import { decryptMailboxRow } from "./secret-crypto";
import type { Pool } from "mysql2/promise";
import { gatewayFetch } from "./crm.functions";
import { buildMime } from "./mime.server";
import { smtpSend } from "./smtp.server";

type Mailbox = {
  id: string;
  provider: string;
  from_email: string;
  from_name: string | null;
  smtp_host: string | null;
  smtp_port: number | null;
  smtp_secure: boolean;
  smtp_username: string | null;
};
type Secret = {
  mailbox_id: string;
  smtp_password: string | null;
  oauth_access_token: string | null;
  oauth_refresh_token: string | null;
  oauth_expires_at: string | null;
};

export async function sendSecureShareEmail(
  db: Pool,
  input: {
    mailboxId: string;
    to: string;
    subject: string;
    html: string;
    text: string;
    messageId: string;
  },
) {
  const [mailboxRows] = await db.execute("SELECT * FROM mailboxes WHERE id=? LIMIT 1", [
    input.mailboxId,
  ]);
  const mailbox = (mailboxRows as Mailbox[])[0];
  if (!mailbox) throw new Error("The secure share sending account is unavailable.");
  const [secretRows] = await db.execute(
    "SELECT * FROM mailbox_secrets WHERE mailbox_id=? LIMIT 1",
    [input.mailboxId],
  );
  const stored = (secretRows as Secret[])[0];
  const secret = stored ? decryptMailboxRow(stored) : undefined;
  if (mailbox.provider === "smtp") {
    const raw = buildMime({
      from: mailbox.from_email,
      fromName: mailbox.from_name,
      to: input.to,
      subject: input.subject,
      html: input.html,
      text: input.text,
      messageId: input.messageId,
    });
    await smtpSend(
      {
        host: mailbox.smtp_host || "",
        port: mailbox.smtp_port || 587,
        secure: Boolean(mailbox.smtp_secure),
        username: mailbox.smtp_username || "",
        password: secret?.smtp_password || "",
      },
      { from: mailbox.from_email, envelopeFrom: mailbox.from_email, to: input.to, raw },
    );
    return;
  }
  if (!secret) throw new Error("The sending account must be reconnected.");
  if (mailbox.provider === "gmail" || mailbox.provider === "google") {
    const raw = buildMime({
      from: mailbox.from_email,
      fromName: mailbox.from_name,
      to: input.to,
      subject: input.subject,
      html: input.html,
      text: input.text,
      messageId: input.messageId,
    });
    const response = await gatewayFetch("gmail", secret, "/gmail/v1/users/me/messages/send", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ raw: Buffer.from(raw).toString("base64url") }),
    });
    if (!response.ok) throw new Error(await response.text());
    return;
  }
  const response = await gatewayFetch("outlook", secret, "/me/sendMail", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      message: {
        subject: input.subject,
        body: { contentType: "HTML", content: input.html },
        toRecipients: [{ emailAddress: { address: input.to } }],
      },
    }),
  });
  if (!response.ok) throw new Error(await response.text());
}
