// Smithable app kit: payments (docs/design/payments.md). A record is paid on the provider's own
// page and recorded by the provider's verified word, never by the browser's. The kit asks for a
// checkout after the record's transaction, applies the provider's events in one transaction each
// (the event's id taken in incoming_seen in it, the Payment's status moving only as
// PAYMENT_MOVES allow), and releases a held record nobody paid for. The app's own part (which
// record, how much, what a payment sets and tells) is the generated payments module's.
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { getCookie, setCookie } from "@tanstack/react-start/server";
import { and, count, desc, eq, gt, inArray, isNull, like, lt, notInArray, or } from "drizzle-orm";
import { db } from "#/db";
import { appKeys, incomingSeen, paymentRefunds, payments } from "#/db/schema";
import { app } from "#/generated/app";
import { PAYMENT_ENTRIES, PAYMENTS_PROVIDER } from "#/generated/payments.server";
import type { Viewer } from "./access";
import { audit } from "./audit.server";
import { log } from "./log.server";
import { type Condition, fits } from "./model";
import {
  appAddress,
  mollieProvider,
  ProviderRefused,
  stripeProvider,
} from "./payments-providers.server";
import { BadInput } from "./refusal";
import { w } from "./words";

export { ProviderRefused };

/** A transaction, as a record is made inside one. */
export type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];
export type Payment = typeof payments.$inferSelect;

const MINUTE = 60_000;
const DAY = 24 * 60 * MINUTE;

/** What the generated module says of each payments entry: how its record is unheld, set and released. */
export interface PaymentEntry {
  model: string;
  /** Pay to create: the record is held until paid. */
  created: boolean;
  /** Pay for an existing record: the condition it must fit (§3.2). */
  when?: Condition;
  /** The record's amount field (its key in a row), read on the server. */
  amount: string;
  /** Who may refund in the app besides admins, and on which records (§4.4); none without `refund`. */
  refund?: { by: readonly string[]; when?: Condition };
  /**
   * The successful payment's work on the record, in the event's transaction: true, or why it was
   * not done (the record is gone, it no longer asks, or its amount is no longer the one paid).
   */
  paid: (tx: Tx, record: number, amount: number) => true | string;
  /** Removes a held record nobody paid for, its place freed. */
  release: (tx: Tx, record: number) => void;
  /** The record as stored, read in a transaction (a refund's condition checked again there). */
  read: (tx: Tx, record: number) => Record<string, unknown> | undefined;
  /** After a held record's payment is recorded: the app's own afterCreate, which waited for it. */
  after?: (record: number) => Promise<void>;
}

/** The provider's verified word about a payment, as the kit acts on it. */
export interface PaymentEvent {
  /** The event's own id, taken once. */
  id: string;
  /** The Payment's id, from the provider's metadata. */
  payment: number;
  reference?: string;
  kind: "paid" | "failed" | "refunded" | "refund-refused";
  /** In hundredths, as the Payment's; for a refund, the amount that went back. */
  amount?: number;
  /** A refund's own reference at the provider. */
  refund?: string;
  currency?: string;
  mode: "test" | "live";
  account?: string;
  reason?: string;
}

/** A payment provider (§5): the checkout, the verified word, and the checkout's state for the hold timer. */
export interface Provider {
  name: string;
  mode: () => "test" | "live";
  /** Whether the provider can be used here: its settings, or the fake outside a release. */
  ready: () => boolean;
  createCheckout: (asked: {
    payment: number;
    amount: number;
    currency: string;
    description: string;
    back: string;
    expiresAt: Date;
    /** The same for every try of one Payment's checkout, so a retried request makes no second session. */
    idempotencyKey: string;
  }) => Promise<{ reference: string; url: string; account?: string }>;
  /**
   * The provider's call verified by its own scheme: the events it carries (none when it is about
   * nothing of the app's), or null when it is not the provider's. A provider whose calls carry only
   * an id asks for the payment and gives what it found (Mollie).
   */
  verifyEvent: (request: Request, body: string) => Promise<PaymentEvent[] | null>;
  /** Closes an open checkout before its held record is released, where the provider can. */
  close?: (reference: string) => Promise<void>;
  /** Asked by the hold timer before a held record is released; "open" lets it go. */
  status?: (reference: string) => Promise<"paid" | "open" | "processing">;
  /** A refund of a paid payment: done when the provider says so at once, else its call says so later. */
  refund: (asked: {
    reference: string;
    amount: number;
    currency: string;
    idempotencyKey: string;
  }) => Promise<{ reference: string; done: boolean }>;
}

