import { requireUser } from "./auth.server";
import { getPool } from "./db.server";
export async function requireAttachmentAccess(ownerId: string, allowNew = false) {
  if (!/^[0-9a-f-]{36}$/i.test(ownerId)) throw new Error("Invalid attachment owner");
  const user = await requireUser();
  const [documentRows] = await getPool().execute(
    `SELECT d.owner_id, da.access_level
       FROM documents d
       LEFT JOIN document_access da ON da.document_id = d.id AND da.user_id = ?
      WHERE d.id = ? LIMIT 1`,
    [user.id, ownerId],
  );
  const document = (
    documentRows as Array<{ owner_id: string | null; access_level: string | null }>
  )[0];
  if (document) {
    if (
      user.roleName === "Administrator" ||
      document.owner_id === user.id ||
      (!document.owner_id && user.permissions.includes("documents.manage")) ||
      (document.access_level && (!allowNew || ["edit", "manage"].includes(document.access_level)))
    )
      return user;
    throw new Error("Permission denied");
  }
  const [rows] = await getPool().execute(
    "SELECT 'campaigns.manage' AS permission FROM campaigns WHERE id = ? UNION ALL SELECT 'prospects.manage' FROM prospect_contacts WHERE id = ? UNION ALL SELECT 'opportunities.manage' FROM bids WHERE id = ? UNION ALL SELECT 'opportunities.manage' FROM requests WHERE id = ? UNION ALL SELECT 'opportunities.manage' FROM prequalifications WHERE id = ? UNION ALL SELECT 'finance.manage' FROM finance_transactions WHERE id = ?",
    [ownerId, ownerId, ownerId, ownerId, ownerId, ownerId],
  );
  const permissions = (rows as Array<{ permission: string }>).map((row) => row.permission);
  if (
    permissions.length &&
    permissions.every((permission) => user.permissions.includes(permission))
  )
    return user;
  if (!permissions.length) {
    const [markRows] = await getPool().execute(
      "SELECT id FROM document_marks WHERE id = ? LIMIT 1",
      [ownerId],
    );
    if ((markRows as Array<{ id: string }>)[0] && user.permissions.includes("documents.manage"))
      return user;
    const [existing] = await getPool().execute(
      "SELECT uploaded_by FROM attachment_files WHERE owner_id = ? LIMIT 1",
      [ownerId],
    );
    const owner = (existing as Array<{ uploaded_by: string | null }>)[0];
    if (owner && owner.uploaded_by === user.id) return user;
    if (user.roleName === "Administrator") return user;
    if (
      allowNew &&
      !owner &&
      [
        "campaigns.manage",
        "prospects.manage",
        "opportunities.manage",
        "documents.manage",
        "finance.manage",
      ].some((permission) => user.permissions.includes(permission))
    )
      return user;
  }
  throw new Error("Permission denied");
}
