import type { AuthUser } from "./auth.server";
import { executeRead } from "./db.server";
import type { Task } from "./db.types";

export async function dashboardForUser(user: AuthUser) {
  const errors: string[] = [];
  async function count(permission: string, sql: string, label: string) {
    if (!user.permissions.includes(permission)) return null;
    try {
      const [rows] = await executeRead(sql);
      return Number((rows as Array<{ total: number }>)[0]?.total || 0);
    } catch (error) {
      console.error(error);
      errors.push(`${label} could not be updated.`);
      return null;
    }
  }
  const [clients, projects, tasks, bids, attention, receivables] = await Promise.all([
    count("clients.manage", "SELECT COUNT(*) total FROM clients WHERE status='active'", "Clients"),
    count(
      "operations.manage",
      "SELECT COUNT(*) total FROM projects WHERE status NOT IN ('completed','cancelled')",
      "Projects",
    ),
    count(
      "operations.manage",
      "SELECT COUNT(*) total FROM tasks WHERE status NOT IN ('done','completed','cancelled')",
      "Tasks",
    ),
    count(
      "opportunities.manage",
      "SELECT COUNT(*) total FROM bids WHERE archived_at IS NULL AND status NOT IN ('won','lost','withdrawn')",
      "Bids",
    ),
    user.permissions.includes("operations.manage")
      ? executeRead(
          "SELECT id,title,assignee,entity_type,status FROM tasks WHERE status NOT IN ('done','completed','cancelled') ORDER BY due_date IS NULL,due_date,created_at LIMIT 6",
        )
          .then(([rows]) => rows as Task[])
          .catch((error) => {
            console.error(error);
            errors.push("Open work could not be updated.");
            return [] as Task[];
          })
      : Promise.resolve([] as Task[]),
    user.permissions.includes("finance.manage")
      ? executeRead(
          "SELECT currency,SUM(GREATEST(total_amount-paid_amount,0)) amount FROM finance_transactions WHERE status='posted' AND transaction_type='revenue' GROUP BY currency",
        )
          .then(([rows]) => rows as Array<{ currency: string; amount: number }>)
          .catch((error) => {
            console.error(error);
            errors.push("Receivables could not be updated.");
            return [] as Array<{ currency: string; amount: number }>;
          })
      : Promise.resolve([] as Array<{ currency: string; amount: number }>),
  ]);
  return {
    counts: { clients, projects, tasks, bids },
    tasks: attention,
    receivables,
    errors,
    permissions: user.permissions,
  };
}
