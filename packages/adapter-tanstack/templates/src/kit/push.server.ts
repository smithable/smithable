// Smithable app kit: browser push (docs/design/notifications.md §4). A person turns an entry on
// under their name, in each browser they want it in; a change the entry is about queues one row
// per person in the change's transaction; the outbox's lane pushes it to each of their browsers,
// checking again that they may read the record, over https only, to an address that is not the
// app's own or a private network, without following a redirect. A push service that says the
// subscription is gone (404, 410) has it removed. The message is the title line and the link.
import { and, asc, eq, inArray, isNull, lte } from "drizzle-orm";
import { db } from "#/db";
import { appKeys, notificationChoices, outgoingPush, pushSubscriptions, user } from "#/db/schema";
import type { Viewer } from "./access";
import { audit } from "./audit.server";
import { post, proxyRefusal } from "./call.server";
import { pauseAfter } from "./outgoing";
import { type Happening, type Recipient, refusedAddress, sendSoon } from "./outgoing.server";
import { encryptPush, newPushKeys, type PushKeys, vapidHeader } from "./push-crypto.server";

const MINUTE = 60_000;
const DAY = 24 * 60 * MINUTE;
const BATCH = 50;

/** Writes in a change's transaction. */
type Writer = Pick<typeof db, "insert" | "select">;

/** May this person read that record: the model's read rule, as its page would check it. */
export type PushReaders = Record<
  string,
  (viewer: Viewer, id: number) => boolean | Promise<boolean>
>;
const state = globalThis as {
  smithablePushReaders?: PushReaders;
  smithablePushLane?: (now: number) => Promise<number>;
  smithablePushAgain?: (id: number) => boolean;
  smithablePushSending?: boolean;
  smithableOnQueued?: (
    proof: { table: "mail" | "push"; id: number },
    to: { id?: string | null; email: string },
    happening: Happening,
  ) => void;
};

/** The read checks by model, given by the generated outgoing module. */
export function pushReaders(readers: PushReaders): void {
  state.smithablePushReaders = readers;
}

/**
 * The app's VAPID key pair: PUSH_VAPID_PUBLIC_KEY and PUSH_VAPID_PRIVATE_KEY when set, else the
 * pair made at the first start and kept with the data (a lost pair ends every subscription).
 */
export function pushKeys(): PushKeys {
  const { PUSH_VAPID_PUBLIC_KEY: publicKey, PUSH_VAPID_PRIVATE_KEY: privateKey } = process.env;
  if (publicKey && privateKey) return { publicKey, privateKey };
  const kept = db.select().from(appKeys).where(eq(appKeys.name, "vapid")).get();
  if (kept) return JSON.parse(kept.value) as PushKeys;
  const made = newPushKeys();
  db.insert(appKeys)
    .values({ name: "vapid", value: JSON.stringify(made) })
    .onConflictDoNothing()
    .run();
  return JSON.parse(
    (db.select().from(appKeys).where(eq(appKeys.name, "vapid")).get() as { value: string }).value,
  ) as PushKeys;
}

/** Who the push services may write to about the app: PUSH_VAPID_SUBJECT, MAIL_FROM or its address. */
function subject(): string {
  const { PUSH_VAPID_SUBJECT, MAIL_FROM, BETTER_AUTH_URL } = process.env;
  if (PUSH_VAPID_SUBJECT) return PUSH_VAPID_SUBJECT;
  if (MAIL_FROM) return `mailto:${MAIL_FROM.replace(/^.*<([^>]+)>.*$/, "$1")}`;
  // A contact is mailto: or https: (RFC 8292); an app on plain http has none of its own.
  return BETTER_AUTH_URL?.startsWith("https:") ? BETTER_AUTH_URL : "mailto:app@localhost";
}

/**
 * Queues a push to each recipient who is a user of the app, in the change's transaction: a row
 * for everyone the entry reaches (live notices take it as the change's proof), to be pushed only
 * to those who turned the entry on. Not for the person whose change it is.
 */
