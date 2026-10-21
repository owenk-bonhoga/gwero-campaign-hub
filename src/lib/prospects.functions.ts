import { createServerFn } from "@tanstack/react-start";
import { permissionMiddleware } from "./auth.middleware";
import { copyProspectLocationsToClientSql } from "./prospect-conversion.sql";
import {
  canonicalCompany,
  companyKey,
  normalizeGender,
  normalizeName,
  normalizePhone,
  normalizeText,
} from "./contact-normalization";

export type ContactImportRow = {
  company: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  gender?: string;
  jobTitle?: string;
  website?: string;
  linkedinUrl?: string;
  categoryId?: string | null;
};

export type ProspectCompanyInput = {
  company: string;
  email?: string;
  phone?: string;
  website?: string;
  linkedinUrl?: string;
  categoryId?: string | null;
  industry?: string;
  address?: string;
  city?: string;
  country?: string;
  registrationNumber?: string;
  employeeCount?: number | null;
  notes?: string;
  logoPath?: string;
};

export const createProspectCompany = createServerFn({ method: "POST" })
  .middleware([permissionMiddleware("prospects.manage")])
  .validator((data: ProspectCompanyInput) => data)
  .handler(async ({ data }) => {
    const company = canonicalCompany(data.company);
    if (!company) throw new Error("Company or organisation name is required.");
    const key = companyKey(company);
    const email = normalizeText(data.email).toLowerCase();
    if (email && !/^\S+@\S+\.\S+$/.test(email)) throw new Error("Enter a valid company email.");
    const { getPool } = await import("./db.server");
    const id = crypto.randomUUID();
    const placeholder = `company-${Buffer.from(`${key}-${id}`).toString("base64url").slice(0, 44)}@prospect.local`;
    try {
      const [existing] = email
        ? await getPool().execute(
            "SELECT id FROM prospects WHERE canonical_key = ? OR email = ? LIMIT 1",
            [key, email],
          )
        : await getPool().execute("SELECT id FROM prospects WHERE canonical_key = ? LIMIT 1", [
            key,
          ]);
      if ((existing as Array<unknown>).length)
        throw new Error("A prospect with this company or email already exists.");
      await getPool().execute(
        `INSERT INTO prospects
          (id, email, company, phone, status, notes, extra, source_file, category_id, website,
           linkedin_url, logo_path, canonical_key, industry, address, city, country,
           registration_number, employee_count)
         VALUES (?, ?, ?, ?, 'new', ?, '{}', 'Manual entry', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          id,
          email || placeholder,
          company,
          normalizePhone(data.phone) || null,
          normalizeText(data.notes) || null,
          data.categoryId || null,
          normalizeText(data.website) || null,
          normalizeText(data.linkedinUrl) || null,
          normalizeText(data.logoPath) || null,
          key,
          normalizeText(data.industry) || null,
          normalizeText(data.address) || null,
          normalizeText(data.city) || null,
          normalizeText(data.country) || null,
          normalizeText(data.registrationNumber) || null,
          data.employeeCount && data.employeeCount > 0 ? Math.round(data.employeeCount) : null,
        ],
      );
    } catch (error) {
      if ((error as { code?: string }).code === "ER_DUP_ENTRY")
        throw new Error("A prospect with this company or email already exists.");
      throw error;
    }
    return { id };
  });

export const deleteProspectContact = createServerFn({ method: "POST" })
  .middleware([permissionMiddleware("prospects.manage")])
  .validator((data: { prospectId: string; contactId: string }) => data)
  .handler(async ({ data }) => {
    const { getPool } = await import("./db.server");
    const connection = await getPool().getConnection();
    try {
      await connection.beginTransaction();
      await connection.execute(
        "UPDATE replies SET contact_id = NULL WHERE contact_id = ? AND prospect_id = ?",
        [data.contactId, data.prospectId],
      );
      await connection.execute(
        "UPDATE prospect_interactions SET contact_id = NULL WHERE contact_id = ? AND prospect_id = ?",
        [data.contactId, data.prospectId],
      );
      const [result] = await connection.execute(
        "DELETE FROM prospect_contacts WHERE id = ? AND prospect_id = ?",
        [data.contactId, data.prospectId],
      );
      if (!(result as { affectedRows?: number }).affectedRows)
        throw new Error("Contact not found.");
      await connection.commit();
      return { ok: true };
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  });

export const importProspectContacts = createServerFn({ method: "POST" })
  .middleware([permissionMiddleware("prospects.manage")])
  .validator((data: { rows: ContactImportRow[]; sourceFile?: string }) => data)
  .handler(async ({ data }) => {
    if (!data.rows.length || data.rows.length > 2_000)
      throw new Error("Import between 1 and 2,000 contacts at a time.");
    const { getPool } = await import("./db.server");
    const connection = await getPool().getConnection();
    const groups = new Map<string, { company: string; rows: ContactImportRow[] }>();
    for (const row of data.rows) {
      const company = canonicalCompany(row.company);
      if (!company) continue;
      const key = companyKey(company);
      const group = groups.get(key) || { company, rows: [] };
      group.rows.push(row);
      groups.set(key, group);
    }
    let prospectsCreated = 0;
    let contactsCreated = 0;
    let contactsUpdated = 0;
    try {
      await connection.beginTransaction();
      for (const [key, group] of groups) {
        const primary =
          group.rows.find((row) => normalizeText(row.email).includes("@")) || group.rows[0];
        if (!primary) continue;
        const primaryEmail =
          normalizeText(primary.email).toLowerCase() ||
          `company-${Buffer.from(key).toString("base64url").slice(0, 40)}@prospect.local`;
        const [matches] = await connection.execute(
          "SELECT id FROM prospects WHERE canonical_key = ? OR email = ? LIMIT 1",
          [key, primaryEmail],
        );
        let prospectId = (matches as Array<{ id: string }>)[0]?.id;
        if (!prospectId) {
          prospectId = crypto.randomUUID();
          await connection.execute(
            `INSERT INTO prospects
              (id, email, first_name, last_name, company, phone, status, notes, extra, source_file,
               category_id, website, linkedin_url, canonical_key)
             VALUES (?, ?, ?, ?, ?, ?, 'new', NULL, '{}', ?, ?, ?, ?, ?)`,
            [
              prospectId,
              primaryEmail,
              normalizeName(primary.firstName) || null,
              normalizeName(primary.lastName) || null,
              group.company,
              normalizePhone(primary.phone) || null,
              normalizeText(data.sourceFile) || null,
              primary.categoryId || null,
              normalizeText(primary.website) || null,
              normalizeText(primary.linkedinUrl) || null,
              key,
            ],
          );
          prospectsCreated += 1;
        } else {
          await connection.execute(
            `UPDATE prospects SET company = ?, canonical_key = ?, source_file = COALESCE(source_file, ?),
              website = COALESCE(website, ?), category_id = COALESCE(category_id, ?) WHERE id = ?`,
            [
              group.company,
              key,
              normalizeText(data.sourceFile) || null,
              normalizeText(primary.website) || null,
              primary.categoryId || null,
              prospectId,
            ],
          );
        }
        for (let index = 0; index < group.rows.length; index += 1) {
          const row = group.rows[index];
          if (!row) continue;
          const email = normalizeText(row.email).toLowerCase() || null;
          const firstName = normalizeName(row.firstName) || null;
          const lastName = normalizeName(row.lastName) || null;
          const phone = normalizePhone(row.phone) || null;
          const rawPhone = normalizeText(row.phone) || null;
          const gender = normalizeGender(row.gender) || null;
          const jobTitle = normalizeText(row.jobTitle) || null;
          const isPrimary = index === 0;
          if (email) {
            const [existing] = await connection.execute(
              "SELECT id FROM prospect_contacts WHERE email = ? LIMIT 1",
              [email],
            );
            const contactId = (existing as Array<{ id: string }>)[0]?.id;
            if (contactId) {
              await connection.execute(
                `UPDATE prospect_contacts SET prospect_id = ?, first_name = ?, last_name = ?, phone = ?,
                  raw_phone = ?, gender = ?, job_title = ?, is_primary = ? WHERE id = ?`,
                [
                  prospectId,
                  firstName,
                  lastName,
                  phone,
                  rawPhone,
                  gender,
                  jobTitle,
                  isPrimary,
                  contactId,
                ],
              );
              contactsUpdated += 1;
              continue;
            }
          }
          await connection.execute(
            `INSERT INTO prospect_contacts
              (id, prospect_id, first_name, last_name, email, phone, raw_phone, gender, job_title, is_primary)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              crypto.randomUUID(),
              prospectId,
              firstName,
              lastName,
              email,
              phone,
              rawPhone,
              gender,
              jobTitle,
              isPrimary,
            ],
          );
          contactsCreated += 1;
        }
      }
      await connection.commit();
      return { companies: groups.size, prospectsCreated, contactsCreated, contactsUpdated };
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  });

