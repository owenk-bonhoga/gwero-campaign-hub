import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Archive,
  Clock3,
  FileSignature,
  FileText,
  LoaderCircle,
  PenLine,
  Plus,
  ShieldCheck,
  Stamp,
  Upload,
} from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { DocumentMarkingDialog, type MarkingSource } from "@/components/DocumentMarkingDialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
import { MetricValue } from "@/components/ui/metric-value";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  archiveDocumentMark,
  getDocumentMarkWorkspace,
  saveSignature,
  saveStamp,
} from "@/lib/document-marks.functions";
import { renderStampDataUrl } from "@/lib/document-mark-renderer";
import type { DocumentMark, StampDesign } from "@/lib/document-marks.types";
import { cleanSignatureImage, signaturePngBlob } from "@/lib/signature-image";

export const Route = createFileRoute("/document-tools")({ component: DocumentToolsPage });

const defaultDesign: StampDesign = {
  primaryText: "RECEIVED",
  secondaryText: "GWERO",
  includeDate: true,
  datePrefix: "DATE",
  color: "#1d4ed8",
  shape: "oval",
  distressed: 38,
  rotation: -2,
};

function attachmentUrl(path: string) {
  const [ownerId, fileId] = path.split("/");
  return `/api/attachments/${encodeURIComponent(ownerId || "")}/${encodeURIComponent(fileId || "")}`;
}

