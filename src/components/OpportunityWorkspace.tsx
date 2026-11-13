import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Bold,
  Check,
  Circle,
  FilePlus2,
  Italic,
  Link2,
  MessageSquare,
  Paperclip,
  Pencil,
  Plus,
  Send,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { ConfirmAction } from "@/components/ConfirmAction";
import { DocumentMergeDialog, type MergeCandidate } from "@/components/DocumentMergeDialog";
import { EmailMessageContent } from "@/components/EmailMessageContent";
import { FinanceWorkspace } from "@/components/FinanceWorkspace";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
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
import { Textarea } from "@/components/ui/textarea";
import {
  addOpportunityComment,
  addOpportunityDocument,
  deleteChecklistItem,
  deleteOpportunityDocument,
  getOpportunityWorkspace,
  linkCostSheet,
  listOpportunityDependencies,
  saveChecklistItem,
  setChecklistStatus,
  submitOpportunity,
  updateOpportunity,
  updateOpportunityDocument,
  type OpportunityKind,
} from "@/lib/opportunities.functions";
import { parseEmailAttachments } from "@/lib/email-message";

type Row = Record<string, unknown>;
type Dependencies = {
  clients: Row[];
  currencies: Row[];
  documents: Row[];
  users: Row[];
  mailboxes: Row[];
  costSheets: Row[];
};
type Workspace = {
  opportunity: Row;
  checklist: Row[];
  documents: Row[];
  comments: Row[];
  submissions: Row[];
  replies: Row[];
};
type Attachment = { path: string; name: string; type: string; size: number };

const plural = {
  rfp: "rfps",
  rfq: "rfqs",
  bid: "bids",
  eoi: "prequalifications",
} as const;
const names = { rfp: "RFP", rfq: "RFQ", bid: "Bid", eoi: "EOI / Prequalification" } as const;

function parseList(value: unknown) {
  if (Array.isArray(value)) return value.join(", ");
  try {
    const parsed = JSON.parse(String(value || "[]"));
    return Array.isArray(parsed) ? parsed.join(", ") : "";
  } catch {
    return String(value || "");
  }
}

function attachmentUrl(path: string) {
  const [ownerId, fileId] = path.split("/");
  return `/api/attachments/${encodeURIComponent(ownerId || "")}/${encodeURIComponent(fileId || "")}`;
}

export function OpportunityWorkspace({ kind, id }: { kind: OpportunityKind; id: string }) {
  const qc = useQueryClient();
  const key = ["opportunity-workspace", kind, id];
  const { data, isLoading, error } = useQuery({
    queryKey: key,
    queryFn: () => getOpportunityWorkspace({ data: { kind, id } }) as Promise<Workspace>,
  });
  const { data: dependencies } = useQuery({
    queryKey: ["opportunity-dependencies"],
    queryFn: () => listOpportunityDependencies() as Promise<Dependencies>,
  });
  const refresh = () => void qc.invalidateQueries({ queryKey: key });
  if (isLoading)
    return (
      <AppShell title={`${names[kind]} workspace`}>
        <p className="text-muted-foreground">Loading workspace…</p>
      </AppShell>
    );
  if (error || !data)
    return (
      <AppShell title={`${names[kind]} workspace`}>
        <p className="text-destructive">
          {error instanceof Error ? error.message : "This opportunity could not be loaded."}
        </p>
      </AppShell>
    );
  const opportunity = data.opportunity;
  const clientName = String(
    opportunity["client_company"] || opportunity["client_name"] || "No client",
  );
  const complete = data.checklist.filter((item) => item["status"] === "complete").length;
  const progress = data.checklist.length ? Math.round((complete / data.checklist.length) * 100) : 0;
  return (
    <AppShell
      title={String(opportunity["title"])}
      description={`${names[kind]} response workspace`}
    >
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <Button variant="outline" asChild>
          <a href={`/${plural[kind]}`}>Back to {plural[kind].toUpperCase()}</a>
        </Button>
        <Badge
          className="capitalize"
          variant={opportunity["status"] === "submitted" ? "default" : "secondary"}
        >
          {String(opportunity["status"])}
        </Badge>
        <div className="ml-auto flex items-center gap-3 rounded-xl border bg-white px-3 py-2">
          <Avatar className="size-9">
            <AvatarImage src={String(opportunity["client_logo"] || "")} />
            <AvatarFallback>{clientName.slice(0, 2).toUpperCase()}</AvatarFallback>
          </Avatar>
          <div>
            <p className="text-sm font-medium">{clientName}</p>
            <p className="text-xs text-muted-foreground">
              Due {String(opportunity[kind === "bid" ? "closing_date" : "due_date"] || "not set")}
            </p>
          </div>
        </div>
      </div>
      <div className="mb-4 grid gap-3 md:grid-cols-4">
        <Metric
          label="Checklist progress"
          value={`${progress}%`}
          hint={`${complete} of ${data.checklist.length} complete`}
        />
        <Metric
          label="Response documents"
          value={String(data.documents.filter((doc) => doc["document_role"] === "response").length)}
          hint="ready in workspace"
        />
        <Metric
          label="Cost sheet"
          value={opportunity["cost_sheet_name"] ? "Linked" : "Not linked"}
          hint={String(opportunity["cost_sheet_name"] || "Add internal costing")}
        />
        <Metric
          label="Submission"
          value={String(opportunity["submission_type"] || "email").replace("_", " ")}
          hint={opportunity["submitted_at"] ? "Submitted" : "Not submitted"}
        />
      </div>
      <Tabs defaultValue="requirements" className="space-y-4">
        <TabsList className="h-auto w-full justify-start overflow-x-auto bg-white p-1.5">
          <TabsTrigger value="requirements">Requirements</TabsTrigger>
          <TabsTrigger value="documents">Documents</TabsTrigger>
          <TabsTrigger value="costing">Cost sheet</TabsTrigger>
          <TabsTrigger value="finance">Finance</TabsTrigger>
          <TabsTrigger value="collaboration">Team collaboration</TabsTrigger>
          <TabsTrigger value="submission">Submission</TabsTrigger>
          <TabsTrigger value="details">Details</TabsTrigger>
        </TabsList>
        <TabsContent value="requirements">
          <Requirements
            data={data}
            dependencies={dependencies}
            kind={kind}
            id={id}
            refresh={refresh}
          />
        </TabsContent>
        <TabsContent value="documents">
          <Documents
            data={data}
            dependencies={dependencies}
            kind={kind}
            id={id}
            refresh={refresh}
          />
        </TabsContent>
        <TabsContent value="costing">
          <Costing
            opportunity={opportunity}
            dependencies={dependencies}
            kind={kind}
            id={id}
            refresh={refresh}
          />
        </TabsContent>
        <TabsContent value="finance">
          <FinanceWorkspace
            sourceType={kind}
            sourceId={id}
            sourceTitle={String(opportunity["title"])}
            compact
          />
        </TabsContent>
        <TabsContent value="collaboration">
          <Collaboration
            comments={data.comments}
            users={dependencies?.users || []}
            kind={kind}
            id={id}
            refresh={refresh}
          />
        </TabsContent>
        <TabsContent value="submission">
          <Submission
            data={data}
            dependencies={dependencies}
            kind={kind}
            id={id}
            refresh={refresh}
          />
        </TabsContent>
        <TabsContent value="details">
          <Details
            opportunity={opportunity}
            dependencies={dependencies}
            kind={kind}
            id={id}
            refresh={refresh}
          />
        </TabsContent>
      </Tabs>
    </AppShell>
  );
}

