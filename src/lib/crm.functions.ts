import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { personalize, htmlToText } from "./personalize";
import { permissionMiddleware } from "./auth.middleware";

type Json = Record<string, unknown>;

function appOrigin() {
  const request = getRequest();
  const url = new URL(request!.url);
  const forwarded = url.hostname === "localhost" ? request!.headers.get("x-forwarded-host") : null;
  return forwarded ? `https://${forwarded}` : url.origin;
}

async function admin() {
  const { serverDb } = await import("./db.server");
  return serverDb;
}

export async function gatewayFetch(
  provider: string,
  secret: {
    mailbox_id: string;
    oauth_access_token?: string | null;
    oauth_refresh_token?: string | null;
    oauth_expires_at?: string | null;
  },
  path: string,
  init?: RequestInit,
): Promise<Response> {
  let accessToken = secret.oauth_access_token;
  if (!accessToken) throw new Error("Reconnect this OAuth mailbox from Sending accounts.");
  if (
    secret.oauth_refresh_token &&
    (!secret.oauth_expires_at || new Date(secret.oauth_expires_at).getTime() < Date.now() + 60_000)
  ) {
    const google = provider === "gmail" || provider === "google";
    const { getSecret } = await import("./settings.server");
    const clientId = await getSecret(
      google ? "google_oauth_client_id" : "microsoft_oauth_client_id",
    );
    const clientSecret = await getSecret(
      google ? "google_oauth_client_secret" : "microsoft_oauth_client_secret",
    );
    if (!clientId || !clientSecret) throw new Error("OAuth server credentials are missing.");
    const tokenUrl = google
      ? "https://oauth2.googleapis.com/token"
      : "https://login.microsoftonline.com/common/oauth2/v2.0/token";
    const body = new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: secret.oauth_refresh_token,
      grant_type: "refresh_token",
    });
    if (!google)
      body.set(
        "scope",
        "openid email profile offline_access User.Read Mail.Read Mail.Send OnlineMeetings.ReadWrite",
      );
    const refreshed = await fetch(tokenUrl, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body,
    });
    if (!refreshed.ok) throw new Error("OAuth session expired. Reconnect this mailbox.");
    const tokens = (await refreshed.json()) as {
      access_token: string;
      refresh_token?: string;
      expires_in?: number;
    };
    accessToken = tokens.access_token;
    const db = await admin();
    await db
      .from("mailbox_secrets")
      .update({
        oauth_access_token: accessToken,
        oauth_refresh_token: tokens.refresh_token || secret.oauth_refresh_token,
        oauth_expires_at: new Date(Date.now() + (tokens.expires_in || 3600) * 1000).toISOString(),
      } as never)
      .eq("mailbox_id", secret.mailbox_id);
  }
  const base =
    provider === "gmail" || provider === "google"
      ? "https://gmail.googleapis.com"
      : "https://graph.microsoft.com/v1.0";
  const headers = new Headers(init?.headers);
  headers.set("authorization", `Bearer ${accessToken}`);
  const absolute = /^https:\/\//i.test(path);
  if (absolute) {
    const target = new URL(path);
    const allowed =
      (provider === "google" || provider === "gmail") && target.hostname === "meet.googleapis.com";
    if (!allowed) throw new Error("Unsupported OAuth service endpoint.");
  }
  return fetch(absolute ? path : `${base}${path}`, { ...init, headers });
}

/* ------------------------------------------------------------------ */
/* Mailbox credentials                                                 */
/* ------------------------------------------------------------------ */

