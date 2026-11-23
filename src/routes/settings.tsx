import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ConfirmAction } from "@/components/ConfirmAction";
import { MailboxSettings } from "@/components/settings/MailboxSettings";
import { EmailSignatureSettings } from "@/components/settings/EmailSignatureSettings";
import { CurrencySettings } from "@/components/settings/CurrencySettings";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { db } from "@/lib/db";
import {
  getSettingsOverview,
  saveProviderSecrets,
  saveSystemSettings,
} from "@/lib/settings.functions";
import { syncBidafOpportunities } from "@/lib/bidaf.functions";
import {
  createRole,
  deleteSystemUser,
  saveSystemUser,
  setRolePermission,
} from "@/lib/auth.functions";

export const Route = createFileRoute("/settings")({
  validateSearch: (search: Record<string, unknown>) => ({
    tab: typeof search["tab"] === "string" ? search["tab"] : undefined,
    setup: search["setup"] === "required" ? "required" : undefined,
    connected: typeof search["connected"] === "string" ? search["connected"] : undefined,
    error: typeof search["error"] === "string" ? search["error"] : undefined,
  }),
  component: SettingsPage,
});

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
        aria-label={label}
        type={type}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}

function SettingsPage() {
  const qc = useQueryClient();
  const search = Route.useSearch();
  const [activeTab, setActiveTab] = useState(search.tab || "general");
  useEffect(() => {
    if (search.connected) toast.success(`${search.connected} email account connected.`);
    if (search.error) toast.error(search.error);
    if (search.connected || search.error) {
      const url = new URL(window.location.href);
      url.searchParams.delete("connected");
      url.searchParams.delete("error");
      window.history.replaceState({}, "", url);
    }
  }, [search.connected, search.error]);
  const { data, isLoading } = useQuery({
    queryKey: ["settings-overview"],
    queryFn: () => getSettingsOverview(),
    placeholderData: (previous) => previous,
  });
  const values = Object.fromEntries(
    (data?.settings ?? []).map((item: { setting_key: string; setting_value: unknown }) => [
      item.setting_key,
      String(item.setting_value ?? ""),
    ]),
  );
  if (isLoading || !data)
    return (
      <AppShell title="Settings">
        <p className="text-muted-foreground">Loading settings…</p>
      </AppShell>
    );
  const managedTabs = ["general", "templates", "currencies", "ai", "integrations", "access"];
  const setupRequired = search.setup === "required";
  const tab = setupRequired
    ? data.canManageSettings && activeTab === "integrations"
      ? "integrations"
      : "email"
    : data.canManageSettings || !managedTabs.includes(activeTab)
      ? activeTab
      : "email";
  const secretLabels: Record<string, string> = {
    openai_api_key: "OpenAI API key",
    google_oauth_client_id: "Google OAuth client ID",
    google_oauth_client_secret: "Google OAuth client secret",
    microsoft_oauth_client_id: "Microsoft OAuth client ID",
    microsoft_oauth_client_secret: "Microsoft OAuth client secret",
    bidaf_api_token: "BidAF API token",
  };
  return (
    <AppShell
      title="Settings"
      description="Configure Gwero OS, connected email, AI, templates and access control."
    >
      {data.unreadableSecrets.length ? (
        <div
          role="alert"
          className="mb-5 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950"
        >
          <p className="font-semibold">Some provider credentials need to be saved again.</p>
          <p className="mt-1">
            These encrypted values came from a different environment and cannot be read here:
            {data.unreadableSecrets.map((key: string) => secretLabels[key] || key).join(", ")}. Open
            the relevant tab and enter the value again; the rest of your settings and data are
            intact.
          </p>
        </div>
      ) : null}
      <Tabs
        value={tab}
        onValueChange={(value) => {
          setActiveTab(value);
          const url = new URL(window.location.href);
          url.searchParams.set("tab", value);
          window.history.replaceState({}, "", url);
        }}
        className="space-y-5"
      >
        <TabsList className="h-auto w-full justify-start overflow-x-auto bg-white p-1.5">
          {data.canManageSettings && !setupRequired ? (
            <TabsTrigger value="general">General</TabsTrigger>
          ) : null}
          <TabsTrigger value="email">Email connections</TabsTrigger>
          {!setupRequired ? <TabsTrigger value="signatures">Email signatures</TabsTrigger> : null}
          {data.canManageSettings && !setupRequired ? (
            <TabsTrigger value="templates">Email templates</TabsTrigger>
          ) : null}
          {data.canManageSettings && !setupRequired ? (
            <TabsTrigger value="currencies">Currencies</TabsTrigger>
          ) : null}
          {data.canManageSettings && !setupRequired ? (
            <TabsTrigger value="ai">AI & Prospecting</TabsTrigger>
          ) : null}
          {data.canManageSettings ? (
            <TabsTrigger value="integrations">Integrations</TabsTrigger>
          ) : null}
          {data.canManageSettings && !setupRequired ? (
            <TabsTrigger value="access">Users & access</TabsTrigger>
          ) : null}
        </TabsList>
        <TabsContent value="general">
          <GeneralTab
            initial={values}
            onSaved={() => {
              void qc.invalidateQueries({ queryKey: ["settings-overview"] });
              void qc.invalidateQueries({ queryKey: ["app-branding"] });
            }}
          />
        </TabsContent>
        <TabsContent value="email">
          <EmailTab setupRequired={setupRequired} />
        </TabsContent>
        <TabsContent value="signatures">
          <EmailSignatureSettings />
        </TabsContent>
        <TabsContent value="templates">
          <TemplatesTab
            templates={data.templates}
            refresh={() => qc.invalidateQueries({ queryKey: ["settings-overview"] })}
          />
        </TabsContent>
        <TabsContent value="currencies">
          <CurrencySettings />
        </TabsContent>
        <TabsContent value="ai">
          <AiTab
            initial={values}
            configured={data.configured.openai}
            refresh={() => qc.invalidateQueries({ queryKey: ["settings-overview"] })}
          />
        </TabsContent>
        <TabsContent value="integrations">
          <IntegrationsTab
            initial={values}
            configured={data.configured.bidaf}
            emailConfigured={{
              google: data.configured.googleId && data.configured.googleSecret,
              microsoft: data.configured.microsoftId && data.configured.microsoftSecret,
            }}
            refresh={() => qc.invalidateQueries({ queryKey: ["settings-overview"] })}
          />
        </TabsContent>
        <TabsContent value="access">
          <AccessTab
            data={data}
            refresh={() => qc.invalidateQueries({ queryKey: ["settings-overview"] })}
          />
        </TabsContent>
      </Tabs>
    </AppShell>
  );
}

