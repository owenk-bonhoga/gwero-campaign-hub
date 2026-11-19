import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowRight,
  BriefcaseBusiness,
  Building2,
  CalendarDays,
  CircleDollarSign,
  ClipboardCheck,
  FileText,
  FolderKanban,
  Megaphone,
  Plus,
  Send,
  Users,
} from "lucide-react";
import { AppShell, money } from "@/components/AppShell";
import { MetricValue } from "@/components/ui/metric-value";
import { getDashboard } from "@/lib/dashboard.functions";
import { mayAccessPage } from "@/lib/page-access";
import type { LucideIcon } from "lucide-react";

export const Route = createFileRoute("/")({ component: Dashboard });
type Metric = {
  label: string;
  value: number | null;
  hint: string;
  to: string;
  icon: typeof Users;
  tone: string;
};

function Dashboard() {
  const { data, isLoading, error } = useQuery({
    queryKey: ["gwero-os-dashboard"],
    queryFn: () => getDashboard(),
  });
  const openTasks = data?.counts.tasks ?? null;
  const activeProjects = data?.counts.projects ?? null;
  const openBids = data?.counts.bids ?? null;
  const metrics: Metric[] = [
    {
      label: "Active clients",
      value: data?.counts.clients ?? null,
      hint: "relationships in progress",
      to: "/clients",
      icon: Building2,
      tone: "bg-violet-50 text-violet-700",
    },
    {
      label: "Active projects",
      value: activeProjects,
      hint: "delivery workspaces",
      to: "/projects",
      icon: FolderKanban,
      tone: "bg-indigo-50 text-indigo-700",
    },
    {
      label: "Open tasks",
      value: openTasks,
      hint: "items needing action",
      to: "/tasks",
      icon: ClipboardCheck,
      tone: "bg-amber-50 text-amber-700",
    },
    {
      label: "Open bids",
      value: openBids,
      hint: "opportunities in pipeline",
      to: "/bids",
      icon: BriefcaseBusiness,
      tone: "bg-emerald-50 text-emerald-700",
    },
  ];
  return (
    <AppShell
      title="Your Gwero workspace"
      description="Here is what is happening across the business today."
    >
      <div className="space-y-5">
        {data?.errors.length ? (
          <div role="alert" className="rounded-xl border border-amber-200 p-4 text-sm">
            {data.errors.join(" ")}
          </div>
        ) : null}
        {error ? (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {error.message}
          </div>
        ) : null}
        <section className="relative overflow-hidden rounded-2xl border border-violet-100 bg-gradient-to-r from-[#f8f4ff] via-white to-[#f4edff] p-5 md:p-6">
          <div className="relative z-10 max-w-2xl">
            <p className="text-xs font-bold uppercase tracking-[.2em] text-violet-600">
              Gwero OS · Business operations
            </p>
            <h2 className="mt-2 text-2xl font-bold tracking-tight text-[#21143f] md:text-3xl">
              One workspace. Every moving part.
            </h2>
            <p className="mt-3 max-w-xl text-sm leading-6 text-slate-600">
              Move opportunities from sourcing and bids through delivery, people, procurement and
              finance.
            </p>
          </div>
          <div className="absolute -right-10 -top-16 size-56 rounded-full bg-violet-200/50" />
          <div className="absolute right-36 top-14 size-28 rounded-full bg-fuchsia-100/60" />
        </section>
        <section>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-bold">Your workspace today</h2>
            <span className="text-xs text-muted-foreground">
              {isLoading ? "Updating…" : "Up to date"}
            </span>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {metrics
              .filter((metric) => mayAccessPage(metric.to, data?.permissions || []))
              .map(({ label, value, hint, to, icon: Icon, tone }) => (
                <Link
                  key={label}
                  to={to as never}
                  className="group min-w-0 rounded-xl border bg-card p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
                >
                  <div className="flex items-start justify-between">
                    <span className={`grid size-9 place-items-center rounded-xl ${tone}`}>
                      <Icon className="size-5" />
                    </span>
                    <ArrowRight className="size-4 text-slate-300 transition group-hover:translate-x-1 group-hover:text-violet-600" />
                  </div>
                  <MetricValue
                    className="mt-3 text-[#21143f]"
                    value={isLoading ? "…" : (value ?? "Unavailable")}
                    maxSize={1.75}
                  />
                  <p className="mt-1 text-sm font-semibold">{label}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
                </Link>
              ))}
          </div>
        </section>
        <section className="grid gap-4 xl:grid-cols-[1.45fr_1fr]">
          <div className="rounded-2xl border bg-card shadow-sm">
            <div className="flex items-center justify-between border-b p-4">
              <div>
                <h2 className="font-bold">Needs your attention</h2>
                <p className="mt-1 text-xs text-muted-foreground">Open work across teams</p>
              </div>
              <Link to="/tasks" className="text-sm font-semibold text-violet-700">
                View all
              </Link>
            </div>
            <div className="divide-y">
              {(data?.tasks.slice(0, 6) ?? []).map((task) => (
                <Link
                  to="/tasks"
                  key={task.id}
                  className="flex items-center gap-4 p-4 transition hover:bg-violet-50/40"
                >
                  <span className="grid size-10 place-items-center rounded-xl bg-violet-50 text-violet-700">
                    <ClipboardCheck className="size-5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">{task.title}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {task.assignee || "Unassigned"} · {task.entity_type}
                    </p>
                  </div>
                  <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs capitalize text-slate-600">
                    {task.status.replace("_", " ")}
                  </span>
                </Link>
              ))}
              {!isLoading && !data?.tasks.length ? (
                <div className="p-6 text-center text-sm text-muted-foreground">
                  No open work yet. Create a task to get the team moving.
                </div>
              ) : null}
            </div>
          </div>
          <div className="space-y-4">
            <div className="rounded-xl border bg-card p-4 shadow-sm">
              <h2 className="font-bold">Quick actions</h2>
              <div className="mt-4 grid grid-cols-2 gap-3">
                {(
                  [
                    ["/quotations", "Quotation", FileText],
                    ["/projects", "Project", FolderKanban],
                    ["/tasks", "Task", ClipboardCheck],
                    ["/campaigns", "Campaign", Send],
                  ] as Array<[string, string, LucideIcon]>
                )
                  .filter(([to]) => mayAccessPage(to, data?.permissions || []))
                  .map(([to, label, Icon]) => (
                    <Link
                      key={String(to)}
                      to={to as never}
                      className="flex min-h-20 flex-col items-center justify-center gap-2 rounded-lg border bg-[#fbf9ff] text-sm font-semibold text-[#321568] transition hover:border-violet-300 hover:bg-violet-50"
                    >
                      <Icon className="size-5" />
                      <span>
                        <Plus className="mr-1 inline size-3" />
                        {label as string}
                      </span>
                    </Link>
                  ))}
              </div>
            </div>
            {data?.permissions.includes("finance.manage") ? (
              <div className="rounded-xl border bg-card p-4 shadow-sm">
                <h2 className="font-bold">Financial snapshot</h2>
                <div className="mt-4 flex items-center gap-4">
                  <span className="grid size-12 place-items-center rounded-2xl bg-emerald-50 text-emerald-700">
                    <CircleDollarSign className="size-6" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <MetricValue
                      value={
                        data?.receivables.length
                          ? data.receivables
                              .map((row) => money(row.amount, row.currency))
                              .join(" · ")
                          : "No outstanding receivables"
                      }
                      maxSize={1.5}
                    />
                    <p className="text-xs text-muted-foreground">
                      Outstanding posted revenue by currency
                    </p>
                  </div>
                </div>
                <Link
                  to="/finance"
                  className="mt-4 flex items-center justify-between rounded-xl bg-slate-50 px-4 py-3 text-sm font-semibold"
                >
                  Open finance <ArrowRight className="size-4" />
                </Link>
              </div>
            ) : null}
          </div>
        </section>
        <section>
          <h2 className="mb-3 text-lg font-bold">Explore Gwero OS</h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
            {(
              [
                ["/marketing", "Marketing", Megaphone],
                ["/recruitment", "Recruitment", Users],
                ["/hr", "HR", Users],
                ["/payroll", "Payroll", CalendarDays],
                ["/procurement", "Procurement", BriefcaseBusiness],
                ["/documents", "Documents", FileText],
              ] as Array<[string, string, LucideIcon]>
            )
              .filter(([to]) => mayAccessPage(to, data?.permissions || []))
              .map(([to, label, Icon]) => (
                <Link
                  key={String(to)}
                  to={to as never}
                  className="flex items-center gap-3 rounded-xl border bg-card p-4 text-sm font-semibold transition hover:border-violet-300 hover:text-violet-700"
                >
                  <Icon className="size-5 text-violet-600" />
                  {label as string}
                </Link>
              ))}
          </div>
        </section>
      </div>
    </AppShell>
  );
}
