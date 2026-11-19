import { validateContract } from "./input-contract";
import { createServerFn } from "@tanstack/react-start";
import { permissionMiddleware } from "./auth.middleware";
import type { DirectoryInput } from "./directory.server";
export const clientDirectory = createServerFn({ method: "GET" })
  .middleware([permissionMiddleware("clients.manage")])
  .validator((data: DirectoryInput) => validateContract(data, "clientDirectory"))
  .handler(async ({ data }) => {
    const { directoryPage } = await import("./directory.server");
    return directoryPage("clients", data);
  });
export const prospectDirectory = createServerFn({ method: "GET" })
  .middleware([permissionMiddleware("prospects.view")])
  .validator((data: DirectoryInput) => validateContract(data, "prospectDirectory"))
  .handler(async ({ data }) => {
    const { directoryPage } = await import("./directory.server");
    return directoryPage("prospects", data);
  });
