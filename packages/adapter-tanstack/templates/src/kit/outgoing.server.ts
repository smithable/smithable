// Smithable app kit: outgoing mail and calls (docs/design/integrations.md §4.1, §4.1b). A change
// that someone is to hear about writes its mail, or its call to a named target, into an outbox
// table in the change's own transaction, so there is nothing sent for a change that did not
// happen and no change without what it sends; it is sent after, and what cannot be sent is tried
// again with growing pauses for a day, then given up and shown in Activity, where an
// administrator can send it again. A call is signed with its target's secret.
import { createHmac, randomUUID } from "node:crypto";
import { lookup } from "node:dns/promises";
import { and, eq, isNull, lte } from "drizzle-orm";
import { db } from "#/db";
import { outgoingCall, outgoingMail } from "#/db/schema";
import { AccessDenied, type Viewer } from "./access";
import { audit } from "./audit.server";
import { post, proxied, proxyRefusal } from "./call.server";
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
  /** A user's own language, in an app of several (docs/design/languages.md §3.3). */
  language?: string | null;
}

/** What happened to which record, and how the mail shows it. */
export interface Happening {
  /** The entry's name in smithable.yml, e.g. bookingMade. */
  entry: string;
  /** The record's model and id; none for a custom action's or custom code's mail. */
  model: string | null;
  record: number | null;
  subject: string;
  /** The content file's text, above the record. */
  text?: string;
  /** The record's fields as its page shows them: label and formatted value. */
  fields: [string, string][];
  /** The record's page, e.g. /bookings/12. */
  link?: string;
  /** A reply's own words: the mail is them alone (and the content file's text), a letter. */
  letter?: string;
  /** A mail of a record's thread (docs/design/mail-threads.md §4). */
  thread?: Thread;
}

/** Where a thread mail belongs: its tag, the ids it answers, where a reply goes, and its own id kept. */
export interface Thread {
  /** At the end of the subject, e.g. "[Harbour Support #12]". */
  tag: string;
  inReplyTo?: string;
  /** The thread's ids, oldest first. */
  references: string[];
  replyTo?: string;
  keep(messageId: string): void;
}

/** A new message id at the sender's own domain, with its angle brackets. */
function messageId(): string {
  const domain = /@([^>\s]+)/.exec(process.env.MAIL_FROM ?? "")?.[1] ?? "localhost";
  return `<${randomUUID()}@${domain}>`;
}

/** The address the app's own pages are at, for the link in a mail. */
function base(): string {
  return process.env.BETTER_AUTH_URL ?? (import.meta.env.DEV ? "http://localhost:3000" : "");
}

/** A record page's full address, for the link in a mail and the `{link}` placeholder; nothing without a base. */
export function linkTo(path: string | undefined, at = base()): string {
  return path && at ? `${at.replace(/\/$/, "")}${path}` : "";
}

/** The mail's text: the content file's words, the record's fields, a link to it. */
export function mailText(happening: Happening, at = base()): string {
  const link = linkTo(happening.link, at);
  return [
    happening.text,
    happening.fields.map(([label, value]) => `${label}: ${value}`).join("\n"),
    link ? `${w.openIt}: ${link}` : undefined,
  ]
    .filter(Boolean)
    .join("\n\n");
}

/**
 * The fields a mail lists under its text (outgoing-templates.md §2): the entry's `show` in its
 * order, none, or all of the record page's; with `previous`, a listed field with another value
 * before the change says what it was.
 */
export function shownFields(
  labels: [string, string][],
  values: Record<string, string>,
  before: Record<string, string> | undefined,
  show?: string[] | "none",
  previous?: boolean,
): [string, string][] {
  if (show === "none") return [];
  const names = show ?? labels.map(([name]) => name);
  return names.map((name) => {
    const now = values[name] ?? "";
    const was = before?.[name];
    const label = labels.find(([n]) => n === name)?.[1] ?? name;
    return [label, previous && was !== undefined && was !== now ? `${now} (${w.was} ${was})` : now];
  });
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
  const thread = happening.thread;
  const text =
    happening.letter !== undefined
      ? [happening.text, happening.letter].filter(Boolean).join("\n\n")
      : mailText(happening);
  const subject = thread ? `${happening.subject} ${thread.tag}` : happening.subject;
  const sent = new Set<string>();
  for (const person of to) {
    const email = person.email?.trim();
    const key = email?.toLowerCase();
    if (!email || !key || sent.has(key)) continue;
    if (!viewer && !person.id) continue;
    if (!own && viewer && (person.id === viewer.id || key === viewer.email.toLowerCase())) continue;
    sent.add(key);
    const id = thread ? messageId() : undefined;
    tx.insert(outgoingMail)
      .values({
        entry: happening.entry,
        model: happening.model,
        recordId: happening.record,
        to: email,
        subject,
        text,
        ...(thread && id
          ? {
              messageId: id,
              inReplyTo: thread.inReplyTo ?? null,
              references: thread.references.join(" ") || null,
              replyTo: thread.replyTo ?? null,
            }
          : {}),
      })
      .run();
    if (thread && id) thread.keep(id);
  }
  if (sent.size) sendSoon();
}