function IntegrationsTab({
  initial,
  configured,
  emailConfigured,
  refresh,
}: {
  initial: Record<string, string>;
  configured: boolean;
  emailConfigured: { google: boolean; microsoft: boolean };
  refresh: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [editingEmailApps, setEditingEmailApps] = useState(false);
  const [emailApps, setEmailApps] = useState({
    google_oauth_client_id: "",
    google_oauth_client_secret: "",
    microsoft_oauth_client_id: "",
    microsoft_oauth_client_secret: "",
  });
  const [form, setForm] = useState({
    origin: initial["bidaf_origin"] || "https://bidaf.africa",
    organisationId: initial["bidaf_organisation_id"] || "",
    country: initial["bidaf_country"] || "MW",
    token: "",
  });
  const save = useMutation({
    mutationFn: async () => {
      await saveSystemSettings({
        data: {
          group: "integrations",
          values: {
            bidaf_origin: form.origin,
            bidaf_organisation_id: form.organisationId,
            bidaf_country: form.country.toUpperCase(),
          },
        },
      });
      await saveProviderSecrets({ data: { bidaf_api_token: form.token } });
      return syncBidafOpportunities();
    },
    onSuccess: (result) => {
      setEditing(false);
      refresh();
      setForm((current) => ({ ...current, token: "" }));
      if (result.status === "completed") {
        toast.success(
          `BidAF connected: ${result.created} added, ${result.updated} updated, ${result.seen} checked.`,
        );
      } else {
        toast.success("BidAF settings saved. The hourly sync is already up to date.");
      }
    },
    onError: (error: Error) => toast.error(error.message),
  });
  const set = (key: keyof typeof form, value: string) =>
    setForm((current) => ({ ...current, [key]: value }));
  const saveEmailApps = useMutation({
    mutationFn: () => saveProviderSecrets({ data: emailApps }),
    onSuccess: () => {
      toast.success("Email provider applications saved securely.");
      setEditingEmailApps(false);
      setEmailApps({
        google_oauth_client_id: "",
        google_oauth_client_secret: "",
        microsoft_oauth_client_id: "",
        microsoft_oauth_client_secret: "",
      });
      refresh();
    },
    onError: (error: Error) => toast.error(error.message),
  });
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-4">
            <div>
              <CardTitle>BidAF opportunity discovery</CardTitle>
              <CardDescription>
                Import active opportunities hourly and route them into Bids, EOI, RFPs and RFQs.
              </CardDescription>
            </div>
            <Badge variant={configured ? "default" : "secondary"}>
              {configured ? "Token configured" : "Token required"}
            </Badge>
            <Button variant="outline" onClick={() => setEditing((value) => !value)}>
              {editing ? "Cancel" : configured ? "Configure" : "Connect"}
            </Button>
          </div>
        </CardHeader>
        {editing ? (
          <CardContent className="grid gap-4 md:grid-cols-2">
            <Field
              label="BidAF origin"
              value={form.origin}
              placeholder="https://bidaf.africa"
              onChange={(value) => set("origin", value)}
            />
            <Field
              label="Organisation ID"
              value={form.organisationId}
              onChange={(value) => set("organisationId", value)}
            />
            <Field
              label="Country code"
              value={form.country}
              placeholder="MW"
              onChange={(value) => set("country", value.slice(0, 2).toUpperCase())}
            />
            <Field
              label={configured ? "Replace API token" : "API token"}
              type="password"
              value={form.token}
              placeholder={configured ? "Leave blank to keep the current token" : "baf_test_…"}
              onChange={(value) => set("token", value)}
            />
            <p className="text-sm text-muted-foreground md:col-span-2">
              The token is encrypted at rest and used only by the server. Saving also performs a
              safe, idempotent sync; later runs are limited to once per hour.
            </p>
            <Button
              className="md:w-fit"
              disabled={
                save.isPending ||
                !form.origin ||
                !form.organisationId ||
                (!configured && !form.token)
              }
              onClick={() => save.mutate()}
            >
              {save.isPending ? "Connecting…" : "Save and sync BidAF"}
            </Button>
          </CardContent>
        ) : null}
      </Card>
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <CardTitle>Email provider applications</CardTitle>
              <CardDescription>
                Company-wide OAuth configuration used by the one-click Google and Microsoft account
                setup.
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <Badge variant={emailConfigured.google ? "default" : "secondary"}>
                Google {emailConfigured.google ? "ready" : "not configured"}
              </Badge>
              <Badge variant={emailConfigured.microsoft ? "default" : "secondary"}>
                Microsoft {emailConfigured.microsoft ? "ready" : "not configured"}
              </Badge>
              <Button variant="outline" onClick={() => setEditingEmailApps((value) => !value)}>
                {editingEmailApps ? "Cancel" : "Configure"}
              </Button>
            </div>
          </div>
        </CardHeader>
        {editingEmailApps ? (
          <CardContent className="grid gap-4 md:grid-cols-2">
            <Field
              label={emailConfigured.google ? "Replace Google client ID" : "Google client ID"}
              value={emailApps.google_oauth_client_id}
              onChange={(value) =>
                setEmailApps((current) => ({ ...current, google_oauth_client_id: value }))
              }
              placeholder={emailConfigured.google ? "Leave blank to keep current" : ""}
            />
            <Field
              label={
                emailConfigured.google ? "Replace Google client secret" : "Google client secret"
              }
              type="password"
              value={emailApps.google_oauth_client_secret}
              onChange={(value) =>
                setEmailApps((current) => ({ ...current, google_oauth_client_secret: value }))
              }
              placeholder={emailConfigured.google ? "Leave blank to keep current" : ""}
            />
            <Field
              label={
                emailConfigured.microsoft ? "Replace Microsoft client ID" : "Microsoft client ID"
              }
              value={emailApps.microsoft_oauth_client_id}
              onChange={(value) =>
                setEmailApps((current) => ({ ...current, microsoft_oauth_client_id: value }))
              }
              placeholder={emailConfigured.microsoft ? "Leave blank to keep current" : ""}
            />
            <Field
              label={
                emailConfigured.microsoft
                  ? "Replace Microsoft client secret"
                  : "Microsoft client secret"
              }
              type="password"
              value={emailApps.microsoft_oauth_client_secret}
              onChange={(value) =>
                setEmailApps((current) => ({ ...current, microsoft_oauth_client_secret: value }))
              }
              placeholder={emailConfigured.microsoft ? "Leave blank to keep current" : ""}
            />
            <p className="text-sm text-muted-foreground md:col-span-2">
              Register the callback URLs <code>/api/oauth/google/callback</code> and{" "}
              <code>/api/oauth/microsoft/callback</code> at the providers. Secrets are encrypted at
              rest.
            </p>
            <Button
              className="md:w-fit"
              disabled={saveEmailApps.isPending}
              onClick={() => saveEmailApps.mutate()}
            >
              {saveEmailApps.isPending ? "Saving…" : "Save provider applications"}
            </Button>
          </CardContent>
        ) : null}
      </Card>
    </div>
  );
}

