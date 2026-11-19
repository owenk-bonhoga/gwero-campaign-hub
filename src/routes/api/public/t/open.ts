import { createFileRoute } from "@tanstack/react-router";

const PIXEL = Uint8Array.from(
  atob("R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7"),
  (c) => c.charCodeAt(0),
);

export const Route = createFileRoute("/api/public/t/open")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const params = new URL(request.url).searchParams;
        const recipientId = params.get("r");
        const { validCampaignTrackingToken } = await import("@/lib/campaign-tracking-security");
        if (
          recipientId &&
          /^[0-9a-f-]{36}$/i.test(recipientId) &&
          validCampaignTrackingToken(params.get("t"), "open", recipientId)
        ) {
          try {
            const { serverDb } = await import("@/lib/db.server");
            const { data: row } = await serverDb
              .from("campaign_recipients")
              .select("open_count, opened_at")
              .eq("id", recipientId)
              .maybeSingle();
            if (row) {
              await serverDb
                .from("campaign_recipients")
                .update({
                  open_count: (row.open_count ?? 0) + 1,
                  opened_at: row.opened_at ?? new Date().toISOString(),
                })
                .eq("id", recipientId);
            }
          } catch (error) {
            console.error("open tracking failed", error);
          }
        }
        return new Response(PIXEL, {
          headers: {
            "content-type": "image/gif",
            "cache-control": "no-store, no-cache, must-revalidate, private",
          },
        });
      },
    },
  },
});
