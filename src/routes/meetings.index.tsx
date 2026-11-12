import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { addDays, format, isSameDay, startOfDay } from "date-fns";
import { CalendarDays, Clock3, ExternalLink, MapPin, Plus, Video } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
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
import { getEmailIdentityWorkspace } from "@/lib/email-identity.functions";
import { listMeetings, saveMeeting } from "@/lib/meetings.functions";

export const Route = createFileRoute("/meetings/")({
  component: MeetingsPage,
  head: () => ({ meta: [{ title: "Calendar & meetings | Gwero OS" }] }),
});

type Meeting = {
  id: string;
  title: string;
  starts_at: string;
  ends_at: string;
  provider: string;
  join_url: string;
  location: string | null;
  status: string;
};
type Mailbox = { id: string; from_email: string; provider: string };
const providers = [
  ["gwero", "Gwero room (in-app)"],
  ["google_meet", "Google Meet"],
  ["microsoft_teams", "Microsoft Teams"],
  ["zoom", "Zoom"],
  ["custom", "Other meeting link"],
] as const;

function localInput(date: Date) {
  const shifted = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return shifted.toISOString().slice(0, 16);
}

function MeetingsPage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    title: "",
    description: "",
    startsAt: localInput(addDays(new Date(), 1)),
    endsAt: localInput(new Date(addDays(new Date(), 1).getTime() + 30 * 60_000)),
    provider: "gwero",
    mailboxId: "",
    joinUrl: "",
    location: "",
    attendees: "",
  });
  const { data: meetings = [] } = useQuery({
    queryKey: ["meetings"],
    queryFn: () => listMeetings() as Promise<Meeting[]>,
  });
  const { data: identity } = useQuery({
    queryKey: ["email-identity-workspace"],
    queryFn: () => getEmailIdentityWorkspace() as Promise<{ mailboxes: Mailbox[] }>,
  });
  const create = useMutation({
    mutationFn: () =>
      saveMeeting({
        data: {
          ...form,
          provider: form.provider as
            "gwero" | "google_meet" | "microsoft_teams" | "zoom" | "custom",
          attendees: form.attendees
            .split(/[;,\n]/)
            .map((value) => value.trim())
            .filter(Boolean),
        },
      }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["meetings"] });
      setOpen(false);
      toast.success("Meeting scheduled.");
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : "Meeting could not be scheduled."),
  });
  const days = useMemo(
    () => Array.from({ length: 14 }, (_, index) => addDays(startOfDay(new Date()), index)),
    [],
  );
  const upcoming = meetings.filter(
    (meeting) => meeting.status !== "cancelled" && new Date(meeting.ends_at) >= new Date(),
  );

  return (
    <AppShell
      title="Calendar & meetings"
      description="Schedule work, create meeting rooms and join conversations from one calendar."
      actions={
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 size-4" />
              Schedule meeting
            </Button>
          </DialogTrigger>
          <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Schedule a meeting</DialogTitle>
            </DialogHeader>
            <div className="grid gap-4 py-2 md:grid-cols-2">
              <div className="space-y-2 md:col-span-2">
                <Label>Title</Label>
                <Input
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  placeholder="Client discovery call"
                />
              </div>
              <div className="space-y-2">
                <Label>Starts</Label>
                <Input
                  type="datetime-local"
                  value={form.startsAt}
                  onChange={(e) => setForm({ ...form, startsAt: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Ends</Label>
                <Input
                  type="datetime-local"
                  value={form.endsAt}
                  onChange={(e) => setForm({ ...form, endsAt: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Meeting provider</Label>
                <Select
                  value={form.provider}
                  onValueChange={(provider) => setForm({ ...form, provider })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {providers.map(([value, label]) => (
                      <SelectItem key={value} value={value}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {["google_meet", "microsoft_teams"].includes(form.provider) ? (
                <div className="space-y-2">
                  <Label>Connected account</Label>
                  <Select
                    value={form.mailboxId}
                    onValueChange={(mailboxId) => setForm({ ...form, mailboxId })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Choose account" />
                    </SelectTrigger>
                    <SelectContent>
                      {(identity?.mailboxes || [])
                        .filter(
                          (m) =>
                            m.provider === (form.provider === "google_meet" ? "gmail" : "outlook"),
                        )
                        .map((m) => (
                          <SelectItem key={m.id} value={m.id}>
                            {m.from_email}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>
              ) : null}
              {["zoom", "custom"].includes(form.provider) ? (
                <div className="space-y-2">
                  <Label>Secure meeting link</Label>
                  <Input
                    type="url"
                    value={form.joinUrl}
                    onChange={(e) => setForm({ ...form, joinUrl: e.target.value })}
                    placeholder="https://…"
                  />
                </div>
              ) : null}
              <div className="space-y-2">
                <Label>Location (optional)</Label>
                <Input
                  value={form.location}
                  onChange={(e) => setForm({ ...form, location: e.target.value })}
                />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label>Attendees</Label>
                <Input
                  value={form.attendees}
                  onChange={(e) => setForm({ ...form, attendees: e.target.value })}
                  placeholder="name@example.com, colleague@example.com"
                />
                <p className="text-xs text-muted-foreground">
                  Gwero users with matching email addresses will see this meeting on their calendar.
                </p>
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label>Agenda or notes</Label>
                <Textarea
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  rows={4}
                />
              </div>
            </div>
            <Button
              className="w-full"
              disabled={create.isPending || !form.title.trim()}
              onClick={() => create.mutate()}
            >
              {create.isPending ? "Creating room…" : "Schedule meeting"}
            </Button>
          </DialogContent>
        </Dialog>
      }
    >
      <div className="grid gap-5 xl:grid-cols-[1fr_340px]">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CalendarDays className="size-5 text-primary" />
              Next 14 days
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-px overflow-hidden rounded-xl border bg-border sm:grid-cols-2 lg:grid-cols-7">
              {days.map((day) => {
                const events = upcoming.filter((meeting) =>
                  isSameDay(new Date(meeting.starts_at), day),
                );
                return (
                  <div key={day.toISOString()} className="min-h-36 bg-card p-3">
                    <div className="mb-3 flex items-baseline justify-between">
                      <span className="text-xs font-medium uppercase text-muted-foreground">
                        {format(day, "EEE")}
                      </span>
                      <span className="text-lg font-semibold">{format(day, "d")}</span>
                    </div>
                    <div className="space-y-2">
                      {events.slice(0, 3).map((meeting) => (
                        <Link
                          key={meeting.id}
                          to="/meetings/$id"
                          params={{ id: meeting.id }}
                          className="block rounded-lg bg-primary/10 p-2 text-xs transition hover:bg-primary/15"
                        >
                          <span className="block font-semibold text-foreground">
                            {meeting.title}
                          </span>
                          <span className="text-muted-foreground">
                            {format(new Date(meeting.starts_at), "HH:mm")}
                          </span>
                        </Link>
                      ))}
                      {events.length > 3 ? (
                        <span className="text-xs text-muted-foreground">
                          +{events.length - 3} more
                        </span>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Upcoming</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {upcoming.slice(0, 8).map((meeting) => (
              <div key={meeting.id} className="rounded-xl border p-3">
                <div className="mb-2 flex items-start justify-between gap-2">
                  <p className="font-semibold leading-tight">{meeting.title}</p>
                  <Badge variant="secondary">{String(meeting.provider).replaceAll("_", " ")}</Badge>
                </div>
                <p className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Clock3 className="size-3.5" />
                  {format(new Date(meeting.starts_at), "EEE d MMM, HH:mm")}
                </p>
                {meeting.location ? (
                  <p className="mt-1 flex items-center gap-2 text-sm text-muted-foreground">
                    <MapPin className="size-3.5" />
                    {meeting.location}
                  </p>
                ) : null}
                <div className="mt-3 flex gap-2">
                  <Button asChild size="sm">
                    <Link to="/meetings/$id" params={{ id: meeting.id }}>
                      <Video className="mr-1 size-4" />
                      Open
                    </Link>
                  </Button>
                  <Button asChild size="sm" variant="outline">
                    <a href={meeting.join_url} target="_blank" rel="noreferrer">
                      <ExternalLink className="mr-1 size-4" />
                      Join
                    </a>
                  </Button>
                </div>
              </div>
            ))}
            {!upcoming.length ? (
              <div className="py-12 text-center text-sm text-muted-foreground">
                No upcoming meetings.
              </div>
            ) : null}
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
