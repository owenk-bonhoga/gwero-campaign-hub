import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, ImageIcon, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { ConfirmAction } from "@/components/ConfirmAction";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
import {
  activateEmailSignature,
  deleteEmailSignature,
  getEmailIdentityWorkspace,
  saveEmailSignature,
} from "@/lib/email-identity.functions";

type Row = Record<string, unknown>;

export function EmailSignatureSettings() {
  const qc = useQueryClient();
  const { data } = useQuery({
    queryKey: ["email-identity-workspace"],
    queryFn: () => getEmailIdentityWorkspace() as Promise<{ mailboxes: Row[]; signatures: Row[] }>,
  });
  const mailboxes = data?.mailboxes || [];
  const signatures = data?.signatures || [];
  const [form, setForm] = useState({
    mailboxId: "",
    name: "",
    type: "html",
    html: "",
    text: "",
    imageUrl: "",
  });
  const save = useMutation({
    mutationFn: () => saveEmailSignature({ data: form }),
    onSuccess: () => {
      toast.success("Email signature saved.");
      setForm((current) => ({ ...current, name: "", html: "", text: "", imageUrl: "" }));
      void qc.invalidateQueries({ queryKey: ["email-identity-workspace"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });
  const activate = useMutation({
    mutationFn: (data: { mailboxId: string; signatureId: string | null }) =>
      activateEmailSignature({ data }),
    onSuccess: () => {
      toast.success(
        "Active signature updated. It will be added to every email you send from this account.",
      );
      void qc.invalidateQueries({ queryKey: ["email-identity-workspace"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });
  const remove = useMutation({
    mutationFn: (id: string) => deleteEmailSignature({ data: { id } }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["email-identity-workspace"] }),
    onError: (error: Error) => toast.error(error.message),
  });
  return (
    <div className="mt-6 grid gap-5 xl:grid-cols-[1fr_1.2fr]">
      <Card>
        <CardHeader>
          <CardTitle>Email signatures</CardTitle>
          <CardDescription>
            Create text, HTML, image, or combined signatures for each sending account.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Sending account</Label>
            <Select
              value={form.mailboxId}
              onValueChange={(mailboxId) => setForm((v) => ({ ...v, mailboxId }))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Choose your account" />
              </SelectTrigger>
              <SelectContent>
                {mailboxes.map((m) => (
                  <SelectItem key={String(m["id"])} value={String(m["id"])}>
                    {String(m["name"])} · {String(m["from_email"])}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Signature name</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm((v) => ({ ...v, name: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Format</Label>
              <Select value={form.type} onValueChange={(type) => setForm((v) => ({ ...v, type }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="text">Words / plain text</SelectItem>
                  <SelectItem value="html">HTML</SelectItem>
                  <SelectItem value="image">Image</SelectItem>
                  <SelectItem value="mixed">Text, HTML and image</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          {form.type !== "image" ? (
            <div className="space-y-2">
              <Label>{form.type === "text" ? "Signature text" : "Signature HTML"}</Label>
              <Textarea
                rows={6}
                value={form.type === "text" ? form.text : form.html}
                onChange={(e) =>
                  setForm((v) =>
                    form.type === "text"
                      ? { ...v, text: e.target.value }
                      : { ...v, html: e.target.value },
                  )
                }
                placeholder={
                  form.type === "text" ? "Kind regards…" : "<strong>Your name</strong><br>Job title"
                }
              />
            </div>
          ) : null}
          {["image", "mixed"].includes(form.type) ? (
            <div className="space-y-2">
              <Label>Public HTTPS image URL</Label>
              <Input
                type="url"
                value={form.imageUrl}
                onChange={(e) => setForm((v) => ({ ...v, imageUrl: e.target.value }))}
                placeholder="https://…/signature.png"
              />
            </div>
          ) : null}
          <Button
            onClick={() => save.mutate()}
            disabled={save.isPending || !form.mailboxId || !form.name}
          >
            Save signature
          </Button>
        </CardContent>
      </Card>
      <div className="space-y-3">
        {mailboxes.map((mailbox) => {
          const items = signatures.filter((s) => s["mailbox_id"] === mailbox["id"]);
          return (
            <Card key={String(mailbox["id"])}>
              <CardHeader>
                <CardTitle className="text-base">{String(mailbox["name"])}</CardTitle>
                <CardDescription>{String(mailbox["from_email"])}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                {items.map((signature) => {
                  const active = mailbox["active_signature_id"] === signature["id"];
                  return (
                    <div
                      key={String(signature["id"])}
                      className="flex items-center gap-3 rounded-lg border p-3"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="font-medium">{String(signature["name"])}</p>
                        <div className="flex gap-2">
                          <Badge variant="secondary">{String(signature["signature_type"])}</Badge>
                          {active ? (
                            <Badge>
                              <Check className="mr-1 size-3" />
                              Active
                            </Badge>
                          ) : null}
                        </div>
                      </div>
                      {signature["image_url"] ? (
                        <ImageIcon className="size-4 text-muted-foreground" />
                      ) : null}
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          activate.mutate({
                            mailboxId: String(mailbox["id"]),
                            signatureId: active ? null : String(signature["id"]),
                          })
                        }
                      >
                        {active ? "Disable" : "Use for every email"}
                      </Button>
                      <ConfirmAction
                        title="Delete signature?"
                        onConfirm={() => remove.mutateAsync(String(signature["id"]))}
                        trigger={
                          <Button size="icon" variant="ghost">
                            <Trash2 className="size-4 text-destructive" />
                          </Button>
                        }
                      />
                    </div>
                  );
                })}
                {!items.length ? (
                  <p className="text-sm text-muted-foreground">
                    No signatures for this account yet.
                  </p>
                ) : null}
              </CardContent>
            </Card>
          );
        })}
        {!mailboxes.length ? (
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground">
              Connect or request access to an email account first.
            </CardContent>
          </Card>
        ) : null}
      </div>
    </div>
  );
}
