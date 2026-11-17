import { createHash, randomUUID } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import mysql from "mysql2/promise";

const database = process.env.DB_NAME || "gwero_crm";
if (!/^[a-zA-Z0-9_]+$/.test(database)) throw new Error("Invalid DB_NAME");

const connectionOptions = {
  user: process.env.DB_USER || process.env.USER || "root",
  password: process.env.DB_PASSWORD || "",
  charset: "utf8mb4_unicode_ci",
  ...(process.env.DB_SOCKET || (!process.env.DB_HOST && process.platform === "darwin")
    ? { socketPath: process.env.DB_SOCKET || "/tmp/mysql.sock" }
    : {
        host: process.env.DB_HOST || "127.0.0.1",
        port: Number(process.env.DB_PORT || 3306),
      }),
};

async function connectToDatabase() {
  try {
    return await mysql.createConnection({ ...connectionOptions, database });
  } catch (error) {
    if (error?.code !== "ER_BAD_DB_ERROR") throw error;

    if (process.env.NODE_ENV === "production") {
      throw new Error(
        `Database "${database}" does not exist or is not accessible. Create it in Hostinger and verify DB_NAME/DB_USER permissions.`,
        { cause: error },
      );
    }

    const bootstrap = await mysql.createConnection(connectionOptions);
    try {
      await bootstrap.query(
        `CREATE DATABASE IF NOT EXISTS \`${database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`,
      );
    } finally {
      await bootstrap.end();
    }
    return mysql.createConnection({ ...connectionOptions, database });
  }
}

const connection = await connectToDatabase();

function locationLabel(location) {
  return [location.addressLine, location.city, location.region, location.country]
    .filter(Boolean)
    .join(", ");
}

