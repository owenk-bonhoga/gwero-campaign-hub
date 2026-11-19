const blockedHostnames = new Set(["localhost", "localhost.localdomain"]);
const ipLiteral = (hostname: string) =>
  /^\d{1,3}(?:\.\d{1,3}){3}$/.test(hostname) || hostname.includes(":");

function configuredOrigins(name: string) {
  return (process.env[name] || "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean)
    .map((value) => new URL(value).origin);
}

export function trustedServiceUrl(
  raw: string,
  options: { label: string; defaultOrigins: string[]; allowedOriginsEnv: string },
) {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error(`${options.label} must be a valid HTTPS URL.`);
  }
  const hostname = url.hostname.toLowerCase().replace(/\.$/, "");
  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    ipLiteral(hostname) ||
    blockedHostnames.has(hostname) ||
    hostname.endsWith(".localhost") ||
    hostname.endsWith(".local")
  )
    throw new Error(`${options.label} must use an approved public HTTPS origin.`);

  const allowed = new Set([
    ...options.defaultOrigins.map((value) => new URL(value).origin),
    ...configuredOrigins(options.allowedOriginsEnv),
  ]);
  if (process.env["NODE_ENV"] === "production" && !allowed.has(url.origin))
    throw new Error(
      `${options.label} is not approved. Add its exact origin to ${options.allowedOriginsEnv}.`,
    );
  return url;
}