export const saveMailboxCredentials = createServerFn({ method: "POST" })
  .middleware([permissionMiddleware("campaigns.manage")])
  .validator((data: { mailboxId: string; smtpPassword?: string; imapPassword?: string }) => data)
  .handler(async ({ data, context }) => {
    const { getPool } = await import("./db.server");
    const { requireMailboxAccess } = await import("./email-identity.server");
    await requireMailboxAccess(getPool(), data.mailboxId, context.user, true);
    const db = await admin();
    const patch: Json = { mailbox_id: data.mailboxId, updated_at: new Date().toISOString() };
    if (data.smtpPassword) patch["smtp_password"] = data.smtpPassword;
    if (data.imapPassword) patch["imap_password"] = data.imapPassword;
    const { error } = await db
      .from("mailbox_secrets")
      .upsert(patch as never, { onConflict: "mailbox_id" });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const testMailbox = createServerFn({ method: "POST" })
  .middleware([permissionMiddleware("campaigns.manage")])
  .validator((data: { mailboxId: string }) => data)
  .handler(async ({ data, context }) => {
    const { getPool } = await import("./db.server");
    const { requireMailboxAccess } = await import("./email-identity.server");
    await requireMailboxAccess(getPool(), data.mailboxId, context.user);
    const db = await admin();
    const { data: mailbox, error } = await db
      .from("mailboxes")
      .select("*")
      .eq("id", data.mailboxId)
      .single();
    if (error || !mailbox) throw new Error("Mailbox not found");

    const results: string[] = [];
    if (mailbox.provider === "smtp") {
      const { data: secret } = await db
        .from("mailbox_secrets")
        .select("*")
        .eq("mailbox_id", mailbox.id)
        .maybeSingle();
      const { smtpVerify } = await import("./smtp.server");
      await smtpVerify({
        host: mailbox.smtp_host ?? "",
        port: mailbox.smtp_port ?? 587,
        secure: mailbox.smtp_secure,
        username: mailbox.smtp_username ?? "",
        password: secret?.smtp_password ?? "",
      });
      results.push("Sending (SMTP) works");
      if (mailbox.imap_host) {
        const { imapVerify } = await import("./imap.server");
        await imapVerify({
          host: mailbox.imap_host,
          port: mailbox.imap_port ?? 993,
          username: mailbox.imap_username ?? mailbox.smtp_username ?? "",
          password: secret?.imap_password ?? secret?.smtp_password ?? "",
        });
        results.push("Inbox (IMAP) works");
      }
    } else {
      const { data: secret } = await db
        .from("mailbox_secrets")
        .select("*")
        .eq("mailbox_id", mailbox.id)
        .maybeSingle();
      if (!secret) throw new Error("OAuth credentials not found. Reconnect this account.");
      const path =
        mailbox.provider === "google" || mailbox.provider === "gmail"
          ? "/gmail/v1/users/me/profile"
          : "/me";
      const response = await gatewayFetch(mailbox.provider, secret, path);
      if (!response.ok) throw new Error("Connected account check failed.");
      results.push("OAuth connection works");
    }

    await db
      .from("mailboxes")
      .update({ last_status: results.join(" · ") })
      .eq("id", mailbox.id);
    return { ok: true, message: results.join(" · ") };
  });

/* ------------------------------------------------------------------ */
/* Sending a campaign                                                  */
/* ------------------------------------------------------------------ */

function trackHtml(
  html: string,
  recipientId: string,
  origin: string,
  opens: boolean,
  clicks: boolean,
) {
  let out = html;
  if (clicks) {
    out = out.replace(/href="(https?:\/\/[^"]+)"/gi, (_m, url: string) => {
      return `href="${origin}/api/public/t/click?r=${recipientId}&u=${encodeURIComponent(url)}"`;
    });
  }
  if (opens) {
    out += `<img src="${origin}/api/public/t/open?r=${recipientId}" width="1" height="1" alt="" style="display:none" />`;
  }
  return out;
}

