import { Link, useRouter, useRouterState } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { lazy, Suspense, useState, useEffect, type CSSProperties, type ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import {
  Users,
  Send,
  Inbox,
  Building2,
  Handshake,
  FileSignature,
  FileText,
  Calculator,
  Megaphone,
  Gavel,
  BadgeCheck,
  FileQuestion,
  FileInput,
  FolderKanban,
  Wrench,
  ListChecks,
  ShoppingCart,
  Truck,
  Files,
  Stamp,
  KeyRound,
  UserPlus,
  IdCard,
  Wallet,
  Receipt,
  Bell,
  CircleHelp,
  Settings,
  LogOut,
  ChevronDown,
  CalendarDays,
  Share2,
  Home,
  ChartNoAxesColumn,
  Layers3,
  Grid2X2,
} from "lucide-react";
import { getPublicBranding } from "@/lib/settings.functions";
import { mayAccessPage } from "@/lib/page-access";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Menu } from "lucide-react";
import { getAuthStatus, logout } from "@/lib/auth.functions";
import {
  getNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from "@/lib/notifications.functions";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { StickyNotes } from "@/components/StickyNotes";
import { GlobalSearch } from "@/components/GlobalSearch";
const LazyDocumentViewer = lazy(() =>
  import("@/components/DocumentViewer").then((m) => ({ default: m.GlobalDocumentViewer })),
);

type NavItem = { to: string; label: string; icon: LucideIcon };
const nav = (to: string, label: string, icon: LucideIcon): NavItem => ({ to, label, icon });

const navGroups = [
  {
    label: "Relationships",
    icon: Users,
    items: [
      nav("/clients", "Clients", Building2),
      nav("/prospects", "Prospects", Users),
      nav("/vendors", "Vendors", Truck),
    ],
  },
  {
    label: "Sales",
    icon: ChartNoAxesColumn,
    items: [
      nav("/deals", "Deals & pipeline", Handshake),
      nav("/campaigns", "Campaigns", Send),
      nav("/inbox", "Inbox", Inbox),
      nav("/quotations", "Quotations", FileText),
      nav("/cost-sheets", "Cost sheets", Calculator),
      nav("/marketing", "Marketing", Megaphone),
    ],
  },
  {
    label: "Bids & tenders",
    icon: Gavel,
    items: [
      nav("/bids", "Bid workspace", Gavel),
      nav("/prequalifications", "EOI / Prequalification", BadgeCheck),
      nav("/rfps", "RFPs", FileQuestion),
      nav("/rfqs", "RFQs", FileInput),
    ],
  },
  {
    label: "Delivery",
    icon: Layers3,
    items: [
      nav("/projects", "Projects", FolderKanban),
      nav("/tasks", "Tasks & activities", ListChecks),
      nav("/jobs", "Jobs", Wrench),
      nav("/procurement", "Procurement", ShoppingCart),
    ],
  },
  {
    label: "Operations",
    icon: Grid2X2,
    items: [
      nav("/finance", "Finance & accounts", Receipt),
      nav("/recruitment", "Recruitment", UserPlus),
      nav("/hr", "People & HR", IdCard),
      nav("/payroll", "Payroll", Wallet),
      nav("/documents", "Documents", Files),
      nav("/secure-shares", "Secure sharing", Share2),
      nav("/document-tools", "Stamps & signatures", Stamp),
      nav("/accounts", "Portal accounts", KeyRound),
      nav("/agreements", "Agreements & SLAs", FileSignature),
      nav("/meetings", "Calendar & meetings", CalendarDays),
      nav("/settings", "Administration", Settings),
    ],
  },
];

export function AppFrame({ children }: { children: ReactNode }) {
  const router = useRouter();
  const location = useRouterState({ select: (state) => state.location });
  const [menuOpen, setMenuOpen] = useState(false);
  const activeWorkspace =
    navGroups.find((group) =>
      group.items.some(
        (item) => location.pathname === item.to || location.pathname.startsWith(`${item.to}/`),
      ),
    )?.label ?? null;
  const [expandedWorkspace, setExpandedWorkspace] = useState<string | null>(activeWorkspace);
  useEffect(() => {
    setExpandedWorkspace(activeWorkspace);
    setMenuOpen(false);
  }, [activeWorkspace, location.pathname]);
  const [viewerOpen, setViewerOpen] = useState(false);
  const [viewerTarget, setViewerTarget] = useState<{
    url: string;
    name: string;
    allowDownload: boolean;
  } | null>(null);
  useEffect(() => {
    const loadViewer = (event: MouseEvent) => {
      const anchor =
        event.target instanceof Element
          ? event.target.closest<HTMLAnchorElement>(
              'a[href*="/api/attachments/"],a[href*="/api/secure-share/document/"]',
            )
          : null;
      if (
        !anchor ||
        anchor.dataset["documentDownload"] === "true" ||
        event.button !== 0 ||
        viewerOpen
      )
        return;
      event.preventDefault();
      event.stopImmediatePropagation();
      const href = anchor.getAttribute("href") || "";
      const name = anchor.download || "";
      void import("@/components/DocumentViewer")
        .then(() => {
          setViewerTarget({
            url: href,
            name,
            allowDownload: anchor.dataset["documentDownloadDisabled"] !== "true",
          });
          setViewerOpen(true);
        })
        .catch(() => setQueryFailure("The document viewer could not be loaded. Try again."));
    };
    document.addEventListener("click", loadViewer, true);
    return () => document.removeEventListener("click", loadViewer, true);
  }, [viewerOpen]);
  const qc = useQueryClient();
  const [queryFailure, setQueryFailure] = useState<string | null>(null);
  useEffect(
    () =>
      qc.getQueryCache().subscribe((event) => {
        if (event.type === "updated" && event.action.type === "error")
          setQueryFailure(event.query.state.error?.message || "A request failed.");
      }),
    [qc],
  );
  const { data: auth } = useQuery({ queryKey: ["auth-status"], queryFn: () => getAuthStatus() });
  useEffect(() => {
    if (auth && !auth.user) void router.navigate({ to: "/login", replace: true });
  }, [auth, router]);
  useEffect(() => {
    if (!auth?.user || !auth.emailSetupRequired) return;
    const onRequiredSetup =
      location.pathname === "/settings" &&
      new URLSearchParams(location.searchStr).get("setup") === "required";
    if (onRequiredSetup) return;
    const next = `${location.pathname}${location.searchStr}`;
    void router.navigate({
      href: `/settings?tab=email&setup=required&next=${encodeURIComponent(next)}`,
      replace: true,
    });
  }, [auth, location.pathname, location.searchStr, router]);
  const { data: notifications = [] } = useQuery({
    queryKey: ["notifications"],
    queryFn: () => getNotifications(),
    refetchInterval: 30_000,
  });
  const unread = notifications.filter((item) => !item.read_at);
  const { data: brand = {} } = useQuery({
    queryKey: ["app-branding"],
    queryFn: () => getPublicBranding(),
    staleTime: 300000,
  });
  const warmPage = (path: string) => {
    if (path === "/clients")
      void import("@/lib/directory.functions").then(({ clientDirectory }) =>
        qc.prefetchQuery({
          queryKey: ["clients", "directory", "", 0],
          queryFn: () => clientDirectory({ data: { search: "", offset: 0 } }),
        }),
      );
    if (path === "/prospects")
      void import("@/lib/directory.functions").then(({ prospectDirectory }) =>
        qc.prefetchInfiniteQuery({
          queryKey: ["prospects", "directory", "", "all", "name_asc"],
          initialPageParam: 0,
          queryFn: ({ pageParam }) =>
            prospectDirectory({
              data: { search: "", category: "all", sort: "name_asc", offset: pageParam },
            }),
          getNextPageParam: (page: { nextOffset: number | null }) => page.nextOffset ?? undefined,
        }),
      );
  };
  const visibleGroups = navGroups
    .map((group) => ({
      ...group,
      items: group.items.filter((item) => mayAccessPage(item.to, auth?.user?.permissions || [])),
    }))
    .filter((group) => group.items.length);
  const systemName = brand["system_name"] || "Gwero OS";
  useEffect(() => {
    if (!brand["icon_url"]) return;
    let link = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
    if (!link) {
      link = document.createElement("link");
      link.rel = "icon";
      document.head.appendChild(link);
    }
    link.href = brand["icon_url"];
  }, [brand]);
  return (
    <div
      className="flex min-h-screen max-w-full overflow-x-clip bg-background"
      style={
        {
          fontFamily: brand["font_family"] || undefined,
          "--font-body": brand["font_family"] || undefined,
          "--font-display": brand["font_family"] || undefined,
        } as CSSProperties
      }
    >
      <aside className="gwero-sidebar fixed inset-y-0 left-0 z-40 hidden w-[246px] flex-col border-r bg-white min-[871px]:flex">
        <div className="flex h-[82px] items-center gap-3 px-7">
          {brand["logo_url"] ? (
            <img
              src={brand["logo_url"]}
              alt={`${systemName} logo`}
              className="max-h-11 w-[126px] object-contain object-left"
            />
          ) : (
            <img
              src="/gwero-logo.png"
              alt="GWERO logo"
              className="max-h-11 w-[126px] object-contain object-left"
            />
          )}
          <span className="border-l pl-2 text-[10px] font-bold tracking-[0.18em] text-[#17243d]">
            OS
          </span>
        </div>
        <nav className="gwero-scrollbar flex min-h-0 flex-1 flex-col overflow-y-auto px-4 py-5">
          <Link
            to="/"
            activeOptions={{ exact: true }}
            className="gwero-workspace-link mb-3"
            activeProps={{ className: "gwero-workspace-link mb-3 is-active" }}
          >
            <Home className="size-[18px]" />
            <span>Home</span>
          </Link>
          <div className="mb-3 border-t" />
          {visibleGroups.map((group) => {
            const expanded = expandedWorkspace === group.label;
            const active = activeWorkspace === group.label;
            const submenuId = `workspace-${group.label.toLowerCase().replaceAll(/[^a-z0-9]+/g, "-")}`;
            return (
              <div key={group.label} className="mb-1">
                <button
                  type="button"
                  className={`gwero-workspace-link w-full ${active ? "is-active" : ""}`}
                  aria-expanded={expanded}
                  aria-controls={submenuId}
                  onClick={() => setExpandedWorkspace(expanded ? null : group.label)}
                >
                  <group.icon className="size-[18px]" />
                  <span>{group.label}</span>
                  <ChevronDown
                    className={`ml-auto size-3.5 transition-transform ${expanded ? "rotate-180" : ""}`}
                  />
                </button>
                {expanded ? (
                  <div id={submenuId} className="ml-[21px] mt-1 space-y-0.5 border-l pl-4">
                    {group.items.map((item) => (
                      <Link
                        key={item.to}
                        to={item.to as never}
                        onMouseEnter={() => warmPage(item.to)}
                        onFocus={() => warmPage(item.to)}
                        className="gwero-subnav-link"
                        activeProps={{ className: "gwero-subnav-link is-active" }}
                      >
                        {item.label}
                      </Link>
                    ))}
                  </div>
                ) : null}
              </div>
            );
          })}
        </nav>
        <Link to={"/settings" as never} className="gwero-sidebar-footer mx-4 mb-5">
          <Settings className="size-4" />
          <span>Settings · Workspace</span>
        </Link>
      </aside>

      <div className="flex w-full min-w-0 flex-1 flex-col min-[871px]:pl-[246px]">
        <header className="gwero-topbar fixed left-0 right-0 top-0 z-30 flex h-[68px] items-center gap-3 border-b bg-background/95 px-4 backdrop-blur-xl min-[871px]:left-[246px] min-[871px]:h-[82px] min-[871px]:px-10">
          <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
            <SheetTrigger
              className="rounded-lg p-2 min-[871px]:hidden"
              aria-label="Open navigation"
            >
              <Menu className="size-5" />
            </SheetTrigger>
            <SheetContent side="left" className="w-[260px] overflow-y-auto p-4">
              <SheetTitle className="sr-only">Navigate Gwero OS</SheetTitle>
              <div className="flex h-14 items-center gap-3 px-3">
                {brand["logo_url"] ? (
                  <img
                    src={brand["logo_url"]}
                    alt={`${systemName} logo`}
                    className="max-h-10 w-[126px] object-contain object-left"
                  />
                ) : (
                  <img
                    src="/gwero-logo.png"
                    alt="GWERO logo"
                    className="max-h-10 w-[126px] object-contain object-left"
                  />
                )}
                <span className="border-l pl-2 text-[10px] font-bold tracking-[0.18em]">OS</span>
              </div>
              <nav aria-label="Mobile navigation" className="mt-5">
                <Link
                  to="/"
                  onClick={() => setMenuOpen(false)}
                  className="gwero-workspace-link mb-3"
                  activeProps={{ className: "gwero-workspace-link mb-3 is-active" }}
                >
                  <Home className="size-[18px]" /> Home
                </Link>
                <div className="mb-3 border-t" />
                {visibleGroups.map((group) => {
                  const expanded = expandedWorkspace === group.label;
                  const submenuId = `mobile-workspace-${group.label.toLowerCase().replaceAll(/[^a-z0-9]+/g, "-")}`;
                  return (
                    <div key={group.label} className="mb-1">
                      <button
                        type="button"
                        className={`gwero-workspace-link w-full ${activeWorkspace === group.label ? "is-active" : ""}`}
                        aria-expanded={expanded}
                        aria-controls={submenuId}
                        onClick={() => setExpandedWorkspace(expanded ? null : group.label)}
                      >
                        <group.icon className="size-[18px]" />
                        <span>{group.label}</span>
                        <ChevronDown
                          className={`ml-auto size-3.5 transition-transform ${expanded ? "rotate-180" : ""}`}
                        />
                      </button>
                      {expanded ? (
                        <div id={submenuId} className="ml-[21px] mt-1 border-l pl-4">
                          {group.items.map((item) => (
                            <Link
                              key={item.to}
                              to={item.to as never}
                              onClick={() => setMenuOpen(false)}
                              className="gwero-subnav-link"
                              activeProps={{ className: "gwero-subnav-link is-active" }}
                            >
                              {item.label}
                            </Link>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </nav>
            </SheetContent>
          </Sheet>
          <GlobalSearch />
          <div className="ml-auto flex items-center gap-2">
            <div className="hidden sm:block">
              <StickyNotes />
            </div>
            <button
              aria-label="Help"
              onClick={() => window.dispatchEvent(new CustomEvent("gwero:help"))}
              className="hidden rounded-xl p-2 text-slate-500 hover:bg-accent xl:block"
            >
              <CircleHelp className="size-5" />
            </button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  aria-label={`Notifications${unread.length ? `, ${unread.length} unread` : ""}`}
                  className="relative rounded-xl p-2 text-slate-500 hover:bg-accent"
                >
                  <Bell className="size-5" />
                  {unread.length ? (
                    <span className="absolute right-1 top-1 size-2 rounded-full border-2 border-background bg-[#f28369]" />
                  ) : null}
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-[min(92vw,380px)]">
                <div className="flex items-center justify-between px-2 py-1.5">
                  <DropdownMenuLabel className="p-0">Notifications</DropdownMenuLabel>
                  {unread.length ? (
                    <button
                      className="text-xs font-medium text-primary hover:underline"
                      onClick={() => {
                        void markAllNotificationsRead().then(() =>
                          qc.invalidateQueries({ queryKey: ["notifications"] }),
                        );
                      }}
                    >
                      Mark all read
                    </button>
                  ) : null}
                </div>
                <DropdownMenuSeparator />
                <div className="gwero-scrollbar max-h-96 overflow-y-auto">
                  {notifications.slice(0, 15).map((item) => (
                    <DropdownMenuItem
                      key={item.id}
                      className="block cursor-pointer whitespace-normal p-3"
                      onClick={() => {
                        void markNotificationRead({ data: { notificationId: item.id } }).then(
                          () => {
                            void qc.invalidateQueries({ queryKey: ["notifications"] });
                            if (item.action_url) void router.navigate({ href: item.action_url });
                          },
                        );
                      }}
                    >
                      <div className="flex items-start gap-2">
                        <span
                          className={`mt-1.5 size-2 shrink-0 rounded-full ${item.read_at ? "bg-slate-200" : "bg-primary"}`}
                        />
                        <div className="min-w-0">
                          <p className="font-medium text-slate-900">{item.title}</p>
                          <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
                            {item.body}
                          </p>
                          <time className="mt-1 block text-[10px] text-muted-foreground">
                            {new Date(item.created_at).toLocaleString()}
                          </time>
                        </div>
                      </div>
                    </DropdownMenuItem>
                  ))}
                  {!notifications.length ? (
                    <p className="px-4 py-8 text-center text-sm text-muted-foreground">
                      You are all caught up.
                    </p>
                  ) : null}
                </div>
              </DropdownMenuContent>
            </DropdownMenu>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="ml-1 flex items-center gap-2 rounded-xl px-1 py-1.5 text-left hover:bg-accent md:px-2">
                  <span className="grid size-9 place-items-center rounded-full bg-[#e8f7f9] text-xs font-bold text-[#127f96]">
                    {(auth?.user?.fullName || "Gwero User")
                      .split(/\s+/)
                      .slice(0, 2)
                      .map((part) => part.charAt(0))
                      .join("")
                      .toUpperCase()}
                  </span>
                  <span className="hidden lg:block">
                    <span className="block text-xs font-semibold">
                      {auth?.user?.fullName || "Gwero user"}
                    </span>
                    <span className="block text-[10px] text-muted-foreground">
                      {auth?.user?.roleName || "System account"}
                    </span>
                  </span>
                  <ChevronDown className="hidden size-4 text-muted-foreground lg:block" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-64">
                <DropdownMenuLabel>
                  <span className="block font-medium">{auth?.user?.fullName}</span>
                  <span className="block truncate text-xs font-normal text-muted-foreground">
                    {auth?.user?.email}
                  </span>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="text-rose-600"
                  onClick={() => {
                    void logout().finally(() => window.location.assign("/login"));
                  }}
                >
                  <LogOut className="mr-2 size-4" />
                  Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>
        <main className="min-w-0 flex-1 overflow-x-clip px-4 pb-24 pt-[96px] min-[871px]:px-8 min-[871px]:pt-[122px]">
          <div className="mx-auto min-w-0 max-w-[1130px]">
            {queryFailure ? (
              <div
                role="alert"
                className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-destructive/30 p-3 text-sm"
              >
                <span>{queryFailure}</span>
                <button
                  className="underline"
                  onClick={() => {
                    setQueryFailure(null);
                    void qc.refetchQueries({ type: "active" });
                  }}
                >
                  Try again
                </button>
                <button className="underline" onClick={() => setQueryFailure(null)}>
                  Dismiss
                </button>
              </div>
            ) : null}
            {children}
          </div>
        </main>
      </div>
      {viewerOpen ? (
        <Suspense fallback={null}>
          <LazyDocumentViewer initialTarget={viewerTarget || undefined} />
        </Suspense>
      ) : null}
      <PlatformHelp />
    </div>
  );
}

export function AppShell({
  title,
  description,
  eyebrow,
  actions,
  children,
}: {
  title: ReactNode;
  description?: string;
  eyebrow?: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const workspace =
    navGroups.find((group) =>
      group.items.some((item) => pathname === item.to || pathname.startsWith(`${item.to}/`)),
    )?.label ?? "Your workspace";
  return (
    <>
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <p className="gwero-eyebrow mb-3">{eyebrow || `${workspace} · Gwero OS`}</p>
          <h1 className="break-words font-display text-[34px] font-semibold leading-[1.12] tracking-[-0.045em] text-[#17243d] md:text-[40px]">
            {title}
          </h1>
          {description ? (
            <p className="mt-3 text-[15px] leading-6 text-[#748597]">{description}</p>
          ) : null}
        </div>
        {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
      </div>
      {children}
    </>
  );
}

function PlatformHelp() {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const show = () => setOpen(true);
    window.addEventListener("gwero:help", show);
    return () => window.removeEventListener("gwero:help", show);
  }, []);
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetContent>
        <SheetTitle>Using Gwero OS</SheetTitle>
        <div className="mt-5 space-y-4 text-sm">
          <p>
            Use the navigation menu to open a workspace. Search by company, person or reference
            using the search bar.
          </p>
          <p>
            Changes are saved within the current page. Wait for the saved confirmation before
            closing a form. A failed save keeps your input so you can retry.
          </p>
          <p>
            For a loading error, use Retry. If the problem persists, note the page and time and
            contact your system administrator. Do not create a duplicate record to work around a
            loading error.
          </p>
          <p>
            Campaigns use approval and a scheduled delivery queue. A message awaiting delivery
            review should be checked in the provider's Sent folder before retrying.
          </p>
        </div>
      </SheetContent>
    </Sheet>
  );
}

export function money(value: number | null | undefined, currency = "USD") {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(Number(value ?? 0));
}
