import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Check,
  ChevronLeft,
  ChevronRight,
  FileSignature,
  LoaderCircle,
  MousePointer2,
  Pencil,
  Plus,
  Stamp,
  Trash2,
} from "lucide-react";
import type { PDFDocumentLoadingTask, PDFDocumentProxy, RenderTask } from "pdfjs-dist";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { applyDocumentMarks, getDocumentMarkWorkspace } from "@/lib/document-marks.functions";
import { renderStampDataUrl } from "@/lib/document-mark-renderer";
import type { DocumentMark } from "@/lib/document-marks.types";
import { cleanSignatureImage } from "@/lib/signature-image";

export type MarkingSource = { path: string; name: string };
export type MarkingResult = { path: string; name: string; type: string; size: number };

type Placement = {
  id: string;
  markId: string;
  pageNumber: number;
  xRatio: number;
  yRatio: number;
  widthRatio: number;
  rotation: number;
  appliedDate: string;
  imagePng?: string;
};

function attachmentUrl(path: string) {
  const [ownerId, fileId] = path.split("/");
  return `/api/attachments/${encodeURIComponent(ownerId || "")}/${encodeURIComponent(fileId || "")}`;
}

function today() {
  const value = new Date();
  const offset = value.getTimezoneOffset();
  return new Date(value.valueOf() - offset * 60_000).toISOString().slice(0, 10);
}