export const sendCampaign = createServerFn({ method: "POST" })
  .middleware([permissionMiddleware("campaigns.manage")])
  .validator((data: { campaignId: string }) => data)
  .handler(async ({ data, context }) => {
    const db = await admin();
    const origin = appOrigin();

    const { data: campaign, error: cErr } = await db
      .from("campaigns")
      .select("*")
      .eq("id", data.campaignId)
      .single();
    if (cErr || !campaign) throw new Error("Campaign not found");
    if (!campaign.mailbox_id) throw new Error("Pick a sending account for this campaign first.");
    const { getPool } = await import("./db.server");
    const { requireMailboxAccess } = await import("./email-identity.server");
    await requireMailboxAccess(getPool(), campaign.mailbox_id, context.user);

    const { data: mailbox } = await db
      .from("mailboxes")
      .select("*")
      .eq("id", campaign.mailbox_id)
      .single();
    if (!mailbox) throw new Error("Sending account not found");

    const { data: secret } = await db
      .from("mailbox_secrets")
      .select("*")
      .eq("mailbox_id", mailbox.id)
      .maybeSingle();

    const { data: recipients } = await db
      .from("campaign_recipients")
      .select("id, prospect_id, status, prospects(*)")
      .eq("campaign_id", campaign.id)
      .in("status", ["pending", "failed"]);

    if (!recipients?.length) throw new Error("No pending recipients in this campaign.");

    // Load attachments once.
    const attachmentList =
      (campaign.attachments as unknown as Array<{
        path: string;
        name: string;
        type?: string;
      }>) ?? [];
    const attachments = [] as Array<{ filename: string; contentType: string; content: Uint8Array }>;
    for (const att of attachmentList) {
      try {
        const { readAttachment } = await import("./attachments.server");
        const file = await readAttachment(att.path);
        attachments.push({
          filename: att.name,
          contentType: att.type || "application/octet-stream",
          content: new Uint8Array(file),
        });
      } catch (error) {
        throw new Error(`Attachment ${att.name} is unavailable: ${String(error)}`);
      }
    }

    await db.from("campaigns").update({ status: "sending" }).eq("id", campaign.id);

    const { buildMime } = await import("./mime.server");
    let sent = 0;
    let failed = 0;

    for (const recipient of recipients) {
      const prospect = recipient.prospects as unknown as Parameters<typeof personalize>[1] & {
        email: string;
      };
      try {
        if (!prospect?.email) throw new Error("Prospect has no email address");
        const subject = personalize(campaign.subject, prospect);
        const { applyActiveEmailSignature } = await import("./email-identity.server");
        const unsignedHtml = personalize(campaign.body_html, prospect);
        const signed = await applyActiveEmailSignature(
          getPool(),
          context.user.id,
          campaign.mailbox_id,
          unsignedHtml,
          htmlToText(unsignedHtml),
        );
        const html = trackHtml(
          signed.html,
          recipient.id,
          origin,
          campaign.track_opens,
          campaign.track_clicks,
        );
        const text = signed.text;
        const messageId = `<${recipient.id}@gwero-crm>`;

        const raw = buildMime({
          from: mailbox.from_email,
          fromName: mailbox.from_name,
          to: prospect.email,
          cc: campaign.cc ?? [],
          subject,
          html,
          text,
          attachments,
          messageId,
        });

        if (mailbox.provider === "smtp") {
          const { smtpSend } = await import("./smtp.server");
          await smtpSend(
            {
              host: mailbox.smtp_host ?? "",
              port: mailbox.smtp_port ?? 587,
              secure: mailbox.smtp_secure,
              username: mailbox.smtp_username ?? "",
              password: secret?.smtp_password ?? "",
            },
            {
              from: mailbox.from_email,
              envelopeFrom: mailbox.from_email,
              to: prospect.email,
              cc: campaign.cc ?? [],
              bcc: campaign.bcc ?? [],
              raw,
            },
          );
        } else if (mailbox.provider === "gmail") {
          const encoded = Buffer.from(raw, "utf8")
            .toString("base64")
            .replace(/\+/g, "-")
            .replace(/\//g, "_")
            .replace(/=+$/, "");
          const res = await gatewayFetch("gmail", secret!, "/gmail/v1/users/me/messages/send", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ raw: encoded }),
          });
          if (!res.ok) throw new Error(await res.text());
        } else {
          const res = await gatewayFetch("outlook", secret!, "/me/sendMail", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              message: {
                subject,
                body: { contentType: "HTML", content: html },
                toRecipients: [{ emailAddress: { address: prospect.email } }],
                ccRecipients: (campaign.cc ?? []).map((a: string) => ({
                  emailAddress: { address: a },
                })),
                bccRecipients: (campaign.bcc ?? []).map((a: string) => ({
                  emailAddress: { address: a },
                })),
                attachments: attachments.map((a) => ({
                  "@odata.type": "#microsoft.graph.fileAttachment",
                  name: a.filename,
                  contentType: a.contentType,
                  contentBytes: Buffer.from(a.content).toString("base64"),
                })),
              },
            }),
          });
          if (!res.ok) throw new Error(await res.text());
        }

        await db
          .from("campaign_recipients")
          .update({
            status: "sent",
            sent_at: new Date().toISOString(),
            error: null,
            message_id: messageId,
          })
          .eq("id", recipient.id);
        await db
          .from("prospects")
          .update({ status: "contacted", updated_at: new Date().toISOString() })
          .eq("id", recipient.prospect_id)
          .eq("status", "new");
        sent++;
      } catch (error) {
        failed++;
        await db
          .from("campaign_recipients")
          .update({ status: "failed", error: String((error as Error).message).slice(0, 500) })
          .eq("id", recipient.id);
      }
    }

    await db
      .from("campaigns")
      .update({ status: "sent", sent_at: new Date().toISOString() })
      .eq("id", campaign.id);

    return { sent, failed };
  });

