import { validateContract } from "./input-contract";
import { requiredTablePermission } from "./security-policy";
import { createServerFn } from "@tanstack/react-start";
import { createDb, type DbInput, type DbResult } from "./db-query";
import { authMiddleware } from "./auth.middleware";

const dbAction = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: DbInput) => validateContract(input, "dbAction"))
  .handler(async ({ data, context }) => {
    const permission = requiredTablePermission(data.table, data.action);
    if (!context.user.permissions.includes(permission)) throw new Error("Permission denied");
    const { runClientQuery } = await import("./db.server");
    return runClientQuery(data, context.user) as Promise<never>;
  });

export const db = createDb((input) => dbAction({ data: input }) as Promise<DbResult<unknown>>);
