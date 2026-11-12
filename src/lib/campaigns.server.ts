import { randomUUID } from "node:crypto";
import { readAttachment } from "./attachments.server";
import { gatewayFetch } from "./crm.functions";
import { getPool } from "./db.server";
import { buildMime } from "./mime.server";
import { htmlToText, personalize, type ProspectLike } from "./personalize";
import { smtpSend } from "./smtp.server";

type CampaignRow = {
  id: string;
  owner_id: string;
  name: string;
  mailbox_id: string;
  attachments: string | Array<{ path: string; name: string; type?: string }>;
  cc: string | string[];
  bcc: string | string[];
  track_opens: number;
  track_clicks: number;
  daily_limit: number;
  stop_on_reply: number;
};

type StepRow = {
  id: string;
  step_order: number;
  step_type: "email" | "task";
  name: string;
  delay_amount: number;
  delay_unit: "minutes" | "hours" | "days";
  subject: string | null;
  body_html: string | null;
  attachments: string | Array<{ path: string; name: string; type?: string }> | null;
  task_instructions: string | null;
};

type RecipientRow = {
  id: string;
  campaign_id: string;
  prospect_id: string;
  contact_id: string | null;
  current_step: number;
  replied_at: string | null;
  attempt_count: number;
  email: string | null;
  first_name: string | null;
  last_name: string | null;
  job_title: string | null;
  phone: string | null;
  company: string | null;
  prospect_email: string;
  extra: string | Record<string, unknown>;
};

type MailboxRow = {
  id: string;
  provider: string;
  from_email: string;
  from_name: string | null;
  smtp_host: string | null;
  smtp_port: number | null;
  smtp_secure: number;
  smtp_username: string | null;
};

type SecretRow = {
  mailbox_id: string;
  smtp_password: string | null;
  oauth_access_token: string | null;
  oauth_refresh_token: string | null;
  oauth_expires_at: string | null;
};

function jsonArray<T>(value: string | T[] | null | undefined): T[] {
  if (Array.isArray(value)) return value;
  if (!value) return [];
  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed) ? (parsed as T[]) : [];
  } catch {
    return [];
  }
}

function addDelay(step: StepRow | undefined) {
  if (!step) return null;
  const date = new Date();
  const amount = Math.max(0, step.delay_amount || 0);
  const multiplier =
    step.delay_unit === "minutes" ? 60_000 : step.delay_unit === "hours" ? 3_600_000 : 86_400_000;
  date.setTime(date.getTime() + amount * multiplier);
  return date;
}

function trackHtml(html: string, recipientId: string, opens: boolean, clicks: boolean) {
  const origin = (process.env["APP_URL"] || "https://os.gwerosolutions.com").replace(/\/$/, "");
  let tracked = html;
  if (clicks) {
    tracked = tracked.replace(/href="(https?:\/\/[^"]+)"/gi, (_match, url: string) => {
      return `href="${origin}/api/public/t/click?r=${recipientId}&u=${encodeURIComponent(url)}"`;
    });
  }
  if (opens)
    tracked += `<img src="${origin}/api/public/t/open?r=${recipientId}" width="1" height="1" alt="" style="display:none" />`;
  tracked += `<p style="margin-top:24px;font-size:12px;color:#64748b"><a href="${origin}/api/public/unsubscribe?r=${recipientId}" style="color:#64748b">Unsubscribe from campaign emails</a></p>`;
  return tracked;
}