/* ------------------------------------------------------------------ */
/* Pulling replies back in                                             */
/* ------------------------------------------------------------------ */

function parseAddress(value: string) {
  const match = /<([^>]+)>/.exec(value);
  return (match?.[1] ?? value).trim().toLowerCase();
}

type GooglePayload = {
  mimeType?: string;
  filename?: string;
  body?: { data?: string; attachmentId?: string };
  parts?: GooglePayload[];
};

function decodeGoogleBody(payload?: GooglePayload): string {
  if (!payload) return "";
  const own = payload.body?.data
    ? Buffer.from(payload.body.data.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString(
        "utf8",
      )
    : "";
  if (own && payload.mimeType === "text/plain") return own;
  const parts = payload.parts ?? [];
  const plain = parts.map(decodeGoogleBody).find(Boolean);
  if (plain) return plain;
  return own && payload.mimeType === "text/html" ? htmlToText(own) : "";
}

function decodeGoogleHtml(payload?: GooglePayload): string {
  if (!payload) return "";
  const own = payload.body?.data
    ? Buffer.from(payload.body.data.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString(
        "utf8",
      )
    : "";
  if (own && payload.mimeType === "text/html") return own;
  return (payload.parts ?? []).map(decodeGoogleHtml).find(Boolean) || "";
}

function googleAttachmentParts(payload?: GooglePayload): GooglePayload[] {
  if (!payload) return [];
  return [
    ...(payload.filename && (payload.body?.attachmentId || payload.body?.data) ? [payload] : []),
    ...(payload.parts ?? []).flatMap(googleAttachmentParts),
  ];
}

export const sendProspectEmail = createServerFn({ method: "POST" })
  .middleware([permissionMiddleware("campaigns.manage")])
  .validator(
    (data: {
      prospectId: string;
      contactId: string;
      mailboxId: string;
      subject: string;
      body: string;
      bodyHtml?: string;
      attachments?: Array<{ path: string; name: string; type: string; size: number }>;
    }) => data,
  )
  .handler(async ({ data, context }) => {
    const db = await admin();
    const { data: contact } = await db
      .from("prospect_contacts")
      .select("*")
      .eq("id", data.contactId)
      .eq("prospect_id", data.prospectId)
      .maybeSingle();
    if (!contact?.email) throw new Error("This contact does not have an email address.");
    const { getPool } = await import("./db.server");
    const { requireMailboxAccess, applyActiveEmailSignature } =
      await import("./email-identity.server");
    const mailbox = await requireMailboxAccess(getPool(), data.mailboxId, context.user);
    const { data: secret } = await db
      .from("mailbox_secrets")
      .select("*")
      .eq("mailbox_id", mailbox.id)
      .maybeSingle();
    const subject = data.subject.trim();
    const body = data.body.trim();
    if (!subject || !body) throw new Error("Add both a subject and message.");
    const unsignedHtml =
      data.bodyHtml?.trim() ||
      `<div style="white-space:pre-wrap">${body.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")}</div>`;
    const signed = await applyActiveEmailSignature(
      getPool(),
      context.user.id,
      data.mailboxId,
      unsignedHtml,
      body,
    );
    const html = signed.html;
    const attachmentMeta = data.attachments ?? [];
    const { readAttachment } = await import("./attachments.server");
    const attachments = await Promise.all(
      attachmentMeta.map(async (attachment) => {
        if (!attachment.path.startsWith(`${data.contactId}/`))
          throw new Error("Invalid attachment.");
        return {
          filename: attachment.name,
          contentType: attachment.type || "application/octet-stream",
          content: await readAttachment(attachment.path),
        };
      }),
    );
    const messageId = `<${crypto.randomUUID()}@gwero-crm>`;
    const { buildMime } = await import("./mime.server");
    const raw = buildMime({
      from: mailbox.from_email,
      fromName: mailbox.from_name,
      to: contact.email,
      subject,
      html,
      text: signed.text,
      attachments,
      messageId,
    });
    if (mailbox.provider === "smtp") {
      const { smtpSend } = await import("./smtp.server");
      await smtpSend(
        {
          host: mailbox.smtp_host ?? "",
          port: mailbox.smtp_port ?? 587,
          secure: mailbox.smtp_secure,
          username: mailbox.smtp_username ?? "",
          password: secret?.smtp_password ?? "",
        },
        {
          from: mailbox.from_email,
          envelopeFrom: mailbox.from_email,
          to: contact.email,
          cc: [],
          bcc: [],
          raw,
        },
      );
    } else if (mailbox.provider === "gmail" || mailbox.provider === "google") {
      const encoded = Buffer.from(raw, "utf8")
        .toString("base64")
        .replace(/\+/g, "-")
        .replace(/\//g, "_")
        .replace(/=+$/, "");
      const response = await gatewayFetch("gmail", secret!, "/gmail/v1/users/me/messages/send", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ raw: encoded }),
      });
      if (!response.ok)
        throw new Error("Gmail could not send this message. Reconnect the mailbox and try again.");
    } else {
      const response = await gatewayFetch("outlook", secret!, "/me/sendMail", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          message: {
            subject,
            body: { contentType: "HTML", content: html },
            toRecipients: [{ emailAddress: { address: contact.email } }],
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
        throw new Error(
          "Microsoft 365 could not send this message. Reconnect the mailbox and try again.",
        );
    }
    const { error } = await db.from("prospect_interactions").insert({
      prospect_id: data.prospectId,
      contact_id: data.contactId,
      interaction_type: "email",
      direction: "outbound",
      subject,
      body,
      body_html: html,
      attachments: JSON.stringify(attachmentMeta),
      message_id: messageId,
    });
    if (error)
      throw new Error(
        `Email sent, but its conversation record could not be saved: ${error.message}`,
      );
    await db
      .from("prospects")
      .update({ last_contact_at: new Date().toISOString() })
      .eq("id", data.prospectId);
    return { ok: true };
  });

export const syncReplies = createServerFn({ method: "POST" })
  .middleware([permissionMiddleware("campaigns.manage")])
  .handler(async ({ context }) => {
    const db = await admin();
    const { getPool } = await import("./db.server");
    const [mailboxRows] = await getPool().execute(
      `SELECT m.* FROM mailboxes m
       JOIN mailbox_access ma ON ma.mailbox_id = m.id
       WHERE ma.user_id = ? AND ma.can_send = TRUE`,
      [context.user.id],
    );
    const mailboxes = mailboxRows as Array<{
      id: string;
      provider: string;
      imap_host: string | null;
      imap_port: number | null;
      imap_username: string | null;
      smtp_username: string | null;
    }>;
    if (!mailboxes?.length) return { imported: 0, checked: 0 };

    const { data: prospects } = await db.from("prospects").select("id, email");
    const { data: contacts } = await db.from("prospect_contacts").select("id, prospect_id, email");
    const byEmail = new Map(
      (prospects ?? []).map((p) => [
        p.email.toLowerCase(),
        { prospectId: p.id, contactId: null as string | null },
      ]),
    );
    for (const contact of contacts ?? [])
      if (contact.email)
        byEmail.set(contact.email.toLowerCase(), {
          prospectId: contact.prospect_id,
          contactId: contact.id,
        });

    let imported = 0;
    for (const mailbox of mailboxes) {
      const messages: Array<{
        id: string;
        from: string;
        subject: string;
        snippet: string;
        body: string;
        bodyHtml: string;
        date: string;
        attachments: Array<{ name: string; type: string; data: string }>;
      }> = [];
      try {
        const { data: secret } = await db
          .from("mailbox_secrets")
          .select("*")
          .eq("mailbox_id", mailbox.id)
          .maybeSingle();
        if (mailbox.provider === "smtp") {
          if (!mailbox.imap_host) continue;
          const { imapFetchRecent } = await import("./imap.server");
          const headers = await imapFetchRecent({
            host: mailbox.imap_host,
            port: mailbox.imap_port ?? 993,
            username: mailbox.imap_username ?? mailbox.smtp_username ?? "",
            password: secret?.imap_password ?? secret?.smtp_password ?? "",
          });
          for (const h of headers) {
            messages.push({
              id: `${mailbox.id}:${h.messageId || h.uid}`,
              from: parseAddress(h.from),
              subject: h.subject,
              snippet: h.body.slice(0, 500) || h.subject,
              body: h.body || h.subject,
              bodyHtml: h.bodyHtml,
              date: h.date ? new Date(h.date).toISOString() : new Date().toISOString(),
              attachments: h.attachments,
            });
          }
        } else if (mailbox.provider === "gmail") {
          const res = await gatewayFetch(
            "gmail",
            secret!,
            "/gmail/v1/users/me/messages?q=newer_than:14d%20in:inbox&maxResults=50",
          );
          if (!res.ok) throw new Error(await res.text());
          const list = (await res.json()) as { messages?: Array<{ id: string }> };
          for (const item of list.messages ?? []) {
            const detail = await gatewayFetch(
              "gmail",
              secret!,
              `/gmail/v1/users/me/messages/${item.id}?format=full`,
            );
            if (!detail.ok) continue;
            const msg = (await detail.json()) as {
              snippet?: string;
              payload?: {
                headers?: Array<{ name: string; value: string }>;
                mimeType?: string;
                body?: { data?: string };
                parts?: Array<unknown>;
              };
            };
            const header = (name: string) =>
              msg.payload?.headers?.find((h) => h.name.toLowerCase() === name)?.value ?? "";
            const attachments: Array<{ name: string; type: string; data: string }> = [];
            for (const part of googleAttachmentParts(msg.payload as GooglePayload)) {
              let data = part.body?.data || "";
              if (!data && part.body?.attachmentId) {
                const attachmentResponse = await gatewayFetch(
                  "gmail",
                  secret!,
                  `/gmail/v1/users/me/messages/${item.id}/attachments/${part.body.attachmentId}`,
                );
                if (attachmentResponse.ok)
                  data = ((await attachmentResponse.json()) as { data?: string }).data || "";
              }
              if (data)
                attachments.push({
                  name: part.filename || "attachment",
                  type: part.mimeType || "application/octet-stream",
                  data,
                });
            }
            messages.push({
              id: `${mailbox.id}:${item.id}`,
              from: parseAddress(header("from")),
              subject: header("subject"),
              snippet: msg.snippet ?? "",
              body: decodeGoogleBody(msg.payload as GooglePayload) || msg.snippet || "",
              bodyHtml: decodeGoogleHtml(msg.payload as GooglePayload),
              date: header("date")
                ? new Date(header("date")).toISOString()
                : new Date().toISOString(),
              attachments,
            });
          }
        } else {
          const res = await gatewayFetch(
            "outlook",
            secret!,
            "/me/mailFolders/inbox/messages?$top=50&$select=id,subject,from,body,bodyPreview,receivedDateTime&$expand=attachments($select=name,contentType,size,contentBytes)",
          );
          if (!res.ok) throw new Error(await res.text());
          const list = (await res.json()) as {
            value?: Array<{
              id: string;
              subject: string;
              bodyPreview: string;
              body?: { content?: string; contentType?: string };
              receivedDateTime: string;
              from?: { emailAddress?: { address?: string } };
              attachments?: Array<{ name?: string; contentType?: string; contentBytes?: string }>;
            }>;
          };
          for (const m of list.value ?? []) {
            messages.push({
              id: `${mailbox.id}:${m.id}`,
              from: (m.from?.emailAddress?.address ?? "").toLowerCase(),
              subject: m.subject,
              snippet: m.bodyPreview,
              body:
                m.body?.contentType === "html" || m.body?.contentType === "HTML"
                  ? htmlToText(m.body.content || "")
                  : m.body?.content || m.bodyPreview,
              bodyHtml:
                m.body?.contentType === "html" || m.body?.contentType === "HTML"
                  ? m.body.content || ""
                  : "",
              date: m.receivedDateTime,
              attachments: (m.attachments ?? [])
                .filter((attachment) => attachment.contentBytes)
                .map((attachment) => ({
                  name: attachment.name || "attachment",
                  type: attachment.contentType || "application/octet-stream",
                  data: attachment.contentBytes || "",
                })),
            });
          }
        }

        for (const message of messages) {
          const match = byEmail.get(message.from);
          if (!match) continue;
          const { prospectId, contactId } = match;
          const pool = (await import("./db.server")).getPool();
          const [opportunityRows] = await pool.query(
            `SELECT opportunity_type, opportunity_id
               FROM opportunity_submissions
              WHERE LOWER(recipient_email) = LOWER(?) AND status = 'submitted'
              ORDER BY CASE
                WHEN LOWER(?) LIKE CONCAT('%', LOWER(subject), '%')
                  OR LOWER(subject) LIKE CONCAT('%', LOWER(?), '%') THEN 0 ELSE 1
              END, submitted_at DESC LIMIT 1`,
            [message.from, message.subject || "", message.subject || ""],
          );
          const opportunity = (
            opportunityRows as Array<{ opportunity_type: string; opportunity_id: string }>
          )[0];
          const { saveAttachmentBuffer } = await import("./attachments.server");
          const savedAttachments = await Promise.all(
            message.attachments.map((attachment) =>
              saveAttachmentBuffer(
                contactId || prospectId,
                Buffer.from(attachment.data.replace(/-/g, "+").replace(/_/g, "/"), "base64"),
                attachment.name,
                attachment.type,
              ),
            ),
          );
          const { data: recipientRow } = await db
            .from("campaign_recipients")
            .select("id, campaign_id")
            .eq("prospect_id", prospectId)
            .in("status", ["sent", "active", "completed"])
            .order("sent_at", { ascending: false })
            .limit(1)
            .maybeSingle();

          const { error } = await db.from("replies").insert({
            mailbox_id: mailbox.id,
            prospect_id: prospectId,
            contact_id: contactId,
            campaign_id: recipientRow?.campaign_id ?? null,
            opportunity_type: opportunity?.opportunity_type ?? null,
            opportunity_id: opportunity?.opportunity_id ?? null,
            from_email: message.from,
            subject: message.subject,
            snippet: message.snippet?.slice(0, 500),
            body: message.body,
            body_html: message.bodyHtml || null,
            attachments: JSON.stringify(savedAttachments),
            received_at: message.date,
            external_id: message.id,
          });
          if (!error) {
            imported++;
            const notificationTitle = `New email from ${message.from}`;
            const notificationBody =
              message.subject || message.snippet || "A new reply was received.";
            const activeUsers = (await db.from("system_users").select("id").eq("status", "active"))
              .data;
            if (activeUsers?.length)
              await db.from("notifications").insert(
                activeUsers.map((user) => ({
                  user_id: user.id,
                  notification_type: "prospect.reply",
                  title: notificationTitle,
                  body: notificationBody,
                  action_url: contactId
                    ? `/prospects/${prospectId}/contacts/${contactId}`
                    : `/prospects/${prospectId}`,
                  entity_type: contactId ? "prospect_contact" : "prospect",
                  entity_id: contactId || prospectId,
                })),
              );
            if (recipientRow) {
              await db
                .from("campaign_recipients")
                .update({
                  replied_at: message.date,
                  status: "stopped",
                  stopped_reason: "Replied",
                  last_activity_at: message.date,
                })
                .eq("id", recipientRow.id);
            }
            await db
              .from("prospects")
              .update({ status: "replied", updated_at: new Date().toISOString() })
              .eq("id", prospectId)
              .in("status", ["new", "contacted"]);
          }
        }

        await db
          .from("mailboxes")
          .update({ last_sync_at: new Date().toISOString(), last_status: "Inbox checked" })
          .eq("id", mailbox.id);
      } catch (error) {
        await db
          .from("mailboxes")
          .update({
            last_status: `Inbox check failed: ${String((error as Error).message).slice(0, 200)}`,
          })
          .eq("id", mailbox.id);
      }
    }

    return { imported, checked: mailboxes.length };
  });
