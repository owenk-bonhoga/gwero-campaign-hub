import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useNavigate } from "@tanstack/react-router";
import {
  Calculator,
  BookmarkPlus,
  ExternalLink,
  FileText,
  FileImage,
  ImagePlus,
  Pencil,
  Plus,
  Settings2,
  Sigma,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { money } from "@/components/AppShell";
import { ConfirmAction } from "@/components/ConfirmAction";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { Textarea } from "@/components/ui/textarea";
import {
  applyCostSheetTemplate,
  deleteCostSheet,
  deleteCostSheetColumn,
  deleteCostSheetItem,
  getCostSheetWorkspace,
  getCostSheetTemplates,
  saveCostSheetAsTemplate,
  saveCostSheetColumn,
  saveCostSheetColumnRules,
  saveCostSheetItem,
  setCostSheetSourceQuote,
  updateCostSheet,
  type CostSheetAttachment,
  type CostSheetColumn,
  type CostSheetItem,
  type CostSheetSourceQuote,
  type CostSheetTemplateRecord,
} from "@/lib/cost-sheets.functions";
import {
  calculateCostSheetRow,
  columnKey,
  costSheetSystemColumnKeys,
  normalizeCostSheetColumnRules,
  type CostSheetSystemColumnRules,
} from "@/lib/cost-sheet-formula";

const categories = ["labour", "materials", "equipment", "logistics", "services", "other"];

type SheetRecord = {
  id: string;
  name: string;
  status: string;
  currency: string;
  notes: string | null;
  column_rules: CostSheetSystemColumnRules;
  client_name: string | null;
  client_logo: string | null;
  updated_at: string;
};

type ItemForm = {
  category: string;
  description: string;
  quantity: string;
  unitCost: string;
  markupPercent: string;
  customValues: Record<string, string>;
  attachments: CostSheetAttachment[];
};

type ColumnForm = {
  name: string;
  key: string;
  dataType: "text" | "number" | "formula";
  defaultValue: string;
  formulaExpression: string;
};

const emptyColumn: ColumnForm = {
  name: "",
  key: "",
  dataType: "text",
  defaultValue: "",
  formulaExpression: "",
};
const emptyColumns: CostSheetColumn[] = [];
const emptyItems: CostSheetItem[] = [];

function attachmentUrl(path: string) {
  const [ownerId, fileId] = path.split("/");
  return `/api/attachments/${encodeURIComponent(ownerId || "")}/${encodeURIComponent(fileId || "")}`;
}

function itemDefaults(columns: CostSheetColumn[], rulesInput?: unknown): ItemForm {
  const rules = normalizeCostSheetColumnRules(rulesInput);
  return {
    category: "labour",
    description: "",
    quantity: String(rules.quantity.defaultValue),
    unitCost: String(rules.unit_cost.defaultValue),
    markupPercent: String(rules.markup_percent.defaultValue),
    customValues: Object.fromEntries(
      columns
        .filter((column) => column.data_type !== "formula")
        .map((column) => [column.column_key, column.default_value || ""]),
    ),
    attachments: [],
  };
}

function valueForColumn(item: CostSheetItem, column: CostSheetColumn) {
  const value = item.custom_values?.[column.column_key];
  return value === undefined || value === "" ? column.default_value || "" : value;
}

export function CostSheetWorkspace({ costSheetId }: { costSheetId: string }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const loadWorkspace = useServerFn(getCostSheetWorkspace);
  const saveItem = useServerFn(saveCostSheetItem);
  const removeItem = useServerFn(deleteCostSheetItem);
  const saveColumn = useServerFn(saveCostSheetColumn);
  const saveRules = useServerFn(saveCostSheetColumnRules);
  const removeColumn = useServerFn(deleteCostSheetColumn);
  const saveSheet = useServerFn(updateCostSheet);
  const removeSheet = useServerFn(deleteCostSheet);
  const setSourceQuote = useServerFn(setCostSheetSourceQuote);
  const loadTemplates = useServerFn(getCostSheetTemplates);
  const applyTemplate = useServerFn(applyCostSheetTemplate);
  const saveAsTemplate = useServerFn(saveCostSheetAsTemplate);
  const queryKey = ["cost-sheet-workspace", costSheetId];
  const { data, isLoading, error } = useQuery({
    queryKey,
    queryFn: () => loadWorkspace({ data: { costSheetId } }),
  });
  const { data: templates = [] } = useQuery({
    queryKey: ["cost-sheet-templates"],
    queryFn: () => loadTemplates(),
  });
  const sheet = data?.sheet as SheetRecord | undefined;
  const columns = data?.columns || emptyColumns;
  const items = data?.items || emptyItems;
  const rules = useMemo(
    () => normalizeCostSheetColumnRules(sheet?.column_rules),
    [sheet?.column_rules],
  );
  const sourceQuotes = data?.sourceQuotes || [];
  const linkedQuotes = sourceQuotes.filter((quote) => Boolean(quote.is_linked));
  const calculations = useMemo(
    () => new Map(items.map((item) => [item.id, calculateCostSheetRow(item, columns, rules)])),
    [columns, items, rules],
  );
  const totals = useMemo(() => {
    let cost = 0;
    let sell = 0;
    for (const calculation of calculations.values()) {
      cost += calculation.lineCost;
      sell += calculation.sellPrice;
    }
    return {
      cost,
      sell,
      profit: [...calculations.values()].reduce((sum, value) => sum + value.grossProfit, 0),
      margin: sell
        ? ([...calculations.values()].reduce((sum, value) => sum + value.grossProfit, 0) / sell) *
          100
        : 0,
    };
  }, [calculations]);

  const [itemOpen, setItemOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<CostSheetItem | null>(null);
  const [itemForm, setItemForm] = useState<ItemForm>(() => itemDefaults([]));
  const [pendingImages, setPendingImages] = useState<File[]>([]);
  const [columnOpen, setColumnOpen] = useState(false);
  const [editingColumn, setEditingColumn] = useState<CostSheetColumn | null>(null);
  const [columnForm, setColumnForm] = useState<ColumnForm>(emptyColumn);
  const [preview, setPreview] = useState<CostSheetAttachment | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [rulesOpen, setRulesOpen] = useState(false);
  const [rulesForm, setRulesForm] = useState<CostSheetSystemColumnRules>(() =>
    normalizeCostSheetColumnRules(undefined),
  );
  const [quoteOpen, setQuoteOpen] = useState(false);
  const [templateOpen, setTemplateOpen] = useState(false);
  const [saveTemplateOpen, setSaveTemplateOpen] = useState(false);
  const [selectedTemplateId, setSelectedTemplateId] = useState("");
  const [templateForm, setTemplateForm] = useState({ name: "", description: "" });
  const [selectedQuoteId, setSelectedQuoteId] = useState("");
  const [sheetForm, setSheetForm] = useState({ name: "", status: "draft", notes: "" });

  const refresh = () => queryClient.invalidateQueries({ queryKey });
  const openNewItem = () => {
    setEditingItem(null);
    setItemForm(itemDefaults(columns, rules));
    setPendingImages([]);
    setItemOpen(true);
  };
  const openEditItem = (item: CostSheetItem) => {
    setEditingItem(item);
    setItemForm({
      category: item.category,
      description: item.description,
      quantity: String(item.quantity),
      unitCost: String(item.unit_cost),
      markupPercent: String(item.markup_percent),
      customValues: Object.fromEntries(
        columns
          .filter((column) => column.data_type !== "formula")
          .map((column) => [column.column_key, String(valueForColumn(item, column))]),
      ),
      attachments: item.attachments || [],
    });
    setPendingImages([]);
    setItemOpen(true);
  };
  const openNewColumn = () => {
    setEditingColumn(null);
    setColumnForm(emptyColumn);
    setColumnOpen(true);
  };
  const openEditColumn = (column: CostSheetColumn) => {
    setEditingColumn(column);
    setColumnForm({
      name: column.name,
      key: column.column_key,
      dataType: column.data_type,
      defaultValue: column.default_value || "",
      formulaExpression: column.formula_expression || "",
    });
    setColumnOpen(true);
  };

  const itemMutation = useMutation({
    mutationFn: async () => {
      const itemId = editingItem?.id || crypto.randomUUID();
      const uploaded = await Promise.all(
        pendingImages.map(async (file) => {
          const body = new FormData();
          body.append("ownerId", itemId);
          body.append("file", file);
          const response = await fetch("/api/attachments/upload", { method: "POST", body });
          const result = (await response.json()) as CostSheetAttachment & { error?: string };
          if (!response.ok) throw new Error(result.error || `Could not upload ${file.name}.`);
          return result;
        }),
      );
      return saveItem({
        data: {
          costSheetId,
          itemId,
          category: itemForm.category,
          description: itemForm.description,
          quantity: Number(itemForm.quantity),
          unitCost: Number(itemForm.unitCost),
          markupPercent: Number(itemForm.markupPercent),
          customValues: itemForm.customValues,
          attachments: [...itemForm.attachments, ...uploaded],
        },
      });
    },
    onSuccess: async () => {
      toast.success(editingItem ? "Line item updated." : "Line item added.");
      setItemOpen(false);
      await refresh();
    },
    onError: (mutationError: Error) => toast.error(mutationError.message),
  });
  const deleteItemMutation = useMutation({
    mutationFn: (itemId: string) => removeItem({ data: { costSheetId, itemId } }),
    onSuccess: async () => {
      toast.success("Line item deleted.");
      await refresh();
    },
    onError: (mutationError: Error) => toast.error(mutationError.message),
  });
  const columnMutation = useMutation({
    mutationFn: () =>
      saveColumn({
        data: {
          costSheetId,
          ...(editingColumn ? { columnId: editingColumn.id } : {}),
          name: columnForm.name,
          key: columnForm.key || columnKey(columnForm.name),
          dataType: columnForm.dataType,
          defaultValue: columnForm.defaultValue,
          formulaExpression: columnForm.formulaExpression,
        },
      }),
    onSuccess: async () => {
      toast.success(editingColumn ? "Custom column updated." : "Custom column added.");
      setColumnOpen(false);
      await refresh();
    },
    onError: (mutationError: Error) => toast.error(mutationError.message),
  });
  const deleteColumnMutation = useMutation({
    mutationFn: (columnId: string) => removeColumn({ data: { costSheetId, columnId } }),
    onSuccess: async () => {
      toast.success("Custom column deleted.");
      await refresh();
    },
    onError: (mutationError: Error) => toast.error(mutationError.message),
  });
  const sheetMutation = useMutation({
    mutationFn: () => saveSheet({ data: { costSheetId, ...sheetForm } }),
    onSuccess: async () => {
      toast.success("Cost sheet details updated.");
      setSettingsOpen(false);
      await refresh();
    },
    onError: (mutationError: Error) => toast.error(mutationError.message),
  });
  const deleteSheetMutation = useMutation({
    mutationFn: () => removeSheet({ data: { costSheetId } }),
    onSuccess: async () => {
      toast.success("Cost sheet deleted.");
      queryClient.removeQueries({ queryKey });
      await queryClient.invalidateQueries({ queryKey: ["cost-sheet-directory"] });
      await navigate({ to: "/cost-sheets" });
    },
    onError: (mutationError: Error) => toast.error(mutationError.message),
  });
  const rulesMutation = useMutation({
    mutationFn: () => saveRules({ data: { costSheetId, rules: rulesForm } }),
    onSuccess: async () => {
      toast.success("Default column rules updated.");
      setRulesOpen(false);
      await refresh();
    },
    onError: (mutationError: Error) => toast.error(mutationError.message),
  });
  const quoteMutation = useMutation({
    mutationFn: (payload: { quoteId: string; linked: boolean }) =>
      setSourceQuote({ data: { costSheetId, ...payload } }),
    onSuccess: async (_result, payload) => {
      toast.success(payload.linked ? "Source quotation linked." : "Source quotation unlinked.");
      setQuoteOpen(false);
      setSelectedQuoteId("");
      await refresh();
    },
    onError: (mutationError: Error) => toast.error(mutationError.message),
  });
  const applyTemplateMutation = useMutation({
    mutationFn: () => applyTemplate({ data: { costSheetId, templateId: selectedTemplateId } }),
    onSuccess: async () => {
      toast.success("Template applied. Existing custom columns were kept.");
      setTemplateOpen(false);
      setSelectedTemplateId("");
      await refresh();
    },
    onError: (mutationError: Error) => toast.error(mutationError.message),
  });
  const saveTemplateMutation = useMutation({
    mutationFn: () => saveAsTemplate({ data: { costSheetId, ...templateForm } }),
    onSuccess: async () => {
      toast.success("Reusable template saved.");
      setSaveTemplateOpen(false);
      setTemplateForm({ name: "", description: "" });
      await queryClient.invalidateQueries({ queryKey: ["cost-sheet-templates"] });
    },
    onError: (mutationError: Error) => toast.error(mutationError.message),
  });

  if (isLoading)
    return (
      <div className="rounded-2xl border bg-card p-10 text-center text-muted-foreground">
        Loading cost sheet…
      </div>
    );
  if (error || !sheet)
    return (
      <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-6 text-destructive">
        {error instanceof Error ? error.message : "Cost sheet not found."}
      </div>
    );

  const currency = sheet.currency || "USD";
  const customTotals = Object.fromEntries(
    columns
      .filter((column) => column.data_type !== "text")
      .map((column) => [
        column.column_key,
        items.reduce((sum, item) => {
          const value = calculations.get(item.id)?.custom[column.column_key];
          return sum + (typeof value === "number" && Number.isFinite(value) ? value : 0);
        }, 0),
      ]),
  );

  return (
    <div className="min-w-0 space-y-4">
      <section className="overflow-hidden rounded-2xl border bg-gradient-to-br from-primary/10 via-background to-emerald-50/60 shadow-sm">
        <div className="flex flex-col gap-4 p-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0">
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <Badge variant="secondary" className="capitalize">
                {sheet.status}
              </Badge>
              <span className="text-sm text-muted-foreground">{currency}</span>
            </div>
            <h1 className="truncate font-display text-2xl font-bold text-foreground">
              {sheet.name}
            </h1>
            <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
              {sheet.client_name
                ? `Prepared for ${sheet.client_name}. `
                : "Internal costing workspace. "}
              Build costs, pricing, images and calculated columns in one place.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => setTemplateOpen(true)}>
              <FileText className="mr-2 size-4" /> Apply template
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                setTemplateForm({ name: `${sheet.name} template`, description: "" });
                setSaveTemplateOpen(true);
              }}
            >
              <BookmarkPlus className="mr-2 size-4" /> Save template
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                setSheetForm({ name: sheet.name, status: sheet.status, notes: sheet.notes || "" });
                setSettingsOpen(true);
              }}
            >
              <Settings2 className="mr-2 size-4" /> Sheet details
            </Button>
            <ConfirmAction
              title={`Delete ${sheet.name}?`}
              description="This permanently removes the cost sheet, its items, custom columns and quotation links. Linked opportunities will be kept and unlinked."
              onConfirm={() => deleteSheetMutation.mutateAsync()}
              disabled={deleteSheetMutation.isPending}
              trigger={
                <Button variant="outline" className="text-destructive hover:text-destructive">
                  <Trash2 className="mr-2 size-4" /> Delete sheet
                </Button>
              }
            />
            <Button variant="outline" onClick={openNewColumn}>
              <Plus className="mr-2 size-4" /> Custom column
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                setRulesForm(rules);
                setRulesOpen(true);
              }}
            >
              <Sigma className="mr-2 size-4" /> Column rules
            </Button>
            <Button onClick={openNewItem}>
              <Plus className="mr-2 size-4" /> Add item
            </Button>
          </div>
        </div>
      </section>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {rules.line_cost.enabled ? (
          <Metric
            label={rules.line_cost.label}
            value={money(totals.cost, currency)}
            icon={Calculator}
          />
        ) : null}
        {rules.sell_price.enabled ? (
          <Metric
            label={rules.sell_price.label}
            value={money(totals.sell, currency)}
            icon={Sigma}
          />
        ) : null}
        {rules.gross_profit.enabled ? (
          <Metric
            label={rules.gross_profit.label}
            value={money(totals.profit, currency)}
            icon={Calculator}
          />
        ) : null}
        {rules.sell_price.enabled && rules.gross_profit.enabled ? (
          <Metric label="Margin" value={`${totals.margin.toFixed(1)}%`} icon={Sigma} />
        ) : null}
      </section>

      <Card className="overflow-hidden">
        <CardHeader className="border-b bg-muted/20">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle>Supporting quotations</CardTitle>
              <p className="mt-1 text-sm text-muted-foreground">
                Link the vendor or external quotations that support the figures in this sheet.
              </p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" asChild>
                <a href="/vendors">
                  <FileText className="mr-2 size-4" /> Manage quotations
                </a>
              </Button>
              <Button onClick={() => setQuoteOpen(true)}>
                <Plus className="mr-2 size-4" /> Link quotation
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-4">
          {linkedQuotes.length ? (
            <div className="grid gap-3 lg:grid-cols-2">
              {linkedQuotes.map((quote) => (
                <SourceQuoteCard
                  key={quote.id}
                  quote={quote}
                  onUnlink={() => quoteMutation.mutate({ quoteId: quote.id, linked: false })}
                />
              ))}
            </div>
          ) : (
            <div className="rounded-xl border border-dashed p-7 text-center">
              <FileText className="mx-auto size-8 text-muted-foreground" />
              <p className="mt-2 font-medium">No supporting quotation linked</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Add a quote from a saved vendor or any other external source, then link it here.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="min-w-0 overflow-hidden">
        <CardHeader className="border-b bg-muted/20">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle>Cost items</CardTitle>
              <p className="mt-1 text-sm text-muted-foreground">
                Edit any row, attach reference images, or extend the sheet with your own columns.
              </p>
            </div>
            <Badge variant="outline">
              {items.length} item{items.length === 1 ? "" : "s"}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="max-w-full overflow-x-auto">
            <table className="w-full min-w-max border-collapse text-sm">
              <thead className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="sticky left-0 z-20 min-w-64 border-b bg-muted px-4 py-3 font-semibold">
                    Item
                  </th>
                  <th className="min-w-32 border-b px-3 py-3 font-semibold">Category</th>
                  {rules.quantity.enabled ? (
                    <th className="min-w-24 border-b px-3 py-3 text-right font-semibold">
                      {rules.quantity.label}
                    </th>
                  ) : null}
                  {rules.unit_cost.enabled ? (
                    <th className="min-w-32 border-b px-3 py-3 text-right font-semibold">
                      {rules.unit_cost.label}
                    </th>
                  ) : null}
                  {rules.markup_percent.enabled ? (
                    <th className="min-w-28 border-b px-3 py-3 text-right font-semibold">
                      {rules.markup_percent.label}
                    </th>
                  ) : null}
                  {columns.map((column) => (
                    <th
                      key={column.id}
                      className="min-w-40 border-b px-3 py-2 font-semibold normal-case tracking-normal"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <p className="truncate">{column.name}</p>
                          <p className="font-mono text-[10px] font-normal text-muted-foreground">
                            {column.column_key}
                          </p>
                        </div>
                        <div className="flex shrink-0">
                          <Button
                            size="icon"
                            variant="ghost"
                            className="size-7"
                            aria-label={`Edit ${column.name} column`}
                            onClick={() => openEditColumn(column)}
                          >
                            <Pencil className="size-3.5" />
                          </Button>
                          <ConfirmAction
                            title={`Delete ${column.name}?`}
                            description="The column and its saved row values will be removed. Formulas using it must be changed first."
                            onConfirm={() => deleteColumnMutation.mutateAsync(column.id)}
                            trigger={
                              <Button
                                size="icon"
                                variant="ghost"
                                className="size-7"
                                aria-label={`Delete ${column.name} column`}
                              >
                                <Trash2 className="size-3.5" />
                              </Button>
                            }
                          />
                        </div>
                      </div>
                    </th>
                  ))}
                  {rules.line_cost.enabled ? (
                    <th className="min-w-32 border-b px-3 py-3 text-right font-semibold">
                      {rules.line_cost.label}
                    </th>
                  ) : null}
                  {rules.sell_price.enabled ? (
                    <th className="min-w-32 border-b px-3 py-3 text-right font-semibold">
                      {rules.sell_price.label}
                    </th>
                  ) : null}
                  {rules.gross_profit.enabled ? (
                    <th className="min-w-32 border-b px-3 py-3 text-right font-semibold">
                      {rules.gross_profit.label}
                    </th>
                  ) : null}
                  <th className="min-w-36 border-b px-3 py-3 font-semibold">Images</th>
                  <th className="w-24 border-b px-3 py-3 text-right font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => {
                  const calculation = calculations.get(item.id)!;
                  return (
                    <tr
                      key={item.id}
                      className="group border-b transition-colors hover:bg-muted/25"
                    >
                      <td className="sticky left-0 z-10 max-w-80 bg-background px-4 py-4 group-hover:bg-muted/25">
                        <p className="font-medium text-foreground">{item.description}</p>
                      </td>
                      <td className="px-3 py-4">
                        <Badge variant="outline" className="capitalize">
                          {item.category}
                        </Badge>
                      </td>
                      {rules.quantity.enabled ? (
                        <td className="px-3 py-4 text-right tabular-nums">{item.quantity}</td>
                      ) : null}
                      {rules.unit_cost.enabled ? (
                        <td className="px-3 py-4 text-right tabular-nums">
                          {money(item.unit_cost, currency)}
                        </td>
                      ) : null}
                      {rules.markup_percent.enabled ? (
                        <td className="px-3 py-4 text-right tabular-nums">
                          {item.markup_percent}%
                        </td>
                      ) : null}
                      {columns.map((column) => {
                        const value = calculation.custom[column.column_key];
                        const formulaError = calculation.errors[column.column_key];
                        return (
                          <td
                            key={column.id}
                            className="px-3 py-4"
                            title={formulaError || column.formula_expression || undefined}
                          >
                            {formulaError ? (
                              <span className="font-medium text-destructive">#ERROR</span>
                            ) : column.data_type === "text" ? (
                              <span className="block max-w-56 truncate">
                                {String(value || "—")}
                              </span>
                            ) : (
                              <span className="block text-right tabular-nums">
                                {Number(value || 0).toLocaleString(undefined, {
                                  maximumFractionDigits: 4,
                                })}
                              </span>
                            )}
                          </td>
                        );
                      })}
                      {rules.line_cost.enabled ? (
                        <td className="px-3 py-4 text-right font-medium tabular-nums">
                          {calculation.errors["line_cost"] ? (
                            <span
                              className="text-destructive"
                              title={calculation.errors["line_cost"]}
                            >
                              #ERROR
                            </span>
                          ) : (
                            money(calculation.lineCost, currency)
                          )}
                        </td>
                      ) : null}
                      {rules.sell_price.enabled ? (
                        <td className="px-3 py-4 text-right font-semibold tabular-nums text-primary">
                          {calculation.errors["sell_price"] ? (
                            <span
                              className="text-destructive"
                              title={calculation.errors["sell_price"]}
                            >
                              #ERROR
                            </span>
                          ) : (
                            money(calculation.sellPrice, currency)
                          )}
                        </td>
                      ) : null}
                      {rules.gross_profit.enabled ? (
                        <td className="px-3 py-4 text-right font-medium tabular-nums">
                          {calculation.errors["gross_profit"] ? (
                            <span
                              className="text-destructive"
                              title={calculation.errors["gross_profit"]}
                            >
                              #ERROR
                            </span>
                          ) : (
                            money(calculation.grossProfit, currency)
                          )}
                        </td>
                      ) : null}
                      <td className="px-3 py-3">
                        <div className="flex min-h-10 items-center -space-x-2">
                          {(item.attachments || []).slice(0, 4).map((attachment) => (
                            <button
                              key={attachment.path}
                              type="button"
                              className="relative size-10 overflow-hidden rounded-lg border-2 border-background bg-muted shadow-sm transition hover:z-10 hover:scale-110"
                              onClick={() => setPreview(attachment)}
                              aria-label={`View ${attachment.name}`}
                            >
                              <img
                                src={attachmentUrl(attachment.path)}
                                alt={attachment.name}
                                className="size-full object-cover"
                              />
                            </button>
                          ))}
                          {(item.attachments || []).length > 4 ? (
                            <span className="relative grid size-10 place-items-center rounded-lg border-2 border-background bg-muted text-xs font-semibold">
                              +{item.attachments.length - 4}
                            </span>
                          ) : null}
                          {!item.attachments?.length ? (
                            <span className="text-xs text-muted-foreground">No images</span>
                          ) : null}
                        </div>
                      </td>
                      <td className="px-3 py-4">
                        <div className="flex justify-end gap-1">
                          <Button
                            size="icon"
                            variant="ghost"
                            aria-label={`Edit ${item.description}`}
                            onClick={() => openEditItem(item)}
                          >
                            <Pencil className="size-4" />
                          </Button>
                          <ConfirmAction
                            title="Delete this cost item?"
                            description="The row will be removed from this cost sheet."
                            onConfirm={() => deleteItemMutation.mutateAsync(item.id)}
                            trigger={
                              <Button
                                size="icon"
                                variant="ghost"
                                aria-label={`Delete ${item.description}`}
                              >
                                <Trash2 className="size-4" />
                              </Button>
                            }
                          />
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {!items.length ? (
                  <tr>
                    <td
                      colSpan={
                        4 +
                        columns.length +
                        costSheetSystemColumnKeys.filter((key) => rules[key].enabled).length
                      }
                      className="px-5 py-8 text-center"
                    >
                      <FileImage className="mx-auto mb-3 size-9 text-muted-foreground/60" />
                      <p className="font-medium">No cost items yet</p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        Add the first item to start calculating this sheet.
                      </p>
                      <Button className="mt-4" onClick={openNewItem}>
                        <Plus className="mr-2 size-4" /> Add first item
                      </Button>
                    </td>
                  </tr>
                ) : null}
              </tbody>
              {items.length ? (
                <tfoot className="border-t-2 bg-muted/30 font-semibold">
                  <tr>
                    <td className="sticky left-0 z-10 bg-muted px-4 py-4" colSpan={2}>
                      Totals
                    </td>
                    {[rules.quantity, rules.unit_cost, rules.markup_percent].filter(
                      (rule) => rule.enabled,
                    ).length ? (
                      <td
                        colSpan={
                          [rules.quantity, rules.unit_cost, rules.markup_percent].filter(
                            (rule) => rule.enabled,
                          ).length
                        }
                      />
                    ) : null}
                    {columns.map((column) => (
                      <td key={column.id} className="px-3 py-4 text-right tabular-nums">
                        {column.data_type === "text"
                          ? ""
                          : Number(customTotals[column.column_key] || 0).toLocaleString(undefined, {
                              maximumFractionDigits: 4,
                            })}
                      </td>
                    ))}
                    {rules.line_cost.enabled ? (
                      <td className="px-3 py-4 text-right tabular-nums">
                        {money(totals.cost, currency)}
                      </td>
                    ) : null}
                    {rules.sell_price.enabled ? (
                      <td className="px-3 py-4 text-right tabular-nums text-primary">
                        {money(totals.sell, currency)}
                      </td>
                    ) : null}
                    {rules.gross_profit.enabled ? (
                      <td className="px-3 py-4 text-right tabular-nums">
                        {money(totals.profit, currency)}
                      </td>
                    ) : null}
                    <td colSpan={2} />
                  </tr>
                </tfoot>
              ) : null}
            </table>
          </div>
        </CardContent>
      </Card>

      {sheet.notes ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Notes</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="whitespace-pre-wrap text-sm text-muted-foreground">{sheet.notes}</p>
          </CardContent>
        </Card>
      ) : null}

      <ItemDialog
        open={itemOpen}
        onOpenChange={setItemOpen}
        editing={Boolean(editingItem)}
        form={itemForm}
        setForm={setItemForm}
        columns={columns}
        rules={rules}
        pendingImages={pendingImages}
        setPendingImages={setPendingImages}
        saving={itemMutation.isPending}
        onSave={() => itemMutation.mutate()}
      />
      <ColumnDialog
        open={columnOpen}
        onOpenChange={setColumnOpen}
        editing={Boolean(editingColumn)}
        form={columnForm}
        setForm={setColumnForm}
        columns={columns}
        saving={columnMutation.isPending}
        onSave={() => columnMutation.mutate()}
      />
      <ColumnRulesDialog
        open={rulesOpen}
        onOpenChange={setRulesOpen}
        rules={rulesForm}
        setRules={setRulesForm}
        columns={columns}
        saving={rulesMutation.isPending}
        onSave={() => rulesMutation.mutate()}
      />
      <SheetDialog
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        form={sheetForm}
        setForm={setSheetForm}
        saving={sheetMutation.isPending}
        onSave={() => sheetMutation.mutate()}
      />
      <Dialog open={quoteOpen} onOpenChange={setQuoteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Link a supporting quotation</DialogTitle>
            <DialogDescription>
              Choose a quotation already recorded in the Vendors module.
            </DialogDescription>
          </DialogHeader>
          <Field label="Quotation">
            <Select value={selectedQuoteId} onValueChange={setSelectedQuoteId}>
              <SelectTrigger>
                <SelectValue placeholder="Choose vendor or external quote" />
              </SelectTrigger>
              <SelectContent>
                {sourceQuotes
                  .filter((quote) => !quote.is_linked)
                  .map((quote) => (
                    <SelectItem key={quote.id} value={quote.id}>
                      {quote.source_name} · {quote.currency} {Number(quote.amount).toLocaleString()}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </Field>
          {!sourceQuotes.some((quote) => !quote.is_linked) ? (
            <p className="rounded-lg bg-muted p-3 text-sm text-muted-foreground">
              Every recorded quote is already linked. Add another from the Vendors module first.
            </p>
          ) : null}
          <DialogFooter>
            <Button variant="outline" onClick={() => setQuoteOpen(false)}>
              Cancel
            </Button>
            <Button
              disabled={!selectedQuoteId || quoteMutation.isPending}
              onClick={() => quoteMutation.mutate({ quoteId: selectedQuoteId, linked: true })}
            >
              {quoteMutation.isPending ? "Linking…" : "Link quotation"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <TemplateDialog
        open={templateOpen}
        onOpenChange={setTemplateOpen}
        templates={templates}
        selectedId={selectedTemplateId}
        onSelect={setSelectedTemplateId}
        saving={applyTemplateMutation.isPending}
        onSave={() => applyTemplateMutation.mutate()}
      />
      <Dialog open={saveTemplateOpen} onOpenChange={setSaveTemplateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Save as reusable template</DialogTitle>
            <DialogDescription>
              Saves the current column visibility, formulas, defaults and custom columns. Line items
              are not copied.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <Field label="Template name">
              <Input
                value={templateForm.name}
                onChange={(event) =>
                  setTemplateForm((current) => ({ ...current, name: event.target.value }))
                }
              />
            </Field>
            <Field label="Description">
              <Textarea
                rows={3}
                value={templateForm.description}
                onChange={(event) =>
                  setTemplateForm((current) => ({ ...current, description: event.target.value }))
                }
              />
            </Field>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSaveTemplateOpen(false)}>
              Cancel
            </Button>
            <Button
              disabled={!templateForm.name.trim() || saveTemplateMutation.isPending}
              onClick={() => saveTemplateMutation.mutate()}
            >
              {saveTemplateMutation.isPending ? "Saving…" : "Save template"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog
        open={Boolean(preview)}
        onOpenChange={(open) => {
          if (!open) setPreview(null);
        }}
      >
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>{preview?.name}</DialogTitle>
            <DialogDescription>Attached item image</DialogDescription>
          </DialogHeader>
          {preview ? (
            <img
              src={attachmentUrl(preview.path)}
              alt={preview.name}
              className="max-h-[70vh] w-full rounded-xl bg-muted object-contain"
            />
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function TemplateDialog({
  open,
  onOpenChange,
  templates,
  selectedId,
  onSelect,
  saving,
  onSave,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  templates: CostSheetTemplateRecord[];
  selectedId: string;
  onSelect: (id: string) => void;
  saving: boolean;
  onSave: () => void;
}) {
  const selected = templates.find((template) => template.id === selectedId);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Apply a cost sheet template</DialogTitle>
          <DialogDescription>
            Template formulas and defaults replace the built-in column rules. Matching custom
            columns are updated; unrelated columns and line items remain intact.
          </DialogDescription>
        </DialogHeader>
        <Field label="Template">
          <Select value={selectedId} onValueChange={onSelect}>
            <SelectTrigger>
              <SelectValue placeholder="Choose a template" />
            </SelectTrigger>
            <SelectContent>
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
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button disabled={!selectedId || saving} onClick={onSave}>
            {saving ? "Applying…" : "Apply template"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function SourceQuoteCard({
  quote,
  onUnlink,
}: {
  quote: CostSheetSourceQuote;
  onUnlink: () => void;
}) {
  return (
    <article className="rounded-2xl border bg-background p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-semibold">{quote.source_name}</h3>
            <Badge variant="outline">{quote.supplier_id ? "Vendor" : "External source"}</Badge>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            {quote.quote_reference || "No reference"}
            {quote.quote_date ? ` · ${String(quote.quote_date).slice(0, 10)}` : ""}
          </p>
        </div>
        <p className="shrink-0 font-semibold tabular-nums">
          {money(Number(quote.amount || 0), quote.currency)}
        </p>
      </div>
      {quote.notes ? (
        <p className="mt-3 line-clamp-2 text-sm text-muted-foreground">{quote.notes}</p>
      ) : null}
      <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t pt-3">
        {quote.attachment_path ? (
          <Button variant="ghost" size="sm" asChild>
            <a href={attachmentUrl(quote.attachment_path)} target="_blank" rel="noreferrer">
              <ExternalLink className="mr-2 size-4" />
              {quote.attachment_name || "Open quotation"}
            </a>
          </Button>
        ) : (
          <span className="text-xs text-muted-foreground">No document attached</span>
        )}
        <ConfirmAction
          title="Unlink this quotation?"
          description="The quotation remains available in the Vendors module."
          onConfirm={async () => onUnlink()}
          trigger={
            <Button variant="ghost" size="sm">
              Unlink
            </Button>
          }
        />
      </div>
    </article>
  );
}

function Metric({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string;
  icon: typeof Calculator;
}) {
  return (
    <Card>
      <CardContent className="flex items-center gap-3 p-4">
        <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
          <Icon className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {label}
          </p>
          <MetricValue className="mt-1" value={value} maxSize={1.25} />
        </div>
      </CardContent>
    </Card>
  );
}

function ItemDialog({
  open,
  onOpenChange,
  editing,
  form,
  setForm,
  columns,
  rules,
  pendingImages,
  setPendingImages,
  saving,
  onSave,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editing: boolean;
  form: ItemForm;
  setForm: React.Dispatch<React.SetStateAction<ItemForm>>;
  columns: CostSheetColumn[];
  rules: CostSheetSystemColumnRules;
  pendingImages: File[];
  setPendingImages: React.Dispatch<React.SetStateAction<File[]>>;
  saving: boolean;
  onSave: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editing ? "Edit cost item" : "Add cost item"}</DialogTitle>
          <DialogDescription>
            Capture the cost, pricing inputs, custom values and supporting images.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Description" className="sm:col-span-2">
            <Input
              value={form.description}
              onChange={(event) =>
                setForm((current) => ({ ...current, description: event.target.value }))
              }
            />
          </Field>
          <Field label="Category">
            <Select
              value={form.category}
              onValueChange={(category) => setForm((current) => ({ ...current, category }))}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {categories.map((category) => (
                  <SelectItem key={category} value={category} className="capitalize">
                    {category}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          {rules.quantity.enabled ? (
            <Field label={rules.quantity.label}>
              <Input
                type="number"
                min="0"
                step="any"
                value={form.quantity}
                onChange={(event) =>
                  setForm((current) => ({ ...current, quantity: event.target.value }))
                }
              />
            </Field>
          ) : null}
          {rules.unit_cost.enabled ? (
            <Field label={rules.unit_cost.label}>
              <Input
                type="number"
                min="0"
                step="any"
                value={form.unitCost}
                onChange={(event) =>
                  setForm((current) => ({ ...current, unitCost: event.target.value }))
                }
              />
            </Field>
          ) : null}
          {rules.markup_percent.enabled ? (
            <Field label={rules.markup_percent.label}>
              <Input
                type="number"
                step="any"
                value={form.markupPercent}
                onChange={(event) =>
                  setForm((current) => ({ ...current, markupPercent: event.target.value }))
                }
              />
            </Field>
          ) : null}
          {columns
            .filter((column) => column.data_type !== "formula")
            .map((column) => (
              <Field key={column.id} label={column.name}>
                <Input
                  type={column.data_type === "number" ? "number" : "text"}
                  step={column.data_type === "number" ? "any" : undefined}
                  value={form.customValues[column.column_key] || ""}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      customValues: {
                        ...current.customValues,
                        [column.column_key]: event.target.value,
                      },
                    }))
                  }
                />
                <p className="mt-1 font-mono text-[10px] text-muted-foreground">
                  {column.column_key}
                </p>
              </Field>
            ))}
        </div>
        <div className="space-y-3 rounded-xl border border-dashed p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-sm font-medium">Item images</p>
              <p className="text-xs text-muted-foreground">
                Product photos, screenshots, specifications or visual references.
              </p>
            </div>
            <Button type="button" variant="outline" size="sm" asChild>
              <label className="cursor-pointer">
                <ImagePlus className="mr-2 size-4" /> Choose images
                <input
                  className="sr-only"
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={(event) => {
                    setPendingImages((current) => [
                      ...current,
                      ...Array.from(event.target.files || []),
                    ]);
                    event.target.value = "";
                  }}
                />
              </label>
            </Button>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {form.attachments.map((attachment) => (
              <div
                key={attachment.path}
                className="group relative overflow-hidden rounded-lg border"
              >
                <img
                  src={attachmentUrl(attachment.path)}
                  alt={attachment.name}
                  className="aspect-square w-full object-cover"
                />
                <button
                  type="button"
                  className="absolute right-1 top-1 grid size-7 place-items-center rounded-full bg-background/90 opacity-0 shadow group-hover:opacity-100"
                  onClick={() =>
                    setForm((current) => ({
                      ...current,
                      attachments: current.attachments.filter(
                        (image) => image.path !== attachment.path,
                      ),
                    }))
                  }
                  aria-label={`Remove ${attachment.name}`}
                >
                  <Trash2 className="size-3.5" />
                </button>
              </div>
            ))}
            {pendingImages.map((file, index) => (
              <div
                key={`${file.name}-${file.size}-${index}`}
                className="group relative grid aspect-square place-items-center rounded-lg border bg-muted p-2 text-center"
              >
                <FileImage className="mb-1 size-6 text-muted-foreground" />
                <span className="line-clamp-2 text-xs">{file.name}</span>
                <button
                  type="button"
                  className="absolute right-1 top-1 grid size-7 place-items-center rounded-full bg-background shadow"
                  onClick={() =>
                    setPendingImages((current) =>
                      current.filter((_, itemIndex) => itemIndex !== index),
                    )
                  }
                  aria-label={`Remove ${file.name}`}
                >
                  <Trash2 className="size-3.5" />
                </button>
              </div>
            ))}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button disabled={saving} onClick={onSave}>
            {saving ? "Saving…" : editing ? "Save changes" : "Add item"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ColumnDialog({
  open,
  onOpenChange,
  editing,
  form,
  setForm,
  columns,
  saving,
  onSave,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editing: boolean;
  form: ColumnForm;
  setForm: React.Dispatch<React.SetStateAction<ColumnForm>>;
  columns: CostSheetColumn[];
  saving: boolean;
  onSave: () => void;
}) {
  const suggestedKey = columnKey(form.name);
  const references = [
    "quantity",
    "unit_cost",
    "markup_percent",
    "line_cost",
    "sell_price",
    "gross_profit",
    ...columns
      .filter(
        (column) => column.data_type !== "text" && (!editing || column.column_key !== form.key),
      )
      .map((column) => column.column_key),
  ];
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{editing ? "Edit custom column" : "Add custom column"}</DialogTitle>
          <DialogDescription>
            Add text, numeric input, or a calculated formula column.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Column name">
            <Input
              value={form.name}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  name: event.target.value,
                  ...(!editing && !current.key ? { key: columnKey(event.target.value) } : {}),
                }))
              }
            />
          </Field>
          <Field label="Column type">
            <Select
              value={form.dataType}
              onValueChange={(dataType: ColumnForm["dataType"]) =>
                setForm((current) => ({ ...current, dataType }))
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="text">Words / text</SelectItem>
                <SelectItem value="number">Number</SelectItem>
                <SelectItem value="formula">Formula</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label="Reference key" className="sm:col-span-2">
            <Input
              value={form.key || suggestedKey}
              disabled={editing}
              onChange={(event) =>
                setForm((current) => ({ ...current, key: columnKey(event.target.value) }))
              }
            />
            <p className="mt-1 text-xs text-muted-foreground">
              Use this key when referring to the column in formulas. It cannot change after
              creation.
            </p>
          </Field>
          {form.dataType !== "formula" ? (
            <Field label="Default value" className="sm:col-span-2">
              <Input
                type={form.dataType === "number" ? "number" : "text"}
                step={form.dataType === "number" ? "any" : undefined}
                value={form.defaultValue}
                onChange={(event) =>
                  setForm((current) => ({ ...current, defaultValue: event.target.value }))
                }
              />
              <p className="mt-1 text-xs text-muted-foreground">
                Applied when a row does not contain its own value. Useful for tax or conversion
                rates.
              </p>
            </Field>
          ) : (
            <Field label="Formula" className="sm:col-span-2">
              <Input
                className="font-mono"
                placeholder="sell_price * tax_rate / 100"
                value={form.formulaExpression}
                onChange={(event) =>
                  setForm((current) => ({ ...current, formulaExpression: event.target.value }))
                }
              />
              <p className="mt-2 text-xs text-muted-foreground">
                BODMAS supported: brackets, powers (^), multiplication, division, addition and
                subtraction.
              </p>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {references.map((reference) => (
                  <button
                    key={reference}
                    type="button"
                    className="rounded-md bg-muted px-2 py-1 font-mono text-[11px] hover:bg-accent"
                    onClick={() =>
                      setForm((current) => ({
                        ...current,
                        formulaExpression: `${current.formulaExpression}${current.formulaExpression && !current.formulaExpression.endsWith(" ") ? " " : ""}${reference}`,
                      }))
                    }
                  >
                    {reference}
                  </button>
                ))}
              </div>
            </Field>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button disabled={saving} onClick={onSave}>
            {saving ? "Saving…" : editing ? "Save column" : "Add column"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ColumnRulesDialog({
  open,
  onOpenChange,
  rules,
  setRules,
  columns,
  saving,
  onSave,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  rules: CostSheetSystemColumnRules;
  setRules: React.Dispatch<React.SetStateAction<CostSheetSystemColumnRules>>;
  columns: CostSheetColumn[];
  saving: boolean;
  onSave: () => void;
}) {
  const inputKeys = ["quantity", "unit_cost", "markup_percent"] as const;
  const formulaKeys = ["line_cost", "sell_price", "gross_profit"] as const;
  const references = [
    ...costSheetSystemColumnKeys,
    ...columns.filter((column) => column.data_type !== "text").map((column) => column.column_key),
  ];
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Configure default columns</DialogTitle>
          <DialogDescription>
            Rename built-in columns, set new-row defaults, remove columns from this sheet, and
            control how calculated values are produced. Removed columns keep their underlying values
            so dependent formulas remain safe.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-6">
          <div>
            <h3 className="text-sm font-semibold">Input columns</h3>
            <div className="mt-3 grid gap-4 sm:grid-cols-2">
              {inputKeys.map((key) => (
                <div key={key} className="rounded-xl border p-4">
                  <div className="mb-3 flex items-center justify-between gap-2">
                    <p className="font-mono text-xs text-muted-foreground">{key}</p>
                    <Button
                      type="button"
                      size="sm"
                      variant={rules[key].enabled ? "secondary" : "outline"}
                      onClick={() =>
                        setRules((current) => ({
                          ...current,
                          [key]: { ...current[key], enabled: !current[key].enabled },
                        }))
                      }
                    >
                      {rules[key].enabled ? "Remove from sheet" : "Add to sheet"}
                    </Button>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Field label="Label">
                      <Input
                        value={rules[key].label}
                        onChange={(event) =>
                          setRules((current) => ({
                            ...current,
                            [key]: { ...current[key], label: event.target.value },
                          }))
                        }
                      />
                    </Field>
                    <Field label="New-row default">
                      <Input
                        type="number"
                        min="0"
                        step="any"
                        value={rules[key].defaultValue ?? 0}
                        onChange={(event) =>
                          setRules((current) => ({
                            ...current,
                            [key]: { ...current[key], defaultValue: Number(event.target.value) },
                          }))
                        }
                      />
                    </Field>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div>
            <h3 className="text-sm font-semibold">Calculated columns</h3>
            <p className="mt-1 text-xs text-muted-foreground">
              Example: add a numeric custom column named Delivery Fee, then use
              <code className="mx-1 rounded bg-muted px-1 py-0.5">line_cost + delivery_fee</code>
              for Sell Price.
            </p>
            <div className="mt-3 space-y-4">
              {formulaKeys.map((key) => (
                <div key={key} className="rounded-xl border p-4">
                  <div className="mb-3 flex justify-end">
                    <Button
                      type="button"
                      size="sm"
                      variant={rules[key].enabled ? "secondary" : "outline"}
                      onClick={() =>
                        setRules((current) => ({
                          ...current,
                          [key]: { ...current[key], enabled: !current[key].enabled },
                        }))
                      }
                    >
                      {rules[key].enabled ? "Remove from sheet" : "Add to sheet"}
                    </Button>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-[14rem_1fr]">
                    <Field label={`Label · ${key}`}>
                      <Input
                        value={rules[key].label}
                        onChange={(event) =>
                          setRules((current) => ({
                            ...current,
                            [key]: { ...current[key], label: event.target.value },
                          }))
                        }
                      />
                    </Field>
                    <Field label="Formula">
                      <Input
                        className="font-mono"
                        value={rules[key].formulaExpression || ""}
                        onChange={(event) =>
                          setRules((current) => ({
                            ...current,
                            [key]: {
                              ...current[key],
                              formulaExpression: event.target.value,
                            },
                          }))
                        }
                      />
                    </Field>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {references.map((reference) => (
                <span
                  key={reference}
                  className="rounded-md bg-muted px-2 py-1 font-mono text-[11px]"
                >
                  {reference}
                </span>
              ))}
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button disabled={saving} onClick={onSave}>
            {saving ? "Saving…" : "Save column rules"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function SheetDialog({
  open,
  onOpenChange,
  form,
  setForm,
  saving,
  onSave,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  form: { name: string; status: string; notes: string };
  setForm: React.Dispatch<React.SetStateAction<{ name: string; status: string; notes: string }>>;
  saving: boolean;
  onSave: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Cost sheet details</DialogTitle>
          <DialogDescription>
            Update the workspace name, workflow status and notes.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <Field label="Name">
            <Input
              value={form.name}
              onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
            />
          </Field>
          <Field label="Status">
            <Select
              value={form.status}
              onValueChange={(status) => setForm((current) => ({ ...current, status }))}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="draft">Draft</SelectItem>
                <SelectItem value="approved">Approved</SelectItem>
                <SelectItem value="archived">Archived</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label="Notes">
            <Textarea
              rows={5}
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
          <Button disabled={saving} onClick={onSave}>
            {saving ? "Saving…" : "Save details"}
          </Button>
        </DialogFooter>
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
  children: React.ReactNode;
}) {
  return (
    <div className={className}>
      <Label>{label}</Label>
      <div className="mt-1.5">{children}</div>
    </div>
  );
}
