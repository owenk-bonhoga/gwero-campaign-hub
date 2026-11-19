import { useEffect, useMemo, useState } from "react";
import {
  Download,
  FileArchive,
  FileImage,
  FileSignature,
  FileSpreadsheet,
  FileText,
  LoaderCircle,
} from "lucide-react";
import { DocumentMarkingDialog, type MarkingSource } from "@/components/DocumentMarkingDialog";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type PreviewTarget = { url: string; name?: string; allowDownload?: boolean };
type Metadata = { name: string; type: string; size: number };
type PreviewData =
  | { kind: "frame"; url: string }
  | { kind: "image"; url: string }
  | { kind: "text"; text: string; label: string }
  | { kind: "sheet"; rows: string[][]; sheetName: string }
  | { kind: "unsupported" };

function withQuery(url: string, key: string, value: string) {
  const next = new URL(url, window.location.origin);
  next.searchParams.set(key, value);
  return `${next.pathname}${next.search}`;
}

function extension(name: string) {
  return name.split(".").pop()?.toLowerCase() || "";
}

function attachmentPath(url: string) {
  const parsed = new URL(url, window.location.origin);
  const match = parsed.pathname.match(/^\/api\/attachments\/([^/]+)\/([^/]+)$/);
  return match ? `${decodeURIComponent(match[1]!)}/${decodeURIComponent(match[2]!)}` : "";
}

function attachmentUrl(path: string) {
  const [ownerId, fileId] = path.split("/");
  return `/api/attachments/${encodeURIComponent(ownerId || "")}/${encodeURIComponent(fileId || "")}`;
}

