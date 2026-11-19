import { createHmac, timingSafeEqual } from "node:crypto";

type TrackingAction = "click" | "open";

function trackingSecret() {
  const value =
    process.env["TRACKING_SECRET"] ||
    process.env["SESSION_SECRET"] ||
    process.env["SETTINGS_ENCRYPTION_KEY"] ||
    "";
  if (value.length < 32)
    throw new Error(
      "TRACKING_SECRET, SESSION_SECRET or SETTINGS_ENCRYPTION_KEY must be configured for campaign links.",
    );
  return value;
}

export function campaignTrackingToken(
  action: TrackingAction,
  recipientId: string,
  destination = "",
) {
  return createHmac("sha256", trackingSecret())
    .update(`${action}:${recipientId}:${destination}`)
    .digest("base64url");
}

export function validCampaignTrackingToken(
  token: string | null,
  action: TrackingAction,
  recipientId: string,
  destination = "",
) {
  if (!token || !/^[A-Za-z0-9_-]{43}$/.test(token)) return false;
  const actual = Buffer.from(token);
  const expected = Buffer.from(campaignTrackingToken(action, recipientId, destination));
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}
