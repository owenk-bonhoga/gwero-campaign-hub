export type MailProviderChoice = {
  id: string;
  label: string;
  description: string;
  mode: "oauth-google" | "oauth-microsoft" | "password";
  smtpHost?: string;
  smtpPort?: number;
  imapHost?: string;
  imapPort?: number;
};

export const mailProviderChoices: MailProviderChoice[] = [
  {
    id: "google-workspace",
    label: "Google Workspace",
    description: "Work or school Gmail account. Sign in securely with Google.",
    mode: "oauth-google",
    smtpHost: "smtp.gmail.com",
    smtpPort: 465,
    imapHost: "imap.gmail.com",
    imapPort: 993,
  },
  {
    id: "gmail",
    label: "Personal Gmail",
    description: "A personal @gmail.com account using Google sign-in.",
    mode: "oauth-google",
    smtpHost: "smtp.gmail.com",
    smtpPort: 465,
    imapHost: "imap.gmail.com",
    imapPort: 993,
  },
  {
    id: "microsoft-365",
    label: "Microsoft 365",
    description: "Business or school Microsoft account.",
    mode: "oauth-microsoft",
    smtpHost: "smtp.office365.com",
    smtpPort: 587,
    imapHost: "outlook.office365.com",
    imapPort: 993,
  },
  {
    id: "outlook",
    label: "Outlook / Hotmail",
    description: "Personal Outlook, Hotmail or Live account.",
    mode: "oauth-microsoft",
    smtpHost: "smtp-mail.outlook.com",
    smtpPort: 587,
    imapHost: "outlook.office365.com",
    imapPort: 993,
  },
  {
    id: "yahoo",
    label: "Yahoo Mail",
    description: "Connect with a Yahoo app password.",
    mode: "password",
    smtpHost: "smtp.mail.yahoo.com",
    smtpPort: 465,
    imapHost: "imap.mail.yahoo.com",
    imapPort: 993,
  },
  {
    id: "zoho",
    label: "Zoho Mail",
    description: "Zoho business or personal mail using an app password.",
    mode: "password",
    smtpHost: "smtp.zoho.com",
    smtpPort: 465,
    imapHost: "imap.zoho.com",
    imapPort: 993,
  },
  {
    id: "icloud",
    label: "Apple iCloud Mail",
    description: "Connect with an Apple app-specific password.",
    mode: "password",
    smtpHost: "smtp.mail.me.com",
    smtpPort: 587,
    imapHost: "imap.mail.me.com",
    imapPort: 993,
  },
  {
    id: "fastmail",
    label: "Fastmail",
    description: "Connect with a Fastmail app password.",
    mode: "password",
    smtpHost: "smtp.fastmail.com",
    smtpPort: 465,
    imapHost: "imap.fastmail.com",
    imapPort: 993,
  },
  {
    id: "custom",
    label: "Business/domain or other email",
    description: "cPanel, hosted business mail, or any provider offering SMTP and optional IMAP.",
    mode: "password",
    smtpPort: 587,
    imapPort: 993,
  },
];

export function providerById(id: string) {
  return mailProviderChoices.find((provider) => provider.id === id);
}
