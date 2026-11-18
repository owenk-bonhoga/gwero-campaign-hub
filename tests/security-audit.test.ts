import assert from "node:assert/strict";
import test from "node:test";

import { classifyAuditReport } from "../scripts/audit-production.mjs";

test("allows only dependency paths caused by the approved picomatch advisory", () => {
  const result = classifyAuditReport({
    vulnerabilities: {
      picomatch: {
        severity: "high",
        via: [{ url: "https://github.com/advisories/GHSA-fc5q-39xc-vjpf" }],
      },
      tinyglobby: { severity: "high", via: ["picomatch"] },
      vite: { severity: "high", via: ["tinyglobby"] },
    },
  });

  assert.deepEqual(result, {
    allowed: ["picomatch", "tinyglobby", "vite"],
    blocking: [],
  });
});

test("blocks a different high-severity advisory and every dependent path", () => {
  const result = classifyAuditReport({
    vulnerabilities: {
      dependency: {
        severity: "high",
        via: [{ url: "https://github.com/advisories/GHSA-not-approved" }],
      },
      application: { severity: "high", via: ["dependency"] },
    },
  });

  assert.deepEqual(result, {
    allowed: [],
    blocking: ["application", "dependency"],
  });
});
