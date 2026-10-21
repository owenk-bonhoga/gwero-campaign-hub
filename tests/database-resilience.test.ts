import test from "node:test";
import assert from "node:assert/strict";
import {
  DatabaseUnavailableError,
  isTransientDatabaseError,
  withDatabaseReadRetry,
} from "../src/lib/database-resilience.ts";

test("recognises only retryable database transport failures", () => {
  assert.equal(
    isTransientDatabaseError(Object.assign(new Error("reset"), { code: "ECONNRESET" })),
    true,
  );
  assert.equal(
    isTransientDatabaseError(
      Object.assign(new Error("lost"), { code: "PROTOCOL_CONNECTION_LOST" }),
    ),
    true,
  );
  assert.equal(
    isTransientDatabaseError(Object.assign(new Error("syntax"), { code: "ER_PARSE_ERROR" })),
    false,
  );
});

test("read retries recover from one transient connection reset", async () => {
  let attempts = 0;
  const result = await withDatabaseReadRetry(
    async () => {
      attempts += 1;
      if (attempts === 1) throw Object.assign(new Error("reset"), { code: "ECONNRESET" });
      return "connected";
    },
    { attempts: 2, delayMs: 0 },
  );
  assert.equal(result, "connected");
  assert.equal(attempts, 2);
});

test("persistent transient failures become a service-unavailable error", async () => {
  await assert.rejects(
    withDatabaseReadRetry(
      async () => {
        throw Object.assign(new Error("timeout"), { code: "ETIMEDOUT" });
      },
      { attempts: 2, delayMs: 0 },
    ),
    DatabaseUnavailableError,
  );
});

test("non-transient database errors are never retried", async () => {
  let attempts = 0;
  await assert.rejects(
    withDatabaseReadRetry(
      async () => {
        attempts += 1;
        throw Object.assign(new Error("bad query"), { code: "ER_PARSE_ERROR" });
      },
      { attempts: 3, delayMs: 0 },
    ),
    /bad query/,
  );
  assert.equal(attempts, 1);
});
