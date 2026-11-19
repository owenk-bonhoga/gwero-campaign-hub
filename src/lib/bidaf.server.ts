import { deadlineFetch } from "./request-deadline";
import { randomUUID } from "node:crypto";
import type { PoolConnection, ResultSetHeader, RowDataPacket } from "mysql2/promise";

export type BidafOpportunityKind = "bid" | "eoi" | "rfp" | "rfq";

export type BidafOpportunity = {
  id: string;
  title: string | null;
  reference: string | null;
  buyer: { id: string; name: string } | null;
  procurement_type: string | null;
  lifecycle: string | null;
  published_at: string | null;
  closing_at: string | null;
  closing_date: string | null;
  estimated_amount: string | null;
  currency: string | null;
  original_source_url: string | null;
  first_seen_at: string | null;
  last_seen_at: string | null;
  version: string | null;
  summary?: string | null;
  regions?: string[] | null;
  sectors?: string[] | null;
};

type BidafPage = { items: BidafOpportunity[]; next_cursor: string | null };
type BidafHealth = {
  status: string;
  organisation_id: string;
  integration_id: string;
};

type SyncResult = {
  status: "completed" | "skipped";
  reason?: "not_configured" | "already_running" | "hourly_limit";
  seen: number;
  created: number;
  updated: number;
};

const ACTIVE_LIFECYCLES = ["VERIFIED_OPEN", "UPCOMING", "NEEDS_VERIFICATION"] as const;
const SYNC_ID = "bidaf-opportunities";

export function mapBidafOpportunityKind(procurementType?: string | null): BidafOpportunityKind {
  const value = (procurementType || "").trim().toUpperCase();
  if (/\b(RFQ|REQUEST\s+FOR\s+QUOTATIONS?|QUOTATIONS?)\b/.test(value)) return "rfq";
  if (/\b(RFP|REQUEST\s+FOR\s+PROPOSALS?|PROPOSALS?)\b/.test(value)) return "rfp";
  if (/\b(EOI|EXPRESSION\s+OF\s+INTEREST|PRE[ -]?QUALIFICATION|REGISTRATION|RFI)\b/.test(value))
    return "eoi";
  return "bid";
}

export function shouldImportBidafLifecycle(value?: string | null) {
  return ACTIVE_LIFECYCLES.includes(value as (typeof ACTIVE_LIFECYCLES)[number]);
}

function clean(value: string | null | undefined, limit: number) {
  return value?.trim().slice(0, limit) || null;
}

function dateOnly(value?: string | null) {
  return value ? value.slice(0, 10) : null;
}

function databaseDate(value?: string | null) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString().slice(0, 23).replace("T", " ");
}

function amount(value?: string | null) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
}

export function bidafSourceNotes(item: BidafOpportunity) {
  return [
    "Imported automatically from BidAF.",
    item.summary?.trim() || "",
    item.procurement_type ? `Procurement type: ${item.procurement_type}` : "",
    item.lifecycle ? `Lifecycle: ${item.lifecycle}` : "",
    item.sectors?.length ? `Sectors: ${item.sectors.join(", ")}` : "",
    item.regions?.length ? `Regions: ${item.regions.join(", ")}` : "",
    item.original_source_url ? `Source: ${item.original_source_url}` : "",
    `BidAF ID: ${item.id}`,
  ]
    .filter(Boolean)
    .join("\n");
}

async function configuration() {
  const { serverDb } = await import("./db.server");
  const { data: settingRows } = await serverDb
    .from("system_settings")
    .select("*")
    .in("setting_key", ["bidaf_origin", "bidaf_organisation_id", "bidaf_country"]);
  const settings = Object.fromEntries(
    (settingRows || []).map((row) => [row.setting_key, String(row.setting_value || "")]),
  );
  const origin = (
    process.env["BIDAF_ORIGIN"] ||
    settings["bidaf_origin"] ||
    "https://bidaf.africa"
  ).replace(/\/$/, "");
  const organisationId = (
    process.env["BIDAF_ORGANISATION_ID"] || settings["bidaf_organisation_id"]
  )?.trim();
  let token = process.env["BIDAF_API_TOKEN"]?.trim();
  if (!token) {
    const { getSecret } = await import("./settings.server");
    token = (await getSecret("bidaf_api_token"))?.trim();
  }
  if (!organisationId || !token) return null;
  if (!origin.startsWith("https://")) throw new Error("BIDAF_ORIGIN must use HTTPS.");
  const apiBase = origin.endsWith("/api/v1") ? origin : `${origin}/api/v1`;
  return {
    apiBase,
    organisationId,
    token,
    country: (process.env["BIDAF_COUNTRY"] || settings["bidaf_country"] || "MW")
      .trim()
      .toUpperCase(),
  };
}

