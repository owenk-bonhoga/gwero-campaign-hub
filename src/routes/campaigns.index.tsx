import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { BarChart3, CalendarClock, MailCheck, Plus, Search, Send, Users } from "lucide-react";
import { toast } from "sonner";
import { createCampaign, deleteCampaign, listCampaigns } from "@/lib/campaign.functions";
import { AppShell } from "@/components/AppShell";
import { CampaignTypeSelect } from "@/components/CampaignTypeSelect";
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
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";

export const Route = createFileRoute("/campaigns/")({
  head: () => ({
    meta: [
      { title: "Campaigns | Gwero OS" },
      {
        name: "description",
        content: "Plan, approve, run and measure contact-level sales campaigns.",
      },
    ],
  }),
  component: CampaignsPage,
});

type CampaignSummary = {
  id: string;
  name: string;
  campaign_type: string;
  objective: string | null;
  status: string;
  owner_name: string | null;
  recipient_count: number;
  reached_count: number;
  replied_count: number;
  converted_count: number;
  scheduled_at: string | null;
};

const statusTone: Record<string, string> = {
  draft: "bg-slate-100 text-slate-700",
  in_review: "bg-amber-100 text-amber-800",
  approved: "bg-blue-100 text-blue-800",
  scheduled: "bg-cyan-100 text-cyan-800",
  running: "bg-emerald-100 text-emerald-800",
  paused: "bg-orange-100 text-orange-800",
  completed: "bg-primary/10 text-primary",
};

function CampaignsPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [createOpen, setCreateOpen] = useState(false);
  const [draft, setDraft] = useState({
    name: "",
    campaignType: "outreach",
    objective: "",
    approvalRequired: true,
  });
  const { data: campaigns = [], isLoading } = useQuery({
    queryKey: ["campaigns", "overview"],
    queryFn: () => listCampaigns() as Promise<CampaignSummary[]>,
  });
  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return campaigns.filter(
      (campaign) =>
        (status === "all" || campaign.status === status) &&
        (!needle ||
          campaign.name.toLowerCase().includes(needle) ||
          campaign.objective?.toLowerCase().includes(needle)),
    );
  }, [campaigns, search, status]);
  const totals = useMemo(
    () => ({
      active: campaigns.filter((item) => ["running", "scheduled"].includes(item.status)).length,
      audience: campaigns.reduce((sum, item) => sum + Number(item.recipient_count || 0), 0),
      reached: campaigns.reduce((sum, item) => sum + Number(item.reached_count || 0), 0),
      replies: campaigns.reduce((sum, item) => sum + Number(item.replied_count || 0), 0),
    }),
    [campaigns],
  );
  const create = useMutation({
    mutationFn: () => createCampaign({ data: draft }),
    onSuccess: async ({ campaignId }) => {
      toast.success("Campaign workspace created.");
      setCreateOpen(false);
      await qc.invalidateQueries({ queryKey: ["campaigns"] });
      await navigate({ to: "/campaigns/$id", params: { id: campaignId } });
    },
    onError: (error: Error) => toast.error(error.message),
  });
  const remove = useMutation({
    mutationFn: (campaignId: string) => deleteCampaign({ data: { campaignId } }),
    onSuccess: () => {
      toast.success("Campaign deleted.");
      void qc.invalidateQueries({ queryKey: ["campaigns"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <AppShell
      title="Campaigns"
      description="Move the right contact people from first touch to qualified conversation."
      actions={
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="mr-2 h-4 w-4" /> New campaign
        </Button>
      }
    >
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {(
          [
            ["Active campaigns", totals.active, Send],
            ["Contacts enrolled", totals.audience, Users],
            ["Contacts reached", totals.reached, MailCheck],
            ["Replies received", totals.replies, BarChart3],
          ] as const
        ).map(([label, value, Icon]) => (
          <Card key={String(label)}>
            <CardContent className="flex items-center justify-between gap-3 p-4">
              <div className="min-w-0 flex-1">
                <p className="text-sm text-muted-foreground">{String(label)}</p>
                <MetricValue className="mt-1 font-display" value={value} maxSize={1.75} />
              </div>
              <span className="rounded-2xl bg-primary/10 p-3 text-primary">
                <Icon className="h-5 w-5" />
              </span>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="mt-4">
        <CardHeader className="gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <CardTitle>Campaign workspace</CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">
              Drafts, approvals, scheduled work and live sequences in one place.
            </p>
          </div>
          <div className="flex w-full flex-col gap-2 sm:flex-row lg:w-auto">
            <div className="relative min-w-64">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                className="pl-9"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search campaigns"
              />
            </div>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger className="w-full sm:w-44">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                {Object.keys(statusTone).map((item) => (
                  <SelectItem key={item} value={item}>
                    {item.replaceAll("_", " ")}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {filtered.map((campaign) => {
            const recipients = Number(campaign.recipient_count || 0);
            const replies = Number(campaign.replied_count || 0);
            return (
              <div
                key={campaign.id}
                className="grid gap-4 rounded-2xl border p-4 transition-colors hover:bg-muted/30 lg:grid-cols-[minmax(0,2fr)_1fr_1fr_auto] lg:items-center"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <Link
                      to="/campaigns/$id"
                      params={{ id: campaign.id }}
                      className="truncate font-semibold text-foreground hover:text-primary"
                    >
                      {campaign.name}
                    </Link>
                    <Badge className={statusTone[campaign.status] || ""} variant="secondary">
                      {campaign.status.replaceAll("_", " ")}
                    </Badge>
                    <Badge variant="outline">{campaign.campaign_type}</Badge>
                  </div>
                  <p className="mt-1 line-clamp-1 text-sm text-muted-foreground">
                    {campaign.objective || "No objective recorded yet."}
                  </p>
                  <p className="mt-2 text-xs text-muted-foreground">
                    Owner: {campaign.owner_name || "Unassigned"}
                  </p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Audience</p>
                  <p className="mt-1 font-semibold">{recipients} contacts</p>
                  <p className="text-xs text-muted-foreground">
                    {Number(campaign.reached_count || 0)} reached
                  </p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Response</p>
                  <p className="mt-1 font-semibold">
                    {recipients ? Math.round((replies / recipients) * 100) : 0}% reply rate
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {Number(campaign.converted_count || 0)} converted
                  </p>
                </div>
                <div className="flex items-center justify-end gap-2">
                  {campaign.scheduled_at ? (
                    <span className="hidden text-xs text-muted-foreground xl:inline">
                      <CalendarClock className="mr-1 inline h-3.5 w-3.5" />
                      {new Date(campaign.scheduled_at).toLocaleDateString()}
                    </span>
                  ) : null}
                  <Button asChild variant="outline" size="sm">
                    <Link to="/campaigns/$id" params={{ id: campaign.id }}>
                      Open
                    </Link>
                  </Button>
                  {["draft", "in_review", "approved"].includes(campaign.status) ? (
                    <ConfirmAction
                      title="Delete this campaign?"
                      description="Its audience, sequence and history will be removed. This cannot be undone."
                      onConfirm={async () => {
                        await remove.mutateAsync(campaign.id);
                      }}
                      trigger={
                        <Button variant="ghost" size="sm" className="text-destructive">
                          Delete
                        </Button>
                      }
                    />
                  ) : null}
                </div>
              </div>
            );
          })}
          {!isLoading && !filtered.length ? (
            <div className="rounded-xl border border-dashed py-8 text-center">
              <Send className="mx-auto h-8 w-8 text-muted-foreground" />
              <p className="mt-3 font-medium">No campaigns match this view.</p>
              <p className="text-sm text-muted-foreground">
                Create a campaign to begin building its audience and sequence.
              </p>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Create a campaign workspace</DialogTitle>
            <DialogDescription>
              Start with the business outcome. You will build the audience and sequence next.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="campaign-name">Campaign name</Label>
              <Input
                id="campaign-name"
                value={draft.name}
                onChange={(event) =>
                  setDraft((current) => ({ ...current, name: event.target.value }))
                }
                placeholder="Q4 procurement leaders outreach"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="new-campaign-type">Campaign type</Label>
              <CampaignTypeSelect
                value={draft.campaignType}
                triggerId="new-campaign-type"
                helperId="new-campaign-type-help"
                onValueChange={(campaignType) =>
                  setDraft((current) => ({ ...current, campaignType }))
                }
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="campaign-objective">Business objective</Label>
              <Textarea
                id="campaign-objective"
                rows={4}
                value={draft.objective}
                onChange={(event) =>
                  setDraft((current) => ({ ...current, objective: event.target.value }))
                }
                placeholder="Book qualified discovery meetings with procurement decision-makers."
              />
            </div>
            <div className="flex items-center justify-between rounded-xl border p-4">
              <div>
                <Label>Require approval before launch</Label>
                <p className="text-xs text-muted-foreground">
                  Recommended for brand and compliance control.
                </p>
              </div>
              <Switch
                checked={draft.approvalRequired}
                onCheckedChange={(approvalRequired) =>
                  setDraft((current) => ({ ...current, approvalRequired }))
                }
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>
              Cancel
            </Button>
            <Button
              disabled={!draft.name.trim() || create.isPending}
              onClick={() => create.mutate()}
            >
              {create.isPending ? "Creating…" : "Create workspace"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
