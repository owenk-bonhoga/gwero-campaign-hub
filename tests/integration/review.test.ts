import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import mysql from "mysql2/promise";
import { getPool, runClientQuery, serverDb } from "../../src/lib/db.server";
import { directoryPage } from "../../src/lib/directory.server";
import { requireDocumentLevel } from "../../src/lib/documents.server";
import { requireNoteAccess } from "../../src/lib/page-access.server";
import { dashboardForUser } from "../../src/lib/dashboard.server";
import { withDatabaseDeadlines } from "../../src/lib/database-deadline";
import { consumeLoginAttempt } from "../../src/lib/login-limit.server";
import { processCampaignQueue, resolveUncertainDelivery } from "../../src/lib/campaigns.server";
import type { AuthUser } from "../../src/lib/auth.server";

const enabled = process.env["RUN_DATABASE_TESTS"] === "1";
test("real database security, directory and queue regressions", { skip: !enabled }, async (t) => {
  if (!/^gwero_(ci|review)$/.test(process.env["DB_NAME"] || ""))
    throw new Error("Integration tests require an isolated test database.");
  const db = getPool();
  const owner = randomUUID(),
    outsider = randomUUID(),
    documentId = randomUUID(),
    noteId = randomUUID(),
    mailboxId = randomUUID(),
    campaignId = randomUUID(),
    prospectId = randomUUID(),
    recipientId = randomUUID(),
    stepId = randomUUID();
  const user: AuthUser = {
    id: outsider,
    email: "review@example.invalid",
    fullName: "Reviewer",
    roleId: null,
    roleName: "Test",
    permissions: [
      "documents.manage",
      "notes.manage",
      "clients.manage",
      "campaigns.manage",
      "prospects.view",
    ],
  };
  const prefix = "integration-" + randomUUID().slice(0, 8);
  try {
    await db.execute(
      "INSERT INTO system_users(id,full_name,email,status) VALUES(?,?,?,'active'),(?,?,?,'active')",
      [
        owner,
        "Owner",
        prefix + "-owner@example.invalid",
        outsider,
        "Other",
        prefix + "-other@example.invalid",
      ],
    );
    await db.execute("INSERT INTO documents(id,title,owner_id) VALUES(?,?,?)", [
      documentId,
      "Private",
      owner,
    ]);
    await db.execute(
      "INSERT INTO page_notes(id,page_key,body,created_by,updated_by) VALUES(?,'/hr','Private HR note',?,?)",
      [noteId, owner, owner],
    );
    await t.test("generic documents cannot bypass ownership or change ACLs", async () => {
      for (const action of ["select", "update", "delete"] as const) {
        const result = await runClientQuery(
          {
            table: "documents",
            action,
            filters: [{ column: "id", op: "eq", value: documentId }],
            values: { owner_id: outsider },
          },
          user,
        );
        assert.ok(result.error);
      }
      await assert.rejects(
        () => requireDocumentLevel(documentId, "view", user),
        /Permission denied/,
      );
      await requireDocumentLevel(documentId, "manage", { ...user, id: owner });
    });
    await t.test("note IDs enforce the permission of their underlying page", async () => {
      await assert.rejects(() => requireNoteAccess(noteId, user), /Permission denied/);
    });
    const values = Array.from({ length: 65 }, (_, i) => [
      randomUUID(),
      `${prefix} Company ${String(i).padStart(3, "0")}`,
      `${prefix}-${i}@example.invalid`,
    ]);
    for (const [id, name, email] of values)
      await db.execute("INSERT INTO clients(id,name,email) VALUES(?,?,?)", [id, name, email]);
    await t.test(
      "directories count every row and return bounded non-overlapping pages",
      async () => {
        const first = await directoryPage("clients", { search: prefix }),
          second = await directoryPage("clients", { search: prefix, offset: 30 });
        assert.equal(first.total, 65);
        assert.equal(first.rows.length, 30);
        assert.equal(first.nextOffset, 30);
        assert.ok(!first.rows.some((row) => second.rows.some((other) => other.id === row.id)));
        const limited = await dashboardForUser(user);
        assert.equal(limited.counts.projects, null);
        assert.equal(limited.errors.length, 0);
        assert.ok(limited.counts.clients! >= 65);
        const projection = await runClientQuery(
          {
            table: "clients",
            action: "select",
            columns: "id,name",
            filters: [],
            limit: 5,
            offset: 30,
            count: true,
            search: { term: prefix, columns: ["name"] },
          },
          user,
        );
        assert.equal(projection.error, null);
        assert.equal((projection.data as unknown[]).length, 5);
        assert.equal(projection.count, 65);
        assert.ok(!("email" in (projection.data as object[])[0]!));
      },
    );
    await t.test(
      "mailbox credentials are encrypted at rest and decoded only server-side",
      async () => {
        await db.execute("INSERT INTO mailboxes(id,name,from_email,created_by) VALUES(?,?,?,?)", [
          mailboxId,
          "Dummy",
          prefix + "@example.invalid",
          owner,
        ]);
        const result = await serverDb
          .from("mailbox_secrets")
          .insert({ mailbox_id: mailboxId, smtp_password: "dummy-password" });
        assert.equal(result.error, null);
        const [rows] = await db.execute(
          "SELECT smtp_password FROM mailbox_secrets WHERE mailbox_id=?",
          [mailboxId],
        );
        assert.match((rows as Array<{ smtp_password: string }>)[0]!.smtp_password, /^gwero:v1:/);
        const read = await serverDb
          .from("mailbox_secrets")
          .select("smtp_password")
          .eq("mailbox_id", mailboxId)
          .single();
        assert.equal(read.data?.smtp_password, "dummy-password");
      },
    );
    await t.test("250 unrelated attempts cannot lock out another account", async () => {
      for (let i = 0; i < 260; i++) await consumeLoginAttempt(prefix + i + "@example.invalid");
      await consumeLoginAttempt(prefix + "-new@example.invalid");
      await consumeLoginAttempt(prefix + "-one@example.invalid");
      for (let i = 1; i < 10; i++) await consumeLoginAttempt(prefix + "-one@example.invalid");
      await assert.rejects(() => consumeLoginAttempt(prefix + "-one@example.invalid"), /Too many/);
    });
    await db.execute("INSERT INTO prospects(id,email,company,extra) VALUES(?,?,?,'{}')", [
      prospectId,
      prefix + "-prospect@example.invalid",
      "Dummy",
    ]);
    await db.execute(
      "INSERT INTO campaigns(id,name,subject,body_html,cc,bcc,attachments,mailbox_id,owner_id,status,approval_required) VALUES(?,'Dummy','Dummy','Dummy','[]','[]','[]',?,?,'draft',TRUE)",
      [campaignId, mailboxId, owner],
    );
    await db.execute(
      "INSERT INTO campaign_steps(id,campaign_id,step_order,step_type,name,subject,body_html) VALUES(?,?,1,'email','Dummy','Dummy','Dummy')",
      [stepId, campaignId],
    );
    await db.execute(
      "INSERT INTO campaign_recipients(id,campaign_id,prospect_id,status,claimed_at,dispatch_started_at,message_id) VALUES(?,?,?,'processing',DATE_SUB(NOW(3),INTERVAL 10 MINUTE),NOW(3),'<dummy@example.invalid>')",
      [recipientId, campaignId, prospectId],
    );
    await t.test(
      "interrupted dispatch is quarantined and requires an explicit delivery review",
      async () => {
        await processCampaignQueue({ campaignId, maxActions: 1 });
        const status = async () => {
          const [rows] = await db.execute("SELECT status FROM campaign_recipients WHERE id=?", [
            recipientId,
          ]);
          return (rows as Array<{ status: string }>)[0]!.status;
        };
        assert.equal(await status(), "uncertain");
        await resolveUncertainDelivery({ campaignId, recipientId, outcome: "delivered" }, owner);
        assert.equal(await status(), "completed");
        await assert.rejects(() =>
          resolveUncertainDelivery({ campaignId, recipientId, outcome: "not_delivered" }, owner),
        );
        await db.execute(
          "UPDATE campaign_recipients SET status='failed',attempt_count=1,next_action_at=DATE_ADD(NOW(3),INTERVAL 15 MINUTE) WHERE id=?",
          [recipientId],
        );
        await db.execute(
          "UPDATE campaigns SET status='running',approval_required=FALSE WHERE id=?",
          [campaignId],
        );
        // A retry scheduled in the future must keep the campaign running.
        await db.execute(
          "UPDATE system_users SET role_id=(SELECT id FROM roles WHERE name='Administrator' LIMIT 1) WHERE id=?",
          [owner],
        );
        await processCampaignQueue({ campaignId, maxActions: 1 });
        assert.equal(await status(), "failed");
        const [campaignState] = await db.execute("SELECT status FROM campaigns WHERE id=?", [
          campaignId,
        ]);
        assert.equal((campaignState as Array<{ status: string }>)[0]!.status, "running");
      },
    );
  } finally {
    await db.execute("DELETE FROM campaigns WHERE id=?", [campaignId]);
    await db.execute("DELETE FROM prospects WHERE id=?", [prospectId]);
    await db.execute("DELETE FROM mailboxes WHERE id=?", [mailboxId]);
    await db.execute("DELETE FROM documents WHERE id=?", [documentId]);
    await db.execute("DELETE FROM clients WHERE name LIKE ?", [prefix + "%"]);
    await db.execute("DELETE FROM system_users WHERE id IN (?,?)", [owner, outsider]);
    await db.end();
  }
});
test("query and pool acquisition deadlines release resources", { skip: !enabled }, async () => {
  const raw = mysql.createPool({
    host: process.env["DB_HOST"],
    port: Number(process.env["DB_PORT"]),
    user: process.env["DB_USER"],
    password: process.env["DB_PASSWORD"],
    database: process.env["DB_NAME"],
    connectionLimit: 1,
  });
  const bounded = withDatabaseDeadlines(raw, 80);
  try {
    await assert.rejects(() => bounded.query("SELECT SLEEP(1)"));
    await new Promise((r) => setTimeout(r, 1100));
    const lease = await raw.getConnection();
    await assert.rejects(() => bounded.getConnection(), /timed out/);
    lease.release();
    await new Promise((r) => setTimeout(r, 50));
    const [rows] = await bounded.query("SELECT 1 AS ok");
    assert.equal((rows as Array<{ ok: number }>)[0]!.ok, 1);
  } finally {
    await raw.end();
  }
});
