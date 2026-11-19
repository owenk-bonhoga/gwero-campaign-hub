import { useEffect, useMemo, useState, type Dispatch, type SetStateAction } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Archive,
  Copy,
  ExternalLink,
  Eye,
  EyeOff,
  KeyRound,
  Link2,
  LoaderCircle,
  LockKeyhole,
  Pencil,
  Plus,
  Search,
  ShieldCheck,
  UserRound,
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
import { Textarea } from "@/components/ui/textarea";
import {
  archivePortalAccount,
  listPortalAccounts,
  revealPortalCredentials,
  savePortalAccount,
} from "@/lib/portal-accounts.functions";
import type {
  PortalAccountInput,
  PortalAccountSummary,
  PortalCredentials,
} from "@/lib/portal-accounts.types";

export const Route = createFileRoute("/accounts")({ component: AccountsPage });

const categories = [
  "Procurement",
  "Government",
  "Supplier",
  "Client",
  "Finance",
  "Utilities",
  "Social",
  "Other",
];

const emptyCredentials = (): PortalCredentials => ({
  loginIdentifier: "",
  accountNumber: "",
  password: "",
  recoveryEmail: "",
  recoveryPhone: "",
});

const emptyForm = (): PortalAccountInput => ({
  portalName: "",
  category: "Procurement",
  portalUrl: "",
  websiteUrl: "",
  notes: "",
  credentials: emptyCredentials(),
});