function formatBytes(bytes: number) {
  if (!bytes) return "0 KB";
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

async function inflateRaw(bytes: Uint8Array) {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  const stream = new Blob([copy.buffer])
    .stream()
    .pipeThrough(new DecompressionStream("deflate-raw"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

async function readZipEntry(buffer: ArrayBuffer, wanted: string) {
  const bytes = new Uint8Array(buffer);
  const view = new DataView(buffer);
  let eocd = -1;
  for (let offset = bytes.length - 22; offset >= Math.max(0, bytes.length - 65_557); offset--) {
    if (view.getUint32(offset, true) === 0x06054b50) {
      eocd = offset;
      break;
    }
  }
  if (eocd < 0) throw new Error("This Word file is not a readable Office package.");
  const entries = view.getUint16(eocd + 10, true);
  let offset = view.getUint32(eocd + 16, true);
  const decoder = new TextDecoder();
  for (let index = 0; index < entries; index++) {
    if (view.getUint32(offset, true) !== 0x02014b50) break;
    const method = view.getUint16(offset + 10, true);
    const compressedSize = view.getUint32(offset + 20, true);
    const nameLength = view.getUint16(offset + 28, true);
    const extraLength = view.getUint16(offset + 30, true);
    const commentLength = view.getUint16(offset + 32, true);
    const localOffset = view.getUint32(offset + 42, true);
    const name = decoder.decode(bytes.slice(offset + 46, offset + 46 + nameLength));
    if (name === wanted) {
      const localNameLength = view.getUint16(localOffset + 26, true);
      const localExtraLength = view.getUint16(localOffset + 28, true);
      const start = localOffset + 30 + localNameLength + localExtraLength;
      const compressed = bytes.slice(start, start + compressedSize);
      if (method === 0) return compressed;
      if (method === 8) return inflateRaw(compressed);
      throw new Error("This Word document uses an unsupported compression format.");
    }
    offset += 46 + nameLength + extraLength + commentLength;
  }
  throw new Error("This Word file does not contain a document body.");
}

async function wordText(buffer: ArrayBuffer) {
  const xmlBytes = await readZipEntry(buffer, "word/document.xml");
  const xml = new DOMParser().parseFromString(new TextDecoder().decode(xmlBytes), "text/xml");
  const parserError = xml.querySelector("parsererror");
  if (parserError) throw new Error("The Word document preview could not be read.");
  const paragraphs = Array.from(xml.getElementsByTagName("w:p"))
    .map((paragraph) =>
      Array.from(paragraph.getElementsByTagName("w:t"))
        .map((node) => node.textContent || "")
        .join(""),
    )
    .filter((line) => line.trim());
  return paragraphs.join("\n\n") || "This document contains no previewable text.";
}

async function loadPreview(target: PreviewTarget, metadata: Metadata): Promise<PreviewData> {
  const ext = extension(metadata.name);
  const inlineUrl = withQuery(target.url, "inline", "1");
  if (metadata.type === "application/pdf" || ext === "pdf")
    return { kind: "frame", url: inlineUrl };
  if (metadata.type.startsWith("image/")) return { kind: "image", url: inlineUrl };
  if (["text/plain", "text/csv"].includes(metadata.type) || ["txt", "csv"].includes(ext)) {
    const response = await fetch(inlineUrl);
    if (!response.ok) throw new Error("The document preview could not be loaded.");
    return { kind: "text", text: await response.text(), label: ext === "csv" ? "CSV" : "Text" };
  }
  if (ext === "docx") {
    const response = await fetch(inlineUrl);
    if (!response.ok) throw new Error("The Word document could not be loaded.");
    return {
      kind: "text",
      text: await wordText(await response.arrayBuffer()),
      label: "Word document",
    };
  }
  if (ext === "xlsx" || ext === "xls") {
    const response = await fetch(inlineUrl);
    if (!response.ok) throw new Error("The spreadsheet could not be loaded.");
    const XLSX = await import("xlsx");
    const workbook = XLSX.read(await response.arrayBuffer(), { type: "array" });
    const sheetName = workbook.SheetNames[0] || "Sheet 1";
    const sheet = workbook.Sheets[sheetName];
    const rows = sheet
      ? (XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" }) as unknown[][])
          .slice(0, 150)
          .map((row) => row.slice(0, 30).map((cell) => String(cell)))
      : [];
    return { kind: "sheet", rows, sheetName };
  }
  return { kind: "unsupported" };
}

function PreviewBody({ preview }: { preview: PreviewData }) {
  if (preview.kind === "frame")
    return <iframe title="Document preview" src={preview.url} className="h-full w-full bg-white" />;
  if (preview.kind === "image")
    return (
      <div className="flex h-full items-center justify-center overflow-auto bg-slate-100 p-6">
        <img
          src={preview.url}
          alt="Document preview"
          className="max-h-full max-w-full object-contain"
        />
      </div>
    );
  if (preview.kind === "text")
    return (
      <div className="h-full overflow-auto bg-slate-100 p-4 md:p-8">
        <article className="mx-auto min-h-full max-w-4xl rounded-xl bg-white px-6 py-8 shadow-sm md:px-12">
          <p className="mb-5 text-xs font-semibold uppercase tracking-wide text-cyan-700">
            {preview.label} preview
          </p>
          <pre className="whitespace-pre-wrap break-words font-sans text-sm leading-7 text-slate-800">
            {preview.text}
          </pre>
        </article>
      </div>
    );
  if (preview.kind === "sheet")
    return (
      <div className="h-full overflow-auto bg-slate-100 p-4">
        <div className="min-w-max overflow-hidden rounded-xl border bg-white shadow-sm">
          <div className="border-b bg-emerald-50 px-4 py-2 text-xs font-semibold text-emerald-800">
            {preview.sheetName} · showing up to 150 rows
          </div>
          <table className="border-collapse text-xs">
            <tbody>
              {preview.rows.map((row, rowIndex) => (
                <tr key={rowIndex} className={rowIndex === 0 ? "bg-slate-50 font-semibold" : ""}>
                  <th className="border-b border-r px-2 py-1.5 text-right font-normal text-slate-400">
                    {rowIndex + 1}
                  </th>
                  {row.map((cell, columnIndex) => (
                    <td key={columnIndex} className="max-w-80 border-b border-r px-3 py-1.5">
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  return (
    <div className="grid h-full place-items-center bg-slate-50 p-8 text-center">
      <div>
        <FileArchive className="mx-auto size-12 text-slate-300" />
        <p className="mt-4 font-semibold text-slate-800">
          Preview is not available for this format
        </p>
        <p className="mt-1 max-w-md text-sm text-muted-foreground">
          The file is still protected inside Gwero and can be downloaded from this viewer.
        </p>
      </div>
    </div>
  );
}

export function GlobalDocumentViewer({
  initialTarget,
}: { initialTarget?: PreviewTarget | undefined } = {}) {
  const [target, setTarget] = useState<PreviewTarget | null>(initialTarget || null);
  const [markingSource, setMarkingSource] = useState<MarkingSource | null>(null);
  const [metadata, setMetadata] = useState<Metadata | null>(null);
  const [preview, setPreview] = useState<PreviewData | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0) return;
      const element = event.target instanceof Element ? event.target : null;
      const anchor = element?.closest<HTMLAnchorElement>(
        'a[href*="/api/attachments/"],a[href*="/api/secure-share/document/"]',
      );
      if (!anchor || anchor.dataset["documentDownload"] === "true") return;
      event.preventDefault();
      const name = anchor.download || "";
      setTarget({
        url: anchor.getAttribute("href") || anchor.href,
        ...(name ? { name } : {}),
        allowDownload: anchor.dataset["documentDownloadDisabled"] !== "true",
      });
    };
    const onOpen = (event: Event) => setTarget((event as CustomEvent<PreviewTarget>).detail);
    document.addEventListener("gwero:open-document", onOpen);
    document.addEventListener("click", onClick, true);
    return () => {
      document.removeEventListener("click", onClick, true);
      document.removeEventListener("gwero:open-document", onOpen);
    };
  }, []);

  useEffect(() => {
    if (!target) return;
    let cancelled = false;
    setLoading(true);
    setMetadata(null);
    setPreview(null);
    setError("");
    void (async () => {
      try {
        const response = await fetch(withQuery(target.url, "metadata", "1"));
        if (!response.ok) throw new Error("You do not have access to this document.");
        const nextMetadata = (await response.json()) as Metadata;
        const nextPreview = await loadPreview(target, nextMetadata);
        if (!cancelled) {
          setMetadata(nextMetadata);
          setPreview(nextPreview);
        }
      } catch (cause) {
        if (!cancelled)
          setError(
            cause instanceof Error ? cause.message : "The document preview could not be loaded.",
          );
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [target]);

  const Icon = useMemo(() => {
    const ext = extension(metadata?.name || target?.name || "");
    if (["png", "jpg", "jpeg", "gif", "webp"].includes(ext)) return FileImage;
    if (["xls", "xlsx", "csv"].includes(ext)) return FileSpreadsheet;
    return FileText;
  }, [metadata?.name, target?.name]);

  return (
    <>
      <Dialog open={Boolean(target)} onOpenChange={(open) => !open && setTarget(null)}>
        <DialogContent className="flex h-[92vh] w-[96vw] max-w-7xl grid-rows-none flex-col gap-0 overflow-hidden p-0">
          <DialogHeader className="border-b px-5 py-4 pr-14 text-left">
            <div className="flex min-w-0 items-center gap-3">
              <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-cyan-50 text-cyan-700">
                <Icon className="size-5" />
              </span>
              <div className="min-w-0 flex-1">
                <DialogTitle className="truncate">
                  {metadata?.name || target?.name || "Document"}
                </DialogTitle>
                <DialogDescription className="mt-1">
                  {metadata
                    ? `${formatBytes(metadata.size)} · ${metadata.type}`
                    : "Secure in-app preview"}
                </DialogDescription>
              </div>
              {target ? (
                <div className="flex shrink-0 gap-2">
                  {(metadata?.type === "application/pdf" ||
                    extension(metadata?.name || target.name || "") === "pdf") &&
                  attachmentPath(target.url) ? (
                    <Button
                      size="sm"
                      onClick={() => {
                        setMarkingSource({
                          path: attachmentPath(target.url),
                          name: metadata?.name || target.name || "document.pdf",
                        });
                        setTarget(null);
                      }}
                    >
                      <FileSignature className="mr-2 size-4" /> Stamp or sign
                    </Button>
                  ) : null}
                  {target.allowDownload !== false ? (
                    <Button asChild size="sm" variant="outline">
                      <a
                        href={withQuery(target.url, "download", "1")}
                        data-document-download="true"
                        download={metadata?.name || target.name}
                      >
                        <Download className="mr-2 size-4" /> Download
                      </a>
                    </Button>
                  ) : null}
                </div>
              ) : null}
            </div>
          </DialogHeader>
          <div className="min-h-0 flex-1">
            {loading ? (
              <div className="grid h-full place-items-center text-sm text-muted-foreground">
                <span className="flex items-center gap-2">
                  <LoaderCircle className="size-5 animate-spin" /> Preparing secure preview…
                </span>
              </div>
            ) : error ? (
              <div className="grid h-full place-items-center p-8 text-center">
                <div>
                  <FileText className="mx-auto size-12 text-rose-200" />
                  <p className="mt-4 font-semibold text-rose-700">Document could not be opened</p>
                  <p className="mt-1 text-sm text-muted-foreground">{error}</p>
                </div>
              </div>
            ) : preview ? (
              <PreviewBody preview={preview} />
            ) : null}
          </div>
        </DialogContent>
      </Dialog>
      <DocumentMarkingDialog
        source={markingSource}
        onOpenChange={(open) => !open && setMarkingSource(null)}
        onApplied={(output) => {
          setMarkingSource(null);
          setTarget({ url: attachmentUrl(output.path), name: output.name });
        }}
      />
    </>
  );
}
