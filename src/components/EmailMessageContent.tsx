import { useRef, useState } from "react";
import { Image as ImageIcon, Paperclip } from "lucide-react";
import { emailAttachmentUrl, type EmailAttachment } from "@/lib/email-message";

function emailDocument(html: string, loadRemoteImages: boolean) {
  const images = loadRemoteImages ? "https: http: data:" : "data:";
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src ${images}; style-src 'unsafe-inline' https:; font-src https: data:"><base target="_blank"><style>html,body{margin:0;padding:0;background:#fff;color:#374151;font:14px/1.5 system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;overflow-wrap:anywhere}body{padding:2px}img{max-width:100%!important;height:auto!important}table{max-width:100%!important}pre{white-space:pre-wrap}a{color:#047857}</style></head><body>${html}</body></html>`;
}

export function EmailMessageContent({
  html,
  text,
  attachments,
}: {
  html?: string | null;
  text?: string | null;
  attachments?: EmailAttachment[];
}) {
  const frame = useRef<HTMLIFrameElement>(null);
  const [height, setHeight] = useState(140);
  const [loadRemoteImages, setLoadRemoteImages] = useState(false);
  const files = attachments ?? [];
  const hasRemoteImages = Boolean(html && /<img\b[^>]+src=["']https?:\/\//i.test(html));
  const resize = () => {
    const document = frame.current?.contentDocument;
    if (!document) return;
    const contentHeight = Math.max(
      document.body?.scrollHeight || 0,
      document.documentElement?.scrollHeight || 0,
    );
    setHeight(Math.min(560, Math.max(140, contentHeight + 12)));
  };

  return (
    <div className="min-w-0">
      {html ? (
        <>
          {hasRemoteImages && !loadRemoteImages ? (
            <button
              type="button"
              className="mt-2 rounded-md border bg-background px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground"
              onClick={() => setLoadRemoteImages(true)}
            >
              Load external images
            </button>
          ) : null}
          <iframe
            ref={frame}
            title="Email message"
            sandbox="allow-same-origin allow-popups allow-popups-to-escape-sandbox"
            referrerPolicy="no-referrer"
            srcDoc={emailDocument(html, loadRemoteImages)}
            onLoad={resize}
            style={{ height }}
            className="mt-2 w-full rounded-md border-0 bg-white"
          />
        </>
      ) : (
        <p className="mt-2 whitespace-pre-wrap break-words text-sm text-muted-foreground">
          {text || "No message body was provided."}
        </p>
      )}
      {files.length ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {files.map((attachment) => {
            const url = emailAttachmentUrl(attachment.path);
            const image = attachment.type?.startsWith("image/");
            return (
              <a
                key={attachment.path}
                href={url}
                target={image ? "_blank" : undefined}
                rel="noreferrer"
                download={image ? undefined : attachment.name}
                className="group inline-flex max-w-full items-center gap-2 rounded-md border bg-background px-3 py-2 text-xs hover:border-primary/50 hover:text-primary"
              >
                {image ? (
                  <img
                    src={url}
                    alt=""
                    className="size-10 shrink-0 rounded border object-contain"
                    loading="lazy"
                  />
                ) : (
                  <Paperclip className="size-3.5 shrink-0" />
                )}
                <span className="min-w-0">
                  <span className="block truncate">{attachment.name}</span>
                  {image ? (
                    <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
                      <ImageIcon className="size-3" /> Preview image
                    </span>
                  ) : null}
                </span>
              </a>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