async function enrichCampaignLocations() {
  const enrichmentPath = resolve("database/campaign-location-enrichment.json");
  if (!existsSync(enrichmentPath)) return;

  const enrichment = JSON.parse(readFileSync(enrichmentPath, "utf8"));
  const [campaignRows] = await connection.execute("SELECT id FROM campaigns WHERE id = ? LIMIT 1", [
    enrichment.campaignId,
  ]);
  if (!campaignRows.length) return;

  const [audienceRows] = await connection.execute(
    `SELECT cr.prospect_id, cr.contact_id, LOWER(pc.email) AS email,
            c.id AS client_id, cc.id AS client_contact_id
       FROM campaign_recipients cr
       JOIN prospect_contacts pc ON pc.id = cr.contact_id
       LEFT JOIN clients c ON c.prospect_id = cr.prospect_id
       LEFT JOIN client_contacts cc
         ON c.id = cc.client_id AND BINARY LOWER(cc.email) = BINARY LOWER(pc.email)
      WHERE cr.campaign_id = ?`,
    [enrichment.campaignId],
  );
  const audienceByEmail = new Map(
    audienceRows.map((row) => [String(row.email).toLowerCase(), row]),
  );
  const enrichedContacts = new Set();
  const enrichedEntities = new Set();

  for (const organization of enrichment.organizations) {
    const matches = organization.emails
      .map((email) => audienceByEmail.get(email.toLowerCase()))
      .filter(Boolean);
    if (!matches.length || !organization.locations.length) continue;

    const primary =
      organization.locations.find((location) => location.isPrimary) || organization.locations[0];
    const contactLocation = locationLabel(primary);

    for (const match of matches) {
      if (!enrichedContacts.has(match.contact_id)) {
        await connection.execute(
          `UPDATE prospect_contacts
              SET location = ?, location_source_url = ?, location_is_inferred = TRUE
            WHERE id = ?`,
          [contactLocation, primary.sourceUrl || null, match.contact_id],
        );
        enrichedContacts.add(match.contact_id);
      }
      if (match.client_contact_id) {
        await connection.execute(
          `UPDATE client_contacts
              SET location = ?, location_source_url = ?, location_is_inferred = TRUE
            WHERE id = ?`,
          [contactLocation, primary.sourceUrl || null, match.client_contact_id],
        );
      }

      const entities = [{ type: "prospect", id: match.prospect_id }];
      if (match.client_id) entities.push({ type: "client", id: match.client_id });
      for (const entity of entities) {
        const entityKey = `${entity.type}:${entity.id}`;
        if (enrichedEntities.has(entityKey)) continue;
        if (organization.locations.some((location) => location.isPrimary)) {
          await connection.execute(
            `UPDATE organization_locations SET is_primary = FALSE
              WHERE entity_type = ? AND entity_id = ?`,
            [entity.type, entity.id],
          );
        }
        for (const location of organization.locations) {
          const [existingRows] = await connection.execute(
            `SELECT id FROM organization_locations
              WHERE entity_type = ? AND entity_id = ? AND BINARY name = BINARY ? LIMIT 1`,
            [entity.type, entity.id, location.name],
          );
          const values = [
            location.name,
            location.addressLine || null,
            location.city || null,
            location.region || null,
            location.country || null,
            Boolean(location.isPrimary),
            location.sourceUrl || null,
          ];
          if (existingRows.length) {
            await connection.execute(
              `UPDATE organization_locations
                  SET name = ?, address_line = ?, city = ?, region = ?, country = ?,
                      is_primary = ?, source_url = ?
                WHERE id = ?`,
              [...values, existingRows[0].id],
            );
          } else {
            await connection.execute(
              `INSERT INTO organization_locations
                (id, entity_type, entity_id, name, address_line, city, region, country,
                 is_primary, source_url)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
              [randomUUID(), entity.type, entity.id, ...values],
            );
          }
        }
        if (entity.type === "prospect") {
          await connection.execute(
            `UPDATE prospects SET address = ?, city = ?, country = ? WHERE id = ?`,
            [contactLocation, primary.city || null, primary.country || null, entity.id],
          );
        } else {
          await connection.execute("UPDATE clients SET address = ? WHERE id = ?", [
            contactLocation,
            entity.id,
          ]);
        }
        enrichedEntities.add(entityKey);
      }
    }
  }

  console.log(
    `Campaign location enrichment ready: ${enrichedEntities.size} organization records, ${enrichedContacts.size} contact people`,
  );
}

async function restoreUnsignedTenderDocuments() {
  const [result] = await connection.execute(
    `INSERT INTO opportunity_documents
      (id, opportunity_type, opportunity_id, checklist_item_id, document_id, attachment_path,
       display_name, content_type, file_size, document_role, include_in_submission,
       outgoing_name, created_by)
     SELECT UUID(), current_file.opportunity_type, current_file.opportunity_id,
            current_file.checklist_item_id, current_file.document_id, marks.source_attachment_path,
            marks.source_name, source_file.content_type, source_file.file_size,
            current_file.document_role, FALSE, marks.source_name, current_file.created_by
       FROM (
         SELECT source_attachment_path, output_attachment_path, MAX(source_name) AS source_name
           FROM document_mark_applications
          GROUP BY source_attachment_path, output_attachment_path
       ) marks
       JOIN opportunity_documents current_file
         ON current_file.attachment_path = marks.output_attachment_path
       JOIN attachment_files source_file
         ON CONCAT(source_file.owner_id, '/', source_file.id) = marks.source_attachment_path
       LEFT JOIN opportunity_documents original_file
         ON original_file.opportunity_type = current_file.opportunity_type
        AND original_file.opportunity_id = current_file.opportunity_id
        AND original_file.attachment_path = marks.source_attachment_path
      WHERE original_file.id IS NULL`,
  );
  if (result.affectedRows)
    console.log(`Restored ${result.affectedRows} unsigned tender document(s).`);
}

async function clearConnectedMailboxesOnce() {
  const migrationId = "cleanup-connected-mailboxes-20261117";
  const lockName = `${database}:${migrationId}`;
  const [lockRows] = await connection.execute("SELECT GET_LOCK(?, 30) AS acquired", [lockName]);
  if (Number(lockRows[0]?.acquired) !== 1)
    throw new Error("Could not acquire the connected-mailbox cleanup migration lock.");
  try {
    const [applied] = await connection.execute(
      "SELECT 1 FROM schema_migrations WHERE id = ? LIMIT 1",
      [migrationId],
    );
    if (applied.length) return;

    // Secure-share portals must survive removal of the account that originally sent them.
    const [constraints] = await connection.execute(
      `SELECT rc.DELETE_RULE
         FROM information_schema.REFERENTIAL_CONSTRAINTS rc
        WHERE rc.CONSTRAINT_SCHEMA = ? AND rc.TABLE_NAME = 'secure_document_shares'
          AND rc.CONSTRAINT_NAME = 'secure_document_shares_mailbox_fk' LIMIT 1`,
      [database],
    );
    if (constraints[0]?.DELETE_RULE !== "SET NULL") {
      if (constraints.length)
        await connection.query(
          "ALTER TABLE secure_document_shares DROP FOREIGN KEY secure_document_shares_mailbox_fk",
        );
      await connection.query("ALTER TABLE secure_document_shares MODIFY mailbox_id CHAR(36) NULL");
      await connection.query(
        `ALTER TABLE secure_document_shares
         ADD CONSTRAINT secure_document_shares_mailbox_fk
         FOREIGN KEY (mailbox_id) REFERENCES mailboxes(id) ON DELETE SET NULL`,
      );
    }

    await connection.beginTransaction();
    try {
      await connection.execute("UPDATE opportunity_submissions SET mailbox_id = NULL");
      const [result] = await connection.execute("DELETE FROM mailboxes");
      await connection.execute("INSERT INTO schema_migrations (id, checksum) VALUES (?, ?)", [
        migrationId,
        createHash("sha256").update(migrationId).digest("hex"),
      ]);
      await connection.commit();
      console.log(`Cleared ${result.affectedRows} connected email account(s).`);
    } catch (error) {
      await connection.rollback();
      throw error;
    }
  } finally {
    await connection.execute("SELECT RELEASE_LOCK(?)", [lockName]);
  }
}

try {
  const schema = readFileSync(resolve("database/schema.sql"), "utf8");
  for (const statement of schema
    .split(";")
    .map((value) => value.trim())
    .filter(Boolean)) {
    const addColumn = statement.match(
      /^ALTER TABLE\s+`?([a-zA-Z0-9_]+)`?\s+ADD COLUMN IF NOT EXISTS\s+`?([a-zA-Z0-9_]+)`?\s+([\s\S]+)$/i,
    );
    if (addColumn) {
      const [, table, column, definition] = addColumn;
      const [existing] = await connection.execute(
        "SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND COLUMN_NAME = ? LIMIT 1",
        [database, table, column],
      );
      if (existing.length) continue;
      await connection.query(`ALTER TABLE \`${table}\` ADD COLUMN \`${column}\` ${definition}`);
      continue;
    }
    const dropIndex = statement.match(
      /^ALTER TABLE\s+`?([a-zA-Z0-9_]+)`?\s+DROP INDEX IF EXISTS\s+`?([a-zA-Z0-9_]+)`?$/i,
    );
    if (dropIndex) {
      const [, table, index] = dropIndex;
      const [existing] = await connection.execute(
        "SELECT 1 FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND INDEX_NAME = ? LIMIT 1",
        [database, table, index],
      );
      if (!existing.length) continue;
      await connection.query(`ALTER TABLE \`${table}\` DROP INDEX \`${index}\``);
      continue;
    }
    const addIndex = statement.match(
      /^ALTER TABLE\s+`?([a-zA-Z0-9_]+)`?\s+ADD (UNIQUE )?INDEX IF NOT EXISTS\s+`?([a-zA-Z0-9_]+)`?\s+(\([\s\S]+\))$/i,
    );
    if (addIndex) {
      const [, table, unique, index, columns] = addIndex;
      const [existing] = await connection.execute(
        "SELECT 1 FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND INDEX_NAME = ? LIMIT 1",
        [database, table, index],
      );
      if (existing.length) continue;
      await connection.query(
        `ALTER TABLE \`${table}\` ADD ${unique || ""}INDEX \`${index}\` ${columns}`,
      );
      continue;
    }
    await connection.query(statement);
  }
  await clearConnectedMailboxesOnce();
  await restoreUnsignedTenderDocuments();
  await enrichCampaignLocations();
  const checksum = createHash("sha256").update(schema).digest("hex");
  await connection.execute(
    `INSERT IGNORE INTO schema_migrations (id, checksum)
     VALUES (?, ?)`,
    [`core-${checksum.slice(0, 16)}`, checksum],
  );
  console.log("MySQL schema migration completed.");
} finally {
  await connection.end();
}