/** The app itself, as the provider's word and the hold timer act: no role's grants apply. */
const APP: Viewer = { id: "payments", name: "", email: "", role: "", system: true };

/** Minutes a held record waits for its payment (PAYMENTS_HOLD_MINUTES, 30 unless said). */
export const holdMinutes = () => Number(process.env.PAYMENTS_HOLD_MINUTES) || 30;

/**
 * The fake provider (§6): a page of the app stands in for the provider's, and its Approve and
 * Decline post a signed event to the payments address as a provider would. It takes no money, so
 * it runs in development and where PAYMENTS_FAKE=on says so (a preview), never in a release
 * without it.
 */
export const fake: Provider = {
  name: "fake",
  mode: () => "test",
  ready: () => Boolean(import.meta.env.DEV) || process.env.PAYMENTS_FAKE === "on",
  async createCheckout({ payment }) {
    return {
      reference: `fake_${payment}_${randomBytes(6).toString("hex")}`,
      url: `/payments/fake/${payment}`,
    };
  },
  async verifyEvent(request, body) {
    if (!same(request.headers.get("x-fake-signature") ?? "", fakeSign(body))) return null;
    const event = JSON.parse(body) as PaymentEvent;
    return typeof event.id === "string" &&
      Number.isInteger(event.payment) &&
      ["paid", "failed", "refunded", "refund-refused"].includes(event.kind)
      ? [event]
      : null;
  },
  async refund({ idempotencyKey }) {
    // How a test sees a provider refuse: PAYMENTS_FAKE_REFUSE_REFUNDS=on.
    if (process.env.PAYMENTS_FAKE_REFUSE_REFUNDS === "on")
      throw new ProviderRefused("the fake provider refuses refunds");
    return { reference: `fake_${idempotencyKey}`, done: true };
  },
};

/** A secret of the app's, made at its first use and kept with the data. */
function kept(name: string): string {
  const row = db.select().from(appKeys).where(eq(appKeys.name, name)).get();
  if (row) return row.value;
  db.insert(appKeys)
    .values({ name, value: randomBytes(32).toString("hex") })
    .onConflictDoNothing()
    .run();
  return (db.select().from(appKeys).where(eq(appKeys.name, name)).get() as { value: string }).value;
}

export const fakeSign = (body: string) =>
  createHmac("sha256", kept("payments-fake")).update(body).digest("hex");

const same = (a: string, b: string) => {
  const [x, y] = [Buffer.from(a), Buffer.from(b)];
  return x.length === y.length && timingSafeEqual(x, y);
};

/**
 * The browser that started a payment (§4.2): a cookie bound to the Payment, so its return page
 * shows the state to that browser only, whoever else learns the address.
 */
const cookieOf = (id: number) => `payment-${id}`;
const proofOf = (id: number) =>
  createHmac("sha256", kept("payments-browser")).update(String(id)).digest("hex");
export function bindBrowser(id: number) {
  setCookie(cookieOf(id), proofOf(id), {
    path: "/",
    httpOnly: true,
    sameSite: "lax",
    secure: Boolean(process.env.BETTER_AUTH_URL?.startsWith("https:")),
    maxAge: 24 * 60 * 60,
  });
}
export const boundBrowser = (id: number) => same(getCookie(cookieOf(id)) ?? "", proofOf(id));

/**
 * Starts paying for a record just written (§4.1): its pending Payment bound to this browser and
 * the provider's page asked. Undefined when nothing is to pay (an amount of zero).
 */
export async function payFor(entry: string, record: number): Promise<string | undefined> {
  const pending = db
    .select({ id: payments.id })
    .from(payments)
    .where(
      and(eq(payments.entry, entry), eq(payments.record, record), eq(payments.status, "pending")),
    )
    .get();
  if (!pending) return undefined;
  bindBrowser(pending.id);
  return checkout(pending.id);
}

