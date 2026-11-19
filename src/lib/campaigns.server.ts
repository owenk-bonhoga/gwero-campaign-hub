import { decryptMailboxRow } from "./secret-crypto";
import { createHash, randomUUID } from "node:crypto";
import { readAttachment } from "./attachments.server";
import { gatewayFetch } from "./crm.functions";
import { getPool } from "./db.server";
import { buildMime } from "./mime.server";
import { htmlToText, personalize, type ProspectLike } from "./personalize";
import { smtpSend } from "./smtp.server";
import { campaignTrackingToken } from "./campaign-tracking-security";

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
  approval_required: number;
  approved_at: string | null;
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
  message_id: string | null;
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
      const token = campaignTrackingToken("click", recipientId, url);
      return `href="${origin}/api/public/t/click?r=${recipientId}&u=${encodeURIComponent(url)}&t=${token}"`;
    });
  }
  if (opens)
    tracked += `<img src="${origin}/api/public/t/open?r=${recipientId}&t=${campaignTrackingToken("open", recipientId)}" width="1" height="1" alt="" style="display:none" />`;
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

  await getPool().execute(
    "UPDATE campaign_recipients SET dispatch_started_at=CURRENT_TIMESTAMP(3), message_id=? WHERE id=? AND status='processing'",
    [messageId, recipient.id],
  );
  try {
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
      if (!response.ok)
        throw Object.assign(new Error(await response.text()), { definitiveRejection: true });
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
      if (!response.ok)
        throw Object.assign(new Error(await response.text()), { definitiveRejection: true });
    }
  } catch (error) {
    const failure = error as Error & {
      code?: string;
      command?: string;
      definitiveRejection?: boolean;
      deliveryUncertain?: boolean;
    };
    failure.deliveryUncertain =
      !failure.definitiveRejection &&
      !["EAUTH", "ECONNECTION", "EDNS", "ETLS"].includes(failure.code || "") &&
      failure.command !== "CONN" &&
      !["MAIL FROM", "RCPT TO", "AUTH PLAIN", "AUTH LOGIN"].includes(failure.command || "") &&
      !["EENVELOPE", "EMESSAGE"].includes(failure.code || "");
    throw failure;
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
      `SELECT (SELECT COUNT(*) FROM campaign_events WHERE campaign_id=? AND event_type='email.sent' AND created_at>=CURRENT_DATE()) + (SELECT COUNT(*) FROM campaign_recipients WHERE campaign_id=? AND status='uncertain' AND dispatch_started_at>=CURRENT_DATE()) total`,
      [campaign.id, campaign.id],
    ),
  ]);
  const mailbox = (mailboxRows[0] as MailboxRow[])[0];
  const storedSecret = (secretRows[0] as SecretRow[])[0];
  const secret = storedSecret ? decryptMailboxRow(storedSecret) : undefined;
  const steps = stepRows[0] as StepRow[];
  const sentToday = Number((sentTodayRows[0] as Array<{ total: number }>)[0]?.total || 0);
  if (campaign.approval_required && !campaign.approved_at) return { processed: 0, failed: 0 };
  const [access] = await db.execute(
    "SELECT m.id FROM mailboxes m LEFT JOIN mailbox_access a ON a.mailbox_id=m.id AND a.user_id=? JOIN system_users u ON u.id=? AND u.status='active' JOIN role_permissions rp ON rp.role_id=u.role_id JOIN permissions p ON p.id=rp.permission_id AND p.permission_key='campaigns.manage' WHERE m.id=? AND (m.created_by=? OR a.can_send=TRUE) LIMIT 1",
    [campaign.owner_id, campaign.owner_id, campaign.mailbox_id, campaign.owner_id],
  );
  if (!(access as unknown[]).length) return { processed: 0, failed: 0 };
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
  const deadline = Date.now() + 25_000;
  for (const recipient of recipientRows as RecipientRow[]) {
    if (Date.now() > deadline) break;
    if (campaign.stop_on_reply && recipient.replied_at) {
      await db.execute(
        `UPDATE campaign_recipients SET status = 'stopped', stopped_reason = 'Replied'
          WHERE id = ?`,
        [recipient.id],
      );
      continue;
    }
    const [claim] = await db.execute(
      `UPDATE campaign_recipients SET status = 'processing', claimed_at = CURRENT_TIMESTAMP(3), dispatch_started_at = NULL
        WHERE id = ? AND status IN ('pending','active','failed') AND EXISTS (SELECT 1 FROM campaigns c WHERE c.id=campaign_recipients.campaign_id AND c.status='running' AND (c.approval_required=FALSE OR c.approved_at IS NOT NULL))`,
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
    let accepted = false;
    try {
      if (step.step_type === "task") {
        await db.execute(
          `INSERT IGNORE INTO activities (id, entity_type, entity_id, activity_type, body)
           VALUES (?, 'prospect', ?, 'campaign_task', ?)`,
          [
            createHash("sha256")
              .update(`task:${recipient.id}:${step.id}`)
              .digest("hex")
              .slice(0, 36),
            recipient.prospect_id,
            step.task_instructions || step.name,
          ],
        );
        await completeStep(campaign, recipient, step, steps);
      } else {
        const messageId = await deliverEmail(campaign, mailbox, secret, step, recipient);
        accepted = true;
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
      const uncertain =
        accepted || Boolean((error as { deliveryUncertain?: boolean }).deliveryUncertain);
      await db.execute(
        `UPDATE campaign_recipients SET status = ?, attempt_count = ?, error = ?,
          next_action_at = IF(? < 3, TIMESTAMPADD(MINUTE, 15, CURRENT_TIMESTAMP(3)), NULL),
          stopped_reason = IF(? >= 3, 'Delivery failed after 3 attempts', stopped_reason),
          last_activity_at = CURRENT_TIMESTAMP(3) WHERE id = ?`,
        [
          uncertain ? "uncertain" : attempts >= 3 ? "stopped" : "failed",
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
      WHERE campaign_id = ? AND (status IN ('pending','active','processing','uncertain') OR (status='failed' AND attempt_count<3))`,
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
  const lease = await db.getConnection();
  const lockName = `gwero:campaign:${process.env["DB_NAME"] || "default"}`.slice(0, 64);
  try {
    const [lockRows] = await lease.query("SELECT GET_LOCK(?,0) AS acquired", [lockName]);
    if (!(lockRows as Array<{ acquired: number }>)[0]?.acquired) {
      return { campaigns: 0, processed: 0, failed: 0 };
    }
    const deadline = Date.now() + 25000;
    await db.execute(
      "UPDATE campaign_recipients SET status=IF(dispatch_started_at IS NULL,'failed','uncertain'), error='Worker interrupted. Check delivery before retrying.', next_action_at=CURRENT_TIMESTAMP(3) WHERE status='processing' AND (claimed_at IS NULL OR claimed_at<DATE_SUB(CURRENT_TIMESTAMP(3),INTERVAL 5 MINUTE))",
    );
    await db.execute(
      `UPDATE campaigns SET status = 'running', sent_at = COALESCE(sent_at, CURRENT_TIMESTAMP(3))
      WHERE status = 'scheduled' AND scheduled_at <= CURRENT_TIMESTAMP(3) AND (approval_required=FALSE OR approved_at IS NOT NULL)`,
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
      if (processed + failed >= maxActions || Date.now() >= deadline) break;
    }
    return { campaigns: (campaignRows as CampaignRow[]).length, processed, failed };
  } finally {
    try {
      await lease.query("SELECT RELEASE_LOCK(?)", [lockName]);
    } finally {
      lease.release();
    }
  }
}

export async function resolveUncertainDelivery(
  input: { campaignId: string; recipientId: string; outcome: "delivered" | "not_delivered" },
  userId: string,
) {
  const db = getPool();
  const lease = await db.getConnection();
  const lockName = `gwero:campaign:${process.env["DB_NAME"] || "default"}`.slice(0, 64);
  try {
    const [lock] = await lease.query("SELECT GET_LOCK(?,0) AS acquired", [lockName]);
    if (!(lock as Array<{ acquired: number }>)[0]?.acquired)
      throw new Error("Queue is busy. Try again shortly.");
    const [recipients] = await db.execute(
      "SELECT * FROM campaign_recipients WHERE id=? AND campaign_id=? AND status='uncertain' LIMIT 1",
      [input.recipientId, input.campaignId],
    );
    const recipient = (recipients as RecipientRow[])[0];
    if (!recipient) throw new Error("This contact no longer needs a delivery review.");
    if (input.outcome === "delivered") {
      const [campaigns] = await db.execute("SELECT * FROM campaigns WHERE id=?", [
        input.campaignId,
      ]);
      const [steps] = await db.execute(
        "SELECT * FROM campaign_steps WHERE campaign_id=? AND is_active=TRUE ORDER BY step_order",
        [input.campaignId],
      );
      const sequence = steps as StepRow[];
      const step = sequence.find((item) => item.step_order === recipient.current_step);
      if (!step) throw new Error("Campaign step is missing. Stop this contact instead.");
      await completeStep(
        (campaigns as CampaignRow[])[0]!,
        recipient,
        step,
        sequence,
        recipient.message_id || undefined,
      );
    } else
      await db.execute(
        "UPDATE campaign_recipients SET status='active',attempt_count=0,error=NULL,dispatch_started_at=NULL,claimed_at=NULL,next_action_at=CURRENT_TIMESTAMP(3) WHERE id=? AND status='uncertain'",
        [recipient.id],
      );
    await db.execute(
      "INSERT INTO campaign_events(id,campaign_id,recipient_id,event_type,detail) VALUES(?,?,?,'delivery.reviewed',?)",
      [
        randomUUID(),
        input.campaignId,
        recipient.id,
        JSON.stringify({ outcome: input.outcome, reviewedBy: userId }),
      ],
    );
  } finally {
    try {
      await lease.query("SELECT RELEASE_LOCK(?)", [lockName]);
    } finally {
      lease.release();
    }
  }
}
