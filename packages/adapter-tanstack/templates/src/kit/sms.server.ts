// Smithable app kit: texts (docs/design/notifications.md §5). A change an entry with `sms` is about
// queues one row per number in its transaction: a user's own number, confirmed by a code texted
// to it and turned on under their name, or a number on the record when a signed-in person made
// the change (a visitor's change never texts a number typed into it). The outbox's lane sends
// through the owner's provider (SMS_PROVIDER, 46elks first) or, without settings, writes each
// text under DATA_DIR as the mail is. A day's texts are capped for the app and for each number;
// a text the provider may have taken (no answer) is never sent again by itself.
import { createHash, randomInt, timingSafeEqual } from "node:crypto";
import { mkdirSync, renameSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { and, asc, eq, gte, isNull, lte, or, sql } from "drizzle-orm";
import { db } from "#/db";
import { notificationChoices, outgoingSms, userPhones } from "#/db/schema";
import type { Viewer } from "./access";
import { audit } from "./audit.server";
import { pauseAfter } from "./outgoing";
import { type Happening, linkTo, type Recipient, sendSoon } from "./outgoing.server";
import { BadInput } from "./refusal";
import { dataDir } from "./visitor";
import { w } from "./words";

const MINUTE = 60_000;
const DAY = 24 * 60 * MINUTE;
const BATCH = 50;
/** A number's own cap a day, under the app's: one phone is never flooded. */
const PER_NUMBER = 10;

type Writer = Pick<typeof db, "insert" | "select">;

const state = globalThis as {
  smithableSmsLane?: (now: number) => Promise<number>;
  smithableSmsAgain?: (id: number) => boolean;
  smithableSmsSending?: boolean;
};

/** A number as the provider takes it: + and 7 to 15 digits; spaces, dashes and brackets dropped. */
export function wholeNumber(text: string | null | undefined): string | undefined {
  const number = (text ?? "").replace(/[\s().-]/g, "");
  return /^\+[1-9]\d{6,14}$/.test(number) ? number : undefined;
}

/** The app's cap a day: SMS_MAX_PER_DAY, 50 when not set. */
const appCap = () => {
  const set = Number(process.env.SMS_MAX_PER_DAY);
  return Number.isInteger(set) && set > 0 ? set : 50;
};

/** Queues a text to each number the entry reaches, in the change's transaction. */
export function queueSms(
  tx: Writer,
  viewer: Viewer | null,
  happening: Happening,
  to: Recipient[],
): void {
  const seen = new Set<string>();
  let queued = false;
  for (const person of to) {
    let number: string | undefined;
    let userId: string | undefined;
    if (person.id) {
      // A user: their own number, confirmed, and this entry turned on. Never their own change.
      if (person.id === viewer?.id) continue;
      const phone = tx
        .select({ phone: userPhones.phone })
        .from(userPhones)
        .where(and(eq(userPhones.userId, person.id), sql`${userPhones.confirmedAt} is not null`))
        .get();
      const on = tx
        .select({ id: notificationChoices.id })
        .from(notificationChoices)
        .where(
          and(
            eq(notificationChoices.userId, person.id),
            eq(notificationChoices.entry, happening.entry),
            eq(notificationChoices.channel, "sms"),
          ),
        )
        .get();
      if (!phone || !on) continue;
      number = phone.phone;
      userId = person.id;
    } else if (person.phone) {
      // A number on the record: only from a signed-in person's change (or the app's own work),
      // never a visitor's, who could have typed anyone's.
      if (!viewer || viewer.system) continue;
      number = wholeNumber(person.phone);
      if (!number) {
        audit(tx as typeof db, viewer, {
          action: "text not sent",
          model: happening.model ?? undefined,
          record: happening.record ?? undefined,
          details: { outgoing: happening.entry, error: w.smsNotWhole },
        });
        continue;
      }
    }
    if (!number || seen.has(number)) continue;
    seen.add(number);
    // A person with an account gets the link; a number on a record the title line alone, since
    // the page would ask them to sign in.
    const text =
      userId && happening.link
        ? `${happening.subject} ${linkTo(happening.link)}`
        : happening.subject;
    tx.insert(outgoingSms)
      .values({
        entry: happening.entry,
        model: happening.model,
        recordId: happening.record,
        ...(userId ? { userId } : {}),
        to: number,
        text: text.slice(0, 600),
      })
      .run();
    queued = true;
  }
  if (queued) sendSoon();
}

/** The SMS provider as the app is set up now (SMS_PROVIDER), for the privacy page; none unset. */
export function smsProvider(): string | null {
  return process.env.SMS_PROVIDER || null;
}

/** Sends one text through the provider, or writes it when there are no settings. */
async function deliver(
  to: string,
  text: string,
  id: number,
): Promise<"sent" | "unknown" | { error: string; retry: boolean }> {
  const { SMS_PROVIDER, SMS_KEY, SMS_SECRET, SMS_FROM } = process.env;
  if (!SMS_PROVIDER) {
    // As the mail without SMTP settings: what development and the tests look at.
    const outbox = join(dataDir, "sms", "outbox");
    mkdirSync(outbox, { recursive: true });
    // Hidden while written, then renamed into place: a reader never takes half a text.
    const name = `${String(id).padStart(6, "0")}.txt`;
    writeFileSync(join(outbox, `.${name}.tmp`), `To: ${to}\n\n${text}\n`);
    renameSync(join(outbox, `.${name}.tmp`), join(outbox, name));
    return "sent";
  }
  if (SMS_PROVIDER !== "46elks") return { error: w.smsNoProvider(SMS_PROVIDER), retry: false };
  if (!SMS_KEY || !SMS_SECRET || !SMS_FROM) return { error: w.smsNoSettings, retry: false };
  let answer: Response;
  try {
    answer = await fetch("https://api.46elks.com/a1/sms", {
      method: "POST",
      headers: {
        authorization: `Basic ${Buffer.from(`${SMS_KEY}:${SMS_SECRET}`).toString("base64")}`,
        "content-type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({ from: SMS_FROM, to, message: text }),
      redirect: "manual",
      signal: AbortSignal.timeout(10_000),
    });
  } catch {
    // No answer: the provider may have taken it. Never sent again by itself (Send again is a person's).
    return "unknown";
  }
  if (answer.ok) return "sent";
  return {
    error: w.smsRefused(answer.status),
    retry: answer.status === 429 || answer.status >= 500,
  };
}

/** The texts due: each under the day's caps, for the app and for its number. */
async function sendTexts(now: number): Promise<number> {
  if (state.smithableSmsSending) return 0;
  state.smithableSmsSending = true;
  try {
    const due = db
      .select()
      .from(outgoingSms)
      .where(
        and(
          isNull(outgoingSms.sentAt),
          isNull(outgoingSms.failedAt),
          lte(outgoingSms.nextAt, new Date(now)),
        ),
      )
      .orderBy(asc(outgoingSms.nextAt))
      .limit(BATCH)
      .all();
    for (const row of due) await sendOne(row, now);
    return due.length;
  } finally {
    state.smithableSmsSending = false;
  }
}

/** Texts that went (or may have) in the last day: all of them, or to one number. */
const sentToday = (now: number, to?: string) =>
  db
    .select({ n: sql<number>`count(*)` })
    .from(outgoingSms)
    .where(
      and(
        // When it went (or may have): a text queued long before still counts on the day it goes.
        or(
          gte(outgoingSms.sentAt, new Date(now - DAY)),
          and(eq(outgoingSms.unknown, true), gte(outgoingSms.failedAt, new Date(now - DAY))),
        ),
        to ? eq(outgoingSms.to, to) : undefined,
      ),
    )
    .get()?.n ?? 0;

async function sendOne(row: typeof outgoingSms.$inferSelect, now: number): Promise<void> {
  const tries = row.tries + 1;
  const set = (fields: Partial<typeof outgoingSms.$inferInsert>) =>
    db
      .update(outgoingSms)
      .set({ tries, ...fields })
      .where(eq(outgoingSms.id, row.id))
      .run();
  const line = (action: string, details: Record<string, unknown>) =>
    audit(db, null, {
      action,
      model: row.model ?? undefined,
      record: row.recordId ?? undefined,
      details: { outgoing: row.entry, sms: row.id, ...details },
    });
  // A user's own number: still theirs (a number changed or removed since is not texted), and
  // confirmed for anything but its own code.
  if (row.userId) {
    const kept = db.select().from(userPhones).where(eq(userPhones.userId, row.userId)).get();
    if (!kept || kept.phone !== row.to || (row.entry !== CODE_ENTRY && !kept.confirmedAt))
      return void set({ failedAt: new Date(now), error: w.smsTurnedOff });
  }
  // Still turned on, for a user's own number (turning it off stops what is queued too).
  if (row.userId && row.entry !== CODE_ENTRY) {
    const on = db
      .select({ id: notificationChoices.id })
      .from(notificationChoices)
      .where(
        and(
          eq(notificationChoices.userId, row.userId),
          eq(notificationChoices.entry, row.entry),
          eq(notificationChoices.channel, "sms"),
        ),
      )
      .get();
    if (!on) return void set({ failedAt: new Date(now), error: w.smsTurnedOff });
  }
  if (sentToday(now) >= appCap() || sentToday(now, row.to) >= PER_NUMBER) {
    set({ failedAt: new Date(now), error: w.smsOverLimit });
    return void line("text not sent", { error: w.smsOverLimit });
  }
  // Marked unknown before the provider is asked: a stop between its taking the text and this
  // record would otherwise send it again at the next start. A clear answer takes it back.
  set({ failedAt: new Date(now), unknown: true, error: w.smsUnknown });
  const result = await deliver(row.to, row.text, row.id);
  // A code's text is not kept once it has gone: only its hash is.
  const text = row.entry === CODE_ENTRY ? { text: w.smsCode("······") } : {};
  if (result === "sent") {
    set({ sentAt: new Date(now), failedAt: null, unknown: false, error: null, ...text });
    return void line("texted", {});
  }
  if (result === "unknown") {
    set({ ...text });
    return void line("text unknown", { error: w.smsUnknown });
  }
  if (!result.retry || now - row.createdAt.getTime() >= DAY) {
    set({ failedAt: new Date(now), unknown: false, error: result.error, ...text });
    return void line("text not sent", { error: result.error });
  }
  set({
    failedAt: null,
    unknown: false,
    nextAt: new Date(now + pauseAfter(tries)),
    error: result.error,
  });
}

state.smithableSmsLane = sendTexts;
// Send again: a new row, so the one given up (perhaps billed, when unknown) still counts in the
// day's caps. Not a code: a code is asked for again under the person's name.
state.smithableSmsAgain = (id) => {
  const row = db
    .select()
    .from(outgoingSms)
    .where(and(eq(outgoingSms.id, id), isNull(outgoingSms.sentAt)))
    .get();
  if (!row || row.entry === CODE_ENTRY || !row.failedAt) return false;
  db.insert(outgoingSms)
    .values({
      entry: row.entry,
      model: row.model,
      recordId: row.recordId,
      userId: row.userId,
      to: row.to,
      text: row.text,
    })
    .run();
  return true;
};

// ── The person's own number and choices (under their name) ────────────────────────────────────

/** The entry a confirmation code goes out as: not a choice, never turned off. */
const CODE_ENTRY = "phone code";
/** A code's hash, the person's id as its salt. */
const hash = (userId: string, code: string) =>
  createHash("sha256").update(`${userId}:${code}`).digest("hex");
/** Codes a person may ask for: three a day, one a minute (each costs the owner, and goes to any number). */
const CODES_A_DAY = 3;

/** The person's number, whether it is confirmed, and the text entries they turned on. */
export function smsChoices(viewer: Viewer, offered: string[]) {
  const phone = db.select().from(userPhones).where(eq(userPhones.userId, viewer.id)).get();
  const on = db
    .select({ entry: notificationChoices.entry })
    .from(notificationChoices)
    .where(and(eq(notificationChoices.userId, viewer.id), eq(notificationChoices.channel, "sms")))
    .all()
    .map((c) => c.entry);
  return {
    phone: phone?.phone ?? null,
    confirmed: Boolean(phone?.confirmedAt),
    on: offered.filter((e) => on.includes(e)),
  };
}

/** Texts a code to a number the person gives, to confirm it is theirs. Their earlier one is replaced. */
export function sendPhoneCode(viewer: Viewer, given: string): void {
  const phone = wholeNumber(given);
  if (!phone) throw new BadInput(w.smsNotWhole);
  const codes = db
    .select({ at: outgoingSms.createdAt })
    .from(outgoingSms)
    .where(
      and(
        eq(outgoingSms.userId, viewer.id),
        eq(outgoingSms.entry, CODE_ENTRY),
        gte(outgoingSms.createdAt, new Date(Date.now() - DAY)),
      ),
    )
    .all();
  if (codes.length >= CODES_A_DAY || codes.some((c) => Date.now() - c.at.getTime() < MINUTE))
    throw new BadInput(w.smsCodesLimit);
  const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
  // A new number starts with no texts on: each is turned on again for it.
  const before = db
    .select({ phone: userPhones.phone })
    .from(userPhones)
    .where(eq(userPhones.userId, viewer.id))
    .get();
  db.transaction((tx) => {
    if (before && before.phone !== phone)
      tx.delete(notificationChoices)
        .where(
          and(eq(notificationChoices.userId, viewer.id), eq(notificationChoices.channel, "sms")),
        )
        .run();
    tx.insert(userPhones)
      .values({
        userId: viewer.id,
        phone,
        codeHash: hash(viewer.id, code),
        codeUntil: new Date(Date.now() + 10 * MINUTE),
        codeTries: 0,
      })
      .onConflictDoUpdate({
        target: userPhones.userId,
        set: {
          phone,
          confirmedAt: null,
          codeHash: hash(viewer.id, code),
          codeUntil: new Date(Date.now() + 10 * MINUTE),
          codeTries: 0,
        },
      })
      .run();
    tx.insert(outgoingSms)
      .values({ entry: CODE_ENTRY, userId: viewer.id, to: phone, text: w.smsCode(code) })
      .run();
  });
  sendSoon();
}

/** The code typed back: the number is confirmed. Five wrong tries, or ten minutes, end the code. */
export function confirmPhone(viewer: Viewer, code: string): boolean {
  const kept = db.select().from(userPhones).where(eq(userPhones.userId, viewer.id)).get();
  if (
    !kept?.codeHash ||
    !kept.codeUntil ||
    kept.codeUntil.getTime() < Date.now() ||
    kept.codeTries >= 5
  )
    throw new BadInput(w.smsCodeGone);
  // Compared in constant time (both are hex digests of one length).
  if (!timingSafeEqual(Buffer.from(hash(viewer.id, code.trim())), Buffer.from(kept.codeHash))) {
    db.update(userPhones)
      .set({ codeTries: kept.codeTries + 1 })
      .where(eq(userPhones.userId, viewer.id))
      .run();
    return false;
  }
  db.update(userPhones)
    .set({ confirmedAt: new Date(), codeHash: null, codeUntil: null, codeTries: 0 })
    .where(eq(userPhones.userId, viewer.id))
    .run();
  return true;
}

/** Removes the person's number, and with it every text they turned on. */
export function removePhone(viewer: Viewer): void {
  db.transaction((tx) => {
    tx.delete(userPhones).where(eq(userPhones.userId, viewer.id)).run();
    tx.delete(notificationChoices)
      .where(and(eq(notificationChoices.userId, viewer.id), eq(notificationChoices.channel, "sms")))
      .run();
  });
}

/** Turns a text entry on or off; on only with a confirmed number. */
export function setSmsChoice(viewer: Viewer, offered: string[], entry: string, on: boolean) {
  if (!offered.includes(entry)) throw new BadInput(w.smsNoSuch);
  if (on && !smsChoices(viewer, offered).confirmed) throw new BadInput(w.smsConfirmFirst);
  if (on)
    db.insert(notificationChoices)
      .values({ userId: viewer.id, entry, channel: "sms" })
      .onConflictDoNothing()
      .run();
  else
    db.delete(notificationChoices)
      .where(
        and(
          eq(notificationChoices.userId, viewer.id),
          eq(notificationChoices.entry, entry),
          eq(notificationChoices.channel, "sms"),
        ),
      )
      .run();
  return smsChoices(viewer, offered);
}
