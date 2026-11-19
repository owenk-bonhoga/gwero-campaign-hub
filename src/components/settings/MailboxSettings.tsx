import { useRouter } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Mail, Pencil, Plus, Send, Share2, Trash2, Wifi } from "lucide-react";
import { toast } from "sonner";
import { ConfirmAction } from "@/components/ConfirmAction";
import { MailProviderLogo } from "@/components/settings/MailProviderLogo";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
import { saveMailboxCredentials, testMailbox } from "@/lib/crm.functions";
import {
  deleteMailbox,
  getEmailIdentityWorkspace,
  saveMailbox,
  setDefaultMailbox,
  setMailboxUserAccess,
  updateMailboxProfile,
} from "@/lib/email-identity.functions";
import { mailProviderChoices, providerById } from "@/lib/mail-provider-config";
import { canDeleteOwnedMailbox, mailboxActions } from "@/lib/mailbox-policy";

type Row = Record<string, unknown>;
const emptyForm = {
  name: "",
  email: "",
  smtpHost: "",
  smtpPort: "587",
  username: "",
  password: "",
  imapHost: "",
  imapPort: "993",
  fromName: "",
  isDefault: false,
};

export function MailboxSettings({ setupRequired = false }: { setupRequired?: boolean }) {
  const router = useRouter();
  const qc = useQueryClient();
  const saveSecrets = useServerFn(saveMailboxCredentials);
  const test = useServerFn(testMailbox);
  const [wizardOpen, setWizardOpen] = useState(setupRequired);
  const [providerId, setProviderId] = useState("");
  const [passwordFallback, setPasswordFallback] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [sharing, setSharing] = useState<Row | null>(null);
  const [profileEditing, setProfileEditing] = useState<Row | null>(null);
  const [profileForm, setProfileForm] = useState({ name: "", fromName: "" });
  const [shareUserId, setShareUserId] = useState("");
  const { data: workspace } = useQuery({
    queryKey: ["email-identity-workspace"],
    queryFn: () =>
      getEmailIdentityWorkspace() as Promise<{
        mailboxes: Row[];
        users: Row[];
        access: Row[];
        userId: string;
        providerAvailability: { google: boolean; microsoft: boolean };
      }>,
  });
  const mailboxes = workspace?.mailboxes || [];
  const ownedCount = mailboxes.filter((mailbox) => Boolean(mailbox["is_owner"])).length;
  const readyOwnedCount = mailboxes.filter(
    (mailbox) =>
      Boolean(mailbox["is_owner"]) &&
      (mailbox["provider"] !== "smtp" ||
        String(mailbox["last_status"] || "").startsWith("Sending (SMTP) works")),
  ).length;
  useEffect(() => {
    if (!setupRequired || !workspace || readyOwnedCount === 0) return;
    const next = new URLSearchParams(window.location.search).get("next");
    void router.navigate({
      href: next?.startsWith("/") && !next.startsWith("//") ? next : "/settings?tab=email",
      replace: true,
    });
  }, [readyOwnedCount, setupRequired, workspace, router]);
  const selectedProvider = providerById(providerId);
  const refresh = () => {
    void qc.invalidateQueries({ queryKey: ["email-identity-workspace"] });
    void qc.invalidateQueries({ queryKey: ["auth-status"] });
  };
  const resetWizard = () => {
    setWizardOpen(false);
    setProviderId("");
    setPasswordFallback(false);
    setEditingId(null);
    setForm(emptyForm);
  };
  const chooseProvider = (id: string) => {
    const provider = providerById(id);
    if (!provider) return;
    const oauthAvailable =
      provider.mode === "oauth-google"
        ? Boolean(workspace?.providerAvailability.google)
        : provider.mode === "oauth-microsoft"
          ? Boolean(workspace?.providerAvailability.microsoft)
          : true;
    const usePassword = provider.mode === "password" || !oauthAvailable;
    setProviderId(id);
    setPasswordFallback(usePassword);
    if (usePassword)
      setForm((current) => ({
        ...current,
        name: provider.label,
        smtpHost: provider.smtpHost || "",
        smtpPort: String(provider.smtpPort || 587),
        imapHost: provider.imapHost || "",
        imapPort: String(provider.imapPort || 993),
      }));
  };
  const save = useMutation({
    mutationFn: async () => {
      if (
        !form.name ||
        !form.email ||
        !form.smtpHost ||
        !form.username ||
        (!editingId && !form.password)
      )
        throw new Error("Complete the required account and SMTP fields.");
      const result = await saveMailbox({
        data: {
          ...(editingId ? { id: editingId } : {}),
          name: form.name,
          email: form.email,
          fromName: form.fromName,
          provider: "smtp",
          smtpHost: form.smtpHost,
          smtpPort: Number(form.smtpPort),
          username: form.username,
          imapHost: form.imapHost,
          imapPort: Number(form.imapPort),
        },
      });
      if (form.password)
        await saveSecrets({
          data: { mailboxId: result.id, smtpPassword: form.password, imapPassword: form.password },
        });
      await test({ data: { mailboxId: result.id } });
      if (form.isDefault || ownedCount === 0)
        await setDefaultMailbox({ data: { mailboxId: result.id } });
    },
    onSuccess: () => {
      toast.success(editingId ? "Sending account updated." : "Sending account connected.");
      resetWizard();
      refresh();
      if (setupRequired) {
        const next = new URLSearchParams(window.location.search).get("next");
        void router.navigate({
          href: next?.startsWith("/") && !next.startsWith("//") ? next : "/settings?tab=email",
        });
      }
    },
    onError: (error: Error) => {
      toast.error(error.message);
      refresh();
    },
  });
  const edit = (mailbox: Row) => {
    setEditingId(String(mailbox["id"]));
    setProviderId("custom");
    setPasswordFallback(true);
    setForm({
      name: String(mailbox["name"] || ""),
      email: String(mailbox["from_email"] || ""),
      fromName: String(mailbox["from_name"] || ""),
      smtpHost: String(mailbox["smtp_host"] || ""),
      smtpPort: String(mailbox["smtp_port"] || 587),
      username: String(mailbox["smtp_username"] || mailbox["from_email"] || ""),
      password: "",
      imapHost: String(mailbox["imap_host"] || ""),
      imapPort: String(mailbox["imap_port"] || 993),
      isDefault: Boolean(mailbox["is_default"]),
    });
    setWizardOpen(true);
  };
  return (
    <div className="space-y-4">
      {setupRequired && readyOwnedCount === 0 ? (
        <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950">
          <p className="font-semibold">Connect your sending email to continue using Gwero OS.</p>
          <p className="mt-1">
            Choose your provider and sign in, or use your provider's SMTP details.
          </p>
        </div>
      ) : null}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Email accounts</h2>
          <p className="text-sm text-muted-foreground">
            Your accounts and accounts shared with you for sending.
          </p>
        </div>
        <Button onClick={() => setWizardOpen(true)}>
          <Plus className="mr-2 size-4" />
          Add email account
        </Button>
      </div>
      <div className="grid gap-3">
        {mailboxes.map((mailbox) => {
          const owner = Boolean(mailbox["is_owner"]);
          const actions = mailboxActions({ isOwner: owner, canSend: Boolean(mailbox["can_send"]) });
          return (
            <Card key={String(mailbox["id"])}>
              <CardContent className="flex flex-wrap items-center gap-3 p-4">
                <div className="grid size-10 place-items-center rounded-xl bg-primary/10 text-primary">
                  <Mail className="size-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-semibold">{String(mailbox["name"])}</p>
                    <Badge variant={owner ? "default" : "secondary"}>
                      {owner ? "Mine" : "Shared with me"}
                    </Badge>
                    {mailbox["is_default"] ? <Badge variant="outline">Default</Badge> : null}
                  </div>
                  <p className="truncate text-sm text-muted-foreground">
                    {String(mailbox["from_email"])}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {String(mailbox["provider"]).toUpperCase()} ·{" "}
                    {String(
                      mailbox["last_status"] || (owner ? "Ready to test" : "Send-only access"),
                    )}
                  </p>
                </div>
                {!mailbox["is_default"] ? (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={async () => {
                      await setDefaultMailbox({ data: { mailboxId: String(mailbox["id"]) } });
                      refresh();
                    }}
                  >
                    Make default
                  </Button>
                ) : null}
                {actions.canTest ? (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={async () => {
                      try {
                        const result = await test({ data: { mailboxId: String(mailbox["id"]) } });
                        toast.success(result.message);
                        refresh();
                      } catch (error) {
                        toast.error((error as Error).message);
                      }
                    }}
                  >
                    <Wifi className="mr-2 size-4" />
                    Test
                  </Button>
                ) : null}
                {actions.canShare ? (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setSharing(mailbox);
                      setShareUserId("");
                    }}
                  >
                    <Share2 className="mr-2 size-4" />
                    Share
                  </Button>
                ) : null}
                {actions.canEdit ? (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      if (mailbox["provider"] === "smtp") edit(mailbox);
                      else {
                        setProfileEditing(mailbox);
                        setProfileForm({
                          name: String(mailbox["name"] || ""),
                          fromName: String(mailbox["from_name"] || ""),
                        });
                      }
                    }}
                  >
                    <Pencil className="mr-2 size-4" />
                    Edit
                  </Button>
                ) : null}
                {actions.canDelete ? (
                  <ConfirmAction
                    title="Delete sending account?"
                    description={
                      canDeleteOwnedMailbox(ownedCount)
                        ? `Remove ${String(mailbox["from_email"])} and revoke all sharing?`
                        : "You must keep at least one account connected."
                    }
                    onConfirm={async () => {
                      await deleteMailbox({ data: { id: String(mailbox["id"]) } });
                      toast.success("Sending account deleted.");
                      refresh();
                    }}
                    disabled={!canDeleteOwnedMailbox(ownedCount)}
                    trigger={
                      <Button
                        variant="ghost"
                        size="icon"
                        disabled={!canDeleteOwnedMailbox(ownedCount)}
                      >
                        <Trash2 className="size-4 text-destructive" />
                      </Button>
                    }
                  />
                ) : (
                  <Badge variant="outline">
                    <Send className="mr-1 size-3" />
                    Send only
                  </Badge>
                )}
              </CardContent>
            </Card>
          );
        })}
        {!mailboxes.length ? (
          <Card>
            <CardContent className="py-12 text-center text-sm text-muted-foreground">
              No email accounts connected yet.
            </CardContent>
          </Card>
        ) : null}
      </div>
      <Dialog
        open={wizardOpen}
        onOpenChange={(open) => {
          if (!open && setupRequired && readyOwnedCount === 0) return;
          if (!open) resetWizard();
          else setWizardOpen(true);
        }}
      >
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editingId ? "Edit email account" : "Add email account"}</DialogTitle>
            <DialogDescription>
              {providerId
                ? "Complete the secure provider setup."
                : "Choose where your email is hosted."}
            </DialogDescription>
          </DialogHeader>
          {!providerId ? (
            <div className="grid gap-2 sm:grid-cols-2">
              {setupRequired
                ? mailboxes
                    .filter(
                      (mailbox) =>
                        mailbox["is_owner"] &&
                        mailbox["provider"] === "smtp" &&
                        !String(mailbox["last_status"] || "").startsWith("Sending (SMTP) works"),
                    )
                    .map((mailbox) => (
                      <button
                        key={String(mailbox["id"])}
                        type="button"
                        onClick={() => edit(mailbox)}
                        className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-left sm:col-span-2"
                      >
                        <p className="font-semibold text-amber-950">
                          Finish connecting {String(mailbox["from_email"])}
                        </p>
                        <p className="mt-1 text-xs text-amber-800">
                          Update its password or server settings, then Gwero will verify the
                          connection.
                        </p>
                      </button>
                    ))
                : null}
              {mailProviderChoices.map((provider) =>
                (() => {
                  const unavailable =
                    (provider.mode === "oauth-google" &&
                      workspace?.providerAvailability?.google === false) ||
                    (provider.mode === "oauth-microsoft" &&
                      workspace?.providerAvailability?.microsoft === false);
                  return (
                    <button
                      key={provider.id}
                      type="button"
                      onClick={() => chooseProvider(provider.id)}
                      className="flex items-start gap-3 rounded-xl border p-4 text-left transition hover:border-primary hover:bg-primary/5"
                    >
                      <MailProviderLogo providerId={provider.id} />
                      <span className="min-w-0 flex-1">
                        <span className="block font-semibold">{provider.label}</span>
                        <span className="mt-1 block text-xs text-muted-foreground">
                          {provider.description}
                        </span>
                        {unavailable ? (
                          <span className="mt-2 block text-xs font-medium text-amber-700">
                            OAuth is not configured. Continue with an app password, or configure
                            OAuth in Settings → Integrations.
                          </span>
                        ) : null}
                      </span>
                    </button>
                  );
                })(),
              )}
              <p className="pt-2 text-center text-[11px] text-muted-foreground sm:col-span-2">
                Provider names and marks belong to their respective owners and identify compatible
                connection options; they do not imply endorsement.
              </p>
            </div>
          ) : (selectedProvider?.mode === "oauth-google" ||
              selectedProvider?.mode === "oauth-microsoft") &&
            !passwordFallback ? (
            <div className="rounded-xl border bg-muted/30 p-5">
              <p className="font-semibold">{selectedProvider.label}</p>
              <p className="mt-2 text-sm text-muted-foreground">
                Gwero will open the provider's secure login and request only the permissions needed
                to send and synchronize email.
              </p>
              <div className="mt-5 flex gap-2">
                <Button asChild>
                  <a
                    href={
                      selectedProvider.mode === "oauth-google"
                        ? "/api/oauth/google/start"
                        : "/api/oauth/microsoft/start"
                    }
                  >
                    Continue to secure sign-in
                  </a>
                </Button>
                <Button variant="outline" onClick={() => setProviderId("")}>
                  Back
                </Button>
              </div>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              {passwordFallback && selectedProvider?.mode !== "password" ? (
                <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950 sm:col-span-2">
                  OAuth is not configured for {selectedProvider?.label}. Use an app password where
                  your provider supports one. For Microsoft tenants with SMTP AUTH disabled, an
                  administrator must configure OAuth under Integrations.
                </div>
              ) : null}
              {(
                [
                  ["name", "Account name"],
                  ["email", "Email address"],
                  ["fromName", "Sender name"],
                  ["username", "Username"],
                  [
                    "password",
                    editingId ? "New app password (optional)" : "Password / app password",
                  ],
                  ["smtpHost", "SMTP host"],
                  ["smtpPort", "SMTP port"],
                  ["imapHost", "IMAP host (optional)"],
                  ["imapPort", "IMAP port"],
                ] as const
              ).map(([key, label]) => (
                <div key={key} className="space-y-2">
                  <Label>{label}</Label>
                  <Input
                    type={key === "password" ? "password" : key === "email" ? "email" : "text"}
                    value={String(form[key])}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        [key]: event.target.value,
                        ...(key === "email" && !current.username
                          ? { username: event.target.value }
                          : {}),
                      }))
                    }
                  />
                </div>
              ))}
              <label className="flex items-center gap-2 text-sm sm:col-span-2">
                <input
                  type="checkbox"
                  checked={form.isDefault}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, isDefault: event.target.checked }))
                  }
                />
                Use as my default sending account
              </label>
              <div className="flex gap-2 sm:col-span-2">
                <Button disabled={save.isPending} onClick={() => save.mutate()}>
                  {save.isPending ? "Connecting…" : editingId ? "Save changes" : "Connect account"}
                </Button>
                {!editingId ? (
                  <Button variant="outline" onClick={() => setProviderId("")}>
                    Back
                  </Button>
                ) : null}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
      <Dialog
        open={Boolean(sharing)}
        onOpenChange={(open) => {
          if (!open) setSharing(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Share sending access</DialogTitle>
            <DialogDescription>
              The person can select this account when sending email. They cannot edit, test, share
              or delete it.
            </DialogDescription>
          </DialogHeader>
          {sharing ? (
            <div className="space-y-4">
              <Select value={shareUserId} onValueChange={setShareUserId}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose a person" />
                </SelectTrigger>
                <SelectContent>
                  {(workspace?.users || [])
                    .filter((user) => user["id"] !== workspace?.userId)
                    .map((user) => (
                      <SelectItem key={String(user["id"])} value={String(user["id"])}>
                        {String(user["full_name"])} · {String(user["email"])}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
              <Button
                disabled={!shareUserId}
                onClick={async () => {
                  await setMailboxUserAccess({
                    data: { mailboxId: String(sharing["id"]), userId: shareUserId, canSend: true },
                  });
                  toast.success("Send-only access shared.");
                  setShareUserId("");
                  refresh();
                }}
              >
                Share send-only access
              </Button>
              <div className="space-y-2">
                {(workspace?.access || [])
                  .filter(
                    (access) =>
                      access["mailbox_id"] === sharing["id"] &&
                      access["user_id"] !== workspace?.userId,
                  )
                  .map((access) => (
                    <div
                      key={String(access["user_id"])}
                      className="flex items-center justify-between rounded-lg border p-3"
                    >
                      <div>
                        <p className="text-sm font-medium">{String(access["full_name"])}</p>
                        <p className="text-xs text-muted-foreground">
                          Send-only · {String(access["email"])}
                        </p>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-destructive"
                        onClick={async () => {
                          await setMailboxUserAccess({
                            data: {
                              mailboxId: String(sharing["id"]),
                              userId: String(access["user_id"]),
                              canSend: false,
                            },
                          });
                          toast.success("Access revoked.");
                          refresh();
                        }}
                      >
                        Revoke
                      </Button>
                    </div>
                  ))}
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
      <Dialog
        open={Boolean(profileEditing)}
        onOpenChange={(open) => {
          if (!open) setProfileEditing(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit connected account</DialogTitle>
            <DialogDescription>
              The OAuth email address and provider are managed by your email service.
            </DialogDescription>
          </DialogHeader>
          {profileEditing ? (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Account name</Label>
                <Input
                  value={profileForm.name}
                  onChange={(event) =>
                    setProfileForm((current) => ({ ...current, name: event.target.value }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>Sender name</Label>
                <Input
                  value={profileForm.fromName}
                  onChange={(event) =>
                    setProfileForm((current) => ({ ...current, fromName: event.target.value }))
                  }
                />
              </div>
              <Button
                onClick={async () => {
                  try {
                    await updateMailboxProfile({
                      data: { id: String(profileEditing["id"]), ...profileForm },
                    });
                    toast.success("Account updated.");
                    setProfileEditing(null);
                    refresh();
                  } catch (error) {
                    toast.error((error as Error).message);
                  }
                }}
              >
                Save changes
              </Button>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