export function queuePush(
  tx: Writer,
  viewer: Viewer | null,
  happening: Happening,
  to: Recipient[],
): void {
  const seen = new Set<string>();
  let wanted = false;
  for (const person of to) {
    // An address the record names is a user's when it is one; a stranger's gets no push.
    const id =
      person.id ??
      (person.email
        ? tx.select({ id: user.id }).from(user).where(eq(user.email, person.email)).get()?.id
        : undefined);
    if (!id || seen.has(id) || id === viewer?.id) continue;
    seen.add(id);
    const on = tx
      .select({ id: notificationChoices.id })
      .from(notificationChoices)
      .where(
        and(
          eq(notificationChoices.userId, id),
          eq(notificationChoices.entry, happening.entry),
          eq(notificationChoices.channel, "push"),
        ),
      )
      .get();
    const row = tx
      .insert(outgoingPush)
      .values({
        entry: happening.entry,
        model: happening.model,
        recordId: happening.record,
        userId: id,
        title: happening.subject,
        link: happening.link,
        // Nobody to push to: done at once, kept as what the change told.
        ...(on ? {} : { sentAt: new Date() }),
      })
      .returning({ id: outgoingPush.id })
      .get();
    wanted ||= Boolean(on);
    if (row)
      state.smithableOnQueued?.(
        { table: "push", id: row.id },
        { id, email: person.email ?? "" },
        happening,
      );
  }
  if (wanted) sendSoon();
}

/** Why a browser's push address may not be used: not https, the app itself, a private network. */
async function endpointRefusal(endpoint: string): Promise<string | undefined> {
  try {
    if (new URL(endpoint).protocol !== "https:") return "it is not https";
  } catch {
    return "it is not an address";
  }
  return refusedAddress(endpoint);
}

/** The pushes due, to each browser of each person: true when one was tried. */
async function sendPushes(now: number): Promise<number> {
  if (state.smithablePushSending) return 0;
  state.smithablePushSending = true;
  try {
    const due = db
      .select()
      .from(outgoingPush)
      .where(
        and(
          isNull(outgoingPush.sentAt),
          isNull(outgoingPush.failedAt),
          lte(outgoingPush.nextAt, new Date(now)),
        ),
      )
      .orderBy(asc(outgoingPush.nextAt))
      .limit(BATCH)
      .all();
    for (const row of due) await sendOne(row, now);
    return due.length;
  } finally {
    state.smithablePushSending = false;
  }
}

async function sendOne(row: typeof outgoingPush.$inferSelect, now: number): Promise<void> {
  const tries = row.tries + 1;
  const done = (fields: Partial<typeof outgoingPush.$inferInsert>) =>
    db
      .update(outgoingPush)
      .set({ tries, ...fields })
      .where(eq(outgoingPush.id, row.id))
      .run();
  // Still someone who may read it, as Send again also checks (a role or a record may have changed).
  const person = db
    .select({ id: user.id, name: user.name, email: user.email, role: user.role })
    .from(user)
    .where(eq(user.id, row.userId))
    .get();
  const read = row.model ? state.smithablePushReaders?.[row.model] : undefined;
  // Still turned on: turning it off stops what is queued too, also a retry or Send again.
  const on = db
    .select({ id: notificationChoices.id })
    .from(notificationChoices)
    .where(
      and(
        eq(notificationChoices.userId, row.userId),
        eq(notificationChoices.entry, row.entry),
        eq(notificationChoices.channel, "push"),
      ),
    )
    .get();
  const may =
    person &&
    on &&
    (row.recordId === null ||
      !read ||
      (await read({ ...person, role: person.role ?? "" }, row.recordId)));
  const devices = may
    ? db.select().from(pushSubscriptions).where(eq(pushSubscriptions.userId, row.userId)).all()
    : [];
  const delivered = new Set(row.delivered);
  const errors: string[] = [];
  const message = Buffer.from(JSON.stringify({ title: row.title, link: row.link ?? "/" }));
  const keys = devices.length ? pushKeys() : undefined;
  for (const device of devices) {
    if (delivered.has(device.id) || !keys) continue;
    const refused = await endpointRefusal(device.endpoint);
    if (refused) {
      errors.push(`a browser's push address was refused: ${refused}`);
      continue;
    }
    try {
      const status = await post(
        device.endpoint,
        {
          authorization: vapidHeader(device.endpoint, keys, subject(), now),
          "content-encoding": "aes128gcm",
          "content-type": "application/octet-stream",
          ttl: String(24 * 60 * 60),
          urgency: "normal",
        },
        encryptPush(device, message),
      );
      // Gone (404, 410), or refused for a key it was not made with (401, 403: the app's pair
      // was replaced): the browser makes a new one when the person turns it on again.
      if (status === 404 || status === 410 || status === 401 || status === 403) {
        // The browser dropped it (a person turned it off there, or it expired): gone here too.
        db.delete(pushSubscriptions).where(eq(pushSubscriptions.id, device.id)).run();
        continue;
      }
      if (status < 200 || status >= 300) {
        errors.push(`the push service answered ${status}`);
        continue;
      }
      delivered.add(device.id);
      db.update(pushSubscriptions)
        .set({ usedAt: new Date(now) })
        .where(eq(pushSubscriptions.id, device.id))
        .run();
    } catch (error) {
      const proxyStatus = proxyRefusal(error);
      errors.push(
        proxyStatus ? `the egress proxy refused it (${proxyStatus})` : (error as Error).message,
      );
    }
  }
  if (!errors.length) {
    done({ sentAt: new Date(now), delivered: [...delivered] });
    if (delivered.size)
      audit(db, null, {
        action: "pushed",
        model: row.model ?? undefined,
        record: row.recordId ?? undefined,
        details: { outgoing: row.entry, devices: delivered.size },
      });
    return;
  }
  const error = errors.join("; ").slice(0, 500);
  if (now - row.createdAt.getTime() >= DAY) {
    done({ failedAt: new Date(now), error, delivered: [...delivered] });
    audit(db, null, {
      action: "push not sent",
      model: row.model ?? undefined,
      record: row.recordId ?? undefined,
      details: { outgoing: row.entry, push: row.id, error },
    });
  } else done({ nextAt: new Date(now + pauseAfter(tries)), error, delivered: [...delivered] });
}

