import { randomBytes } from "node:crypto";
import "./lib/error-capture";

import { consumeLastCapturedError } from "./lib/error-capture";
import { renderErrorPage } from "./lib/error-page";

declare const __RELEASE_COMMIT__: string;

type ServerEntry = {
  fetch: (request: Request, env: unknown, ctx: unknown) => Promise<Response> | Response;
};

let serverEntryPromise: Promise<ServerEntry> | undefined;

async function getServerEntry(): Promise<ServerEntry> {
  if (!serverEntryPromise) {
    serverEntryPromise = import("@tanstack/react-start/server-entry").then(
      (m) => (m.default ?? m) as ServerEntry,
    );
  }
  return serverEntryPromise;
}

// h3 swallows in-handler throws into a normal 500 Response with body
// {"unhandled":true,"message":"HTTPError"} — try/catch alone never fires for those.
async function normalizeCatastrophicSsrResponse(response: Response): Promise<Response> {
  if (response.status < 500) return response;
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) return response;

  const body = await response.clone().text();
  if (!isH3SwallowedErrorBody(body)) return response;

  console.error(consumeLastCapturedError() ?? new Error(`h3 swallowed SSR error: ${body}`));
  return new Response(renderErrorPage(), {
    status: 500,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

function isH3SwallowedErrorBody(body: string): boolean {
  try {
    const payload = JSON.parse(body) as { unhandled?: unknown; message?: unknown };
    return payload.unhandled === true && payload.message === "HTTPError";
  } catch {
    return false;
  }
}

async function secureResponse(response: Response): Promise<Response> {
  const headers = new Headers(response.headers);
  headers.set("X-Security-Release", "20261012-gwero");
  headers.set("X-Release-Commit", __RELEASE_COMMIT__);
  headers.set("X-Content-Type-Options", "nosniff");
  headers.set("X-Frame-Options", "DENY");
  headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=(), payment=(), usb=()");
  headers.set("Strict-Transport-Security", "max-age=2592000");
  headers.set("Cache-Control", "private, no-store");
  let body: BodyInit | null = response.body;
  if ((headers.get("content-type") || "").includes("text/html") && response.body) {
    const html = await response.text();
    const nonce = randomBytes(24).toString("base64");
    headers.set(
      "Content-Security-Policy",
      `default-src 'self'; script-src 'self' 'nonce-${nonce}'; worker-src 'self' blob:; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https:; font-src 'self' data:; connect-src 'self'; frame-src 'self' https://meet.jit.si; frame-ancestors 'none'; base-uri 'self'; object-src 'none'; form-action 'self'`,
    );
    // TanStack reads this meta value when hydrating dynamically inserted scripts.
    const protectedHtml = html
      .replace(/<head([^>]*)>/i, `$&<meta property="csp-nonce" content="${nonce}">`)
      .replace(/<script\b([^>]*)>/gi, (tag, attrs) =>
        /\bnonce\s*=/i.test(attrs) ? tag : `<script nonce="${nonce}"${attrs}>`,
      );
    headers.delete("content-length");
    body = protectedHtml;
  }
  return new Response(body, { status: response.status, statusText: response.statusText, headers });
}

export default {
  async fetch(request: Request, env: unknown, ctx: unknown) {
    try {
      const handler = await getServerEntry();
      const response = await handler.fetch(request, env, ctx);
      return await secureResponse(await normalizeCatastrophicSsrResponse(response));
    } catch (error) {
      console.error(error);
      return await secureResponse(
        new Response(renderErrorPage(), {
          status: 500,
          headers: { "content-type": "text/html; charset=utf-8" },
        }),
      );
    }
  },
};
