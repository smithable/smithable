// Smithable app kit: payments (docs/design/payments.md). A record is paid on the provider's own
// page and recorded by the provider's verified word, never by the browser's. The kit asks for a
// checkout after the record's transaction, applies the provider's events in one transaction each
// (the event's id taken in incoming_seen in it, the Payment's status moving only as
// PAYMENT_MOVES allow), and releases a held record nobody paid for. The app's own part (which
// record, how much, what a payment sets and tells) is the generated payments module's.
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { getCookie, setCookie } from "@tanstack/react-start/server";
import { and, eq, like, lt } from "drizzle-orm";
import { db } from "#/db";
import { appKeys, incomingSeen, payments } from "#/db/schema";
import { PAYMENT_ENTRIES, PAYMENTS_PROVIDER } from "#/generated/payments.server";
import type { Viewer } from "./access";
import { audit } from "./audit.server";
import { log } from "./log.server";
import { BadInput } from "./refusal";
import { w } from "./words";

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
  /** The successful payment's work on the record, in the event's transaction: false when there is no record. */
  paid: (tx: Tx, record: number) => boolean;
  /** Removes a held record nobody paid for, its place freed. */
  release: (tx: Tx, record: number) => void;
}

/** The provider's verified word about a payment, as the kit acts on it. */
export interface PaymentEvent {
  /** The event's own id, taken once. */
  id: string;
  /** The Payment's id, from the provider's metadata. */
  payment: number;
  reference?: string;
  kind: "paid" | "failed";
  /** In hundredths, as the Payment's. */
  amount?: number;
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
  }) => Promise<{ reference: string; url: string; account?: string }>;
  verifyEvent: (request: Request, body: string) => Promise<PaymentEvent | null>;
  /** Asked by the hold timer before a held record is released; "open" lets it go. */
  status?: (reference: string) => Promise<"paid" | "open" | "processing">;
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
    return typeof event.id === "string" && Number.isInteger(event.payment) ? event : null;
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

const same = (a: string, b: string) =>
  a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b));

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
    secure: !import.meta.env.DEV,
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
  let event: PaymentEvent | null = null;
  try {
    event = await chosen.verifyEvent(request, body);
  } catch {
    event = null;
  }
  if (!event) {
    log.warn("A payments call was refused: not verified", { provider: name });
    return answer(401);
  }
  try {
    const done = applyEvent(event, chosen);
    if (done === "unknown") {
      log.warn("A payments call was refused: not a payment of this app", {
        provider: name,
        payment: event.payment,
      });
      return answer(401);
    }
    return answer(200);
  } catch (error) {
    // Not recorded: the provider tries again.
    log.error("A payments call failed", { provider: name, error });
    return answer(500);
  }
}

const PROVIDERS: Record<string, Provider> = { fake };

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
      back: `/payments/${payment.id}/back`,
      expiresAt: new Date(payment.createdAt.getTime() + holdMinutes() * MINUTE),
    });
    db.update(payments)
      .set({
        reference: made.reference,
        checkoutUrl: made.url,
        providerAccount: made.account ?? null,
      })
      .where(and(eq(payments.id, id), eq(payments.status, "pending")))
      .run();
    return made.url;
  } catch (error) {
    log.error("A payment's checkout could not be made", { payment: id, error });
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
    if (!note && entry && !entry.paid(tx, payment.record)) {
      tx.update(payments)
        .set({ note: "the record no longer asks" })
        .where(eq(payments.id, payment.id))
        .run();
    }
    return "done";
  });
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
        lt(payments.createdAt, new Date(now - holdMinutes() * MINUTE)),
      ),
    )
    .limit(50)
    .all()
    .filter((p) => PAYMENT_ENTRIES[p.entry]?.created);
  let released = 0;
  for (const payment of due) {
    if (chosen?.status && payment.reference && chosen.name === payment.provider) {
      try {
        const state = await chosen.status(payment.reference);
        if (state === "processing") continue;
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
