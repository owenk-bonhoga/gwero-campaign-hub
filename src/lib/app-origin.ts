export function appOrigin(requestUrl: string): string {
  if (process.env["APP_URL"]) return new URL(process.env["APP_URL"]).origin;
  if (process.env["NODE_ENV"] === "production") return "https://os.gwerosolutions.com";
  return new URL(requestUrl).origin;
}

export function isRecipientPortal(pathname: string): boolean {
  return /^\/s\/[^/]+\/?$/.test(pathname);
}
