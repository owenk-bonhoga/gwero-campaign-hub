import { validateContract } from "./input-contract";
import { randomUUID } from "node:crypto";
import type { RowDataPacket } from "mysql2/promise";
import { createServerFn } from "@tanstack/react-start";
import { permissionMiddleware } from "./auth.middleware";
import type {
  DocumentMark,
  MarkApplication,
  MarkingDocument,
  StampDesign,
} from "./document-marks.types";
import { centeredPdfPlacement } from "./document-mark-placement";

const permission = permissionMiddleware("documents.manage");
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function text(value: unknown, max: number) {
  return String(value ?? "")
    .trim()
    .slice(0, max);
}

function bounded(value: unknown, fallback: number, min: number, max: number) {
  const parsed = Number(value);
  return Math.max(min, Math.min(max, Number.isFinite(parsed) ? parsed : fallback));
}

function design(value: unknown): StampDesign {
  const source = (value && typeof value === "object" ? value : {}) as Record<string, unknown>;
  const shape = ["oval", "rectangle", "circle"].includes(String(source["shape"]))
    ? (String(source["shape"]) as StampDesign["shape"])
    : "oval";
  const color = /^#[0-9a-f]{6}$/i.test(String(source["color"]))
    ? String(source["color"])
    : "#1d4ed8";
  return {
    primaryText: text(source["primaryText"], 80) || "RECEIVED",
    secondaryText: text(source["secondaryText"], 100),
    includeDate: source["includeDate"] !== false,
    datePrefix: text(source["datePrefix"], 30) || "DATE",
    color,
    shape,
    distressed: bounded(source["distressed"], 0, 0, 100),
    rotation: bounded(source["rotation"], 0, -15, 15),
  };
}

function savedDesign(value: unknown) {
  try {
    return design(JSON.parse(String(value || "{}")));
  } catch {
    return design({});
  }
}

export const getDocumentMarkWorkspace = createServerFn({ method: "GET" })
  .middleware([permission])
  .handler(async () => {
    const { getPool } = await import("./db.server");
    const db = getPool();
    const [markRows, documentRows, applicationRows] = await Promise.all([
      db.execute(
        `SELECT m.*, COALESCE(u.full_name, 'Unknown') AS created_by_name
           FROM document_marks m LEFT JOIN system_users u ON u.id = m.created_by
          WHERE m.status = 'active' ORDER BY m.mark_type, m.name`,
      ),
      db.execute(
        `SELECT d.id, d.title, d.category, d.owner, v.attachment_path, v.file_name, v.version_number
           FROM documents d
           JOIN document_versions v ON v.document_id = d.id
          WHERE v.version_number = (SELECT MAX(v2.version_number) FROM document_versions v2 WHERE v2.document_id = d.id)
            AND (v.content_type = 'application/pdf' OR v.file_name LIKE '%.pdf')
          ORDER BY d.updated_at DESC`,
      ),
      db.execute(
        `SELECT a.*, m.name AS mark_name, COALESCE(u.full_name, 'Unknown') AS applied_by_name
           FROM document_mark_applications a
           JOIN document_marks m ON m.id = a.mark_id
           LEFT JOIN system_users u ON u.id = a.applied_by
          ORDER BY a.created_at DESC LIMIT 100`,
      ),
    ]);
    const marks = (markRows[0] as RowDataPacket[]).map((row): DocumentMark => ({
      id: String(row["id"]),
      name: String(row["name"]),
      type: row["mark_type"] === "signature" ? "signature" : "stamp",
      design: row["mark_type"] === "stamp" ? savedDesign(row["design_json"]) : null,
      imagePath: String(row["image_attachment_path"] || ""),
      createdByName: String(row["created_by_name"] || "Unknown"),
      updatedAt: new Date(row["updated_at"] as string).toISOString(),
    }));
    const documents = (documentRows[0] as RowDataPacket[]).map((row): MarkingDocument => ({
      id: String(row["id"]),
      title: String(row["title"]),
      category: String(row["category"] || "General"),
      owner: String(row["owner"] || "Unassigned"),
      attachmentPath: String(row["attachment_path"]),
      fileName: String(row["file_name"]),
      versionNumber: Number(row["version_number"] || 1),
    }));
    const applications = (applicationRows[0] as RowDataPacket[]).map((row): MarkApplication => ({
      id: String(row["id"]),
      sourceName: String(row["source_name"]),
      outputName: String(row["output_name"]),
      outputPath: String(row["output_attachment_path"]),
      markName: String(row["mark_name"]),
      markType: row["mark_type"] === "signature" ? "signature" : "stamp",
      pageNumber: Number(row["page_number"]),
      appliedDate: String(row["applied_date"] || ""),
      appliedByName: String(row["applied_by_name"] || "Unknown"),
      createdAt: new Date(row["created_at"] as string).toISOString(),
    }));
    return { marks, documents, applications };
  });

