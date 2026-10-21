const TRANSIENT_DATABASE_CODES = new Set([
  "ECONNREFUSED",
  "ECONNRESET",
  "ETIMEDOUT",
  "EPIPE",
  "PROTOCOL_CONNECTION_LOST",
]);

type DatabaseError = Error & {
  code?: string;
  cause?: unknown;
};

function errorCode(error: unknown): string | undefined {
  if (!error || typeof error !== "object") return undefined;
  const code = (error as DatabaseError).code;
  if (typeof code === "string") return code;
  return errorCode((error as DatabaseError).cause);
}

export function isTransientDatabaseError(error: unknown): boolean {
  const code = errorCode(error);
  return Boolean(code && TRANSIENT_DATABASE_CODES.has(code));
}

export class DatabaseUnavailableError extends Error {
  override readonly cause: unknown;

  constructor(cause: unknown) {
    super("Database temporarily unavailable");
    this.name = "DatabaseUnavailableError";
    this.cause = cause;
  }
}

export function isDatabaseUnavailableError(error: unknown): error is DatabaseUnavailableError {
  return error instanceof DatabaseUnavailableError;
}

export async function withDatabaseReadRetry<T>(
  operation: () => Promise<T>,
  options: { attempts?: number; delayMs?: number } = {},
): Promise<T> {
  const attempts = Math.max(1, Math.min(options.attempts ?? 2, 3));
  const delayMs = Math.max(0, Math.min(options.delayMs ?? 100, 1_000));
  let lastError: unknown;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      if (!isTransientDatabaseError(error)) throw error;
      if (attempt < attempts && delayMs > 0)
        await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }

  throw new DatabaseUnavailableError(lastError);
}
