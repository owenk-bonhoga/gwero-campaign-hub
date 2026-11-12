import { createServerFn } from "@tanstack/react-start";
import { permissionMiddleware } from "./auth.middleware";
import { requireMailboxAccess } from "./email-identity.server";

type MeetingInput = {
  id?: string;
  title: string;
  description?: string;
  startsAt: string;
  endsAt: string;
  timezone?: string;
  provider: "gwero" | "google_meet" | "microsoft_teams" | "zoom" | "custom";
  mailboxId?: string;
  joinUrl?: string;
  location?: string;
  attendees?: string[];
};

const permission = permissionMiddleware("campaigns.manage");
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

async function db() {
  return (await import("./db.server")).getPool();
}

function cleanUrl(value?: string) {
  if (!value) return "";
  try {
    const url = new URL(value);
    return url.protocol === "https:" ? url.toString() : "";
  } catch {
    return "";
  }
}

export const listMeetings = createServerFn({ method: "GET" })
  .middleware([permission])
  .handler(async ({ context }) => {
    const pool = await db();
    const [rows] = await pool.execute(
      `SELECT DISTINCT m.*, u.full_name AS organiser_name
         FROM meetings m
         JOIN system_users u ON u.id = m.created_by
         LEFT JOIN meeting_attendees ma ON ma.meeting_id = m.id AND ma.user_id = ?
        WHERE m.created_by = ? OR ma.user_id = ?
        ORDER BY m.starts_at`,
      [context.user.id, context.user.id, context.user.id],
    );
    return JSON.parse(JSON.stringify(rows));
  });

export const getMeeting = createServerFn({ method: "GET" })
  .middleware([permission])
  .validator((data: { id: string }) => data)
  .handler(async ({ data, context }) => {
    const pool = await db();
    const [rows] = await pool.execute(
      `SELECT DISTINCT m.*, u.full_name AS organiser_name
         FROM meetings m
         JOIN system_users u ON u.id = m.created_by
         LEFT JOIN meeting_attendees ma ON ma.meeting_id = m.id AND ma.user_id = ?
        WHERE m.id = ? AND (m.created_by = ? OR ma.user_id = ?) LIMIT 1`,
      [context.user.id, data.id, context.user.id, context.user.id],
    );
    const meeting = (rows as Array<Record<string, unknown>>)[0];
    if (!meeting) throw new Error("Meeting not found.");
    return JSON.parse(JSON.stringify(meeting));
  });

