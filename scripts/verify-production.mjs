const expected = process.env.EXPECTED_COMMIT?.trim().toLowerCase();
const url = process.env.PRODUCTION_URL || "https://os.gwerosolutions.com";
if (!expected || !/^[0-9a-f]{40}$/.test(expected)) throw new Error("EXPECTED_COMMIT is required.");

const deadline = Date.now() + 20 * 60 * 1000;
let lastSeen = "unavailable";
while (Date.now() < deadline) {
  try {
    const response = await fetch(url, {
      redirect: "follow",
      cache: "no-store",
      signal: AbortSignal.timeout(15000),
    });
    lastSeen = response.headers.get("x-release-commit") || "missing";
    if (response.ok && lastSeen.toLowerCase() === expected) {
      const health = await fetch(new URL("/api/health", url), {
        cache: "no-store",
        signal: AbortSignal.timeout(15000),
      });
      const status = await health.json();
      if (!health.ok || status.database !== "connected")
        throw new Error("Database health check failed");
      const portal = await fetch(new URL("/s/release-smoke-missing", url), {
        headers: { accept: "text/html" },
        redirect: "manual",
        signal: AbortSignal.timeout(15000),
      });
      if (portal.status >= 500 || portal.headers.get("location")?.includes("/login"))
        throw new Error("Recipient portal is unavailable");
      console.log(`Production is healthy and identifies commit ${expected}.`);
      process.exit(0);
    }
  } catch {
    lastSeen = "request-failed";
  }
  await new Promise((resolve) => setTimeout(resolve, 15_000));
}

throw new Error(
  `Production did not identify the expected commit. Last release marker: ${lastSeen}`,
);
