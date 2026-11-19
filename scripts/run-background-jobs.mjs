// Runs from the server's private operations directory, using the persistent env.
// Cron invokes Node with --env-file. No credentials are placed in arguments/logs.
const origin = process.env.APP_URL || "https://os.gwerosolutions.com";
if (!process.env.CRON_SECRET) throw new Error("CRON_SECRET is required");
const response = await fetch(new URL("/api/cron/notifications", origin), {
  method: "POST",
  headers: { authorization: `Bearer ${process.env.CRON_SECRET}` },
  signal: AbortSignal.timeout(120000),
});
if (!response.ok) throw new Error(`Background jobs returned HTTP ${response.status}`);
const result = await response.json();
console.log(
  JSON.stringify({
    at: new Date().toISOString(),
    notificationsSent: result.notifications?.sent || 0,
    campaignActions: result.campaigns?.processed || 0,
    campaignFailures: result.campaigns?.failed || 0,
    opportunitySyncStatus: result.opportunities?.status || "completed",
  }),
);
