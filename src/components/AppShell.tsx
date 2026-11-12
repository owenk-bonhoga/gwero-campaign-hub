import { Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, type CSSProperties, type ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import {
  LayoutDashboard,
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
} from "lucide-react";
import { db } from "@/lib/db";
import { getAuthStatus, logout } from "@/lib/auth.functions";
import { syncBidafOpportunities } from "@/lib/bidaf.functions";
import {
  getNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  processNotificationEmails,
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
import { GlobalDocumentViewer } from "@/components/DocumentViewer";

type NavItem = { to: string; label: string; icon: LucideIcon };
const nav = (to: string, label: string, icon: LucideIcon): NavItem => ({ to, label, icon });

const navGroups = [
  {
    label: "Overview",
    items: [
      nav("/", "Dashboard", LayoutDashboard),
      nav("/meetings", "Calendar & meetings", CalendarDays),
    ],
  },
  {
    label: "Sales",
    items: [
      nav("/clients", "Clients", Building2),
      nav("/prospects", "Prospects", Users),
      nav("/campaigns", "Campaigns", Send),
      nav("/inbox", "Replies", Inbox),
      nav("/deals", "Deals", Handshake),
      nav("/quotations", "Quotations", FileText),
      nav("/cost-sheets", "Cost sheets", Calculator),
      nav("/vendors", "Vendors", Truck),
      nav("/marketing", "Marketing", Megaphone),
    ],
  },
  {
    label: "Bidding",
    items: [
      nav("/bids", "Bids", Gavel),
      nav("/prequalifications", "EOI / Prequalification", BadgeCheck),
      nav("/rfps", "RFPs", FileQuestion),
      nav("/rfqs", "RFQs", FileInput),
    ],
  },
  {
    label: "Delivery",
    items: [
      nav("/projects", "Projects", FolderKanban),
      nav("/jobs", "Jobs", Wrench),
      nav("/tasks", "Tasks & Activities", ListChecks),
      nav("/procurement", "Procurement", ShoppingCart),
    ],
  },
  {
    label: "People",
    items: [
      nav("/recruitment", "Recruitment", UserPlus),
      nav("/hr", "HR", IdCard),
      nav("/payroll", "Payroll", Wallet),
    ],
  },
  {
    label: "Business",
    items: [
      nav("/documents", "Documents", Files),
      nav("/document-tools", "Stamps & signatures", Stamp),
      nav("/accounts", "Portal accounts", KeyRound),
      nav("/finance", "Finance & Accounts", Receipt),
      nav("/agreements", "Agreements & SLAs", FileSignature),
      nav("/settings", "Settings", Settings),
    ],
  },
];

const allItems = navGroups.flatMap((g) => g.items);

export function AppShell({
  title,
  description,
  actions,
  children,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  const qc = useQueryClient();
  const { data: auth } = useQuery({ queryKey: ["auth-status"], queryFn: () => getAuthStatus() });
  const { data: notifications = [] } = useQuery({
    queryKey: ["notifications"],
    queryFn: () => getNotifications(),
    refetchInterval: 30_000,
  });
  const unread = notifications.filter((item) => !item.read_at);
  const { data: branding = [] } = useQuery({
    queryKey: ["app-branding"],
    queryFn: async () => {
      const { data } = await db.from("system_settings").select("*").eq("setting_group", "branding");
      return data ?? [];
    },
    staleTime: 60_000,
  });
  const brand = Object.fromEntries(
    branding.map((item) => [item.setting_key, String(item.setting_value ?? "")]),
  );
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
  }, [brand["icon_url"]]);
  useEffect(() => {
    void processNotificationEmails().catch(() => undefined);
    void syncBidafOpportunities()
      .then((result) => {
        if (result.status !== "completed" || (!result.created && !result.updated)) return;
        for (const kind of ["bid", "eoi", "rfp", "rfq"])
          void qc.invalidateQueries({ queryKey: ["opportunities", kind] });
      })
      .catch(() => undefined);
  }, [qc]);
  return (
    <div
      className="flex min-h-screen max-w-full overflow-x-clip bg-background"
      style={
        {
          fontFamily: brand["font_family"] || undefined,
          "--font-body": brand["font_family"] || undefined,
          "--font-display": brand["font_family"] || undefined,
          "--primary": brand["primary_color"] || undefined,
          "--ring": brand["primary_color"] || undefined,
          "--sidebar-primary": brand["primary_color"] || undefined,
          "--accent": brand["accent_color"] || undefined,
          "--sidebar-accent": brand["accent_color"] || undefined,
          "--gwero-brand": brand["primary_color"] || "#5b21b6",
        } as CSSProperties
      }
    >
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 flex-col border-r border-violet-100 bg-white md:flex">
        <div className="flex h-20 items-center gap-3 px-6">
          {brand["logo_url"] ? (
            <img
              src={brand["logo_url"]}
              alt={`${systemName} logo`}
              className="h-10 w-10 rounded-xl object-contain"
            />
          ) : (
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[var(--gwero-brand)] text-sm font-black text-white shadow-lg shadow-violet-200">
              {systemName.charAt(0)}
            </div>
          )}
          <div>
            <span className="font-display text-xl font-bold text-[#28104f]">{systemName}</span>
            <p className="text-[11px] font-medium text-violet-500">Operations system</p>
          </div>
        </div>
        <nav className="gwero-scrollbar flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-3 py-2">
          {navGroups.map((group) => (
            <div key={group.label} className="space-y-1">
              <p className="px-4 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                {group.label}
              </p>
              {group.items.map((item) => (
                <Link
                  key={item.to}
                  to={item.to as never}
                  activeOptions={{ exact: item.to === "/" }}
                  className="flex items-center gap-3 rounded-xl px-4 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-accent hover:text-accent-foreground"
                  activeProps={{
                    className:
                      "flex items-center gap-3 rounded-xl px-4 py-2 text-sm font-semibold bg-accent text-accent-foreground",
                  }}
                >
                  <item.icon className="h-4 w-4" />
                  {item.label}
                </Link>
              ))}
            </div>
          ))}
        </nav>
        <div className="m-3 rounded-xl bg-gradient-to-br from-[#f5efff] to-[#ede4ff] p-3">
          <p className="font-semibold text-[#321568]">Build better business.</p>
          <p className="mt-1 text-xs leading-5 text-violet-600">One connected operating system.</p>
        </div>
      </aside>

      <div className="flex w-full min-w-0 flex-1 flex-col md:pl-64">
        <header className="fixed left-0 right-0 top-0 z-30 flex min-h-20 items-center gap-4 border-b border-violet-100 bg-white/95 px-5 backdrop-blur md:left-64 md:px-8">
          <GlobalSearch />
          <div className="ml-auto flex items-center gap-2">
            <StickyNotes />
            <button aria-label="Help" className="rounded-xl p-2 text-slate-500 hover:bg-accent">
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
                    <span className="absolute -right-1 -top-1 grid min-w-5 place-items-center rounded-full bg-rose-500 px-1 text-[10px] font-bold leading-5 text-white">
                      {unread.length > 99 ? "99+" : unread.length}
                    </span>
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
                            if (item.action_url) window.location.assign(item.action_url);
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
                <button className="ml-2 flex items-center gap-2 rounded-xl px-2 py-1.5 text-left hover:bg-accent">
                  <span className="grid size-9 place-items-center rounded-full bg-accent text-xs font-bold text-accent-foreground">
                    {(auth?.user?.fullName || "Gwero User")
                      .split(/\s+/)
                      .slice(0, 2)
                      .map((part) => part.charAt(0))
                      .join("")
                      .toUpperCase()}
                  </span>
                  <span className="hidden sm:block">
                    <span className="block text-xs font-semibold">
                      {auth?.user?.fullName || "Gwero user"}
                    </span>
                    <span className="block text-[10px] text-muted-foreground">
                      {auth?.user?.roleName || "System account"}
                    </span>
                  </span>
                  <ChevronDown className="hidden size-4 text-muted-foreground sm:block" />
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
        <div className="mt-20 flex gap-1 overflow-x-auto border-b border-border bg-card px-3 py-2 md:hidden">
          {allItems.map((item) => (
            <Link
              key={item.to}
              to={item.to as never}
              activeOptions={{ exact: item.to === "/" }}
              className="whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-medium text-muted-foreground"
              activeProps={{
                className:
                  "whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-medium bg-accent text-accent-foreground",
              }}
            >
              {item.label}
            </Link>
          ))}
        </div>
        <main className="min-w-0 flex-1 overflow-x-clip p-4 md:px-6 md:pb-6 md:pt-24">
          <div className="mx-auto min-w-0 max-w-[1500px]">
            <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div className="min-w-0">
                <h1 className="break-words font-display text-2xl font-bold tracking-tight text-[#21143f]">
                  {title}
                </h1>
                {description ? (
                  <p className="mt-1.5 text-sm text-muted-foreground">{description}</p>
                ) : null}
              </div>
              {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
            </div>
            {children}
          </div>
        </main>
      </div>
      <GlobalDocumentViewer />
    </div>
  );
}

export function money(value: number | null | undefined, currency = "USD") {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(Number(value ?? 0));
}
