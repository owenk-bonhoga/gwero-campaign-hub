import test from "node:test";
import assert from "node:assert/strict";
import net from "node:net";
import { PassThrough } from "node:stream";
import { smtpVerify } from "../src/lib/smtp.server";
import { buildMime } from "../src/lib/mime.server";
import { encryptMailboxSecret, decryptMailboxSecret } from "../src/lib/secret-crypto";
import { validateContract } from "../src/lib/input-contract";
import { LineSocket } from "../src/lib/socket.server";
import { mayAccessPage } from "../src/lib/page-access";
import { withRequestErrors, consumeLastCapturedError } from "../src/lib/error-capture";

test("SMTP refuses credentials when STARTTLS is unavailable", async () => {
  const commands: string[] = [];
  const server = net.createServer((socket) => {
    socket.write("220 dummy ESMTP\r\n");
    socket.on("data", (data) => {
      const command = data.toString();
      commands.push(command);
      if (command.startsWith("EHLO")) socket.write("250-dummy\r\n250 AUTH LOGIN PLAIN\r\n");
      else if (command.startsWith("STARTTLS")) socket.write("500 TLS unavailable\r\n");
      else socket.end();
    });
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  try {
    await assert.rejects(() =>
      smtpVerify({
        host: "127.0.0.1",
        port: (server.address() as net.AddressInfo).port,
        secure: false,
        username: "dummy",
        password: "never-transmit",
      }),
    );
    assert.ok(commands.some((c) => c.startsWith("STARTTLS")));
    assert.ok(!commands.some((c) => c.startsWith("AUTH")));
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});
test("MIME headers reject injected recipients, subject and attachments", () => {
  const message = {
    from: "sender@example.com",
    to: "recipient@example.com",
    subject: "Hello",
    html: "<p>Test</p>",
    text: "Test",
    messageId: "<test@example.com>",
  };
  for (const change of [
    { subject: "Hello\r\nBcc: attacker@example.com" },
    { from: "sender@example.com\r\nX: y" },
    { to: "recipient@example.com\nBcc: x@example.com" },
    {
      attachments: [
        {
          filename: "bad\r\nInjected: yes",
          content: Buffer.from("test"),
          contentType: "text/plain",
        },
      ],
    },
  ])
    assert.throws(() => buildMime({ ...message, ...change }));
  assert.match(buildMime(message), /Subject: Hello/);
});
test("mailbox encryption is authenticated, repeatable and supports legacy reads", () => {
  process.env["SETTINGS_ENCRYPTION_KEY"] = "test-only-key";
  const encoded = encryptMailboxSecret("private dummy");
  assert.notEqual(encoded, "private dummy");
  assert.equal(decryptMailboxSecret(encoded), "private dummy");
  assert.equal(encryptMailboxSecret(encoded), encoded);
  assert.equal(decryptMailboxSecret("legacy"), "legacy");
  process.env["SETTINGS_ENCRYPTION_KEY"] = "wrong-key";
  assert.throws(() => decryptMailboxSecret(encoded));
});
test("runtime contracts reject wrong types, unknown fields and oversized values", () => {
  assert.deepEqual(validateContract({ email: "a@example.com", password: "test" }, "login"), {
    email: "a@example.com",
    password: "test",
  });
  for (const value of [
    { email: [], password: "x" },
    { email: "a", password: "x", admin: true },
    { email: "a", password: Infinity },
    JSON.parse('{"email":"a","password":"x","__proto__":{}}'),
  ])
    assert.throws(() => validateContract(value as never, "login"));
  assert.throws(() =>
    validateContract({ email: "a", password: "x".repeat(3 * 1024 * 1024) }, "login"),
  );
});
test("slow trickles cannot extend a socket response deadline", async () => {
  const stream = new PassThrough();
  const socket = new LineSocket(stream);
  const timer = setInterval(() => stream.write("."), 5);
  const started = Date.now();
  try {
    await assert.rejects(() => socket.readUntil(() => false, 45), /Timed out/);
    assert.ok(Date.now() - started < 500);
  } finally {
    clearInterval(timer);
    stream.destroy();
  }
});
test("note page permissions deny unrelated modules and unknown pages", () => {
  assert.equal(mayAccessPage("/hr", ["notes.manage"]), false);
  assert.equal(mayAccessPage("/hr", ["hr.manage"]), true);
  assert.equal(mayAccessPage("/invented", ["notes.manage"]), false);
});
test("error capture cannot cross concurrent requests", async () => {
  const results = await Promise.all(
    ["first", "second"].map((name) =>
      withRequestErrors(async () => {
        console.error(new Error(name));
        await new Promise((resolve) => setTimeout(resolve, name === "first" ? 10 : 1));
        return (consumeLastCapturedError() as Error).message;
      }),
    ),
  );
  assert.deepEqual(results, ["first", "second"]);
});
