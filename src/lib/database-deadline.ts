import type { Pool, PoolConnection } from "mysql2/promise";

export async function acquireConnection(pool: Pool, timeoutMs = 5000): Promise<PoolConnection> {
  let expired = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const pending = pool.getConnection().then((connection) => {
    if (expired) {
      connection.release();
      throw Object.assign(new Error("Database acquisition timed out"), { code: "ETIMEDOUT" });
    }
    return connection;
  });
  try {
    return await Promise.race([
      pending,
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => {
          expired = true;
          reject(Object.assign(new Error("Database acquisition timed out"), { code: "ETIMEDOUT" }));
        }, timeoutMs);
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}

export function withDatabaseDeadlines(pool: Pool, timeoutMs: number): Pool {
  function bounded(connection: PoolConnection): PoolConnection {
    return new Proxy(connection, {
      get(target, property) {
        const value = Reflect.get(target, property);
        if (property === "query" || property === "execute")
          return (sql: unknown, values?: unknown) => {
            const options =
              typeof sql === "string"
                ? { sql, timeout: timeoutMs }
                : { ...(sql as object), timeout: timeoutMs };
            return Reflect.apply(
              value,
              target,
              values === undefined ? [options] : [options, values],
            ).catch((error: Error & { code?: string }) => {
              // Client timeouts do not cancel the server command. A busy
              // connection must not be returned to the pool for another page.
              if (["PROTOCOL_SEQUENCE_TIMEOUT", "ETIMEDOUT"].includes(error.code || ""))
                target.destroy();
              throw error;
            });
          };
        return typeof value === "function" ? value.bind(target) : value;
      },
    });
  }
  return new Proxy(pool, {
    get(target, property) {
      if (property === "getConnection")
        return async () => bounded(await acquireConnection(target, timeoutMs));
      if (property === "query" || property === "execute")
        return async (sql: unknown, values?: unknown) => {
          const connection = bounded(await acquireConnection(target, timeoutMs));
          try {
            return await Reflect.apply(
              connection[property],
              connection,
              values === undefined ? [sql] : [sql, values],
            );
          } finally {
            connection.release();
          }
        };
      const value = Reflect.get(target, property);
      return typeof value === "function" ? value.bind(target) : value;
    },
  });
}
