import { validateContract } from "./input-contract";
import { createServerFn } from "@tanstack/react-start";
import { authMiddleware, permissionMiddleware } from "./auth.middleware";

export type AppNotification = {
  id: string;
  notification_type: string;
  title: string;
  body: string;
  action_url: string | null;
  read_at: string | null;
  created_at: string;
};

async function listForUser(userId: string) {
  const { serverDb } = await import("./db.server");
  const { data, error } = await serverDb
    .from("notifications")
    .select("id,notification_type,title,body,action_url,read_at,created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(40);
  if (error) throw new Error(error.message);
  return (data || []) as AppNotification[];
}

export const getNotifications = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const { requirePageAccess } = await import("./page-access.server");
    const items = await listForUser(context.user.id);
    const permitted = await Promise.all(
      items.map(async (item) => {
        if (!item.action_url) return true;
        try {
          await requirePageAccess(item.action_url, context.user);
          return true;
        } catch (error) {
          if (
            /Permission denied|Document not found|Invalid document/.test((error as Error).message)
          )
            return false;
          throw error;
        }
      }),
    );
    return items.filter((_, index) => permitted[index]);
  });

export const markNotificationRead = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((data: { notificationId: string }) => validateContract(data, "markNotificationRead"))
  .handler(async ({ data, context }) => {
    const { serverDb } = await import("./db.server");
    const { error } = await serverDb
      .from("notifications")
      .update({ read_at: new Date().toISOString() })
      .eq("id", data.notificationId)
      .eq("user_id", context.user.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const markAllNotificationsRead = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const { serverDb } = await import("./db.server");
    const { error } = await serverDb
      .from("notifications")
      .update({ read_at: new Date().toISOString() })
      .eq("user_id", context.user.id)
      .eq("read_at", null);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const processNotificationEmails = createServerFn({ method: "POST" })
  .middleware([permissionMiddleware("settings.manage")])
  .handler(async () => {
    const { runNotificationEscalations } = await import("./notifications.server");
    return runNotificationEscalations();
  });