export const saveStamp = createServerFn({ method: "POST" })
  .middleware([permission])
  .validator((data: { id?: string; name: string; design: StampDesign }) =>
    validateContract(data, "saveStamp"),
  )
  .handler(async ({ data, context }) => {
    const id = uuid.test(data.id || "") ? data.id! : randomUUID();
    const name = text(data.name, 160);
    if (!name) throw new Error("Stamp name is required.");
    const { getPool } = await import("./db.server");
    await getPool().execute(
      `INSERT INTO document_marks (id, name, mark_type, design_json, created_by, updated_by)
       VALUES (?, ?, 'stamp', ?, ?, ?)
       ON DUPLICATE KEY UPDATE name = VALUES(name), design_json = VALUES(design_json),
         updated_by = VALUES(updated_by), status = 'active'`,
      [id, name, JSON.stringify(design(data.design)), context.user.id, context.user.id],
    );
    return { id };
  });

export const saveSignature = createServerFn({ method: "POST" })
  .middleware([permission])
  .validator((data: { id: string; name: string; imagePath: string }) =>
    validateContract(data, "saveSignature"),
  )
  .handler(async ({ data, context }) => {
    if (!uuid.test(data.id) || !data.imagePath.startsWith(`${data.id}/`))
      throw new Error("Invalid signature image.");
    const name = text(data.name, 160);
    if (!name) throw new Error("Signature name is required.");
    const { getPool } = await import("./db.server");
    await getPool().execute(
      `INSERT INTO document_marks
        (id, name, mark_type, image_attachment_path, created_by, updated_by)
       VALUES (?, ?, 'signature', ?, ?, ?)`,
      [data.id, name, data.imagePath, context.user.id, context.user.id],
    );
    return { id: data.id };
  });

export const archiveDocumentMark = createServerFn({ method: "POST" })
  .middleware([permission])
  .validator((data: { id: string }) =>
    validateContract({ id: text(data?.id, 36) }, "archiveDocumentMark"),
  )
  .handler(async ({ data, context }) => {
    if (!uuid.test(data.id)) throw new Error("Invalid mark.");
    const { getPool } = await import("./db.server");
    await getPool().execute(
      "UPDATE document_marks SET status = 'archived', updated_by = ? WHERE id = ?",
      [context.user.id, data.id],
    );
    return { ok: true };
  });

type DocumentMarkPlacementInput = {
  markId: string;
  pageNumber: number;
  xRatio: number;
  yRatio: number;
  widthRatio: number;
  rotation: number;
  appliedDate: string;
  imagePng?: string;
};

