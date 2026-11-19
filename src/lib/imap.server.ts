import { safeHeader } from "./mail-safety";
/** Tiny IMAP reader: fetches recent message headers from INBOX. Server-only. */
import { connectTls, type LineSocket } from "./socket.server";
import { simpleParser } from "mailparser";

export interface ImapConfig {
  host: string;
  port: number;
  username: string;
  password: string;
}

export interface ImapHeader {
  uid: string;
  from: string;
  subject: string;
  date: string;
  messageId: string;
  inReplyTo: string;
  body: string;
  bodyHtml: string;
  attachments: Array<{ name: string; type: string; data: string }>;
}

let tagCounter = 0;

async function run(socket: LineSocket, command: string) {
  const tag = `a${++tagCounter}`;
  socket.write(`${tag} ${command}\r\n`);
  const response = await socket.readUntil(
    (acc) => new RegExp(`^${tag} (OK|NO|BAD)`, "m").test(acc),
    30000,
  );
  const status = new RegExp(`^${tag} (OK|NO|BAD)([^\\n]*)`, "m").exec(response);
  if (status && status[1] !== "OK") {
    throw new Error(`Mail server refused ${command.split(" ")[0]}:${status[2] ?? ""}`);
  }
  return response;
}

function headerValue(block: string, name: string) {
  const match = new RegExp(`^${name}:\\s*(.*(?:\\r?\\n[ \\t].*)*)`, "im").exec(block);
  return match?.[1] ? match[1].replace(/\r?\n[ \t]+/g, " ").trim() : "";
}

export async function imapFetchRecent(config: ImapConfig, sinceDays = 14): Promise<ImapHeader[]> {
  const socket = await connectTls(config.host, config.port);
  try {
    await socket.readUntil((acc) => /^\* OK/m.test(acc));
    await run(
      socket,
      `LOGIN "${safeHeader(config.username).replace(/\\/g, "\\\\").replace(/"/g, '\\"')}" "${safeHeader(config.password).replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`,
    );
    await run(socket, "SELECT INBOX");

    const since = new Date(Date.now() - sinceDays * 86400000);
    const months = [
      "Jan",
      "Feb",
      "Mar",
      "Apr",
      "May",
      "Jun",
      "Jul",
      "Aug",
      "Sep",
      "Oct",
      "Nov",
      "Dec",
    ];
    const sinceStr = `${since.getUTCDate()}-${months[since.getUTCMonth()]}-${since.getUTCFullYear()}`;
    const searchRes = await run(socket, `UID SEARCH SINCE ${sinceStr}`);
    const uids = (/^\* SEARCH([^\r\n]*)/m.exec(searchRes)?.[1] ?? "")
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .slice(-50);
    if (!uids.length) return [];

    const fetchRes = await run(socket, `UID FETCH ${uids.join(",")} (UID BODY.PEEK[])`);

    const results: ImapHeader[] = [];
    const parts = fetchRes.split(/^\* \d+ FETCH /m).slice(1);
    for (const part of parts) {
      const uid = /UID (\d+)/.exec(part)?.[1] ?? "";
      const literal = part.replace(/^[\s\S]*?\{\d+\}\r?\n/, "").replace(/\r?\n\)\r?\n[\s\S]*$/, "");
      const parsed = await simpleParser(literal);
      results.push({
        uid,
        from: parsed.from?.text || headerValue(literal, "From"),
        subject: parsed.subject || headerValue(literal, "Subject"),
        date: (parsed.date || new Date()).toISOString(),
        messageId: parsed.messageId || headerValue(literal, "Message-ID"),
        inReplyTo:
          (Array.isArray(parsed.inReplyTo) ? parsed.inReplyTo[0] : parsed.inReplyTo) ||
          headerValue(literal, "In-Reply-To"),
        body: parsed.text || "",
        bodyHtml: typeof parsed.html === "string" ? parsed.html : "",
        attachments: parsed.attachments.map((attachment) => ({
          name: attachment.filename || "attachment",
          type: attachment.contentType || "application/octet-stream",
          data: attachment.content.toString("base64"),
        })),
      });
    }
    await run(socket, "LOGOUT").catch(() => undefined);
    return results;
  } finally {
    socket.end();
  }
}

export async function imapVerify(config: ImapConfig): Promise<void> {
  const socket = await connectTls(config.host, config.port);
  try {
    await socket.readUntil((acc) => /^\* OK/m.test(acc));
    await run(
      socket,
      `LOGIN "${safeHeader(config.username).replace(/\\/g, "\\\\").replace(/"/g, '\\"')}" "${safeHeader(config.password).replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`,
    );
    await run(socket, "LOGOUT").catch(() => undefined);
  } finally {
    socket.end();
  }
}
