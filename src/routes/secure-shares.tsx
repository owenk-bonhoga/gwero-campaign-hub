import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Clock3,
  Copy,
  Eye,
  FileText,
  LockKeyhole,
  Mail,
  Plus,
  Send,
  ShieldCheck,
  UserX,
} from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { ConfirmAction } from "@/components/ConfirmAction";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  addSecureShareRecipient,
  createSecureShare,
  getSecureShareWorkspace,
  resendSecureShareInvitation,
  updateSecureShareRecipient,
  updateSecureShareStatus,
  type SecureShareRecipientInput,
} from "@/lib/secure-share.functions";

export const Route = createFileRoute("/secure-shares")({ component: SecureSharesPage });
type DocumentChoice = {
  id: string;
  title: string;
  version_id: string;
  version_number: number;
  file_name: string;
  file_size: number;
};
type Mailbox = {
  id: string;
  name: string;
  from_email: string;
  provider: string;
  is_default: boolean;
};
type Recipient = {
  id: string;
  name: string;
  email: string;
  message: string | null;
  allow_download: boolean;
  invited_at: string | null;
  last_seen_at: string | null;
  revoked_at: string | null;
};
type Item = {
  id: string;
  title: string;
  file_name: string;
  version_number: number;
  file_size: number;
};
type Event = {
  id: string;
  event_type: string;
  detail: string | null;
  recipient_name: string | null;
  recipient_email: string | null;
  created_at: string;
};
type Share = {
  id: string;
  title: string;
  description: string;
  slug: string;
  status: string;
  expires_at: string | null;
  document_count: number;
  recipient_count: number;
  created_at: string;
  items: Item[];
  recipients: Recipient[];
  events: Event[];
};
type Workspace = { shares: Share[]; documents: DocumentChoice[]; mailboxes: Mailbox[] };
type RecipientForm = { name: string; email: string; message: string; allowDownload: boolean };
const recipient = (): RecipientForm => ({ name: "", email: "", message: "", allowDownload: false });
const localDate = (date: Date) => {
  const copy = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return copy.toISOString().slice(0, 16);
};
const bytes = (value: number) =>
  value < 1024 * 1024
    ? `${Math.max(1, Math.round(value / 1024))} KB`
    : `${(value / (1024 * 1024)).toFixed(1)} MB`;
const dateTime = (value: string | null) =>
  value
    ? new Date(value).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })
    : "Never";