/** The provider's call at /incoming/payments-<provider> (§4.3): verified, then applied; 401 when it is not the provider's. */
export async function receive(request: Request, name: string): Promise<Response> {
  const chosen = provider();
  const answer = (status: number) => new Response(null, { status });
  if (!chosen || chosen.name !== name) return answer(404);
  const length = Number(request.headers.get("content-length") ?? 0);
  if (length > 64 * 1024) return answer(413);
  const body = await request.text();
  if (body.length > 64 * 1024) return answer(413);
  let events: PaymentEvent[] | null;
  try {
    events = await chosen.verifyEvent(request, body);
  } catch (error) {
    // The provider could not be asked (a provider that verifies by asking): it calls again.
    log.error("A payments call could not be verified now", { provider: name, error });
    return answer(500);
  }
  if (!events) {
    log.warn("A payments call was refused: not verified", { provider: name });
    return answer(401);
  }
  try {
    for (const event of events) {
      if (applyEvent(event, chosen) === "unknown")
        log.warn("A payments call named a payment the app did not make", {
          provider: name,
          payment: event.payment,
        });
    }
    return answer(200);
  } catch (error) {
    // Not recorded: the provider tries again.
    log.error("A payments call failed", { provider: name, error });
    return answer(500);
  }
}

const PROVIDERS: Record<string, Provider> = {
  fake,
  stripe: stripeProvider,
  mollie: mollieProvider,
};

/** The app's provider (the context file's), or none when it cannot be used here. */
export function provider(): Provider | undefined {
  const chosen = PROVIDERS[PAYMENTS_PROVIDER];
  return chosen?.ready() ? chosen : undefined;
}

/**
 * Writes a pending Payment for a record, in the record's own transaction (§4.1 step 2): one
 * pending Payment per entry and record, so a second click finds the first.
 */
export function askPayment(
  tx: Tx,
  entry: string,
  record: number,
  amount: number,
  currency: string,
  description: string,
): number {
  const chosen = provider();
  if (!chosen) throw new BadInput(w.paymentUnavailable);
  if (!Number.isInteger(amount) || amount < 0) throw new BadInput("payment-amount");
  const pending = tx
    .select({ id: payments.id })
    .from(payments)
    .where(
      and(eq(payments.entry, entry), eq(payments.record, record), eq(payments.status, "pending")),
    )
    .get();
  if (pending) return pending.id;
  const made = tx
    .insert(payments)
    .values({
      entry,
      record,
      amount,
      currency,
      description,
      provider: chosen.name,
      providerMode: chosen.mode(),
    })
    .returning({ id: payments.id })
    .get();
  audit(tx, APP, {
    action: "payment asked",
    model: PAYMENT_ENTRIES[entry]?.model,
    record,
    details: { payment: made.id, amount },
  });
  return made.id;
}

/**
 * The provider's checkout for a pending Payment (§4.1 steps 3–4), asked outside any transaction:
 * its page again while it is open, else a new one. A provider that refuses or cannot be reached
 * leaves the Payment failed and a held record released, so no place stays blocked.
 */
export async function checkout(id: number): Promise<string> {
  const payment = db.select().from(payments).where(eq(payments.id, id)).get();
  if (!payment || payment.status !== "pending") throw new BadInput(w.paymentGone);
  if (payment.checkoutUrl) return payment.checkoutUrl;
  const chosen = provider();
  try {
    if (!chosen || chosen.name !== payment.provider) throw new Error("the provider is not set up");
    const made = await chosen.createCheckout({
      payment: payment.id,
      amount: payment.amount,
      currency: payment.currency,
      description: payment.description ?? "",
      // The fake's page is the app's own; a provider sends the payer back to the app's address.
      back: `${chosen.name === "fake" ? "" : appAddress()}/payments/${payment.id}/back`,
      expiresAt: new Date(payment.createdAt.getTime() + holdMinutes() * MINUTE),
      idempotencyKey: `payment-${payment.id}-checkout`,
    });
    // Two clicks at once: the first checkout kept is the one both go to.
    const kept = db
      .update(payments)
      .set({
        reference: made.reference,
        checkoutUrl: made.url,
        providerAccount: made.account ?? null,
      })
      .where(and(eq(payments.id, id), eq(payments.status, "pending"), isNull(payments.checkoutUrl)))
      .run();
    if (!kept.changes) {
      const first = db
        .select({ url: payments.checkoutUrl })
        .from(payments)
        .where(eq(payments.id, id))
        .get()?.url;
      if (first) return first;
    }
    return made.url;
  } catch (error) {
    log.error("A payment's checkout could not be made", { payment: id, error });
    // Given up only while no checkout of it was made: one that is open may still be paid.
    if (
      !db.select({ url: payments.checkoutUrl }).from(payments).where(eq(payments.id, id)).get()?.url
    )
      db.transaction((tx) => fail(tx, payment, "the provider could not be reached"));
    throw new BadInput(w.paymentUnavailable);
  }
}

