import { useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Archive,
  CalendarDays,
  ChevronRight,
  Clock3,
  FileClock,
  FileText,
  FolderPlus,
  LoaderCircle,
  LockKeyhole,
  Pencil,
  Plus,
  Search,
  ShieldCheck,
  Upload,
  UserRoundCog,
  UsersRound,
  Share2,
} from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
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
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import {
  addManagedDocumentVersion,
  createDocumentCategory,
  createManagedDocument,
  getDocumentWorkspace,
  setManagedDocumentAccess,
  updateManagedDocument,
} from "@/lib/documents.functions";
import type {
  DocumentAccessLevel,
  DocumentWorkspace,
  ManagedAttachment,
  ManagedDocumentRecord,
} from "@/lib/documents.types";

export const Route = createFileRoute("/documents")({ component: DocumentsPage });

const colors: Record<string, string> = {
  violet: "bg-violet-100 text-violet-700",
  blue: "bg-blue-100 text-blue-700",
  emerald: "bg-emerald-100 text-emerald-700",
  amber: "bg-amber-100 text-amber-800",
  rose: "bg-rose-100 text-rose-700",
  slate: "bg-slate-100 text-slate-700",
};

const emptyDocument = () => ({
  id: crypto.randomUUID(),
  title: "",
  categoryId: "",
  ownerId: "",
  entityType: "general",
  issueDate: "",
  expiryDate: "",
  notes: "",
  versionNotes: "",
});

function attachmentUrl(path: string) {
  const [ownerId, fileId] = path.split("/");
  return `/api/attachments/${encodeURIComponent(ownerId || "")}/${encodeURIComponent(fileId || "")}`;
}

