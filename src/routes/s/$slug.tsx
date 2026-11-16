import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Download, FileText, LockKeyhole, LogOut, Mail, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { GlobalDocumentViewer } from "@/components/DocumentViewer";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getPublicBranding } from "@/lib/settings.functions";
import {
  leaveSecureShare,
  openSecureShare,
  requestSecureShareOtp,
  verifySecureShareOtp,
  type PublicSecureShareState,
} from "@/lib/secure-share.functions";

export const Route = createFileRoute("/s/$slug")({
  loader: () => getPublicBranding(),
  head: ({ loaderData }) => ({
    meta: [{ title: `${String(loaderData?.["system_name"] || "Gwero OS")} · Secure documents` }],
  }),
  component: SecureSharePortal,
});

function formatBytes(bytes: number) {
  return bytes < 1024 * 1024
    ? `${Math.max(1, Math.round(bytes / 1024))} KB`
    : `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function SecureSharePortal() {
  const { slug } = Route.useParams();
  const branding = Route.useLoaderData();
  const [state, setState] = useState<PublicSecureShareState | null>(null);
  const [sent, setSent] = useState(false);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const refresh = async () => setState(await openSecureShare({ data: { slug } }));
  useEffect(() => {
    void (async () => {
      try {
        const token = new URLSearchParams(window.location.search).get("k");
        const result = await openSecureShare({
          data: { slug, ...(token && /^[a-f0-9]{64}$/.test(token) ? { token } : {}) },
        });
        window.history.replaceState({}, "", `/s/${slug}`);
        setState(result);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Secure share could not be opened.");
      }
    })();
  }, [slug]);
  const act = async (action: () => Promise<unknown>) => {
    setBusy(true);
    try {
      await action();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Action failed.");
    } finally {
      setBusy(false);
    }
  };
  const systemName = String(branding?.["system_name"] || "Gwero OS");
  const logo = String(branding?.["logo_url"] || "");
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="border-b bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
          <div className="flex items-center gap-3">
            {logo ? (
              <img src={logo} alt="" className="h-9 max-w-32 object-contain" />
            ) : (
              <span className="grid size-9 place-items-center rounded-xl bg-violet-700 font-bold text-white">
                G
              </span>
            )}
            <div>
              <p className="font-semibold">{systemName}</p>
              <p className="text-xs text-muted-foreground">Secure document sharing</p>
            </div>
          </div>
          <span className="flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700">
            <ShieldCheck className="size-4" />
            Private portal
          </span>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-8">
        {!state ? (
          <div className="py-24 text-center text-sm text-muted-foreground">
            Preparing secure access…
          </div>
        ) : !state.found || state.expired || !state.identified ? (
          <AccessCard
            icon={LockKeyhole}
            title={
              state.expired
                ? "This secure share has expired"
                : !state.found
                  ? "Secure share not found"
                  : "Open your personal invitation"
            }
            body={
              state.expired
                ? "Contact the sender if you still need these documents."
                : "Use the personal link sent to your email. A copied portal address does not grant access."
            }
          />
        ) : !state.verified ? (
          <Card className="mx-auto max-w-lg border-slate-200 shadow-lg">
            <CardContent className="p-7">
              <span className="grid size-12 place-items-center rounded-2xl bg-violet-100 text-violet-700">
                <Mail />
              </span>
              <p className="mt-5 text-xs font-bold uppercase tracking-widest text-violet-600">
                Email verification
              </p>
              <h1 className="mt-2 text-2xl font-bold">{state.title}</h1>
              <p className="mt-2 text-sm text-muted-foreground">{state.description}</p>
              <p className="mt-5 text-sm">
                This invitation is for <strong>{state.email}</strong>.
              </p>
              {sent ? (
                <div className="mt-5 space-y-2">
                  <Label>Six-digit access code</Label>
                  <Input
                    value={code}
                    onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    className="h-12 text-center text-xl tracking-[.35em]"
                  />
                  <Button
                    className="w-full"
                    disabled={busy || code.length !== 6}
                    onClick={() =>
                      void act(async () => {
                        await verifySecureShareOtp({ data: { slug, code } });
                        await refresh();
                      })
                    }
                  >
                    Verify and open documents
                  </Button>
                </div>
              ) : null}
              <Button
                className="mt-3 w-full"
                variant={sent ? "outline" : "default"}
                disabled={busy}
                onClick={() =>
                  void act(async () => {
                    await requestSecureShareOtp({ data: { slug } });
                    setSent(true);
                    toast.success("Access code sent. It expires in 10 minutes.");
                  })
                }
              >
                {sent ? "Send a new code" : "Email me an access code"}
              </Button>
              <p className="mt-4 text-center text-xs text-muted-foreground">
                Verified access lasts up to 12 hours in this browser.
              </p>
            </CardContent>
          </Card>
        ) : (
          <>
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-widest text-emerald-600">
                  Verified access
                </p>
                <h1 className="mt-1 text-3xl font-bold">{state.title}</h1>
                <p className="mt-2 max-w-2xl text-muted-foreground">{state.description}</p>
                <p className="mt-2 text-xs text-muted-foreground">Signed in as {state.email}</p>
              </div>
              <Button
                variant="outline"
                disabled={busy}
                onClick={() =>
                  void act(async () => {
                    await leaveSecureShare();
                    await refresh();
                  })
                }
              >
                <LogOut className="mr-2 size-4" />
                End secure session
              </Button>
            </div>
            <div className="mt-7 grid gap-3 md:grid-cols-2">
              {state.documents.map((document) => (
                <Card key={document.id} className="border-slate-200">
                  <CardContent className="flex items-center gap-3 p-4">
                    <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-violet-50 text-violet-700">
                      <FileText className="size-5" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold">{document.name}</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {formatBytes(document.size)} ·{" "}
                        {state.allowDownload ? "View and download" : "View only"}
                      </p>
                    </div>
                    <Button size="sm" variant="outline" asChild>
                      <a
                        href={document.url}
                        download={document.name}
                        data-document-download-disabled={state.allowDownload ? "false" : "true"}
                      >
                        View
                      </a>
                    </Button>
                    {state.allowDownload ? (
                      <Button size="icon" variant="ghost" asChild>
                        <a
                          href={`${document.url}?download=1`}
                          data-document-download="true"
                          download={document.name}
                          title="Download"
                        >
                          <Download className="size-4" />
                        </a>
                      </Button>
                    ) : null}
                  </CardContent>
                </Card>
              ))}
            </div>
            <div className="mt-6 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
              {state.allowDownload
                ? "The sender allowed downloads for your access."
                : "These documents are view-only. Download controls are disabled and direct download requests are rejected by the server."}
            </div>
          </>
        )}
      </main>
      <footer className="border-t bg-white px-4 py-5 text-center text-xs text-muted-foreground">
        Protected by {systemName} · Access is logged and can be revoked immediately.
      </footer>
      <GlobalDocumentViewer />
    </div>
  );
}

function AccessCard({
  icon: Icon,
  title,
  body,
}: {
  icon: typeof LockKeyhole;
  title: string;
  body: string;
}) {
  return (
    <Card className="mx-auto max-w-lg border-slate-200 shadow-lg">
      <CardContent className="p-8 text-center">
        <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-violet-100 text-violet-700">
          <Icon className="size-7" />
        </span>
        <h1 className="mt-5 text-2xl font-bold">{title}</h1>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">{body}</p>
      </CardContent>
    </Card>
  );
}
