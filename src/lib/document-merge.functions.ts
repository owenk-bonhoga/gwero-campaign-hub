import { validateContract } from "./input-contract";
import { createServerFn } from "@tanstack/react-start";
import { permissionMiddleware } from "./auth.middleware";
import type { OpportunityKind } from "./opportunities.functions";

export type MergeSourceKind = "tender" | "library";
export type MergeSourceRef = { kind: MergeSourceKind; id: string };
export type MergePageRef = MergeSourceRef & { pageIndex: number };

type MergeInput = {
  kind: OpportunityKind;
  opportunityId: string;
  outputName: string;
  sources: MergeSourceRef[];
  pages?: MergePageRef[];
};

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const kinds = new Set<OpportunityKind>(["bid", "eoi", "rfp", "rfq"]);
const maxSources = 30;
const maxPages = 300;
const maxInputBytes = 100 * 1024 * 1024;

function safePdfName(value: string) {
  const name = [...String(value || "merged-document")]
    .map((character) =>
      character.charCodeAt(0) < 32 || '<>:"/\\|?*'.includes(character) ? "_" : character,
    )
    .join("")
    .trim()
    .slice(0, 180);
  return `${name.replace(/\.pdf$/i, "") || "merged-document"}.pdf`;
}

function validate(input: MergeInput) {
  if (!kinds.has(input.kind)) throw new Error("Invalid opportunity type.");
  if (!uuid.test(input.opportunityId)) throw new Error("Invalid opportunity.");
  if (!Array.isArray(input.sources) || input.sources.length < 2)
    throw new Error("Choose at least two PDF documents to merge.");
  if (input.sources.length > maxSources)
    throw new Error(`You can merge up to ${maxSources} documents at a time.`);
  const keys = new Set<string>();
  for (const source of input.sources) {
    if (!uuid.test(source.id) || !["tender", "library"].includes(source.kind))
      throw new Error("One of the selected documents is invalid.");
    const key = `${source.kind}:${source.id}`;
    if (keys.has(key)) throw new Error("A document was selected more than once.");
    keys.add(key);
  }
  if (input.pages) {
    if (!input.pages.length) throw new Error("Keep at least one page in the merged document.");
    if (input.pages.length > maxPages)
      throw new Error(`A merged document can contain up to ${maxPages} pages.`);
    for (const page of input.pages) {
      if (!keys.has(`${page.kind}:${page.id}`) || !Number.isInteger(page.pageIndex))
        throw new Error("The page arrangement is invalid.");
    }
  }
}

type ResolvedSource = MergeSourceRef & {
  name: string;
  path: string;
  contentType: string;
};

