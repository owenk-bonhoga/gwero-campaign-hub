import { useRouter } from "@tanstack/react-router";
import { createFileRoute, Link, Outlet, useLocation } from "@tanstack/react-router";
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState, type ReactNode } from "react";
import type * as XLSX from "xlsx";
import { prospectDirectory } from "@/lib/directory.functions";
import { QueryState } from "@/components/QueryState";
import { useDebounced } from "@/lib/use-debounced";
import { toast } from "sonner";
import { db } from "@/lib/db";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { discoverProspects, type AiProspect } from "@/lib/settings.functions";
import {
  createProspectCompany,
  importProspectContacts,
  type ContactImportRow,
} from "@/lib/prospects.functions";
import { ConfirmAction } from "@/components/ConfirmAction";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export const Route = createFileRoute("/prospects")({
  head: () => ({
    meta: [
      { title: "Prospects | Gwero CRM" },
      { name: "description", content: "Import prospect lists from Excel and track their status." },
      { property: "og:title", content: "Prospects | Gwero CRM" },
      {
        property: "og:description",
        content: "Import prospect lists from Excel and track their status.",
      },
    ],
  }),
  component: ProspectsRoute,
});

function ProspectsRoute() {
  const location = useLocation();
  return location.pathname !== "/prospects" && location.pathname !== "/prospects/" ? (
    <Outlet />
  ) : (
    <ProspectsPage />
  );
}

const FIELDS = [
  { key: "company", label: "Company / organisation (required)" },
  { key: "first_name", label: "First name" },
  { key: "last_name", label: "Last name" },
  { key: "email", label: "Email" },
  { key: "gender", label: "Gender" },
  { key: "job_title", label: "Job title" },
  { key: "phone", label: "Phone" },
] as const;

type Row = Record<string, unknown>;

type CompanyDraft = {
  company: string;
  email: string;
  phone: string;
  website: string;
  linkedin_url: string;
  category_id: string;
  industry: string;
  address: string;
  city: string;
  country: string;
  registration_number: string;
  employee_count: string;
  notes: string;
  logo_path: string;
};
const emptyCompany = (): CompanyDraft => ({
  company: "",
  email: "",
  phone: "",
  website: "",
  linkedin_url: "",
  category_id: "",
  industry: "",
  address: "",
  city: "",
  country: "Malawi",
  registration_number: "",
  employee_count: "",
  notes: "",
  logo_path: "",
});

