import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/cron/campaigns")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const expected = process.env["CRON_SECRET"];
        const provided = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
        const { safeSecretEqual } = await import("@/lib/secure-share-security");
        if (!expected || !provided || !safeSecretEqual(provided, expected))
          return Response.json({ error: "Unauthorized" }, { status: 401 });
        const { processCampaignQueue } = await import("@/lib/campaigns.server");
        return Response.json(await processCampaignQueue());
      },
    },
  },
});
