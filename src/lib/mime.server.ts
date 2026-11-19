import { safeAddress, safeHeader } from "./mail-safety";
/** MIME message builder. Server-only. */

export interface MimeAttachment {
  filename: string;
  contentType: string;
  content: Uint8Array;
}

function b64(value: string) {
  return Buffer.from(value, "utf8").toString("base64");
}

export function encodeHeader(value: string) {
  safeHeader(value);
  // eslint-disable-next-line no-control-regex
  return /^[\x00-\x7F]*$/.test(value) ? value : `=?UTF-8?B?${b64(value)}?=`;
}

function chunk64(value: string) {
  return value.replace(/(.{76})/g, "$1\r\n");
}

export function buildMime(options: {
  from: string;
  fromName?: string | null;
  to: string;
  cc?: string[];
  bcc?: string[];
  subject: string;
  html: string;
  text: string;
  attachments?: MimeAttachment[];
  messageId: string;
}): string {
  [options.from, options.to, ...(options.cc || []), ...(options.bcc || [])].forEach(safeAddress);
  safeHeader(options.messageId, "Message ID");
  for (const attachment of options.attachments || []) {
    safeHeader(attachment.filename, "Filename");
    safeHeader(attachment.contentType, "Content type");
    attachment.filename = attachment.filename.replace(/["\\]/g, "_");
  }
  const boundaryMixed = `gwero_mix_${Math.random().toString(36).slice(2)}`;
  const boundaryAlt = `gwero_alt_${Math.random().toString(36).slice(2)}`;
  const attachments = options.attachments ?? [];

  const headers = [
    `From: ${options.fromName ? `${encodeHeader(options.fromName)} <${options.from}>` : options.from}`,
    `To: ${options.to}`,
    ...(options.cc?.length ? [`Cc: ${options.cc.join(", ")}`] : []),
    `Subject: ${encodeHeader(options.subject)}`,
    `Message-ID: ${options.messageId}`,
    `Date: ${new Date().toUTCString()}`,
    "MIME-Version: 1.0",
  ];

  const altBody = [
    `--${boundaryAlt}`,
    'Content-Type: text/plain; charset="UTF-8"',
    "Content-Transfer-Encoding: base64",
    "",
    chunk64(Buffer.from(options.text, "utf8").toString("base64")),
    `--${boundaryAlt}`,
    'Content-Type: text/html; charset="UTF-8"',
    "Content-Transfer-Encoding: base64",
    "",
    chunk64(Buffer.from(options.html, "utf8").toString("base64")),
    `--${boundaryAlt}--`,
  ].join("\r\n");

  if (!attachments.length) {
    return [
      ...headers,
      `Content-Type: multipart/alternative; boundary="${boundaryAlt}"`,
      "",
      altBody,
    ].join("\r\n");
  }

  const parts = [
    `--${boundaryMixed}`,
    `Content-Type: multipart/alternative; boundary="${boundaryAlt}"`,
    "",
    altBody,
  ];
  for (const att of attachments) {
    parts.push(
      `--${boundaryMixed}`,
      `Content-Type: ${att.contentType}; name="${att.filename}"`,
      "Content-Transfer-Encoding: base64",
      `Content-Disposition: attachment; filename="${att.filename}"`,
      "",
      chunk64(Buffer.from(att.content).toString("base64")),
    );
  }
  parts.push(`--${boundaryMixed}--`);

  return [
    ...headers,
    `Content-Type: multipart/mixed; boundary="${boundaryMixed}"`,
    "",
    parts.join("\r\n"),
  ].join("\r\n");
}
