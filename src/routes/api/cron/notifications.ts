import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/cron/notifications")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const expected = process.env["CRON_SECRET"];
        const provided = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
        const { safeSecretEqual } = await import("@/lib/secure-share-security");
        if (!expected || !provided || !safeSecretEqual(provided, expected))
          return Response.json({ error: "Unauthorized" }, { status: 401 });
        const { runNotificationEscalations } = await import("@/lib/notifications.server");
        const { processCampaignQueue } = await import("@/lib/campaigns.server");
        const { runBidafOpportunitySync } = await import("@/lib/bidaf.server");
        const bidaf = runBidafOpportunitySync().catch((error) => ({
          status: "failed" as const,
          error: error instanceof Error ? error.message : "BidAF synchronization failed.",
        }));
        const [notifications, campaigns, opportunities] = await Promise.all([
          runNotificationEscalations(),
          processCampaignQueue(),
          bidaf,
        ]);
        return Response.json({ notifications, campaigns, opportunities });
      },
    },
  },
});
