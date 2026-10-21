import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/health")({
  server: {
    handlers: {
      GET: async () => {
        try {
          const { executeRead } = await import("@/lib/db.server");
          await executeRead("SELECT 1");
          return Response.json(
            { status: "ok", database: "connected" },
            { headers: { "cache-control": "no-store" } },
          );
        } catch (error) {
          console.error("Health check failed", error);
          return Response.json(
            { status: "error", database: "unavailable" },
            { status: 503, headers: { "cache-control": "no-store" } },
          );
        }
      },
    },
  },
});
