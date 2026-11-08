import { useMemo, useState, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { createFileRoute, Link, Outlet, useLocation, useNavigate } from "@tanstack/react-router";
import { Calculator, FileSpreadsheet, Layers3, Plus, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { ConfirmAction } from "@/components/ConfirmAction";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  createCostSheet,
  deleteCostSheet,
  deleteCostSheetTemplate,
  getCostSheetDirectory,
  getCostSheetTemplates,
  type CostSheetDirectoryRecord,
  type CostSheetTemplateRecord,
} from "@/lib/cost-sheets.functions";
import { db } from "@/lib/db";

export const Route = createFileRoute("/cost-sheets")({
  component: CostSheetsRoute,
  head: () => ({
    meta: [
      { title: "Cost sheets | Gwero OS" },
      { name: "description", content: "Dynamic internal costing behind quotes and bids." },
    ],
  }),
});

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

function CostSheetsRoute() {
  const location = useLocation();
  return location.pathname !== "/cost-sheets" && location.pathname !== "/cost-sheets/" ? (
    <Outlet />
  ) : (
    <CostSheetsPage />
  );
}

function CostSheetsPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const loadDirectory = useServerFn(getCostSheetDirectory);
  const loadTemplates = useServerFn(getCostSheetTemplates);
  const createSheet = useServerFn(createCostSheet);
  const removeSheet = useServerFn(deleteCostSheet);
  const removeTemplate = useServerFn(deleteCostSheetTemplate);
  const [search, setSearch] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [templatesOpen, setTemplatesOpen] = useState(false);
  const [form, setForm] = useState({
    name: "",
    clientId: "none",
    currency: "MWK",
    templateId: "system-malawi-public-procurement",
    notes: "",
  });
  const { data: sheets = [], isLoading } = useQuery({
    queryKey: ["cost-sheet-directory"],
    queryFn: () => loadDirectory(),
  });
  const { data: templates = [] } = useQuery({
    queryKey: ["cost-sheet-templates"],
    queryFn: () => loadTemplates(),
  });
  const { data: clients = [] } = useQuery({
    queryKey: ["cost-sheet-clients"],
    queryFn: async () => {
      const { data, error } = await db
        .from("clients")
        .select("id, name, company, logo_path")
        .order("name", { ascending: true });
      if (error) throw new Error(error.message);
      return data;
    },
  });
  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return sheets;
    return sheets.filter((sheet) =>
      [sheet.name, sheet.client_name, sheet.opportunity_kind, sheet.opportunity_title, sheet.status]
        .join(" ")
        .toLowerCase()
        .includes(query),
    );
  }, [search, sheets]);
  const createMutation = useMutation({
    mutationFn: () =>
      createSheet({
        data: {
          name: form.name,
          currency: form.currency,
          notes: form.notes,
          ...(form.clientId === "none" ? {} : { clientId: form.clientId }),
          ...(form.templateId === "blank" ? {} : { templateId: form.templateId }),
        },
      }),
    onSuccess: async (result) => {
      toast.success("Cost sheet created.");
      setCreateOpen(false);
      await queryClient.invalidateQueries({ queryKey: ["cost-sheet-directory"] });
      await navigate({ to: "/cost-sheets/$id", params: { id: result.id } });
    },
    onError: (error: Error) => toast.error(error.message),
  });
  const deleteTemplateMutation = useMutation({
    mutationFn: (templateId: string) => removeTemplate({ data: { templateId } }),
    onSuccess: async () => {
      toast.success("Template deleted.");
      await queryClient.invalidateQueries({ queryKey: ["cost-sheet-templates"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });
  const deleteSheetMutation = useMutation({
    mutationFn: (costSheetId: string) => removeSheet({ data: { costSheetId } }),
    onSuccess: async () => {
      toast.success("Cost sheet deleted.");
      await queryClient.invalidateQueries({ queryKey: ["cost-sheet-directory"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <AppShell
      title="Cost sheets"
      description="Build defensible prices with reusable formulas, optional taxes and linked clients."
    >
      <div className="space-y-4">
        <Card className="overflow-hidden border-primary/15 bg-gradient-to-br from-card via-card to-primary/5">
          <CardContent className="grid gap-4 p-5 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
            <div>
              <p className="font-display text-lg font-semibold">Commercial costing workspace</p>
              <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
                Use tax-free, Malawi VAT, public procurement or landed-cost templates. Every rate
                and formula remains editable, optional and removable.
              </p>
              <div className="relative mt-4 max-w-xl">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  className="bg-background pl-9"
                  placeholder="Search sheets, clients, RFQs, RFPs or bids"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                />
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={() => setTemplatesOpen(true)}>
                <Layers3 className="mr-2 size-4" /> Templates
              </Button>
              <Button onClick={() => setCreateOpen(true)}>
                <Plus className="mr-2 size-4" /> New cost sheet
              </Button>
            </div>
          </CardContent>
        </Card>

        <p className="text-sm text-muted-foreground">
          <span className="font-semibold text-foreground">{filtered.length}</span> cost sheet
          {filtered.length === 1 ? "" : "s"}
        </p>
        {isLoading ? (
          <Card>
            <CardContent className="p-8 text-center text-muted-foreground">
              Loading cost sheets…
            </CardContent>
          </Card>
        ) : filtered.length ? (
          <div className="grid gap-3 lg:grid-cols-2 2xl:grid-cols-3">
            {filtered.map((sheet) => (
              <CostSheetCard
                key={sheet.id}
                sheet={sheet}
                deleting={deleteSheetMutation.isPending}
                onDelete={() => deleteSheetMutation.mutateAsync(sheet.id)}
              />
            ))}
          </div>
        ) : (
          <Card className="border-dashed">
            <CardContent className="grid place-items-center p-10 text-center">
              <FileSpreadsheet className="size-9 text-muted-foreground" />
              <p className="mt-3 font-semibold">No matching cost sheets</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Create one from a reusable template.
              </p>
            </CardContent>
          </Card>
        )}
      </div>
      <CreateSheetDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        form={form}
        setForm={setForm}
        clients={clients}
        templates={templates}
        saving={createMutation.isPending}
        onSave={() => createMutation.mutate()}
      />
      <TemplateLibraryDialog
        open={templatesOpen}
        onOpenChange={setTemplatesOpen}
        templates={templates}
        deleting={deleteTemplateMutation.isPending}
        onDelete={(id) => deleteTemplateMutation.mutateAsync(id)}
      />
    </AppShell>
  );
}

function CostSheetCard({
  sheet,
  deleting,
  onDelete,
}: {
  sheet: CostSheetDirectoryRecord;
  deleting: boolean;
  onDelete: () => Promise<unknown>;
}) {
  const clientName = sheet.client_name || "No client linked";
  return (
    <Card className="group relative h-full transition hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-md">
      <Link to="/cost-sheets/$id" params={{ id: sheet.id }} className="block h-full pr-12">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <Avatar className="size-11 rounded-xl border bg-white">
              <AvatarImage src={sheet.client_logo || undefined} className="object-contain p-1.5" />
              <AvatarFallback className="rounded-xl bg-primary/10 text-xs font-semibold text-primary">
                {sheet.client_name ? (
                  initials(sheet.client_name)
                ) : (
                  <Calculator className="size-4" />
                )}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <div className="flex items-start justify-between gap-2">
                <h2 className="truncate font-display font-semibold">{sheet.name}</h2>
                <Badge variant="secondary" className="shrink-0 capitalize">
                  {sheet.status}
                </Badge>
              </div>
              <p className="mt-0.5 truncate text-sm text-muted-foreground">{clientName}</p>
            </div>
          </div>
          <div className="mt-4 grid grid-cols-3 gap-2 rounded-xl bg-muted/45 p-3 text-xs">
            <div>
              <p className="text-muted-foreground">Currency</p>
              <p className="mt-0.5 font-semibold">{sheet.currency}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Items</p>
              <p className="mt-0.5 font-semibold tabular-nums">{Number(sheet.item_count || 0)}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Source</p>
              <p className="mt-0.5 truncate font-semibold">{sheet.opportunity_kind || "Direct"}</p>
            </div>
          </div>
          {sheet.opportunity_title ? (
            <p className="mt-3 line-clamp-1 text-xs text-muted-foreground">
              {sheet.opportunity_kind}: {sheet.opportunity_title}
            </p>
          ) : null}
        </CardContent>
      </Link>
      <div className="absolute right-3 top-3">
        <ConfirmAction
          title={`Delete ${sheet.name}?`}
          description="This permanently removes the cost sheet, its items, custom columns and quotation links. Linked opportunities will be kept and unlinked."
          onConfirm={onDelete}
          disabled={deleting}
          trigger={
            <Button
              size="icon"
              variant="ghost"
              className="text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
              aria-label={`Delete ${sheet.name}`}
            >
              <Trash2 className="size-4" />
            </Button>
          }
        />
      </div>
    </Card>
  );
}

type SheetForm = {
  name: string;
  clientId: string;
  currency: string;
  templateId: string;
  notes: string;
};

function CreateSheetDialog({
  open,
  onOpenChange,
  form,
  setForm,
  clients,
  templates,
  saving,
  onSave,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  form: SheetForm;
  setForm: React.Dispatch<React.SetStateAction<SheetForm>>;
  clients: Array<{ id: string; name: string; company: string | null }>;
  templates: CostSheetTemplateRecord[];
  saving: boolean;
  onSave: () => void;
}) {
  const selected = templates.find((template) => template.id === form.templateId);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>New cost sheet</DialogTitle>
          <DialogDescription>
            Start blank or reuse a tested formula and tax structure.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Name">
            <Input
              value={form.name}
              onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
            />
          </Field>
          <Field label="Client">
            <Select
              value={form.clientId}
              onValueChange={(clientId) => setForm((current) => ({ ...current, clientId }))}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No client yet</SelectItem>
                {clients.map((client) => (
                  <SelectItem key={client.id} value={client.id}>
                    {client.company || client.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Template" className="sm:col-span-2">
            <Select
              value={form.templateId}
              onValueChange={(templateId) => {
                const template = templates.find((item) => item.id === templateId);
                setForm((current) => ({
                  ...current,
                  templateId,
                  currency: template?.currency || current.currency,
                }));
              }}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="blank">Blank sheet</SelectItem>
                {templates.map((template) => (
                  <SelectItem key={template.id} value={template.id}>
                    {template.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selected ? (
              <p className="mt-2 text-xs text-muted-foreground">{selected.description}</p>
            ) : null}
          </Field>
          <Field label="Currency">
            <Input
              value={form.currency}
              maxLength={10}
              onChange={(event) =>
                setForm((current) => ({ ...current, currency: event.target.value.toUpperCase() }))
              }
            />
          </Field>
          <Field label="Notes" className="sm:col-span-2">
            <Textarea
              rows={3}
              value={form.notes}
              onChange={(event) =>
                setForm((current) => ({ ...current, notes: event.target.value }))
              }
            />
          </Field>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button disabled={saving || !form.name.trim()} onClick={onSave}>
            {saving ? "Creating…" : "Create cost sheet"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function TemplateLibraryDialog({
  open,
  onOpenChange,
  templates,
  deleting,
  onDelete,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  templates: CostSheetTemplateRecord[];
  deleting: boolean;
  onDelete: (id: string) => Promise<unknown>;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Cost sheet templates</DialogTitle>
          <DialogDescription>
            Built-in Malawi profiles are safe starting points. Save any configured sheet as a
            reusable custom template.
          </DialogDescription>
        </DialogHeader>
        <div className="grid max-h-[60vh] gap-3 overflow-y-auto sm:grid-cols-2">
          {templates.map((template) => (
            <article key={template.id} className="rounded-xl border p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-semibold">{template.name}</p>
                  <Badge variant="outline" className="mt-1">
                    {template.is_system ? "Built in" : "Custom"}
                  </Badge>
                </div>
                {!template.is_system ? (
                  <ConfirmAction
                    title={`Delete ${template.name}?`}
                    description="Existing cost sheets will not be changed."
                    onConfirm={() => onDelete(template.id)}
                    trigger={
                      <Button size="icon" variant="ghost" disabled={deleting}>
                        <Trash2 className="size-4" />
                      </Button>
                    }
                  />
                ) : null}
              </div>
              <p className="mt-3 text-sm text-muted-foreground">{template.description}</p>
              <p className="mt-3 text-xs text-muted-foreground">
                {template.columns.length} configurable columns · {template.currency}
              </p>
            </article>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Field({
  label,
  className,
  children,
}: {
  label: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={`space-y-1.5 ${className || ""}`}>
      <Label>{label}</Label>
      {children}
    </div>
  );
}