async function request<T>(
  config: NonNullable<Awaited<ReturnType<typeof configuration>>>,
  path: string,
  query?: Record<string, string>,
) {
  const url = new URL(`${config.apiBase}${path}`);
  for (const [key, value] of Object.entries(query || {})) url.searchParams.set(key, value);

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const response = await deadlineFetch(url, {
      headers: { authorization: `Bearer ${config.token}`, accept: "application/json" },
      redirect: "error",
      signal: AbortSignal.timeout(20_000),
    });
    if (response.ok) return (await response.json()) as T;
    if ((response.status === 429 || response.status >= 500) && attempt < 2) {
      const retryAfter = Number(response.headers.get("retry-after") || 0);
      await new Promise((resolve) =>
        setTimeout(resolve, Math.min(30_000, Math.max(500, retryAfter * 1000))),
      );
      continue;
    }
    const requestId = response.headers.get("x-request-id");
    throw new Error(
      `BidAF request failed (${response.status}${requestId ? `, request ${requestId}` : ""}).`,
    );
  }
  throw new Error("BidAF request failed after retries.");
}

async function fetchActiveOpportunities(
  config: NonNullable<Awaited<ReturnType<typeof configuration>>>,
) {
  const records = new Map<string, BidafOpportunity>();
  for (const lifecycle of ACTIVE_LIFECYCLES) {
    let cursor: string | null = null;
    do {
      const page: BidafPage = await request<BidafPage>(config, "/opportunities", {
        country: config.country,
        lifecycle,
        limit: "100",
        ...(cursor ? { cursor } : {}),
      });
      for (const item of page.items) {
        if (item.id && shouldImportBidafLifecycle(item.lifecycle)) records.set(item.id, item);
      }
      cursor = page.next_cursor;
    } while (cursor);
  }
  return [...records.values()];
}

async function acquireLease(force = false) {
  const { getPool } = await import("./db.server");
  const db = getPool();
  await db.execute("INSERT IGNORE INTO bidaf_sync_state (id) VALUES (?)", [SYNC_ID]);
  const [result] = await db.execute<ResultSetHeader>(
    `UPDATE bidaf_sync_state
        SET status = 'running', last_started_at = NOW(3), lease_until = DATE_ADD(NOW(3), INTERVAL 20 MINUTE),
            last_error = NULL
      WHERE id = ?
        AND (lease_until IS NULL OR lease_until < NOW(3))
        AND (? = TRUE OR last_completed_at IS NULL OR last_completed_at < DATE_SUB(NOW(3), INTERVAL 1 HOUR))`,
    [SYNC_ID, force],
  );
  if (result.affectedRows) return { acquired: true as const, db };
  const [rows] = await db.query<
    Array<
      RowDataPacket & {
        lease_until: Date | string | null;
        last_completed_at: Date | string | null;
      }
    >
  >("SELECT lease_until, last_completed_at FROM bidaf_sync_state WHERE id = ? LIMIT 1", [SYNC_ID]);
  const leaseUntil = rows[0]?.lease_until ? new Date(rows[0].lease_until).getTime() : 0;
  const running = leaseUntil > Date.now();
  return {
    acquired: false as const,
    reason: (running ? "already_running" : "hourly_limit") as "already_running" | "hourly_limit",
  };
}