function AddProspectsDialog({
  categories,
  onDone,
}: {
  categories: Array<{ id: string; name: string }>;
  onDone: () => void;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<CompanyDraft>(emptyCompany());
  const [busy, setBusy] = useState(false);
  const update = (key: keyof CompanyDraft, value: string) =>
    setDraft((current) => ({ ...current, [key]: value }));
  const loadLogo = (file?: File) => {
    if (!file) return;
    if (!file.type.startsWith("image/") || file.size > 2_000_000) {
      toast.error("Choose an image smaller than 2 MB.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => update("logo_path", String(reader.result || ""));
    reader.readAsDataURL(file);
  };
  const save = async () => {
    if (!draft.company.trim()) {
      toast.error("Company or organisation name is required.");
      return;
    }
    setBusy(true);
    try {
      const result = await createProspectCompany({
        data: {
          company: draft.company,
          email: draft.email,
          phone: draft.phone,
          website: draft.website,
          linkedinUrl: draft.linkedin_url,
          categoryId: draft.category_id || null,
          industry: draft.industry,
          address: draft.address,
          city: draft.city,
          country: draft.country,
          registrationNumber: draft.registration_number,
          employeeCount: draft.employee_count ? Number(draft.employee_count) : null,
          notes: draft.notes,
          logoPath: draft.logo_path,
        },
      });
      toast.success("Prospect created. Add contact people from its profile.");
      setDraft(emptyCompany());
      setOpen(false);
      onDone();
      void router.navigate({ href: `/prospects/${result.id}` });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not create prospect.");
    } finally {
      setBusy(false);
    }
  };
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>Add prospects</Button>
      </DialogTrigger>
      <DialogContent className="max-h-[88vh] overflow-y-auto sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle>Add prospect company</DialogTitle>
          <DialogDescription>
            Create the organisation first. Contact people are added from the prospect profile. Only
            the company name is required.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-5 md:grid-cols-[180px_1fr]">
          <div className="space-y-3">
            <div className="grid h-36 place-items-center rounded-xl border border-dashed bg-muted/20 p-3">
              {draft.logo_path ? (
                <img
                  src={draft.logo_path}
                  alt="Prospect logo preview"
                  className="max-h-28 object-contain"
                />
              ) : (
                <span className="text-center text-sm text-muted-foreground">
                  Company logo
                  <br />
                  (optional)
                </span>
              )}
            </div>
            <Input
              type="file"
              accept="image/*"
              onChange={(event) => loadLogo(event.target.files?.[0])}
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <CompanyField label="Company / organisation name *" className="sm:col-span-2">
              <Input value={draft.company} onChange={(e) => update("company", e.target.value)} />
            </CompanyField>
            <CompanyField label="Company email">
              <Input
                type="email"
                value={draft.email}
                onChange={(e) => update("email", e.target.value)}
              />
            </CompanyField>
            <CompanyField label="Company phone">
              <Input value={draft.phone} onChange={(e) => update("phone", e.target.value)} />
            </CompanyField>
            <CompanyField label="Website">
              <Input value={draft.website} onChange={(e) => update("website", e.target.value)} />
            </CompanyField>
            <CompanyField label="LinkedIn page">
              <Input
                value={draft.linkedin_url}
                onChange={(e) => update("linkedin_url", e.target.value)}
              />
            </CompanyField>
            <CompanyField label="Category">
              <Select
                value={draft.category_id || "none"}
                onValueChange={(value) => update("category_id", value === "none" ? "" : value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No category yet</SelectItem>
                  {categories.map((category) => (
                    <SelectItem key={category.id} value={category.id}>
                      {category.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </CompanyField>
            <CompanyField label="Industry">
              <Input value={draft.industry} onChange={(e) => update("industry", e.target.value)} />
            </CompanyField>
            <CompanyField label="Registration number">
              <Input
                value={draft.registration_number}
                onChange={(e) => update("registration_number", e.target.value)}
              />
            </CompanyField>
            <CompanyField label="Number of employees">
              <Input
                type="number"
                min="1"
                value={draft.employee_count}
                onChange={(e) => update("employee_count", e.target.value)}
              />
            </CompanyField>
            <CompanyField label="City">
              <Input value={draft.city} onChange={(e) => update("city", e.target.value)} />
            </CompanyField>
            <CompanyField label="Country">
              <Input value={draft.country} onChange={(e) => update("country", e.target.value)} />
            </CompanyField>
            <CompanyField label="Physical / postal address" className="sm:col-span-2">
              <Textarea
                rows={3}
                value={draft.address}
                onChange={(e) => update("address", e.target.value)}
              />
            </CompanyField>
            <CompanyField label="Notes" className="sm:col-span-2">
              <Textarea
                rows={4}
                value={draft.notes}
                onChange={(e) => update("notes", e.target.value)}
              />
            </CompanyField>
            <div className="flex justify-end sm:col-span-2">
              <Button disabled={busy || !draft.company.trim()} onClick={() => void save()}>
                {busy ? "Creating…" : "Create prospect"}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function CompanyField({
  label,
  className = "",
  children,
}: {
  label: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={`space-y-1.5 ${className}`}>
      <Label>{label}</Label>
      {children}
    </div>
  );
}

function CategoryDialog({
  categories,
  onDone,
}: {
  categories: Array<{
    id: string;
    name: string;
    description: string | null;
    offerings: string | null;
  }>;
  onDone: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ id: "", name: "", description: "", offerings: "" });
  const save = async () => {
    const values = { name: form.name, description: form.description, offerings: form.offerings };
    const { error } = form.id
      ? await db.from("prospect_categories").update(values).eq("id", form.id)
      : await db.from("prospect_categories").insert(values);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(form.id ? "Category updated." : "Category added.");
    setForm({ id: "", name: "", description: "", offerings: "" });
    onDone();
  };
  const remove = async (id: string) => {
    const { error } = await db.from("prospect_categories").delete().eq("id", id);
    if (error) {
      toast.error(error.message);
      throw error;
    }
    toast.success("Category deleted.");
    if (form.id === id) setForm({ id: "", name: "", description: "", offerings: "" });
    onDone();
  };
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">Categories</Button>
      </DialogTrigger>
      <DialogContent className="flex h-[88vh] max-h-[88vh] flex-col overflow-hidden sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle>Prospect categories</DialogTitle>
          <DialogDescription>
            Describe the segment and what your team can offer it. AI research uses this context.
          </DialogDescription>
        </DialogHeader>
        <div className="grid min-h-0 flex-1 gap-5 md:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
          <div className="space-y-4 overflow-y-auto pr-1 md:overflow-y-visible md:pr-0">
            <FieldInput
              label="Category name"
              value={form.name}
              onChange={(v) => setForm((o) => ({ ...o, name: v }))}
            />
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea
                value={form.description}
                onChange={(e) => setForm((o) => ({ ...o, description: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Offerings for this category</Label>
              <Textarea
                value={form.offerings}
                onChange={(e) => setForm((o) => ({ ...o, offerings: e.target.value }))}
              />
            </div>
            <Button onClick={() => void save()} disabled={!form.name}>
              {form.id ? "Save changes" : "Add category"}
            </Button>
            {form.id ? (
              <Button
                variant="ghost"
                onClick={() => setForm({ id: "", name: "", description: "", offerings: "" })}
              >
                Cancel editing
              </Button>
            ) : null}
          </div>
          <div className="gwero-scrollbar min-h-0 space-y-2 overflow-y-auto pr-2">
            <p className="sticky top-0 z-10 bg-background pb-2 text-sm font-semibold">
              Existing categories
            </p>
            {categories.map((category) => (
              <div key={category.id} className="rounded-xl border p-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-medium">{category.name}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {category.description || "No description"}
                    </p>
                    <p className="mt-1 text-xs">{category.offerings || "No offerings listed"}</p>
                  </div>
                  <div className="flex gap-1">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        setForm({
                          id: category.id,
                          name: category.name,
                          description: category.description || "",
                          offerings: category.offerings || "",
                        })
                      }
                    >
                      Edit
                    </Button>
                    <ConfirmAction
                      title="Delete category?"
                      description="Prospects will remain but become uncategorised."
                      onConfirm={() => remove(category.id)}
                      trigger={
                        <Button size="sm" variant="destructive">
                          Delete
                        </Button>
                      }
                    />
                  </div>
                </div>
              </div>
            ))}
            {!categories.length ? (
              <p className="text-sm text-muted-foreground">No categories yet.</p>
            ) : null}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
function FieldInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <Input value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

function AiSearchDialog({
  categories,
  onDone,
}: {
  categories: Array<{ id: string; name: string }>;
  onDone: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [prompt, setPrompt] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [results, setResults] = useState<AiProspect[]>([]);
  const [selected, setSelected] = useState<number[]>([]);
  const search = useMutation({
    mutationFn: () =>
      discoverProspects({ data: { prompt, categoryId: categoryId || null, limit: 12 } }),
    onSuccess: (items) => {
      setResults(items);
      setSelected(items.map((_, i) => i));
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const add = async () => {
    const items = results.filter((_, i) => selected.includes(i));
    try {
      await importProspectContacts({
        data: {
          rows: items.map((p) => ({
            company: p.company,
            firstName: p.first_name || "",
            lastName: p.last_name || "",
            email: p.email || "",
            phone: p.phone || "",
            jobTitle: p.job_title || "",
            website: p.website || "",
            linkedinUrl: p.linkedin_url || "",
            categoryId: categoryId || null,
          })),
          sourceFile: "OpenAI web research",
        },
      });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save researched prospects.");
      return;
    }
    toast.success(`${items.length} researched prospects added.`);
    setOpen(false);
    onDone();
  };
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">Find with AI</Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle>AI prospect research</DialogTitle>
          <DialogDescription>
            OpenAI searches the web using your saved guide and selected category. Review every
            sourced match before importing it.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 md:grid-cols-[1fr_220px]">
          <Textarea
            rows={3}
            placeholder="e.g. Find growing logistics companies in Malawi that need workflow automation…"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
          />
          <Select
            value={categoryId || "none"}
            onValueChange={(v) => setCategoryId(v === "none" ? "" : v)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Optional category" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Any category</SelectItem>
              {categories.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button
          className="w-fit"
          disabled={!prompt || search.isPending}
          onClick={() => search.mutate()}
        >
          {search.isPending ? "Searching the web…" : "Search for prospects"}
        </Button>
        <div className="space-y-3">
          {results.map((item, index) => (
            <Card key={`${item.company}-${index}`}>
              <CardContent className="flex gap-3 pt-5">
                <Checkbox
                  checked={selected.includes(index)}
                  onCheckedChange={(checked) =>
                    setSelected((old) =>
                      checked ? [...old, index] : old.filter((i) => i !== index),
                    )
                  }
                />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-semibold">{item.company}</p>
                    <Badge>{item.fit_score}% fit</Badge>
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">{item.fit_reason}</p>
                  <p className="mt-2 text-xs">
                    {[item.first_name, item.last_name, item.job_title, item.email]
                      .filter(Boolean)
                      .join(" · ") || "No verified contact person found"}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {item.source_urls.map((url) => (
                      <a
                        key={url}
                        href={url}
                        target="_blank"
                        rel="noreferrer"
                        className="max-w-xs truncate text-xs text-violet-700 underline"
                      >
                        Source
                      </a>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
        {results.length ? (
          <Button onClick={() => void add()} disabled={!selected.length}>
            Add {selected.length} selected prospect{selected.length === 1 ? "" : "s"}
          </Button>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function ImportDialog({ onDone }: { onDone: () => void }) {
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<Row[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [fileName, setFileName] = useState("");
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  async function handleFile(file: File) {
    if (!/\.(xlsx|xls|csv)$/i.test(file.name) || file.size > 5 * 1024 * 1024) {
      toast.error("Choose an XLSX, XLS or CSV file smaller than 5 MB.");
      return;
    }
    const buffer = await file.arrayBuffer();
    let book: XLSX.WorkBook;
    try {
      const XLSX = await import("xlsx");
      book = XLSX.read(buffer, { sheetRows: 10002 });
    } catch {
      toast.error("That spreadsheet could not be read. Check the file and try again.");
      return;
    }
    const sheetName = book.SheetNames[0];
    if (!sheetName) return;
    const sheet = book.Sheets[sheetName];
    if (!sheet) return;
    const XLSX = await import("xlsx");
    const data = XLSX.utils.sheet_to_json<Row>(sheet, { defval: "" });
    if (data.length > 10000) {
      toast.error("Import up to 10,000 rows at a time.");
      return;
    }
    if (!data.length) {
      toast.error("That file has no rows.");
      return;
    }
    const cols = Object.keys(data[0] as Row);
    setRows(data);
    setHeaders(cols);
    setFileName(file.name);
    const guess: Record<string, string> = {};
    for (const field of FIELDS) {
      const hit = cols.find(
        (c) => c.toLowerCase().replace(/[^a-z]/g, "") === field.key.replace(/_/g, ""),
      );
      if (hit) guess[field.key] = hit;
    }
    const aliases: Record<string, string[]> = {
      company: ["organisation", "organization", "company", "client"],
      first_name: ["name of participant first", "first name", "firstname"],
      last_name: ["name of participant last", "last name", "lastname", "surname"],
      phone: ["contact phone", "phone", "mobile", "number"],
      gender: ["gender", "sex"],
      email: ["email address", "email", "mail"],
    };
    for (const [field, choices] of Object.entries(aliases)) {
      const hit = cols.find((column) =>
        choices.includes(
          column
            .toLowerCase()
            .replace(/[^a-z]+/g, " ")
            .trim(),
        ),
      );
      if (hit) guess[field] = hit;
    }
    if (!guess["email"]) {
      const hit = cols.find((c) => c.toLowerCase().includes("mail"));
      if (hit) guess["email"] = hit;
    }
    if (!guess["first_name"]) {
      const hit = cols.find((c) => c.toLowerCase().includes("name"));
      if (hit) guess["first_name"] = hit;
    }
    setMapping(guess);
  }

  async function importRows() {
    const companyCol = mapping["company"];
    if (!companyCol) {
      toast.error("Choose which column holds the company or organisation.");
      return;
    }
    setBusy(true);
    const mapped = rows
      .map((row) => {
        const pick = (field: string) => {
          const col = mapping[field];
          const value = col ? row[col] : null;
          return value == null || value === "" ? null : String(value).trim();
        };
        const company = pick("company");
        if (!company) return null;
        return {
          company,
          email: pick("email") || "",
          firstName: pick("first_name") || "",
          lastName: pick("last_name") || "",
          gender: pick("gender") || "",
          jobTitle: pick("job_title") || "",
          phone: pick("phone") || "",
        };
      })
      .filter(Boolean) as ContactImportRow[];

    if (!mapped.length) {
      setBusy(false);
      toast.error("No company names were found in that column.");
      return;
    }

    try {
      const result = await importProspectContacts({ data: { rows: mapped, sourceFile: fileName } });
      toast.success(
        `${result.contactsCreated + result.contactsUpdated} contacts imported into ${result.companies} canonical companies.`,
      );
    } catch (error) {
      setBusy(false);
      toast.error(error instanceof Error ? error.message : "Import failed.");
      return;
    }
    setBusy(false);
    setOpen(false);
    setRows([]);
    setHeaders([]);
    onDone();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>Upload spreadsheet</Button>
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Import prospects</DialogTitle>
          <DialogDescription>
            Upload an Excel or CSV file, then tell us which column holds what.
          </DialogDescription>
        </DialogHeader>

        <div className="rounded-xl border bg-muted/40 p-4">
          <p className="font-medium">1. Download and complete the template</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Keep the column headings unchanged, add one prospect per row, then upload the completed
            file below.
          </p>
          <Button className="mt-3" variant="outline" asChild>
            <a href="/templates/gwero-prospect-import-template.csv" download>
              Download sample CSV template
            </a>
          </Button>
        </div>
        <p className="text-sm font-medium">2. Upload your completed file</p>

        <Input
          type="file"
          accept=".xlsx,.xls,.csv"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void handleFile(file);
          }}
        />

        {headers.length > 0 ? (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              {rows.length} rows found in {fileName}. Anything you don't map is kept as extra
              details you can still use as placeholders.
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              {FIELDS.map((field) => (
                <div key={field.key} className="space-y-1">
                  <Label>{field.label}</Label>
                  <Select
                    value={mapping[field.key] ?? "__none"}
                    onValueChange={(v) =>
                      setMapping((m) => {
                        const next = { ...m };
                        if (v === "__none") delete next[field.key];
                        else next[field.key] = v;
                        return next;
                      })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Not used" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none">Not used</SelectItem>
                      {headers.map((h) => (
                        <SelectItem key={h} value={h}>
                          {h}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ))}
            </div>
            <Button onClick={() => void importRows()} disabled={busy}>
              {busy ? "Importing…" : `Import ${rows.length} rows`}
            </Button>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function ProspectsPage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [sortBy, setSortBy] = useState("name_asc");
  const term = useDebounced(search);
  const loadMoreRef = useRef<HTMLDivElement>(null);

  const listing = useInfiniteQuery({
    queryKey: ["prospects", "directory", term, categoryFilter, sortBy],
    initialPageParam: 0,
    queryFn: ({ pageParam }) =>
      prospectDirectory({
        data: { search: term, category: categoryFilter, sort: sortBy, offset: pageParam },
      }),
    getNextPageParam: (last) => last.nextOffset ?? undefined,
  });
  const visible = listing.data?.pages.flatMap((page) => page.rows) || [];
  const contacts = listing.data?.pages.flatMap((page) => page.contacts) || [];
  const total = listing.data?.pages[0]?.total || 0;
  const contactMap = new Map<string, typeof contacts>();
  for (const contact of contacts) {
    const group = contactMap.get(contact.prospect_id) || [];
    group.push(contact);
    contactMap.set(contact.prospect_id, group);
  }
  const { data: categories = [] } = useQuery({
    queryKey: ["prospect-categories"],
    queryFn: async () => {
      const { data, error } = await db.from("prospect_categories").select("*").order("name");
      if (error) throw error;
      return data;
    },
  });
  const { hasNextPage, isFetching, fetchNextPage } = listing;
  useEffect(() => {
    const target = loadMoreRef.current;
    if (!target) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting && hasNextPage && !isFetching) void fetchNextPage();
      },
      { rootMargin: "300px" },
    );
    observer.observe(target);
    return () => observer.disconnect();
  }, [hasNextPage, isFetching, fetchNextPage]);

  return (
    <AppShell
      title="Prospects"
      description="Build, research and progress qualified opportunities from first contact to client."
      actions={
        <>
          <CategoryDialog
            categories={categories}
            onDone={() => qc.invalidateQueries({ queryKey: ["prospect-categories"] })}
          />
          <AiSearchDialog
            categories={categories}
            onDone={() => qc.invalidateQueries({ queryKey: ["prospects"] })}
          />
          <ImportDialog onDone={() => qc.invalidateQueries({ queryKey: ["prospects"] })} />
          <AddProspectsDialog
            categories={categories}
            onDone={() => qc.invalidateQueries({ queryKey: ["prospects"] })}
          />
        </>
      }
    >
      <QueryState
        loading={listing.isPending}
        error={listing.error}
        retry={() => void listing.refetch()}
      />
      <Card>
        <CardContent className="pt-4">
          <div className="mb-4 grid min-w-0 gap-3 md:grid-cols-[minmax(220px,1fr)_minmax(190px,280px)_minmax(180px,230px)]">
            <Input
              aria-label="Search prospects"
              placeholder="Search by name, email or company"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="min-w-0"
            />
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="w-full min-w-0" aria-label="Filter by category">
                <SelectValue placeholder="All categories" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All categories</SelectItem>
                {categories.map((category) => (
                  <SelectItem key={category.id} value={category.id}>
                    {category.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={sortBy} onValueChange={setSortBy}>
              <SelectTrigger className="w-full min-w-0" aria-label="Sort prospects">
                <SelectValue placeholder="Sort prospects" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="name_asc">Company A–Z</SelectItem>
                <SelectItem value="name_desc">Company Z–A</SelectItem>
                <SelectItem value="newest">Newest added</SelectItem>
                <SelectItem value="oldest">Oldest added</SelectItem>
                <SelectItem value="contacts_desc">Most contacts</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="relative">
            <Table className="table-fixed min-w-[560px]" containerClassName="overflow-x-auto">
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="sticky top-20 z-20 w-[36%] bg-background/95 shadow-sm backdrop-blur supports-[backdrop-filter]:bg-background/85">
                    Company
                  </TableHead>
                  <TableHead className="sticky top-20 z-20 w-[38%] bg-background/95 shadow-sm backdrop-blur supports-[backdrop-filter]:bg-background/85">
                    Company email
                  </TableHead>
                  <TableHead className="sticky top-20 z-20 w-[26%] bg-background/95 shadow-sm backdrop-blur supports-[backdrop-filter]:bg-background/85">
                    Contact people
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visible.map((p) => {
                  const people = contactMap.get(p.id) || [];
                  return (
                    <TableRow key={p.id}>
                      <TableCell className="min-w-0 font-medium">
                        <div className="flex items-center gap-3">
                          {p.logo_path ? (
                            <img
                              src={p.logo_path}
                              alt=""
                              className="size-9 rounded-lg border bg-white object-contain p-1"
                            />
                          ) : (
                            <span className="grid size-9 place-items-center rounded-lg bg-violet-50 text-xs font-bold text-violet-700">
                              {(p.company || "P").charAt(0)}
                            </span>
                          )}
                          <Link
                            to="/prospects/$id"
                            params={{ id: p.id }}
                            className="min-w-0 break-words text-violet-800 hover:underline"
                          >
                            {p.company || "Open prospect"}
                          </Link>
                        </div>
                      </TableCell>
                      <TableCell className="min-w-0 overflow-hidden">
                        {p.email.includes("@prospect.local") ? (
                          <span className="text-muted-foreground">No verified company email</span>
                        ) : (
                          <a
                            href={`mailto:${p.email}`}
                            className="block truncate hover:text-primary hover:underline"
                          >
                            {p.email}
                          </a>
                        )}
                      </TableCell>
                      <TableCell>
                        <TooltipProvider delayDuration={150}>
                          <div className="flex min-w-0 -space-x-2 overflow-hidden py-1">
                            {people.slice(0, 8).map((person) => {
                              const name =
                                [person.first_name, person.last_name].filter(Boolean).join(" ") ||
                                person.email ||
                                "Contact";
                              const initials =
                                [person.first_name, person.last_name]
                                  .filter(Boolean)
                                  .map((part) => part!.charAt(0))
                                  .join("")
                                  .slice(0, 2)
                                  .toUpperCase() || "?";
                              return (
                                <Tooltip key={person.id}>
                                  <TooltipTrigger asChild>
                                    <Link
                                      to="/prospects/$id/contacts/$contactId"
                                      params={{ id: p.id, contactId: person.id }}
                                      aria-label={`Open ${name}`}
                                    >
                                      <Avatar className="size-9 border-2 border-background transition-transform hover:z-10 hover:scale-110">
                                        <AvatarImage src={person.avatar_url || undefined} alt="" />
                                        <AvatarFallback className="bg-primary/10 text-xs font-semibold text-primary">
                                          {initials}
                                        </AvatarFallback>
                                      </Avatar>
                                    </Link>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <p>{name}</p>
                                    {person.job_title ? (
                                      <p className="text-xs opacity-75">{person.job_title}</p>
                                    ) : null}
                                  </TooltipContent>
                                </Tooltip>
                              );
                            })}
                            {people.length > 8 ? (
                              <span className="grid size-9 place-items-center rounded-full border-2 border-background bg-muted text-xs font-semibold">
                                +{people.length - 8}
                              </span>
                            ) : null}
                            {!people.length ? (
                              <span className="text-sm text-muted-foreground">No contacts</span>
                            ) : null}
                          </div>
                        </TooltipProvider>
                      </TableCell>
                    </TableRow>
                  );
                })}
                {!listing.isPending && !listing.error && visible.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={3} className="py-10 text-center text-muted-foreground">
                      No prospects match the current search and category filters.
                    </TableCell>
                  </TableRow>
                ) : null}
              </TableBody>
            </Table>
          </div>
          <div ref={loadMoreRef} className="h-2" aria-hidden="true" />
          <div className="mt-4 text-xs text-muted-foreground">
            <Badge variant="secondary">{visible.length}</Badge> of {total} matching prospects loaded
            {listing.hasNextPage ? " · Scroll to load more" : ""}
          </div>
          {listing.hasNextPage ? (
            <Button
              className="mt-3"
              size="sm"
              variant="outline"
              disabled={listing.isFetchingNextPage}
              onClick={() => void listing.fetchNextPage()}
            >
              Load more prospects
            </Button>
          ) : null}
        </CardContent>
      </Card>
    </AppShell>
  );
}