async function deliverEmail(
  campaign: CampaignRow,
  mailbox: MailboxRow,
  secret: SecretRow | undefined,
  step: StepRow,
  recipient: RecipientRow,
) {
  const email = recipient.email || recipient.prospect_email;
  if (!email) throw new Error("Contact has no email address.");
  let extra: Record<string, unknown> = {};
  if (typeof recipient.extra === "string") {
    try {
      extra = JSON.parse(recipient.extra) as Record<string, unknown>;
    } catch {
      extra = {};
    }
  } else extra = recipient.extra || {};
  const person: ProspectLike = {
    email,
    first_name: recipient.first_name,
    last_name: recipient.last_name,
    company: recipient.company,
    job_title: recipient.job_title,
    phone: recipient.phone,
    extra,
  };
  const subject = personalize(step.subject || "", person);
  const unsignedHtml = personalize(step.body_html || "", person);
  const { applyActiveEmailSignature } = await import("./email-identity.server");
  const signed = await applyActiveEmailSignature(
    getPool(),
    campaign.owner_id,
    campaign.mailbox_id,
    unsignedHtml,
    htmlToText(unsignedHtml),
  );
  const html = trackHtml(
    signed.html,
    recipient.id,
    Boolean(campaign.track_opens),
    Boolean(campaign.track_clicks),
  );
  const attachments = [] as Array<{ filename: string; contentType: string; content: Uint8Array }>;
  for (const attachment of jsonArray<{ path: string; name: string; type?: string }>(
    campaign.attachments,
  )) {
    const content = await readAttachment(attachment.path);
    attachments.push({
      filename: attachment.name,
      contentType: attachment.type || "application/octet-stream",
      content: new Uint8Array(content),
    });
  }
  for (const attachment of jsonArray<{ path: string; name: string; type?: string }>(
    step.attachments,
  )) {
    const content = await readAttachment(attachment.path);
    attachments.push({
      filename: attachment.name,
      contentType: attachment.type || "application/octet-stream",
      content: new Uint8Array(content),
    });
  }
  const messageId = `<${recipient.id}.${step.id}@gwero-crm>`;
  const cc = jsonArray<string>(campaign.cc);
  const bcc = jsonArray<string>(campaign.bcc);
  const raw = buildMime({
    from: mailbox.from_email,
    fromName: mailbox.from_name,
    to: email,
    cc,
    subject,
    html,
    text: signed.text,
    attachments,
    messageId,
  });

  if (mailbox.provider === "smtp") {
    await smtpSend(
      {
        host: mailbox.smtp_host || "",
        port: mailbox.smtp_port || 587,
        secure: Boolean(mailbox.smtp_secure),
        username: mailbox.smtp_username || "",
        password: secret?.smtp_password || "",
      },
      { from: mailbox.from_email, envelopeFrom: mailbox.from_email, to: email, cc, bcc, raw },
    );
  } else if (mailbox.provider === "gmail" || mailbox.provider === "google") {
    if (!secret) throw new Error("Sending-account credentials are missing.");
    const response = await gatewayFetch("gmail", secret, "/gmail/v1/users/me/messages/send", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ raw: Buffer.from(raw).toString("base64url") }),
    });
    if (!response.ok) throw new Error(await response.text());
  } else {
    if (!secret) throw new Error("Sending-account credentials are missing.");
    const response = await gatewayFetch("outlook", secret, "/me/sendMail", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        message: {
          subject,
          body: { contentType: "HTML", content: html },
          toRecipients: [{ emailAddress: { address: email } }],
          ccRecipients: cc.map((address) => ({ emailAddress: { address } })),
          bccRecipients: bcc.map((address) => ({ emailAddress: { address } })),
          attachments: attachments.map((attachment) => ({
            "@odata.type": "#microsoft.graph.fileAttachment",
            name: attachment.filename,
            contentType: attachment.contentType,
            contentBytes: Buffer.from(attachment.content).toString("base64"),
          })),
        },
      }),
    });
    if (!response.ok) throw new Error(await response.text());
  }
  return messageId;
}

async function completeStep(
  campaign: CampaignRow,
  recipient: RecipientRow,
  step: StepRow,
  steps: StepRow[],
  messageId?: string,
) {
  const db = getPool();
  const next = steps.find((item) => item.step_order > step.step_order);
  const status = next ? "active" : "completed";
  await db.execute(
    `UPDATE campaign_recipients
        SET status = ?, current_step = ?, next_action_at = ?, last_activity_at = CURRENT_TIMESTAMP(3),
            sent_at = COALESCE(sent_at, CURRENT_TIMESTAMP(3)), message_id = COALESCE(?, message_id),
            error = NULL
      WHERE id = ?`,
    [status, next?.step_order || step.step_order, addDelay(next), messageId || null, recipient.id],
  );
  await db.execute(
    `INSERT INTO campaign_events
      (id, campaign_id, recipient_id, event_type, detail)
     VALUES (?, ?, ?, ?, ?)`,
    [
      randomUUID(),
      campaign.id,
      recipient.id,
      step.step_type === "email" ? "email.sent" : "task.created",
      `${step.step_order}. ${step.name}`,
    ],
  );
}

