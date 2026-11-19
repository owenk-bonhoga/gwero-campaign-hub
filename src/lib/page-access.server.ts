import type { AuthUser } from "./auth.server";
import { mayAccessPage } from "./page-access";

export async function requirePageAccess(page: string, user: AuthUser): Promise<void> {
  if (!mayAccessPage(page, user.permissions)) throw new Error("Permission denied");
  const url = new URL(page, "https://gwero.invalid");
  const match = url.pathname.match(/^\/documents\/([0-9a-f-]{36})\/?$/i);
  const documentId =
    match?.[1] || (url.pathname === "/documents" ? url.searchParams.get("document") : null);
  if (documentId) {
    const { requireDocumentLevel } = await import("./documents.server");
    await requireDocumentLevel(documentId, "view", user);
  }
}

export async function requireNoteAccess(noteId: string, user: AuthUser, comment = false) {
  const { getPool } = await import("./db.server");
  const [rows] = await getPool().execute(
    comment
      ? "SELECT n.page_key FROM page_notes n JOIN page_note_comments c ON c.note_id=n.id WHERE c.id=? LIMIT 1"
      : "SELECT page_key FROM page_notes WHERE id=? LIMIT 1",
    [noteId],
  );
  const row = (rows as Array<{ page_key: string }>)[0];
  if (!row) throw new Error("Sticky note not found.");
  await requirePageAccess(row.page_key, user);
}