export const convertProspectToClient = createServerFn({ method: "POST" })
  .middleware([permissionMiddleware("prospects.convert")])
  .validator((data: { prospectId: string }) => data)
  .handler(async ({ data }) => {
    const { getPool } = await import("./db.server");
    const connection = await getPool().getConnection();
    try {
      await connection.beginTransaction();
      const [prospects] = await connection.execute("SELECT * FROM prospects WHERE id = ? LIMIT 1", [
        data.prospectId,
      ]);
      const prospect = (
        prospects as Array<{
          company: string | null;
          email: string;
          phone: string | null;
          website: string | null;
          logo_path: string | null;
          address: string | null;
          industry: string | null;
        }>
      )[0];
      if (!prospect) throw new Error("Prospect not found.");
      const [existing] = await connection.execute(
        "SELECT id FROM clients WHERE prospect_id = ? LIMIT 1",
        [data.prospectId],
      );
      const clientId = (existing as Array<{ id: string }>)[0]?.id || crypto.randomUUID();
      if (!(existing as Array<unknown>).length) {
        await connection.execute(
          `INSERT INTO clients
            (id, name, company, email, phone, website, industry, status, address, prospect_id, logo_path)
           VALUES (?, ?, ?, ?, ?, ?, ?, 'active', ?, ?, ?)`,
          [
            clientId,
            prospect.company || prospect.email,
            prospect.company,
            prospect.email,
            prospect.phone,
            prospect.website,
            prospect.industry,
            prospect.address,
            data.prospectId,
            prospect.logo_path,
          ],
        );
      }
      await connection.execute(
        `INSERT INTO client_contacts
          (id, client_id, first_name, last_name, email, phone, raw_phone, gender, job_title,
           location, location_source_url, location_is_inferred, is_primary)
         SELECT UUID(), ?, first_name, last_name, email, phone, raw_phone, gender, job_title,
                location, location_source_url, location_is_inferred, is_primary
           FROM prospect_contacts WHERE prospect_id = ?
         ON DUPLICATE KEY UPDATE client_id = VALUES(client_id), first_name = VALUES(first_name),
           last_name = VALUES(last_name), phone = VALUES(phone), raw_phone = VALUES(raw_phone), gender = VALUES(gender),
           job_title = VALUES(job_title), location = VALUES(location),
           location_source_url = VALUES(location_source_url),
           location_is_inferred = VALUES(location_is_inferred), is_primary = VALUES(is_primary)`,
        [clientId, data.prospectId],
      );
      await connection.execute(copyProspectLocationsToClientSql, [
        clientId,
        clientId,
        data.prospectId,
      ]);
      await connection.execute("UPDATE prospects SET status = 'client' WHERE id = ?", [
        data.prospectId,
      ]);
      await connection.execute(
        `UPDATE campaign_recipients SET converted_at = COALESCE(converted_at, CURRENT_TIMESTAMP(3))
          WHERE prospect_id = ?`,
        [data.prospectId],
      );
      await connection.commit();
      return { clientId };
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  });