async function processCampaign(campaign: CampaignRow, remaining: number) {
  const db = getPool();
  const [mailboxRows, secretRows, stepRows, sentTodayRows] = await Promise.all([
    db.execute("SELECT * FROM mailboxes WHERE id = ? LIMIT 1", [campaign.mailbox_id]),
    db.execute("SELECT * FROM mailbox_secrets WHERE mailbox_id = ? LIMIT 1", [campaign.mailbox_id]),
    db.execute(
      "SELECT * FROM campaign_steps WHERE campaign_id = ? AND is_active = TRUE ORDER BY step_order ASC",
      [campaign.id],
    ),
    db.execute(
      `SELECT COUNT(*) total FROM campaign_events
        WHERE campaign_id = ? AND event_type = 'email.sent' AND created_at >= CURRENT_DATE()`,
      [campaign.id],
    ),
  ]);
  const mailbox = (mailboxRows[0] as MailboxRow[])[0];
  const secret = (secretRows[0] as SecretRow[])[0];
  const steps = stepRows[0] as StepRow[];
  const sentToday = Number((sentTodayRows[0] as Array<{ total: number }>)[0]?.total || 0);
  const allowance = Math.max(0, Math.min(remaining, campaign.daily_limit - sentToday));
  if (!mailbox || !steps.length || allowance <= 0) return { processed: 0, failed: 0 };

  const [recipientRows] = await db.execute(
    `SELECT r.*, p.company, p.email AS prospect_email, p.extra,
            pc.email, pc.first_name, pc.last_name, pc.job_title, pc.phone
       FROM campaign_recipients r
       JOIN prospects p ON p.id = r.prospect_id
       LEFT JOIN prospect_contacts pc ON pc.id = r.contact_id
       LEFT JOIN email_suppressions s ON LOWER(s.email) = LOWER(COALESCE(pc.email, p.email))
      WHERE r.campaign_id = ? AND r.status IN ('pending','active','failed') AND r.attempt_count < 3
        AND (r.next_action_at IS NULL OR r.next_action_at <= CURRENT_TIMESTAMP(3))
        AND s.id IS NULL
      ORDER BY COALESCE(r.next_action_at, r.created_at) ASC LIMIT ?`,
    [campaign.id, allowance],
  );
  let processed = 0;
  let failed = 0;
  for (const recipient of recipientRows as RecipientRow[]) {
    if (campaign.stop_on_reply && recipient.replied_at) {
      await db.execute(
        `UPDATE campaign_recipients SET status = 'stopped', stopped_reason = 'Replied'
          WHERE id = ?`,
        [recipient.id],
      );
      continue;
    }
    const [claim] = await db.execute(
      `UPDATE campaign_recipients SET status = 'processing'
        WHERE id = ? AND status IN ('pending','active','failed')`,
      [recipient.id],
    );
    if (!(claim as { affectedRows: number }).affectedRows) continue;
    const step = steps.find((item) => item.step_order === recipient.current_step) || steps[0];
    if (!step) {
      await db.execute(
        "UPDATE campaign_recipients SET status = 'completed', stopped_reason = 'No active step' WHERE id = ?",
        [recipient.id],
      );
      continue;
    }
    try {
      if (step.step_type === "task") {
        await db.execute(
          `INSERT INTO activities (id, entity_type, entity_id, activity_type, body)
           VALUES (?, 'prospect', ?, 'campaign_task', ?)`,
          [randomUUID(), recipient.prospect_id, step.task_instructions || step.name],
        );
        await completeStep(campaign, recipient, step, steps);
      } else {
        const messageId = await deliverEmail(campaign, mailbox, secret, step, recipient);
        await completeStep(campaign, recipient, step, steps, messageId);
        await db.execute(
          `UPDATE prospects SET status = IF(status = 'new', 'contacted', status),
            last_contact_at = CURRENT_TIMESTAMP(3) WHERE id = ?`,
          [recipient.prospect_id],
        );
      }
      processed += 1;
    } catch (error) {
      failed += 1;
      const attempts = Number(recipient.attempt_count || 0) + 1;
      await db.execute(
        `UPDATE campaign_recipients SET status = ?, attempt_count = ?, error = ?,
          next_action_at = IF(? < 3, TIMESTAMPADD(MINUTE, 15, CURRENT_TIMESTAMP(3)), NULL),
          stopped_reason = IF(? >= 3, 'Delivery failed after 3 attempts', stopped_reason),
          last_activity_at = CURRENT_TIMESTAMP(3) WHERE id = ?`,
        [
          attempts >= 3 ? "stopped" : "failed",
          attempts,
          String((error as Error).message).slice(0, 500),
          attempts,
          attempts,
          recipient.id,
        ],
      );
      await db.execute(
        `INSERT INTO campaign_events (id, campaign_id, recipient_id, event_type, detail)
         VALUES (?, ?, ?, 'delivery.failed', ?)`,
        [randomUUID(), campaign.id, recipient.id, String((error as Error).message).slice(0, 1000)],
      );
    }
  }

  const [outstandingRows] = await db.execute(
    `SELECT COUNT(*) total FROM campaign_recipients
      WHERE campaign_id = ? AND status IN ('pending','active','processing')`,
    [campaign.id],
  );
  if (!Number((outstandingRows as Array<{ total: number }>)[0]?.total)) {
    await db.execute(
      `UPDATE campaigns SET status = 'completed', completed_at = CURRENT_TIMESTAMP(3)
        WHERE id = ? AND status = 'running'`,
      [campaign.id],
    );
  }
  return { processed, failed };
}

export async function processCampaignQueue({
  campaignId,
  maxActions = 25,
}: { campaignId?: string; maxActions?: number } = {}) {
  const db = getPool();
  await db.execute(
    `UPDATE campaigns SET status = 'running', sent_at = COALESCE(sent_at, CURRENT_TIMESTAMP(3))
      WHERE status = 'scheduled' AND scheduled_at <= CURRENT_TIMESTAMP(3)`,
  );
  const params: string[] = [];
  const campaignFilter = campaignId ? " AND id = ?" : "";
  if (campaignId) params.push(campaignId);
  const [campaignRows] = await db.execute(
    `SELECT * FROM campaigns WHERE status = 'running'${campaignFilter} ORDER BY created_at ASC`,
    params,
  );
  let processed = 0;
  let failed = 0;
  for (const campaign of campaignRows as CampaignRow[]) {
    const result = await processCampaign(campaign, Math.max(0, maxActions - processed));
    processed += result.processed;
    failed += result.failed;
    if (processed >= maxActions) break;
  }
  return { campaigns: (campaignRows as CampaignRow[]).length, processed, failed };
}
