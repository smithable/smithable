// Smithable app kit: sending mail from hooks and custom code (see src/custom/hooks.ts).
// The settings come from the environment, never from the code: SMTP_URL, like
// smtp://user:password@smtp.example.eu:587 (smtps:// for TLS from the first byte), or SMTP_HOST,
// SMTP_PORT, SMTP_USER and SMTP_PASSWORD; and MAIL_FROM, the sender, like
// "Stillwater Yoga <hello@stillwater.ax>". Without SMTP settings nothing leaves the machine: each
// mail is written to DATA_DIR/mail/outbox as a .eml file, which is how development and the tests
// see what would have been sent. In production that also happens, with a warning, so a hook
// never fails a request over a missing mail setting.
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { createTransport } from "nodemailer";
import { log } from "./log.server";

export interface Mail {
  to: string | string[];
  subject: string;
  /** The plain-text body; `html` is optional and shown by clients that render it. */
  text: string;
  html?: string;
  replyTo?: string;
  /** A thread mail's own id, the mail it answers and the thread's ids (mail-threads.md §4). */
  messageId?: string;
  inReplyTo?: string;
  references?: string;
}

/** Where mails go without SMTP settings. */
export const OUTBOX = join(process.env.DATA_DIR ?? "data", "mail", "outbox");

function smtp() {
  const env = process.env;
  if (env.SMTP_URL) return env.SMTP_URL;
  if (env.SMTP_HOST)
    return {
      host: env.SMTP_HOST,
      port: Number(env.SMTP_PORT ?? 587),
      secure: env.SMTP_PORT === "465",
      // On any other port the connection must turn to TLS (STARTTLS) before the password is sent:
      // a server, or someone between, that leaves it out gets no password in clear. (SMTP_URL is
      // taken as written: the hosted service's relay is on its own network, and an address may
      // ask for it with ?requireTLS=true.)
      requireTLS: env.SMTP_PORT !== "465",
      ...(env.SMTP_USER ? { auth: { user: env.SMTP_USER, pass: env.SMTP_PASSWORD ?? "" } } : {}),
    };
  return undefined;
}

/** Whether mail leaves the machine: the app has SMTP settings. */
export function mailConfigured(): boolean {
  return smtp() !== undefined;
}

/** Sends a mail, or writes it to the outbox when the app has no SMTP settings. */
export async function sendMail(mail: Mail): Promise<void> {
  // Sent by the app, not typed in a mail client (RFC 3834): auto-responders do not answer it, and
  // a mailbox watcher does not take it back in as a new mail.
  const message = {
    from: process.env.MAIL_FROM ?? "app@localhost",
    ...mail,
    headers: { "Auto-Submitted": "auto-generated" },
  };
  const settings = smtp();
  if (settings) {
    await createTransport(settings).sendMail(message);
    return;
  }
  const transport = createTransport({ streamTransport: true, buffer: true, newline: "unix" });
  const info = await transport.sendMail(message);
  mkdirSync(OUTBOX, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const id = String(info.messageId)
    .replace(/[^\w.-]/g, "")
    .slice(0, 40);
  writeFileSync(join(OUTBOX, `${stamp}-${id}.eml`), info.message as Buffer);
  if (process.env.NODE_ENV === "production")
    log.warn("A mail was not sent: no SMTP settings (SMTP_URL, or SMTP_HOST and the others)", {
      kept: OUTBOX,
    });
}

/** The mails in the outbox, oldest first, as tests read them: the headers and the text body. */
export function outbox(): {
  file: string;
  to: string;
  subject: string;
  text: string;
  messageId: string;
  inReplyTo: string;
  references: string;
  replyTo: string;
}[] {
  let files: string[];
  try {
    files = readdirSync(OUTBOX)
      .filter((f) => f.endsWith(".eml"))
      .sort();
  } catch {
    return [];
  }
  return files.map((file) => {
    const raw = readFileSync(join(OUTBOX, file), "utf8");
    const at = raw.indexOf("\n\n");
    const headers = raw.slice(0, at);
    const header = (name: string) =>
      new RegExp(`^${name}: (.*)$`, "im").exec(headers)?.[1]?.trim() ?? "";
    return {
      file,
      to: header("To"),
      subject: header("Subject"),
      text: raw.slice(at + 2).trim(),
      messageId: header("Message-ID"),
      inReplyTo: header("In-Reply-To"),
      references: header("References"),
      replyTo: header("Reply-To"),
    };
  });
}