function SecureSharesPage() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["secure-share-workspace"],
    queryFn: () => getSecureShareWorkspace() as Promise<Workspace>,
  });
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState("");
  const [addingRecipient, setAddingRecipient] = useState(false);
  const [newRecipient, setNewRecipient] = useState<RecipientForm>(recipient);
  const [form, setForm] = useState({
    title: "",
    description: "",
    expiresAt: localDate(new Date(Date.now() + 7 * 86400000)),
    mailboxId: "",
    emailSubject: "Secure documents from Gwero Solutions",
    emailMessage: "Please review the documents shared with you.",
    documentIds: [] as string[],
    recipients: [recipient()],
  });
  useEffect(() => {
    if (!data) return;
    const linked = new URLSearchParams(window.location.search).get("document");
    setForm((current) => ({
      ...current,
      mailboxId:
        current.mailboxId ||
        data.mailboxes.find((item) => item.is_default)?.id ||
        data.mailboxes[0]?.id ||
        "",
      documentIds:
        linked && data.documents.some((item) => item.id === linked)
          ? [linked]
          : current.documentIds,
    }));
    if (linked) setOpen(true);
  }, [data]);
  const refresh = () => qc.invalidateQueries({ queryKey: ["secure-share-workspace"] });
  const active = useMemo(
    () =>
      data?.shares.filter(
        (item) =>
          item.status === "active" && (!item.expires_at || new Date(item.expires_at) > new Date()),
      ).length || 0,
    [data],
  );
  const create = useMutation({
    mutationFn: () =>
      createSecureShare({
        data: {
          ...form,
          expiresAt: form.expiresAt ? new Date(form.expiresAt).toISOString() : "",
          recipients: form.recipients as SecureShareRecipientInput[],
        },
      }),
    onSuccess: async (result) => {
      await refresh();
      setOpen(false);
      setForm((current) => ({
        ...current,
        title: "",
        description: "",
        documentIds: [],
        recipients: [recipient()],
      }));
      if (result.failures.length)
        toast.warning(`Share created, but ${result.failures.length} invitation(s) failed.`);
      else toast.success("Secure share created and invitations sent.");
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : "Secure share could not be created."),
  });
  const action = useMutation({
    mutationFn: async (input: {
      kind: "status" | "download" | "revoke" | "resend";
      id: string;
      value?: boolean;
    }) => {
      if (input.kind === "status")
        return updateSecureShareStatus({
          data: { id: input.id, status: input.value ? "active" : "revoked" },
        });
      if (input.kind === "download")
        return updateSecureShareRecipient({
          data: { id: input.id, allowDownload: Boolean(input.value) },
        });
      if (input.kind === "revoke")
        return updateSecureShareRecipient({
          data: { id: input.id, revoked: Boolean(input.value) },
        });
      const result = await resendSecureShareInvitation({ data: { recipientId: input.id } });
      await navigator.clipboard.writeText(result.link);
      return result;
    },
    onSuccess: async (_, input) => {
      await refresh();
      toast.success(
        input.kind === "resend"
          ? "A fresh invitation was sent and its new link copied."
          : "Secure access updated.",
      );
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : "Secure access could not be updated."),
  });
  const addRecipient = useMutation({
    mutationFn: () =>
      addSecureShareRecipient({
        data: { shareId: selected, recipient: newRecipient },
      }),
    onSuccess: async () => {
      await refresh();
      setAddingRecipient(false);
      setNewRecipient(recipient());
      toast.success("Recipient added and invitation sent.");
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : "Recipient could not be added."),
  });
  const detail = data?.shares.find((item) => item.id === selected) || null;
  return (
    <AppShell
      title="Secure document sharing"
      description="Send controlled document portals with email verification, expiry, revocation and download permissions."
      actions={
        <>
          <Button variant="outline" size="sm" asChild>
            <Link to="/documents">
              <FileText className="mr-2 size-4" />
              Document library
            </Link>
          </Button>
          <Button size="sm" onClick={() => setOpen(true)}>
            <Plus className="mr-2 size-4" />
            New secure share
          </Button>
        </>
      }
    >
      <div className="grid gap-3 md:grid-cols-3">
        <Summary
          icon={ShieldCheck}
          label="Active shares"
          value={active}
          detail="Available to verified recipients"
        />
        <Summary
          icon={Mail}
          label="Recipients"
          value={data?.shares.reduce((sum, item) => sum + Number(item.recipient_count), 0) || 0}
          detail="Personal, revocable access"
        />
        <Summary
          icon={Eye}
          label="Tracked events"
          value={data?.shares.reduce((sum, item) => sum + item.events.length, 0) || 0}
          detail="Invites, views and downloads"
        />
      </div>
      <Card className="mt-4">
        <CardHeader>
          <CardTitle className="text-base">Secure shares</CardTitle>
          <CardDescription>
            Each portal uses fixed document versions so later library changes do not silently alter
            what was shared.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="py-10 text-center text-sm text-muted-foreground">
              Loading secure shares…
            </p>
          ) : !data?.shares.length ? (
            <div className="rounded-xl border border-dashed p-10 text-center">
              <LockKeyhole className="mx-auto size-9 text-slate-300" />
              <p className="mt-3 font-semibold">No secure shares yet</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Create a portal from here or from any managed document.
              </p>
            </div>
          ) : (
            <div className="divide-y">
              {data.shares.map((share) => (
                <button
                  key={share.id}
                  onClick={() => setSelected(share.id)}
                  className="grid w-full gap-3 py-3 text-left hover:bg-slate-50 md:grid-cols-[minmax(0,2fr)_120px_120px_150px]"
                >
                  <span>
                    <span className="block font-semibold">{share.title}</span>
                    <span className="mt-1 block truncate text-xs text-muted-foreground">
                      /s/{share.slug}
                    </span>
                  </span>
                  <span className="text-sm">
                    <strong>{share.document_count}</strong>
                    <span className="block text-xs text-muted-foreground">documents</span>
                  </span>
                  <span className="text-sm">
                    <strong>{share.recipient_count}</strong>
                    <span className="block text-xs text-muted-foreground">recipients</span>
                  </span>
                  <span>
                    <Badge variant={share.status === "active" ? "default" : "secondary"}>
                      {share.status}
                    </Badge>
                    <span className="mt-1 block text-xs text-muted-foreground">
                      {share.expires_at ? `Expires ${dateTime(share.expires_at)}` : "No expiry"}
                    </span>
                  </span>
                </button>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[94vh] max-w-5xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create a secure document portal</DialogTitle>
            <DialogDescription>
              Recipients receive personal links, verify by email code, and only get the download
              rights you grant.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Portal title">
              <Input
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder="e.g. MRA proposal review"
              />
            </Field>
            <Field label="Expires">
              <Input
                type="datetime-local"
                value={form.expiresAt}
                onChange={(e) => setForm({ ...form, expiresAt: e.target.value })}
              />
            </Field>
            <Field label="Description">
              <Textarea
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
              />
            </Field>
            <Field label="Sending account">
              <Select
                value={form.mailboxId}
                onValueChange={(mailboxId) => setForm({ ...form, mailboxId })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Choose email account" />
                </SelectTrigger>
                <SelectContent>
                  {data?.mailboxes.map((item) => (
                    <SelectItem key={item.id} value={item.id}>
                      {item.name} · {item.from_email}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </div>
          <Field label="Documents">
            <div className="grid gap-2 rounded-xl border p-3 md:grid-cols-2">
              {data?.documents.map((document) => (
                <label
                  key={document.id}
                  className="flex items-start gap-3 rounded-lg p-2 hover:bg-slate-50"
                >
                  <Checkbox
                    checked={form.documentIds.includes(document.id)}
                    onCheckedChange={(checked) =>
                      setForm({
                        ...form,
                        documentIds: checked
                          ? [...form.documentIds, document.id]
                          : form.documentIds.filter((id) => id !== document.id),
                      })
                    }
                  />
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium">{document.title}</span>
                    <span className="block truncate text-xs text-muted-foreground">
                      v{document.version_number} · {document.file_name}
                    </span>
                  </span>
                </label>
              ))}
            </div>
          </Field>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>Recipients</Label>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setForm({ ...form, recipients: [...form.recipients, recipient()] })}
              >
                <Plus className="mr-1 size-3" />
                Add recipient
              </Button>
            </div>
            {form.recipients.map((person, index) => (
              <div
                key={index}
                className="grid gap-2 rounded-xl border bg-slate-50/60 p-3 md:grid-cols-[1fr_1.2fr_1.3fr_auto_auto]"
              >
                <Input
                  placeholder="Name"
                  value={person.name}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      recipients: form.recipients.map((item, i) =>
                        i === index ? { ...item, name: e.target.value } : item,
                      ),
                    })
                  }
                />
                <Input
                  type="email"
                  placeholder="Email"
                  value={person.email}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      recipients: form.recipients.map((item, i) =>
                        i === index ? { ...item, email: e.target.value } : item,
                      ),
                    })
                  }
                />
                <Input
                  placeholder="Personal message (optional)"
                  value={person.message}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      recipients: form.recipients.map((item, i) =>
                        i === index ? { ...item, message: e.target.value } : item,
                      ),
                    })
                  }
                />
                <label className="flex items-center gap-2 whitespace-nowrap text-xs font-medium">
                  <Switch
                    checked={person.allowDownload}
                    onCheckedChange={(allowDownload) =>
                      setForm({
                        ...form,
                        recipients: form.recipients.map((item, i) =>
                          i === index ? { ...item, allowDownload } : item,
                        ),
                      })
                    }
                  />
                  Allow download
                </label>
                <Button
                  size="icon"
                  variant="ghost"
                  disabled={form.recipients.length === 1}
                  onClick={() =>
                    setForm({ ...form, recipients: form.recipients.filter((_, i) => i !== index) })
                  }
                >
                  <UserX className="size-4" />
                </Button>
              </div>
            ))}
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Invitation subject">
              <Input
                value={form.emailSubject}
                onChange={(e) => setForm({ ...form, emailSubject: e.target.value })}
              />
            </Field>
            <Field label="Invitation message">
              <Textarea
                value={form.emailMessage}
                onChange={(e) => setForm({ ...form, emailMessage: e.target.value })}
              />
            </Field>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              disabled={
                create.isPending ||
                !form.title.trim() ||
                !form.mailboxId ||
                !form.documentIds.length
              }
              onClick={() => create.mutate()}
            >
              <Send className="mr-2 size-4" />
              {create.isPending ? "Creating and sending…" : "Create and send"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Sheet open={Boolean(detail)} onOpenChange={(next) => !next && setSelected("")}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-2xl">
          <SheetHeader>
            <SheetTitle>{detail?.title}</SheetTitle>
            <SheetDescription>{detail?.description || "Secure document portal"}</SheetDescription>
          </SheetHeader>
          {detail ? (
            <div className="mt-5 space-y-5">
              <div className="flex items-center gap-2">
                <Badge variant={detail.status === "active" ? "default" : "secondary"}>
                  {detail.status}
                </Badge>
                <span className="text-xs text-muted-foreground">
                  {detail.expires_at ? `Expires ${dateTime(detail.expires_at)}` : "No expiry"}
                </span>
                <ConfirmAction
                  trigger={
                    <Button className="ml-auto" size="sm" variant="outline">
                      {detail.status === "active" ? "Revoke portal" : "Reactivate"}
                    </Button>
                  }
                  title={
                    detail.status === "active"
                      ? "Revoke this secure portal?"
                      : "Reactivate this secure portal?"
                  }
                  description={
                    detail.status === "active"
                      ? "All current recipient sessions will stop immediately."
                      : "Recipients can use fresh invitations again."
                  }
                  confirmLabel={detail.status === "active" ? "Revoke portal" : "Reactivate"}
                  onConfirm={() =>
                    action.mutateAsync({
                      kind: "status",
                      id: detail.id,
                      value: detail.status !== "active",
                    })
                  }
                />
              </div>
              <Section title="Fixed document versions">
                {detail.items.map((item) => (
                  <div key={item.id} className="flex items-center gap-3 rounded-lg border p-3">
                    <FileText className="size-4 text-cyan-700" />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{item.title}</p>
                      <p className="text-xs text-muted-foreground">
                        v{item.version_number} · {item.file_name} · {bytes(item.file_size)}
                      </p>
                    </div>
                  </div>
                ))}
              </Section>
              <Section
                title="Recipients"
                action={
                  <Button size="sm" variant="outline" onClick={() => setAddingRecipient(true)}>
                    <Plus className="mr-1 size-3" /> Add recipient
                  </Button>
                }
              >
                {detail.recipients.map((person) => (
                  <div key={person.id} className="rounded-xl border p-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold">{person.name}</p>
                        <p className="truncate text-xs text-muted-foreground">{person.email}</p>
                      </div>
                      <Badge variant={person.revoked_at ? "destructive" : "secondary"}>
                        {person.revoked_at ? "revoked" : person.last_seen_at ? "opened" : "invited"}
                      </Badge>
                      <Button
                        size="icon"
                        variant="ghost"
                        title="Send a fresh invitation and copy link"
                        onClick={() => action.mutate({ kind: "resend", id: person.id })}
                      >
                        <Copy className="size-4" />
                      </Button>
                    </div>
                    <div className="mt-3 flex flex-wrap items-center gap-3 border-t pt-3">
                      <label className="flex items-center gap-2 text-xs font-medium">
                        <Switch
                          checked={Boolean(person.allow_download)}
                          disabled={Boolean(person.revoked_at)}
                          onCheckedChange={(value) =>
                            action.mutate({ kind: "download", id: person.id, value })
                          }
                        />
                        Allow downloads
                      </label>
                      <span className="text-xs text-muted-foreground">
                        Last access: {dateTime(person.last_seen_at)}
                      </span>
                      <Button
                        className="ml-auto"
                        size="sm"
                        variant="ghost"
                        onClick={() =>
                          action.mutate({
                            kind: "revoke",
                            id: person.id,
                            value: !person.revoked_at,
                          })
                        }
                      >
                        {person.revoked_at ? "Restore" : "Revoke"}
                      </Button>
                    </div>
                  </div>
                ))}
              </Section>
              <Section title="Audit trail">
                {detail.events.slice(0, 30).map((event) => (
                  <div key={event.id} className="flex gap-3 border-b py-2 text-sm">
                    <Clock3 className="mt-0.5 size-4 shrink-0 text-slate-400" />
                    <div>
                      <p className="font-medium capitalize">
                        {event.event_type.replaceAll("_", " ")}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {event.recipient_name || "System"}
                        {event.detail ? ` · ${event.detail}` : ""} · {dateTime(event.created_at)}
                      </p>
                    </div>
                  </div>
                ))}
              </Section>
            </div>
          ) : null}
        </SheetContent>
      </Sheet>
      <Dialog open={addingRecipient} onOpenChange={setAddingRecipient}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add secure share recipient</DialogTitle>
            <DialogDescription>
              A personal invitation and email verification code protect their access.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <Field label="Name">
              <Input
                value={newRecipient.name}
                onChange={(event) => setNewRecipient({ ...newRecipient, name: event.target.value })}
              />
            </Field>
            <Field label="Email">
              <Input
                type="email"
                value={newRecipient.email}
                onChange={(event) =>
                  setNewRecipient({ ...newRecipient, email: event.target.value })
                }
              />
            </Field>
            <Field label="Personal message">
              <Textarea
                value={newRecipient.message}
                onChange={(event) =>
                  setNewRecipient({ ...newRecipient, message: event.target.value })
                }
              />
            </Field>
            <label className="flex items-center gap-3 rounded-xl border p-3 text-sm font-medium">
              <Switch
                checked={newRecipient.allowDownload}
                onCheckedChange={(allowDownload) =>
                  setNewRecipient({ ...newRecipient, allowDownload })
                }
              />
              Allow this person to download the documents
            </label>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddingRecipient(false)}>
              Cancel
            </Button>
            <Button
              disabled={
                addRecipient.isPending || !newRecipient.name.trim() || !newRecipient.email.trim()
              }
              onClick={() => addRecipient.mutate()}
            >
              <Send className="mr-2 size-4" /> Add and send
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      {children}
    </div>
  );
}
function Section({
  title,
  children,
  action,
}: {
  title: string;
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <section className="space-y-2">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-sm font-semibold">{title}</h3>
        {action}
      </div>
      {children}
    </section>
  );
}
function Summary({
  icon: Icon,
  label,
  value,
  detail,
}: {
  icon: typeof ShieldCheck;
  label: string;
  value: number;
  detail: string;
}) {
  return (
    <Card>
      <CardContent className="flex items-center gap-3 p-4">
        <span className="grid size-10 place-items-center rounded-xl bg-cyan-50 text-cyan-700">
          <Icon className="size-5" />
        </span>
        <div>
          <p className="text-xl font-bold">{value}</p>
          <p className="text-xs font-semibold">{label}</p>
          <p className="text-[11px] text-muted-foreground">{detail}</p>
        </div>
      </CardContent>
    </Card>
  );
}
