import assert from "node:assert/strict";
import test from "node:test";
import {
  safeHashEqual,
  safeSecretEqual,
  secureOtpHash,
  secureShareAvailable,
  secureShareMayServe,
  secureToken,
  secureTokenHash,
} from "../src/lib/secure-share-security.ts";

test("secure share tokens are opaque and stored only as hashes", () => {
  const token = secureToken();
  assert.match(token, /^[a-f0-9]{64}$/);
  assert.notEqual(secureTokenHash(token), token);
  assert(safeHashEqual(secureTokenHash(token), secureTokenHash(token)));
});

test("secret comparisons do not depend on input length", () => {
  assert(safeSecretEqual("same-secret", "same-secret"));
  assert(!safeSecretEqual("short", "a-completely-different-and-longer-secret"));
});

test("view-only recipients cannot use the download path", () => {
  assert(secureShareMayServe(false, false));
  assert(!secureShareMayServe(false, true));
  assert(secureShareMayServe(true, true));
});

test("OTP hashes are browser-session bound", () => {
  const secret = "s".repeat(64);
  assert.notEqual(
    secureOtpHash("123456", "session-a", secret),
    secureOtpHash("123456", "session-b", secret),
  );
});

test("revoked and expired shares fail closed", () => {
  const now = new Date("2026-11-16T10:00:00Z");
  assert(secureShareAvailable({ status: "active", expiresAt: "2026-11-17T10:00:00Z", now }));
  assert(!secureShareAvailable({ status: "revoked", expiresAt: null, now }));
  assert(!secureShareAvailable({ status: "active", expiresAt: "2026-11-15T10:00:00Z", now }));
  assert(
    !secureShareAvailable({ status: "active", expiresAt: null, recipientRevokedAt: now, now }),
  );
});
