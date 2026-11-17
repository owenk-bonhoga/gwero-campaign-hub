import assert from "node:assert/strict";
import test from "node:test";
import {
  canDeleteOwnedMailbox,
  mailboxActions,
  mayResumeMailboxSetup,
  shouldRequireEmailSetup,
} from "../src/lib/mailbox-policy.ts";
import { mailProviderChoices, providerById } from "../src/lib/mail-provider-config.ts";

test("send-only mailbox sharing never grants account management", () => {
  assert.deepEqual(mailboxActions({ isOwner: false, canSend: true }), {
    canUseForSending: true,
    canEdit: false,
    canDelete: false,
    canTest: false,
    canShare: false,
  });
});

test("mailbox owners retain all account actions", () => {
  assert.equal(mailboxActions({ isOwner: true, canSend: true }).canShare, true);
});

test("email setup requires a personally owned sending account", () => {
  assert.equal(shouldRequireEmailSetup(0), true);
  assert.equal(shouldRequireEmailSetup(1), false);
});

test("the final owned mailbox cannot be deleted", () => {
  assert.equal(canDeleteOwnedMailbox(1), false);
  assert.equal(canDeleteOwnedMailbox(2), true);
});

test("an unfinished mailbox can only be resumed by its owner", () => {
  assert.equal(mayResumeMailboxSetup("user-a", "user-a"), true);
  assert.equal(mayResumeMailboxSetup("user-a", "user-b"), false);
  assert.equal(mayResumeMailboxSetup(null, "user-a"), false);
});

test("provider catalogue covers OAuth and standard mail providers", () => {
  assert.equal(providerById("google-workspace")?.mode, "oauth-google");
  assert.equal(providerById("gmail")?.smtpHost, "smtp.gmail.com");
  assert.equal(providerById("microsoft-365")?.mode, "oauth-microsoft");
  assert.equal(providerById("outlook")?.smtpHost, "smtp-mail.outlook.com");
  assert.equal(providerById("zoho")?.smtpHost, "smtp.zoho.com");
  assert.ok(mailProviderChoices.some((provider) => provider.id === "custom"));
  for (const provider of mailProviderChoices.filter((item) => item.id !== "custom")) {
    assert.ok(provider.smtpHost, `${provider.label} needs an SMTP endpoint or fallback`);
    assert.ok(provider.smtpPort, `${provider.label} needs an SMTP port`);
    assert.ok(provider.imapHost, `${provider.label} needs an IMAP endpoint or fallback`);
    assert.ok(provider.imapPort, `${provider.label} needs an IMAP port`);
  }
});