export const saveMeeting = createServerFn({ method: "POST" })
  .middleware([permission])
  .validator((data: MeetingInput) => data)
  .handler(async ({ data, context }) => {
    const pool = await db();
    const title = data.title.trim();
    const start = new Date(data.startsAt);
    const end = new Date(data.endsAt);
    if (!title) throw new Error("Meeting title is required.");
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end <= start)
      throw new Error("The meeting end time must be after its start time.");
    const id = data.id || crypto.randomUUID();
    if (data.id) {
      const [owned] = await pool.execute(
        "SELECT id FROM meetings WHERE id = ? AND created_by = ? LIMIT 1",
        [id, context.user.id],
      );
      if (!(owned as Array<{ id: string }>)[0]) throw new Error("You cannot edit this meeting.");
    }

    let joinUrl = cleanUrl(data.joinUrl);
    let embedUrl: string | null = null;
    if (data.provider === "gwero") {
      joinUrl = `https://meet.jit.si/gwero-${id.replace(/-/g, "")}`;
      embedUrl = joinUrl;
    } else if (data.provider === "google_meet" || data.provider === "microsoft_teams") {
      if (!data.mailboxId) throw new Error("Choose a connected email account for this provider.");
      const mailbox = await requireMailboxAccess(pool, data.mailboxId, context.user);
      const expected = data.provider === "google_meet" ? "gmail" : "outlook";
      if (mailbox["provider"] !== expected)
        throw new Error(`Choose a ${expected === "gmail" ? "Google" : "Microsoft"} account.`);
      const [secretRows] = await pool.execute(
        "SELECT * FROM mailbox_secrets WHERE mailbox_id = ? LIMIT 1",
        [data.mailboxId],
      );
      const secret = (
        secretRows as Array<{
          mailbox_id: string;
          oauth_access_token?: string | null;
          oauth_refresh_token?: string | null;
          oauth_expires_at?: string | null;
        }>
      )[0];
      if (!secret) throw new Error("Reconnect this account before creating a meeting.");
      const { gatewayFetch } = await import("./crm.functions");
      if (data.provider === "google_meet") {
        const response = await gatewayFetch(
          "google",
          secret,
          "https://meet.googleapis.com/v2/spaces",
          { method: "POST", headers: { "content-type": "application/json" }, body: "{}" },
        );
        if (!response.ok)
          throw new Error(
            "Google Meet could not create the room. Reconnect Google to approve the meeting permission.",
          );
        const room = (await response.json()) as { meetingUri?: string };
        joinUrl = cleanUrl(room.meetingUri);
      } else {
        const response = await gatewayFetch("outlook", secret, "/me/onlineMeetings", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            subject: title,
            startDateTime: start.toISOString(),
            endDateTime: end.toISOString(),
          }),
        });
        if (!response.ok)
          throw new Error(
            "Microsoft Teams could not create the room. Reconnect Microsoft to approve online meetings.",
          );
        const room = (await response.json()) as { joinWebUrl?: string };
        joinUrl = cleanUrl(room.joinWebUrl);
      }
    }
    if (!joinUrl) throw new Error("Add a secure meeting link.");

    const attendees = [
      ...new Set((data.attendees || []).map((value) => value.trim().toLowerCase())),
    ]
      .filter((value) => emailPattern.test(value))
      .slice(0, 100);
    await pool.execute(
      `INSERT INTO meetings
        (id, title, description, starts_at, ends_at, timezone, provider, join_url, embed_url,
         location, attendee_emails, status, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'scheduled', ?)
       ON DUPLICATE KEY UPDATE title = VALUES(title), description = VALUES(description),
         starts_at = VALUES(starts_at), ends_at = VALUES(ends_at), timezone = VALUES(timezone),
         provider = VALUES(provider), join_url = VALUES(join_url), embed_url = VALUES(embed_url),
         location = VALUES(location), attendee_emails = VALUES(attendee_emails)`,
      [
        id,
        title,
        data.description?.trim() || null,
        start,
        end,
        data.timezone || "Africa/Blantyre",
        data.provider,
        joinUrl,
        embedUrl,
        data.location?.trim() || null,
        JSON.stringify(attendees),
        context.user.id,
      ],
    );
    await pool.execute("DELETE FROM meeting_attendees WHERE meeting_id = ?", [id]);
    if (attendees.length) {
      const placeholders = attendees.map(() => "?").join(",");
      const [users] = await pool.execute(
        `SELECT id FROM system_users WHERE status = 'active' AND LOWER(email) IN (${placeholders})`,
        attendees,
      );
      for (const user of users as Array<{ id: string }>)
        await pool.execute(
          "INSERT IGNORE INTO meeting_attendees (meeting_id, user_id) VALUES (?, ?)",
          [id, user.id],
        );
    }
    return { id, joinUrl };
  });

export const cancelMeeting = createServerFn({ method: "POST" })
  .middleware([permission])
  .validator((data: { id: string }) => data)
  .handler(async ({ data, context }) => {
    const pool = await db();
    const [result] = await pool.execute(
      "UPDATE meetings SET status = 'cancelled' WHERE id = ? AND created_by = ?",
      [data.id, context.user.id],
    );
    if (!(result as { affectedRows: number }).affectedRows)
      throw new Error("You cannot cancel this meeting.");
    return { ok: true };
  });