function Metric({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
        <MetricValue className="mt-1 capitalize" value={value} maxSize={1.5} />
        <p className="mt-1 truncate text-xs text-muted-foreground">{hint}</p>
      </CardContent>
    </Card>
  );
}

function Requirements({
  data,
  dependencies,
  kind,
  id,
  refresh,
}: {
  data: Workspace;
  dependencies: Dependencies | undefined;
  kind: OpportunityKind;
  id: string;
  refresh: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    title: "",
    notes: "",
    assigneeId: "",
    dueAt: "",
    documentRequired: true,
  });
  const save = useMutation({
    mutationFn: () => saveChecklistItem({ data: { kind, opportunityId: id, ...form } }),
    onSuccess: () => {
      toast.success(
        form.assigneeId
          ? "Requirement added and the assignee was notified by email and in the app."
          : "Requirement added.",
      );
      setOpen(false);
      setForm({ title: "", notes: "", assigneeId: "", dueAt: "", documentRequired: true });
      refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const toggle = useMutation({
    mutationFn: (item: { id: string; complete: boolean }) => setChecklistStatus({ data: item }),
    onSuccess: refresh,
    onError: (e: Error) => toast.error(e.message),
  });
  const remove = useMutation({
    mutationFn: (itemId: string) => deleteChecklistItem({ data: { id: itemId } }),
    onSuccess: refresh,
    onError: (e: Error) => toast.error(e.message),
  });
  const filesFor = (itemId: string) =>
    data.documents.filter((doc) => doc["checklist_item_id"] === itemId);
  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between">
        <div>
          <CardTitle>Completion checklist</CardTitle>
          <CardDescription>
            Break the response into required documents and assign ownership.
          </CardDescription>
        </div>
        <Button onClick={() => setOpen(true)}>
          <Plus className="mr-2 size-4" />
          Add requirement
        </Button>
      </CardHeader>
      <CardContent className="space-y-3">
        {data.checklist.length ? (
          data.checklist.map((item) => {
            const done = item["status"] === "complete";
            const files = filesFor(String(item["id"]));
            return (
              <div key={String(item["id"])} className="flex gap-3 rounded-xl border p-4">
                <button
                  type="button"
                  className="mt-0.5 text-primary"
                  aria-label={done ? "Mark incomplete" : "Mark complete"}
                  onClick={() => toggle.mutate({ id: String(item["id"]), complete: !done })}
                >
                  {done ? (
                    <Check className="size-5 rounded-full bg-primary p-0.5 text-primary-foreground" />
                  ) : (
                    <Circle className="size-5" />
                  )}
                </button>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p
                      className={`font-medium ${done ? "line-through text-muted-foreground" : ""}`}
                    >
                      {String(item["title"])}
                    </p>
                    {item["document_required"] ? (
                      <Badge variant="outline">Document required</Badge>
                    ) : null}
                  </div>
                  {item["notes"] ? (
                    <p className="mt-1 text-sm text-muted-foreground">{String(item["notes"])}</p>
                  ) : null}
                  <p className="mt-2 text-xs text-muted-foreground">
                    {String(item["assignee_name"] || "Unassigned")}
                    {item["due_at"]
                      ? ` · Due ${String(item["due_at"]).slice(0, 16).replace("T", " ")}`
                      : ""}
                  </p>
                  {files.length ? (
                    <div className="mt-2 flex flex-wrap gap-2">
                      {files.map((file) => (
                        <Badge key={String(file["id"])} variant="secondary">
                          <Paperclip className="mr-1 size-3" />
                          {String(file["display_name"])}
                        </Badge>
                      ))}
                    </div>
                  ) : null}
                </div>
                <ConfirmAction
                  title="Delete checklist item?"
                  description="Linked documents stay in the response workspace."
                  onConfirm={async () => {
                    await remove.mutateAsync(String(item["id"]));
                  }}
                  trigger={
                    <Button variant="ghost" size="icon">
                      <Trash2 className="size-4" />
                    </Button>
                  }
                />
              </div>
            );
          })
        ) : (
          <p className="rounded-xl border border-dashed p-6 text-center text-muted-foreground">
            No requirements yet. Add every document or action needed for a complete response.
          </p>
        )}
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add requirement</DialogTitle>
              <DialogDescription>
                Assign an owner and identify whether evidence must be attached.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <Field
                label="Requirement"
                value={form.title}
                onChange={(title) => setForm((v) => ({ ...v, title }))}
              />
              <div className="space-y-2">
                <Label>Notes</Label>
                <Textarea
                  value={form.notes}
                  onChange={(e) => setForm((v) => ({ ...v, notes: e.target.value }))}
                />
              </div>
              <SelectField
                label="Assign to"
                value={form.assigneeId}
                onChange={(assigneeId) => setForm((v) => ({ ...v, assigneeId }))}
                options={(dependencies?.users || []).map((user) => ({
                  value: String(user["id"]),
                  label: String(user["full_name"]),
                }))}
              />
              {form.assigneeId ? (
                <p className="-mt-2 text-xs text-muted-foreground">
                  The assignee receives an immediate in-app alert and email with the opportunity
                  details.
                </p>
              ) : null}
              <Field
                label="Due date and time"
                type="datetime-local"
                value={form.dueAt}
                onChange={(dueAt) => setForm((v) => ({ ...v, dueAt }))}
              />
              <label className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={form.documentRequired}
                  onCheckedChange={(checked) =>
                    setForm((v) => ({ ...v, documentRequired: checked === true }))
                  }
                />
                A document must be attached
              </label>
            </div>
            <DialogFooter>
              <Button onClick={() => save.mutate()} disabled={save.isPending}>
                Add requirement
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}

function Documents({
  data,
  dependencies,
  kind,
  id,
  refresh,
}: {
  data: Workspace;
  dependencies: Dependencies | undefined;
  kind: OpportunityKind;
  id: string;
  refresh: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [mergeOpen, setMergeOpen] = useState(false);
  const [mode, setMode] = useState<"upload" | "library">("upload");
  const [checklistId, setChecklistId] = useState("");
  const [documentId, setDocumentId] = useState("");
  const [file, setFile] = useState<File>();
  const [query, setQuery] = useState("");
  const add = useMutation({
    mutationFn: async () => {
      let attachment: Attachment | undefined;
      let displayName = "";
      if (mode === "upload") {
        if (!file) throw new Error("Choose a file.");
        const form = new FormData();
        form.set("ownerId", id);
        form.set("file", file);
        const response = await fetch("/api/attachments/upload", { method: "POST", body: form });
        const result = (await response.json()) as Attachment & { error?: string };
        if (!response.ok) throw new Error(result.error || "Upload failed.");
        attachment = result;
        displayName = file.name;
      } else {
        const selected = dependencies?.documents.find((doc) => doc["id"] === documentId);
        if (!selected) throw new Error("Choose a system document.");
        displayName = String(selected["title"]);
      }
      return addOpportunityDocument({
        data: {
          kind,
          opportunityId: id,
          ...(checklistId ? { checklistItemId: checklistId } : {}),
          ...(mode === "library" ? { documentId } : {}),
          ...(attachment ? { attachment } : {}),
          displayName,
          role: "response",
        },
      });
    },
    onSuccess: () => {
      toast.success("Document added.");
      setOpen(false);
      setFile(undefined);
      setDocumentId("");
      refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const update = useMutation({
    mutationFn: (payload: { id: string; outgoingName: string; include: boolean }) =>
      updateOpportunityDocument({ data: payload }),
    onSuccess: refresh,
    onError: (e: Error) => toast.error(e.message),
  });
  const remove = useMutation({
    mutationFn: (document: string) => deleteOpportunityDocument({ data: { id: document } }),
    onSuccess: refresh,
    onError: (e: Error) => toast.error(e.message),
  });
  const library = (dependencies?.documents || []).filter((doc) =>
    String(doc["title"]).toLowerCase().includes(query.toLowerCase()),
  );
  const mergeCandidates = useMemo<MergeCandidate[]>(() => {
    const tenderDocuments = data.documents
      .filter((doc) => {
        const name = String(doc["outgoing_name"] || doc["display_name"] || "");
        return (
          Boolean(doc["attachment_path"]) &&
          (doc["content_type"] === "application/pdf" || name.toLowerCase().endsWith(".pdf"))
        );
      })
      .map((doc) => ({
        kind: "tender" as const,
        id: String(doc["id"]),
        name: String(doc["outgoing_name"] || doc["display_name"]),
        path: String(doc["attachment_path"]),
        detail: "Tender document",
      }));
    const libraryDocuments = (dependencies?.documents || [])
      .filter((doc) => {
        const name = String(doc["file_name"] || doc["title"] || "");
        return (
          Boolean(doc["attachment_path"]) &&
          (doc["content_type"] === "application/pdf" || name.toLowerCase().endsWith(".pdf"))
        );
      })
      .map((doc) => ({
        kind: "library" as const,
        id: String(doc["id"]),
        name: String(doc["file_name"] || doc["title"]),
        path: String(doc["attachment_path"]),
        detail: `${String(doc["title"])}${doc["version"] ? ` · v${String(doc["version"])}` : ""}`,
      }));
    return [...tenderDocuments, ...libraryDocuments];
  }, [data.documents, dependencies?.documents]);
  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between">
        <div>
          <CardTitle>Response documents</CardTitle>
          <CardDescription>
            Upload new work or reuse controlled documents already in the system.
          </CardDescription>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => setMergeOpen(true)}>
            Merge PDFs
          </Button>
          <Button onClick={() => setOpen(true)}>
            <FilePlus2 className="mr-2 size-4" />
            Add document
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {data.documents.length ? (
          data.documents.map((doc) => (
            <div
              key={String(doc["id"])}
              className="grid gap-3 rounded-xl border p-4 md:grid-cols-[1fr_240px_auto] md:items-center"
            >
              <div className="min-w-0">
                <p className="truncate font-medium">{String(doc["display_name"])}</p>
                <p className="text-xs text-muted-foreground capitalize">
                  {String(doc["document_role"])}
                  {doc["category"] ? ` · ${String(doc["category"])}` : ""}
                </p>
                {doc["attachment_path"] ? (
                  <a
                    className="mt-1 inline-block text-xs text-primary hover:underline"
                    href={attachmentUrl(String(doc["attachment_path"]))}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Open file
                  </a>
                ) : (
                  <span className="mt-1 block text-xs text-primary">Linked from Documents</span>
                )}
              </div>
              <Input
                defaultValue={String(doc["outgoing_name"] || doc["display_name"])}
                aria-label="Outgoing filename"
                onBlur={(e) => {
                  const name = e.target.value.trim();
                  if (name && name !== doc["outgoing_name"])
                    update.mutate({
                      id: String(doc["id"]),
                      outgoingName: name,
                      include: Boolean(doc["include_in_submission"]),
                    });
                }}
              />
              <div className="flex items-center gap-2">
                <label className="flex items-center gap-2 text-xs">
                  <Checkbox
                    checked={Boolean(doc["include_in_submission"])}
                    onCheckedChange={(checked) =>
                      update.mutate({
                        id: String(doc["id"]),
                        outgoingName: String(doc["outgoing_name"] || doc["display_name"]),
                        include: checked === true,
                      })
                    }
                  />
                  Send
                </label>
                <ConfirmAction
                  title="Remove document from workspace?"
                  onConfirm={async () => {
                    await remove.mutateAsync(String(doc["id"]));
                  }}
                  trigger={
                    <Button variant="ghost" size="icon">
                      <Trash2 className="size-4" />
                    </Button>
                  }
                />
              </div>
            </div>
          ))
        ) : (
          <p className="rounded-xl border border-dashed p-6 text-center text-muted-foreground">
            No documents in this workspace yet.
          </p>
        )}
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add response document</DialogTitle>
              <DialogDescription>
                Attach it to a checklist requirement if it completes one.
              </DialogDescription>
            </DialogHeader>
            <Tabs value={mode} onValueChange={(value) => setMode(value as typeof mode)}>
              <TabsList>
                <TabsTrigger value="upload">Upload new</TabsTrigger>
                <TabsTrigger value="library">From Documents</TabsTrigger>
              </TabsList>
              <TabsContent value="upload" className="pt-4">
                <Input type="file" onChange={(e) => setFile(e.target.files?.[0])} />
              </TabsContent>
              <TabsContent value="library" className="space-y-3 pt-4">
                <Input
                  placeholder="Search document library"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
                <Select value={documentId} onValueChange={setDocumentId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose document" />
                  </SelectTrigger>
                  <SelectContent>
                    {library.map((doc) => (
                      <SelectItem key={String(doc["id"])} value={String(doc["id"])}>
                        {String(doc["title"])}
                        {doc["version"] ? ` · v${String(doc["version"])}` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </TabsContent>
            </Tabs>
            <SelectField
              label="Checklist requirement (optional)"
              value={checklistId}
              onChange={setChecklistId}
              options={data.checklist.map((item) => ({
                value: String(item["id"]),
                label: String(item["title"]),
              }))}
            />
            <DialogFooter>
              <Button onClick={() => add.mutate()} disabled={add.isPending}>
                Add document
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        <DocumentMergeDialog
          open={mergeOpen}
          onOpenChange={setMergeOpen}
          kind={kind}
          opportunityId={id}
          opportunityTitle={String(data.opportunity["title"] || names[kind])}
          candidates={mergeCandidates}
          onSaved={refresh}
        />
      </CardContent>
    </Card>
  );
}

function Costing({
  opportunity,
  dependencies,
  kind,
  id,
  refresh,
}: {
  opportunity: Row;
  dependencies: Dependencies | undefined;
  kind: OpportunityKind;
  id: string;
  refresh: () => void;
}) {
  const [existing, setExisting] = useState(String(opportunity["cost_sheet_id"] || ""));
  const [name, setName] = useState(`${String(opportunity["title"])} costing`);
  const save = useMutation({
    mutationFn: (create: boolean) => {
      const clientId = String(opportunity["client_id"] || "");
      return linkCostSheet({
        data: create
          ? {
              kind,
              opportunityId: id,
              create: {
                name,
                ...(clientId ? { clientId } : {}),
                currency: String(opportunity["currency"] || "MWK"),
                notes: `Created from ${names[kind]} ${String(opportunity["reference"] || "")}`,
              },
            }
          : { kind, opportunityId: id, costSheetId: existing },
      });
    },
    onSuccess: () => {
      toast.success("Cost sheet linked.");
      refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });
  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>Use an existing cost sheet</CardTitle>
          <CardDescription>Link pricing already managed in the Cost sheets module.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Select value={existing} onValueChange={setExisting}>
            <SelectTrigger>
              <SelectValue placeholder="Choose cost sheet" />
            </SelectTrigger>
            <SelectContent>
              {(dependencies?.costSheets || []).map((sheet) => (
                <SelectItem key={String(sheet["id"])} value={String(sheet["id"])}>
                  {String(sheet["name"])} · {String(sheet["currency"])}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button onClick={() => save.mutate(false)} disabled={!existing || save.isPending}>
            Link cost sheet
          </Button>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Create inside this {names[kind]}</CardTitle>
          <CardDescription>
            The new sheet also appears in the global Cost sheets module.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Field label="Cost sheet name" value={name} onChange={setName} />
          <Button onClick={() => save.mutate(true)} disabled={!name.trim() || save.isPending}>
            Create and link
          </Button>
        </CardContent>
      </Card>
      {opportunity["cost_sheet_id"] ? (
        <Card className="lg:col-span-2">
          <CardContent className="flex items-center justify-between p-4">
            <div>
              <p className="font-medium">{String(opportunity["cost_sheet_name"])}</p>
              <p className="text-sm text-muted-foreground">Currently linked to this response.</p>
            </div>
            <Button asChild>
              <a href={`/cost-sheets/${String(opportunity["cost_sheet_id"])}`}>Open cost sheet</a>
            </Button>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}

function Collaboration({
  comments,
  users,
  kind,
  id,
  refresh,
}: {
  comments: Row[];
  users: Row[];
  kind: OpportunityKind;
  id: string;
  refresh: () => void;
}) {
  const queryClient = useQueryClient();
  const editor = useRef<HTMLTextAreaElement>(null);
  const [body, setBody] = useState("");
  const [mentionIds, setMentionIds] = useState<string[]>([]);
  const [mentionTrigger, setMentionTrigger] = useState<{ start: number; query: string } | null>(
    null,
  );
  const suggestions = useMemo(() => {
    if (!mentionTrigger) return [];
    const query = mentionTrigger.query.trim().toLowerCase();
    return users
      .filter(
        (user) =>
          !mentionIds.includes(String(user["id"])) &&
          (!query ||
            String(user["full_name"] || "")
              .toLowerCase()
              .includes(query) ||
            String(user["email"] || "")
              .toLowerCase()
              .includes(query)),
      )
      .slice(0, 7);
  }, [mentionIds, mentionTrigger, users]);
  const findMention = (value: string, cursor: number | null) => {
    if (cursor === null) return null;
    const before = value.slice(0, cursor);
    const start = before.lastIndexOf("@");
    if (start < 0 || before.slice(start + 1).includes("\n")) return null;
    const preceding = start > 0 ? before[start - 1] : "";
    if (preceding && !/[\s([{,:;]/.test(preceding)) return null;
    const query = before.slice(start + 1);
    return query.length <= 80 ? { start, query } : null;
  };
  const chooseMention = (user: Row) => {
    if (!mentionTrigger) return;
    const cursor = editor.current?.selectionStart ?? body.length;
    const name = String(user["full_name"]);
    const inserted = `@${name} `;
    const nextBody = body.slice(0, mentionTrigger.start) + inserted + body.slice(cursor);
    const nextCursor = mentionTrigger.start + inserted.length;
    setBody(nextBody);
    setMentionIds((current) => [...new Set([...current, String(user["id"])])]);
    setMentionTrigger(null);
    requestAnimationFrame(() => {
      editor.current?.focus();
      editor.current?.setSelectionRange(nextCursor, nextCursor);
    });
  };
  const add = useMutation({
    mutationFn: () =>
      addOpportunityComment({ data: { kind, opportunityId: id, body, mentionIds } }),
    onSuccess: async () => {
      setBody("");
      setMentionIds([]);
      setMentionTrigger(null);
      toast.success(
        mentionIds.length
          ? "Team note added and mentioned teammates notified."
          : "Team note added.",
      );
      refresh();
      await queryClient.invalidateQueries({ queryKey: ["notifications"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
  return (
    <Card>
      <CardHeader>
        <CardTitle>Team collaboration</CardTitle>
        <CardDescription>
          Keep decisions, questions and handovers beside the response.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
          <div className="relative min-w-0 flex-1">
            <Textarea
              ref={editor}
              value={body}
              rows={5}
              onChange={(event) => {
                setBody(event.target.value);
                setMentionTrigger(findMention(event.target.value, event.target.selectionStart));
              }}
              onClick={(event) =>
                setMentionTrigger(
                  findMention(event.currentTarget.value, event.currentTarget.selectionStart),
                )
              }
              placeholder="Share an update or type @ to notify a teammate…"
              aria-label="Team collaboration note"
              aria-autocomplete="list"
              aria-expanded={Boolean(mentionTrigger && suggestions.length)}
            />
            {mentionTrigger ? (
              <div
                className="absolute left-0 right-0 top-full z-30 mt-1 max-h-64 overflow-y-auto rounded-xl border bg-popover p-1 shadow-xl"
                role="listbox"
                aria-label="Teammate suggestions"
              >
                {suggestions.length ? (
                  suggestions.map((user) => (
                    <button
                      key={String(user["id"])}
                      type="button"
                      role="option"
                      aria-selected="false"
                      className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left hover:bg-accent"
                      onClick={() => chooseMention(user)}
                    >
                      <Avatar className="size-8">
                        <AvatarFallback>
                          {String(user["full_name"] || "U")
                            .slice(0, 2)
                            .toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-medium">
                          {String(user["full_name"])}
                        </span>
                        <span className="block truncate text-xs text-muted-foreground">
                          {String(user["email"])}
                        </span>
                      </span>
                    </button>
                  ))
                ) : (
                  <p className="px-3 py-2 text-sm text-muted-foreground">No matching users.</p>
                )}
              </div>
            ) : null}
            {mentionIds.length ? (
              <div className="mt-2 flex flex-wrap gap-1">
                {mentionIds.map((userId) => {
                  const user = users.find((candidate) => String(candidate["id"]) === userId);
                  return (
                    <Badge key={userId} variant="secondary">
                      @{String(user?.["full_name"] || "Team member")}
                    </Badge>
                  );
                })}
              </div>
            ) : null}
          </div>
          <Button onClick={() => add.mutate()} disabled={add.isPending || !body.trim()}>
            <MessageSquare className="mr-2 size-4" />
            {add.isPending ? "Posting…" : "Post"}
          </Button>
        </div>
        <div className="mt-6 space-y-3">
          {comments.map((comment) => (
            <div key={String(comment["id"])} className="rounded-xl border p-4">
              <div className="flex justify-between gap-3">
                <p className="font-medium">{String(comment["author_name"] || "Team member")}</p>
                <p className="text-xs text-muted-foreground">
                  {new Date(String(comment["created_at"])).toLocaleString()}
                </p>
              </div>
              <p className="mt-2 whitespace-pre-wrap text-sm">{String(comment["body"])}</p>
              {Array.isArray(comment["mentions"]) && comment["mentions"].length ? (
                <div className="mt-3 flex flex-wrap gap-1">
                  {(comment["mentions"] as Row[]).map((mention) => (
                    <Badge key={String(mention["id"])} variant="secondary">
                      @{String(mention["full_name"])}
                    </Badge>
                  ))}
                </div>
              ) : null}
            </div>
          ))}
          {!comments.length ? (
            <p className="py-8 text-center text-muted-foreground">No team notes yet.</p>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}

function Submission({
  data,
  dependencies,
  kind,
  id,
  refresh,
}: {
  data: Workspace;
  dependencies: Dependencies | undefined;
  kind: OpportunityKind;
  id: string;
  refresh: () => void;
}) {
  const opportunity = data.opportunity;
  const editor = useRef<HTMLDivElement>(null);
  const [mailboxId, setMailboxId] = useState(
    String((dependencies?.mailboxes.find((m) => m["is_default"]) || {})["id"] || ""),
  );
  useEffect(() => {
    if (mailboxId || !dependencies?.mailboxes.length) return;
    const defaultMailbox =
      dependencies.mailboxes.find((mailbox) => mailbox["is_default"]) || dependencies.mailboxes[0];
    if (defaultMailbox) setMailboxId(String(defaultMailbox["id"]));
  }, [dependencies?.mailboxes, mailboxId]);
  const [recipient, setRecipient] = useState(
    String(opportunity["submission_email"] || opportunity["client_email"] || ""),
  );
  const [cc, setCc] = useState(parseList(opportunity["submission_cc"]));
  const [subject, setSubject] = useState(
    `${String(opportunity["reference"] || names[kind])}: ${String(opportunity["title"])}`,
  );
  const [fileMode, setFileMode] = useState<"separate" | "merged">("separate");
  const channel = String(opportunity["submission_type"] || "email") as
    "email" | "hand_delivery" | "portal";
  const pending = data.checklist.filter((item) => item["status"] !== "complete").length;
  const submit = useMutation({
    mutationFn: () =>
      submitOpportunity({
        data: {
          kind,
          opportunityId: id,
          channel,
          mailboxId,
          recipientEmail: recipient,
          cc,
          subject,
          bodyHtml: editor.current?.innerHTML || "",
          bodyText: editor.current?.innerText || "",
          fileMode,
        },
      }),
    onSuccess: () => {
      toast.success(channel === "email" ? "Submission email sent." : "Submission recorded.");
      refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const command = (name: string, value?: string) => {
    editor.current?.focus();
    document.execCommand(name, false, value);
  };
  return (
    <div className="grid gap-5 xl:grid-cols-[1fr_360px]">
      <Card>
        <CardHeader>
          <CardTitle>
            {channel === "email"
              ? "Send submission email"
              : channel === "portal"
                ? "Record portal submission"
                : "Record hand delivery"}
          </CardTitle>
          <CardDescription>
            {pending
              ? `${pending} checklist item${pending === 1 ? " is" : "s are"} still incomplete.`
              : "All checklist items are complete and this response can be submitted."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {channel === "email" ? (
            <>
              <SelectField
                label="Sending account"
                value={mailboxId}
                onChange={setMailboxId}
                options={(dependencies?.mailboxes || []).map((m) => ({
                  value: String(m["id"]),
                  label: `${String(m["name"])} — ${String(m["from_email"])}`,
                }))}
              />
              <Field label="To" type="email" value={recipient} onChange={setRecipient} />
              <Field
                label="CC"
                value={cc}
                onChange={setCc}
                placeholder="Separate addresses with commas"
              />
              <Field label="Subject" value={subject} onChange={setSubject} />
              <div className="space-y-2">
                <Label>Email body</Label>
                <div className="rounded-lg border">
                  <div className="flex gap-1 border-b bg-muted/40 p-2">
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      onClick={() => command("bold")}
                    >
                      <Bold className="size-4" />
                    </Button>
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      onClick={() => command("italic")}
                    >
                      <Italic className="size-4" />
                    </Button>
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      onClick={() => {
                        const url = window.prompt("Link URL");
                        if (url) command("createLink", url);
                      }}
                    >
                      <Link2 className="size-4" />
                    </Button>
                  </div>
                  <div
                    ref={editor}
                    contentEditable
                    suppressContentEditableWarning
                    className="min-h-52 p-4 text-sm outline-none"
                  >
                    <p>Dear Sir/Madam,</p>
                    <p>
                      Please find attached our response for{" "}
                      <strong>{String(opportunity["title"])}</strong>.
                    </p>
                    <p>Kind regards</p>
                  </div>
                </div>
              </div>
              <SelectField
                label="Document handling"
                value={fileMode}
                onChange={(v) => setFileMode(v as typeof fileMode)}
                options={[
                  { value: "separate", label: "Send documents separately" },
                  { value: "merged", label: "Merge PDF documents into one file" },
                ]}
              />
            </>
          ) : (
            <div className="rounded-xl border bg-muted/30 p-4 text-sm">
              <p>
                <strong>Submission method:</strong> {channel.replace("_", " ")}
              </p>
              <p className="mt-2">
                <strong>{channel === "portal" ? "Portal" : "Location"}:</strong>{" "}
                {String(
                  channel === "portal"
                    ? opportunity["portal_url"] || "Not set"
                    : opportunity["delivery_location"] || "Not set",
                )}
              </p>
              <p className="mt-2">
                <strong>Instructions:</strong>{" "}
                {String(opportunity["submission_instructions"] || "None")}
              </p>
            </div>
          )}
          <Button onClick={() => submit.mutate()} disabled={pending > 0 || submit.isPending}>
            <Send className="mr-2 size-4" />
            {channel === "email" ? "Send and mark submitted" : "Mark as submitted"}
          </Button>
        </CardContent>
      </Card>
      <div className="space-y-5">
        <Card>
          <CardHeader>
            <CardTitle>Submission history</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {data.submissions.map((submission) => (
              <div key={String(submission["id"])} className="rounded-lg border p-3">
                <div className="flex justify-between">
                  <Badge className="capitalize">
                    {String(submission["channel"]).replace("_", " ")}
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    {new Date(String(submission["submitted_at"])).toLocaleString()}
                  </span>
                </div>
                <p className="mt-2 text-sm font-medium">
                  {String(submission["subject"] || "Submission recorded")}
                </p>
                <p className="text-xs text-muted-foreground">
                  By {String(submission["submitted_by_name"] || "team member")}
                </p>
              </div>
            ))}
            {!data.submissions.length ? (
              <p className="text-sm text-muted-foreground">No submissions yet.</p>
            ) : null}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Conversation after submission</CardTitle>
            <CardDescription>
              Replies received from the submission recipient are linked automatically during mailbox
              sync.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {data.replies.map((reply) => (
              <div key={String(reply["id"])} className="rounded-lg border p-3">
                <div className="flex flex-wrap justify-between gap-2">
                  <p className="text-sm font-medium">{String(reply["from_email"])}</p>
                  <span className="text-xs text-muted-foreground">
                    {new Date(String(reply["received_at"])).toLocaleString()}
                  </span>
                </div>
                <p className="mt-1 text-sm font-semibold">
                  {String(reply["subject"] || "No subject")}
                </p>
                <EmailMessageContent
                  html={String(reply["body_html"] || "") || null}
                  text={String(reply["body"] || reply["snippet"] || "")}
                  attachments={parseEmailAttachments(reply["attachments"])}
                />
              </div>
            ))}
            {!data.replies.length ? (
              <p className="text-sm text-muted-foreground">
                No replies linked to this submission yet.
              </p>
            ) : null}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Details({
  opportunity,
  dependencies,
  kind,
  id,
  refresh,
}: {
  opportunity: Row;
  dependencies: Dependencies | undefined;
  kind: OpportunityKind;
  id: string;
  refresh: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({
    title: String(opportunity["title"] || ""),
    reference: String(opportunity["reference"] || ""),
    clientId: String(opportunity["client_id"] || ""),
    status: String(opportunity["status"] || "received"),
    dueDate: String(opportunity[kind === "bid" ? "closing_date" : "due_date"] || "").slice(0, 10),
    value: String(opportunity["value"] || "0"),
    currency: String(opportunity["currency"] || "MWK"),
    notes: String(opportunity["notes"] || opportunity["scope"] || ""),
    submissionType: String(opportunity["submission_type"] || "email") as
      "email" | "hand_delivery" | "portal",
    submissionEmail: String(opportunity["submission_email"] || ""),
    submissionCc: parseList(opportunity["submission_cc"]),
    deliveryLocation: String(opportunity["delivery_location"] || ""),
    portalUrl: String(opportunity["portal_url"] || ""),
    portalUsername: String(opportunity["portal_username"] || ""),
    submissionInstructions: String(opportunity["submission_instructions"] || ""),
    submissionTime: String(opportunity["submission_time"] || "").slice(0, 5),
  });
  const save = useMutation({
    mutationFn: () => updateOpportunity({ data: { id, kind, ...form, value: Number(form.value) } }),
    onSuccess: () => {
      toast.success("Details updated.");
      setEditing(false);
      refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const set = (key: keyof typeof form, value: string) =>
    setForm((current) => ({ ...current, [key]: value }));
  if (!editing)
    return (
      <Card>
        <CardHeader className="flex flex-row items-start justify-between">
          <div>
            <CardTitle>Opportunity details</CardTitle>
            <CardDescription>Core response and submission information.</CardDescription>
          </div>
          <Button variant="outline" onClick={() => setEditing(true)}>
            <Pencil className="mr-2 size-4" />
            Edit details
          </Button>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Detail label="Reference" value={form.reference} />
          <Detail
            label="Client"
            value={String(opportunity["client_company"] || opportunity["client_name"] || "")}
          />
          <Detail
            label="Due"
            value={`${form.dueDate || "Not set"}${form.submissionTime ? ` at ${form.submissionTime}` : ""}`}
          />
          <Detail
            label="Currency / value"
            value={`${form.currency} ${Number(form.value).toLocaleString()}`}
          />
          <Detail label="Submission type" value={form.submissionType.replace("_", " ")} />
          <Detail
            label="Submission destination"
            value={
              form.submissionType === "email"
                ? form.submissionEmail
                : form.submissionType === "portal"
                  ? form.portalUrl
                  : form.deliveryLocation
            }
          />
          <div className="sm:col-span-2 lg:col-span-3">
            <Detail label="Notes" value={form.notes || "None"} />
          </div>
        </CardContent>
      </Card>
    );
  return (
    <Card>
      <CardHeader>
        <CardTitle>Edit {names[kind]} details</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-4 sm:grid-cols-2">
        <Field label="Name" value={form.title} onChange={(v) => set("title", v)} />
        <Field label="Reference" value={form.reference} onChange={(v) => set("reference", v)} />
        <SelectField
          label="Client"
          value={form.clientId}
          onChange={(v) => set("clientId", v)}
          options={(dependencies?.clients || []).map((c) => ({
            value: String(c["id"]),
            label: String(c["company"] || c["name"]),
          }))}
        />
        <SelectField
          label="Status"
          value={form.status}
          onChange={(v) => set("status", v)}
          options={[
            ...(kind === "eoi"
              ? ["preparing", "submitted", "approved", "rejected"]
              : [
                  "received",
                  "identified",
                  "reviewing",
                  "responding",
                  "preparing",
                  "submitted",
                  "won",
                  "lost",
                ]),
          ].map((v) => ({ value: v, label: v }))}
        />
        <Field
          label="Due date"
          type="date"
          value={form.dueDate}
          onChange={(v) => set("dueDate", v)}
        />
        <Field
          label="Due time"
          type="time"
          value={form.submissionTime}
          onChange={(v) => set("submissionTime", v)}
        />
        <Field label="Value" type="number" value={form.value} onChange={(v) => set("value", v)} />
        <SelectField
          label="Currency"
          value={form.currency}
          onChange={(v) => set("currency", v)}
          options={(dependencies?.currencies || []).map((c) => ({
            value: String(c["code"]),
            label: `${String(c["code"])} — ${String(c["name"])}`,
          }))}
        />
        <SelectField
          label="Submission type"
          value={form.submissionType}
          onChange={(v) => set("submissionType", v)}
          options={[
            { value: "email", label: "Email" },
            { value: "hand_delivery", label: "Hand delivery" },
            { value: "portal", label: "Online portal" },
          ]}
        />
        {form.submissionType === "email" ? (
          <>
            <Field
              label="Send to"
              value={form.submissionEmail}
              onChange={(v) => set("submissionEmail", v)}
            />
            <Field label="CC" value={form.submissionCc} onChange={(v) => set("submissionCc", v)} />
          </>
        ) : null}
        {form.submissionType === "hand_delivery" ? (
          <Field
            label="Delivery location"
            value={form.deliveryLocation}
            onChange={(v) => set("deliveryLocation", v)}
          />
        ) : null}
        {form.submissionType === "portal" ? (
          <>
            <Field
              label="Portal URL"
              value={form.portalUrl}
              onChange={(v) => set("portalUrl", v)}
            />
            <Field
              label="Portal username"
              value={form.portalUsername}
              onChange={(v) => set("portalUsername", v)}
            />
          </>
        ) : null}
        <div className="space-y-2 sm:col-span-2">
          <Label>Notes</Label>
          <Textarea rows={4} value={form.notes} onChange={(e) => set("notes", e.target.value)} />
        </div>
        <div className="space-y-2 sm:col-span-2">
          <Label>Submission instructions</Label>
          <Textarea
            rows={3}
            value={form.submissionInstructions}
            onChange={(e) => set("submissionInstructions", e.target.value)}
          />
        </div>
        <div className="flex gap-2 sm:col-span-2">
          <Button onClick={() => save.mutate()} disabled={save.isPending}>
            Save changes
          </Button>
          <Button variant="outline" onClick={() => setEditing(false)}>
            Cancel
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 whitespace-pre-wrap font-medium capitalize">{value || "Not set"}</p>
    </div>
  );
}
function Field({
  label,
  value,
  onChange,
  type = "text",
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  placeholder?: string;
}) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <Input
        type={type}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}
function SelectField({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
}) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger>
          <SelectValue placeholder="Select" />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value} className="capitalize">
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
