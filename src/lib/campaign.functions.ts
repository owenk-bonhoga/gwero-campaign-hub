import { randomUUID } from "node:crypto";
import { createServerFn } from "@tanstack/react-start";
import { permissionMiddleware } from "./auth.middleware";

type CampaignPatch = {
  campaignId: string;
  name: string;
  campaignType: string;
  objective: string;
  mailboxId: string;
  ownerId: string;
  dailyLimit: number;
  timezone: string;
  approvalRequired: boolean;
  stopOnReply: boolean;
  stopOnBounce: boolean;
  trackOpens: boolean;
  trackClicks: boolean;
  cc: string[];
  bcc: string[];
  attachments: Array<{ path: string; name: string; type?: string; size?: number }>;
};

type SerializableValue =
  string | number | boolean | null | SerializableValue[] | { [key: string]: SerializableValue };
type SerializableRecord = { [key: string]: SerializableValue };

export type CampaignStepInput = {
  id?: string;
  name: string;
  stepType: "email" | "task";
  delayAmount: number;
  delayUnit: "minutes" | "hours" | "days";
  subject: string;
  bodyHtml: string;
  attachments: Array<{ path: string; name: string; type?: string; size?: number }>;
  taskInstructions: string;
};

function normaliseCampaign(row: SerializableRecord) {
  for (const key of ["cc", "bcc", "attachments", "audience_rules"]) {
    if (typeof row[key] === "string") {
      try {
        row[key] = JSON.parse(row[key] as string);
      } catch {
        row[key] = key === "audience_rules" ? {} : [];
      }
    }
  }
  for (const key of [
    "track_opens",
    "track_clicks",
    "approval_required",
    "stop_on_reply",
    "stop_on_bounce",
  ]) {
    row[key] = Boolean(row[key]);
  }
  return row;
}

