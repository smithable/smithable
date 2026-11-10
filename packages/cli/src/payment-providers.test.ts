import { createHmac } from "node:crypto";
import { afterEach, beforeEach, expect, test, vi } from "vitest";

// The kit's payment providers, as the generated apps get them (a path the build does not follow).
// The providers' APIs are stood in for by a fetch that answers as they do (payments.md §6).
type Event = { id: string; payment: number; kind: string; amount?: number; refund?: string };
type Provider = {
  ready(): boolean;
  mode(): string;
  createCheckout(asked: Record<string, unknown>): Promise<{ reference: string; url: string }>;
  verifyEvent(request: Request, body: string, app: string): Promise<Event[] | null>;
  refund(asked: Record<string, unknown>): Promise<{ reference: string; done: boolean }>;
};
const path: string = "../../adapter-tanstack/templates/src/kit/payments-providers.server.ts";
const kit = (await import(path)) as {
  stripeProvider: Provider;
  mollieProvider: Provider;
  stripeMinor(hundredths: number, currency: string): number;
  fromStripe(minor: number, currency: string): number;
  mollieAmount(hundredths: number, currency: string): { currency: string; value: string };
  ProviderRefused: new (message: string) => Error;
};

const calls: { url: string; init: RequestInit }[] = [];
let answers: Record<string, unknown>[] = [];
beforeEach(() => {
  calls.length = 0;
  answers = [];
  vi.stubGlobal("fetch", async (url: string, init: RequestInit) => {
    calls.push({ url, init });
    const next = answers.shift() ?? {};
    const status = typeof next.__status === "number" ? next.__status : 200;
    return new Response(JSON.stringify(next), { status });
  });
  vi.stubEnv("BETTER_AUTH_URL", "https://kiosk.example.com");
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

const signed = (body: string, secret: string, at = Math.floor(Date.now() / 1000)) =>
  new Request("https://kiosk.example.com/incoming/payments-stripe", {
    method: "POST",
    headers: {
      "stripe-signature": `t=${at},v1=${createHmac("sha256", secret).update(`${at}.${body}`).digest("hex")}`,
    },
    body,
  });

test("amounts go to a provider in its currency's smallest unit; a currency without decimals takes whole ones", () => {
  expect(kit.stripeMinor(2450, "EUR")).toBe(2450);
  expect(kit.stripeMinor(150000, "JPY")).toBe(1500);
  expect(() => kit.stripeMinor(150050, "JPY")).toThrow(kit.ProviderRefused);
  expect(kit.fromStripe(1500, "JPY")).toBe(150000);
  // Stripe writes ISK with two decimals (whole krónur only), whatever Intl says.
  expect(kit.stripeMinor(150000, "ISK")).toBe(150000);
  expect(() => kit.stripeMinor(150050, "ISK")).toThrow(kit.ProviderRefused);
  expect(kit.mollieAmount(2450, "EUR")).toEqual({ currency: "EUR", value: "24.50" });
  expect(kit.mollieAmount(150000, "JPY")).toEqual({ currency: "JPY", value: "1500" });
});

test("Stripe: a checkout of one line, the Payment's id in its metadata, back to the app's address", async () => {
  vi.stubEnv("PAYMENTS_SECRET_KEY", "sk_test_abc");
  vi.stubEnv("PAYMENTS_WEBHOOK_SECRET", "whsec_x");
  expect(kit.stripeProvider.ready()).toBe(true);
  expect(kit.stripeProvider.mode()).toBe("test");
  answers = [{ id: "cs_test_1", url: "https://checkout.stripe.com/c/pay/cs_test_1" }];
  const made = await kit.stripeProvider.createCheckout({
    payment: 7,
    app: "app-1",
    createdAt: new Date(),
    amount: 2450,
    currency: "EUR",
    description: "Order 12",
    back: "https://kiosk.example.com/payments/7/back",
    expiresAt: new Date(Date.now() + 30 * 60_000),
    idempotencyKey: "payment-7-checkout",
  });
  expect(made).toEqual({
    reference: "cs_test_1",
    url: "https://checkout.stripe.com/c/pay/cs_test_1",
  });
  const sent = new URLSearchParams(String(calls[0]?.init.body));
  expect(calls[0]?.url).toBe("https://api.stripe.com/v1/checkout/sessions");
  expect(sent.get("line_items[0][price_data][unit_amount]")).toBe("2450");
  expect(sent.get("line_items[0][price_data][currency]")).toBe("eur");
  expect(sent.get("metadata[payment]")).toBe("7");
  expect(sent.get("payment_intent_data[metadata][payment]")).toBe("7");
  expect(sent.get("success_url")).toBe("https://kiosk.example.com/payments/7/back");
  expect((calls[0]?.init.headers as Record<string, string> | undefined)?.["Idempotency-Key"]).toBe(
    "payment-7-checkout",
  );
});

test("Stripe: a signed completed checkout is a payment; a wrong or old signature is refused", async () => {
  vi.stubEnv("PAYMENTS_WEBHOOK_SECRET", "whsec_x");
  const body = JSON.stringify({
    id: "evt_1",
    type: "checkout.session.completed",
    livemode: false,
    data: {
      object: {
        id: "cs_test_1",
        payment_status: "paid",
        amount_total: 2450,
        currency: "eur",
        metadata: { payment: "7", app: "app-1" },
      },
    },
  });
  expect(await kit.stripeProvider.verifyEvent(signed(body, "whsec_x"), body, "app-1")).toEqual([
    {
      id: "evt_1",
      payment: 7,
      reference: "cs_test_1",
      kind: "paid",
      amount: 2450,
      currency: "EUR",
      mode: "test",
    },
  ]);
  expect(
    await kit.stripeProvider.verifyEvent(signed(body, "whsec_other"), body, "app-1"),
  ).toBeNull();
  const old = Math.floor(Date.now() / 1000) - 600;
  expect(
    await kit.stripeProvider.verifyEvent(signed(body, "whsec_x", old), body, "app-1"),
  ).toBeNull();
  // Paid later (a method that settles after): nothing until Stripe says so.
  const unpaid = body.replace('"payment_status":"paid"', '"payment_status":"unpaid"');
  expect(await kit.stripeProvider.verifyEvent(signed(unpaid, "whsec_x"), unpaid, "app-1")).toEqual(
    [],
  );
});

test("Stripe: a refund event reads the intent's refunds, a dashboard's partial one too", async () => {
  vi.stubEnv("PAYMENTS_SECRET_KEY", "sk_test_abc");
  vi.stubEnv("PAYMENTS_WEBHOOK_SECRET", "whsec_x");
  const body = JSON.stringify({
    id: "evt_2",
    type: "charge.refunded",
    livemode: false,
    data: { object: { id: "ch_1", payment_intent: "pi_1" } },
  });
  answers = [
    { id: "pi_1", currency: "eur", metadata: { payment: "7", app: "app-1" } },
    {
      data: [
        { id: "re_1", status: "succeeded", amount: 1000 },
        { id: "re_2", status: "pending", amount: 450 },
        { id: "re_3", status: "failed", amount: 450, failure_reason: "lost_or_stolen_card" },
      ],
    },
  ];
  const events = await kit.stripeProvider.verifyEvent(signed(body, "whsec_x"), body, "app-1");
  expect(events?.map((e) => [e.id, e.kind, e.amount, e.refund])).toEqual([
    ["re_1:succeeded", "refunded", 1000, "re_1"],
    ["re_3:failed", "refund-refused", 450, "re_3"],
  ]);
});

test("Mollie: the call names only a payment; what the app acts on is Mollie's answer", async () => {
  vi.stubEnv("PAYMENTS_SECRET_KEY", "test_abc");
  expect(kit.mollieProvider.ready()).toBe(true);
  answers = [
    {
      id: "tr_1",
      status: "paid",
      mode: "test",
      amount: { currency: "EUR", value: "24.50" },
      metadata: { payment: 7, app: "app-1" },
      _embedded: {
        refunds: [{ id: "re_9", status: "refunded", amount: { currency: "EUR", value: "10.00" } }],
      },
    },
  ];
  const events = await kit.mollieProvider.verifyEvent(
    new Request("https://x.example"),
    "id=tr_1",
    "app-1",
  );
  expect(calls[0]?.url).toBe("https://api.mollie.com/v2/payments/tr_1?embed=refunds");
  expect(events?.map((e) => [e.id, e.kind, e.amount])).toEqual([
    ["tr_1:paid", "paid", 2450],
    ["re_9:refunded", "refunded", 1000],
  ]);
  // Not an id of Mollie's, or a payment not of this account: nothing, answered 200.
  expect(
    await kit.mollieProvider.verifyEvent(new Request("https://x.example"), "id=../x", "app-1"),
  ).toEqual([]);
  answers = [{ __status: 404, detail: "No payment exists with token tr_2." }];
  // A refused key is no "not ours": an error, so Mollie calls again (not dropped with a 200).
  const refusedKey = async () => {
    answers = [{ __status: 401, detail: "Missing authentication" }];
    return kit.mollieProvider.verifyEvent(new Request("https://x.example"), "id=tr_3", "app-1");
  };
  await expect(refusedKey()).rejects.toThrow();
  // Another app on the same account: nothing for this one.
  answers = [
    {
      id: "tr_4",
      status: "paid",
      mode: "test",
      amount: { currency: "EUR", value: "1.00" },
      metadata: { payment: 7, app: "app-2" },
    },
  ];
  expect(
    await kit.mollieProvider.verifyEvent(new Request("https://x.example"), "id=tr_4", "app-1"),
  ).toEqual([]);
  expect(
    await kit.mollieProvider.verifyEvent(new Request("https://x.example"), "id=tr_2", "app-1"),
  ).toEqual([]);
});

test("Mollie: a checkout in its amount format; a refused refund is a clear refusal", async () => {
  vi.stubEnv("PAYMENTS_SECRET_KEY", "live_abc");
  expect(kit.mollieProvider.mode()).toBe("live");
  answers = [
    { id: "tr_1", _links: { checkout: { href: "https://www.mollie.com/checkout/tr_1" } } },
  ];
  await kit.mollieProvider.createCheckout({
    payment: 7,
    app: "app-1",
    createdAt: new Date(),
    amount: 2450,
    currency: "EUR",
    description: "Order 12",
    back: "https://kiosk.example.com/payments/7/back",
    expiresAt: new Date(),
    idempotencyKey: "payment-7-checkout",
  });
  expect(JSON.parse(String(calls[0]?.init.body))).toMatchObject({
    amount: { currency: "EUR", value: "24.50" },
    webhookUrl: "https://kiosk.example.com/incoming/payments-mollie",
    metadata: { payment: 7 },
  });
  // Asked again after an hour, a refund an earlier try made is that refund, not a second.
  answers = [
    { _embedded: { refunds: [{ id: "re_5", status: "pending", metadata: { key: "refund-1" } }] } },
  ];
  expect(
    await kit.mollieProvider.refund({
      reference: "tr_1",
      amount: 2450,
      currency: "EUR",
      idempotencyKey: "refund-1",
    }),
  ).toEqual({ reference: "re_5", done: false });
  expect(calls.at(-1)?.init.method).toBe("GET");
  answers = [
    { _embedded: { refunds: [] } },
    { __status: 422, detail: "The amount is higher than the amount that can be refunded." },
  ];
  await expect(
    kit.mollieProvider.refund({
      reference: "tr_1",
      amount: 2450,
      currency: "EUR",
      idempotencyKey: "refund-1",
    }),
  ).rejects.toThrow(kit.ProviderRefused);
  // No answer (a 5xx): not a refusal, asked again with the same key.
  answers = [{ _embedded: { refunds: [] } }, { __status: 503 }];
  await expect(
    kit.mollieProvider.refund({
      reference: "tr_1",
      amount: 2450,
      currency: "EUR",
      idempotencyKey: "refund-1",
    }),
  ).rejects.not.toThrow(kit.ProviderRefused);
});
