import { createFileRoute } from "@tanstack/react-router";
import { createHmac, randomUUID } from "node:crypto";
import { attachmentHeaders, attachmentPreviewHeaders } from "@/lib/attachment-policy";

export const Route = createFileRoute("/api/secure-share/document/$itemId")({
  server: {
    handlers: {
      GET: async ({ params, request }) => {
        const headers = {
          "cache-control": "private, no-store",
          "x-content-type-options": "nosniff",
          "referrer-policy": "no-referrer",
        };
        try {
          const { requireVerifiedSecureShare } = await import("@/lib/secure-share-session.server");
          const session = await requireVerifiedSecureShare();
          const { getPool } = await import("@/lib/db.server");
          const db = getPool();
          const [rows] = await db.execute(
            `SELECT i.id,i.share_id,v.attachment_path,v.file_name,v.content_type,v.file_size
               FROM secure_document_share_items i
               JOIN document_versions v ON v.id=i.version_id
              WHERE i.id=? AND i.share_id=? LIMIT 1`,
            [params.itemId, String(session["share_id"])],
          );
          const item = (
            rows as Array<{
              id: string;
              share_id: string;
              attachment_path: string;
              file_name: string;
              content_type: string;
              file_size: number;
            }>
          )[0];
          if (!item) return new Response("Document not found", { status: 404, headers });
          const url = new URL(request.url);
          const download = url.searchParams.get("download") === "1";
          const { secureShareMayServe } = await import("@/lib/secure-share-security");
          if (!secureShareMayServe(Boolean(session["allow_download"]), download))
            return new Response("Download permission was not granted for this secure share.", {
              status: 403,
              headers,
            });
          if (url.searchParams.get("metadata") === "1")
            return Response.json(
              {
                name: item.file_name,
                type: item.content_type,
                size: item.file_size,
                allowDownload: Boolean(session["allow_download"]),
              },
              { headers },
            );
          const { readAttachmentRecord } = await import("@/lib/attachments.server");
          const attachment = await readAttachmentRecord(item.attachment_path);
          const forwarded =
            request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
          const secret = process.env["SESSION_SECRET"] || "unconfigured-secure-share-secret";
          const ipHash = createHmac("sha256", secret).update(forwarded).digest("hex");
          await db.execute(
            "INSERT INTO secure_document_share_events (id,share_id,recipient_id,item_id,event_type,detail,ip_hash) VALUES (?,?,?,?,?,?,?)",
            [
              randomUUID(),
              item.share_id,
              String(session["recipient_id"]),
              item.id,
              download ? "document_downloaded" : "document_viewed",
              attachment.name,
              ipHash,
            ],
          );
          const body = attachment.content.buffer.slice(
            attachment.content.byteOffset,
            attachment.content.byteOffset + attachment.content.byteLength,
          ) as ArrayBuffer;
          return new Response(body, {
            headers: {
              ...(download
                ? attachmentHeaders(attachment.name, attachment.size)
                : attachmentPreviewHeaders(attachment.name, attachment.type, attachment.size)),
              "cross-origin-resource-policy": "same-origin",
              "referrer-policy": "no-referrer",
            },
          });
        } catch {
          return new Response("Secure document access is required.", { status: 401, headers });
        }
      },
    },
  },
});