function sanitiseEmailHtml(value: string) {
  return value
    .replace(/<(script|iframe|object|embed|form|input|button)[^>]*>[\s\S]*?<\/\1>/gi, "")
    .replace(/<(script|iframe|object|embed|form|input|button)[^>]*\/?\s*>/gi, "")
    .replace(/\s+on[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, "")
    .replace(/(href|src)\s*=\s*(["'])\s*javascript:[\s\S]*?\2/gi, '$1="#"');
}

async function event(campaignId: string, eventType: string, actorId: string, detail?: string) {
  const { getPool } = await import("./db.server");
  await getPool().execute(
    `INSERT INTO campaign_events (id, campaign_id, event_type, detail, actor_id)
     VALUES (?, ?, ?, ?, ?)`,
    [randomUUID(), campaignId, eventType, detail || null, actorId],
  );
}

export const listCampaigns = createServerFn({ method: "GET" })
  .middleware([permissionMiddleware("campaigns.manage")])
  .handler(async () => {
    const { getPool } = await import("./db.server");
    const [rows] = await getPool().execute(
      `SELECT c.*, u.full_name AS owner_name, m.from_email AS mailbox_email,
              COUNT(r.id) AS recipient_count,
              SUM(r.status IN ('active','sent','completed')) AS reached_count,
              SUM(r.replied_at IS NOT NULL) AS replied_count,
              SUM(r.converted_at IS NOT NULL) AS converted_count
         FROM campaigns c
         LEFT JOIN system_users u ON u.id = c.owner_id
         LEFT JOIN mailboxes m ON m.id = c.mailbox_id
         LEFT JOIN campaign_recipients r ON r.campaign_id = c.id
        GROUP BY c.id, u.full_name, m.from_email
        ORDER BY c.created_at DESC`,
    );
    const serializable = JSON.parse(JSON.stringify(rows)) as SerializableRecord[];
    return serializable.map(normaliseCampaign);
  });

export const getCampaignWorkspace = createServerFn({ method: "GET" })
  .middleware([permissionMiddleware("campaigns.manage")])
  .validator((data: { campaignId: string }) => data)
  .handler(async ({ data, context }) => {
    const { getPool } = await import("./db.server");
    const db = getPool();
    const [campaignRows, stepRows, recipientRows, contactRows, eventRows, mailboxRows, userRows] =
      await Promise.all([
        db.execute(
          `SELECT c.*, owner.full_name AS owner_name, approver.full_name AS approver_name
             FROM campaigns c
             LEFT JOIN system_users owner ON owner.id = c.owner_id
             LEFT JOIN system_users approver ON approver.id = c.approved_by
            WHERE c.id = ? LIMIT 1`,
          [data.campaignId],
        ),
        db.execute(`SELECT * FROM campaign_steps WHERE campaign_id = ? ORDER BY step_order ASC`, [
          data.campaignId,
        ]),
        db.execute(
          `SELECT r.*, p.company, p.category_id,
                  COALESCE(pc.first_name, p.first_name) AS first_name,
                  COALESCE(pc.last_name, p.last_name) AS last_name,
                  COALESCE(pc.email, p.email) AS email,
                  COALESCE(pc.phone, p.phone) AS phone,
                  COALESCE(pc.job_title, p.job_title) AS job_title,
                  pc.location AS contact_location,
                  pc.location_source_url AS contact_location_source_url,
                  pc.location_is_inferred,
                  (SELECT CONCAT_WS(', ', NULLIF(l.address_line, ''), NULLIF(l.city, ''),
                                    NULLIF(l.region, ''), NULLIF(l.country, ''))
                     FROM organization_locations l
                    WHERE l.entity_type = 'prospect' AND l.entity_id = p.id
                    ORDER BY l.is_primary DESC, l.created_at ASC LIMIT 1) AS company_location,
                  (SELECT l.source_url
                     FROM organization_locations l
                    WHERE l.entity_type = 'prospect' AND l.entity_id = p.id
                    ORDER BY l.is_primary DESC, l.created_at ASC LIMIT 1) AS company_location_source_url,
                  (SELECT GROUP_CONCAT(
                            CONCAT(l.name, ': ', CONCAT_WS(', ', NULLIF(l.address_line, ''),
                                   NULLIF(l.city, ''), NULLIF(l.region, ''), NULLIF(l.country, '')))
                            ORDER BY l.is_primary DESC, l.name ASC SEPARATOR ' | ')
                     FROM organization_locations l
                    WHERE l.entity_type = 'prospect' AND l.entity_id = p.id) AS company_locations,
                  cat.name AS category_name
             FROM campaign_recipients r
             JOIN prospects p ON p.id = r.prospect_id
             LEFT JOIN prospect_contacts pc ON pc.id = r.contact_id
             LEFT JOIN prospect_categories cat ON cat.id = p.category_id
            WHERE r.campaign_id = ? ORDER BY r.created_at DESC`,
          [data.campaignId],
        ),
        db.execute(
          `SELECT pc.id, pc.prospect_id, pc.first_name, pc.last_name, pc.email, pc.phone,
                  pc.job_title, pc.location AS contact_location,
                  pc.location_source_url AS contact_location_source_url,
                  pc.location_is_inferred,
                  pc.is_primary, p.company, p.category_id, cat.name AS category_name,
                  (SELECT CONCAT_WS(', ', NULLIF(l.address_line, ''), NULLIF(l.city, ''),
                                    NULLIF(l.region, ''), NULLIF(l.country, ''))
                     FROM organization_locations l
                    WHERE l.entity_type = 'prospect' AND l.entity_id = p.id
                    ORDER BY l.is_primary DESC, l.created_at ASC LIMIT 1) AS company_location,
                  (SELECT l.source_url
                     FROM organization_locations l
                    WHERE l.entity_type = 'prospect' AND l.entity_id = p.id
                    ORDER BY l.is_primary DESC, l.created_at ASC LIMIT 1) AS company_location_source_url,
                  (SELECT GROUP_CONCAT(
                            CONCAT(l.name, ': ', CONCAT_WS(', ', NULLIF(l.address_line, ''),
                                   NULLIF(l.city, ''), NULLIF(l.region, ''), NULLIF(l.country, '')))
                            ORDER BY l.is_primary DESC, l.name ASC SEPARATOR ' | ')
                     FROM organization_locations l
                    WHERE l.entity_type = 'prospect' AND l.entity_id = p.id) AS company_locations,
                  CASE WHEN s.id IS NULL THEN 0 ELSE 1 END AS suppressed,
                  s.reason AS suppression_reason,
                  CASE WHEN r.id IS NULL THEN 0 ELSE 1 END AS selected
             FROM prospect_contacts pc
             JOIN prospects p ON p.id = pc.prospect_id
             LEFT JOIN prospect_categories cat ON cat.id = p.category_id
             LEFT JOIN email_suppressions s ON LOWER(s.email) = LOWER(pc.email)
             LEFT JOIN campaign_recipients r ON r.campaign_id = ? AND r.contact_id = pc.id
            WHERE pc.email IS NOT NULL AND pc.email <> ''
            ORDER BY p.company ASC, pc.is_primary DESC, pc.first_name ASC`,
          [data.campaignId],
        ),
        db.execute(
          `SELECT e.*, u.full_name AS actor_name FROM campaign_events e
             LEFT JOIN system_users u ON u.id = e.actor_id
            WHERE e.campaign_id = ? ORDER BY e.created_at DESC LIMIT 100`,
          [data.campaignId],
        ),
        db.execute(
          `SELECT m.id, m.name, m.from_email, m.from_name, m.provider, ma.is_default, m.last_status
             FROM mailboxes m JOIN mailbox_access ma ON ma.mailbox_id = m.id
            WHERE ma.user_id = ? AND ma.can_send = TRUE ORDER BY ma.is_default DESC, m.name ASC`,
          [context.user.id],
        ),
        db.execute(
          `SELECT id, full_name, email FROM system_users WHERE status = 'active' ORDER BY full_name`,
        ),
      ]);
    const campaign = (JSON.parse(JSON.stringify(campaignRows[0])) as SerializableRecord[])[0];
    if (!campaign) throw new Error("Campaign not found");
    return JSON.parse(
      JSON.stringify({
        campaign: normaliseCampaign(campaign),
        steps: stepRows[0],
        recipients: recipientRows[0],
        contacts: contactRows[0],
        events: eventRows[0],
        mailboxes: mailboxRows[0],
        users: userRows[0],
        currentUser: { id: context.user.id, permissions: context.user.permissions },
      }),
    ) as {
      campaign: SerializableRecord;
      steps: SerializableRecord[];
      recipients: SerializableRecord[];
      contacts: SerializableRecord[];
      events: SerializableRecord[];
      mailboxes: SerializableRecord[];
      users: SerializableRecord[];
      currentUser: { id: string; permissions: string[] };
    };
  });

export const createCampaign = createServerFn({ method: "POST" })
  .middleware([permissionMiddleware("campaigns.manage")])
  .validator(
    (data: {
      name: string;
      campaignType: string;
      objective?: string;
      approvalRequired?: boolean;
    }) => data,
  )
  .handler(async ({ data, context }) => {
    const { getPool } = await import("./db.server");
    const campaignId = randomUUID();
    const stepId = randomUUID();
    const name = data.name.trim() || "Untitled campaign";
    await getPool().execute(
      `INSERT INTO campaigns
        (id, name, subject, body_html, cc, bcc, attachments, campaign_type, objective,
         owner_id, approval_required, audience_rules)
       VALUES (?, ?, '', '', '[]', '[]', '[]', ?, ?, ?, ?, '{}')`,
      [
        campaignId,
        name,
        data.campaignType || "outreach",
        data.objective?.trim() || null,
        context.user.id,
        data.approvalRequired === false ? 0 : 1,
      ],
    );
    await getPool().execute(
      `INSERT INTO campaign_steps
        (id, campaign_id, step_order, step_type, name, delay_amount, delay_unit, subject, body_html)
       VALUES (?, ?, 1, 'email', 'Introduction email', 0, 'days', '', '')`,
      [stepId, campaignId],
    );
    await event(campaignId, "campaign.created", context.user.id, name);
    return { campaignId };
  });

export const deleteCampaign = createServerFn({ method: "POST" })
  .middleware([permissionMiddleware("campaigns.manage")])
  .validator((data: { campaignId: string }) => data)
  .handler(async ({ data }) => {
    const { getPool } = await import("./db.server");
    const [result] = await getPool().execute(
      "DELETE FROM campaigns WHERE id = ? AND status IN ('draft','in_review','approved')",
      [data.campaignId],
    );
    if (!(result as { affectedRows: number }).affectedRows)
      throw new Error("Only campaigns that have not started can be deleted.");
    return { ok: true };
  });

export const updateCampaign = createServerFn({ method: "POST" })
  .middleware([permissionMiddleware("campaigns.manage")])
  .validator((data: CampaignPatch) => data)
  .handler(async ({ data, context }) => {
    const { getPool } = await import("./db.server");
    if (data.mailboxId) {
      const { requireMailboxAccess } = await import("./email-identity.server");
      await requireMailboxAccess(getPool(), data.mailboxId, context.user);
      const ownerId = data.ownerId || context.user.id;
      if (ownerId !== context.user.id) {
        const [ownerAccess] = await getPool().execute(
          "SELECT mailbox_id FROM mailbox_access WHERE mailbox_id = ? AND user_id = ? AND can_send = TRUE LIMIT 1",
          [data.mailboxId, ownerId],
        );
        if (!(ownerAccess as Array<{ mailbox_id: string }>)[0])
          throw new Error("Grant the campaign owner sending access to this account first.");
      }
    }
    const editable = await getPool().execute(
      `UPDATE campaigns SET name = ?, campaign_type = ?, objective = ?, mailbox_id = ?,
              owner_id = ?, daily_limit = ?, timezone = ?, approval_required = ?,
              stop_on_reply = ?, stop_on_bounce = ?, track_opens = ?, track_clicks = ?,
              cc = ?, bcc = ?, attachments = ?,
              approved_by = IF(status = 'in_review', NULL, approved_by),
              approved_at = IF(status = 'in_review', NULL, approved_at),
              status = IF(status = 'in_review', 'draft', status)
        WHERE id = ? AND status IN ('draft','in_review','approved','paused')`,
      [
        data.name.trim(),
        data.campaignType,
        data.objective.trim() || null,
        data.mailboxId || null,
        data.ownerId || context.user.id,
        Math.max(1, Math.min(5000, Number(data.dailyLimit) || 100)),
        data.timezone || "Africa/Blantyre",
        data.approvalRequired ? 1 : 0,
        data.stopOnReply ? 1 : 0,
        data.stopOnBounce ? 1 : 0,
        data.trackOpens ? 1 : 0,
        data.trackClicks ? 1 : 0,
        JSON.stringify(data.cc || []),
        JSON.stringify(data.bcc || []),
        JSON.stringify(data.attachments || []),
        data.campaignId,
      ],
    );
    if (!(editable[0] as { affectedRows: number }).affectedRows)
      throw new Error("A running or completed campaign cannot be edited.");
    await event(data.campaignId, "campaign.updated", context.user.id);
    return { ok: true };
  });

export const saveCampaignSequence = createServerFn({ method: "POST" })
  .middleware([permissionMiddleware("campaigns.manage")])
  .validator((data: { campaignId: string; steps: CampaignStepInput[] }) => data)
  .handler(async ({ data, context }) => {
    if (!data.steps.length) throw new Error("Add at least one campaign step.");
    if (data.steps.length > 20) throw new Error("A campaign can have at most 20 steps.");
    const { getPool } = await import("./db.server");
    const db = getPool();
    const [campaignRows] = await db.execute("SELECT status FROM campaigns WHERE id = ? LIMIT 1", [
      data.campaignId,
    ]);
    const status = (campaignRows as Array<{ status: string }>)[0]?.status;
    if (!status) throw new Error("Campaign not found.");
    if (!["draft", "in_review", "approved"].includes(status))
      throw new Error("Pause or duplicate this campaign before changing its sequence.");
    const connection = await db.getConnection();
    try {
      await connection.beginTransaction();
      await connection.execute("DELETE FROM campaign_steps WHERE campaign_id = ?", [
        data.campaignId,
      ]);
      for (const [index, step] of data.steps.entries()) {
        if (step.stepType === "email" && (!step.subject.trim() || !step.bodyHtml.trim()))
          throw new Error(`Email step ${index + 1} needs a subject and message.`);
        if (step.stepType === "task" && !step.taskInstructions.trim())
          throw new Error(`Task step ${index + 1} needs instructions.`);
        await connection.execute(
          `INSERT INTO campaign_steps
            (id, campaign_id, step_order, step_type, name, delay_amount, delay_unit,
             subject, body_html, attachments, task_instructions, is_active)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, TRUE)`,
          [
            step.id || randomUUID(),
            data.campaignId,
            index + 1,
            step.stepType,
            step.name.trim() || `Step ${index + 1}`,
            Math.max(0, Number(step.delayAmount) || 0),
            step.delayUnit,
            step.stepType === "email" ? step.subject : null,
            step.stepType === "email" ? sanitiseEmailHtml(step.bodyHtml) : null,
            step.stepType === "email" ? JSON.stringify(step.attachments || []) : null,
            step.stepType === "task" ? step.taskInstructions : null,
          ],
        );
      }
      await connection.execute(
        `UPDATE campaigns SET status = IF(status = 'in_review', 'draft', status),
          approved_by = NULL, approved_at = NULL WHERE id = ?`,
        [data.campaignId],
      );
      await connection.commit();
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
    await event(data.campaignId, "sequence.updated", context.user.id, `${data.steps.length} steps`);
    return { ok: true };
  });

export const addCampaignAudience = createServerFn({ method: "POST" })
  .middleware([permissionMiddleware("campaigns.manage")])
  .validator((data: { campaignId: string; contactIds: string[] }) => data)
  .handler(async ({ data, context }) => {
    const contactIds = [...new Set(data.contactIds)].slice(0, 5000);
    if (!contactIds.length) throw new Error("Select at least one contact person.");
    const { getPool } = await import("./db.server");
    const db = getPool();
    const placeholders = contactIds.map(() => "?").join(",");
    const [contacts] = await db.execute(
      `SELECT pc.id, pc.prospect_id, pc.email
         FROM prospect_contacts pc
         LEFT JOIN email_suppressions s ON LOWER(s.email) = LOWER(pc.email)
        WHERE pc.id IN (${placeholders}) AND pc.email IS NOT NULL AND pc.email <> '' AND s.id IS NULL`,
      contactIds,
    );
    let added = 0;
    for (const contact of contacts as Array<{ id: string; prospect_id: string }>) {
      const [result] = await db.execute(
        `INSERT IGNORE INTO campaign_recipients
          (id, campaign_id, prospect_id, contact_id, status, current_step)
         VALUES (?, ?, ?, ?, 'pending', 1)`,
        [randomUUID(), data.campaignId, contact.prospect_id, contact.id],
      );
      added += (result as { affectedRows: number }).affectedRows;
    }
    await event(data.campaignId, "audience.added", context.user.id, `${added} contacts`);
    return { added, skipped: contactIds.length - added };
  });

export const removeCampaignRecipient = createServerFn({ method: "POST" })
  .middleware([permissionMiddleware("campaigns.manage")])
  .validator((data: { campaignId: string; recipientId: string }) => data)
  .handler(async ({ data, context }) => {
    const { getPool } = await import("./db.server");
    const [result] = await getPool().execute(
      `DELETE r FROM campaign_recipients r JOIN campaigns c ON c.id = r.campaign_id
        WHERE r.id = ? AND r.campaign_id = ? AND c.status IN ('draft','in_review','approved')`,
      [data.recipientId, data.campaignId],
    );
    if (!(result as { affectedRows: number }).affectedRows)
      throw new Error("Recipients cannot be removed after a campaign starts.");
    await event(data.campaignId, "audience.removed", context.user.id);
    return { ok: true };
  });

async function validateReady(campaignId: string, user?: { id: string; roleName: string | null }) {
  const { getPool } = await import("./db.server");
  const [rows] = await getPool().execute(
    `SELECT c.mailbox_id,
            (SELECT COUNT(*) FROM campaign_steps s WHERE s.campaign_id = c.id AND s.is_active = TRUE) steps,
            (SELECT COUNT(*) FROM campaign_steps s WHERE s.campaign_id = c.id AND s.is_active = TRUE
              AND ((s.step_type = 'email' AND (COALESCE(TRIM(s.subject), '') = '' OR COALESCE(TRIM(s.body_html), '') = ''))
                OR (s.step_type = 'task' AND COALESCE(TRIM(s.task_instructions), '') = ''))) invalid_steps,
            (SELECT COUNT(*) FROM campaign_recipients r WHERE r.campaign_id = c.id) recipients
       FROM campaigns c WHERE c.id = ? LIMIT 1`,
    [campaignId],
  );
  const ready = (
    rows as Array<{
      mailbox_id: string | null;
      steps: number;
      invalid_steps: number;
      recipients: number;
    }>
  )[0];
  if (!ready) throw new Error("Campaign not found.");
  if (!ready.mailbox_id) throw new Error("Choose a sending account first.");
  if (user) {
    const { requireMailboxAccess } = await import("./email-identity.server");
    await requireMailboxAccess(getPool(), ready.mailbox_id, user);
  }
  if (!Number(ready.steps)) throw new Error("Add at least one sequence step.");
  if (Number(ready.invalid_steps))
    throw new Error(
      "Complete the subject and message for every email, and instructions for every task.",
    );
  if (!Number(ready.recipients)) throw new Error("Add at least one eligible contact person.");
}

export const changeCampaignStatus = createServerFn({ method: "POST" })
  .middleware([permissionMiddleware("campaigns.manage")])
  .validator(
    (data: {
      campaignId: string;
      action: "submit" | "approve" | "start" | "schedule" | "pause" | "resume";
      scheduledAt?: string;
    }) => data,
  )
  .handler(async ({ data, context }) => {
    const { getPool } = await import("./db.server");
    const db = getPool();
    const [rows] = await db.execute(
      "SELECT status, approval_required, approved_at FROM campaigns WHERE id = ? LIMIT 1",
      [data.campaignId],
    );
    const campaign = (
      rows as Array<{
        status: string;
        approval_required: number;
        approved_at: string | null;
      }>
    )[0];
    if (!campaign) throw new Error("Campaign not found.");

    if (data.action === "submit") {
      await validateReady(data.campaignId, context.user);
      const next = campaign.approval_required ? "in_review" : "approved";
      await db.execute(
        `UPDATE campaigns SET status = ?, approved_by = ?, approved_at = ? WHERE id = ? AND status = 'draft'`,
        [
          next,
          next === "approved" ? context.user.id : null,
          next === "approved" ? new Date() : null,
          data.campaignId,
        ],
      );
    } else if (data.action === "approve") {
      if (!context.user.permissions.includes("campaigns.approve"))
        throw new Error("You do not have permission to approve campaigns.");
      await db.execute(
        `UPDATE campaigns SET status = 'approved', approved_by = ?, approved_at = CURRENT_TIMESTAMP(3)
          WHERE id = ? AND status = 'in_review'`,
        [context.user.id, data.campaignId],
      );
    } else if (data.action === "pause") {
      await db.execute(
        "UPDATE campaigns SET status = 'paused' WHERE id = ? AND status = 'running'",
        [data.campaignId],
      );
    } else if (data.action === "resume") {
      await db.execute(
        "UPDATE campaigns SET status = 'running' WHERE id = ? AND status = 'paused'",
        [data.campaignId],
      );
    } else {
      await validateReady(data.campaignId, context.user);
      if (campaign.approval_required && !campaign.approved_at)
        throw new Error("This campaign must be approved before it can start.");
      const scheduled =
        data.action === "schedule" && data.scheduledAt ? new Date(data.scheduledAt) : new Date();
      if (Number.isNaN(scheduled.getTime())) throw new Error("Choose a valid schedule date.");
      const nextStatus = scheduled.getTime() > Date.now() + 30_000 ? "scheduled" : "running";
      await db.execute(
        `UPDATE campaigns SET status = ?, scheduled_at = ?, sent_at = COALESCE(sent_at, ?)
          WHERE id = ? AND status IN ('approved','scheduled')`,
        [nextStatus, scheduled, nextStatus === "running" ? new Date() : null, data.campaignId],
      );
      await db.execute(
        `UPDATE campaign_recipients SET status = 'pending', current_step = 1,
          next_action_at = ?, stopped_reason = NULL
          WHERE campaign_id = ? AND status IN ('pending','failed')`,
        [scheduled, data.campaignId],
      );
    }
    await event(data.campaignId, `campaign.${data.action}`, context.user.id, data.scheduledAt);
    if (data.action === "start") {
      const { processCampaignQueue } = await import("./campaigns.server");
      await processCampaignQueue({ campaignId: data.campaignId, maxActions: 5 });
    }
    return { ok: true };
  });

export const runCampaignQueue = createServerFn({ method: "POST" })
  .middleware([permissionMiddleware("campaigns.manage")])
  .validator((data: { campaignId?: string }) => data)
  .handler(async ({ data }) => {
    const { processCampaignQueue } = await import("./campaigns.server");
    return processCampaignQueue(data.campaignId ? { campaignId: data.campaignId } : {});
  });

export const suppressEmail = createServerFn({ method: "POST" })
  .middleware([permissionMiddleware("campaigns.manage")])
  .validator((data: { campaignId: string; email: string; reason: string }) => data)
  .handler(async ({ data, context }) => {
    const email = data.email.trim().toLowerCase();
    if (!email) throw new Error("Email address is required.");
    const { getPool } = await import("./db.server");
    await getPool().execute(
      `INSERT INTO email_suppressions (id, email, reason, source, campaign_id)
       VALUES (?, ?, ?, 'campaign', ?)
       ON DUPLICATE KEY UPDATE reason = VALUES(reason), campaign_id = VALUES(campaign_id)`,
      [randomUUID(), email, data.reason || "manual", data.campaignId],
    );
    await getPool().execute(
      `UPDATE campaign_recipients SET status = 'stopped', stopped_reason = ?
        WHERE campaign_id = ? AND contact_id IN
          (SELECT id FROM prospect_contacts WHERE LOWER(email) = LOWER(?))`,
      [data.reason || "suppressed", data.campaignId, email],
    );
    await event(data.campaignId, "recipient.suppressed", context.user.id, email);
    return { ok: true };
  });
