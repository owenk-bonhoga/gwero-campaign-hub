import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ConfirmAction } from "@/components/ConfirmAction";
import { saveMailboxCredentials, testMailbox } from "@/lib/crm.functions";
import {
  deleteMailbox,
  getEmailIdentityWorkspace,
  saveMailbox,
  setDefaultMailbox,
  setMailboxUserAccess,
} from "@/lib/email-identity.functions";

type Row = Record<string, unknown>;

export function MailboxSettings() {
  const qc = useQueryClient();
  const saveSecrets = useServerFn(saveMailboxCredentials);
  const test = useServerFn(testMailbox);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [grantUser, setGrantUser] = useState<Record<string, string>>({});
  const [form, setForm] = useState({
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
    provider: "smtp",
  });
  const { data: workspace } = useQuery({
    queryKey: ["email-identity-workspace"],
    queryFn: () =>
      getEmailIdentityWorkspace() as Promise<{
        mailboxes: Row[];
        users: Row[];
        access: Row[];
        userId: string;
      }>,
  });
  const mailboxes = workspace?.mailboxes || [];
  const resetForm = () => {
    setEditingId(null);
    setForm({
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
      provider: "smtp",
    });
  };
  const save = useMutation({
    mutationFn: async () => {
      const smtp = form.provider === "smtp";
      if (
        !form.name ||
        !form.email ||
        (smtp && (!form.smtpHost || !form.username || (!editingId && !form.password)))
      )
        throw new Error(
          smtp ? "Complete the required SMTP fields." : "Add the account name and email.",
        );
      const result = await saveMailbox({
        data: {
          ...(editingId ? { id: editingId } : {}),
          name: form.name,
          email: form.email,
          fromName: form.fromName,
          provider: form.provider,
          smtpHost: form.smtpHost,
          smtpPort: Number(form.smtpPort),
          username: form.username,
          imapHost: form.imapHost,
          imapPort: Number(form.imapPort),
        },
      });
      if (smtp && form.password)
        await saveSecrets({
          data: { mailboxId: result.id, smtpPassword: form.password, imapPassword: form.password },
        });
      if (form.isDefault) await setDefaultMailbox({ data: { mailboxId: result.id } });
    },
    onSuccess: () => {
      toast.success(editingId ? "Sending account updated." : "Sending account saved.");
      resetForm();
      void qc.invalidateQueries({ queryKey: ["email-identity-workspace"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const check = async (id: string) => {
    try {
      const result = await test({ data: { mailboxId: id } });
      toast.success(result.message);
      void qc.invalidateQueries({ queryKey: ["email-identity-workspace"] });
    } catch (e) {
      toast.error((e as Error).message);
    }
  };
  const remove = async (id: string) => {
    await deleteMailbox({ data: { id } });
    toast.success("Sending account deleted.");
    void qc.invalidateQueries({ queryKey: ["email-identity-workspace"] });
  };
  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((old) => ({
      ...old,
      [key]: e.target.type === "checkbox" ? e.target.checked : e.target.value,
    }));
  const edit = (mailbox: Row) => {
    setEditingId(String(mailbox["id"]));
    setForm({
      name: String(mailbox["name"]),
      email: String(mailbox["from_email"]),
      fromName: String(mailbox["from_name"] || ""),
      smtpHost: String(mailbox["smtp_host"] || ""),
      smtpPort: String(mailbox["smtp_port"] || 587),
      username: String(mailbox["smtp_username"] || mailbox["from_email"]),
      password: "",
      imapHost: String(mailbox["imap_host"] || ""),
      imapPort: String(mailbox["imap_port"] || 993),
      isDefault: Boolean(mailbox["is_default"]),
      provider: String(mailbox["provider"]),
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  return (
    <div className="grid gap-5 xl:grid-cols-[1fr_1.25fr]">
      <Card>
        <CardHeader>
          <CardTitle>
            {editingId
              ? `Edit ${form.provider === "smtp" ? "SMTP / IMAP" : form.provider} account`
              : "Add SMTP / IMAP account"}
          </CardTitle>
          <CardDescription>
            For any provider that supplies standard outgoing and incoming mail credentials.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2">
          {(
            [
              ["name", "Account name *"],
              ["email", "From email *"],
              ["fromName", "From name"],
              ...(form.provider === "smtp"
                ? [
                    ["smtpHost", "SMTP host *"],
                    ["smtpPort", "SMTP port"],
                    ["username", "Username *"],
                    [
                      "password",
                      editingId ? "New password (leave blank to keep current)" : "Password *",
                    ],
                    ["imapHost", "IMAP host"],
                    ["imapPort", "IMAP port"],
                  ]
                : []),
            ] as string[][]
          ).map(([key, label]) => (
            <div key={key}>
              <Label>{label}</Label>
              <Input
                type={key === "password" ? "password" : key === "email" ? "email" : "text"}
                value={String(form[key as keyof typeof form])}
                onChange={set(key as keyof typeof form)}
              />
            </div>
          ))}
          <label className="flex items-center gap-2 text-sm sm:col-span-2">
            <input type="checkbox" checked={form.isDefault} onChange={set("isDefault")} />
            Use this as the default sending account
          </label>
          <Button
            className={editingId ? "" : "sm:col-span-2"}
            onClick={() => save.mutate()}
            disabled={save.isPending}
          >
            {save.isPending ? "Saving…" : editingId ? "Update account" : "Save account"}
          </Button>
          {editingId ? (
            <Button variant="outline" onClick={resetForm} disabled={save.isPending}>
              Cancel editing
            </Button>
          ) : null}
        </CardContent>
      </Card>
      <div className="space-y-3">
        <h3 className="font-semibold">Connected sending accounts</h3>
        {mailboxes.map((m) => (
          <Card key={String(m["id"])}>
            <CardContent className="flex flex-wrap items-center gap-3 pt-4">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="font-semibold">{String(m["name"])}</p>
                  <Badge variant="secondary">{String(m["provider"])}</Badge>
                  {m["is_default"] ? <Badge>My default</Badge> : null}
                </div>
                <p className="text-sm text-muted-foreground">{String(m["from_email"])}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {String(m["last_status"] || "Not tested yet")}
                </p>
              </div>
              <Button variant="outline" onClick={() => void check(String(m["id"]))}>
                Test
              </Button>
              <Button
                variant="outline"
                onClick={() => edit(m)}
                disabled={!m["can_manage"] && m["created_by"] !== workspace?.userId}
              >
                Edit
              </Button>
              <ConfirmAction
                title="Delete sending account?"
                description={`Remove ${String(m["from_email"])} and its stored credentials? Campaign history will remain.`}
                onConfirm={() => remove(String(m["id"]))}
                disabled={!m["can_manage"] && m["created_by"] !== workspace?.userId}
                trigger={<Button variant="destructive">Delete</Button>}
              />
              {m["can_manage"] || m["created_by"] === workspace?.userId ? (
                <div className="basis-full rounded-lg border bg-muted/30 p-3">
                  <p className="mb-2 text-xs font-semibold uppercase text-muted-foreground">
                    Give another user access
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <select
                      className="h-9 min-w-56 rounded-md border bg-background px-3 text-sm"
                      value={grantUser[String(m["id"])] || ""}
                      onChange={(e) =>
                        setGrantUser((v) => ({ ...v, [String(m["id"])]: e.target.value }))
                      }
                    >
                      <option value="">Choose user</option>
                      {(workspace?.users || [])
                        .filter((u) => u["id"] !== workspace?.userId)
                        .map((u) => (
                          <option key={String(u["id"])} value={String(u["id"])}>
                            {String(u["full_name"])} · {String(u["email"])}
                          </option>
                        ))}
                    </select>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={!grantUser[String(m["id"])]}
                      onClick={async () => {
                        await setMailboxUserAccess({
                          data: {
                            mailboxId: String(m["id"]),
                            userId: grantUser[String(m["id"])] || "",
                            canSend: true,
                            canManage: false,
                          },
                        });
                        toast.success("Sending access granted.");
                        void qc.invalidateQueries({ queryKey: ["email-identity-workspace"] });
                      }}
                    >
                      Grant sending access
                    </Button>
                    <Button
                      size="sm"
                      disabled={!grantUser[String(m["id"])]}
                      onClick={async () => {
                        await setMailboxUserAccess({
                          data: {
                            mailboxId: String(m["id"]),
                            userId: grantUser[String(m["id"])] || "",
                            canSend: true,
                            canManage: true,
                          },
                        });
                        toast.success("Sending and management access granted.");
                        void qc.invalidateQueries({ queryKey: ["email-identity-workspace"] });
                      }}
                    >
                      Grant management
                    </Button>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1">
                    {(workspace?.access || [])
                      .filter(
                        (a) => a["mailbox_id"] === m["id"] && a["user_id"] !== workspace?.userId,
                      )
                      .map((a) => (
                        <div
                          key={String(a["user_id"])}
                          className="flex items-center gap-1 rounded-full border bg-background py-0.5 pl-2"
                        >
                          <span className="text-xs">
                            {String(a["full_name"])} · {a["can_manage"] ? "manage" : "send"}
                          </span>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-6 rounded-full px-2 text-xs text-destructive"
                            onClick={async () => {
                              await setMailboxUserAccess({
                                data: {
                                  mailboxId: String(m["id"]),
                                  userId: String(a["user_id"]),
                                  canSend: false,
                                  canManage: false,
                                },
                              });
                              toast.success("Access revoked.");
                              void qc.invalidateQueries({
                                queryKey: ["email-identity-workspace"],
                              });
                            }}
                          >
                            Revoke
                          </Button>
                        </div>
                      ))}
                  </div>
                </div>
              ) : null}
            </CardContent>
          </Card>
        ))}
        {!mailboxes.length ? (
          <Card>
            <CardContent className="py-10 text-center text-muted-foreground">
              No sending accounts connected yet.
            </CardContent>
          </Card>
        ) : null}
      </div>
    </div>
  );
}
