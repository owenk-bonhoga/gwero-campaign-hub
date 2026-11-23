import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import {
  Bot,
  ExternalLink,
  FileText,
  LoaderCircle,
  MessageCircle,
  RotateCcw,
  Send,
  Sparkles,
} from "lucide-react";
import {
  askGweroAssistant,
  type AssistantMessage,
  type AssistantReference,
} from "@/lib/ai-assistant.functions";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";

type ChatMessage = AssistantMessage & { id: string; references?: AssistantReference[] };

const suggestions = [
  "Find our recent RFQs about computers and include their files",
  "What opportunities need attention this week?",
  "Summarise this page and suggest the next action",
  "Find a document or client for me",
];

function safeMessages(value: unknown): ChatMessage[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter(
      (item): item is Record<string, unknown> =>
        Boolean(item) &&
        typeof item === "object" &&
        ["user", "assistant"].includes(String((item as Record<string, unknown>)["role"])) &&
        typeof (item as Record<string, unknown>)["content"] === "string",
    )
    .slice(-20)
    .map((item) => {
      const references = Array.isArray(item["references"])
        ? (item["references"].slice(0, 16) as AssistantReference[])
        : [];
      return {
        id: typeof item["id"] === "string" ? item["id"] : crypto.randomUUID(),
        role: item["role"] as "user" | "assistant",
        content: String(item["content"]).slice(0, 12_000),
        ...(references.length ? { references } : {}),
      };
    });
}

function MessageText({ text }: { text: string }) {
  const parts = useMemo(() => text.split(/(https?:\/\/[^\s<>)\]]+)/g), [text]);
  return (
    <div className="whitespace-pre-wrap break-words text-sm leading-6">
      {parts.map((part, index) =>
        /^https?:\/\//.test(part) ? (
          <a
            key={`${part}-${index}`}
            href={part}
            target="_blank"
            rel="noreferrer"
            className="font-medium text-cyan-700 underline underline-offset-2"
          >
            {part}
          </a>
        ) : (
          <span key={index}>{part}</span>
        ),
      )}
    </div>
  );
}