async function clientForBuyer(connection: PoolConnection, item: BidafOpportunity) {
  const buyer = item.buyer;
  if (!buyer?.name) return null;
  if (buyer.id) {
    const [linked] = await connection.query<Array<RowDataPacket & { client_id: string }>>(
      "SELECT client_id FROM bidaf_buyer_links WHERE external_buyer_id = ? LIMIT 1",
      [buyer.id],
    );
    if (linked[0]) return linked[0].client_id;
  }

  const name = clean(buyer.name, 255)!;
  const [existing] = await connection.query<Array<RowDataPacket & { id: string }>>(
    `SELECT id FROM clients
      WHERE LOWER(COALESCE(NULLIF(company, ''), name)) = LOWER(?)
      ORDER BY created_at LIMIT 1`,
    [name],
  );
  const clientId = existing[0]?.id || randomUUID();
  if (!existing[0]) {
    await connection.execute(
      `INSERT INTO clients (id, name, company, status, notes)
       VALUES (?, ?, ?, 'active', 'Automatically created from the BidAF opportunity feed.')`,
      [clientId, name, name],
    );
  }
  if (buyer.id) {
    await connection.execute(
      `INSERT INTO bidaf_buyer_links (external_buyer_id, client_id, buyer_name)
       VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE client_id = VALUES(client_id), buyer_name = VALUES(buyer_name)`,
      [buyer.id, clientId, name],
    );
  }
  return clientId;
}

async function syncOpportunity(connection: PoolConnection, item: BidafOpportunity) {
  const [links] = await connection.query<
    Array<
      RowDataPacket & {
        local_kind: BidafOpportunityKind;
        local_opportunity_id: string;
        external_version: string;
        is_suppressed: number;
      }
    >
  >(
    `SELECT local_kind, local_opportunity_id, external_version, is_suppressed
       FROM bidaf_opportunity_links WHERE external_opportunity_id = ? LIMIT 1`,
    [item.id],
  );
  const existing = links[0];
  if (existing?.is_suppressed) {
    await connection.execute(
      `UPDATE bidaf_opportunity_links
          SET lifecycle = ?, last_seen_at = ?, last_synced_at = NOW(3)
        WHERE external_opportunity_id = ?`,
      [item.lifecycle, databaseDate(item.last_seen_at), item.id],
    );
    return "unchanged" as const;
  }
  if (existing?.external_version && existing.external_version === item.version) {
    await connection.execute(
      `UPDATE bidaf_opportunity_links
          SET lifecycle = ?, last_seen_at = ?, last_synced_at = NOW(3)
        WHERE external_opportunity_id = ?`,
      [item.lifecycle, databaseDate(item.last_seen_at), item.id],
    );
    return "unchanged" as const;
  }

  const kind = existing?.local_kind || mapBidafOpportunityKind(item.procurement_type);
  const id = existing?.local_opportunity_id || randomUUID();
  const clientId = await clientForBuyer(connection, item);
  const title = clean(item.title, 255) || `BidAF opportunity ${item.id}`;
  const reference = clean(item.reference, 80);
  const buyer = clean(item.buyer?.name, 255) || "Unspecified buyer";
  const dueDate = dateOnly(item.closing_at || item.closing_date);
  const publishedDate = dateOnly(item.published_at);
  const value = amount(item.estimated_amount);
  const currency = clean(item.currency, 10) || "MWK";
  const notes = bidafSourceNotes(item);
  const sourceUrl = clean(item.original_source_url, 1000);

  if (kind === "bid") {
    if (existing) {
      await connection.execute(
        `UPDATE bids SET title = ?, reference = ?, buyer = ?, client_id = ?, closing_date = ?,
          value = ?, currency = ?, notes = ?, portal_url = ? WHERE id = ?`,
        [title, reference, buyer, clientId, dueDate, value, currency, notes, sourceUrl, id],
      );
    } else {
      await connection.execute(
        `INSERT INTO bids
          (id, reference, title, buyer, client_id, status, closing_date, value, currency, notes,
           submission_type, portal_url)
         VALUES (?, ?, ?, ?, ?, 'identified', ?, ?, ?, ?, 'portal', ?)`,
        [id, reference, title, buyer, clientId, dueDate, value, currency, notes, sourceUrl],
      );
    }
  } else if (kind === "eoi") {
    if (existing) {
      await connection.execute(
        `UPDATE prequalifications SET title = ?, reference = ?, buyer = ?, client_id = ?,
          due_date = ?, valid_until = ?, value = ?, currency = ?, notes = ?, portal_url = ? WHERE id = ?`,
        [
          title,
          reference,
          buyer,
          clientId,
          dueDate,
          dueDate,
          value,
          currency,
          notes,
          sourceUrl,
          id,
        ],
      );
    } else {
      await connection.execute(
        `INSERT INTO prequalifications
          (id, reference, title, buyer, client_id, status, due_date, valid_until, value, currency,
           notes, response_channel, portal_url, submission_type)
         VALUES (?, ?, ?, ?, ?, 'preparing', ?, ?, ?, ?, ?, 'portal', ?, 'eoi')`,
        [
          id,
          reference,
          title,
          buyer,
          clientId,
          dueDate,
          dueDate,
          value,
          currency,
          notes,
          sourceUrl,
        ],
      );
    }
  } else if (existing) {
    await connection.execute(
      `UPDATE requests SET title = ?, reference = ?, issuer = ?, client_id = ?, received_date = ?,
        due_date = ?, value = ?, currency = ?, notes = ?, portal_url = ? WHERE id = ?`,
      [
        title,
        reference,
        buyer,
        clientId,
        publishedDate,
        dueDate,
        value,
        currency,
        notes,
        sourceUrl,
        id,
      ],
    );
  } else {
    await connection.execute(
      `INSERT INTO requests
        (id, reference, title, issuer, client_id, request_type, status, received_date, due_date,
         value, currency, notes, submission_type, portal_url)
       VALUES (?, ?, ?, ?, ?, ?, 'received', ?, ?, ?, ?, ?, 'portal', ?)`,
      [
        id,
        reference,
        title,
        buyer,
        clientId,
        kind,
        publishedDate,
        dueDate,
        value,
        currency,
        notes,
        sourceUrl,
      ],
    );
  }

  await connection.execute(
    `INSERT INTO bidaf_opportunity_links
      (external_opportunity_id, local_kind, local_opportunity_id, external_version, lifecycle,
       source_url, source_payload, first_seen_at, last_seen_at, last_synced_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(3))
     ON DUPLICATE KEY UPDATE external_version = VALUES(external_version),
       lifecycle = VALUES(lifecycle), source_url = VALUES(source_url),
       source_payload = VALUES(source_payload), first_seen_at = VALUES(first_seen_at),
       last_seen_at = VALUES(last_seen_at), last_synced_at = NOW(3)`,
    [
      item.id,
      kind,
      id,
      item.version,
      item.lifecycle,
      sourceUrl,
      JSON.stringify(item),
      databaseDate(item.first_seen_at),
      databaseDate(item.last_seen_at),
    ],
  );
  return existing ? ("updated" as const) : ("created" as const);
}