/** Marks a pending Payment failed and releases its held record; false when it was not pending. */
function fail(tx: Tx, payment: Payment, note: string): boolean {
  const moved = tx
    .update(payments)
    .set({ status: "failed", note })
    .where(and(eq(payments.id, payment.id), eq(payments.status, "pending")))
    .run();
  if (!moved.changes) return false;
  const entry = PAYMENT_ENTRIES[payment.entry];
  if (entry?.created) entry.release(tx, payment.record);
  audit(tx, APP, {
    action: "payment failed",
    model: entry?.model,
    record: payment.record,
    details: { payment: payment.id, note },
  });
  return true;
}

/**
 * The provider's verified word, in one transaction (§4.3): the event's id is taken in it (a
 * failure gives it back, so the provider's retry is acted on), and the Payment moves only as
 * PAYMENT_MOVES allow. Any other event changes nothing. Returns what became of it.
 */
export function applyEvent(event: PaymentEvent, from: Provider): "done" | "seen" | "unknown" {
  // What runs once the transaction is in: a paid record's afterCreate (custom code, never inside it).
  const afterwards: (() => Promise<void>)[] = [];
  const result = recordEvent(event, from, afterwards);
  for (const work of afterwards)
    work().catch((error) => log.error("A paid record's afterCreate failed", { error }));
  return result;
}

function recordEvent(
  event: PaymentEvent,
  from: Provider,
  afterwards: (() => Promise<void>)[],
): "done" | "seen" | "unknown" {
  return db.transaction((tx) => {
    const payment = tx.select().from(payments).where(eq(payments.id, event.payment)).get();
    // Only a Payment the app made, at this provider, in this mode and account, with its reference.
    if (
      !payment ||
      payment.provider !== from.name ||
      payment.providerMode !== event.mode ||
      (payment.providerAccount && event.account && payment.providerAccount !== event.account) ||
      (payment.reference && event.reference && payment.reference !== event.reference)
    )
      return "unknown";
    const taken = tx
      .insert(incomingSeen)
      .values({ name: `payments-${from.name}`, key: event.id })
      .onConflictDoNothing()
      .run();
    if (!taken.changes) return "seen";
    if (!payment.reference && event.reference)
      tx.update(payments)
        .set({ reference: event.reference })
        .where(eq(payments.id, payment.id))
        .run();
    const entry = PAYMENT_ENTRIES[payment.entry];
    if (event.kind === "failed") {
      fail(tx, payment, event.reason ?? "declined");
      return "done";
    }
    if (event.kind === "refunded" || event.kind === "refund-refused") {
      refunded(tx, payment, event);
      return "done";
    }
    if (payment.status !== "pending" && payment.status !== "failed") return "done";
    const same =
      event.amount === payment.amount &&
      event.currency?.toUpperCase() === payment.currency.toUpperCase();
    // Paid after it was given up, or not the amount asked: recorded as money that came for
    // nothing, the record left as it is (§4.3, §4.6).
    const note =
      payment.status === "failed" ? "paid after the hold" : same ? null : "amount differs";
    tx.update(payments)
      .set({ status: "paid", paidAt: new Date(), note: note ?? payment.note })
      .where(eq(payments.id, payment.id))
      .run();
    audit(tx, APP, {
      action: "paid",
      model: entry?.model,
      record: payment.record,
      details: { payment: payment.id, ...(note ? { note } : {}) },
    });
    // A held record whose money does not match stays out: released, its place freed; the money
    // is the payer's, refunded from the Payments page (§4.3).
    if (note && entry?.created) entry.release(tx, payment.record);
    const done = note || !entry ? true : entry.paid(tx, payment.record, payment.amount);
    if (done !== true)
      tx.update(payments).set({ note: done }).where(eq(payments.id, payment.id)).run();
    else if (entry?.created && entry.after) {
      const after = entry.after;
      afterwards.push(() => after(payment.record));
    }
    return "done";
  });
}

/**
 * A refund the provider made or refused (§4.4), as a line under the Payment: the line the app
 * asked for (by its reference, or the one still waiting for its reference when the provider's call
 * comes first), or a line of its own for one made in the provider's dashboard, with its amount.
 * The Payment is refunded once the whole amount is back. A refusal concerns the line it names; it
 * returns the Payment to paid only when that line was the one in flight.
 */