function placementId() {
  return globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`;
}

function markPreview(mark: DocumentMark | null, appliedDate: string) {
  if (!mark) return "";
  if (mark.type === "signature") return `${attachmentUrl(mark.imagePath)}?inline=1`;
  return mark.design ? renderStampDataUrl(mark.design, appliedDate, 0.7) : "";
}

export function DocumentMarkingDialog({
  source,
  onOpenChange,
  onApplied,
}: {
  source: MarkingSource | null;
  onOpenChange: (open: boolean) => void;
  onApplied?: (output: MarkingResult) => void;
}) {
  const queryClient = useQueryClient();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [pdfDocument, setPdfDocument] = useState<PDFDocumentProxy | null>(null);
  const [markId, setMarkId] = useState("");
  const [pageNumber, setPageNumber] = useState(1);
  const [pageCount, setPageCount] = useState(1);
  const [xRatio, setXRatio] = useState(0.75);
  const [yRatio, setYRatio] = useState(0.82);
  const [widthRatio, setWidthRatio] = useState(0.24);
  const [rotation, setRotation] = useState(0);
  const [cleanSignature, setCleanSignature] = useState<{ markId: string; url: string } | null>(
    null,
  );
  const [appliedDate, setAppliedDate] = useState(today());
  const [placements, setPlacements] = useState<Placement[]>([]);
  const [editingPlacementId, setEditingPlacementId] = useState<string | null>(null);
  const [reading, setReading] = useState(false);
  const [pageReady, setPageReady] = useState(false);
  const { data, isLoading } = useQuery({
    queryKey: ["document-mark-workspace"],
    queryFn: () => getDocumentMarkWorkspace(),
    enabled: Boolean(source),
  });
  const marks = useMemo(() => data?.marks || [], [data?.marks]);
  const marksById = useMemo(() => new Map(marks.map((item) => [item.id, item])), [marks]);
  const mark = marksById.get(markId) || null;
  const signatureReady =
    mark?.type !== "signature" || (cleanSignature?.markId === mark.id && cleanSignature.url);
  const previewUrl = useMemo(
    () =>
      mark?.type === "signature" && cleanSignature?.markId === mark.id
        ? cleanSignature.url
        : markPreview(mark, appliedDate),
    [appliedDate, cleanSignature, mark],
  );

  useEffect(() => {
    if (mark?.type !== "signature") {
      setCleanSignature(null);
      return;
    }
    let cancelled = false;
    setCleanSignature(null);
    void cleanSignatureImage(`${attachmentUrl(mark.imagePath)}?inline=1`)
      .then((url) => {
        if (!cancelled) setCleanSignature({ markId: mark.id, url });
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [mark]);

  useEffect(() => {
    if (!source) return;
    setPageNumber(1);
    setXRatio(0.75);
    setYRatio(0.82);
    setWidthRatio(0.24);
    setRotation(0);
    setAppliedDate(today());
    setPlacements([]);
    setEditingPlacementId(null);
    setPdfDocument(null);
  }, [source]);

  useEffect(() => {
    if (!markId && marks[0]) setMarkId(marks[0].id);
    if (markId && marks.length && !marks.some((item) => item.id === markId))
      setMarkId(marks[0]!.id);
  }, [markId, marks]);

  useEffect(() => {
    if (mark && !editingPlacementId && placements.length === 0)
      setWidthRatio(mark.type === "signature" ? 0.14 : 0.22);
  }, [editingPlacementId, mark, placements.length]);

  useEffect(() => {
    if (!source) return;
    let cancelled = false;
    let loadingTask: PDFDocumentLoadingTask | null = null;
    let worker: Worker | null = null;
    let pdfjsModule: typeof import("pdfjs-dist") | null = null;
    setReading(true);
    setPageReady(false);
    void (async () => {
      try {
        const [response, pdfjs, workerModule] = await Promise.all([
          fetch(`${attachmentUrl(source.path)}?inline=1`),
          import("pdfjs-dist"),
          import("pdfjs-dist/build/pdf.worker.min.mjs?worker"),
        ]);
        if (!response.ok) throw new Error("The PDF could not be opened.");
        pdfjsModule = pdfjs;
        worker = new workerModule.default();
        pdfjs.GlobalWorkerOptions.workerPort = worker;
        const bytes = new Uint8Array(await response.arrayBuffer());
        loadingTask = pdfjs.getDocument({ data: bytes });
        const pdf = await loadingTask.promise;
        if (!cancelled) {
          setPageCount(pdf.numPages);
          setPdfDocument(pdf);
        }
      } catch (cause) {
        toast.error(cause instanceof Error ? cause.message : "The PDF could not be opened.");
      } finally {
        if (!cancelled) setReading(false);
      }
    })();
    return () => {
      cancelled = true;
      setPdfDocument(null);
      if (pdfjsModule?.GlobalWorkerOptions.workerPort === worker)
        pdfjsModule.GlobalWorkerOptions.workerPort = null;
      void loadingTask?.destroy();
      worker?.terminate();
    };
  }, [source]);

  useEffect(() => {
    if (!pdfDocument) return;
    let cancelled = false;
    let renderTask: RenderTask | null = null;
    setReading(true);
    setPageReady(false);
    void (async () => {
      try {
        const safePage = Math.max(1, Math.min(pdfDocument.numPages, pageNumber));
        if (safePage !== pageNumber) {
          setPageNumber(safePage);
          return;
        }
        const page = await pdfDocument.getPage(safePage);
        const canvas = canvasRef.current;
        if (!canvas || cancelled) return;
        const baseViewport = page.getViewport({ scale: 1 });
        const viewport = page.getViewport({ scale: Math.min(2, 1400 / baseViewport.width) });
        canvas.width = Math.ceil(viewport.width);
        canvas.height = Math.ceil(viewport.height);
        renderTask = page.render({ canvas, viewport });
        await renderTask.promise;
        if (!cancelled) setPageReady(true);
      } catch (cause) {
        if (!cancelled && !(cause instanceof Error && cause.name === "RenderingCancelledException"))
          toast.error(
            cause instanceof Error ? cause.message : "The PDF page could not be rendered.",
          );
      } finally {
        if (!cancelled) setReading(false);
      }
    })();
    return () => {
      cancelled = true;
      renderTask?.cancel();
    };
  }, [pageNumber, pdfDocument]);

  const mutation = useMutation({
    mutationFn: async () => {
      if (!source) throw new Error("Choose a document first.");
      if (!placements.length) throw new Error("Add at least one placement first.");
      return applyDocumentMarks({
        data: {
          sourcePath: source.path,
          placements: placements.map((placement) => {
            const placementMark = marksById.get(placement.markId);
            if (!placementMark) throw new Error("A selected stamp or signature is unavailable.");
            return {
              markId: placement.markId,
              pageNumber: placement.pageNumber,
              xRatio: placement.xRatio,
              yRatio: placement.yRatio,
              widthRatio: placement.widthRatio,
              rotation: placement.rotation,
              appliedDate: placement.appliedDate,
              ...(placement.imagePng
                ? { imagePng: placement.imagePng }
                : placementMark.type === "stamp" && placementMark.design
                  ? {
                      imagePng: renderStampDataUrl(placementMark.design, placement.appliedDate, 2),
                    }
                  : {}),
            };
          }),
        },
      });
    },
    onSuccess: (result) => {
      toast.success(
        `${result.applicationIds.length} placement${result.applicationIds.length === 1 ? "" : "s"} applied. The original document is unchanged.`,
      );
      void queryClient.invalidateQueries({ queryKey: ["document-mark-workspace"] });
      void queryClient.invalidateQueries({ queryKey: ["document-workspace"] });
      void queryClient.invalidateQueries({ queryKey: ["opportunity-workspace"] });
      onApplied?.(result.output);
      onOpenChange(false);
    },
    onError: (cause) =>
      toast.error(cause instanceof Error ? cause.message : "The document could not be updated."),
  });

  const place = (event: React.PointerEvent<HTMLDivElement>) => {
    const bounds = event.currentTarget.getBoundingClientRect();
    setXRatio(Math.max(0, Math.min(1, (event.clientX - bounds.left) / bounds.width)));
    setYRatio(Math.max(0, Math.min(1, (event.clientY - bounds.top) / bounds.height)));
  };

  const savePlacement = () => {
    if (!mark) return;
    const next: Placement = {
      id: editingPlacementId || placementId(),
      markId: mark.id,
      pageNumber,
      xRatio,
      yRatio,
      widthRatio,
      rotation,
      appliedDate,
      ...(mark.type === "signature" && cleanSignature?.markId === mark.id
        ? { imagePng: cleanSignature.url }
        : {}),
    };
    setPlacements((current) =>
      editingPlacementId
        ? current.map((placement) => (placement.id === editingPlacementId ? next : placement))
        : [...current, next],
    );
    setEditingPlacementId(null);
    if (!editingPlacementId) {
      setXRatio(Math.min(0.9, xRatio + 0.04));
      setYRatio(Math.min(0.9, yRatio + 0.04));
    }
  };

  const editPlacement = (placement: Placement) => {
    setEditingPlacementId(placement.id);
    setMarkId(placement.markId);
    setPageNumber(placement.pageNumber);
    setXRatio(placement.xRatio);
    setYRatio(placement.yRatio);
    setWidthRatio(placement.widthRatio);
    setRotation(placement.rotation);
    setAppliedDate(placement.appliedDate);
  };

  const visiblePlacements = placements.filter(
    (placement) => placement.pageNumber === pageNumber && placement.id !== editingPlacementId,
  );

  return (
    <Dialog open={Boolean(source)} onOpenChange={onOpenChange}>
      <DialogContent className="flex h-[96vh] w-[98vw] max-w-[1500px] grid-rows-none flex-col gap-0 overflow-hidden p-0">
        <DialogHeader className="border-b px-5 py-4 pr-14 text-left">
          <DialogTitle className="flex items-center gap-2">
            <FileSignature className="size-5 text-cyan-700" /> Stamp or sign document
          </DialogTitle>
          <DialogDescription className="truncate">
            {source?.name} · place multiple marks on the actual PDF pages, then apply them together
          </DialogDescription>
        </DialogHeader>
        <div className="grid min-h-0 flex-1 lg:grid-cols-[minmax(0,1fr)_400px]">
          <div className="gwero-scrollbar min-h-[42vh] overflow-auto border-b bg-slate-200 p-4 lg:border-b-0 lg:border-r">
            <div className="mb-3 flex items-center justify-between rounded-xl bg-white/90 px-3 py-2 shadow-sm">
              <div>
                <p className="text-sm font-semibold">Exact page preview</p>
                <p className="text-xs text-muted-foreground">
                  Page {pageNumber} of {pageCount} · click or drag directly on the document
                </p>
              </div>
              <div className="flex items-center gap-1">
                <Button
                  size="icon"
                  variant="outline"
                  disabled={pageNumber <= 1 || reading}
                  onClick={() => setPageNumber((current) => Math.max(1, current - 1))}
                  aria-label="Previous page"
                >
                  <ChevronLeft className="size-4" />
                </Button>
                <Button
                  size="icon"
                  variant="outline"
                  disabled={pageNumber >= pageCount || reading}
                  onClick={() => setPageNumber((current) => Math.min(pageCount, current + 1))}
                  aria-label="Next page"
                >
                  <ChevronRight className="size-4" />
                </Button>
              </div>
            </div>
            <div className="relative mx-auto w-full max-w-[900px] overflow-hidden bg-white shadow-xl">
              <canvas
                ref={canvasRef}
                className="block h-auto w-full"
                aria-label="Rendered PDF page"
              />
              {pageReady ? (
                <div
                  role="button"
                  tabIndex={0}
                  aria-label={`Place mark on PDF page ${pageNumber}`}
                  className="absolute inset-0 cursor-crosshair overflow-hidden"
                  onPointerDown={place}
                  onPointerMove={(event) => event.buttons === 1 && place(event)}
                >
                  {visiblePlacements.map((placement, index) => {
                    const placementMark = marksById.get(placement.markId) || null;
                    const url =
                      placement.imagePng || markPreview(placementMark, placement.appliedDate);
                    return url ? (
                      <div
                        key={placement.id}
                        className="pointer-events-none absolute"
                        style={{
                          left: `${placement.xRatio * 100}%`,
                          top: `${placement.yRatio * 100}%`,
                          width: `${placement.widthRatio * 100}%`,
                          transform: `translate(-50%, -50%) rotate(${placement.rotation}deg)`,
                        }}
                      >
                        <img
                          src={url}
                          alt="Queued document mark"
                          draggable={false}
                          className="block h-auto w-full select-none object-contain"
                          style={{ opacity: placementMark?.type === "stamp" ? 0.86 : 0.96 }}
                        />
                        <span className="absolute -right-2 -top-2 grid size-5 place-items-center rounded-full bg-cyan-700 text-[10px] font-bold text-white shadow">
                          {index + 1}
                        </span>
                      </div>
                    ) : null;
                  })}
                  {previewUrl ? (
                    <div
                      className="pointer-events-none absolute rounded-sm ring-2 ring-cyan-500 ring-offset-2"
                      style={{
                        left: `${xRatio * 100}%`,
                        top: `${yRatio * 100}%`,
                        width: `${widthRatio * 100}%`,
                        transform: `translate(-50%, -50%) rotate(${rotation}deg)`,
                      }}
                    >
                      <img
                        src={previewUrl}
                        alt="Current mark preview"
                        draggable={false}
                        className="block h-auto w-full select-none object-contain"
                        style={{ opacity: mark?.type === "stamp" ? 0.86 : 0.96 }}
                      />
                    </div>
                  ) : null}
                </div>
              ) : null}
              {reading || !pageReady ? (
                <div className="absolute inset-0 grid min-h-80 place-items-center bg-white/80 text-sm text-muted-foreground">
                  <span className="flex items-center gap-2">
                    <LoaderCircle className="size-4 animate-spin" /> Rendering exact PDF page…
                  </span>
                </div>
              ) : null}
            </div>
          </div>
          <div className="gwero-scrollbar overflow-y-auto p-5">
            <div className="space-y-5">
              <div className="space-y-2">
                <Label>Stamp or signature</Label>
                <Select
                  value={markId}
                  onValueChange={(value) => {
                    setMarkId(value);
                    if (!editingPlacementId)
                      setWidthRatio(marksById.get(value)?.type === "signature" ? 0.14 : 0.22);
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Choose from your library" />
                  </SelectTrigger>
                  <SelectContent>
                    {marks.map((item: DocumentMark) => (
                      <SelectItem key={item.id} value={item.id}>
                        {item.type === "stamp" ? "Stamp" : "Signature"} · {item.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {!isLoading && !marks.length ? (
                  <p className="rounded-lg bg-amber-50 p-3 text-xs text-amber-800">
                    Create a stamp or signature in the Stamps & signatures section first.
                  </p>
                ) : null}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="mark-page">Page</Label>
                  <Input
                    id="mark-page"
                    type="number"
                    min={1}
                    max={pageCount}
                    value={pageNumber}
                    onChange={(event) =>
                      setPageNumber(
                        Math.max(1, Math.min(pageCount, Number(event.target.value) || 1)),
                      )
                    }
                  />
                  <p className="text-[11px] text-muted-foreground">of {pageCount} pages</p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="mark-date">Date to show</Label>
                  <Input
                    id="mark-date"
                    type="date"
                    value={appliedDate}
                    onChange={(event) => setAppliedDate(event.target.value)}
                  />
                </div>
              </div>

              <div className="rounded-xl border bg-slate-50 p-4">
                <div className="mb-4 flex items-center justify-between">
                  <div>
                    <Label>Placement controls</Label>
                    <p className="mt-1 flex items-center gap-1 text-[11px] text-muted-foreground">
                      <MousePointer2 className="size-3" /> Move it on the exact page preview
                    </p>
                  </div>
                  <span className="text-xs font-medium text-cyan-700">
                    {Math.round(widthRatio * 100)}% wide
                  </span>
                </div>
                <div className="space-y-4">
                  <div>
                    <div className="flex justify-between text-xs">
                      <Label>Size</Label>
                      <span>{Math.round(widthRatio * 100)}%</span>
                    </div>
                    <input
                      className="mt-2 w-full accent-cyan-700"
                      type="range"
                      min="3"
                      max="65"
                      value={Math.round(widthRatio * 100)}
                      onChange={(event) => setWidthRatio(Number(event.target.value) / 100)}
                    />
                  </div>
                  <div>
                    <div className="flex justify-between text-xs">
                      <Label>Rotation</Label>
                      <span>{rotation}°</span>
                    </div>
                    <input
                      className="mt-2 w-full accent-cyan-700"
                      type="range"
                      min="-25"
                      max="25"
                      value={rotation}
                      onChange={(event) => setRotation(Number(event.target.value))}
                    />
                  </div>
                </div>
                <Button
                  className="mt-4 w-full"
                  variant={editingPlacementId ? "default" : "outline"}
                  disabled={!mark || !signatureReady || reading || !pageReady}
                  onClick={savePlacement}
                >
                  {editingPlacementId ? (
                    <Check className="mr-2 size-4" />
                  ) : (
                    <Plus className="mr-2 size-4" />
                  )}
                  {editingPlacementId ? "Update placement" : "Add this placement"}
                </Button>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Queued placements</Label>
                  <span className="rounded-full bg-cyan-100 px-2 py-0.5 text-xs font-semibold text-cyan-700">
                    {placements.length}
                  </span>
                </div>
                {placements.length ? (
                  <div className="space-y-2">
                    {placements.map((placement, index) => {
                      const placementMark = marksById.get(placement.markId);
                      return (
                        <div
                          key={placement.id}
                          className={`flex items-center gap-3 rounded-xl border p-3 ${editingPlacementId === placement.id ? "border-cyan-400 bg-cyan-50" : "bg-white"}`}
                        >
                          <span className="grid size-7 shrink-0 place-items-center rounded-full bg-slate-100 text-xs font-bold">
                            {index + 1}
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium">{placementMark?.name}</p>
                            <p className="text-xs text-muted-foreground">
                              Page {placement.pageNumber} · {Math.round(placement.widthRatio * 100)}
                              %
                            </p>
                          </div>
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => editPlacement(placement)}
                            aria-label={`Edit placement ${index + 1}`}
                          >
                            <Pencil className="size-4" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="text-red-600 hover:text-red-700"
                            onClick={() => {
                              setPlacements((current) =>
                                current.filter((item) => item.id !== placement.id),
                              );
                              if (editingPlacementId === placement.id) setEditingPlacementId(null);
                            }}
                            aria-label={`Remove placement ${index + 1}`}
                          >
                            <Trash2 className="size-4" />
                          </Button>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="rounded-xl border border-dashed p-4 text-center text-xs text-muted-foreground">
                    Position the current mark on the PDF, then add it. Repeat anywhere on any page.
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
        <DialogFooter className="border-t px-5 py-3 sm:justify-between">
          <p className="text-xs text-muted-foreground">
            {placements.length
              ? `${placements.length} placement${placements.length === 1 ? "" : "s"} will be written into one new PDF version.`
              : "The preview uses the exact PDF page dimensions used by the final document."}
          </p>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button
              disabled={!placements.length || reading || mutation.isPending}
              onClick={() => mutation.mutate()}
            >
              {mutation.isPending ? (
                <LoaderCircle className="mr-2 size-4 animate-spin" />
              ) : placements.some(
                  (placement) => marksById.get(placement.markId)?.type === "signature",
                ) ? (
                <Check className="mr-2 size-4" />
              ) : (
                <Stamp className="mr-2 size-4" />
              )}
              Apply {placements.length || ""} placement{placements.length === 1 ? "" : "s"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