export const mergeOpportunityDocuments = createServerFn({ method: "POST" })
  .middleware([permissionMiddleware("opportunities.manage")])
  .validator((data: MergeInput) => validateContract(data, "mergeOpportunityDocuments"))
  .handler(async ({ data, context }) => {
    validate(data);
    const [{ getPool }, { readAttachmentRecord, saveAttachmentBuffer }, { PDFDocument }] =
      await Promise.all([import("./db.server"), import("./attachments.server"), import("pdf-lib")]);
    const db = getPool();

    const opportunityTable =
      data.kind === "bid" ? "bids" : data.kind === "eoi" ? "prequalifications" : "requests";
    const [opportunityRows] = await db.execute(
      `SELECT id FROM ${opportunityTable} WHERE id = ?${opportunityTable === "requests" ? " AND request_type = ?" : ""} LIMIT 1`,
      opportunityTable === "requests" ? [data.opportunityId, data.kind] : [data.opportunityId],
    );
    if (!(opportunityRows as Array<{ id: string }>)[0]) throw new Error("Opportunity not found.");

    const resolved: ResolvedSource[] = [];
    for (const source of data.sources) {
      if (source.kind === "tender") {
        const [rows] = await db.execute(
          `SELECT od.display_name, od.attachment_path, od.content_type
             FROM opportunity_documents od
            WHERE od.id = ? AND od.opportunity_type = ? AND od.opportunity_id = ?
              AND od.attachment_path IS NOT NULL LIMIT 1`,
          [source.id, data.kind, data.opportunityId],
        );
        const row = (
          rows as Array<{
            display_name: string;
            attachment_path: string;
            content_type: string | null;
          }>
        )[0];
        if (!row) throw new Error("A selected tender document is no longer available.");
        resolved.push({
          ...source,
          name: row.display_name,
          path: row.attachment_path,
          contentType: row.content_type || "",
        });
      } else {
        const [rows] = await db.execute(
          `SELECT d.title, v.attachment_path, v.file_name, v.content_type
             FROM documents d
             JOIN document_versions v ON v.document_id = d.id
             LEFT JOIN document_access da ON da.document_id = d.id AND da.user_id = ?
            WHERE d.id = ?
              AND v.version_number = (SELECT MAX(v2.version_number) FROM document_versions v2 WHERE v2.document_id = d.id)
              AND (? = 1 OR d.owner_id = ? OR d.owner_id IS NULL OR da.user_id IS NOT NULL)
            LIMIT 1`,
          [
            context.user.id,
            source.id,
            context.user.roleName === "Administrator" ? 1 : 0,
            context.user.id,
          ],
        );
        const row = (
          rows as Array<{
            title: string;
            attachment_path: string;
            file_name: string;
            content_type: string;
          }>
        )[0];
        if (!row) throw new Error("A selected library document is unavailable or restricted.");
        resolved.push({
          ...source,
          name: row.file_name || row.title,
          path: row.attachment_path,
          contentType: row.content_type,
        });
      }
    }

    const loaded = new Map<string, Awaited<ReturnType<typeof PDFDocument.load>>>();
    let inputBytes = 0;
    for (const source of resolved) {
      const file = await readAttachmentRecord(source.path);
      if (
        file.type !== "application/pdf" &&
        source.contentType !== "application/pdf" &&
        !file.name.toLowerCase().endsWith(".pdf")
      )
        throw new Error(`${source.name} is not a PDF document.`);
      inputBytes += file.content.byteLength;
      if (inputBytes > maxInputBytes)
        throw new Error("The selected documents exceed the 100 MB merge limit.");
      try {
        loaded.set(`${source.kind}:${source.id}`, await PDFDocument.load(file.content));
      } catch {
        throw new Error(`${source.name} is encrypted, damaged, or not a valid PDF.`);
      }
    }

    const plan =
      data.pages ||
      resolved.flatMap((source) => {
        const document = loaded.get(`${source.kind}:${source.id}`)!;
        return document.getPageIndices().map((pageIndex) => ({ ...source, pageIndex }));
      });
    if (!plan.length) throw new Error("The selected PDFs do not contain any pages.");
    if (plan.length > maxPages)
      throw new Error(`A merged document can contain up to ${maxPages} pages.`);

    const output = await PDFDocument.create();
    for (const page of plan) {
      const document = loaded.get(`${page.kind}:${page.id}`);
      if (!document || page.pageIndex < 0 || page.pageIndex >= document.getPageCount())
        throw new Error("The page arrangement no longer matches the selected documents.");
      const [copied] = await output.copyPages(document, [page.pageIndex]);
      output.addPage(copied);
    }
    output.setProducer("Gwero OS");
    output.setCreator(context.user.fullName || "Gwero OS");
    output.setTitle(safePdfName(data.outputName).replace(/\.pdf$/i, ""));
    const bytes = await output.save({ useObjectStreams: true });
    const name = safePdfName(data.outputName);
    const attachment = await saveAttachmentBuffer(
      data.opportunityId,
      bytes,
      name,
      "application/pdf",
      context.user.id,
    );
    await db.execute(
      `INSERT INTO opportunity_documents
        (id, opportunity_type, opportunity_id, attachment_path, display_name, content_type,
         file_size, document_role, include_in_submission, outgoing_name, created_by)
       VALUES (?, ?, ?, ?, ?, 'application/pdf', ?, 'merged', FALSE, ?, ?)`,
      [
        crypto.randomUUID(),
        data.kind,
        data.opportunityId,
        attachment.path,
        name,
        attachment.size,
        name,
        context.user.id,
      ],
    );
    return { ...attachment, pageCount: plan.length };
  });
