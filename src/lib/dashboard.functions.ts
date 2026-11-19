import { createServerFn } from "@tanstack/react-start";
import { authMiddleware } from "./auth.middleware";

export const getDashboard = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const { dashboardForUser } = await import("./dashboard.server");
    return dashboardForUser(context.user);
  });