state.smithablePushLane = sendPushes;
state.smithablePushAgain = (id) =>
  db
    .update(outgoingPush)
    .set({ failedAt: null, error: null, tries: 0, createdAt: new Date(), nextAt: new Date() })
    .where(and(eq(outgoingPush.id, id), isNull(outgoingPush.sentAt)))
    .run().changes > 0;

// ── The person's own choices (the Notifications part under their name) ──────────────────────

/** A browser's subscription as the page sends it. */
export interface BrowserSubscription {
  endpoint: string;
  p256dh: string;
  auth: string;
}

/** The entries this person may turn on, which are on, and the key a browser subscribes with. */
export function pushChoices(viewer: Viewer, offered: string[]) {
  const on = db
    .select({ entry: notificationChoices.entry })
    .from(notificationChoices)
    .where(and(eq(notificationChoices.userId, viewer.id), eq(notificationChoices.channel, "push")))
    .all()
    .map((c) => c.entry);
  return { publicKey: pushKeys().publicKey, on: offered.filter((e) => on.includes(e)) };
}

/**
 * Turns an entry on or off for the person, keeping this browser's subscription with it: the
 * first one on subscribes it, the last one off removes it (a shared tablet keeps nothing).
 */
export async function setPushChoice(
  viewer: Viewer,
  offered: string[],
  entry: string,
  on: boolean,
  browser?: BrowserSubscription,
): Promise<{ on: string[] }> {
  if (!offered.includes(entry)) throw new Error("No such notification.");
  // Checked when it is given as well as at each push: a browser's address, never the app's own
  // or a private network's, and keys of a browser's sizes (a P-256 point, a 16-byte secret).
  const refused = browser && (await endpointRefusal(browser.endpoint));
  if (refused) throw new Error(`This push address cannot be used: ${refused}.`);
  if (
    browser &&
    (Buffer.from(browser.p256dh, "base64url").length !== 65 ||
      Buffer.from(browser.auth, "base64url").length !== 16)
  )
    throw new Error("This browser's push keys are not as a browser gives them.");
  db.transaction((tx) => {
    if (on) {
      tx.insert(notificationChoices)
        .values({ userId: viewer.id, entry, channel: "push" })
        .onConflictDoNothing()
        .run();
      if (browser)
        tx.insert(pushSubscriptions)
          .values({ userId: viewer.id, ...browser })
          .onConflictDoUpdate({
            target: pushSubscriptions.endpoint,
            set: { userId: viewer.id, ...browser },
          })
          .run();
    } else
      tx.delete(notificationChoices)
        .where(
          and(
            eq(notificationChoices.userId, viewer.id),
            eq(notificationChoices.entry, entry),
            eq(notificationChoices.channel, "push"),
          ),
        )
        .run();
  });
  const left = pushChoices(viewer, offered).on;
  if (!left.length && browser) dropPushBrowser(viewer, browser.endpoint);
  return { on: left };
}

/** This browser stops getting pushes (signing out, or the last entry turned off). */
export function dropPushBrowser(viewer: Viewer, endpoint: string): void {
  db.delete(pushSubscriptions)
    .where(and(eq(pushSubscriptions.userId, viewer.id), eq(pushSubscriptions.endpoint, endpoint)))
    .run();
}

/** A person's browsers, removed with them (also by the table's cascade). */
export function dropPushOf(userIds: string[]): void {
  if (userIds.length)
    db.delete(pushSubscriptions).where(inArray(pushSubscriptions.userId, userIds)).run();
}