export async function runBidafOpportunitySync(force = false): Promise<SyncResult> {
  const config = await configuration();
  if (!config)
    return { status: "skipped", reason: "not_configured", seen: 0, created: 0, updated: 0 };

  const lease = await acquireLease(force);
  if (!lease.acquired)
    return { status: "skipped", reason: lease.reason, seen: 0, created: 0, updated: 0 };

  let seen = 0;
  let created = 0;
  let updated = 0;
  try {
    const health = await request<BidafHealth>(config, "/health");
    if (health.status !== "ok" || health.organisation_id !== config.organisationId)
      throw new Error("BidAF credential is bound to a different organisation.");

    const opportunities = await fetchActiveOpportunities(config);
    seen = opportunities.length;
    for (const item of opportunities) {
      const connection = await lease.db.getConnection();
      try {
        await connection.beginTransaction();
        const result = await syncOpportunity(connection, item);
        if (result === "created") created += 1;
        if (result === "updated") updated += 1;
        await connection.commit();
      } catch (error) {
        await connection.rollback();
        throw error;
      } finally {
        connection.release();
      }
    }
    await lease.db.execute(
      `UPDATE bidaf_sync_state SET status = 'completed', last_completed_at = NOW(3),
        lease_until = NULL, records_seen = ?, records_created = ?, records_updated = ? WHERE id = ?`,
      [seen, created, updated, SYNC_ID],
    );
    return { status: "completed", seen, created, updated };
  } catch (error) {
    const message = error instanceof Error ? error.message.slice(0, 1000) : "Unknown BidAF error";
    await lease.db.execute(
      "UPDATE bidaf_sync_state SET status = 'failed', lease_until = NULL, last_error = ? WHERE id = ?",
      [message, SYNC_ID],
    );
    throw error;
  }
}
