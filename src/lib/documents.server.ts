import { randomUUID } from "node:crypto";
import type { PoolConnection, RowDataPacket } from "mysql2/promise";
import type { AuthUser } from "./auth.server";
import type {
  DocumentAccessLevel,
  DocumentWorkspace,
  ManagedAttachment,
  ManagedDocumentRecord,
} from "./documents.types";

const levels: Record<DocumentAccessLevel, number> = { view: 1, edit: 2, manage: 3 };
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function text(value: unknown, max = 1000) {
  return String(value || "")
    .trim()
    .slice(0, max);
}

function date(value: unknown) {
  const cleaned = text(value, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(cleaned) ? cleaned : null;
}

function isAdmin(user: AuthUser) {
  return user.roleName === "Administrator";
}

export async function requireDocumentLevel(
  documentId: string,
  needed: DocumentAccessLevel,
  user: AuthUser,
  connection?: PoolConnection,
) {
  if (!uuid.test(documentId)) throw new Error("Invalid document");
  const { getPool } = await import("./db.server");
  const db = connection || getPool();
  const [rows] = await db.execute(
    `SELECT d.owner_id, da.access_level
       FROM documents d
       LEFT JOIN document_access da ON da.document_id = d.id AND da.user_id = ?
      WHERE d.id = ? LIMIT 1`,
    [user.id, documentId],
  );
  const row = (rows as Array<{ owner_id: string | null; access_level: string | null }>)[0];
  if (!row) throw new Error("Document not found");
  const effective: DocumentAccessLevel | null =
    isAdmin(user) ||
    row.owner_id === user.id ||
    (!row.owner_id && user.permissions.includes("documents.manage"))
      ? "manage"
      : row.access_level === "view" || row.access_level === "edit" || row.access_level === "manage"
        ? row.access_level
        : null;
  if (!effective || levels[effective] < levels[needed]) throw new Error("Permission denied");
  return row;
}

export async function getDocumentWorkspaceServer(user: AuthUser): Promise<DocumentWorkspace> {
  const { executeRead } = await import("./db.server");
  const [documentsResult, categoriesResult, usersResult] = await Promise.all([
    executeRead(
      `SELECT d.id, d.title, d.category_id, COALESCE(c.name, NULLIF(d.category, ''), 'General') AS category_name,
              COALESCE(c.color, 'slate') AS category_color, d.entity_type, d.entity_id, d.owner_id,
              COALESCE(owner.full_name, NULLIF(d.owner, ''), 'Unassigned') AS owner_name,
              d.status, d.issue_date, d.expiry_date, d.notes, d.updated_at, da.access_level
         FROM documents d
         LEFT JOIN document_categories c ON c.id = d.category_id
         LEFT JOIN system_users owner ON owner.id = d.owner_id
         LEFT JOIN document_access da ON da.document_id = d.id AND da.user_id = ?
        WHERE ? = 1 OR d.owner_id = ? OR (d.owner_id IS NULL AND ? = 1) OR da.user_id IS NOT NULL
        ORDER BY d.updated_at DESC`,
      [
        user.id,
        isAdmin(user) ? 1 : 0,
        user.id,
        user.permissions.includes("documents.manage") ? 1 : 0,
      ],
    ),
    executeRead("SELECT id, name, description, color FROM document_categories ORDER BY name ASC"),
    executeRead(
      "SELECT id, full_name, email FROM system_users WHERE status = 'active' ORDER BY full_name ASC",
    ),
  ]);
  const documentRows = documentsResult[0] as RowDataPacket[];
  const ids = documentRows.map((row) => String(row["id"]));
  let versionRows: RowDataPacket[] = [];
  let grantRows: RowDataPacket[] = [];
  if (ids.length) {
    const placeholders = ids.map(() => "?").join(",");
    [versionRows, grantRows] = await Promise.all([
      executeRead(
        `SELECT v.*, COALESCE(u.full_name, 'Unknown user') AS created_by_name
           FROM document_versions v LEFT JOIN system_users u ON u.id = v.created_by
          WHERE v.document_id IN (${placeholders})
          ORDER BY v.document_id, v.version_number DESC`,
        ids,
      ).then(([rows]) => rows as RowDataPacket[]),
      executeRead(
        `SELECT a.document_id, a.user_id, a.access_level, u.full_name, u.email
           FROM document_access a JOIN system_users u ON u.id = a.user_id
          WHERE a.document_id IN (${placeholders})
          ORDER BY u.full_name`,
        ids,
      ).then(([rows]) => rows as RowDataPacket[]),
    ]);
  }
  const documents: ManagedDocumentRecord[] = documentRows.map((row) => {
    const documentId = String(row["id"]);
    const accessLevel: DocumentAccessLevel =
      isAdmin(user) || row["owner_id"] === user.id || !row["owner_id"]
        ? "manage"
        : row["access_level"] === "manage" || row["access_level"] === "edit"
          ? row["access_level"]
          : "view";
    return {
      id: documentId,
      title: String(row["title"] || "Untitled document"),
      categoryId: String(row["category_id"] || ""),
      categoryName: String(row["category_name"] || "General"),
      categoryColor: String(row["category_color"] || "slate"),
      entityType: String(row["entity_type"] || "general"),
      entityId: String(row["entity_id"] || ""),
      ownerId: String(row["owner_id"] || ""),
      ownerName: String(row["owner_name"] || "Unassigned"),
      status: String(row["status"] || "active"),
      issueDate: row["issue_date"] ? String(row["issue_date"]).slice(0, 10) : "",
      expiryDate: row["expiry_date"] ? String(row["expiry_date"]).slice(0, 10) : "",
      notes: String(row["notes"] || ""),
      accessLevel,
      updatedAt: String(row["updated_at"] || ""),
      versions: versionRows
        .filter((version) => String(version["document_id"]) === documentId)
        .map((version) => ({
          id: String(version["id"]),
          documentId,
          versionNumber: Number(version["version_number"] || 1),
          attachmentPath: String(version["attachment_path"] || ""),
          fileName: String(version["file_name"] || "Document"),
          contentType: String(version["content_type"] || "application/octet-stream"),
          fileSize: Number(version["file_size"] || 0),
          notes: String(version["notes"] || ""),
          createdBy: String(version["created_by"] || ""),
          createdByName: String(version["created_by_name"] || "Unknown user"),
          createdAt: String(version["created_at"] || ""),
        })),
      grants: grantRows
        .filter((grant) => String(grant["document_id"]) === documentId)
        .map((grant) => ({
          userId: String(grant["user_id"]),
          userName: String(grant["full_name"]),
          userEmail: String(grant["email"]),
          accessLevel: grant["access_level"] as DocumentAccessLevel,
        })),
    };
  });
  return {
    documents,
    categories: (categoriesResult[0] as RowDataPacket[]).map((row) => ({
      id: String(row["id"]),
      name: String(row["name"]),
      description: String(row["description"] || ""),
      color: String(row["color"] || "violet"),
    })),
    users: (usersResult[0] as RowDataPacket[]).map((row) => ({
      id: String(row["id"]),
      fullName: String(row["full_name"]),
      email: String(row["email"]),
    })),
    currentUserId: user.id,
  };
}

export async function createDocumentCategoryServer(
  data: { name: string; description?: string; color?: string },
  user: AuthUser,
) {
  const name = text(data.name, 160);
  if (!name) throw new Error("Category name is required");
  const { getPool } = await import("./db.server");
  const id = randomUUID();
  await getPool().execute(
    `INSERT INTO document_categories (id, name, description, color, created_by)
     VALUES (?, ?, ?, ?, ?)`,
    [id, name, text(data.description, 2000) || null, text(data.color, 30) || "violet", user.id],
  );
  return { id };
}

export async function createDocumentServer(
  data: {
    id: string;
    title: string;
    categoryId?: string;
    ownerId?: string;
    entityType?: string;
    entityId?: string;
    issueDate?: string;
    expiryDate?: string;
    notes?: string;
    attachment: ManagedAttachment;
    versionNotes?: string;
  },
  user: AuthUser,
) {
  if (!uuid.test(data.id)) throw new Error("Invalid document ID");
  const title = text(data.title, 255);
  if (!title) throw new Error("Document title is required");
  if (!data.attachment?.path.startsWith(`${data.id}/`)) throw new Error("Invalid document file");
  const { getPool } = await import("./db.server");
  const connection = await getPool().getConnection();
  try {
    await connection.beginTransaction();
    const categoryId = uuid.test(data.categoryId || "") ? data.categoryId! : null;
    const ownerId = uuid.test(data.ownerId || "") ? data.ownerId! : user.id;
    const [lookup] = await connection.execute(
      `SELECT (SELECT name FROM document_categories WHERE id = ?) AS category_name,
              (SELECT full_name FROM system_users WHERE id = ?) AS owner_name`,
      [categoryId, ownerId],
    );
    const names = (lookup as Array<{ category_name: string | null; owner_name: string | null }>)[0];
    await connection.execute(
      `INSERT INTO documents
        (id, title, category, category_id, entity_type, entity_id, owner, owner_id, version,
         file_url, issue_date, expiry_date, notes, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'v1', ?, ?, ?, ?, 'active')`,
      [
        data.id,
        title,
        names?.category_name || "General",
        categoryId,
        text(data.entityType, 40) || "general",
        uuid.test(data.entityId || "") ? data.entityId! : null,
        names?.owner_name || "",
        ownerId,
        `/api/attachments/${data.attachment.path}`,
        date(data.issueDate),
        date(data.expiryDate),
        text(data.notes, 10000) || null,
      ],
    );
    await connection.execute(
      `INSERT INTO document_versions
        (id, document_id, version_number, attachment_path, file_name, content_type, file_size, notes, created_by)
       VALUES (?, ?, 1, ?, ?, ?, ?, ?, ?)`,
      [
        randomUUID(),
        data.id,
        data.attachment.path,
        text(data.attachment.name, 500),
        text(data.attachment.type, 255) || "application/octet-stream",
        Number(data.attachment.size || 0),
        text(data.versionNotes, 2000) || null,
        user.id,
      ],
    );
    await connection.commit();
    return { id: data.id };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

export async function addDocumentVersionServer(
  data: { documentId: string; attachment: ManagedAttachment; notes?: string },
  user: AuthUser,
) {
  const { getPool } = await import("./db.server");
  const connection = await getPool().getConnection();
  try {
    await connection.beginTransaction();
    await requireDocumentLevel(data.documentId, "edit", user, connection);
    if (!data.attachment?.path.startsWith(`${data.documentId}/`))
      throw new Error("Invalid document file");
    const [rows] = await connection.execute(
      "SELECT COALESCE(MAX(version_number), 0) + 1 AS next_version FROM document_versions WHERE document_id = ? FOR UPDATE",
      [data.documentId],
    );
    const versionNumber = Number((rows as Array<{ next_version: number }>)[0]?.next_version || 1);
    await connection.execute(
      `INSERT INTO document_versions
        (id, document_id, version_number, attachment_path, file_name, content_type, file_size, notes, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        randomUUID(),
        data.documentId,
        versionNumber,
        data.attachment.path,
        text(data.attachment.name, 500),
        text(data.attachment.type, 255) || "application/octet-stream",
        Number(data.attachment.size || 0),
        text(data.notes, 2000) || null,
        user.id,
      ],
    );
    await connection.execute(
      "UPDATE documents SET version = ?, file_url = ?, updated_at = CURRENT_TIMESTAMP(3) WHERE id = ?",
      [`v${versionNumber}`, `/api/attachments/${data.attachment.path}`, data.documentId],
    );
    await connection.commit();
    return { versionNumber };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

export async function updateDocumentServer(
  data: {
    id: string;
    title: string;
    categoryId?: string;
    ownerId?: string;
    status?: string;
    entityType?: string;
    issueDate?: string;
    expiryDate?: string;
    notes?: string;
  },
  user: AuthUser,
) {
  await requireDocumentLevel(data.id, "manage", user);
  const { getPool } = await import("./db.server");
  const categoryId = uuid.test(data.categoryId || "") ? data.categoryId! : null;
  const ownerId = uuid.test(data.ownerId || "") ? data.ownerId! : null;
  const [lookup] = await getPool().execute(
    `SELECT (SELECT name FROM document_categories WHERE id = ?) AS category_name,
            (SELECT full_name FROM system_users WHERE id = ?) AS owner_name`,
    [categoryId, ownerId],
  );
  const names = (lookup as Array<{ category_name: string | null; owner_name: string | null }>)[0];
  const title = text(data.title, 255);
  if (!title) throw new Error("Document title is required");
  await getPool().execute(
    `UPDATE documents
        SET title = ?, category_id = ?, category = ?, owner_id = ?, owner = ?, status = ?,
            entity_type = ?, issue_date = ?, expiry_date = ?, notes = ?
      WHERE id = ?`,
    [
      title,
      categoryId,
      names?.category_name || "General",
      ownerId,
      names?.owner_name || "",
      ["active", "draft", "archived"].includes(text(data.status, 30))
        ? text(data.status, 30)
        : "active",
      text(data.entityType, 40) || "general",
      date(data.issueDate),
      date(data.expiryDate),
      text(data.notes, 10000) || null,
      data.id,
    ],
  );
  return { id: data.id };
}

export async function setDocumentAccessServer(
  data: { documentId: string; grants: Array<{ userId: string; accessLevel: DocumentAccessLevel }> },
  user: AuthUser,
) {
  const document = await requireDocumentLevel(data.documentId, "manage", user);
  const grants = (data.grants || []).filter(
    (grant) =>
      uuid.test(grant.userId) &&
      grant.userId !== document.owner_id &&
      ["view", "edit", "manage"].includes(grant.accessLevel),
  );
  const { getPool } = await import("./db.server");
  const connection = await getPool().getConnection();
  try {
    await connection.beginTransaction();
    await connection.execute("DELETE FROM document_access WHERE document_id = ?", [
      data.documentId,
    ]);
    for (const grant of grants) {
      await connection.execute(
        `INSERT INTO document_access (document_id, user_id, access_level, granted_by)
         VALUES (?, ?, ?, ?)`,
        [data.documentId, grant.userId, grant.accessLevel, user.id],
      );
    }
    await connection.commit();
    return { count: grants.length };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}