function refunded(tx: Tx, payment: Payment, event: PaymentEvent) {
  const byReference = event.refund
    ? tx
        .select()
        .from(paymentRefunds)
        .where(
          and(eq(paymentRefunds.paymentId, payment.id), eq(paymentRefunds.reference, event.refund)),
        )
        .get()
    : undefined;
  const inFlight = tx
    .select()
    .from(paymentRefunds)
    .where(
      and(
        eq(paymentRefunds.paymentId, payment.id),
        eq(paymentRefunds.status, "asked"),
        isNull(paymentRefunds.reference),
      ),
    )
    .get();
  const line = byReference ?? inFlight;
  if (event.kind === "refund-refused") {
    if (!line || line.status !== "asked") return;
    tx.update(paymentRefunds)
      .set({
        status: "refused",
        reference: event.refund ?? line.reference,
        note: event.reason ?? null,
      })
      .where(eq(paymentRefunds.id, line.id))
      .run();
    if (payment.status === "refunding")
      tx.update(payments).set({ status: "paid" }).where(eq(payments.id, payment.id)).run();
    return;
  }
  if (payment.status !== "paid" && payment.status !== "refunding") return;
  if (line?.status === "done") return;
  if (line)
    tx.update(paymentRefunds)
      .set({ status: "done", reference: event.refund ?? line.reference })
      .where(eq(paymentRefunds.id, line.id))
      .run();
  else
    tx.insert(paymentRefunds)
      .values({
        paymentId: payment.id,
        amount: event.amount ?? payment.amount - refundedOf(tx, payment.id),
        reference: event.refund ?? null,
        status: "done",
      })
      .run();
  const back = refundedOf(tx, payment.id);
  tx.update(payments)
    .set(
      back >= payment.amount
        ? { status: "refunded", refundedAt: new Date() }
        : // Part of it back (a partial refund in the dashboard): still paid, the rest refundable.
          { status: "paid" },
    )
    .where(eq(payments.id, payment.id))
    .run();
  audit(tx, APP, {
    action: "refunded",
    model: PAYMENT_ENTRIES[payment.entry]?.model,
    record: payment.record,
    details: { payment: payment.id, amount: line?.amount ?? event.amount ?? payment.amount },
  });
}

/** What has come back of a Payment so far. */
const refundedOf = (tx: Tx | typeof db, payment: number) =>
  tx
    .select({ amount: paymentRefunds.amount })
    .from(paymentRefunds)
    .where(and(eq(paymentRefunds.paymentId, payment), eq(paymentRefunds.status, "done")))
    .all()
    .reduce((sum, r) => sum + r.amount, 0);

/** The notes of money that should not have come: refunded to its payer whatever the entry says. */
export const UNASKED = [
  "paid after the hold",
  "amount differs",
  "the record no longer asks",
  "the record is gone",
] as const;
const unasked = (payment: Payment) =>
  payment.status === "paid" && (UNASKED as readonly string[]).includes(payment.note ?? "");

/** Admins and the entry's refund roles: who sees a payment's reference and may refund it. */
const staffOf = (viewer: Viewer | null, entry: string) =>
  Boolean(viewer && ["admin", ...(PAYMENT_ENTRIES[entry]?.refund?.by ?? [])].includes(viewer.role));

/**
 * Whether a person may refund a Payment (§4.4): admins and the entry's refund roles, on a record
 * they may read (`row`, as their read gave it) that fits the entry's refund condition; money that
 * came for nothing to them whatever the entry says, also when its record is gone.
 */
export function mayRefund(viewer: Viewer | null, payment: Payment, row?: Record<string, unknown>) {
  if (!viewer || payment.status !== "paid" || !staffOf(viewer, payment.entry)) return false;
  if (unasked(payment)) return true;
  const entry = PAYMENT_ENTRIES[payment.entry];
  if (!entry?.refund || row === undefined) return false;
  return !entry.refund.when || fits(entry.refund.when, row);
}

/** A clear refusal by the provider (not an unanswered call, which is asked again with the same key). */

/**
 * Refunds what is left of a paid Payment (§4.4): marked refunding in one transaction with its
 * refund line, the entry's refund condition checked again there, then the provider asked with the
 * line's own idempotency key. A clear refusal returns it to paid with the reason on the line; an
 * unanswered call leaves the line asked, and the minute timer asks again with the same key.
 * `by` is the person, or none for the app's own refund of money after the hold.
 */