function References({ items }: { items: AssistantReference[] }) {
  if (!items.length) return null;
  return (
    <div className="mt-3 grid gap-2">
      {items.map((item) => {
        const external = item.type === "web";
        const content = (
          <>
            <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-white text-cyan-700 shadow-sm">
              {item.type === "file" ? (
                <FileText className="size-4" />
              ) : external ? (
                <ExternalLink className="size-4" />
              ) : (
                <Sparkles className="size-4" />
              )}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-xs font-semibold text-[#17243d]">
                {item.title}
              </span>
              <span className="block truncate text-[11px] text-[#748597]">
                {item.subtitle ||
                  (external
                    ? "Public source"
                    : item.type === "file"
                      ? "Attached file"
                      : "Gwero OS record")}
              </span>
            </span>
          </>
        );
        const className =
          "flex items-center gap-2 rounded-xl border border-[#dfe8ed] bg-[#f8fbfc] p-2 text-left transition hover:border-cyan-300 hover:bg-cyan-50/50";
        return external ? (
          <a
            key={`${item.type}:${item.url}`}
            href={item.url}
            target="_blank"
            rel="noreferrer"
            className={className}
          >
            {content}
          </a>
        ) : (
          <Link key={`${item.type}:${item.url}`} to={item.url} className={className}>
            {content}
          </Link>
        );
      })}
    </div>
  );
}

export function GlobalAiAssistant({ userId }: { userId: string }) {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const endRef = useRef<HTMLDivElement>(null);
  const storageKey = `gwero-ai-chat-v1:${userId}`;

  useEffect(() => {
    try {
      setMessages(safeMessages(JSON.parse(localStorage.getItem(storageKey) || "[]")));
    } catch {
      setMessages([]);
    }
  }, [storageKey]);
  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(messages.slice(-20)));
    } catch {
      // Storage may be disabled; the chat still works for this page session.
    }
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, pending, storageKey]);

  const submit = async (value = input) => {
    const message = value.trim();
    if (!message || pending) return;
    const userMessage: ChatMessage = { id: crypto.randomUUID(), role: "user", content: message };
    const prior = messages.slice(-10).map(({ role, content }) => ({ role, content }));
    setMessages((current) => [...current, userMessage]);
    setInput("");
    setError("");
    setPending(true);
    try {
      const response = await askGweroAssistant({
        data: {
          message,
          history: prior,
          pagePath: pathname,
          pageTitle: document.title,
        },
      });
      setMessages((current) => [
        ...current,
        {
          id: crypto.randomUUID(),
          role: "assistant",
          content: response.answer,
          references: response.references,
        },
      ]);
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "The assistant could not answer. Try again.",
      );
    } finally {
      setPending(false);
    }
  };

  const reset = () => {
    setMessages([]);
    setInput("");
    setError("");
    localStorage.removeItem(storageKey);
  };

  return (
    <>
      <Button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed bottom-5 right-5 z-40 h-12 rounded-full bg-[#17243d] px-4 text-white shadow-[0_14px_36px_rgba(23,36,61,0.28)] hover:bg-[#223354]"
        aria-label="Open Gwero AI assistant"
      >
        <MessageCircle className="size-5" />
        <span className="hidden sm:inline">Ask Gwero AI</span>
      </Button>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="right" className="flex w-full flex-col gap-0 p-0 sm:max-w-[470px]">
          <SheetHeader className="border-b border-[#e4ebef] px-5 py-4 text-left">
            <div className="flex items-start justify-between gap-4 pr-8">
              <div className="flex items-center gap-3">
                <span className="grid size-10 place-items-center rounded-2xl bg-cyan-50 text-cyan-700">
                  <Bot className="size-5" />
                </span>
                <div>
                  <SheetTitle className="text-[#17243d]">Gwero AI</SheetTitle>
                  <SheetDescription>
                    Search your permitted workspace, files and current public information.
                  </SheetDescription>
                </div>
              </div>
              {messages.length ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={reset}
                  title="Start a new chat"
                >
                  <RotateCcw className="size-4" />
                </Button>
              ) : null}
            </div>
          </SheetHeader>
          <ScrollArea className="min-h-0 flex-1 bg-[#f7f9fa]">
            <div className="space-y-4 px-4 py-5">
              {!messages.length ? (
                <div className="space-y-5">
                  <div className="rounded-2xl border border-cyan-100 bg-gradient-to-br from-white to-cyan-50 p-5">
                    <p className="font-display text-xl font-semibold tracking-[-0.03em] text-[#17243d]">
                      What can I help you find?
                    </p>
                    <p className="mt-2 text-sm leading-6 text-[#748597]">
                      I can securely search records, read supported attachments, connect related
                      information and research the public web.
                    </p>
                  </div>
                  <div className="grid gap-2">
                    {suggestions.map((suggestion) => (
                      <button
                        key={suggestion}
                        type="button"
                        onClick={() => void submit(suggestion)}
                        className="rounded-xl border border-[#dfe8ed] bg-white px-4 py-3 text-left text-sm font-medium text-[#33435d] transition hover:border-cyan-300 hover:bg-cyan-50/50"
                      >
                        {suggestion}
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}
              {messages.map((message) => (
                <div key={message.id} className={message.role === "user" ? "ml-8" : "mr-5"}>
                  <div
                    className={
                      message.role === "user"
                        ? "rounded-2xl rounded-br-md bg-[#17243d] px-4 py-3 text-white"
                        : "rounded-2xl rounded-bl-md border border-[#dfe8ed] bg-white px-4 py-3 text-[#33435d] shadow-sm"
                    }
                  >
                    <MessageText text={message.content} />
                    {message.references?.length ? <References items={message.references} /> : null}
                  </div>
                </div>
              ))}
              {pending ? (
                <div className="mr-16 flex items-center gap-2 rounded-2xl rounded-bl-md border border-[#dfe8ed] bg-white px-4 py-3 text-sm text-[#748597] shadow-sm">
                  <LoaderCircle className="size-4 animate-spin text-cyan-700" /> Searching your
                  workspace…
                </div>
              ) : null}
              {error ? (
                <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {error}
                </div>
              ) : null}
              <div ref={endRef} />
            </div>
          </ScrollArea>
          <div className="border-t border-[#e4ebef] bg-white p-4">
            <div className="rounded-2xl border border-[#ccd9df] bg-white p-2 shadow-sm focus-within:border-cyan-500 focus-within:ring-2 focus-within:ring-cyan-100">
              <Textarea
                value={input}
                onChange={(event) => setInput(event.target.value.slice(0, 4_000))}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault();
                    void submit();
                  }
                }}
                placeholder="Ask about a client, RFQ, file or public topic…"
                className="min-h-20 resize-none border-0 bg-transparent shadow-none focus-visible:ring-0"
                disabled={pending}
              />
              <div className="flex items-center justify-between gap-3 px-2 pb-1">
                <p className="text-[11px] text-[#8b9baa]">Read-only · permission aware</p>
                <Button
                  type="button"
                  size="icon"
                  onClick={() => void submit()}
                  disabled={pending || !input.trim()}
                  className="size-9 rounded-xl bg-[#17243d] text-white"
                >
                  <Send className="size-4" />
                </Button>
              </div>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