function formatDate(value: string) {
  return new Date(value).toLocaleString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function StampEditor({
  mark,
  onClose,
}: {
  mark: DocumentMark | null | undefined;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [name, setName] = useState(mark?.name || "");
  const [design, setDesign] = useState<StampDesign>(mark?.design || defaultDesign);
  const preview = useMemo(
    () => renderStampDataUrl(design, new Date().toISOString().slice(0, 10), 0.65),
    [design],
  );
  const mutation = useMutation({
    mutationFn: () => saveStamp({ data: { ...(mark?.id ? { id: mark.id } : {}), name, design } }),
    onSuccess: () => {
      toast.success(mark ? "Stamp updated." : "Stamp added to the library.");
      void queryClient.invalidateQueries({ queryKey: ["document-mark-workspace"] });
      onClose();
    },
    onError: (cause) =>
      toast.error(cause instanceof Error ? cause.message : "The stamp could not be saved."),
  });
  const set = <K extends keyof StampDesign>(key: K, value: StampDesign[K]) =>
    setDesign((current) => ({ ...current, [key]: value }));
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[92vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{mark ? "Edit stamp" : "Create a realistic stamp"}</DialogTitle>
          <DialogDescription>
            Design the reusable ink mark. Its date can be changed each time it is applied.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-5 md:grid-cols-[1fr_280px]">
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="stamp-name">Library name</Label>
              <Input
                id="stamp-name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Incoming documents"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Primary text</Label>
                <Input
                  value={design.primaryText}
                  onChange={(event) => set("primaryText", event.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Secondary text</Label>
                <Input
                  value={design.secondaryText}
                  onChange={(event) => set("secondaryText", event.target.value)}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Shape</Label>
                <Select
                  value={design.shape}
                  onValueChange={(value) => set("shape", value as StampDesign["shape"])}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="oval">Oval</SelectItem>
                    <SelectItem value="rectangle">Rectangle</SelectItem>
                    <SelectItem value="circle">Circle</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Ink colour</Label>
                <div className="flex gap-2">
                  <Input
                    type="color"
                    value={design.color}
                    onChange={(event) => set("color", event.target.value)}
                    className="w-14 p-1"
                  />
                  <Input
                    value={design.color}
                    onChange={(event) => set("color", event.target.value)}
                  />
                </div>
              </div>
            </div>
            <div className="grid grid-cols-[auto_1fr] items-end gap-3">
              <label className="flex h-10 items-center gap-2 rounded-lg border px-3 text-sm">
                <input
                  type="checkbox"
                  checked={design.includeDate}
                  onChange={(event) => set("includeDate", event.target.checked)}
                />{" "}
                Include date
              </label>
              <div className="space-y-2">
                <Label>Date label</Label>
                <Input
                  value={design.datePrefix}
                  onChange={(event) => set("datePrefix", event.target.value)}
                  disabled={!design.includeDate}
                />
              </div>
            </div>
            <div className="space-y-3 rounded-xl border p-4">
              <div>
                <div className="flex justify-between text-xs">
                  <Label>Scanned ink texture</Label>
                  <span>{design.distressed}%</span>
                </div>
                <input
                  className="mt-2 w-full accent-cyan-700"
                  type="range"
                  min="0"
                  max="85"
                  value={design.distressed}
                  onChange={(event) => set("distressed", Number(event.target.value))}
                />
              </div>
              <div>
                <div className="flex justify-between text-xs">
                  <Label>Natural angle</Label>
                  <span>{design.rotation}°</span>
                </div>
                <input
                  className="mt-2 w-full accent-cyan-700"
                  type="range"
                  min="-12"
                  max="12"
                  value={design.rotation}
                  onChange={(event) => set("rotation", Number(event.target.value))}
                />
              </div>
            </div>
          </div>
          <div className="rounded-2xl bg-slate-100 p-5">
            <p className="mb-4 text-xs font-semibold uppercase tracking-wide text-slate-500">
              Live ink preview
            </p>
            <div className="grid min-h-56 place-items-center rounded-lg bg-[linear-gradient(#fff,#f8fafc)] p-3 shadow-sm">
              <img src={preview} alt="Stamp preview" className="w-full" />
            </div>
            <p className="mt-3 text-xs leading-5 text-muted-foreground">
              Distressing removes small areas of ink so the final PDF resembles a physical stamp on
              a scanned page.
            </p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button disabled={!name.trim() || mutation.isPending} onClick={() => mutation.mutate()}>
            {mutation.isPending && <LoaderCircle className="mr-2 size-4 animate-spin" />}Save stamp
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function SignatureEditor({ onClose }: { onClose: () => void }) {
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const save = async () => {
    if (!file || !name.trim()) return;
    setSaving(true);
    try {
      const id = crypto.randomUUID();
      const body = new FormData();
      body.set("ownerId", id);
      const sourceUrl = URL.createObjectURL(file);
      let uploadFile = file;
      try {
        const cleanedUrl = await cleanSignatureImage(sourceUrl);
        const cleaned = signaturePngBlob(cleanedUrl);
        uploadFile = new File([cleaned], `${file.name.replace(/\.[^.]+$/, "")}-clean.png`, {
          type: "image/png",
        });
      } finally {
        URL.revokeObjectURL(sourceUrl);
      }
      body.set("file", uploadFile);
      const response = await fetch("/api/attachments/upload", { method: "POST", body });
      const uploaded = (await response.json()) as { path?: string; error?: string };
      if (!response.ok || !uploaded.path)
        throw new Error(uploaded.error || "The signature image could not be uploaded.");
      await saveSignature({ data: { id, name, imagePath: uploaded.path } });
      toast.success("Signature added to the protected library.");
      void queryClient.invalidateQueries({ queryKey: ["document-mark-workspace"] });
      onClose();
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : "The signature could not be saved.");
    } finally {
      setSaving(false);
    }
  };
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Add a signature</DialogTitle>
          <DialogDescription>
            Upload a transparent PNG or a clear JPG. You can resize and rotate it on every document.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Signature name</Label>
            <Input
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Christian – formal signature"
            />
          </div>
          <label className="grid min-h-36 cursor-pointer place-items-center rounded-xl border border-dashed bg-slate-50 p-5 text-center hover:border-cyan-400">
            <span>
              <Upload className="mx-auto size-6 text-cyan-700" />
              <span className="mt-2 block text-sm font-semibold">
                {file?.name || "Choose signature image"}
              </span>
              <span className="mt-1 block text-xs text-muted-foreground">
                PNG or JPG works best
              </span>
            </span>
            <input
              type="file"
              accept="image/png,image/jpeg"
              className="hidden"
              onChange={(event) => setFile(event.target.files?.[0] || null)}
            />
          </label>
          {file ? (
            <div className="grid min-h-24 place-items-center rounded-lg bg-white p-3 shadow-inner">
              <img
                src={URL.createObjectURL(file)}
                alt="Signature preview"
                className="max-h-24 max-w-full"
              />
            </div>
          ) : null}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button disabled={!file || !name.trim() || saving} onClick={() => void save()}>
            {saving && <LoaderCircle className="mr-2 size-4 animate-spin" />}Save signature
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DocumentToolsPage() {
  const queryClient = useQueryClient();
  const [stampEditor, setStampEditor] = useState<DocumentMark | null | undefined>(undefined);
  const [signatureEditor, setSignatureEditor] = useState(false);
  const [source, setSource] = useState<MarkingSource | null>(null);
  const { data, isLoading } = useQuery({
    queryKey: ["document-mark-workspace"],
    queryFn: () => getDocumentMarkWorkspace(),
  });
  const archive = useMutation({
    mutationFn: (id: string) => archiveDocumentMark({ data: { id } }),
    onSuccess: () => {
      toast.success("Item archived.");
      void queryClient.invalidateQueries({ queryKey: ["document-mark-workspace"] });
    },
  });
  return (
    <AppShell
      title="Stamps & signatures"
      description="Create reusable marks, place them precisely on PDFs, and keep a complete audit history."
      actions={
        <>
          <Button variant="outline" onClick={() => setSignatureEditor(true)}>
            <PenLine className="mr-2 size-4" />
            Add signature
          </Button>
          <Button onClick={() => setStampEditor(null)}>
            <Plus className="mr-2 size-4" />
            Create stamp
          </Button>
        </>
      }
    >
      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        {[
          {
            icon: Stamp,
            value: data?.marks.filter((item) => item.type === "stamp").length || 0,
            label: "Reusable stamps",
          },
          {
            icon: PenLine,
            value: data?.marks.filter((item) => item.type === "signature").length || 0,
            label: "Saved signatures",
          },
          {
            icon: ShieldCheck,
            value: data?.applications.length || 0,
            label: "Recent applications",
          },
        ].map((item) => (
          <Card key={item.label} className="shadow-sm">
            <CardContent className="flex items-center gap-3 p-4">
              <span className="grid size-9 place-items-center rounded-lg bg-cyan-50 text-cyan-700">
                <item.icon className="size-4" />
              </span>
              <div className="min-w-0 flex-1">
                <MetricValue value={item.value} maxSize={1.25} />
                <p className="mt-1 text-xs text-muted-foreground">{item.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
      <Tabs defaultValue="library">
        <TabsList>
          <TabsTrigger value="library">Library</TabsTrigger>
          <TabsTrigger value="documents">Documents</TabsTrigger>
          <TabsTrigger value="history">Audit history</TabsTrigger>
        </TabsList>
        <TabsContent value="library" className="mt-4">
          {isLoading ? (
            <div className="grid min-h-48 place-items-center">
              <LoaderCircle className="size-6 animate-spin text-cyan-700" />
            </div>
          ) : data?.marks.length ? (
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {data.marks.map((mark) => (
                <Card key={mark.id} className="overflow-hidden shadow-sm">
                  <CardContent className="p-0">
                    <div className="grid h-36 place-items-center bg-slate-50 p-5">
                      {mark.type === "stamp" && mark.design ? (
                        <img
                          src={renderStampDataUrl(
                            mark.design,
                            new Date().toISOString().slice(0, 10),
                            0.5,
                          )}
                          alt={mark.name}
                          className="max-h-full max-w-full"
                        />
                      ) : (
                        <img
                          src={`${attachmentUrl(mark.imagePath)}?inline=1`}
                          alt={mark.name}
                          className="max-h-full max-w-full"
                        />
                      )}
                    </div>
                    <div className="flex items-center gap-3 border-t p-4">
                      <span className="grid size-8 place-items-center rounded-lg bg-cyan-50 text-cyan-700">
                        {mark.type === "stamp" ? (
                          <Stamp className="size-4" />
                        ) : (
                          <PenLine className="size-4" />
                        )}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold">{mark.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {mark.type === "stamp" ? "Editable stamp" : "Protected signature"}
                        </p>
                      </div>
                      {mark.type === "stamp" ? (
                        <Button size="sm" variant="outline" onClick={() => setStampEditor(mark)}>
                          Edit
                        </Button>
                      ) : null}
                      <Button
                        size="icon"
                        variant="ghost"
                        aria-label={`Archive ${mark.name}`}
                        onClick={() => archive.mutate(mark.id)}
                      >
                        <Archive className="size-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <div className="rounded-xl border border-dashed p-10 text-center">
              <Stamp className="mx-auto size-9 text-slate-300" />
              <p className="mt-3 font-semibold">Your mark library is empty</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Create a realistic stamp or upload a signature to begin.
              </p>
            </div>
          )}
        </TabsContent>
        <TabsContent value="documents" className="mt-4">
          <Card className="shadow-sm">
            <CardContent className="divide-y p-0">
              {data?.documents.map((document) => (
                <div key={document.id} className="flex items-center gap-3 p-3">
                  <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-red-50 text-red-700">
                    <FileText className="size-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">{document.title}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {document.category} · v{document.versionNumber} · {document.fileName}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      setSource({ path: document.attachmentPath, name: document.fileName })
                    }
                  >
                    <FileSignature className="mr-2 size-4" />
                    Stamp or sign
                  </Button>
                </div>
              ))}
              {!data?.documents.length ? (
                <p className="p-6 text-center text-sm text-muted-foreground">
                  No managed PDF documents are available yet.
                </p>
              ) : null}
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="history" className="mt-4">
          <Card className="shadow-sm">
            <CardContent className="divide-y p-0">
              {data?.applications.map((item) => (
                <div key={item.id} className="flex items-center gap-3 p-3">
                  <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-emerald-50 text-emerald-700">
                    <Clock3 className="size-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <a
                        href={attachmentUrl(item.outputPath)}
                        className="truncate text-sm font-semibold hover:text-cyan-700 hover:underline"
                      >
                        {item.outputName}
                      </a>
                      <Badge variant="secondary">page {item.pageNumber}</Badge>
                    </div>
                    <p className="truncate text-xs text-muted-foreground">
                      {item.markName} · {item.appliedByName} · {formatDate(item.createdAt)}
                      {item.appliedDate ? ` · dated ${item.appliedDate}` : ""}
                    </p>
                  </div>
                </div>
              ))}
              {!data?.applications.length ? (
                <p className="p-6 text-center text-sm text-muted-foreground">
                  Stamping and signing activity will appear here.
                </p>
              ) : null}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
      {stampEditor !== undefined ? (
        <StampEditor mark={stampEditor} onClose={() => setStampEditor(undefined)} />
      ) : null}
      {signatureEditor ? <SignatureEditor onClose={() => setSignatureEditor(false)} /> : null}
      <DocumentMarkingDialog source={source} onOpenChange={(open) => !open && setSource(null)} />
    </AppShell>
  );
}