export async function refund(id: number, by: Viewer | null): Promise<void> {
  const asked = db.transaction((tx) => {
    const payment = tx.select().from(payments).where(eq(payments.id, id)).get();
    if (!payment || payment.status !== "paid" || !payment.reference) return undefined;
    const entry = PAYMENT_ENTRIES[payment.entry];
    if (by && !unasked(payment) && entry?.refund?.when) {
      const now = entry.read(tx, payment.record);
      if (!now || !fits(entry.refund.when, now)) return undefined;
    }
    const amount = payment.amount - refundedOf(tx, id);
    if (amount <= 0) return undefined;
    tx.update(payments).set({ status: "refunding" }).where(eq(payments.id, id)).run();
    const line = tx
      .insert(paymentRefunds)
      .values({ paymentId: id, amount, by: by?.id ?? null })
      .returning({ id: paymentRefunds.id })
      .get();
    audit(tx, by ?? APP, {
      action: "refund asked",
      model: entry?.model,
      record: payment.record,
      details: { payment: id, amount },
    });
    return { payment, line: line.id, amount };
  });
  if (!asked) throw new BadInput(w.paymentGone);
  await askRefund(asked.payment, asked.line, asked.amount);
}

/** Asks the provider for one refund line; the same key every time, so asking again is one refund. */
async function askRefund(payment: Payment, line: number, amount: number): Promise<void> {
  const chosen = provider();
  let made: { reference: string; done: boolean };
  try {
    if (!chosen || chosen.name !== payment.provider) throw new Error("the provider is not set up");
    made = await chosen.refund({
      reference: payment.reference as string,
      amount,
      currency: payment.currency,
      idempotencyKey: `refund-${line}`,
    });
  } catch (error) {
    if (!(error instanceof ProviderRefused)) {
      // No clear answer: the line stays asked and the timer asks again.
      log.error("A refund's provider did not answer", { payment: payment.id, error });
      throw new BadInput(w.refundPending);
    }
    log.warn("A refund was refused", { payment: payment.id, error: error.message });
    db.transaction((tx) => {
      tx.update(paymentRefunds)
        .set({ status: "refused", note: error.message })
        .where(and(eq(paymentRefunds.id, line), eq(paymentRefunds.status, "asked")))
        .run();
      tx.update(payments)
        .set({ status: "paid" })
        .where(and(eq(payments.id, payment.id), eq(payments.status, "refunding")))
        .run();
    });
    throw new BadInput(w.refundRefused);
  }
  db.update(paymentRefunds)
    .set({ reference: made.reference })
    .where(and(eq(paymentRefunds.id, line), isNull(paymentRefunds.reference)))
    .run();
  if (made.done && chosen)
    applyEvent(
      {
        id: `refund:${line}`,
        payment: payment.id,
        kind: "refunded",
        amount,
        refund: made.reference,
        mode: payment.providerMode,
      },
      chosen,
    );
}

/** Refund lines left asked (no answer from the provider): asked again with the same key, each minute for a day. */
async function askAgain(now: number): Promise<void> {
  const waiting = db
    .select()
    .from(paymentRefunds)
    .where(
      and(
        eq(paymentRefunds.status, "asked"),
        isNull(paymentRefunds.reference),
        lt(paymentRefunds.createdAt, new Date(now - MINUTE)),
        gt(paymentRefunds.createdAt, new Date(now - DAY)),
      ),
    )
    .limit(20)
    .all();
  for (const line of waiting) {
    const payment = db.select().from(payments).where(eq(payments.id, line.paymentId)).get();
    if (payment?.status === "refunding")
      await askRefund(payment, line.id, line.amount).catch(() => undefined);
  }
}

