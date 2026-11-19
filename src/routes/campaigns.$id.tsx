import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState, type SetStateAction } from "react";
import {
  AlertCircle,
  ArrowDown,
  BarChart3,
  CalendarClock,
  Check,
  CheckCircle2,
  Clock3,
  ExternalLink,
  FileUp,
  ListChecks,
  Mail,
  MapPin,
  Paperclip,
  Pause,
  Phone,
  Play,
  Plus,
  Search,
  Send,
  ShieldCheck,
  Trash2,
  UserCheck,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import {
  addCampaignAudience,
  changeCampaignStatus,
  getCampaignWorkspace,
  removeCampaignRecipient,
  runCampaignQueue,
  resolveCampaignDelivery,
  saveCampaignSequence,
  suppressEmail,
  updateCampaign,
  type CampaignStepInput,
} from "@/lib/campaign.functions";
import { BASE_PLACEHOLDERS } from "@/lib/personalize";
import { AppShell } from "@/components/AppShell";
import { CampaignTypeSelect } from "@/components/CampaignTypeSelect";
import { ConfirmAction } from "@/components/ConfirmAction";
import { RichEmailEditor } from "@/components/RichEmailEditor";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";

export const Route = createFileRoute("/campaigns/$id")({
  head: () => ({
    meta: [
      { title: "Campaign workspace | Gwero OS" },
      {
        name: "description",
        content: "Build, approve, run and measure a contact-level campaign sequence.",
      },
    ],
  }),
  component: CampaignDetail,
});

type Attachment = { path: string; name: string; type?: string; size?: number };
type Campaign = {
  id: string;
  name: string;
  campaign_type: string;
  objective: string | null;
  mailbox_id: string | null;
  owner_id: string | null;
  status: string;
  approval_required: boolean;
  approved_at: string | null;
  approved_by: string | null;
  approver_name: string | null;
  scheduled_at: string | null;
  timezone: string;
  daily_limit: number;
  stop_on_reply: boolean;
  stop_on_bounce: boolean;
  track_opens: boolean;
  track_clicks: boolean;
  cc: string[];
  bcc: string[];
  attachments: Attachment[];
};
type Step = CampaignStepInput & { id: string; step_order: number };
type Contact = {
  id: string;
  prospect_id: string;
  first_name: string | null;
  last_name: string | null;
  email: string;
  phone: string | null;
  job_title: string | null;
  contact_location: string | null;
  contact_location_source_url: string | null;
  location_is_inferred: number;
  company_location: string | null;
  company_location_source_url: string | null;
  company_locations: string | null;
  company: string | null;
  category_id: string | null;
  category_name: string | null;
  is_primary: number;
  suppressed: number;
  suppression_reason: string | null;
  selected: number;
};
type Recipient = Contact & {
  status: string;
  error: string | null;
  current_step: number;
  sent_at: string | null;
  opened_at: string | null;
  open_count: number;
  clicked_at: string | null;
  click_count: number;
  replied_at: string | null;
  converted_at: string | null;
  stopped_reason: string | null;
};
type CampaignEvent = {
  id: string;
  event_type: string;
  detail: string | null;
  actor_name: string | null;
  created_at: string;
};
type Workspace = {
  campaign: Campaign;
  steps: Array<{
    id: string;
    step_order: number;
    step_type: "email" | "task";
    name: string;
    delay_amount: number;
    delay_unit: "minutes" | "hours" | "days";
    subject: string | null;
    body_html: string | null;
    attachments: Attachment[] | string | null;
    task_instructions: string | null;
  }>;
  recipients: Recipient[];
  contacts: Contact[];
  events: CampaignEvent[];
  mailboxes: Array<{
    id: string;
    name: string;
    from_email: string;
    provider: string;
    last_status: string | null;
  }>;
  users: Array<{ id: string; full_name: string; email: string }>;
  currentUser: { id: string; permissions: string[] };
};

const statusTone: Record<string, string> = {
  draft: "bg-slate-100 text-slate-700",
  in_review: "bg-amber-100 text-amber-800",
  approved: "bg-blue-100 text-blue-800",
  scheduled: "bg-violet-100 text-violet-800",
  running: "bg-emerald-100 text-emerald-800",
  paused: "bg-orange-100 text-orange-800",
  completed: "bg-primary/10 text-primary",
};

const blankForm = {
  name: "",
  campaignType: "outreach",
  objective: "",
  mailboxId: "",
  ownerId: "",
  dailyLimit: 100,
  timezone: "Africa/Blantyre",
  approvalRequired: true,
  stopOnReply: true,
  stopOnBounce: true,
  trackOpens: true,
  trackClicks: true,
  cc: "",
  bcc: "",
};

const EMPTY_RECIPIENTS: Recipient[] = [];

function personName(person: Pick<Contact, "first_name" | "last_name">) {
  return [person.first_name, person.last_name].filter(Boolean).join(" ") || "Unnamed contact";
}

function percent(value: number, total: number) {
  return total ? `${Math.round((value / total) * 100)}%` : "0%";
}

function CampaignDetail() {
  const { id } = Route.useParams();
  const qc = useQueryClient();
  const [activeTab, setActiveTab] = useState("overview");
  const [form, setForm] = useState(blankForm);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [steps, setSteps] = useState<Step[]>([]);
  const [formDirty, setFormDirty] = useState(false);
  const [attachmentsDirty, setAttachmentsDirty] = useState(false);
  const [stepsDirty, setStepsDirty] = useState(false);
  const [contactSearch, setContactSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [scheduledAt, setScheduledAt] = useState("");
  const { data, isLoading } = useQuery({
    queryKey: ["campaign-workspace", id],
    queryFn: () => getCampaignWorkspace({ data: { campaignId: id } }) as Promise<Workspace>,
    refetchInterval: 15_000,
  });

  useEffect(() => {
    if (!data) return;
    const campaign = data.campaign;
    if (!formDirty) {
      setForm({
        name: campaign.name,
        campaignType: campaign.campaign_type,
        objective: campaign.objective || "",
        mailboxId: campaign.mailbox_id || "",
        ownerId: campaign.owner_id || "",
        dailyLimit: campaign.daily_limit,
        timezone: campaign.timezone,
        approvalRequired: campaign.approval_required,
        stopOnReply: campaign.stop_on_reply,
        stopOnBounce: campaign.stop_on_bounce,
        trackOpens: campaign.track_opens,
        trackClicks: campaign.track_clicks,
        cc: (campaign.cc || []).join(", "),
        bcc: (campaign.bcc || []).join(", "),
      });
    }
    if (!attachmentsDirty) setAttachments(campaign.attachments || []);
    if (!stepsDirty) {
      setSteps(
        data.steps.map((step) => ({
          id: step.id,
          step_order: step.step_order,
          stepType: step.step_type,
          name: step.name,
          delayAmount: step.delay_amount,
          delayUnit: step.delay_unit,
          subject: step.subject || "",
          bodyHtml: step.body_html || "",
          attachments:
            typeof step.attachments === "string"
              ? (JSON.parse(step.attachments || "[]") as Attachment[])
              : step.attachments || [],
          taskInstructions: step.task_instructions || "",
        })),
      );
    }
  }, [attachmentsDirty, data, formDirty, stepsDirty]);

  const updateForm = (update: SetStateAction<typeof form>) => {
    setForm(update);
    setFormDirty(true);
  };
  const updateAttachments = (update: SetStateAction<Attachment[]>) => {
    setAttachments(update);
    setAttachmentsDirty(true);
  };
  const updateSteps = (update: SetStateAction<Step[]>) => {
    setSteps(update);
    setStepsDirty(true);
  };

  const refresh = () => qc.invalidateQueries({ queryKey: ["campaign-workspace", id] });
  const saveSetup = useMutation({
    mutationFn: () =>
      updateCampaign({
        data: {
          campaignId: id,
          ...form,
          cc: form.cc
            .split(",")
            .map((item) => item.trim())
            .filter(Boolean),
          bcc: form.bcc
            .split(",")
            .map((item) => item.trim())
            .filter(Boolean),
          attachments,
        },
      }),
    onSuccess: async () => {
      toast.success("Campaign settings saved.");
      await refresh();
      setFormDirty(false);
      setAttachmentsDirty(false);
    },
    onError: (error: Error) => toast.error(error.message),
  });
  const saveSequence = useMutation({
    mutationFn: () =>
      saveCampaignSequence({
        data: {
          campaignId: id,
          steps: steps.map(({ step_order: _order, ...step }) => step),
        },
      }),
    onSuccess: async () => {
      toast.success("Sequence saved.");
      await refresh();
      setStepsDirty(false);
    },
    onError: (error: Error) => toast.error(error.message),
  });
  const addAudience = useMutation({
    mutationFn: () => addCampaignAudience({ data: { campaignId: id, contactIds: [...selected] } }),
    onSuccess: ({ added, skipped }) => {
      toast.success(`${added} contacts enrolled${skipped ? `, ${skipped} skipped` : ""}.`);
      setSelected(new Set());
      void refresh();
    },
    onError: (error: Error) => toast.error(error.message),
  });
  const removeRecipient = useMutation({
    mutationFn: (recipientId: string) =>
      removeCampaignRecipient({ data: { campaignId: id, recipientId } }),
    onSuccess: () => {
      toast.success("Contact removed from this campaign.");
      void refresh();
    },
    onError: (error: Error) => toast.error(error.message),
  });
  const statusChange = useMutation({
    mutationFn: (input: {
      action: "submit" | "approve" | "start" | "schedule" | "pause" | "resume";
      scheduledAt?: string;
    }) => changeCampaignStatus({ data: { campaignId: id, ...input } }),
    onSuccess: (_result, input) => {
      toast.success(
        input.action === "start"
          ? "Campaign started and due messages processed."
          : `Campaign ${input.action.replace("submit", "submitted")}.`,
      );
      setScheduleOpen(false);
      void refresh();
    },
    onError: (error: Error) => toast.error(error.message),
  });
  const processQueue = useMutation({
    mutationFn: () => runCampaignQueue({ data: { campaignId: id } }),
    onSuccess: ({ processed, failed }) => {
      toast.success(`${processed} due actions processed${failed ? `, ${failed} failed` : ""}.`);
      void refresh();
    },
    onError: (error: Error) => toast.error(error.message),
  });
  const suppress = useMutation({
    mutationFn: (recipient: Recipient) =>
      suppressEmail({
        data: { campaignId: id, email: recipient.email, reason: "Manual suppression" },
      }),
    onSuccess: () => {
      toast.success("Email suppressed from future sends.");
      void refresh();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const categories = useMemo(
    () =>
      Array.from(
        new Map(
          (data?.contacts || [])
            .filter((contact) => contact.category_id)
            .map((contact) => [contact.category_id, contact.category_name || "Other"]),
        ).entries(),
      ),
    [data?.contacts],
  );
  const availableContacts = useMemo(() => {
    const needle = contactSearch.trim().toLowerCase();
    return (data?.contacts || []).filter(
      (contact) =>
        !contact.selected &&
        (category === "all" || contact.category_id === category) &&
        (!needle ||
          personName(contact).toLowerCase().includes(needle) ||
          contact.company?.toLowerCase().includes(needle) ||
          contact.email.toLowerCase().includes(needle) ||
          contact.phone?.toLowerCase().includes(needle) ||
          contact.job_title?.toLowerCase().includes(needle) ||
          contact.contact_location?.toLowerCase().includes(needle) ||
          contact.company_locations?.toLowerCase().includes(needle)),
    );
  }, [category, contactSearch, data?.contacts]);
  const campaign = data?.campaign;
  const resolveDelivery = useMutation({
    mutationFn: ({
      recipientId,
      outcome,
    }: {
      recipientId: string;
      outcome: "delivered" | "not_delivered";
    }) => resolveCampaignDelivery({ data: { campaignId: id, recipientId, outcome } }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["campaign-workspace", id] });
      toast.success("Delivery review saved.");
    },
    onError: (error: Error) => toast.error(error.message),
  });
  const recipients = data?.recipients ?? EMPTY_RECIPIENTS;
  const stats = useMemo(
    () => ({
      total: recipients.length,
      reached: recipients.filter((item) => item.sent_at).length,
      opened: recipients.filter((item) => item.open_count > 0).length,
      clicked: recipients.filter((item) => item.click_count > 0).length,
      replied: recipients.filter((item) => item.replied_at).length,
      converted: recipients.filter((item) => item.converted_at).length,
      failed: recipients.filter((item) => item.status === "failed").length,
    }),
    [recipients],
  );
  const editable = campaign ? ["draft", "in_review", "approved"].includes(campaign.status) : false;
  const readiness = {
    setup: Boolean(form.name.trim() && form.objective.trim() && form.mailboxId),
    sequence: Boolean(
      steps.length &&
      steps.every(
        (step) =>
          step.name.trim() &&
          (step.stepType === "email"
            ? step.subject.trim() && step.bodyHtml.trim()
            : step.taskInstructions.trim()),
      ),
    ),
    audience: recipients.length > 0,
    approval: Boolean(!form.approvalRequired || campaign?.approved_at),
  };

  async function uploadFile(file: File) {
    const body = new FormData();
    body.set("campaignId", id);
    body.set("file", file);
    const response = await fetch("/api/attachments/upload", { method: "POST", body });
    const result = (await response.json()) as Attachment & { error?: string };
    if (!response.ok) {
      toast.error(result.error || "Attachment upload failed.");
      return;
    }
    updateAttachments((current) => [...current, result]);
    toast.success("Attachment added. Save the campaign settings to keep it.");
  }

  async function uploadStepFile(stepId: string, file: File) {
    const body = new FormData();
    body.set("campaignId", id);
    body.set("file", file);
    const response = await fetch("/api/attachments/upload", { method: "POST", body });
    const result = (await response.json()) as Attachment & { error?: string };
    if (!response.ok) {
      toast.error(result.error || "Attachment upload failed.");
      return;
    }
    updateSteps((current) =>
      current.map((step) =>
        step.id === stepId ? { ...step, attachments: [...(step.attachments || []), result] } : step,
      ),
    );
    toast.success(`${result.name} attached to this email step.`);
  }

  if (isLoading || !data || !campaign)
    return (
      <AppShell title="Campaign workspace" description="Loading campaign…">
        <div className="h-64 animate-pulse rounded-2xl bg-muted" />
      </AppShell>
    );

  return (
    <AppShell
      title={campaign.name}
      description={
        campaign.objective || "Build the campaign from business objective to conversion."
      }
      actions={
        <div className="flex flex-wrap items-center gap-2">
          <Badge className={statusTone[campaign.status] || ""} variant="secondary">
            {campaign.status.replaceAll("_", " ")}
          </Badge>
          <Button variant="outline" asChild>
            <Link to="/campaigns">Back</Link>
          </Button>
          {campaign.status === "running" ? (
            <Button variant="outline" onClick={() => statusChange.mutate({ action: "pause" })}>
              <Pause className="mr-2 h-4 w-4" /> Pause
            </Button>
          ) : null}
          {campaign.status === "paused" ? (
            <Button onClick={() => statusChange.mutate({ action: "resume" })}>
              <Play className="mr-2 h-4 w-4" /> Resume
            </Button>
          ) : null}
          {campaign.status === "running" ? (
            <Button
              variant="outline"
              onClick={() => processQueue.mutate()}
              disabled={processQueue.isPending}
            >
              Process due now
            </Button>
          ) : null}
        </div>
      }
    >
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="h-auto w-full justify-start overflow-x-auto rounded-xl bg-muted/70 p-1">
          <TabsTrigger value="overview">1. Plan</TabsTrigger>
          <TabsTrigger value="sequence">2. Sequence</TabsTrigger>
          <TabsTrigger value="audience">3. Audience ({recipients.length})</TabsTrigger>
          <TabsTrigger value="review">4. Review & launch</TabsTrigger>
          <TabsTrigger value="results">Results</TabsTrigger>
        </TabsList>

        <TabsContent
          value="overview"
          className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,2fr)_minmax(320px,1fr)]"
        >
          <Card>
            <CardHeader>
              <CardTitle>Campaign plan</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="campaign-name">Campaign name</Label>
                <Input
                  id="campaign-name"
                  disabled={!editable}
                  value={form.name}
                  onChange={(event) =>
                    updateForm((current) => ({ ...current, name: event.target.value }))
                  }
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="campaign-type">Campaign type</Label>
                <CampaignTypeSelect
                  disabled={!editable}
                  value={form.campaignType}
                  triggerId="campaign-type"
                  helperId="campaign-type-help"
                  onValueChange={(campaignType) =>
                    updateForm((current) => ({ ...current, campaignType }))
                  }
                />
              </div>
              <div className="space-y-1.5">
                <Label>Campaign owner</Label>
                <Select
                  disabled={!editable}
                  value={form.ownerId || "unassigned"}
                  onValueChange={(ownerId) =>
                    updateForm((current) => ({
                      ...current,
                      ownerId: ownerId === "unassigned" ? "" : ownerId,
                    }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="unassigned">Unassigned</SelectItem>
                    {data.users.map((user) => (
                      <SelectItem key={user.id} value={user.id}>
                        {user.full_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="campaign-objective">Business objective</Label>
                <Textarea
                  id="campaign-objective"
                  disabled={!editable}
                  rows={4}
                  value={form.objective}
                  onChange={(event) =>
                    updateForm((current) => ({ ...current, objective: event.target.value }))
                  }
                  placeholder="What measurable business result should this campaign create?"
                />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label>Sending account</Label>
                <Select
                  disabled={!editable}
                  value={form.mailboxId || "none"}
                  onValueChange={(mailboxId) =>
                    updateForm((current) => ({
                      ...current,
                      mailboxId: mailboxId === "none" ? "" : mailboxId,
                    }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a verified sending account" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Not selected</SelectItem>
                    {data.mailboxes.map((mailbox) => (
                      <SelectItem key={mailbox.id} value={mailbox.id}>
                        {mailbox.name} · {mailbox.from_email}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="daily-limit">Daily sending limit</Label>
                <Input
                  id="daily-limit"
                  disabled={!editable}
                  type="number"
                  min={1}
                  max={5000}
                  value={form.dailyLimit}
                  onChange={(event) =>
                    updateForm((current) => ({
                      ...current,
                      dailyLimit: Number(event.target.value),
                    }))
                  }
                />
              </div>
              <div className="space-y-1.5">
                <Label>Timezone</Label>
                <Select
                  disabled={!editable}
                  value={form.timezone}
                  onValueChange={(timezone) => updateForm((current) => ({ ...current, timezone }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Africa/Blantyre">Africa/Blantyre</SelectItem>
                    <SelectItem value="Africa/Johannesburg">Africa/Johannesburg</SelectItem>
                    <SelectItem value="Africa/Lusaka">Africa/Lusaka</SelectItem>
                    <SelectItem value="UTC">UTC</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="campaign-cc">CC addresses</Label>
                <Input
                  id="campaign-cc"
                  disabled={!editable}
                  value={form.cc}
                  onChange={(event) =>
                    updateForm((current) => ({ ...current, cc: event.target.value }))
                  }
                  placeholder="Comma separated"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="campaign-bcc">BCC addresses</Label>
                <Input
                  id="campaign-bcc"
                  disabled={!editable}
                  value={form.bcc}
                  onChange={(event) =>
                    updateForm((current) => ({ ...current, bcc: event.target.value }))
                  }
                  placeholder="Comma separated"
                />
              </div>
              <div className="sm:col-span-2 flex justify-end">
                <Button
                  disabled={!editable || saveSetup.isPending}
                  onClick={() => saveSetup.mutate()}
                >
                  {saveSetup.isPending ? "Saving…" : "Save campaign plan"}
                </Button>
              </div>
            </CardContent>
          </Card>

          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Safety and tracking</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {(
                  [
                    [
                      "approvalRequired",
                      "Require approval",
                      "A reviewer must approve before launch.",
                    ],
                    [
                      "stopOnReply",
                      "Stop when a contact replies",
                      "Prevents inappropriate follow-ups.",
                    ],
                    ["stopOnBounce", "Stop after a bounce", "Protects sender reputation."],
                    ["trackOpens", "Track opens", "Adds an invisible tracking image."],
                    ["trackClicks", "Track clicks", "Routes links through campaign tracking."],
                  ] as const
                ).map(([key, label, description]) => (
                  <div
                    key={key}
                    className="flex items-center justify-between gap-4 rounded-xl border p-3"
                  >
                    <div>
                      <Label>{label}</Label>
                      <p className="text-xs text-muted-foreground">{description}</p>
                    </div>
                    <Switch
                      disabled={!editable}
                      checked={Boolean(form[key])}
                      onCheckedChange={(checked) =>
                        updateForm((current) => ({ ...current, [key]: checked }))
                      }
                    />
                  </div>
                ))}
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Campaign attachments</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Label className="flex cursor-pointer items-center justify-center rounded-xl border border-dashed p-4 text-sm text-muted-foreground hover:border-primary hover:text-primary">
                  <FileUp className="mr-2 h-4 w-4" /> Upload attachment
                  <input
                    className="hidden"
                    disabled={!editable}
                    type="file"
                    aria-label="Upload campaign attachment"
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      if (file) void uploadFile(file);
                    }}
                  />
                </Label>
                {attachments.map((attachment) => (
                  <div
                    key={attachment.path}
                    className="flex items-center justify-between rounded-lg bg-muted/60 px-3 py-2 text-sm"
                  >
                    <span className="truncate">{attachment.name}</span>
                    <Button
                      size="icon"
                      variant="ghost"
                      disabled={!editable}
                      onClick={() =>
                        updateAttachments((current) =>
                          current.filter((item) => item.path !== attachment.path),
                        )
                      }
                      aria-label={`Remove ${attachment.name}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="sequence" className="mt-6 space-y-5">
          <Card>
            <CardHeader className="gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <CardTitle>Contact sequence</CardTitle>
                <p className="mt-1 text-sm text-muted-foreground">
                  Mix personalised emails with internal follow-up tasks. Delays apply before each
                  step.
                </p>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  disabled={!editable}
                  onClick={() =>
                    updateSteps((current) => [
                      ...current,
                      {
                        id: crypto.randomUUID(),
                        step_order: current.length + 1,
                        stepType: "task",
                        name: "Follow-up task",
                        delayAmount: 2,
                        delayUnit: "days",
                        subject: "",
                        bodyHtml: "",
                        attachments: [],
                        taskInstructions: "Call the contact and record the outcome.",
                      },
                    ])
                  }
                >
                  <Plus className="mr-2 h-4 w-4" /> Task
                </Button>
                <Button
                  disabled={!editable}
                  onClick={() =>
                    updateSteps((current) => [
                      ...current,
                      {
                        id: crypto.randomUUID(),
                        step_order: current.length + 1,
                        stepType: "email",
                        name: `Follow-up email ${current.filter((step) => step.stepType === "email").length + 1}`,
                        delayAmount: current.length ? 3 : 0,
                        delayUnit: "days",
                        subject: "",
                        bodyHtml: "",
                        attachments: [],
                        taskInstructions: "",
                      },
                    ])
                  }
                >
                  <Plus className="mr-2 h-4 w-4" /> Email
                </Button>
              </div>
            </CardHeader>
          </Card>
          {steps.map((step, index) => (
            <div key={step.id}>
              {index ? (
                <div className="flex h-12 items-center justify-center text-muted-foreground">
                  <ArrowDown className="h-5 w-5" />
                  <span className="ml-2 text-xs">
                    Wait {step.delayAmount} {step.delayUnit}
                  </span>
                </div>
              ) : null}
              <Card>
                <CardHeader className="gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-center gap-3">
                    <span className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 font-semibold text-primary">
                      {index + 1}
                    </span>
                    <div>
                      <CardTitle className="text-base">
                        {step.stepType === "email" ? (
                          <Mail className="mr-2 inline h-4 w-4" />
                        ) : (
                          <ListChecks className="mr-2 inline h-4 w-4" />
                        )}
                        {step.name || `Step ${index + 1}`}
                      </CardTitle>
                      <p className="text-xs text-muted-foreground">
                        {step.stepType === "email"
                          ? "Customer-facing email"
                          : "Internal action for the campaign owner"}
                      </p>
                    </div>
                  </div>
                  <ConfirmAction
                    title="Remove this sequence step?"
                    description="The other steps will be renumbered automatically."
                    onConfirm={() =>
                      updateSteps((current) =>
                        current
                          .filter((item) => item.id !== step.id)
                          .map((item, itemIndex) => ({ ...item, step_order: itemIndex + 1 })),
                      )
                    }
                    trigger={
                      <Button
                        size="icon"
                        variant="ghost"
                        disabled={!editable}
                        aria-label={`Remove step ${index + 1}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    }
                  />
                </CardHeader>
                <CardContent className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label>Step name</Label>
                    <Input
                      disabled={!editable}
                      value={step.name}
                      onChange={(event) =>
                        updateSteps((current) =>
                          current.map((item) =>
                            item.id === step.id ? { ...item, name: event.target.value } : item,
                          ),
                        )
                      }
                    />
                  </div>
                  <div className="grid grid-cols-[1fr_1.4fr] gap-2">
                    <div className="space-y-1.5">
                      <Label>Wait before</Label>
                      <Input
                        disabled={!editable || index === 0}
                        type="number"
                        min={0}
                        value={index === 0 ? 0 : step.delayAmount}
                        onChange={(event) =>
                          updateSteps((current) =>
                            current.map((item) =>
                              item.id === step.id
                                ? { ...item, delayAmount: Number(event.target.value) }
                                : item,
                            ),
                          )
                        }
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Unit</Label>
                      <Select
                        disabled={!editable || index === 0}
                        value={step.delayUnit}
                        onValueChange={(delayUnit: "minutes" | "hours" | "days") =>
                          updateSteps((current) =>
                            current.map((item) =>
                              item.id === step.id ? { ...item, delayUnit } : item,
                            ),
                          )
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="minutes">Minutes</SelectItem>
                          <SelectItem value="hours">Hours</SelectItem>
                          <SelectItem value="days">Days</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  {step.stepType === "email" ? (
                    <>
                      <div className="space-y-1.5 sm:col-span-2">
                        <Label>Email subject</Label>
                        <Input
                          disabled={!editable}
                          value={step.subject}
                          onChange={(event) =>
                            updateSteps((current) =>
                              current.map((item) =>
                                item.id === step.id
                                  ? { ...item, subject: event.target.value }
                                  : item,
                              ),
                            )
                          }
                          placeholder="A quick idea for {{company}}"
                        />
                      </div>
                      <div className="space-y-1.5 sm:col-span-2">
                        <Label>Email message</Label>
                        <RichEmailEditor
                          disabled={!editable}
                          value={step.bodyHtml}
                          ariaLabel={`Email message for step ${index + 1}`}
                          onChange={(bodyHtml) =>
                            updateSteps((current) =>
                              current.map((item) =>
                                item.id === step.id ? { ...item, bodyHtml } : item,
                              ),
                            )
                          }
                        />
                        <div className="flex flex-wrap gap-1.5 pt-1">
                          {BASE_PLACEHOLDERS.map((placeholder) => (
                            <Badge
                              key={placeholder}
                              variant="secondary"
                            >{`{{${placeholder}}}`}</Badge>
                          ))}
                        </div>
                        <div className="mt-4 rounded-xl border bg-muted/20 p-3">
                          <div className="flex flex-wrap items-center justify-between gap-3">
                            <div>
                              <p className="text-sm font-medium">Email attachments</p>
                              <p className="text-xs text-muted-foreground">
                                These files are sent only with this step. Maximum 20 MB per file.
                              </p>
                            </div>
                            <Label className="inline-flex cursor-pointer items-center rounded-lg border bg-white px-3 py-2 text-sm font-medium hover:border-primary hover:text-primary">
                              <Paperclip className="mr-2 size-4" /> Attach file
                              <input
                                className="hidden"
                                type="file"
                                disabled={!editable}
                                aria-label={`Attach a file to step ${index + 1}`}
                                onChange={(event) => {
                                  const file = event.target.files?.[0];
                                  if (file) void uploadStepFile(step.id, file);
                                  event.target.value = "";
                                }}
                              />
                            </Label>
                          </div>
                          <div className="mt-3 space-y-2">
                            {(step.attachments || []).map((attachment) => (
                              <div
                                key={attachment.path}
                                className="flex items-center justify-between gap-3 rounded-lg bg-white px-3 py-2 text-sm"
                              >
                                <span className="min-w-0 truncate">
                                  <Paperclip className="mr-2 inline size-4 text-muted-foreground" />
                                  {attachment.name}
                                </span>
                                <Button
                                  type="button"
                                  size="icon"
                                  variant="ghost"
                                  disabled={!editable}
                                  aria-label={`Remove ${attachment.name} from step ${index + 1}`}
                                  onClick={() =>
                                    updateSteps((current) =>
                                      current.map((item) =>
                                        item.id === step.id
                                          ? {
                                              ...item,
                                              attachments: (item.attachments || []).filter(
                                                (file) => file.path !== attachment.path,
                                              ),
                                            }
                                          : item,
                                      ),
                                    )
                                  }
                                >
                                  <Trash2 className="size-4" />
                                </Button>
                              </div>
                            ))}
                            {!step.attachments?.length ? (
                              <p className="py-2 text-xs text-muted-foreground">
                                No files attached to this email.
                              </p>
                            ) : null}
                          </div>
                        </div>
                      </div>
                    </>
                  ) : (
                    <div className="space-y-1.5 sm:col-span-2">
                      <Label>Task instructions</Label>
                      <Textarea
                        disabled={!editable}
                        rows={5}
                        value={step.taskInstructions}
                        onChange={(event) =>
                          updateSteps((current) =>
                            current.map((item) =>
                              item.id === step.id
                                ? { ...item, taskInstructions: event.target.value }
                                : item,
                            ),
                          )
                        }
                        placeholder="What should the campaign owner do and record?"
                      />
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          ))}
          {!steps.length ? (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                Add the first email or internal task to build this sequence.
              </CardContent>
            </Card>
          ) : null}
          <div className="flex justify-end">
            <Button
              disabled={!editable || !steps.length || saveSequence.isPending}
              onClick={() => saveSequence.mutate()}
            >
              {saveSequence.isPending ? "Saving…" : "Save sequence"}
            </Button>
          </div>
        </TabsContent>

        <TabsContent value="audience" className="mt-4 space-y-4">
          <Tabs defaultValue="eligible" className="space-y-4">
            <TabsList className="grid w-full max-w-xl grid-cols-2">
              <TabsTrigger value="eligible">
                Find eligible contacts ({availableContacts.length})
              </TabsTrigger>
              <TabsTrigger value="enrolled">Enrolled audience ({recipients.length})</TabsTrigger>
            </TabsList>
            <TabsContent value="eligible" className="mt-0">
              <Card>
                <CardHeader>
                  <CardTitle>Find eligible contact people</CardTitle>
                  <p className="text-sm text-muted-foreground">
                    Campaigns target people, not a generic company record. Suppressed contacts
                    cannot be enrolled.
                  </p>
                </CardHeader>
                <CardContent>
                  <div className="mb-4 grid gap-3 sm:grid-cols-[minmax(0,1fr)_240px_auto]">
                    <div className="relative">
                      <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                      <Input
                        className="pl-9"
                        value={contactSearch}
                        onChange={(event) => setContactSearch(event.target.value)}
                        placeholder="Search name, company, email, phone, position or location"
                      />
                    </div>
                    <Select value={category} onValueChange={setCategory}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All categories</SelectItem>
                        {categories.map(([categoryId, name]) => (
                          <SelectItem key={categoryId} value={categoryId!}>
                            {name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button
                      disabled={!editable || !selected.size || addAudience.isPending}
                      onClick={() => addAudience.mutate()}
                    >
                      <UserCheck className="mr-2 h-4 w-4" /> Enrol {selected.size || "selected"}
                    </Button>
                  </div>
                  <div className="h-[480px] overflow-auto rounded-xl border">
                    <div className="sticky top-0 z-10 grid grid-cols-[42px_minmax(180px,1fr)_minmax(180px,1fr)_150px] gap-3 border-b bg-background px-4 py-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      <Checkbox
                        aria-label="Select all visible contacts"
                        disabled={!editable}
                        checked={
                          availableContacts.filter((item) => !item.suppressed).length > 0 &&
                          availableContacts
                            .filter((item) => !item.suppressed)
                            .every((item) => selected.has(item.id))
                        }
                        onCheckedChange={(checked) =>
                          setSelected(
                            checked
                              ? new Set(
                                  availableContacts
                                    .filter((item) => !item.suppressed)
                                    .map((item) => item.id),
                                )
                              : new Set(),
                          )
                        }
                      />
                      <span>Contact</span>
                      <span>Company</span>
                      <span>Eligibility</span>
                    </div>
                    {availableContacts.slice(0, 500).map((contact) => (
                      <div
                        key={contact.id}
                        className="grid grid-cols-[42px_minmax(180px,1fr)_minmax(180px,1fr)_150px] gap-3 border-b px-4 py-3 text-sm last:border-0"
                      >
                        <Checkbox
                          disabled={!editable || Boolean(contact.suppressed)}
                          checked={selected.has(contact.id)}
                          onCheckedChange={(checked) =>
                            setSelected((current) => {
                              const next = new Set(current);
                              if (checked) next.add(contact.id);
                              else next.delete(contact.id);
                              return next;
                            })
                          }
                          aria-label={`Select ${personName(contact)}`}
                        />
                        <div className="min-w-0">
                          <p className="truncate font-medium">{personName(contact)}</p>
                          <p className="truncate text-xs text-muted-foreground">{contact.email}</p>
                          <p className="flex items-center gap-1 truncate text-xs text-muted-foreground">
                            <Phone className="h-3 w-3 shrink-0" aria-hidden="true" />
                            {contact.phone || "Phone number not supplied"}
                          </p>
                          {contact.contact_location_source_url ? (
                            <a
                              href={contact.contact_location_source_url}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                            >
                              Contact location source <ExternalLink className="size-3" />
                            </a>
                          ) : null}
                          <p className="truncate text-xs text-muted-foreground">
                            {contact.job_title || "Position not supplied"}
                          </p>
                          <p className="flex items-center gap-1 truncate text-xs text-muted-foreground">
                            <MapPin className="h-3 w-3 shrink-0" aria-hidden="true" />
                            {contact.contact_location || "Contact location not supplied"}
                            {contact.location_is_inferred ? " · company-based" : ""}
                          </p>
                        </div>
                        <div className="min-w-0">
                          <p className="truncate">{contact.company || "Company not supplied"}</p>
                          <p className="truncate text-xs text-muted-foreground">
                            {contact.category_name || "Uncategorised"}
                          </p>
                          <p
                            className="flex items-center gap-1 truncate text-xs text-muted-foreground"
                            title={contact.company_locations || undefined}
                          >
                            <MapPin className="h-3 w-3 shrink-0" aria-hidden="true" />
                            {contact.company_location || "Company location not supplied"}
                          </p>
                          {contact.company_location_source_url ? (
                            <a
                              href={contact.company_location_source_url}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                            >
                              Company location source <ExternalLink className="size-3" />
                            </a>
                          ) : null}
                        </div>
                        <div>
                          {contact.suppressed ? (
                            <Badge variant="destructive">Suppressed</Badge>
                          ) : (
                            <Badge className="bg-emerald-100 text-emerald-800" variant="secondary">
                              Eligible
                            </Badge>
                          )}
                          {contact.suppression_reason ? (
                            <p className="mt-1 text-xs text-muted-foreground">
                              {contact.suppression_reason}
                            </p>
                          ) : null}
                        </div>
                      </div>
                    ))}
                  </div>
                  {availableContacts.length > 500 ? (
                    <p className="mt-2 text-xs text-muted-foreground">
                      Showing the first 500 matches. Narrow the search or category to find more.
                    </p>
                  ) : null}
                </CardContent>
              </Card>
            </TabsContent>
            <TabsContent value="enrolled" className="mt-0">
              <Card>
                <CardHeader>
                  <CardTitle>Enrolled audience ({recipients.length})</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-[480px] space-y-2 overflow-auto rounded-xl border p-2">
                    {recipients.map((recipient) => (
                      <div
                        key={recipient.id}
                        className="grid gap-3 rounded-xl border p-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] sm:items-center"
                      >
                        <div className="min-w-0">
                          <p className="truncate font-medium">{personName(recipient)}</p>
                          <p className="truncate text-xs text-muted-foreground">
                            {recipient.email} · {recipient.job_title || "Position not supplied"}
                          </p>
                          <p className="flex items-center gap-1 truncate text-xs text-muted-foreground">
                            <Phone className="h-3 w-3 shrink-0" aria-hidden="true" />
                            {recipient.phone || "Phone number not supplied"}
                          </p>
                          {recipient.contact_location_source_url ? (
                            <a
                              href={recipient.contact_location_source_url}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                            >
                              Contact location source <ExternalLink className="size-3" />
                            </a>
                          ) : null}
                          <p className="flex items-center gap-1 truncate text-xs text-muted-foreground">
                            <MapPin className="h-3 w-3 shrink-0" aria-hidden="true" />
                            {recipient.contact_location || "Contact location not supplied"}
                            {recipient.location_is_inferred ? " · company-based" : ""}
                          </p>
                        </div>
                        <div className="min-w-0">
                          <p className="truncate text-sm">
                            {recipient.company || "Company not supplied"}
                          </p>
                          <p className="truncate text-xs text-muted-foreground">
                            {recipient.category_name || "Uncategorised"}
                          </p>
                          <p
                            className="flex items-center gap-1 truncate text-xs text-muted-foreground"
                            title={recipient.company_locations || undefined}
                          >
                            <MapPin className="h-3 w-3 shrink-0" aria-hidden="true" />
                            {recipient.company_location || "Company location not supplied"}
                          </p>
                          {recipient.company_location_source_url ? (
                            <a
                              href={recipient.company_location_source_url}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                            >
                              Company location source <ExternalLink className="size-3" />
                            </a>
                          ) : null}
                        </div>
                        <div className="flex items-center justify-end gap-2">
                          <Badge variant="secondary">{recipient.status}</Badge>
                          {editable ? (
                            <ConfirmAction
                              title="Remove this contact?"
                              description="They will no longer be part of this campaign audience."
                              onConfirm={async () => {
                                await removeRecipient.mutateAsync(recipient.id);
                              }}
                              trigger={
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  aria-label={`Remove ${personName(recipient)}`}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              }
                            />
                          ) : null}
                        </div>
                      </div>
                    ))}
                    {!recipients.length ? (
                      <div className="py-6 text-center text-sm text-muted-foreground">
                        No contact people have been enrolled yet.
                      </div>
                    ) : null}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </TabsContent>

        <TabsContent
          value="review"
          className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1.4fr)_minmax(320px,1fr)]"
        >
          <Card>
            <CardHeader>
              <CardTitle>Launch readiness</CardTitle>
              <p className="text-sm text-muted-foreground">
                Every required business control must pass before sending begins.
              </p>
            </CardHeader>
            <CardContent className="space-y-3">
              {[
                [
                  readiness.setup,
                  "Plan and sending account",
                  "A named campaign, objective and verified sender are selected.",
                  "overview",
                ],
                [
                  readiness.sequence,
                  "Contact sequence",
                  `${steps.length} campaign steps configured.`,
                  "sequence",
                ],
                [
                  readiness.audience,
                  "Eligible audience",
                  `${recipients.length} contact people enrolled.`,
                  "audience",
                ],
                [
                  readiness.approval,
                  "Approval",
                  form.approvalRequired
                    ? campaign.approved_at
                      ? `Approved by ${campaign.approver_name || "an authorised user"}.`
                      : "Waiting for an authorised reviewer."
                    : "Approval is not required for this campaign.",
                  "review",
                ],
              ].map(([ready, title, description, tab]) => (
                <button
                  key={String(title)}
                  type="button"
                  onClick={() => setActiveTab(String(tab))}
                  className="flex w-full items-center gap-4 rounded-xl border p-4 text-left hover:bg-muted/40"
                >
                  <span
                    className={`rounded-full p-2 ${ready ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}
                  >
                    {ready ? <Check className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
                  </span>
                  <span>
                    <span className="block font-medium">{String(title)}</span>
                    <span className="block text-sm text-muted-foreground">
                      {String(description)}
                    </span>
                  </span>
                </button>
              ))}
            </CardContent>
          </Card>
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Campaign controls</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {campaign.status === "draft" ? (
                  <Button
                    className="w-full"
                    disabled={
                      !readiness.setup ||
                      !readiness.sequence ||
                      !readiness.audience ||
                      statusChange.isPending
                    }
                    onClick={() => statusChange.mutate({ action: "submit" })}
                  >
                    <ShieldCheck className="mr-2 h-4 w-4" />{" "}
                    {form.approvalRequired ? "Submit for approval" : "Mark ready"}
                  </Button>
                ) : null}
                {campaign.status === "in_review" &&
                data.currentUser.permissions.includes("campaigns.approve") ? (
                  <Button
                    className="w-full"
                    onClick={() => statusChange.mutate({ action: "approve" })}
                  >
                    <CheckCircle2 className="mr-2 h-4 w-4" /> Approve campaign
                  </Button>
                ) : null}
                {campaign.status === "in_review" &&
                !data.currentUser.permissions.includes("campaigns.approve") ? (
                  <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                    Waiting for a user with campaign approval permission.
                  </div>
                ) : null}
                {["approved", "scheduled"].includes(campaign.status) ? (
                  <>
                    <ConfirmAction
                      title="Start this campaign now?"
                      description="Due contact actions will begin immediately. Later steps will follow their configured delays."
                      confirmLabel="Start campaign"
                      onConfirm={async () => {
                        await statusChange.mutateAsync({ action: "start" });
                      }}
                      trigger={
                        <Button className="w-full">
                          <Play className="mr-2 h-4 w-4" /> Start now
                        </Button>
                      }
                    />
                    <Button
                      className="w-full"
                      variant="outline"
                      onClick={() => setScheduleOpen(true)}
                    >
                      <CalendarClock className="mr-2 h-4 w-4" /> Schedule start
                    </Button>
                  </>
                ) : null}
                {campaign.status === "running" ? (
                  <Button
                    className="w-full"
                    variant="outline"
                    onClick={() => statusChange.mutate({ action: "pause" })}
                  >
                    <Pause className="mr-2 h-4 w-4" /> Pause campaign
                  </Button>
                ) : null}
                {campaign.status === "paused" ? (
                  <Button
                    className="w-full"
                    onClick={() => statusChange.mutate({ action: "resume" })}
                  >
                    <Play className="mr-2 h-4 w-4" /> Resume campaign
                  </Button>
                ) : null}
                {campaign.status === "completed" ? (
                  <div className="rounded-xl bg-emerald-50 p-4 text-sm text-emerald-800">
                    <CheckCircle2 className="mr-2 inline h-4 w-4" />
                    This sequence has completed.
                  </div>
                ) : null}
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Audit trail</CardTitle>
              </CardHeader>
              <CardContent className="max-h-80 space-y-3 overflow-auto">
                {data.events.map((item) => (
                  <div key={item.id} className="border-l-2 border-primary/30 pl-3">
                    <p className="text-sm font-medium">{item.event_type.replaceAll(".", " ")}</p>
                    <p className="text-xs text-muted-foreground">
                      {item.actor_name || "System"} · {new Date(item.created_at).toLocaleString()}
                    </p>
                    {item.detail ? (
                      <p className="mt-1 text-xs text-muted-foreground">{item.detail}</p>
                    ) : null}
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="results" className="mt-4 space-y-4">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-6">
            {(
              [
                ["Audience", stats.total, Users],
                ["Reached", stats.reached, Send],
                ["Opened", percent(stats.opened, stats.reached), Mail],
                ["Clicked", percent(stats.clicked, stats.reached), BarChart3],
                ["Replied", percent(stats.replied, stats.reached), UserCheck],
                ["Converted", stats.converted, CheckCircle2],
              ] as const
            ).map(([label, value, Icon]) => (
              <Card key={String(label)}>
                <CardContent className="p-4">
                  <Icon className="h-4 w-4 text-primary" />
                  <p className="mt-3 text-xs uppercase tracking-wide text-muted-foreground">
                    {String(label)}
                  </p>
                  <MetricValue className="font-display" value={value} maxSize={1.5} />
                </CardContent>
              </Card>
            ))}
          </div>
          {stats.failed ? (
            <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
              <AlertCircle className="mr-2 inline h-4 w-4" />
              {stats.failed} contact actions failed. Review the details below and process the queue
              again after correcting the cause.
            </div>
          ) : null}
          <Card>
            <CardHeader>
              <CardTitle>Contact outcomes</CardTitle>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <div className="min-w-[900px]">
                <div className="grid grid-cols-[1.6fr_1.4fr_100px_80px_80px_100px_120px] gap-3 border-b px-3 py-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  <span>Contact</span>
                  <span>Company</span>
                  <span>Status</span>
                  <span>Opens</span>
                  <span>Clicks</span>
                  <span>Reply</span>
                  <span>Action</span>
                </div>
                {recipients.map((recipient) => (
                  <div
                    key={recipient.id}
                    className="grid grid-cols-[1.6fr_1.4fr_100px_80px_80px_100px_120px] gap-3 border-b px-3 py-3 text-sm last:border-0"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-medium">{personName(recipient)}</p>
                      <p className="truncate text-xs text-muted-foreground">{recipient.email}</p>
                      <p className="flex items-center gap-1 truncate text-xs text-muted-foreground">
                        <Phone className="h-3 w-3 shrink-0" aria-hidden="true" />
                        {recipient.phone || "Phone number not supplied"}
                      </p>
                      <p className="flex items-center gap-1 truncate text-xs text-muted-foreground">
                        <MapPin className="h-3 w-3 shrink-0" aria-hidden="true" />
                        {recipient.contact_location || "Contact location not supplied"}
                      </p>
                      {recipient.error ? (
                        <p className="truncate text-xs text-destructive" title={recipient.error}>
                          {recipient.error}
                        </p>
                      ) : null}
                    </div>
                    <div className="min-w-0">
                      <p className="truncate">{recipient.company || "—"}</p>
                      <p
                        className="flex items-center gap-1 truncate text-xs text-muted-foreground"
                        title={recipient.company_locations || undefined}
                      >
                        <MapPin className="h-3 w-3 shrink-0" aria-hidden="true" />
                        {recipient.company_location || "Company location not supplied"}
                      </p>
                    </div>
                    <div>
                      <Badge variant={recipient.status === "failed" ? "destructive" : "secondary"}>
                        {recipient.status}
                      </Badge>
                      {recipient.stopped_reason ? (
                        <p className="mt-1 text-xs text-muted-foreground">
                          {recipient.stopped_reason}
                        </p>
                      ) : null}
                    </div>
                    <div>{recipient.open_count || 0}</div>
                    <div>{recipient.click_count || 0}</div>
                    <div>{recipient.replied_at ? "Yes" : "—"}</div>
                    <div>
                      {recipient.status === "uncertain" ? (
                        <div className="mb-2 space-y-2">
                          {(["delivered", "not_delivered"] as const).map((outcome) => (
                            <ConfirmAction
                              key={outcome}
                              title={
                                outcome === "delivered"
                                  ? "Confirm provider accepted this message?"
                                  : "Confirm this message was not delivered?"
                              }
                              description="Check the sending account and provider logs before recording the outcome."
                              onConfirm={() =>
                                resolveDelivery
                                  .mutateAsync({ recipientId: recipient.id, outcome })
                                  .then(() => undefined)
                              }
                              trigger={
                                <Button
                                  size="sm"
                                  variant="outline"
                                  disabled={resolveDelivery.isPending}
                                >
                                  {outcome === "delivered" ? "Delivered" : "Allow retry"}
                                </Button>
                              }
                            />
                          ))}
                        </div>
                      ) : null}
                      {!["stopped", "completed"].includes(recipient.status) ? (
                        <ConfirmAction
                          title="Suppress this email?"
                          description="This address will be stopped in this campaign and excluded from future campaigns."
                          confirmLabel="Suppress"
                          onConfirm={async () => {
                            await suppress.mutateAsync(recipient);
                          }}
                          trigger={
                            <Button size="sm" variant="outline">
                              Suppress
                            </Button>
                          }
                        />
                      ) : (
                        "—"
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={scheduleOpen} onOpenChange={setScheduleOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Schedule campaign start</DialogTitle>
            <DialogDescription>
              The first due actions will run at this time. Later steps follow their configured
              delays.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5 py-3">
            <Label htmlFor="scheduled-at">Start date and time</Label>
            <Input
              id="scheduled-at"
              type="datetime-local"
              value={scheduledAt}
              onChange={(event) => setScheduledAt(event.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              <Clock3 className="mr-1 inline h-3.5 w-3.5" />
              Timezone: {form.timezone}
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setScheduleOpen(false)}>
              Cancel
            </Button>
            <Button
              disabled={!scheduledAt || statusChange.isPending}
              onClick={() =>
                statusChange.mutate({
                  action: "schedule",
                  scheduledAt: new Date(scheduledAt).toISOString(),
                })
              }
            >
              Schedule campaign
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
