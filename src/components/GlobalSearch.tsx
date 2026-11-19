import { useRouter } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  BadgeCheck,
  Building2,
  Calculator,
  FileQuestion,
  FileText,
  Files,
  FolderKanban,
  Gavel,
  Handshake,
  LoaderCircle,
  Megaphone,
  Search,
  Truck,
  UserRound,
  Users,
  Wrench,
  X,
} from "lucide-react";
import { searchEverywhere } from "@/lib/global-search.functions";
import type { GlobalSearchResult } from "@/lib/global-search.types";

const groupOrder = [
  "People",
  "Relationships",
  "Opportunities",
  "Work",
  "Documents & finance",
  "Communication",
] as const;

function resultIcon(kind: string) {
  if (["client_contact", "prospect_contact", "employee", "applicant", "vacancy"].includes(kind))
    return UserRound;
  if (kind === "client") return Building2;
  if (kind === "prospect") return Users;
  if (kind === "bid") return Gavel;
  if (kind === "eoi") return BadgeCheck;
  if (["rfp", "rfq"].includes(kind)) return FileQuestion;
  if (kind === "project") return FolderKanban;
  if (["job", "task"].includes(kind)) return Wrench;
  if (kind === "document") return Files;
  if (kind === "cost_sheet") return Calculator;
  if (["quotation", "agreement"].includes(kind)) return FileText;
  if (kind === "campaign") return Megaphone;
  if (kind === "supplier") return Truck;
  return Handshake;
}

function useDebouncedValue(value: string, delay: number) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timeout = window.setTimeout(() => setDebounced(value), delay);
    return () => window.clearTimeout(timeout);
  }, [delay, value]);
  return debounced;
}