/** A record's Payments as its page lists them (§3.3): the provider's reference to those who may refund. */
export function paymentsOf(
  viewer: Viewer | null,
  model: string,
  record: number,
  row: Record<string, unknown>,
) {
  const entries = Object.keys(PAYMENT_ENTRIES).filter((e) => PAYMENT_ENTRIES[e]?.model === model);
  if (!entries.length) return { lines: [], pay: null };
  const all = db
    .select()
    .from(payments)
    .where(and(inArray(payments.entry, entries), eq(payments.record, record)))
    .orderBy(desc(payments.createdAt))
    .all();
  // Why a refund was refused, for those who see the references.
  const refusals = new Map(
    db
      .select({ payment: paymentRefunds.paymentId, note: paymentRefunds.note })
      .from(paymentRefunds)
      .where(
        and(
          inArray(
            paymentRefunds.paymentId,
            all.map((p) => p.id),
          ),
          eq(paymentRefunds.status, "refused"),
        ),
      )
      .orderBy(paymentRefunds.id)
      .all()
      .map((r) => [r.payment, r.note]),
  );
  const sold = (p: Payment) =>
    (p.status === "paid" || p.status === "refunding") &&
    !(UNASKED as readonly string[]).includes(p.note ?? "");
  // Pay is offered on a record that fits its entry's condition and is not paid (§4.1).
  const offer = entries.find((e) => {
    const entry = PAYMENT_ENTRIES[e];
    return entry?.when && fits(entry.when, row) && !all.some((p) => p.entry === e && sold(p));
  });
  return {
    lines: all.map((p) => ({
      id: p.id,
      amount: p.amount,
      currency: p.currency,
      status: p.status,
      at: (p.paidAt ?? p.createdAt).toISOString(),
      ...(staffOf(viewer, p.entry)
        ? { reference: p.reference, note: p.note ?? refusals.get(p.id) ?? null }
        : {}),
      refundable: mayRefund(viewer, p, row),
    })),
    pay:
      offer && provider()
        ? {
            entry: offer,
            amount: Math.round(Number(row[PAYMENT_ENTRIES[offer]?.amount ?? ""] ?? 0)),
          }
        : null,
  };
}

/**
 * Starts paying for an existing record (§4.1): the record read as the viewer may (the caller
 * passes it), checked against its entry's condition and that it is not paid, its amount read here,
 * the pending Payment written (or the one there found), bound to this browser, and the provider's
 * page asked.
 */
export async function startPayment(
  entryName: string,
  row: Record<string, unknown> & { id: number },
  description: string,
): Promise<string> {
  const entry = PAYMENT_ENTRIES[entryName];
  if (!entry?.when || !fits(entry.when, row)) throw new BadInput(w.paymentGone);
  const amount = Math.round(Number(row[entry.amount] ?? 0));
  if (!(amount > 0)) throw new BadInput(w.paymentGone);
  const id = db.transaction((tx) => {
    const paid = tx
      .select({ id: payments.id })
      .from(payments)
      .where(
        and(
          eq(payments.entry, entryName),
          eq(payments.record, row.id),
          inArray(payments.status, ["paid", "refunding"]),
          or(isNull(payments.note), notInArray(payments.note, [...UNASKED])),
        ),
      )
      .get();
    if (paid) throw new BadInput(w.paymentGone);
    // A pending one for another amount (the record changed since) is given up for a new one.
    const pending = tx
      .select()
      .from(payments)
      .where(
        and(
          eq(payments.entry, entryName),
          eq(payments.record, row.id),
          eq(payments.status, "pending"),
        ),
      )
      .get();
    if (pending && pending.amount !== amount) fail(tx, pending, "left unfinished");
    return askPayment(tx, entryName, row.id, amount, app.currency, description);
  });
  bindBrowser(id);
  return checkout(id);
}

/** Money that came after its record was released is refunded by the app itself, retried each minute for a day (§4.3). */
async function refundLate(now: number): Promise<void> {
  const late = db
    .select()
    .from(payments)
    .where(
      and(
        eq(payments.status, "paid"),
        eq(payments.note, "paid after the hold"),
        gt(payments.paidAt, new Date(now - DAY)),
      ),
    )
    .limit(20)
    .all();
  for (const payment of late) {
    // Asked once by the app: an unanswered ask is asked again by askAgain; a refused one waits for
    // an admin on the Payments page.
    const tried = db
      .select({ n: count() })
      .from(paymentRefunds)
      .where(eq(paymentRefunds.paymentId, payment.id))
      .get();
    if ((tried?.n ?? 0) > 0) continue;
    await refund(payment.id, null).catch(() => undefined);
  }
}

/** A Payment as its return page shows it: the state, and the record's id for a reader. */
export function paymentState(id: number) {
  const payment = db.select().from(payments).where(eq(payments.id, id)).get();
  if (!payment) return null;
  return {
    id: payment.id,
    entry: payment.entry,
    record: payment.record,
    amount: payment.amount,
    currency: payment.currency,
    status: payment.status,
    note: payment.note,
    description: payment.description ?? "",
    heldUntil: new Date(payment.createdAt.getTime() + holdMinutes() * MINUTE).toISOString(),
  };
}

