import nodemailer from "nodemailer";
import { safeAddress } from "./mail-safety";
export interface SmtpConfig {
  host: string;
  port: number;
  secure: boolean;
  username: string;
  password: string;
}
export interface OutgoingMail {
  from: string;
  envelopeFrom: string;
  to: string;
  cc?: string[];
  bcc?: string[];
  raw: string;
}
function transport(config: SmtpConfig) {
  if (!config.host || !Number.isInteger(config.port) || config.port < 1 || config.port > 65535)
    throw new Error("Invalid SMTP server configuration.");
  return nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: Boolean(config.secure),
    requireTLS: !config.secure,
    tls: { rejectUnauthorized: true, minVersion: "TLSv1.2" },
    auth: config.username ? { user: config.username, pass: config.password } : undefined,
    connectionTimeout: 15000,
    greetingTimeout: 10000,
    socketTimeout: 30000,
    disableFileAccess: true,
    disableUrlAccess: true,
  });
}
export async function smtpSend(config: SmtpConfig, mail: OutgoingMail): Promise<void> {
  const client = transport(config);
  try {
    await client.sendMail({
      envelope: {
        from: safeAddress(mail.envelopeFrom),
        to: [mail.to, ...(mail.cc || []), ...(mail.bcc || [])].map(safeAddress),
      },
      raw: mail.raw,
    });
  } finally {
    client.close();
  }
}
export async function smtpVerify(config: SmtpConfig): Promise<void> {
  const client = transport(config);
  try {
    await client.verify();
  } finally {
    client.close();
  }
}