function GeneralTab({
  initial,
  onSaved,
}: {
  initial: Record<string, string>;
  onSaved: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [editingOffice, setEditingOffice] = useState(false);
  const [form, setForm] = useState({
    system_name: initial["system_name"] || "Gwero OS",
    primary_color: initial["primary_color"] || "#1c2745",
    accent_color: initial["accent_color"] || "#ede9fe",
    font_family: initial["font_family"] || "Inter",
    logo_url: initial["logo_url"] || "",
    icon_url: initial["icon_url"] || "",
  });
  const save = useMutation({
    mutationFn: () => saveSystemSettings({ data: { group: "branding", values: form } }),
    onSuccess: () => {
      toast.success("Brand settings saved.");
      setEditing(false);
      onSaved();
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const [office, setOffice] = useState({
    office_name: initial["office_name"] || "",
    office_address_line: initial["office_address_line"] || "",
    office_city: initial["office_city"] || "",
    office_region: initial["office_region"] || "",
    office_country: initial["office_country"] || "Malawi",
    office_postal_code: initial["office_postal_code"] || "",
    office_phone: initial["office_phone"] || "",
    office_email: initial["office_email"] || "",
  });
  const saveOffice = useMutation({
    mutationFn: () => saveSystemSettings({ data: { group: "office", values: office } }),
    onSuccess: () => {
      toast.success("Office address saved.");
      setEditingOffice(false);
      onSaved();
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const set = (key: keyof typeof form, value: string) =>
    setForm((old) => ({ ...old, [key]: value }));
  const setOfficeField = (key: keyof typeof office, value: string) =>
    setOffice((current) => ({ ...current, [key]: value }));
  const officeSummary = [
    office.office_address_line,
    office.office_city,
    office.office_region,
    office.office_postal_code,
    office.office_country,
  ].filter(Boolean);
  return (
    <div className="space-y-5">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-4">
            <div>
              <CardTitle>Brand and system identity</CardTitle>
              <CardDescription>
                Changes are stored centrally for the interface and outbound communication.
              </CardDescription>
            </div>
            <Button variant="outline" onClick={() => setEditing((value) => !value)}>
              {editing ? "Cancel" : "Edit branding"}
            </Button>
          </div>
        </CardHeader>
        {editing ? (
          <CardContent className="grid gap-4 md:grid-cols-2">
            <Field
              label="System name"
              value={form.system_name}
              onChange={(v) => set("system_name", v)}
            />
            <div className="space-y-2">
              <Label>Font family</Label>
              <Select value={form.font_family} onValueChange={(v) => set("font_family", v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[
                    "Inter",
                    "Roboto",
                    "Arial",
                    "Georgia",
                    "Verdana",
                    "Trebuchet MS",
                    "Times New Roman",
                    "Courier New",
                  ].map((font) => (
                    <SelectItem key={font} value={font}>
                      {font}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Field
              label="Primary color"
              type="color"
              value={form.primary_color}
              onChange={(v) => set("primary_color", v)}
            />
            <Field
              label="Accent color"
              type="color"
              value={form.accent_color}
              onChange={(v) => set("accent_color", v)}
            />
            <ImageUpload
              label="System logo"
              value={form.logo_url}
              onChange={(v) => set("logo_url", v)}
              accept="image/png,image/jpeg,image/webp,image/svg+xml"
            />
            <ImageUpload
              label="Browser icon"
              value={form.icon_url}
              onChange={(v) => set("icon_url", v)}
              accept="image/png,image/x-icon,image/svg+xml"
            />
            <Button
              className="md:col-span-2 md:w-fit"
              disabled={save.isPending}
              onClick={() => save.mutate()}
            >
              Save general settings
            </Button>
          </CardContent>
        ) : (
          <CardContent>
            <div className="flex items-center gap-3">
              {form.logo_url ? (
                <img
                  src={form.logo_url}
                  alt="Current logo"
                  className="h-12 w-28 object-contain object-left"
                />
              ) : null}
              <div>
                <p className="font-semibold">{form.system_name}</p>
                <p className="text-sm text-muted-foreground">
                  {form.font_family} · {form.primary_color}
                </p>
              </div>
            </div>
          </CardContent>
        )}
      </Card>
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <CardTitle>Office address</CardTitle>
              <CardDescription>
                The organisation address used by the assistant and available to business documents.
              </CardDescription>
            </div>
            <Button variant="outline" onClick={() => setEditingOffice((value) => !value)}>
              {editingOffice ? "Cancel" : officeSummary.length ? "Edit address" : "Add address"}
            </Button>
          </div>
        </CardHeader>
        {editingOffice ? (
          <CardContent className="grid gap-4 md:grid-cols-2">
            <Field
              label="Office name"
              value={office.office_name}
              onChange={(value) => setOfficeField("office_name", value)}
            />
            <Field
              label="Street / building"
              value={office.office_address_line}
              onChange={(value) => setOfficeField("office_address_line", value)}
            />
            <Field
              label="City"
              value={office.office_city}
              onChange={(value) => setOfficeField("office_city", value)}
            />
            <Field
              label="Region / district"
              value={office.office_region}
              onChange={(value) => setOfficeField("office_region", value)}
            />
            <Field
              label="Country"
              value={office.office_country}
              onChange={(value) => setOfficeField("office_country", value)}
            />
            <Field
              label="Postal code"
              value={office.office_postal_code}
              onChange={(value) => setOfficeField("office_postal_code", value)}
            />
            <Field
              label="Office phone"
              value={office.office_phone}
              onChange={(value) => setOfficeField("office_phone", value)}
            />
            <Field
              label="Office email"
              type="email"
              value={office.office_email}
              onChange={(value) => setOfficeField("office_email", value)}
            />
            <Button
              className="md:col-span-2 md:w-fit"
              disabled={saveOffice.isPending}
              onClick={() => saveOffice.mutate()}
            >
              {saveOffice.isPending ? "Saving…" : "Save office address"}
            </Button>
          </CardContent>
        ) : (
          <CardContent>
            {officeSummary.length ? (
              <div className="space-y-1 text-sm">
                {office.office_name ? (
                  <p className="font-semibold text-foreground">{office.office_name}</p>
                ) : null}
                <p className="text-muted-foreground">{officeSummary.join(", ")}</p>
                {office.office_phone || office.office_email ? (
                  <p className="text-muted-foreground">
                    {[office.office_phone, office.office_email].filter(Boolean).join(" · ")}
                  </p>
                ) : null}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No office address has been added yet.</p>
            )}
          </CardContent>
        )}
      </Card>
    </div>
  );
}

function ImageUpload({
  label,
  value,
  onChange,
  accept,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  accept: string;
}) {
  const load = (file?: File) => {
    if (!file) return;
    if (file.size > 2_000_000) {
      toast.error("Choose an image smaller than 2 MB.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => onChange(String(reader.result));
    reader.readAsDataURL(file);
  };
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <div className="flex items-center gap-3">
        {value ? (
          <img
            src={value}
            alt={`${label} preview`}
            className="size-14 rounded-xl border bg-white object-contain p-1"
          />
        ) : (
          <div className="grid size-14 place-items-center rounded-xl border border-dashed text-xs text-muted-foreground">
            None
          </div>
        )}
        <div className="space-y-2">
          <Input type="file" accept={accept} onChange={(e) => load(e.target.files?.[0])} />
          {value ? (
            <Button type="button" size="sm" variant="ghost" onClick={() => onChange("")}>
              Remove image
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function EmailTab({ setupRequired }: { setupRequired: boolean }) {
  return <MailboxSettings setupRequired={setupRequired} />;
}

function AiTab({
  initial,
  configured,
  refresh,
}: {
  initial: Record<string, string>;
  configured: boolean;
  refresh: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({
    apiKey: "",
    model: initial["ai_model"] || "gpt-5",
    baseUrl: initial["ai_base_url"] || "https://api.openai.com/v1",
    context:
      initial["ai_prospect_context"] ||
      "Find organizations with a credible need for our category offerings. Prioritize verified decision makers and explain every fit with source evidence.",
  });
  const save = useMutation({
    mutationFn: async () => {
      await saveSystemSettings({
        data: {
          group: "ai",
          values: {
            ai_model: form.model,
            ai_base_url: form.baseUrl,
            ai_prospect_context: form.context,
          },
        },
      });
      await saveProviderSecrets({ data: { openai_api_key: form.apiKey } });
    },
    onSuccess: () => {
      toast.success("AI settings saved.");
      setEditing(false);
      refresh();
      setForm((old) => ({ ...old, apiKey: "" }));
    },
    onError: (e: Error) => toast.error(e.message),
  });
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>OpenAI prospect research</CardTitle>
            <CardDescription>
              Gwero combines this permanent guide with each search request.
            </CardDescription>
          </div>
          <Badge variant={configured ? "default" : "secondary"}>
            {configured ? "API key configured" : "API key required"}
          </Badge>
          <Button variant="outline" onClick={() => setEditing((value) => !value)}>
            {editing ? "Cancel" : "Configure"}
          </Button>
        </div>
      </CardHeader>
      {editing ? (
        <CardContent className="space-y-5">
          <div className="grid gap-5 md:grid-cols-2">
            <Field
              label="OpenAI API key"
              type="password"
              value={form.apiKey}
              onChange={(v) => setForm((o) => ({ ...o, apiKey: v }))}
              placeholder={configured ? "Leave blank to keep current key" : "sk-…"}
            />
            <div className="space-y-2">
              <Label>Model</Label>
              <Select
                value={form.model}
                onValueChange={(v) => setForm((o) => ({ ...o, model: v }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[
                    "gpt-5.6-luna",
                    "gpt-5.6-terra",
                    "gpt-5.4-mini",
                    "gpt-5.4",
                    "gpt-5",
                    "gpt-4.1-mini",
                  ].map((model) => (
                    <SelectItem key={model} value={model}>
                      {model}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Field
              label="API base URL"
              value={form.baseUrl}
              onChange={(v) => setForm((o) => ({ ...o, baseUrl: v }))}
            />
          </div>
          <div className="space-y-2">
            <Label>Predefined research context and guardrails</Label>
            <Textarea
              rows={7}
              value={form.context}
              onChange={(e) => setForm((o) => ({ ...o, context: e.target.value }))}
            />
          </div>
          <Button onClick={() => save.mutate()} disabled={save.isPending}>
            Save AI configuration
          </Button>
        </CardContent>
      ) : (
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Model: {form.model} · {configured ? "Connected" : "Not connected"}
          </p>
        </CardContent>
      )}
    </Card>
  );
}

function TemplatesTab({
  templates,
  refresh,
}: {
  templates: Array<{
    id: string;
    name: string;
    event_key: string;
    subject: string;
    body_html: string;
    is_active: boolean;
  }>;
  refresh: () => void;
}) {
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({
    name: "",
    event_key: "",
    subject: "",
    body_html: "",
    is_active: true,
  });
  const save = useMutation({
    mutationFn: async () => {
      const { error } = await db.from("email_templates").upsert(form, { onConflict: "event_key" });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Email template saved.");
      setCreating(false);
      setForm({ name: "", event_key: "", subject: "", body_html: "", is_active: true });
      refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });
  return (
    <>
      <div className="space-y-4">
        <div className="flex justify-end">
          <Button onClick={() => setCreating((value) => !value)}>
            {creating ? "Cancel" : "Create template"}
          </Button>
        </div>
        {creating ? (
          <Card>
            <CardHeader>
              <CardTitle>Create or replace a template</CardTitle>
              <CardDescription>
                Use placeholders such as {"{{first_name}}"}, {"{{company}}"} and {"{{system_name}}"}
                .
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Field
                label="Template name"
                value={form.name}
                onChange={(v) => setForm((o) => ({ ...o, name: v }))}
              />
              <Field
                label="Event key"
                value={form.event_key}
                onChange={(v) => setForm((o) => ({ ...o, event_key: v }))}
                placeholder="campaign.follow_up"
              />
              <Field
                label="Subject"
                value={form.subject}
                onChange={(v) => setForm((o) => ({ ...o, subject: v }))}
              />
              <div className="space-y-2">
                <Label>HTML body</Label>
                <Textarea
                  rows={8}
                  value={form.body_html}
                  onChange={(e) => setForm((o) => ({ ...o, body_html: e.target.value }))}
                />
              </div>
              <div className="flex items-center gap-3">
                <Switch
                  checked={form.is_active}
                  onCheckedChange={(v) => setForm((o) => ({ ...o, is_active: v }))}
                />
                <Label>Active</Label>
              </div>
              <Button
                onClick={() => save.mutate()}
                disabled={!form.name || !form.event_key || !form.subject}
              >
                Save template
              </Button>
            </CardContent>
          </Card>
        ) : null}
        <div className="space-y-3">
          {templates.map((t) => (
            <Card key={t.id}>
              <CardHeader>
                <div className="flex justify-between gap-3">
                  <div>
                    <CardTitle className="text-base">{t.name}</CardTitle>
                    <CardDescription>
                      {t.event_key} · {t.subject}
                    </CardDescription>
                  </div>
                  <Badge variant={t.is_active ? "default" : "secondary"}>
                    {t.is_active ? "Active" : "Off"}
                  </Badge>
                </div>
              </CardHeader>
            </Card>
          ))}
          {!templates.length ? (
            <Card>
              <CardContent className="py-10 text-center text-muted-foreground">
                No templates created yet.
              </CardContent>
            </Card>
          ) : null}
        </div>
      </div>
    </>
  );
}

function AccessTab({
  data,
  refresh,
}: {
  data: Awaited<ReturnType<typeof getSettingsOverview>>;
  refresh: () => void;
}) {
  const [addingUser, setAddingUser] = useState(false);
  const [addingRole, setAddingRole] = useState(false);
  const [user, setUser] = useState({
    full_name: "",
    email: "",
    role_id: "",
    status: "active",
    password: "",
  });
  const [editingUser, setEditingUser] = useState<{
    id: string;
    full_name: string;
    email: string;
    role_id: string;
    status: string;
    password: string;
  } | null>(null);
  const [role, setRole] = useState({ name: "", description: "" });
  const addUser = async () => {
    try {
      await saveSystemUser({
        data: {
          fullName: user.full_name,
          email: user.email,
          roleId: user.role_id || null,
          status: user.status,
          password: user.password,
        },
      });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not add user.");
      return;
    }
    toast.success("User added.");
    setAddingUser(false);
    setUser({ full_name: "", email: "", role_id: "", status: "active", password: "" });
    refresh();
  };
  const addRole = async () => {
    try {
      await createRole({ data: role });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not create role.");
      return;
    }
    toast.success("Role created.");
    setAddingRole(false);
    setRole({ name: "", description: "" });
    refresh();
  };
  const updateUser = async () => {
    if (!editingUser) return;
    try {
      await saveSystemUser({
        data: {
          id: editingUser.id,
          fullName: editingUser.full_name,
          email: editingUser.email,
          roleId: editingUser.role_id || null,
          status: editingUser.status,
          ...(editingUser.password ? { password: editingUser.password } : {}),
        },
      });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not update user.");
      return;
    }
    toast.success("User updated.");
    setEditingUser(null);
    refresh();
  };
  const deleteUser = async (id: string) => {
    try {
      await deleteSystemUser({ data: { id } });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not delete user.");
      throw error;
    }
    toast.success("User deleted.");
    refresh();
  };
  const togglePermission = async (roleId: string, permissionId: string, enabled: boolean) => {
    try {
      await setRolePermission({ data: { roleId, permissionId, enabled } });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not update permission.");
      return;
    }
    refresh();
  };
  return (
    <div className="grid gap-5 xl:grid-cols-2">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-3">
            <div>
              <CardTitle>System users</CardTitle>
              <CardDescription>
                Assign each person one role and an initial password. Active users can sign in
                immediately.
              </CardDescription>
            </div>
            <Button variant="outline" onClick={() => setAddingUser((value) => !value)}>
              {addingUser ? "Cancel" : "Add user"}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {addingUser ? (
            <>
              <div className="grid gap-3 rounded-xl border bg-muted/20 p-4 sm:grid-cols-2">
                <Field
                  label="Full name"
                  value={user.full_name}
                  onChange={(v) => setUser((o) => ({ ...o, full_name: v }))}
                />
                <Field
                  label="Email"
                  type="email"
                  value={user.email}
                  onChange={(v) => setUser((o) => ({ ...o, email: v }))}
                />
                <Field
                  label="Initial password"
                  type="password"
                  value={user.password}
                  placeholder="At least 10 characters"
                  onChange={(v) => setUser((o) => ({ ...o, password: v }))}
                />
                <div className="space-y-2">
                  <Label>Role</Label>
                  <Select
                    value={user.role_id}
                    onValueChange={(v) => setUser((o) => ({ ...o, role_id: v }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Choose role" />
                    </SelectTrigger>
                    <SelectContent>
                      {data.roles.map((r: { id: string; name: string }) => (
                        <SelectItem key={r.id} value={r.id}>
                          {r.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <Button
                onClick={() => void addUser()}
                disabled={
                  !user.full_name || !user.email || !user.role_id || user.password.length < 10
                }
              >
                Add user
              </Button>
            </>
          ) : null}
          <div className="divide-y rounded-xl border">
            {data.users.map(
              (u: {
                id: string;
                full_name: string;
                email: string;
                role_id: string | null;
                status: string;
              }) => (
                <div key={u.id} className="flex flex-wrap items-center justify-between gap-3 p-3">
                  <div>
                    <p className="font-medium">{u.full_name}</p>
                    <p className="text-xs text-muted-foreground">{u.email}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">
                      {data.roles.find((r: { id: string }) => r.id === u.role_id)?.name || u.status}
                    </Badge>
                    {u.id === data.currentUserId ? (
                      <Badge variant="secondary">Current user</Badge>
                    ) : null}
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        setEditingUser({
                          id: u.id,
                          full_name: u.full_name,
                          email: u.email,
                          role_id: u.role_id || "",
                          status: u.status,
                          password: "",
                        })
                      }
                    >
                      Edit
                    </Button>
                    <ConfirmAction
                      title="Delete system user?"
                      description={`Remove ${u.full_name} (${u.email}) from Gwero OS?`}
                      onConfirm={() => deleteUser(u.id)}
                      disabled={u.id === data.currentUserId}
                      trigger={
                        <Button
                          size="sm"
                          variant="destructive"
                          disabled={u.id === data.currentUserId}
                        >
                          Delete
                        </Button>
                      }
                    />
                  </div>
                </div>
              ),
            )}
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-3">
            <div>
              <CardTitle>Roles and permissions</CardTitle>
              <CardDescription>
                RBAC policy catalogue for every protected module and action.
              </CardDescription>
            </div>
            <Button variant="outline" onClick={() => setAddingRole((value) => !value)}>
              {addingRole ? "Cancel" : "Create role"}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {addingRole ? (
            <div className="space-y-4 rounded-xl border bg-muted/20 p-4">
              <Field
                label="Role name"
                value={role.name}
                onChange={(v) => setRole((o) => ({ ...o, name: v }))}
              />
              <Field
                label="Description"
                value={role.description}
                onChange={(v) => setRole((o) => ({ ...o, description: v }))}
              />
              <Button onClick={() => void addRole()} disabled={!role.name}>
                Create role
              </Button>
            </div>
          ) : null}
          {data.roles.map(
            (r: { id: string; name: string; description: string | null; is_system: boolean }) => (
              <div key={r.id} className="rounded-xl border p-4">
                <div className="flex justify-between">
                  <p className="font-semibold">{r.name}</p>
                  {r.is_system ? <Badge variant="secondary">System</Badge> : null}
                </div>
                <p className="mt-1 text-sm text-muted-foreground">
                  {r.description || "Custom role"}
                </p>
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  {data.permissions.map((p: { id: string; name: string; module: string }) => {
                    const enabled = data.rolePermissions.some(
                      (item: { role_id: string; permission_id: string }) =>
                        item.role_id === r.id && item.permission_id === p.id,
                    );
                    return (
                      <label
                        key={p.id}
                        className="flex cursor-pointer items-center gap-2 rounded-lg border p-2 text-xs"
                      >
                        <Checkbox
                          checked={enabled}
                          onCheckedChange={(checked) =>
                            void togglePermission(r.id, p.id, Boolean(checked))
                          }
                        />
                        <span>{p.name}</span>
                      </label>
                    );
                  })}
                </div>
              </div>
            ),
          )}
        </CardContent>
      </Card>
      <Dialog
        open={Boolean(editingUser)}
        onOpenChange={(open) => {
          if (!open) setEditingUser(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit system user</DialogTitle>
            <DialogDescription>Update identity, role and access status.</DialogDescription>
          </DialogHeader>
          {editingUser ? (
            <div className="space-y-4">
              <Field
                label="Full name"
                value={editingUser.full_name}
                onChange={(v) => setEditingUser((old) => (old ? { ...old, full_name: v } : old))}
              />
              <Field
                label="Email"
                type="email"
                value={editingUser.email}
                onChange={(v) => setEditingUser((old) => (old ? { ...old, email: v } : old))}
              />
              <div className="space-y-2">
                <Label>Role</Label>
                <Select
                  value={editingUser.role_id || "none"}
                  disabled={editingUser.id === data.currentUserId}
                  onValueChange={(v) =>
                    setEditingUser((old) =>
                      old ? { ...old, role_id: v === "none" ? "" : v } : old,
                    )
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No role</SelectItem>
                    {data.roles.map((r: { id: string; name: string }) => (
                      <SelectItem key={r.id} value={r.id}>
                        {r.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Field
                label="New password (optional)"
                type="password"
                value={editingUser.password}
                placeholder="Leave blank to keep the current password"
                onChange={(v) => setEditingUser((old) => (old ? { ...old, password: v } : old))}
              />
              <div className="space-y-2">
                <Label>Status</Label>
                <Select
                  value={editingUser.status}
                  disabled={editingUser.id === data.currentUserId}
                  onValueChange={(v) =>
                    setEditingUser((old) => (old ? { ...old, status: v } : old))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="invited">Invited</SelectItem>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="suspended">Suspended</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button onClick={() => void updateUser()}>Save user changes</Button>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