/**
 * The hold timer (§4.5): a held record whose Payment is past the hold time is released, unless the
 * provider says it was paid (recorded as its event would be) or is still being paid.
 */
export async function releaseExpired(now = Date.now()): Promise<number> {
  // The providers' event ids are kept a month (they retry for days); the Payment's state guards after.
  db.delete(incomingSeen)
    .where(
      and(like(incomingSeen.name, "payments-%"), lt(incomingSeen.at, new Date(now - 30 * DAY))),
    )
    .run();
  const chosen = provider();
  const due = db
    .select()
    .from(payments)
    .where(
      and(
        eq(payments.status, "pending"),
        inArray(
          payments.entry,
          Object.keys(PAYMENT_ENTRIES).filter((name) => PAYMENT_ENTRIES[name]?.created),
        ),
        lt(payments.createdAt, new Date(now - holdMinutes() * MINUTE)),
      ),
    )
    .limit(50)
    .all();
  await refundLate(now);
  await askAgain(now);
  let released = 0;
  for (const payment of due) {
    if (chosen?.status && payment.reference && chosen.name === payment.provider) {
      try {
        const state = await chosen.status(payment.reference);
        if (state === "processing") continue;
        // Closed at the provider first, so it cannot be paid after the place is gone.
        if (state === "open" && chosen.close) await chosen.close(payment.reference);
        if (state === "paid") {
          applyEvent(
            {
              id: `hold:${payment.id}`,
              payment: payment.id,
              reference: payment.reference,
              kind: "paid",
              amount: payment.amount,
              currency: payment.currency,
              mode: payment.providerMode,
            },
            chosen,
          );
          continue;
        }
      } catch (error) {
        // Not reached: asked again next minute.
        log.error("A held payment's provider could not be asked", { payment: payment.id, error });
        continue;
      }
    }
    if (db.transaction((tx) => fail(tx, payment, "not paid in time"))) released++;
  }
  return released;
}

// Every minute, so a place is released within a minute of the hold time. A module evaluated
// again replaces the timer of the one before, never adds to it.
const state = globalThis as { smithablePaymentsTimer?: ReturnType<typeof setInterval> };
if (import.meta.env.SSR) {
  if (state.smithablePaymentsTimer) clearInterval(state.smithablePaymentsTimer);
  const every = Math.min(
    MINUTE,
    Math.max(1_000, (Number(process.env.PAYMENTS_HOLD_CHECK_SECONDS) || 60) * 1000),
  );
  state.smithablePaymentsTimer = setInterval(() => {
    releaseExpired().catch((error) => log.error("The hold timer failed", { error }));
  }, every);
  state.smithablePaymentsTimer.unref?.();
}

/** A Payment as stored, for a refund's checks. */
export const paymentRow = (id: number): Payment | undefined =>
  db.select().from(payments).where(eq(payments.id, id)).get();

/** Whether a person sees the Payments page: admins and the roles any entry lets refund (§3.3). */
export const seesPayments = (viewer: Viewer | null) =>
  Boolean(
    viewer &&
      ["admin", ...Object.values(PAYMENT_ENTRIES).flatMap((e) => e.refund?.by ?? [])].includes(
        viewer.role,
      ),
  );

/** The Payments page (§3.3): all of them, newest first, filtered by status, 200 at most. */
export function allPayments(viewer: Viewer | null, status?: Payment["status"]) {
  if (!seesPayments(viewer)) return null;
  // Each role sees the entries it may refund; admins all of them.
  const shown = Object.keys(PAYMENT_ENTRIES).filter((e) => staffOf(viewer, e));
  return db
    .select()
    .from(payments)
    .where(and(inArray(payments.entry, shown), status ? eq(payments.status, status) : undefined))
    .orderBy(desc(payments.createdAt))
    .limit(200)
    .all()
    .map((p) => ({
      id: p.id,
      model: PAYMENT_ENTRIES[p.entry]?.model ?? p.entry,
      record: p.record,
      amount: p.amount,
      currency: p.currency,
      status: p.status,
      at: (p.paidAt ?? p.createdAt).toISOString(),
      reference: p.reference,
      note: p.note,
      description: p.description ?? "",
      // The page has no record to read: a refund that depends on one is made on the record's page.
      refundable: mayRefund(viewer, p),
    }));
}
