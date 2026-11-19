import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/t/click")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const params = new URL(request.url).searchParams;
        const recipientId = params.get("r");
        const target = params.get("u");
        const token = params.get("t");
        let destination = new URL("/", request.url).toString();
        let valid = false;
        if (recipientId && target && /^[0-9a-f-]{36}$/i.test(recipientId)) {
          try {
            const parsed = new URL(target);
            const { validCampaignTrackingToken } = await import("@/lib/campaign-tracking-security");
            valid =
              ["http:", "https:"].includes(parsed.protocol) &&
              validCampaignTrackingToken(token, "click", recipientId, target);
            if (valid) destination = parsed.toString();
          } catch {
            valid = false;
          }
        }

        if (recipientId && valid) {
          try {
            const { serverDb } = await import("@/lib/db.server");
            const { data: row } = await serverDb
              .from("campaign_recipients")
              .select("click_count, clicked_at")
              .eq("id", recipientId)
              .maybeSingle();
            if (row) {
              await serverDb
                .from("campaign_recipients")
                .update({
                  click_count: (row.click_count ?? 0) + 1,
                  clicked_at: row.clicked_at ?? new Date().toISOString(),
                })
                .eq("id", recipientId);
            }
          } catch (error) {
            console.error("click tracking failed", error);
          }
        }

        return new Response(null, { status: 302, headers: { location: destination } });
      },
    },
  },
});
