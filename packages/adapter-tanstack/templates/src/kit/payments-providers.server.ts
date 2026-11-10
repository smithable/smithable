// Smithable app kit: the payment providers (docs/design/payments.md §5): Stripe and Mollie, over
// their plain HTTPS APIs (no SDK in the app). Each makes a checkout on its own page, verifies the
// provider's word by the provider's own scheme (Stripe signs its calls; Mollie's carry only an id,
// so the payment is asked of Mollie with the app's key), refunds, and says how a checkout stands
// for the hold timer. The settings are PAYMENTS_SECRET_KEY and, for Stripe, PAYMENTS_WEBHOOK_SECRET;
// the app's own address is BETTER_AUTH_URL. Behind the hosted service's egress proxy fetch goes
// through it (NODE_USE_ENV_PROXY), which lets only the provider's hosts out.
import { createHmac, timingSafeEqual } from "node:crypto";
import type { PaymentEvent, Provider } from "./payments.server";

/** A clear refusal by the provider (not an unanswered call, which is asked again with the same key). */
export class ProviderRefused extends Error {}

const TIMEOUT = 20_000;

/** The app's own address, which the provider sends the payer back to and calls. */
export const appAddress = () => (process.env.BETTER_AUTH_URL ?? "").replace(/\/$/, "");

/** A currency's minor units (2 for EUR, 0 for JPY): amounts are stored in hundredths (§3.4). */
export function minorUnits(currency: string): number {
  return new Intl.NumberFormat("en", { style: "currency", currency }).resolvedOptions()
    .maximumFractionDigits as number;
}

/** Hundredths as the provider's smallest unit; a currency without decimals takes whole amounts only. */
export function inMinor(hundredths: number, currency: string): number {
  const units = minorUnits(currency);
  if (units === 2) return hundredths;
  if (units === 0 && hundredths % 100 === 0) return hundredths / 100;
  throw new ProviderRefused(`an amount of ${hundredths / 100} cannot be paid in ${currency}`);
}

/** The provider's smallest unit back in hundredths. */
export const fromMinor = (minor: number, currency: string) =>
  minorUnits(currency) === 0 ? minor * 100 : minor;

const same = (a: string, b: string) => {
  const [x, y] = [Buffer.from(a), Buffer.from(b)];
  return x.length === y.length && timingSafeEqual(x, y);
};

/** A call to a provider's API: its JSON, or a refusal (4xx, the provider's own message) or an error (no answer, 5xx). */
async function call(
  url: string,
  init: RequestInit & { idempotencyKey?: string },
): Promise<Record<string, unknown>> {
  const { idempotencyKey, ...rest } = init;
  const answer = await fetch(url, {
    ...rest,
    headers: {
      ...(rest.headers as Record<string, string>),
      ...(idempotencyKey ? { "Idempotency-Key": idempotencyKey } : {}),
    },
    redirect: "manual",
    signal: AbortSignal.timeout(TIMEOUT),
  });
  const body = (await answer.json().catch(() => ({}))) as Record<string, unknown>;
  // A clear refusal (the request was wrong or not allowed): not asked again with the same key.
  if (answer.status >= 400 && answer.status < 500 && answer.status !== 409 && answer.status !== 429)
    throw new ProviderRefused(
      String(
        (body.error as { message?: string } | undefined)?.message ??
          body.detail ??
          `the provider answered ${answer.status}`,
      ),
    );
  if (!answer.ok) throw new Error(`the provider answered ${answer.status}`);
  return body;
}

/** Form encoding as Stripe takes it: nested keys in brackets. */
function form(values: Record<string, unknown>, prefix = ""): string[] {
  return Object.entries(values).flatMap(([key, value]) => {
    const name = prefix ? `${prefix}[${key}]` : key;
    if (value === undefined || value === null) return [];
    if (typeof value === "object") return form(value as Record<string, unknown>, name);
    return [`${encodeURIComponent(name)}=${encodeURIComponent(String(value))}`];
  });
}

