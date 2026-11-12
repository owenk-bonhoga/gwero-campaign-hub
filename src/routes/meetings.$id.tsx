import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { CalendarPlus, ExternalLink, Video, XCircle } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cancelMeeting, getMeeting } from "@/lib/meetings.functions";

export const Route = createFileRoute("/meetings/$id")({ component: MeetingPage });
type Meeting = {
  id: string;
  title: string;
  description: string | null;
  starts_at: string;
  ends_at: string;
  provider: string;
  join_url: string;
  embed_url: string | null;
  location: string | null;
  status: string;
  organiser_name: string;
};

function calendarFile(meeting: Meeting) {
  const stamp = (value: string) =>
    new Date(value)
      .toISOString()
      .replace(/[-:]/g, "")
      .replace(/\.\d{3}/, "");
  const escape = (value: string) => value.replace(/([,;\\])/g, "\\$1").replace(/\n/g, "\\n");
  const body = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Gwero OS//Meetings//EN",
    "BEGIN:VEVENT",
    `UID:${meeting.id}@gwerosolutions.com`,
    `DTSTAMP:${stamp(new Date().toISOString())}`,
    `DTSTART:${stamp(meeting.starts_at)}`,
    `DTEND:${stamp(meeting.ends_at)}`,
    `SUMMARY:${escape(meeting.title)}`,
    `DESCRIPTION:${escape(meeting.description || "")}`,
    `URL:${meeting.join_url}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");
  const link = document.createElement("a");
  link.href = URL.createObjectURL(new Blob([body], { type: "text/calendar" }));
  link.download = `${meeting.title.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}.ics`;
  link.click();
  URL.revokeObjectURL(link.href);
}

function MeetingPage() {
  const { id } = Route.useParams();
  const qc = useQueryClient();
  const { data: meeting, isLoading } = useQuery({
    queryKey: ["meeting", id],
    queryFn: () => getMeeting({ data: { id } }) as Promise<Meeting>,
  });
  const cancel = useMutation({
    mutationFn: () => cancelMeeting({ data: { id } }),
    onSuccess: async () => {
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["meeting", id] }),
        qc.invalidateQueries({ queryKey: ["meetings"] }),
      ]);
      toast.success("Meeting cancelled.");
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : "Could not cancel meeting."),
  });
  if (isLoading || !meeting)
    return (
      <AppShell title="Meeting" description="Loading meeting…">
        <div />
      </AppShell>
    );
  const inApp = meeting.provider === "gwero" && meeting.embed_url && meeting.status !== "cancelled";
  return (
    <AppShell
      title={meeting.title}
      description={`${format(new Date(meeting.starts_at), "EEEE d MMMM yyyy, HH:mm")}–${format(new Date(meeting.ends_at), "HH:mm")}`}
      actions={
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => calendarFile(meeting)}>
            <CalendarPlus className="mr-2 size-4" />
            Add to calendar
          </Button>
          <Button asChild>
            <a href={meeting.join_url} target="_blank" rel="noreferrer">
              <ExternalLink className="mr-2 size-4" />
              Open room
            </a>
          </Button>
        </div>
      }
    >
      <div className="space-y-5">
        {inApp ? (
          <Card className="overflow-hidden">
            <div className="aspect-video min-h-[560px] bg-slate-950">
              <iframe
                title={meeting.title}
                src={meeting.embed_url || undefined}
                className="h-full w-full border-0"
                allow="camera; microphone; display-capture; fullscreen; autoplay"
              />
            </div>
          </Card>
        ) : (
          <Card>
            <CardContent className="flex min-h-72 flex-col items-center justify-center text-center">
              <Video className="mb-4 size-12 text-primary" />
              <h2 className="text-xl font-semibold">
                {meeting.status === "cancelled"
                  ? "This meeting was cancelled"
                  : "Your meeting room is ready"}
              </h2>
              <p className="mt-2 max-w-xl text-muted-foreground">
                {meeting.provider === "gwero"
                  ? "Open the room to join."
                  : "This provider protects its meeting experience in its own application. Gwero keeps the schedule and gives you a secure handoff."}
              </p>
              {meeting.status !== "cancelled" ? (
                <Button asChild className="mt-5">
                  <a href={meeting.join_url} target="_blank" rel="noreferrer">
                    Join meeting
                  </a>
                </Button>
              ) : null}
            </CardContent>
          </Card>
        )}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Meeting details</CardTitle>
              <Badge variant={meeting.status === "cancelled" ? "destructive" : "secondary"}>
                {meeting.status}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="whitespace-pre-wrap text-sm text-muted-foreground">
              {meeting.description || "No agenda added."}
            </p>
            <div className="text-sm">
              <span className="font-medium">Organiser:</span> {meeting.organiser_name}
            </div>
            <div className="text-sm">
              <span className="font-medium">Provider:</span>{" "}
              {String(meeting.provider).replaceAll("_", " ")}
            </div>
            {meeting.location ? (
              <div className="text-sm">
                <span className="font-medium">Location:</span> {meeting.location}
              </div>
            ) : null}
            <div className="flex justify-between border-t pt-4">
              <Button asChild variant="ghost">
                <Link to="/meetings">Back to calendar</Link>
              </Button>
              {meeting.status !== "cancelled" ? (
                <Button
                  variant="destructive"
                  onClick={() => cancel.mutate()}
                  disabled={cancel.isPending}
                >
                  <XCircle className="mr-2 size-4" />
                  Cancel meeting
                </Button>
              ) : null}
            </div>
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
