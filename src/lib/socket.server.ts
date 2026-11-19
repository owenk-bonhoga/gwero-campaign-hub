/**
 * Minimal line-oriented socket helper used by the SMTP and IMAP clients.
 * Server-only.
 */
import net from "node:net";
import tls from "node:tls";
import type { Duplex } from "node:stream";

export class LineSocket {
  private socket: Duplex;
  private buffer = "";
  private waiters: Array<(chunk: string) => void> = [];
  private closed = false;
  private error: Error | null = null;

  constructor(socket: Duplex) {
    this.socket = socket;
    this.socket.setEncoding?.("utf8");
    this.socket.on("data", (chunk: string | Buffer) => {
      this.buffer += typeof chunk === "string" ? chunk : chunk.toString("utf8");
      this.flush();
    });
    this.socket.on("error", (err: Error) => {
      this.error = err;
      this.closed = true;
      this.flush();
    });
    this.socket.on("close", () => {
      this.closed = true;
      this.flush();
    });
  }

  private flush() {
    while (this.waiters.length && (this.buffer.length || this.closed)) {
      const resolve = this.waiters.shift()!;
      const data = this.buffer;
      this.buffer = "";
      resolve(data);
    }
  }

  private readChunk(timeoutMs: number): Promise<string> {
    if (this.buffer.length) {
      const data = this.buffer;
      this.buffer = "";
      return Promise.resolve(data);
    }
    if (this.error) return Promise.reject(this.error);
    if (this.closed) return Promise.reject(new Error("Connection closed by server"));
    return new Promise<string>((resolve, reject) => {
      const waiter = (chunk: string) => {
        clearTimeout(timer);
        if (this.error) reject(this.error);
        else if (!chunk && this.closed) reject(new Error("Connection closed by server"));
        else resolve(chunk);
      };
      const timer = setTimeout(() => {
        this.waiters = this.waiters.filter((pending) => pending !== waiter);
        this.socket.destroy();
        reject(new Error("Timed out waiting for the mail server"));
      }, timeoutMs);
      this.waiters.push(waiter);
    });
  }

  /** Read until `isDone` accepts the accumulated response. */
  async readUntil(isDone: (acc: string) => boolean, timeoutMs = 20000): Promise<string> {
    let acc = "";
    const deadline = Date.now() + timeoutMs;
    while (true) {
      const remaining = deadline - Date.now();
      if (remaining <= 0) {
        this.socket.destroy();
        throw new Error("Timed out waiting for the mail server");
      }
      acc += await this.readChunk(remaining);
      if (acc.length > 32 * 1024 * 1024) {
        this.socket.destroy();
        throw new Error("Mail response is too large");
      }
      if (isDone(acc)) return acc;
    }
  }

  write(data: string) {
    this.socket.write(data);
  }

  end() {
    try {
      this.socket.end();
    } catch {
      /* ignore */
    }
  }

  get raw() {
    return this.socket;
  }
}

export function connectPlain(host: string, port: number): Promise<LineSocket> {
  return new Promise((resolve, reject) => {
    const socket = net.connect({ host, port });
    const timer = setTimeout(() => {
      socket.destroy();
      reject(new Error(`Could not reach ${host}:${port}`));
    }, 20000);
    socket.once("connect", () => {
      clearTimeout(timer);
      resolve(new LineSocket(socket));
    });
    socket.once("error", (err) => {
      clearTimeout(timer);
      reject(err);
    });
  });
}

export function connectTls(host: string, port: number): Promise<LineSocket> {
  return new Promise((resolve, reject) => {
    const socket = tls.connect({ host, port, servername: host });
    const timer = setTimeout(() => {
      socket.destroy();
      reject(new Error(`Could not reach ${host}:${port}`));
    }, 20000);
    socket.once("secureConnect", () => {
      clearTimeout(timer);
      resolve(new LineSocket(socket));
    });
    socket.once("error", (err) => {
      clearTimeout(timer);
      reject(err);
    });
  });
}

export function upgradeTls(socket: LineSocket, host: string): Promise<LineSocket> {
  return new Promise((resolve, reject) => {
    const secure = tls.connect({
      socket: socket.raw as never,
      servername: host,
      minVersion: "TLSv1.2",
    });
    const timer = setTimeout(() => {
      secure.destroy();
      reject(new Error("TLS handshake timed out"));
    }, 15000);
    secure.once("secureConnect", () => {
      clearTimeout(timer);
      resolve(new LineSocket(secure));
    });
    secure.once("error", (error) => {
      clearTimeout(timer);
      reject(error);
    });
  });
}