const stripeKey = () => process.env.PAYMENTS_SECRET_KEY ?? "";

async function stripe(
  method: "GET" | "POST",
  path: string,
  values?: Record<string, unknown>,
  idempotencyKey?: string,
) {
  return call(`https://api.stripe.com${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${stripeKey()}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    ...(values ? { body: form(values).join("&") } : {}),
    ...(idempotencyKey ? { idempotencyKey } : {}),
  });
}

/**
 * Stripe: a Checkout Session of one line, the Payment's id in its metadata and its payment
 * intent's. Its calls are signed (Stripe-Signature, v1, five minutes); the refund events are
 * read back from the payment intent's refunds, so a refund made in the dashboard is a line too.
 */
export const stripeProvider: Provider = {
  name: "stripe",
  mode: () =>
    stripeKey().startsWith("sk_live_") || stripeKey().startsWith("rk_live_") ? "live" : "test",
  ready: () =>
    /^(sk|rk)_(test|live)_/.test(stripeKey()) &&
    Boolean(process.env.PAYMENTS_WEBHOOK_SECRET) &&
    appAddress().startsWith("http"),
  async createCheckout({
    payment,
    amount,
    currency,
    description,
    back,
    expiresAt,
    idempotencyKey,
  }) {
    const session = await stripe(
      "POST",
      "/v1/checkout/sessions",
      {
        mode: "payment",
        line_items: {
          0: {
            quantity: 1,
            price_data: {
              currency: currency.toLowerCase(),
              unit_amount: inMinor(amount, currency),
              product_data: { name: description.slice(0, 250) || "Payment" },
            },
          },
        },
        success_url: back,
        cancel_url: back,
        metadata: { payment },
        payment_intent_data: { metadata: { payment } },
        // Stripe takes 30 minutes to 24 hours.
        expires_at: Math.floor(
          Math.min(
            Math.max(expiresAt.getTime(), Date.now() + 31 * 60_000),
            Date.now() + 23 * 3600_000,
          ) / 1000,
        ),
      },
      idempotencyKey,
    );
    return { reference: String(session.id), url: String(session.url) };
  },
  async verifyEvent(request, body) {
    const secret = process.env.PAYMENTS_WEBHOOK_SECRET ?? "";
    const header = request.headers.get("stripe-signature") ?? "";
    const parts = header.split(",").map((p) => p.split("=") as [string, string]);
    const stamp = parts.find(([k]) => k === "t")?.[1] ?? "";
    const signed = parts.filter(([k]) => k === "v1").map(([, v]) => v);
    const expected = createHmac("sha256", secret).update(`${stamp}.${body}`).digest("hex");
    if (!secret || !signed.some((s) => same(s, expected))) return null;
    if (!/^\d+$/.test(stamp) || Math.abs(Date.now() / 1000 - Number(stamp)) > 300) return null;
    const event = JSON.parse(body) as {
      id: string;
      type: string;
      livemode: boolean;
      account?: string;
      data: { object: Record<string, unknown> };
    };
    const mode = event.livemode ? "live" : "test";
    const object = event.data.object;
    const payment = Number((object.metadata as Record<string, string> | undefined)?.payment);
    switch (event.type) {
      case "checkout.session.completed":
      case "checkout.session.async_payment_succeeded":
        // Paid now, or later by a method that settles after (then async_payment_succeeded says so).
        if (object.payment_status !== "paid" || !Number.isInteger(payment)) return [];
        return [
          {
            id: event.id,
            payment,
            reference: String(object.id),
            kind: "paid",
            amount: fromMinor(Number(object.amount_total), String(object.currency).toUpperCase()),
            currency: String(object.currency).toUpperCase(),
            mode,
            ...(event.account ? { account: event.account } : {}),
          },
        ];
      case "checkout.session.expired":
      case "checkout.session.async_payment_failed":
        if (!Number.isInteger(payment)) return [];
        return [
          {
            id: event.id,
            payment,
            reference: String(object.id),
            kind: "failed",
            mode,
            reason: event.type === "checkout.session.expired" ? "not paid in time" : "declined",
          },
        ];
      case "charge.refunded":
      case "refund.created":
      case "refund.updated":
      case "refund.failed": {
        // Read back from the payment intent: its metadata names the Payment, its refunds are the lines.
        const intent = String(object.payment_intent ?? "");
        if (!intent) return [];
        return refundsOf(intent, mode);
      }
      default:
        return [];
    }
  },
  async status(reference) {
    const session = await stripe("GET", `/v1/checkout/sessions/${encodeURIComponent(reference)}`);
    if (session.payment_status === "paid") return "paid";
    return session.status === "open"
      ? "open"
      : session.status === "complete"
        ? "processing"
        : "open";
  },
  async close(reference) {
    await stripe("POST", `/v1/checkout/sessions/${encodeURIComponent(reference)}/expire`).catch(
      (error) => {
        // Already complete or expired: nothing to close.
        if (!(error instanceof ProviderRefused)) throw error;
      },
    );
  },
  async refund({ reference, amount, currency, idempotencyKey }) {
    const session = await stripe("GET", `/v1/checkout/sessions/${encodeURIComponent(reference)}`);
    const intent = String(session.payment_intent ?? "");
    if (!intent) throw new ProviderRefused("the payment has no charge to refund");
    const made = await stripe(
      "POST",
      "/v1/refunds",
      { payment_intent: intent, amount: inMinor(amount, currency) },
      idempotencyKey,
    );
    if (made.status === "failed" || made.status === "canceled")
      throw new ProviderRefused(String(made.failure_reason ?? made.status));
    return { reference: String(made.id), done: made.status === "succeeded" };
  },
};

/** A Stripe payment intent's refunds as events: done ones and refused ones, each once. */
async function refundsOf(intent: string, mode: "test" | "live"): Promise<PaymentEvent[]> {
  const found = await stripe("GET", `/v1/payment_intents/${encodeURIComponent(intent)}`);
  const payment = Number((found.metadata as Record<string, string> | undefined)?.payment);
  if (!Number.isInteger(payment)) return [];
  const currency = String(found.currency).toUpperCase();
  const listed = await stripe(
    "GET",
    `/v1/refunds?payment_intent=${encodeURIComponent(intent)}&limit=100`,
  );
  return ((listed.data as Record<string, unknown>[]) ?? []).flatMap((r): PaymentEvent[] => {
    const status = String(r.status);
    if (status !== "succeeded" && status !== "failed" && status !== "canceled") return [];
    return [
      {
        id: `${r.id}:${status}`,
        payment,
        kind: status === "succeeded" ? "refunded" : "refund-refused",
        amount: fromMinor(Number(r.amount), currency),
        refund: String(r.id),
        mode,
        ...(status !== "succeeded" ? { reason: String(r.failure_reason ?? status) } : {}),
      },
    ];
  });
}

const mollieKey = () => process.env.PAYMENTS_SECRET_KEY ?? "";

async function mollie(
  method: "GET" | "POST" | "DELETE",
  path: string,
  values?: Record<string, unknown>,
  idempotencyKey?: string,
) {
  return call(`https://api.mollie.com/v2${path}`, {
    method,
    headers: { Authorization: `Bearer ${mollieKey()}`, "Content-Type": "application/json" },
    ...(values ? { body: JSON.stringify(values) } : {}),
    ...(idempotencyKey ? { idempotencyKey } : {}),
  });
}