function formatDate(value: string) {
  return new Date(value).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function AccountsPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState<PortalAccountInput>(emptyForm);
  const [viewing, setViewing] = useState<PortalAccountSummary | null>(null);
  const [credentials, setCredentials] = useState<PortalCredentials | null>(null);
  const [archiveTarget, setArchiveTarget] = useState<PortalAccountSummary | null>(null);
  const {
    data = [],
    isLoading,
    isError,
  } = useQuery({
    queryKey: ["portal-accounts"],
    queryFn: () => listPortalAccounts() as Promise<PortalAccountSummary[]>,
  });
  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return data.filter(
      (account) =>
        (category === "all" || account.category === category) &&
        (!needle ||
          [
            account.portalName,
            account.category,
            account.portalUrl,
            account.websiteUrl,
            account.notes,
          ]
            .join(" ")
            .toLowerCase()
            .includes(needle)),
    );
  }, [category, data, search]);
  const availableCategories = Array.from(
    new Set([...categories, ...data.map((item) => item.category)]),
  );
  const refresh = () => queryClient.invalidateQueries({ queryKey: ["portal-accounts"] });

  const openCreate = () => {
    setForm(emptyForm());
    setFormOpen(true);
  };
  const changeFormOpen = (open: boolean) => {
    setFormOpen(open);
    if (!open) setForm(emptyForm());
  };
  const openEdit = async (account: PortalAccountSummary) => {
    try {
      const secret = await revealPortalCredentials({ data: { id: account.id } });
      setForm({
        id: account.id,
        portalName: account.portalName,
        category: account.category,
        portalUrl: account.portalUrl,
        websiteUrl: account.websiteUrl,
        notes: account.notes,
        credentials: secret,
      });
      setFormOpen(true);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "The account could not be opened.");
    }
  };
  const openCredentials = async (account: PortalAccountSummary) => {
    setViewing(account);
    setCredentials(null);
    try {
      setCredentials(await revealPortalCredentials({ data: { id: account.id } }));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Credentials could not be revealed.");
      setViewing(null);
    }
  };
  useEffect(() => {
    if (!credentials) return;
    const timer = window.setTimeout(() => setCredentials(null), 60_000);
    return () => window.clearTimeout(timer);
  }, [credentials]);

  const saveMutation = useMutation({
    mutationFn: () => savePortalAccount({ data: form }),
    onSuccess: () => {
      toast.success(form.id ? "Portal account updated." : "Portal account saved securely.");
      setFormOpen(false);
      setForm(emptyForm());
      void refresh();
    },
    onError: (error) =>
      toast.error(
        error instanceof Error ? error.message : "The portal account could not be saved.",
      ),
  });
  const archiveMutation = useMutation({
    mutationFn: (id: string) => archivePortalAccount({ data: { id } }),
    onSuccess: () => {
      toast.success("Portal account archived.");
      setArchiveTarget(null);
      void refresh();
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : "The account could not be archived."),
  });

  return (
    <AppShell
      title="Portal accounts"
      description="Secure access details for procurement, supplier, client and business portals."
      actions={
        <Button size="sm" onClick={openCreate}>
          <Plus className="mr-2 size-4" /> Add account
        </Button>
      }
    >
      <div className="mb-4 grid gap-2 sm:grid-cols-3">
        <MiniStat label="Active portals" value={data.length} />
        <MiniStat
          label="Credentials stored"
          value={data.filter((item) => item.hasCredentials).length}
        />
        <MiniStat label="Portal groups" value={new Set(data.map((item) => item.category)).size} />
      </div>

      <Card className="overflow-hidden border-slate-200 shadow-sm">
        <CardContent className="p-0">
          <div className="flex flex-col gap-2 border-b bg-white p-3 sm:flex-row sm:items-center">
            <div className="relative min-w-0 flex-1">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search portals, links or notes"
                className="h-9 pl-9"
              />
            </div>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger className="h-9 w-full sm:w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All groups</SelectItem>
                {availableCategories.map((item) => (
                  <SelectItem key={item} value={item}>
                    {item}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground">
              <LoaderCircle className="size-4 animate-spin" /> Loading secure accounts…
            </div>
          ) : isError ? (
            <p className="py-16 text-center text-sm text-rose-700">
              Portal accounts could not be loaded.
            </p>
          ) : filtered.length ? (
            <div className="divide-y divide-slate-100">
              {filtered.map((account) => (
                <div
                  key={account.id}
                  className="grid gap-3 px-4 py-3 transition hover:bg-slate-50/80 lg:grid-cols-[minmax(0,1.5fr)_150px_minmax(0,1fr)_140px_auto] lg:items-center"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-cyan-50 text-cyan-700">
                      <KeyRound className="size-4" />
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-slate-900">
                        {account.portalName}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">
                        {account.portalUrl || account.websiteUrl || "No link saved"}
                      </p>
                    </div>
                  </div>
                  <Badge variant="secondary" className="w-fit">
                    {account.category}
                  </Badge>
                  <div className="min-w-0 text-xs text-muted-foreground">
                    <p className="truncate">Saved by {account.createdByName}</p>
                    <p>Updated {formatDate(account.updatedAt)}</p>
                  </div>
                  <div className="flex items-center gap-1.5 text-xs font-medium text-emerald-700">
                    <ShieldCheck className="size-4" />
                    {account.hasCredentials ? "Encrypted credentials" : "No credentials"}
                  </div>
                  <div className="flex items-center justify-end gap-1">
                    {account.portalUrl ? (
                      <Button variant="ghost" size="icon" asChild title="Open portal">
                        <a href={account.portalUrl} target="_blank" rel="noreferrer">
                          <ExternalLink className="size-4" />
                        </a>
                      </Button>
                    ) : null}
                    <Button variant="ghost" size="sm" onClick={() => void openCredentials(account)}>
                      <Eye className="mr-1.5 size-4" /> View
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      title="Edit"
                      onClick={() => void openEdit(account)}
                    >
                      <Pencil className="size-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      title="Archive"
                      onClick={() => setArchiveTarget(account)}
                    >
                      <Archive className="size-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-16 text-center">
              <LockKeyhole className="mx-auto size-8 text-slate-300" />
              <p className="mt-3 text-sm font-semibold">No portal accounts match this view</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Add the first portal or change the filters.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      <AccountFormDialog
        open={formOpen}
        onOpenChange={changeFormOpen}
        form={form}
        setForm={setForm}
        saving={saveMutation.isPending}
        onSave={() => saveMutation.mutate()}
      />
      <CredentialsDialog
        account={viewing}
        credentials={credentials}
        onOpenChange={(open) => {
          if (!open) {
            setViewing(null);
            setCredentials(null);
          }
        }}
      />
      <Dialog
        open={Boolean(archiveTarget)}
        onOpenChange={(open) => !open && setArchiveTarget(null)}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Archive portal account?</DialogTitle>
            <DialogDescription>
              {archiveTarget?.portalName} will be removed from the active list. Its encrypted
              credentials remain protected.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setArchiveTarget(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => archiveTarget && archiveMutation.mutate(archiveTarget.id)}
              disabled={archiveMutation.isPending}
            >
              Archive account
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}

function MiniStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-2.5 shadow-sm">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      <MetricValue className="max-w-24 text-right text-slate-900" value={value} maxSize={1.125} />
    </div>
  );
}

function AccountFormDialog({
  open,
  onOpenChange,
  form,
  setForm,
  saving,
  onSave,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  form: PortalAccountInput;
  setForm: Dispatch<SetStateAction<PortalAccountInput>>;
  saving: boolean;
  onSave: () => void;
}) {
  const set = (key: keyof PortalAccountInput, value: string) =>
    setForm((current) => ({ ...current, [key]: value }));
  const setCredential = (key: keyof PortalCredentials, value: string) =>
    setForm((current) => ({
      ...current,
      credentials: { ...(current.credentials || emptyCredentials()), [key]: value },
    }));
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{form.id ? "Edit portal account" : "Add portal account"}</DialogTitle>
          <DialogDescription>
            Login details are encrypted before storage and are never shown in the account list.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 py-1 sm:grid-cols-2">
          <Field
            label="Portal name"
            value={form.portalName}
            onChange={(value) => set("portalName", value)}
            placeholder="e.g. PPDA Malawi"
            className="sm:col-span-2"
          />
          <div className="space-y-1.5">
            <Label>Group</Label>
            <Select value={form.category} onValueChange={(value) => set("category", value)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {categories.map((item) => (
                  <SelectItem key={item} value={item}>
                    {item}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Field
            label="Portal login link"
            value={form.portalUrl}
            onChange={(value) => set("portalUrl", value)}
            placeholder="https://portal.example.com/login"
          />
          <Field
            label="Main website"
            value={form.websiteUrl}
            onChange={(value) => set("websiteUrl", value)}
            placeholder="https://example.com"
            className="sm:col-span-2"
          />
          <div className="sm:col-span-2 mt-1 flex items-center gap-2 border-t pt-3">
            <LockKeyhole className="size-4 text-cyan-700" />
            <p className="text-sm font-semibold">Encrypted login details</p>
          </div>
          <Field
            label="Username, email or phone"
            value={form.credentials?.loginIdentifier || ""}
            onChange={(value) => setCredential("loginIdentifier", value)}
            placeholder="name@example.com"
          />
          <Field
            label="Account / registration number"
            value={form.credentials?.accountNumber || ""}
            onChange={(value) => setCredential("accountNumber", value)}
            placeholder="Optional account number"
          />
          <Field
            label="Password"
            type="password"
            value={form.credentials?.password || ""}
            onChange={(value) => setCredential("password", value)}
            placeholder="Portal password"
          />
          <Field
            label="Recovery email"
            type="email"
            value={form.credentials?.recoveryEmail || ""}
            onChange={(value) => setCredential("recoveryEmail", value)}
            placeholder="recovery@example.com"
          />
          <Field
            label="Recovery phone"
            value={form.credentials?.recoveryPhone || ""}
            onChange={(value) => setCredential("recoveryPhone", value)}
            placeholder="+265…"
          />
          <div className="space-y-1.5 sm:col-span-2">
            <Label>Notes</Label>
            <Textarea
              value={form.notes}
              onChange={(event) => set("notes", event.target.value)}
              placeholder="Purpose, MFA instructions, account owner or renewal details"
              className="min-h-20"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={onSave} disabled={saving || !form.portalName.trim()}>
            {saving ? (
              <LoaderCircle className="mr-2 size-4 animate-spin" />
            ) : (
              <ShieldCheck className="mr-2 size-4" />
            )}
            Save securely
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
  className = "",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: string;
  className?: string;
}) {
  return (
    <div className={`space-y-1.5 ${className}`}>
      <Label>{label}</Label>
      <Input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
      />
    </div>
  );
}

function CredentialsDialog({
  account,
  credentials,
  onOpenChange,
}: {
  account: PortalAccountSummary | null;
  credentials: PortalCredentials | null;
  onOpenChange: (open: boolean) => void;
}) {
  const [showPassword, setShowPassword] = useState(false);
  useEffect(() => setShowPassword(false), [account?.id]);
  const copy = async (label: string, value: string) => {
    if (!value) return;
    await navigator.clipboard.writeText(value);
    toast.success(`${label} copied.`);
  };
  return (
    <Dialog open={Boolean(account)} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{account?.portalName}</DialogTitle>
          <DialogDescription>
            Credentials are cleared from this screen automatically after one minute.
          </DialogDescription>
        </DialogHeader>
        {!credentials ? (
          <div className="flex items-center justify-center gap-2 py-12 text-sm text-muted-foreground">
            <LoaderCircle className="size-4 animate-spin" /> Decrypting credentials…
          </div>
        ) : (
          <div className="space-y-2">
            <CredentialRow
              icon={UserRound}
              label="Login"
              value={credentials.loginIdentifier}
              onCopy={() => void copy("Login", credentials.loginIdentifier)}
            />
            <CredentialRow
              icon={Link2}
              label="Account number"
              value={credentials.accountNumber}
              onCopy={() => void copy("Account number", credentials.accountNumber)}
            />
            <div className="flex items-center gap-3 rounded-xl border px-3 py-2.5">
              <KeyRound className="size-4 shrink-0 text-cyan-700" />
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                  Password
                </p>
                <p className="truncate text-sm font-medium">
                  {credentials.password
                    ? showPassword
                      ? credentials.password
                      : "••••••••••••"
                    : "Not stored"}
                </p>
              </div>
              {credentials.password ? (
                <>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setShowPassword((value) => !value)}
                  >
                    {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => void copy("Password", credentials.password)}
                  >
                    <Copy className="size-4" />
                  </Button>
                </>
              ) : null}
            </div>
            <CredentialRow
              icon={UserRound}
              label="Recovery email"
              value={credentials.recoveryEmail}
              onCopy={() => void copy("Recovery email", credentials.recoveryEmail)}
            />
            <CredentialRow
              icon={UserRound}
              label="Recovery phone"
              value={credentials.recoveryPhone}
              onCopy={() => void copy("Recovery phone", credentials.recoveryPhone)}
            />
          </div>
        )}
        <DialogFooter>
          {account?.portalUrl ? (
            <Button variant="outline" asChild>
              <a href={account.portalUrl} target="_blank" rel="noreferrer">
                <ExternalLink className="mr-2 size-4" /> Open portal
              </a>
            </Button>
          ) : null}
          <Button onClick={() => onOpenChange(false)}>Done</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CredentialRow({
  icon: Icon,
  label,
  value,
  onCopy,
}: {
  icon: typeof UserRound;
  label: string;
  value: string;
  onCopy: () => void;
}) {
  return (
    <div className="flex items-center gap-3 rounded-xl border px-3 py-2.5">
      <Icon className="size-4 shrink-0 text-cyan-700" />
      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
          {label}
        </p>
        <p className="truncate text-sm font-medium">{value || "Not stored"}</p>
      </div>
      {value ? (
        <Button variant="ghost" size="icon" onClick={onCopy}>
          <Copy className="size-4" />
        </Button>
      ) : null}
    </div>
  );
}
