// Smithable app kit: outgoing mail (docs/design/integrations.md §4.1b). A change that someone is
// to hear about writes its mail into the outbox table in the change's own transaction, so there
// is no mail for a change that did not happen and no change without its mail; it is sent after,
// and a mail that cannot be sent is tried again with growing pauses for a day, then given up and
// shown in Activity, where an administrator can send it again.
import { and, eq, isNull, lte } from "drizzle-orm";
import { db } from "#/db";
import { outgoingMail } from "#/db/schema";
import { AccessDenied, type Viewer } from "./access";
import { audit } from "./audit.server";
import { log } from "./log.server";
import { sendMail } from "./mail";
import { pauseAfter } from "./outgoing";
import { outsideTrace } from "./trace.server";
import { w } from "./words";

const MINUTE = 60_000;
const DAY = 24 * 60 * MINUTE;

/** The database, or a transaction in it: what a mail is queued with. */
type Writer = {
  insert(table: typeof outgoingMail): {
    values(row: typeof outgoingMail.$inferInsert): { run(): unknown };
  };
};

/** Someone to mail: a user (by id, so their own change can be told apart) or an address. */
export interface Recipient {
  id?: string | null;
  email?: string | null;
}

/** What happened to which record, and how the mail shows it. */
export interface Happening {
  /** The entry's name in smithable.yml, e.g. bookingMade. */
  entry: string;
  model: string;
  record: number;
  subject: string;
  /** The content file's text, above the record. */
  text?: string;
  /** The record's fields as its page shows them: label and formatted value. */
  fields: [string, string][];
  /** The record's page, e.g. /bookings/12. */
  link?: string;
}

/** The address the app's own pages are at, for the link in a mail. */
function base(): string {
  return process.env.BETTER_AUTH_URL ?? (import.meta.env.DEV ? "http://localhost:3000" : "");
}

/** The mail's text: the content file's words, the record's fields, a link to it. */
export function mailText(happening: Happening, at = base()): string {
  return [
    happening.text,
    happening.fields.map(([label, value]) => `${label}: ${value}`).join("\n"),
    happening.link && at ? `${w.openIt}: ${at.replace(/\/$/, "")}${happening.link}` : undefined,
  ]
    .filter(Boolean)
    .join("\n\n");
}

/**
 * Queues the mail to each recipient with an address, in the change's transaction. The person
 * whose change it is is not told about their own change; a confirmation of what they created is
 * theirs (`own`).
 */
export function queueMail(
  tx: Writer,
  viewer: Viewer | null,
  happening: Happening,
  to: Recipient[],
  own = false,
): void {
  const text = mailText(happening);
  const sent = new Set<string>();
  for (const person of to) {
    const email = person.email?.trim();
    if (!email || sent.has(email.toLowerCase())) continue;
    if (!own && viewer && (person.id === viewer.id || email === viewer.email)) continue;
    sent.add(email.toLowerCase());
    tx.insert(outgoingMail)
      .values({
        entry: happening.entry,
        model: happening.model,
        recordId: happening.record,
        to: email,
        subject: happening.subject,
        text,
      })
      .run();
  }
  if (sent.size) sendSoon();
}

let sending = false;

/** Sends the mails that are due; one round at a time. */
export async function sendDue(now = Date.now()): Promise<number> {
  if (sending) return 0;
  sending = true;
  let done = 0;
  try {
    const due = db
      .select()
      .from(outgoingMail)
      .where(
        and(
          isNull(outgoingMail.sentAt),
          isNull(outgoingMail.failedAt),
          lte(outgoingMail.nextAt, new Date(now)),
        ),
      )
      .all();
    for (const mail of due) {
      const about = { model: mail.model, record: mail.recordId };
      try {
        await sendMail({ to: mail.to, subject: mail.subject, text: mail.text });
        db.transaction((tx) => {
          tx.update(outgoingMail)
            .set({ sentAt: new Date(), tries: mail.tries + 1 })
            .where(eq(outgoingMail.id, mail.id))
            .run();
          audit(tx, null, {
            action: "mailed",
            ...about,
            details: { outgoing: mail.entry, email: mail.to },
          });
        });
        done++;
      } catch (error) {
        const tries = mail.tries + 1;
        const why = error instanceof Error ? error.message : String(error);
        const late = now - mail.createdAt.getTime() >= DAY;
        db.transaction((tx) => {
          tx.update(outgoingMail)
            .set(
              late
                ? { tries, error: why, failedAt: new Date() }
                : { tries, error: why, nextAt: new Date(now + pauseAfter(tries)) },
            )
            .where(eq(outgoingMail.id, mail.id))
            .run();
          if (late)
            audit(tx, null, {
              action: "mail not sent",
              ...about,
              details: { outgoing: mail.entry, email: mail.to, mail: mail.id, error: why },
            });
        });
        log.warn("A mail could not be sent", { mail: mail.id, tries, error: why });
      }
    }
  } finally {
    sending = false;
  }
  return done;
}

/** Sends what is due once the change that queued it is done, outside its request. */
function sendSoon() {
  setTimeout(() => {
    outsideTrace(() => {
      sendDue().catch((error) => log.error("The outbox could not be sent", { error }));
    });
  }, 0).unref?.();
}

/** "Send again" on a mail that was given up (administrators): tried again from now, for a day. */
export function sendAgain(viewer: Viewer | null, id: number): void {
  if (viewer?.role !== "admin") throw new AccessDenied(viewer !== null);
  const again = db
    .update(outgoingMail)
    .set({ failedAt: null, error: null, tries: 0, createdAt: new Date(), nextAt: new Date() })
    .where(and(eq(outgoingMail.id, id), isNull(outgoingMail.sentAt)))
    .run();
  if (again.changes) sendSoon();
}

// What was queued before a restart goes out after it; then every minute, for the retries.
if (import.meta.env.SSR) {
  setTimeout(sendSoon, 5_000).unref?.();
  setInterval(sendSoon, MINUTE).unref?.();
}