/** Mollie's amount: the currency and the value as text with its decimals ("10.00"). */
const mollieAmount = (hundredths: number, currency: string) => {
  const units = minorUnits(currency);
  const minor = inMinor(hundredths, currency);
  return { currency, value: (minor / 10 ** units).toFixed(units) };
};
const fromMollie = (amount: { value: string; currency: string } | undefined) =>
  amount ? Math.round(Number(amount.value) * 100) : undefined;

/**
 * Mollie: a payment with the Payment's id in its metadata. Its calls carry only the payment's id
 * (tr_…), unsigned, so the payment and its refunds are asked of Mollie with the app's key: the
 * answer, not the call, is what the app acts on (§4.3).
 */
export const mollieProvider: Provider = {
  name: "mollie",
  mode: () => (mollieKey().startsWith("live_") ? "live" : "test"),
  ready: () => /^(test|live)_/.test(mollieKey()) && appAddress().startsWith("https:"),
  async createCheckout({ payment, amount, currency, description, back, idempotencyKey }) {
    const made = await mollie(
      "POST",
      "/payments",
      {
        amount: mollieAmount(amount, currency),
        description: description.slice(0, 255) || "Payment",
        redirectUrl: back,
        cancelUrl: back,
        webhookUrl: `${appAddress()}/incoming/payments-mollie`,
        metadata: { payment },
      },
      idempotencyKey,
    );
    const links = made._links as { checkout?: { href?: string } } | undefined;
    if (!links?.checkout?.href) throw new Error("Mollie gave no checkout page");
    return { reference: String(made.id), url: links.checkout.href };
  },
  async verifyEvent(_request, body) {
    const id = new URLSearchParams(body).get("id") ?? "";
    // Only a payment's id; anything else is not the app's (answered 200, as Mollie asks).
    if (!/^tr_[A-Za-z0-9]+$/.test(id)) return [];
    let found: Record<string, unknown>;
    try {
      found = await mollie("GET", `/payments/${id}?embed=refunds`);
    } catch (error) {
      // Not a payment of this account: nothing to act on.
      if (error instanceof ProviderRefused) return [];
      throw error;
    }
    const payment = Number((found.metadata as Record<string, unknown> | null)?.payment);
    if (!Number.isInteger(payment)) return [];
    const mode = found.mode === "live" ? "live" : "test";
    const status = String(found.status);
    const events: PaymentEvent[] = [];
    if (status === "paid")
      events.push({
        id: `${id}:paid`,
        payment,
        reference: id,
        kind: "paid",
        amount: fromMollie(found.amount as { value: string; currency: string }),
        currency: String((found.amount as { currency: string }).currency),
        mode,
      });
    if (status === "failed" || status === "canceled" || status === "expired")
      events.push({
        id: `${id}:${status}`,
        payment,
        reference: id,
        kind: "failed",
        mode,
        reason:
          status === "expired"
            ? "not paid in time"
            : status === "canceled"
              ? "cancelled"
              : "declined",
      });
    const refunds =
      (found._embedded as { refunds?: Record<string, unknown>[] } | undefined)?.refunds ?? [];
    for (const r of refunds) {
      const state = String(r.status);
      if (state !== "refunded" && state !== "failed" && state !== "canceled") continue;
      events.push({
        id: `${r.id}:${state}`,
        payment,
        reference: id,
        kind: state === "refunded" ? "refunded" : "refund-refused",
        amount: fromMollie(r.amount as { value: string; currency: string }),
        refund: String(r.id),
        mode,
        ...(state !== "refunded" ? { reason: state } : {}),
      });
    }
    return events;
  },
  async status(reference) {
    const found = await mollie("GET", `/payments/${encodeURIComponent(reference)}`);
    const status = String(found.status);
    if (status === "paid") return "paid";
    if (status === "pending" || status === "authorized") return "processing";
    return "open";
  },
  async close(reference) {
    // Only an open payment can be cancelled; one that is not, is left to its own end.
    await mollie("DELETE", `/payments/${encodeURIComponent(reference)}`).catch((error) => {
      if (!(error instanceof ProviderRefused)) throw error;
    });
  },
  async refund({ reference, amount, currency, idempotencyKey }) {
    const made = await mollie(
      "POST",
      `/payments/${encodeURIComponent(reference)}/refunds`,
      { amount: mollieAmount(amount, currency) },
      idempotencyKey,
    );
    if (made.status === "failed" || made.status === "canceled")
      throw new ProviderRefused(String(made.status));
    return { reference: String(made.id), done: made.status === "refunded" };
  },
};
