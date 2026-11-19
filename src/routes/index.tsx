import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowRight,
  Bell,
  BriefcaseBusiness,
  Building2,
  CheckCircle2,
  ClipboardCheck,
  FileText,
  Mail,
  Plus,
  Users,
} from "lucide-react";
import { AppShell } from "@/components/AppShell";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MetricValue } from "@/components/ui/metric-value";
import { getAuthStatus } from "@/lib/auth.functions";
import { getDashboard } from "@/lib/dashboard.functions";
import { getNotifications } from "@/lib/notifications.functions";
import { mayAccessPage } from "@/lib/page-access";
import type { LucideIcon } from "lucide-react";

export const Route = createFileRoute("/")({ component: Dashboard });

function dayGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

function shortDate(value: string) {
  const date = new Date(value);
  const today = new Date();
  if (date.toDateString() === today.toDateString()) return "Today";
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short" }).format(date);
}

function fullDate() {
  return new Intl.DateTimeFormat("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date());
}

function Dashboard() {
  const { data, isLoading, error } = useQuery({
    queryKey: ["gwero-os-dashboard"],
    queryFn: () => getDashboard(),
  });
  const { data: auth } = useQuery({ queryKey: ["auth-status"], queryFn: () => getAuthStatus() });
  const { data: notifications = [] } = useQuery({
    queryKey: ["notifications"],
    queryFn: () => getNotifications(),
  });
  const firstName = auth?.user?.fullName?.trim().split(/\s+/)[0] || "there";
  const canOpenBids = mayAccessPage("/bids", data?.permissions || []);
  const openTasks = data?.counts.tasks ?? 0;
  const glanceItems: Array<{
    label: string;
    value: number | null | undefined;
    icon: LucideIcon;
    to: string;
  }> = [
    { label: "Clients", value: data?.counts.clients, icon: Building2, to: "/clients" },
    { label: "Open bids", value: data?.counts.bids, icon: BriefcaseBusiness, to: "/bids" },
    { label: "My to-dos", value: data?.counts.tasks, icon: CheckCircle2, to: "/tasks" },
  ];

  return (
    <AppShell
      title={
        <>
          {dayGreeting()}, {firstName}
          <span className="text-[#40b6c8]">.</span>
        </>
      }
      description="A little clarity for the work ahead."
      eyebrow={fullDate()}
      actions={
        <DropdownMenu>
          <DropdownMenuTrigger className="gwero-primary-action">
            <Plus className="size-4" /> Create new
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-52">
            <DropdownMenuLabel>Create in Gwero OS</DropdownMenuLabel>
            {mayAccessPage("/tasks", data?.permissions || []) ? (
              <DropdownMenuItem asChild>
                <Link to="/tasks">Task or activity</Link>
              </DropdownMenuItem>
            ) : null}
            {mayAccessPage("/clients", data?.permissions || []) ? (
              <DropdownMenuItem asChild>
                <Link to="/clients">Client</Link>
              </DropdownMenuItem>
            ) : null}
            {mayAccessPage("/bids", data?.permissions || []) ? (
              <DropdownMenuItem asChild>
                <Link to="/bids">Bid or tender</Link>
              </DropdownMenuItem>
            ) : null}
            {mayAccessPage("/projects", data?.permissions || []) ? (
              <DropdownMenuItem asChild>
                <Link to="/projects">Project</Link>
              </DropdownMenuItem>
            ) : null}
          </DropdownMenuContent>
        </DropdownMenu>
      }
    >
      {data?.errors.length ? (
        <div role="alert" className="mb-5 rounded-xl border border-amber-200 p-4 text-sm">
          {data.errors.join(" ")}
        </div>
      ) : null}
      {error ? (
        <div
          role="alert"
          className="mb-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700"
        >
          {error.message}
        </div>
      ) : null}

      <div className="grid gap-5 min-[651px]:grid-cols-[minmax(0,1.55fr)_minmax(250px,1fr)]">
        <section className="gwero-dashboard-feature gwero-panel relative min-h-[294px] overflow-hidden p-7 md:p-8">
          <div className="relative z-10">
            <p className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.14em] text-[#788b98]">
              <span className="size-1.5 rounded-full bg-[#40b6c8]" /> A good place to start
            </p>
            <h2 className="mt-8 max-w-md text-[28px] font-semibold leading-[1.16] tracking-[-0.045em] md:text-[33px]">
              {canOpenBids && Number(data?.counts.bids || 0) > 0
                ? "Move your next bid forward."
                : openTasks > 0
                  ? "Make progress on your open work."
                  : "Your workspace is clear."}
            </h2>
            <p className="mt-3 max-w-md text-sm leading-6 text-[#697d8f]">
              {canOpenBids && Number(data?.counts.bids || 0) > 0
                ? "Review the latest requirements, confirm the important details and keep the opportunity moving."
                : openTasks > 0
                  ? "Review the work that needs attention and keep the team moving with a clear next action."
                  : "Nothing urgent is waiting. This is a good time to plan the work ahead."}
            </p>
          </div>
          <div className="absolute inset-x-7 bottom-7 z-10 flex items-center justify-between gap-4 md:inset-x-8 md:bottom-8">
            <div className="flex min-w-0 items-center gap-2 text-[11px] text-[#748b9a]">
              <span className="rounded-md bg-[#e8f7f9] px-2 py-1.5 font-semibold text-[#127f96]">
                {canOpenBids && Number(data?.counts.bids || 0) > 0 ? "Bids & tenders" : "Tasks"}
              </span>
              <span className="truncate">Your workspace</span>
            </div>
            <Link
              to={canOpenBids && Number(data?.counts.bids || 0) > 0 ? "/bids" : "/tasks"}
              className="gwero-primary-action shrink-0"
            >
              Open {canOpenBids && Number(data?.counts.bids || 0) > 0 ? "bid" : "tasks"}
              <ArrowRight className="size-4" />
            </Link>
          </div>
        </section>

        <section className="gwero-panel p-6 md:p-7">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-[15px] font-semibold">At a glance</h2>
            <span className="text-[11px] text-[#a1adb8]">Your workspace</span>
          </div>
          <div className="mt-5 grid grid-cols-3 gap-3 min-[651px]:block">
            {glanceItems
              .filter((item) => mayAccessPage(item.to, data?.permissions || []))
              .map(({ label, value, icon: Icon, to }) => (
                <Link
                  key={label}
                  to={to as never}
                  className="flex min-w-0 flex-col gap-2 border-b py-4 last:border-0 lg:flex-row lg:items-center"
                >
                  <span className="grid size-9 shrink-0 place-items-center rounded-[10px] bg-[#eaf8fa] text-[#168a9c]">
                    <Icon className="size-4" />
                  </span>
                  <span className="min-w-0 flex-1 text-xs text-[#728295]">{label}</span>
                  <MetricValue
                    className="text-left text-[#26354d] lg:text-right"
                    value={isLoading ? "…" : (value ?? "—")}
                    maxSize={1.45}
                  />
                </Link>
              ))}
          </div>
        </section>

        <section className="gwero-panel min-h-[276px] p-6 md:p-7">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-semibold">After that</h2>
            <Link to="/tasks" className="text-xs font-semibold text-[#168196]">
              All tasks <ArrowRight className="ml-1 inline size-3" />
            </Link>
          </div>
          <div className="mt-5 divide-y">
            {(data?.tasks.slice(0, 3) ?? []).map((task) => (
              <Link key={task.id} to="/tasks" className="flex min-h-[58px] items-center gap-3">
                <span className="size-[18px] shrink-0 rounded-md border border-[#d0dee3]" />
                <span className="min-w-0 flex-1 truncate text-[13px] text-[#324158]">
                  {task.title}
                </span>
                <span className="rounded-md bg-[#f6f8f9] px-2 py-1 text-[10px] capitalize text-[#83919b]">
                  {task.status.replaceAll("_", " ")}
                </span>
              </Link>
            ))}
            {!isLoading && !data?.tasks.length ? (
              <div className="py-10 text-center text-sm text-muted-foreground">
                No open work needs attention.
              </div>
            ) : null}
          </div>
        </section>

        <section className="gwero-panel min-h-[276px] p-6 md:p-7">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-semibold">Latest updates</h2>
            <Link to="/inbox" className="text-xs font-semibold text-[#168196]">
              Open inbox <ArrowRight className="ml-1 inline size-3" />
            </Link>
          </div>
          <div className="mt-4 divide-y">
            {notifications.slice(0, 3).map((notification) => (
              <a
                key={notification.id}
                href={notification.action_url || undefined}
                className="flex items-start gap-3 py-3"
              >
                <span className="grid size-9 shrink-0 place-items-center rounded-[10px] bg-[#f3f8fa] text-[#7d95a5]">
                  {notification.notification_type.includes("mail") ? (
                    <Mail className="size-4" />
                  ) : notification.notification_type.includes("document") ? (
                    <FileText className="size-4" />
                  ) : (
                    <Bell className="size-4" />
                  )}
                </span>
                <span className="min-w-0 flex-1">
                  <strong className="block truncate text-xs font-semibold text-[#344358]">
                    {notification.title}
                  </strong>
                  <span className="mt-1 block line-clamp-1 text-xs text-[#758898]">
                    {notification.body}
                  </span>
                </span>
                <time className="shrink-0 pt-0.5 text-[10px] text-[#b2bdc6]">
                  {shortDate(notification.created_at)}
                </time>
              </a>
            ))}
            {!notifications.length ? (
              <div className="py-10 text-center text-sm text-muted-foreground">
                You are all caught up.
              </div>
            ) : null}
          </div>
        </section>
      </div>

      <div className="mt-6 flex flex-wrap justify-between gap-2 px-1 text-[11px] text-[#abb7c1]">
        <span>GWERO OS · A simpler view of the work that matters</span>
        <span className="flex items-center gap-1.5">
          <ClipboardCheck className="size-3.5 text-[#83bfbd]" /> Live workspace data
        </span>
      </div>
    </AppShell>
  );
}
