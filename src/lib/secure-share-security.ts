import { createHash, createHmac, randomBytes, randomInt, timingSafeEqual } from "node:crypto";

export const secureToken = () => randomBytes(32).toString("hex");
export const secureTokenHash = (value: string) => createHash("sha256").update(value).digest("hex");
export const secureOtp = () => String(randomInt(0, 1_000_000)).padStart(6, "0");

export function secureShareSecret() {
  const secret = process.env["SESSION_SECRET"] || "";
  if (secret.length < 32) throw new Error("SESSION_SECRET must be configured for secure sharing.");
  return secret;
}

export function safeSecretEqual(left: string, right: string) {
  const first = createHash("sha256").update(left).digest();
  const second = createHash("sha256").update(right).digest();
  return timingSafeEqual(first, second);
}

export function secureOtpHash(code: string, sessionHash: string, secret: string) {
  if (secret.length < 32) throw new Error("SESSION_SECRET must be configured for secure sharing.");
  return createHmac("sha256", secret).update(`${sessionHash}:${code}`).digest("hex");
}

export function safeHashEqual(left: string, right: string) {
  const first = Buffer.from(left);
  const second = Buffer.from(right);
  return first.length === second.length && timingSafeEqual(first, second);
}

export function secureShareAvailable(input: {
  status: string;
  expiresAt: Date | string | null;
  recipientRevokedAt?: Date | string | null;
  now?: Date;
}) {
  const now = input.now || new Date();
  return (
    input.status === "active" &&
    !input.recipientRevokedAt &&
    (!input.expiresAt || new Date(input.expiresAt).getTime() > now.getTime())
  );
}

export function secureShareMayServe(allowDownload: boolean, requestedDownload: boolean) {
  return !requestedDownload || allowDownload;
}