function formatBytes(bytes: number) {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(value: string) {
  if (!value) return "Not set";
  const parsed = new Date(value);
  return Number.isNaN(parsed.valueOf())
    ? value
    : parsed.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

function isExpired(value: string) {
  return Boolean(value && new Date(`${value}T23:59:59`).valueOf() < Date.now());
}

async function uploadDocumentFile(ownerId: string, file: File): Promise<ManagedAttachment> {
  const body = new FormData();
  body.set("ownerId", ownerId);
  body.set("file", file);
  const response = await fetch("/api/attachments/upload", { method: "POST", body });
  const result = (await response.json()) as ManagedAttachment & { error?: string };
  if (!response.ok) throw new Error(result.error || "The document could not be uploaded.");
  return result;
}

function StatCard({
  icon: Icon,
  label,
  value,
  detail,
}: {
  icon: typeof FileText;
  label: string;
  value: number;
  detail: string;
}) {
  return (
    <Card className="border-slate-200 shadow-sm">
      <CardContent className="flex items-center gap-3 p-3">
        <span className="grid size-8 place-items-center rounded-lg bg-cyan-50 text-cyan-700">
          <Icon className="size-4" />
        </span>
        <div className="min-w-0">
          <div className="flex min-w-0 items-baseline gap-2">
            <MetricValue className="max-w-20 text-slate-900" value={value} maxSize={1.125} />
            <p className="truncate text-xs font-semibold text-slate-700">{label}</p>
          </div>
          <p className="mt-1 truncate text-[11px] text-muted-foreground">{detail}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function DocumentsPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [createOpen, setCreateOpen] = useState(false);
  const [categoryOpen, setCategoryOpen] = useState(false);
  const [selectedId, setSelectedId] = useState("");
  const { data, isLoading, isError } = useQuery({
    queryKey: ["document-workspace"],
    queryFn: () => getDocumentWorkspace() as Promise<DocumentWorkspace>,
  });
  useEffect(() => {
    const linkedSearch = new URLSearchParams(window.location.search).get("search");
    if (linkedSearch) setSearch(linkedSearch);
  }, []);
  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return (data?.documents || []).filter(
      (document) =>
        (category === "all" || document.categoryId === category) &&
        (!needle ||
          [
            document.title,
            document.categoryName,
            document.ownerName,
            document.entityType,
            document.notes,
            document.versions[0]?.fileName,
          ].some((field) => field?.toLowerCase().includes(needle))),
    );
  }, [category, data?.documents, search]);
  const selected = data?.documents.find((document) => document.id === selectedId) || null;
  const refresh = () => queryClient.invalidateQueries({ queryKey: ["document-workspace"] });
  const expiring = (data?.documents || []).filter((document) => {
    if (!document.expiryDate || isExpired(document.expiryDate)) return false;
    const days = (new Date(document.expiryDate).valueOf() - Date.now()) / 86_400_000;
    return days <= 30;
  }).length;

  return (
    <AppShell
      title="Documents"
      description="A controlled library for files, versions, ownership and access."
      actions={
        <>
          <Button size="sm" variant="outline" onClick={() => setCategoryOpen(true)}>
            <FolderPlus className="mr-2 size-4" /> Categories
          </Button>
          <Button size="sm" onClick={() => setCreateOpen(true)}>
            <Upload className="mr-2 size-4" /> Upload document
          </Button>
        </>
      }
    >
      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          icon={FileText}
          label="Accessible documents"
          value={data?.documents.length || 0}
          detail="Across your permitted library"
        />
        <StatCard
          icon={FileClock}
          label="Stored versions"
          value={(data?.documents || []).reduce(
            (total, document) => total + document.versions.length,
            0,
          )}
          detail="Complete revision history"
        />
        <StatCard
          icon={CalendarDays}
          label="Expiring soon"
          value={expiring}
          detail="Within the next 30 days"
        />
        <StatCard
          icon={UsersRound}
          label="Categories"
          value={data?.categories.length || 0}
          detail="Organised business records"
        />
      </div>

      <Card className="mt-4 overflow-hidden border-slate-200 shadow-sm">
        <CardContent className="p-0">
          <div className="flex flex-col gap-2 border-b bg-white p-3 md:flex-row md:items-center">
            <div className="relative min-w-0 flex-1">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search title, owner, category or filename"
                className="h-9 pl-9"
              />
            </div>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger className="h-9 w-full md:w-56">
                <SelectValue placeholder="All categories" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All categories</SelectItem>
                {(data?.categories || []).map((item) => (
                  <SelectItem key={item.id} value={item.id}>
                    {item.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center gap-2 px-6 py-20 text-sm text-muted-foreground">
              <LoaderCircle className="size-5 animate-spin" /> Loading the controlled library…
            </div>
          ) : isError ? (
            <div className="px-6 py-20 text-center text-sm text-rose-700">
              The document library could not be loaded.
            </div>
          ) : filtered.length ? (
            <div className="divide-y divide-slate-100">
              {filtered.map((document) => {
                const latest = document.versions[0];
                return (
                  <button
                    key={document.id}
                    type="button"
                    onClick={() => setSelectedId(document.id)}
                    className="grid w-full gap-3 px-4 py-2.5 text-left transition hover:bg-slate-50 md:grid-cols-[minmax(0,2fr)_minmax(140px,.8fr)_minmax(130px,.7fr)_110px_20px] md:items-center"
                  >
                    <span className="flex min-w-0 items-center gap-3">
                      <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-slate-100 text-cyan-700">
                        <FileText className="size-4" />
                      </span>
                      <span className="min-w-0">
                        <span className="block truncate font-semibold text-slate-900">
                          {document.title}
                        </span>
                        <span className="mt-0.5 block truncate text-[11px] text-muted-foreground">
                          {latest?.fileName || "No managed version yet"}
                          {latest ? ` · ${formatBytes(latest.fileSize)}` : ""}
                        </span>
                      </span>
                    </span>
                    <span>
                      <span
                        className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ${colors[document.categoryColor] || colors["slate"]}`}
                      >
                        {document.categoryName}
                      </span>
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium text-slate-700">
                        {document.ownerName}
                      </span>
                      <span className="block text-[11px] capitalize text-muted-foreground">
                        {document.accessLevel} access
                      </span>
                    </span>
                    <span className="text-xs text-muted-foreground">
                      <span className="block font-semibold text-slate-700">
                        {latest ? `v${latest.versionNumber}` : document.status}
                      </span>
                      <span className={isExpired(document.expiryDate) ? "text-rose-600" : ""}>
                        {document.expiryDate
                          ? `Expires ${formatDate(document.expiryDate)}`
                          : "No expiry"}
                      </span>
                    </span>
                    <ChevronRight className="hidden size-4 text-slate-300 md:block" />
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="px-5 py-8 text-center">
              <FileText className="mx-auto size-8 text-slate-200" />
              <p className="mt-3 text-sm font-semibold text-slate-800">
                No documents match this view
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                Change the filters or upload the first document in this category.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {data ? (
        <CreateDocumentDialog
          open={createOpen}
          onOpenChange={setCreateOpen}
          workspace={data}
          onSaved={() => void refresh()}
        />
      ) : null}
      <CategoryDialog
        open={categoryOpen}
        onOpenChange={setCategoryOpen}
        onSaved={() => void refresh()}
      />
      {selected && data ? (
        <DocumentDetail
          document={selected}
          workspace={data}
          open={Boolean(selectedId)}
          onOpenChange={(next) => !next && setSelectedId("")}
          onSaved={() => void refresh()}
        />
      ) : null}
    </AppShell>
  );
}

function CreateDocumentDialog({
  open,
  onOpenChange,
  workspace,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workspace: DocumentWorkspace;
  onSaved: () => void;
}) {
  const [form, setForm] = useState(emptyDocument);
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!open) return;
    setForm({
      ...emptyDocument(),
      categoryId: workspace.categories[0]?.id || "",
      ownerId: workspace.currentUserId,
    });
    setFile(null);
  }, [open, workspace.categories, workspace.currentUserId]);
  const save = async () => {
    if (!form.title.trim() || !file) {
      toast.error("Add a title and choose a file.");
      return;
    }
    setBusy(true);
    try {
      const attachment = await uploadDocumentFile(form.id, file);
      await createManagedDocument({ data: { ...form, attachment } });
      toast.success("Document uploaded with version 1.");
      onSaved();
      onOpenChange(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "The document could not be created.");
    } finally {
      setBusy(false);
    }
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Upload a controlled document</DialogTitle>
          <DialogDescription>
            The first file becomes version 1. Ownership and access can be changed at any time.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-2 md:grid-cols-2">
          <div className="space-y-2 md:col-span-2">
            <Label>Document title</Label>
            <Input
              value={form.title}
              onChange={(event) =>
                setForm((current) => ({ ...current, title: event.target.value }))
              }
              placeholder="e.g. ICT services capability statement"
            />
          </div>
          <div className="space-y-2">
            <Label>Category</Label>
            <Select
              value={form.categoryId}
              onValueChange={(value) => setForm((current) => ({ ...current, categoryId: value }))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Choose category" />
              </SelectTrigger>
              <SelectContent>
                {workspace.categories.map((item) => (
                  <SelectItem key={item.id} value={item.id}>
                    {item.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Owner</Label>
            <Select
              value={form.ownerId}
              onValueChange={(value) => setForm((current) => ({ ...current, ownerId: value }))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Choose owner" />
              </SelectTrigger>
              <SelectContent>
                {workspace.users.map((user) => (
                  <SelectItem key={user.id} value={user.id}>
                    {user.fullName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Linked area</Label>
            <Select
              value={form.entityType}
              onValueChange={(value) => setForm((current) => ({ ...current, entityType: value }))}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {["general", "client", "opportunity", "project", "finance", "hr"].map((value) => (
                  <SelectItem key={value} value={value} className="capitalize">
                    {value}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>File</Label>
            <Input
              type="file"
              accept=".pdf,.doc,.docx,.xls,.xlsx,.pptx,.csv,.txt,.png,.jpg,.jpeg,.gif,.webp"
              onChange={(event) => setFile(event.target.files?.[0] || null)}
            />
          </div>
          <div className="space-y-2">
            <Label>Issue date</Label>
            <Input
              type="date"
              value={form.issueDate}
              onChange={(event) =>
                setForm((current) => ({ ...current, issueDate: event.target.value }))
              }
            />
          </div>
          <div className="space-y-2">
            <Label>Expiry date</Label>
            <Input
              type="date"
              value={form.expiryDate}
              onChange={(event) =>
                setForm((current) => ({ ...current, expiryDate: event.target.value }))
              }
            />
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label>Notes</Label>
            <Textarea
              value={form.notes}
              onChange={(event) =>
                setForm((current) => ({ ...current, notes: event.target.value }))
              }
              placeholder="Purpose, approval context or handling notes"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
            Cancel
          </Button>
          <Button onClick={() => void save()} disabled={busy}>
            {busy ? (
              <LoaderCircle className="mr-2 size-4 animate-spin" />
            ) : (
              <Upload className="mr-2 size-4" />
            )}{" "}
            Upload document
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CategoryDialog({
  open,
  onOpenChange,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [color, setColor] = useState("violet");
  const mutation = useMutation({
    mutationFn: () => createDocumentCategory({ data: { name, description, color } }),
    onSuccess: () => {
      toast.success("Document category created.");
      setName("");
      setDescription("");
      onSaved();
      onOpenChange(false);
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : "Category could not be created."),
  });
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create document category</DialogTitle>
          <DialogDescription>
            Categories make the library easier to filter and govern.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label>Name</Label>
            <Input
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Contracts"
            />
          </div>
          <div className="space-y-2">
            <Label>Description</Label>
            <Textarea
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="What belongs in this category?"
            />
          </div>
          <div className="space-y-2">
            <Label>Colour</Label>
            <div className="flex flex-wrap gap-2">
              {Object.keys(colors).map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setColor(value)}
                  className={`rounded-full px-3 py-1 text-xs font-semibold ${colors[value]} ${color === value ? "ring-2 ring-slate-500 ring-offset-2" : ""}`}
                >
                  {value}
                </button>
              ))}
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button onClick={() => mutation.mutate()} disabled={mutation.isPending || !name.trim()}>
            <Plus className="mr-2 size-4" /> Create category
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DocumentDetail({
  document,
  workspace,
  open,
  onOpenChange,
  onSaved,
}: {
  document: ManagedDocumentRecord;
  workspace: DocumentWorkspace;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState({
    title: document.title,
    categoryId: document.categoryId,
    ownerId: document.ownerId,
    status: document.status,
    entityType: document.entityType,
    issueDate: document.issueDate,
    expiryDate: document.expiryDate,
    notes: document.notes,
  });
  const [versionFile, setVersionFile] = useState<File | null>(null);
  const [versionNotes, setVersionNotes] = useState("");
  const [uploading, setUploading] = useState(false);
  const [grants, setGrants] = useState<Record<string, DocumentAccessLevel | "none">>(
    Object.fromEntries(document.grants.map((grant) => [grant.userId, grant.accessLevel])),
  );
  useEffect(() => {
    setForm({
      title: document.title,
      categoryId: document.categoryId,
      ownerId: document.ownerId,
      status: document.status,
      entityType: document.entityType,
      issueDate: document.issueDate,
      expiryDate: document.expiryDate,
      notes: document.notes,
    });
    setGrants(
      Object.fromEntries(document.grants.map((grant) => [grant.userId, grant.accessLevel])),
    );
  }, [document]);
  const canManage = document.accessLevel === "manage";
  const canEdit = canManage || document.accessLevel === "edit";
  const updateMutation = useMutation({
    mutationFn: () => updateManagedDocument({ data: { id: document.id, ...form } }),
    onSuccess: () => {
      toast.success("Document details updated.");
      onSaved();
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : "Document could not be updated."),
  });
  const accessMutation = useMutation({
    mutationFn: () =>
      setManagedDocumentAccess({
        data: {
          documentId: document.id,
          grants: Object.entries(grants)
            .filter(([, level]) => level !== "none")
            .map(([userId, accessLevel]) => ({
              userId,
              accessLevel: accessLevel as DocumentAccessLevel,
            })),
        },
      }),
    onSuccess: () => {
      toast.success("Document access updated.");
      onSaved();
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : "Access could not be updated."),
  });
  const uploadVersion = async () => {
    if (!versionFile) {
      toast.error("Choose a new version file.");
      return;
    }
    setUploading(true);
    try {
      const attachment = await uploadDocumentFile(document.id, versionFile);
      await addManagedDocumentVersion({
        data: { documentId: document.id, attachment, notes: versionNotes },
      });
      toast.success("New document version added.");
      setVersionFile(null);
      setVersionNotes("");
      onSaved();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "The new version could not be uploaded.",
      );
    } finally {
      setUploading(false);
    }
  };
  const latest = document.versions[0];
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-2xl">
        <SheetHeader className="pr-8">
          <div className="flex items-start gap-3">
            <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-cyan-50 text-cyan-700">
              <FileText className="size-4" />
            </span>
            <div className="min-w-0">
              <SheetTitle className="truncate text-base">{document.title}</SheetTitle>
              <SheetDescription className="mt-1 flex flex-wrap items-center gap-2">
                <span>{document.categoryName}</span>
                <span>·</span>
                <span>{document.ownerName}</span>
                <span>·</span>
                <span className="capitalize">{document.accessLevel} access</span>
              </SheetDescription>
            </div>
          </div>
        </SheetHeader>
        {latest ? (
          <a
            href={attachmentUrl(latest.attachmentPath)}
            className="mt-4 flex items-center justify-between rounded-xl border border-cyan-100 bg-cyan-50/60 p-3 transition hover:bg-cyan-50"
          >
            <span className="flex min-w-0 items-center gap-3">
              <FileText className="size-5 shrink-0 text-cyan-700" />
              <span className="min-w-0">
                <span className="block truncate text-sm font-semibold text-slate-900">
                  Open current version
                </span>
                <span className="block truncate text-xs text-muted-foreground">
                  v{latest.versionNumber} · {latest.fileName} · {formatBytes(latest.fileSize)}
                </span>
              </span>
            </span>
            <ChevronRight className="size-4 shrink-0 text-cyan-600" />
          </a>
        ) : (
          <div className="mt-5 rounded-xl border border-dashed p-5 text-sm text-muted-foreground">
            This legacy record has no managed file version yet. Upload one from the Versions tab.
          </div>
        )}
        {latest && canManage ? (
          <Button className="mt-3 w-full" variant="outline" asChild>
            <a href={`/secure-shares?document=${encodeURIComponent(document.id)}`}>
              <Share2 className="mr-2 size-4" /> Share securely
            </a>
          </Button>
        ) : null}
        <Tabs defaultValue="details" className="mt-4">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="details">Details</TabsTrigger>
            <TabsTrigger value="versions">Versions ({document.versions.length})</TabsTrigger>
            <TabsTrigger value="access">Access ({document.grants.length})</TabsTrigger>
          </TabsList>
          <TabsContent value="details" className="space-y-3 pt-3">
            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-2 md:col-span-2">
                <Label>Title</Label>
                <Input
                  value={form.title}
                  disabled={!canManage}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, title: event.target.value }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>Category</Label>
                <Select
                  value={form.categoryId}
                  disabled={!canManage}
                  onValueChange={(value) =>
                    setForm((current) => ({ ...current, categoryId: value }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Category" />
                  </SelectTrigger>
                  <SelectContent>
                    {workspace.categories.map((item) => (
                      <SelectItem key={item.id} value={item.id}>
                        {item.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Owner</Label>
                <Select
                  value={form.ownerId}
                  disabled={!canManage}
                  onValueChange={(value) => setForm((current) => ({ ...current, ownerId: value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Owner" />
                  </SelectTrigger>
                  <SelectContent>
                    {workspace.users.map((user) => (
                      <SelectItem key={user.id} value={user.id}>
                        {user.fullName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Status</Label>
                <Select
                  value={form.status}
                  disabled={!canManage}
                  onValueChange={(value) => setForm((current) => ({ ...current, status: value }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="draft">Draft</SelectItem>
                    <SelectItem value="archived">Archived</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Linked area</Label>
                <Select
                  value={form.entityType}
                  disabled={!canManage}
                  onValueChange={(value) =>
                    setForm((current) => ({ ...current, entityType: value }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {["general", "client", "opportunity", "project", "finance", "hr"].map(
                      (value) => (
                        <SelectItem key={value} value={value} className="capitalize">
                          {value}
                        </SelectItem>
                      ),
                    )}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Issue date</Label>
                <Input
                  type="date"
                  value={form.issueDate}
                  disabled={!canManage}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, issueDate: event.target.value }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>Expiry date</Label>
                <Input
                  type="date"
                  value={form.expiryDate}
                  disabled={!canManage}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, expiryDate: event.target.value }))
                  }
                />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label>Notes</Label>
                <Textarea
                  value={form.notes}
                  disabled={!canManage}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, notes: event.target.value }))
                  }
                />
              </div>
            </div>
            {canManage ? (
              <div className="flex justify-end">
                <Button onClick={() => updateMutation.mutate()} disabled={updateMutation.isPending}>
                  <Pencil className="mr-2 size-4" /> Save details
                </Button>
              </div>
            ) : (
              <p className="rounded-xl bg-slate-50 p-3 text-xs text-muted-foreground">
                <LockKeyhole className="mr-1 inline size-3" /> Only the owner or a user with manage
                access can change ownership and document details.
              </p>
            )}
          </TabsContent>
          <TabsContent value="versions" className="space-y-3 pt-3">
            {canEdit ? (
              <div className="rounded-xl border bg-slate-50 p-3">
                <h3 className="text-sm font-semibold">Upload a new version</h3>
                <div className="mt-3 grid gap-3">
                  <Input
                    type="file"
                    accept=".pdf,.doc,.docx,.xls,.xlsx,.pptx,.csv,.txt,.png,.jpg,.jpeg,.gif,.webp"
                    onChange={(event) => setVersionFile(event.target.files?.[0] || null)}
                  />
                  <Input
                    value={versionNotes}
                    onChange={(event) => setVersionNotes(event.target.value)}
                    placeholder="What changed in this version?"
                  />
                  <Button
                    className="justify-self-start"
                    onClick={() => void uploadVersion()}
                    disabled={uploading}
                  >
                    {uploading ? (
                      <LoaderCircle className="mr-2 size-4 animate-spin" />
                    ) : (
                      <Upload className="mr-2 size-4" />
                    )}{" "}
                    Add version
                  </Button>
                </div>
              </div>
            ) : null}
            <div className="space-y-2">
              {document.versions.map((version, index) => (
                <a
                  key={version.id}
                  href={attachmentUrl(version.attachmentPath)}
                  className="flex items-start justify-between rounded-xl border p-3 transition hover:bg-slate-50"
                >
                  <span className="flex min-w-0 gap-3">
                    <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-cyan-50 text-cyan-700">
                      <FileText className="size-4" />
                    </span>
                    <span className="min-w-0">
                      <span className="flex items-center gap-2 text-sm font-semibold">
                        Version {version.versionNumber}
                        {index === 0 ? <Badge variant="secondary">Current</Badge> : null}
                      </span>
                      <span className="mt-1 block truncate text-xs text-muted-foreground">
                        {version.fileName} · {formatBytes(version.fileSize)}
                      </span>
                      <span className="mt-1 block text-xs text-muted-foreground">
                        {version.createdByName} · {formatDate(version.createdAt)}
                        {version.notes ? ` · ${version.notes}` : ""}
                      </span>
                    </span>
                  </span>
                  <ChevronRight className="mt-2 size-4 shrink-0 text-slate-300" />
                </a>
              ))}
              {!document.versions.length ? (
                <p className="rounded-xl border border-dashed p-5 text-center text-sm text-muted-foreground">
                  No managed versions yet.
                </p>
              ) : null}
            </div>
          </TabsContent>
          <TabsContent value="access" className="space-y-3 pt-3">
            <div className="rounded-xl bg-emerald-50 p-3 text-sm text-emerald-900">
              <ShieldCheck className="mr-2 inline size-4" /> <strong>{document.ownerName}</strong>{" "}
              is the owner and always has full control.
            </div>
            <div className="space-y-2">
              {workspace.users
                .filter((user) => user.id !== form.ownerId)
                .map((user) => (
                  <div key={user.id} className="flex items-center gap-3 rounded-xl border p-3">
                    <span className="grid size-9 shrink-0 place-items-center rounded-full bg-slate-100 text-xs font-bold">
                      {user.fullName
                        .split(/\s+/)
                        .slice(0, 2)
                        .map((part) => part[0])
                        .join("")
                        .toUpperCase()}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">{user.fullName}</span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {user.email}
                      </span>
                    </span>
                    <Select
                      value={grants[user.id] || "none"}
                      disabled={!canManage}
                      onValueChange={(value) =>
                        setGrants((current) => ({
                          ...current,
                          [user.id]: value as DocumentAccessLevel | "none",
                        }))
                      }
                    >
                      <SelectTrigger className="w-32">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">No access</SelectItem>
                        <SelectItem value="view">Can view</SelectItem>
                        <SelectItem value="edit">Can edit</SelectItem>
                        <SelectItem value="manage">Can manage</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                ))}
            </div>
            {canManage ? (
              <div className="flex justify-end">
                <Button onClick={() => accessMutation.mutate()} disabled={accessMutation.isPending}>
                  <UserRoundCog className="mr-2 size-4" /> Save access
                </Button>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">
                <LockKeyhole className="mr-1 inline size-3" /> Only the owner or a manager can
                change access.
              </p>
            )}
          </TabsContent>
        </Tabs>
        <div className="mt-4 flex flex-wrap gap-2 border-t pt-3 text-xs text-muted-foreground">
          <Badge variant="outline" className="capitalize">
            {document.status === "archived" ? (
              <Archive className="mr-1 size-3" />
            ) : (
              <Clock3 className="mr-1 size-3" />
            )}
            {document.status}
          </Badge>
          <span>Updated {formatDate(document.updatedAt)}</span>
        </div>
      </SheetContent>
    </Sheet>
  );
}