/** A call to a named target: the record as the API gives it, with what happened and when. */
export interface Call {
  entry: string;
  /** The record's model and id; none for a custom action's or custom code's call. */
  model: string | null;
  record: number | null;
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

/**
 * The outbox's state, one per process: in development a regeneration evaluates this module again,
 * and two instances must not drain it side by side (each would send the same mail).
 */
type Outbox = { sending: boolean; timers: ReturnType<typeof setTimeout>[] };
const everyInstance = globalThis as { smithableOutbox?: Outbox };
everyInstance.smithableOutbox ??= { sending: false, timers: [] };
const outbox = everyInstance.smithableOutbox;

/** Sends the mails and calls that are due; one round at a time. */
export async function sendDue(now = Date.now()): Promise<number> {
  if (outbox.sending) return 0;
  outbox.sending = true;
  let done = 0;
  // More due than one batch: the rest goes at once after this one, not at the next tick.
  let more = false;
  try {
    // Mail first (a booking's confirmation), then the calls, a bounded batch of each, oldest due
    // first, so one slow webhook never holds a person's mail (the review, 2026-10-30).
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
      .orderBy(outgoingMail.nextAt)
      .limit(BATCH)
      .all();
    more = due.length === BATCH;
    for (const mail of due) {
      const about = { model: mail.model ?? undefined, record: mail.recordId ?? undefined };
      try {
        await sendMail({
          to: mail.to,
          subject: mail.subject,
          text: mail.text,
          ...(mail.messageId ? { messageId: mail.messageId } : {}),
          ...(mail.inReplyTo ? { inReplyTo: mail.inReplyTo } : {}),
          ...(mail.references ? { references: mail.references } : {}),
          ...(mail.replyTo ? { replyTo: mail.replyTo } : {}),
        });
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
    const calls = await sendCalls(now);
    done += calls.done;
    more ||= calls.more;
  } finally {
    outbox.sending = false;
  }
  if (more) sendSoon();
  return done;
}

/** How many mails, and then calls, one turn of the outbox takes. */
const BATCH = 50;

/** Sends what is due once the change that queued it is done, outside its request. */
function sendSoon() {
  setTimeout(() => {
    outsideTrace(() => {
      sendDue().catch((error) => log.error("The outbox could not be sent", { error }));
    });
  }, 0).unref?.();
}

/** Sends the calls that are due, signed; a target without its settings waits for them. */
async function sendCalls(now: number): Promise<{ done: number; more: boolean }> {
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
    .orderBy(outgoingCall.nextAt)
    .limit(BATCH)
    .all();
  for (const call of due) {
    const settings = targetSettings(call.target);
    const url = process.env[settings.url];
    const secret = process.env[settings.secret];
    const about = { model: call.model ?? undefined, record: call.recordId ?? undefined };
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
          // The same on every try of this call, so a receiver that got it once can tell a repeat.
          "Idempotency-Key": `${call.id}-${call.createdAt.getTime()}`,
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
      // The hosted service's egress proxy (a hosted app): 407 is a credential from before the app
      // started again and 429 the day's calls used up, both tried again soon; 403 is an address not
      // connected yet, which waits for the owner.
      const refused = proxyRefusal(error);
      const why =
        refused === 403
          ? `The hosted service does not let the app call ${call.target}: connect its address on the project's Connections page.`
          : refused === 429
            ? "The app's calls for today are used up; tried again in ten minutes."
            : refused === 407
              ? "The app had started again; tried again in a minute."
              : error instanceof Error
                ? error.message
                : String(error);
      const pause = refused === 407 ? MINUTE : refused === 429 ? 10 * MINUTE : pauseAfter(tries);
      const late = now - call.createdAt.getTime() >= DAY;
      db.transaction((tx) => {
        tx.update(outgoingCall)
          .set(
            late
              ? { tries, status, error: why, failedAt: new Date() }
              : { tries, status, error: why, nextAt: new Date(now + pause) },
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
  return { done, more: due.length === BATCH };
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

// What was queued before a restart goes out after it; then every minute, for the retries. A
// module evaluated again replaces the timers of the one before, never adds to them.
if (import.meta.env.SSR) {
  for (const timer of outbox.timers) clearTimeout(timer);
  outbox.timers = [setTimeout(sendSoon, 5_000), setInterval(sendSoon, MINUTE)];
  for (const timer of outbox.timers) timer.unref?.();
}
