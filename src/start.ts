import { createStart, createCsrfMiddleware, createMiddleware } from "@tanstack/react-start";

import { isDatabaseUnavailableError } from "./lib/database-resilience";
import { renderErrorPage, renderServiceUnavailablePage } from "./lib/error-page";

const errorMiddleware = createMiddleware().server(async ({ next }) => {
  try {
    return await next();
  } catch (error) {
    if (isDatabaseUnavailableError(error)) {
      console.error(error);
      return new Response(renderServiceUnavailablePage(), {
        status: 503,
        headers: {
          "content-type": "text/html; charset=utf-8",
          "cache-control": "no-store",
          "retry-after": "5",
        },
      });
    }
    if (error != null && typeof error === "object" && "statusCode" in error) {
      throw error;
    }
    console.error(error);
    return new Response(renderErrorPage(), {
      status: 500,
      headers: { "content-type": "text/html; charset=utf-8" },
    });
  }
});

// Start installs this automatically when src/start.ts is absent; defining the
// file opts out, so re-add it explicitly to keep server functions protected
// from cross-site requests.
const csrfMiddleware = createCsrfMiddleware({
  filter: (ctx) => ctx.handlerType === "serverFn",
});

const pageAuthMiddleware = createMiddleware().server(async ({ next, request }) => {
  const url = new URL(request.url);
  const publicPath =
    url.pathname === "/login" ||
    url.pathname === "/api/health" ||
    url.pathname.startsWith("/api/public/") ||
    url.pathname.startsWith("/assets/") ||
    url.pathname.startsWith("/@") ||
    url.pathname === "/favicon.svg" ||
    url.pathname === "/robots.txt";
  const isPageRequest =
    request.method === "GET" && request.headers.get("accept")?.includes("text/html");
  if (!publicPath && isPageRequest) {
    const { currentUser } = await import("./lib/auth.server");
    if (!(await currentUser())) {
      const login = new URL("/login", url);
      login.searchParams.set("next", `${url.pathname}${url.search}`);
      return Response.redirect(login, 302);
    }
  }
  if (url.pathname === "/login" && isPageRequest) {
    const { currentUser } = await import("./lib/auth.server");
    if (await currentUser()) return Response.redirect(new URL("/", url), 302);
  }
  return next();
});

export const startInstance = createStart(() => ({
  requestMiddleware: [errorMiddleware, pageAuthMiddleware, csrfMiddleware],
}));
