import { validateContract } from "./input-contract";
import { randomUUID } from "node:crypto";
import { createServerFn } from "@tanstack/react-start";
import { authMiddleware } from "./auth.middleware";

export type LocationOwnerType = "prospect" | "client";

export type OrganizationLocation = {
  id: string;
  entity_type: LocationOwnerType;
  entity_id: string;
  name: string;
  address_line: string | null;
  city: string | null;
  region: string | null;
  country: string | null;
  is_primary: boolean;
  source_url: string | null;
  created_at: string;
  updated_at: string;
};

type LocationInput = {
  entityType: LocationOwnerType;
  entityId: string;
  name: string;
  addressLine: string;
  city: string;
  region: string;
  country: string;
  sourceUrl?: string;
  isPrimary?: boolean;
};

function requireLocationPermission(
  user: { permissions: string[] },
  entityType: LocationOwnerType,
  write: boolean,
) {
  const permission =
    entityType === "prospect" ? (write ? "prospects.manage" : "prospects.view") : "clients.manage";
  if (!user.permissions.includes(permission)) throw new Error("Permission denied");
}

function clean(value: string) {
  return value.trim() || null;
}

export const listOrganizationLocations = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .validator((data: { entityType: LocationOwnerType; entityId: string }) =>
    validateContract(data, "listOrganizationLocations"),
  )
  .handler(async ({ data, context }) => {
    requireLocationPermission(context.user, data.entityType, false);
    const { getPool } = await import("./db.server");
    const [rows] = await getPool().execute(
      `SELECT * FROM organization_locations
        WHERE entity_type = ? AND entity_id = ?
        ORDER BY is_primary DESC, name ASC, created_at ASC`,
      [data.entityType, data.entityId],
    );
    return JSON.parse(JSON.stringify(rows)) as OrganizationLocation[];
  });

export const saveOrganizationLocation = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((data: LocationInput & { locationId?: string }) =>
    validateContract(data, "saveOrganizationLocation"),
  )
  .handler(async ({ data, context }) => {
    requireLocationPermission(context.user, data.entityType, true);
    if (
      ![data.name, data.addressLine, data.city, data.region, data.country].some((value) =>
        value.trim(),
      )
    )
      throw new Error("Add a location name, address, city, region or country.");
    const { getPool } = await import("./db.server");
    const db = getPool();
    const connection = await db.getConnection();
    try {
      await connection.beginTransaction();
      const locationId = data.locationId || randomUUID();
      if (data.isPrimary) {
        await connection.execute(
          `UPDATE organization_locations SET is_primary = FALSE
            WHERE entity_type = ? AND entity_id = ?`,
          [data.entityType, data.entityId],
        );
      }
      if (data.locationId) {
        const [result] = await connection.execute(
          `UPDATE organization_locations
              SET name = ?, address_line = ?, city = ?, region = ?, country = ?,
                  source_url = ?, is_primary = ?
            WHERE id = ? AND entity_type = ? AND entity_id = ?`,
          [
            clean(data.name) || "Location",
            clean(data.addressLine),
            clean(data.city),
            clean(data.region),
            clean(data.country),
            clean(data.sourceUrl || ""),
            Boolean(data.isPrimary),
            locationId,
            data.entityType,
            data.entityId,
          ],
        );
        if (!(result as { affectedRows: number }).affectedRows)
          throw new Error("Location not found.");
      } else {
        const [existing] = await connection.execute(
          `SELECT COUNT(*) AS total FROM organization_locations
            WHERE entity_type = ? AND entity_id = ?`,
          [data.entityType, data.entityId],
        );
        const isPrimary =
          data.isPrimary || Number((existing as Array<{ total: number }>)[0]?.total || 0) === 0;
        await connection.execute(
          `INSERT INTO organization_locations
            (id, entity_type, entity_id, name, address_line, city, region, country, is_primary, source_url)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            locationId,
            data.entityType,
            data.entityId,
            clean(data.name) || "Location",
            clean(data.addressLine),
            clean(data.city),
            clean(data.region),
            clean(data.country),
            isPrimary,
            clean(data.sourceUrl || ""),
          ],
        );
      }
      await connection.commit();
      return { id: locationId };
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  });

export const deleteOrganizationLocation = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((data: { entityType: LocationOwnerType; entityId: string; locationId: string }) =>
    validateContract(data, "deleteOrganizationLocation"),
  )
  .handler(async ({ data, context }) => {
    requireLocationPermission(context.user, data.entityType, true);
    const { getPool } = await import("./db.server");
    const db = getPool();
    const connection = await db.getConnection();
    try {
      await connection.beginTransaction();
      const [found] = await connection.execute(
        `SELECT is_primary FROM organization_locations
          WHERE id = ? AND entity_type = ? AND entity_id = ? LIMIT 1`,
        [data.locationId, data.entityType, data.entityId],
      );
      const row = (found as Array<{ is_primary: number }>)[0];
      if (!row) throw new Error("Location not found.");
      await connection.execute("DELETE FROM organization_locations WHERE id = ?", [
        data.locationId,
      ]);
      if (row.is_primary) {
        await connection.execute(
          `UPDATE organization_locations SET is_primary = TRUE
            WHERE entity_type = ? AND entity_id = ?
            ORDER BY created_at ASC LIMIT 1`,
          [data.entityType, data.entityId],
        );
      }
      await connection.commit();
      return { deleted: true };
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  });
