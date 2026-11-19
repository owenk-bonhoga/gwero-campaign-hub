import assert from "node:assert/strict";
import test from "node:test";
import {
  campaignTrackingToken,
  validCampaignTrackingToken,
} from "../src/lib/campaign-tracking-security.ts";
import { trustedServiceUrl } from "../src/lib/service-url-security.ts";

test("service URLs reject local targets and unapproved production origins", () => {
  const oldNodeEnv = process.env["NODE_ENV"];
  const oldAllowed = process.env["AI_ALLOWED_ORIGINS"];
  process.env["NODE_ENV"] = "production";
  process.env["AI_ALLOWED_ORIGINS"] = "https://approved.example";
  try {
    const options = {
      label: "AI base URL",
      defaultOrigins: ["https://api.openai.com"],
      allowedOriginsEnv: "AI_ALLOWED_ORIGINS",
    };
    assert.equal(
      trustedServiceUrl("https://api.openai.com/v1", options).origin,
      "https://api.openai.com",
    );
    assert.equal(
      trustedServiceUrl("https://approved.example/v1", options).origin,
      "https://approved.example",
    );
    assert.throws(() => trustedServiceUrl("http://127.0.0.1:8080", options));
    assert.throws(() => trustedServiceUrl("https://unapproved.example/v1", options));
    assert.throws(() => trustedServiceUrl("https://user:password@api.openai.com/v1", options));
  } finally {
    if (oldNodeEnv === undefined) delete process.env["NODE_ENV"];
    else process.env["NODE_ENV"] = oldNodeEnv;
    if (oldAllowed === undefined) delete process.env["AI_ALLOWED_ORIGINS"];
    else process.env["AI_ALLOWED_ORIGINS"] = oldAllowed;
  }
});

test("campaign tracking tokens bind action, recipient and destination", () => {
  const old = process.env["SESSION_SECRET"];
  process.env["SESSION_SECRET"] = "s".repeat(64);
  try {
    const recipient = "12345678-1234-1234-1234-123456789abc";
    const destination = "https://example.com/proposal";
    const token = campaignTrackingToken("click", recipient, destination);
    assert(validCampaignTrackingToken(token, "click", recipient, destination));
    assert(!validCampaignTrackingToken(token, "click", recipient, "https://attacker.example"));
    assert(!validCampaignTrackingToken(token, "open", recipient));
  } finally {
    if (old === undefined) delete process.env["SESSION_SECRET"];
    else process.env["SESSION_SECRET"] = old;
  }
});
