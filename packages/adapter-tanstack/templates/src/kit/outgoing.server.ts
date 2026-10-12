// Smithable app kit: outgoing mail and calls (docs/design/integrations.md §4.1, §4.1b). A change
// that someone is to hear about writes its mail, or its call to a named target, into an outbox
// table in the change's own transaction, so there is nothing sent for a change that did not
// happen and no change without what it sends; it is sent after, and what cannot be sent is tried
// again with growing pauses for a day, then given up and shown in Activity, where an
// administrator can send it again. A call is signed with its target's secret.
import { createHmac } from "node:crypto";
import { lookup } from "node:dns/promises";
import { and, eq, isNull, lte } from "drizzle-orm";
import { db } from "#/db";
import { outgoingCall, outgoingMail } from "#/db/schema";
import { AccessDenied, type Viewer } from "./access";
import { audit } from "./audit.server";
import { post, proxied } from "./call.server";
import { log } from "./log.server";
import { mailConfigured, sendMail } from "./mail";
import { pauseAfter, privateAddress, targetSettings } from "./outgoing";
import { outsideTrace } from "./trace.server";
import { w } from "./words";

const MINUTE = 60_000;
const DAY = 24 * 60 * MINUTE;

/** The database, or a transaction in it: what a mail or a call is queued with. */
type Writer = {
  insert<T extends typeof outgoingMail | typeof outgoingCall>(
    table: T,
  ): { values(row: T["$inferInsert"]): { run(): unknown } };
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
 * theirs (`own`). A visitor's change (no one signed in) mails only the app's users, never an
 * address typed into the record: otherwise a contact form would send anyone's text anywhere.
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
    const key = email?.toLowerCase();
    if (!email || !key || sent.has(key)) continue;
    if (!viewer && !person.id) continue;
    if (!own && viewer && (person.id === viewer.id || key === viewer.email.toLowerCase())) continue;
    sent.add(key);
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

/** A call to a named target: the record as the API gives it, with what happened and when. */
export interface Call {
  entry: string;
  model: string;
  record: number;
  target: string;
  /** The JSON sent, and signed. */
  body: string;
}

/** Queues the call in the change's transaction. */
export function queueCall(tx: Writer, call: Call): void {
  tx.insert(outgoingCall)
    .values({
      entry: call.entry,
      model: call.model,
      recordId: call.record,
      target: call.target,
      body: call.body,
    })
    .run();
  sendSoon();
}

/**
 * Why the app will not call this address, or nothing: only http(s), never the app itself, and in
 * a release never a private or local network, so a wrong setting cannot make the app call the
 * machine it runs on or its neighbours. Development may call the machine itself (a test's
 * receiver).
 */
export async function refusedAddress(url: string): Promise<string | undefined> {
  let address: URL;
  try {
    address = new URL(url);
  } catch {
    return "it is not an address";
  }
  if (address.protocol !== "https:" && address.protocol !== "http:")
    return "it is not http or https";
  const own = process.env.BETTER_AUTH_URL;
  if (own && URL.canParse(own) && new URL(own).host === address.host) return "it is the app itself";
  // Behind an egress proxy the proxy checks the destination (and the app may not resolve names
  // itself); development may call the machine itself.
  if (import.meta.env.DEV || proxied(address)) return undefined;
  const host = address.hostname.replace(/^\[|\]$/g, "");
  const found = await lookup(host, { all: true }).catch(() => []);
  if (found.length === 0) return "it does not resolve";
  if (found.some((a) => privateAddress(a.address))) return "it is a private or local network";
  return undefined;
}

let sending = false;

/** Sends the mails and calls that are due; one round at a time. */
export async function sendDue(now = Date.now()): Promise<number> {
  if (sending) return 0;
  sending = true;
  let done = 0;
  try {
    done += await sendCalls(now);
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
            // The preview, like an app without mail settings, keeps its mail in the outbox.
            action: mailConfigured()
              ? "mailed"
              : import.meta.env.DEV
                ? "kept in the preview"
                : "kept in the outbox",
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

/** Sends the calls that are due, signed; a target without its settings waits for them. */
async function sendCalls(now: number): Promise<number> {
  let done = 0;
  const due = db
    .select()
    .from(outgoingCall)
    .where(
      and(
        isNull(outgoingCall.sentAt),
        isNull(outgoingCall.failedAt),
        lte(outgoingCall.nextAt, new Date(now)),
      ),
    )
    .all();
  for (const call of due) {
    const settings = targetSettings(call.target);
    const url = process.env[settings.url];
    const secret = process.env[settings.secret];
    const about = { model: call.model, record: call.recordId };
    if (!url || !secret) {
      // The preview has no addresses for its connections (and no internet): the call is
      // skipped, once, and Activity says so. A published app waits for the settings instead.
      if (import.meta.env.DEV)
        db.transaction((tx) => {
          tx.update(outgoingCall)
            .set({ failedAt: new Date(), error: "skipped in the preview" })
            .where(eq(outgoingCall.id, call.id))
            .run();
          audit(tx, null, {
            action: "skipped in the preview",
            ...about,
            details: { outgoing: call.entry, target: call.target },
          });
        });
      continue;
    }
    let status: number | undefined;
    try {
      const refused = await refusedAddress(url);
      if (refused) throw new Error(`The address of ${call.target} is refused: ${refused}.`);
      // Connected only to an address the guard checked, looked up for this try (call.server.ts).
      status = await post(
        url,
        {
          "Content-Type": "application/json",
          "X-Event": call.entry,
          "X-Signature-256": `sha256=${createHmac("sha256", secret).update(call.body).digest("hex")}`,
        },
        call.body,
      );
      if (status < 200 || status >= 300) throw new Error(`${call.target} answered ${status}.`);
      db.transaction((tx) => {
        tx.update(outgoingCall)
          .set({ sentAt: new Date(), tries: call.tries + 1, status })
          .where(eq(outgoingCall.id, call.id))
          .run();
        audit(tx, null, {
          action: "called",
          ...about,
          details: { outgoing: call.entry, target: call.target, status },
        });
      });
      done++;
    } catch (error) {
      const tries = call.tries + 1;
      const why = error instanceof Error ? error.message : String(error);
      const late = now - call.createdAt.getTime() >= DAY;
      db.transaction((tx) => {
        tx.update(outgoingCall)
          .set(
            late
              ? { tries, status, error: why, failedAt: new Date() }
              : { tries, status, error: why, nextAt: new Date(now + pauseAfter(tries)) },
          )
          .where(eq(outgoingCall.id, call.id))
          .run();
        if (late)
          audit(tx, null, {
            action: "call not made",
            ...about,
            details: { outgoing: call.entry, target: call.target, call: call.id, error: why },
          });
      });
      log.warn("A call could not be made", {
        call: call.id,
        target: call.target,
        tries,
        error: why,
      });
    }
  }
  return done;
}

/**
 * "Send again" on a mail or call that was given up (administrators): tried again from now, for
 * a day.
 */
export function sendAgain(viewer: Viewer | null, again: { mail: number } | { call: number }): void {
  if (viewer?.role !== "admin") throw new AccessDenied(viewer !== null);
  const fresh = {
    failedAt: null,
    error: null,
    tries: 0,
    createdAt: new Date(),
    nextAt: new Date(),
  };
  const changed =
    "mail" in again
      ? db
          .update(outgoingMail)
          .set(fresh)
          .where(and(eq(outgoingMail.id, again.mail), isNull(outgoingMail.sentAt)))
          .run()
      : db
          .update(outgoingCall)
          .set(fresh)
          .where(and(eq(outgoingCall.id, again.call), isNull(outgoingCall.sentAt)))
          .run();
  if (changed.changes) sendSoon();
}

// What was queued before a restart goes out after it; then every minute, for the retries.
if (import.meta.env.SSR) {
  setTimeout(sendSoon, 5_000).unref?.();
  setInterval(sendSoon, MINUTE).unref?.();
}