export const applyDocumentMarks = createServerFn({ method: "POST" })
  .middleware([permission])
  .validator((data: { sourcePath: string; placements: DocumentMarkPlacementInput[] }) =>
    validateContract(data, "applyDocumentMarks"),
  )
  .handler(async ({ data, context }) => {
    const [ownerId, fileId] = String(data.sourcePath || "").split("/");
    if (!uuid.test(ownerId || "") || !uuid.test(fileId || "")) throw new Error("Invalid document.");
    if (!Array.isArray(data.placements) || !data.placements.length)
      throw new Error("Add at least one stamp or signature placement.");
    if (data.placements.length > 50)
      throw new Error("A document can contain up to 50 placements at a time.");
    if (data.placements.some((placement) => !uuid.test(placement.markId)))
      throw new Error("One of the selected stamps or signatures is invalid.");
    const attachmentOwnerId = ownerId!;
    const attachmentFileId = fileId!;
    const { requireAttachmentAccess } = await import("./attachment-access.server");
    await requireAttachmentAccess(attachmentOwnerId, true);
    const { getPool } = await import("./db.server");
    const db = getPool();
    const markIds = [...new Set(data.placements.map((placement) => placement.markId))];
    const [markRows] = await db.execute(
      `SELECT * FROM document_marks
        WHERE id IN (${markIds.map(() => "?").join(", ")}) AND status = 'active'`,
      markIds,
    );
    const marks = new Map(
      (markRows as RowDataPacket[]).map((row) => [String(row["id"]), row] as const),
    );
    if (marks.size !== markIds.length)
      throw new Error("One of the selected stamps or signatures no longer exists.");
    const { readAttachmentRecord, saveAttachmentBuffer } = await import("./attachments.server");
    const source = await readAttachmentRecord(`${attachmentOwnerId}/${attachmentFileId}`);
    if (source.type !== "application/pdf" && !source.name.toLowerCase().endsWith(".pdf"))
      throw new Error("Stamps and signatures can currently be applied to PDF documents.");
    const { PDFDocument, degrees } = await import("pdf-lib");
    const pdf = await PDFDocument.load(source.content);
    const normalizedPlacements = [];
    const signatureImages = new Map<string, Awaited<ReturnType<typeof pdf.embedPng>>>();
    for (const placement of data.placements) {
      const mark = marks.get(placement.markId)!;
      const pageIndex = Math.floor(bounded(placement.pageNumber, 1, 1, pdf.getPageCount())) - 1;
      const page = pdf.getPage(pageIndex);
      let embedded = signatureImages.get(placement.markId);
      if (!embedded || mark["mark_type"] !== "signature") {
        let imageBytes: Uint8Array;
        const suppliedImage = String(placement.imagePng || "").match(
          /^data:image\/png;base64,([a-z0-9+/=]+)$/i,
        )?.[1];
        if (suppliedImage && suppliedImage.length <= 3_000_000) {
          imageBytes = new Uint8Array(Buffer.from(suppliedImage, "base64"));
        } else if (mark["mark_type"] === "signature") {
          const image = await readAttachmentRecord(String(mark["image_attachment_path"] || ""));
          imageBytes = new Uint8Array(image.content);
        } else {
          const encodedStamp = suppliedImage;
          if (!encodedStamp || encodedStamp.length > 2_000_000)
            throw new Error("One of the stamp previews is invalid.");
          imageBytes = new Uint8Array(Buffer.from(encodedStamp, "base64"));
        }
        try {
          embedded = await pdf.embedPng(imageBytes);
        } catch {
          embedded = await pdf.embedJpg(imageBytes);
        }
        if (mark["mark_type"] === "signature") signatureImages.set(placement.markId, embedded);
      }
      const widthRatio = bounded(placement.widthRatio, 0.14, 0.03, 0.65);
      const xRatio = bounded(placement.xRatio, 0.5, 0, 1);
      const yRatio = bounded(placement.yRatio, 0.5, 0, 1);
      const rotation = bounded(placement.rotation, 0, -25, 25);
      const width = page.getWidth() * widthRatio;
      const height = width * (embedded.height / embedded.width);
      // pdf-lib rotates around the image's lower-left corner while CSS rotates around its
      // centre. Offset that corner so the rendered PDF matches the exact-page preview.
      const { x, y } = centeredPdfPlacement({
        pageWidth: page.getWidth(),
        pageHeight: page.getHeight(),
        imageWidth: width,
        imageHeight: height,
        xRatio,
        yRatio,
        rotation,
      });
      page.drawImage(embedded, {
        x,
        y,
        width,
        height,
        rotate: degrees(rotation),
        opacity: mark["mark_type"] === "stamp" ? 0.86 : 0.96,
      });
      normalizedPlacements.push({
        mark,
        pageIndex,
        xRatio,
        yRatio,
        widthRatio,
        rotation,
        appliedDate: /^\d{4}-\d{2}-\d{2}$/.test(placement.appliedDate || "")
          ? placement.appliedDate
          : null,
      });
    }
    const outputBytes = await pdf.save();
    const markTypes = new Set(normalizedPlacements.map(({ mark }) => String(mark["mark_type"])));
    const suffix =
      markTypes.size > 1 ? "signed-stamped" : markTypes.has("signature") ? "signed" : "stamped";
    const outputName = `${source.name.replace(/\.pdf$/i, "")}-${suffix}-${Date.now()}.pdf`;
    const output = await saveAttachmentBuffer(
      attachmentOwnerId,
      outputBytes,
      outputName,
      "application/pdf",
      context.user.id,
    );
    // A signed file is a new tender document, never a replacement. Keeping the source row
    // preserves the unsigned original and makes every generated variant visible in the workspace.
    await db.execute(
      `INSERT INTO opportunity_documents
        (id, opportunity_type, opportunity_id, checklist_item_id, document_id, attachment_path,
         display_name, content_type, file_size, document_role, include_in_submission,
         outgoing_name, created_by)
       SELECT UUID(), opportunity_type, opportunity_id, checklist_item_id, document_id, ?, ?, ?, ?,
              document_role, include_in_submission, ?, ?
         FROM opportunity_documents
        WHERE attachment_path = ? AND (opportunity_id = ? OR document_id = ?)`,
      [
        output.path,
        output.name,
        output.type,
        output.size,
        output.name,
        context.user.id,
        `${attachmentOwnerId}/${attachmentFileId}`,
        attachmentOwnerId,
        attachmentOwnerId,
      ],
    );
    await db.execute(
      `UPDATE opportunity_documents
          SET include_in_submission = FALSE
        WHERE attachment_path = ? AND (opportunity_id = ? OR document_id = ?)`,
      [`${attachmentOwnerId}/${attachmentFileId}`, attachmentOwnerId, attachmentOwnerId],
    );
    const applicationIds: string[] = [];
    for (const placement of normalizedPlacements) {
      const applicationId = randomUUID();
      applicationIds.push(applicationId);
      await db.execute(
        `INSERT INTO document_mark_applications
          (id, source_attachment_path, output_attachment_path, source_name, output_name,
           mark_id, mark_type, page_number, x_ratio, y_ratio, width_ratio, rotation,
           applied_date, applied_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          applicationId,
          `${attachmentOwnerId}/${attachmentFileId}`,
          output.path,
          source.name,
          outputName,
          String(placement.mark["id"]),
          placement.mark["mark_type"],
          placement.pageIndex + 1,
          placement.xRatio,
          placement.yRatio,
          placement.widthRatio,
          placement.rotation,
          placement.appliedDate,
          context.user.id,
        ],
      );
    }
    const [documentRows] = await db.execute("SELECT id FROM documents WHERE id = ? LIMIT 1", [
      attachmentOwnerId,
    ]);
    let versionNumber: number | null = null;
    if ((documentRows as RowDataPacket[])[0]) {
      const { addDocumentVersionServer } = await import("./documents.server");
      const version = await addDocumentVersionServer(
        {
          documentId: attachmentOwnerId,
          attachment: output,
          notes: `Applied ${normalizedPlacements.length} stamp/signature placement${normalizedPlacements.length === 1 ? "" : "s"} across ${new Set(normalizedPlacements.map((placement) => placement.pageIndex)).size} page${new Set(normalizedPlacements.map((placement) => placement.pageIndex)).size === 1 ? "" : "s"}`,
        },
        context.user,
      );
      versionNumber = version.versionNumber;
    }
    return { applicationIds, output, versionNumber };
  });