function Highlight({ text, query }: { text: string; query: string }) {
  const tokens = query
    .trim()
    .split(/\s+/)
    .filter((token) => token.length > 1)
    .map((token) => token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  if (!tokens.length) return text;
  const parts = text.split(new RegExp(`(${tokens.join("|")})`, "gi"));
  return parts.map((part, index) =>
    tokens.some((token) => new RegExp(`^${token}$`, "i").test(part)) ? (
      <mark key={`${part}-${index}`} className="rounded bg-amber-100 px-0.5 text-inherit">
        {part}
      </mark>
    ) : (
      part
    ),
  );
}

export function GlobalSearch() {
  const router = useRouter();
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const debouncedQuery = useDebouncedValue(query.trim(), 180);
  const canSearch = debouncedQuery.length >= 2;
  const {
    data: results = [],
    isFetching,
    isError,
  } = useQuery({
    queryKey: ["global-search", debouncedQuery],
    queryFn: () => searchEverywhere({ data: { query: debouncedQuery } }),
    enabled: canSearch,
    staleTime: 30_000,
  });

  const grouped = useMemo(
    () =>
      groupOrder
        .map((group) => ({ group, results: results.filter((result) => result.group === group) }))
        .filter((entry) => entry.results.length),
    [results],
  );
  const displayedResults = useMemo(() => grouped.flatMap((entry) => entry.results), [grouped]);

  useEffect(() => setActiveIndex(0), [debouncedQuery, results.length]);
  useEffect(() => {
    const onPointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onShortcut = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setOpen(true);
        inputRef.current?.focus();
      }
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onShortcut);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onShortcut);
    };
  }, []);

  const choose = (result: GlobalSearchResult) => {
    setOpen(false);
    void router.navigate({ href: result.url });
  };

  return (
    <div ref={rootRef} className="relative min-w-0 max-w-2xl flex-1">
      <Search className="pointer-events-none absolute left-3 top-1/2 z-10 size-4 -translate-y-1/2 text-slate-400" />
      <input
        ref={inputRef}
        role="combobox"
        aria-label="Search across Gwero OS"
        aria-expanded={open}
        aria-controls="global-search-results"
        aria-autocomplete="list"
        value={query}
        onFocus={() => setOpen(true)}
        onChange={(event) => {
          setQuery(event.target.value);
          setOpen(true);
        }}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            setOpen(false);
            inputRef.current?.blur();
          } else if (event.key === "ArrowDown" && displayedResults.length) {
            event.preventDefault();
            setActiveIndex((current) => (current + 1) % displayedResults.length);
          } else if (event.key === "ArrowUp" && displayedResults.length) {
            event.preventDefault();
            setActiveIndex(
              (current) => (current - 1 + displayedResults.length) % displayedResults.length,
            );
          } else if (event.key === "Enter" && displayedResults[activeIndex]) {
            event.preventDefault();
            choose(displayedResults[activeIndex]);
          }
        }}
        className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 pl-10 pr-24 text-sm outline-none transition focus:border-violet-300 focus:bg-white focus:ring-4 focus:ring-violet-50"
        placeholder="Search people, clients, opportunities, documents…"
      />
      {query ? (
        <button
          type="button"
          aria-label="Clear search"
          className="absolute right-3 top-1/2 z-10 -translate-y-1/2 rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
          onClick={() => {
            setQuery("");
            inputRef.current?.focus();
          }}
        >
          <X className="size-4" />
        </button>
      ) : (
        <kbd className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 rounded-md border border-slate-200 bg-white px-2 py-0.5 text-[10px] font-medium text-slate-400 shadow-sm">
          Ctrl K
        </kbd>
      )}

      {open ? (
        <div
          id="global-search-results"
          role="listbox"
          className="absolute left-0 right-0 top-[calc(100%+0.55rem)] z-50 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl shadow-slate-900/15"
        >
          {!canSearch ? (
            <div className="p-5">
              <p className="text-sm font-semibold text-slate-900">Find anything in Gwero OS</p>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">
                Try a name, company, email, reference number, document title, or an intent such as
                “RFQ networking”, “client PPDA”, or “employee Christian”.
              </p>
            </div>
          ) : isFetching && !results.length ? (
            <div className="flex items-center gap-3 px-5 py-8 text-sm text-muted-foreground">
              <LoaderCircle className="size-4 animate-spin" /> Searching across Gwero OS…
            </div>
          ) : isError ? (
            <div className="px-5 py-8 text-center">
              <p className="text-sm font-medium text-rose-700">Search is temporarily unavailable</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Check your connection and try the search again.
              </p>
            </div>
          ) : !results.length ? (
            <div className="px-5 py-8 text-center">
              <p className="text-sm font-medium text-slate-800">No matching records</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Try a shorter name, a reference number, email address, or record type.
              </p>
            </div>
          ) : (
            <div className="gwero-scrollbar max-h-[min(68vh,560px)] overflow-y-auto p-2">
              {grouped.map((entry) => (
                <section key={entry.group} aria-label={entry.group} className="mb-2 last:mb-0">
                  <div className="flex items-center justify-between px-3 py-2">
                    <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">
                      {entry.group}
                    </p>
                    {isFetching ? (
                      <LoaderCircle className="size-3 animate-spin text-slate-300" />
                    ) : null}
                  </div>
                  {entry.results.map((result) => {
                    const index = displayedResults.indexOf(result);
                    const Icon = resultIcon(result.kind);
                    return (
                      <button
                        key={`${result.kind}-${result.id}`}
                        type="button"
                        role="option"
                        aria-selected={index === activeIndex}
                        className={`flex w-full items-start gap-3 rounded-xl px-3 py-3 text-left transition ${
                          index === activeIndex ? "bg-violet-50" : "hover:bg-slate-50"
                        }`}
                        onMouseEnter={() => setActiveIndex(index)}
                        onMouseDown={(event) => event.preventDefault()}
                        onClick={() => choose(result)}
                      >
                        <span className="mt-0.5 grid size-9 shrink-0 place-items-center rounded-xl border border-slate-100 bg-white text-violet-600 shadow-sm">
                          <Icon className="size-4" />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-semibold text-slate-900">
                            <Highlight text={result.title} query={debouncedQuery} />
                          </span>
                          {result.subtitle ? (
                            <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                              <Highlight text={result.subtitle} query={debouncedQuery} />
                            </span>
                          ) : null}
                        </span>
                        <span className="flex shrink-0 flex-col items-end gap-1 pl-2">
                          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600">
                            {result.typeLabel}
                          </span>
                          {result.meta ? (
                            <span className="max-w-28 truncate text-[10px] capitalize text-slate-400">
                              {result.meta.replaceAll("_", " ")}
                            </span>
                          ) : null}
                        </span>
                      </button>
                    );
                  })}
                </section>
              ))}
            </div>
          )}
          {canSearch ? (
            <div className="flex items-center justify-between border-t border-slate-100 bg-slate-50/80 px-4 py-2 text-[10px] text-slate-400">
              <span>
                {results.length ? `${results.length} best matches` : "Live database search"}
              </span>
              <span>↑↓ navigate · Enter open · Esc close</span>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
