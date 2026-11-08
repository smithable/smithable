import { expect, test } from "vitest";
import { applyOperation, findOperation, parseOperationArgs } from "./apply.js";
import { validateContent } from "./content.js";
import { paymentsProviderNote, validateContext } from "./context-file.js";
import { PAYMENT_MOVES, PAYMENT_STATUSES, paymentMoves } from "./ir.js";
import { paymentText } from "./sections/payments.js";
import { validateSpec } from "./spec.js";

// Payments (docs/design/payments.md §3, §4.3): the section, the built-in Payment models, the
// states, outgoing's `when`, the {pay} placeholder, the context key and the operations.
const spec = `smithable: 0.1
app: { name: Kiosk, currency: EUR }
models:
  Customer:
    fields:
      name: string
      email: email
      cardNumber: string
  Order:
    fields:
      number: string
      customer: Customer
      status: placed | ready | declined
      paid: bool
      total: money
      lines: Line[]
  Line:
    fields:
      order: Order!
      amount: money
  Invoice:
    fields:
      number: string
      status: draft | sent | overdue | paid
      base: money
      sum: { type: money, formula: "base * 2" }
actions:
  markSent: { on: Invoice, when: { status: draft }, set: { status: sent } }
payments:
  orderPayment:
    on: Order
    amount: total
    when: created
    paid: { set: { paid: true } }
    refund: { by: [admin], when: { status: declined } }
    description: "Order {number} for {customer.name}"
  invoicePayment:
    on: Invoice
    amount: sum
    when: { status: [sent, overdue] }
    paid: { set: { status: paid } }
outgoing:
  receipt:
    when: orderPayment
    to: mail
    recipient: customer.email
`;

const errors = (text: string, roles?: string[]) =>
  validateSpec({ path: "smithable.yml", text }, roles ? { roles } : {}).diagnostics.filter(
    (d) => d.severity === "error",
  );
const messages = (text: string, roles?: string[]) => errors(text, roles).map((d) => d.message);
const swap = (from: string, to: string) => {
  if (!spec.includes(from)) throw new Error(`not in the spec: ${from}`);
  return spec.split(from).join(to);
};

test("the section reads into the IR, with the built-in models and the pay-to-create flag", () => {
  const { ir, diagnostics } = validateSpec({ path: "smithable.yml", text: spec });
  expect(diagnostics.filter((d) => d.severity === "error")).toEqual([]);
  expect(ir?.payments).toEqual([
    {
      name: "orderPayment",
      on: "Order",
      amount: "total",
      when: "created",
      paid: { set: [{ field: "paid", value: true }] },
      refund: { by: ["admin"], when: { status: "declined" } },
      description: "Order {number} for {customer.name}",
    },
    {
      name: "invoicePayment",
      on: "Invoice",
      amount: "sum",
      when: { status: ["sent", "overdue"] },
      paid: { set: [{ field: "status", value: "paid" }] },
    },
  ]);
  expect(ir?.models.find((m) => m.name === "Order")?.heldByPayment).toBe(true);
  expect(ir?.models.find((m) => m.name === "Invoice")?.heldByPayment).toBeUndefined();
  expect(ir?.models.map((m) => m.name)).not.toContain("Payment");
  const [payment, refund] = ir?.builtInModels ?? [];
  expect(payment?.fields.map((f) => f.name)).toEqual([
    "entry",
    "record",
    "amount",
    "currency",
    "status",
    "provider",
    "providerMode",
    "providerAccount",
    "reference",
    "note",
    "createdAt",
    "paidAt",
    "refundedAt",
    "refunds",
  ]);
  expect(payment?.fields.find((f) => f.name === "record")?.type).toEqual({
    kind: "scalar",
    name: "string",
  });
  expect(payment?.fields.find((f) => f.name === "status")?.type).toEqual({
    kind: "choice",
    values: [...PAYMENT_STATUSES],
  });
  expect(refund?.name).toBe("PaymentRefund");
  // An outgoing entry hears a payment, on the paid record.
  expect(ir?.outgoing[0]?.when).toEqual({ model: "Order", payment: "orderPayment" });
  // Without a section, nothing of it.
  const none = validateSpec({
    path: "smithable.yml",
    text: spec.slice(0, spec.indexOf("payments:")),
  }).ir;
  expect(none?.payments).toEqual([]);
  expect(none?.builtInModels).toBeUndefined();
});

test("the reader's rules", () => {
  expect(messages(swap("    amount: total\n", "    amount: number\n"))).toContainEqual(
    expect.stringContaining('"amount" is a money field of Order; Order.number is not'),
  );
  expect(messages(swap("    amount: total\n", "    amount: totl\n"))).toContainEqual(
    expect.stringContaining('Order has no field named "totl"'),
  );
  expect(messages(swap("    when: created\n", "    when: placed\n"))).toContainEqual(
    expect.stringContaining('"when" is created (pay to create the record) or a condition'),
  );
  expect(messages(swap("{ status: [sent, overdue] }", "{ status: [sent, lost] }"))).toContainEqual(
    expect.stringContaining('Invoice.status has no value "lost"'),
  );
  expect(messages(swap("    on: Order\n", "    on: Ordr\n"))).toContainEqual(
    'There is no model named "Ordr".',
  );
  // paid.set: stored fields with values; nothing asked, no person, no computed field or reference.
  for (const [set, said] of [
    ["{ paid: }", "nobody is there to be asked"],
    ["{ total: 3 }", ""],
    ["{ lines: x }", "it is a reference"],
    ["{ customer: ME() }", "ME() is a person"],
  ] as const) {
    const found = messages(swap("{ set: { paid: true } }", `{ set: ${set} }`));
    if (said) expect(found).toContainEqual(expect.stringContaining(said));
    else expect(found).toEqual([]);
  }
  expect(messages(swap("{ set: { status: paid } }", "{ set: { sum: 3 } }"))).toContainEqual(
    expect.stringContaining("Invoice.sum cannot be set, it is computed"),
  );
  // refund.by names roles of the auth file; refund.when is a condition on the record.
  expect(messages(spec, ["admin", "staff"])).toEqual([]);
  expect(messages(swap("by: [admin]", "by: [cashier]"), ["admin"])).toContainEqual(
    'There is no role named "cashier".',
  );
  expect(messages(swap("when: { status: declined }", "when: { status: lost }"))).toContainEqual(
    expect.stringContaining('Order.status has no value "lost"'),
  );
  expect(messages(swap("refund: { by: [admin], when", "refund: { when"))).toContainEqual(
    expect.stringContaining('"refund" needs "by"'),
  );
  // The description's placeholders: fields the record page could show, one reference away.
  expect(messages(swap("{customer.name}", "{customer.cardNumber}"))).toContainEqual(
    expect.stringContaining("looks like a card number"),
  );
  expect(messages(swap("{customer.name}", "{lines}"))).toContainEqual(
    expect.stringContaining("lists other records"),
  );
  expect(messages(swap("{customer.name}", "{link}"))).toContainEqual(
    expect.stringContaining("means nothing on the provider's page"),
  );
  expect(messages(swap("{customer.name}", "{nmber}"))).toContainEqual(
    expect.stringContaining('Order has no field named "nmber"'),
  );
  // ME() names nobody when the provider's word comes.
  expect(
    messages(
      swap(
        "Customer\n      status: placed",
        "Customer\n      by: User\n      status: placed",
      ).replace("when: { status: declined }", "when: { by: ME() }"),
    ),
  ).toContainEqual(expect.stringContaining("names the person signed in"));
});

test("the section's refusals: currency, one entry per model, names, the reserved models", () => {
  expect(
    messages(swap("app: { name: Kiosk, currency: EUR }", "app: { name: Kiosk }")),
  ).toContainEqual(expect.stringContaining("so it needs a currency"));
  expect(messages(swap("currency: EUR", "currency: KWD"))).toContainEqual(
    expect.stringContaining("KWD counts in thousandths"),
  );
  expect(messages(swap("currency: EUR", "currency: JPY"))).toEqual([]);
  expect(
    messages(
      swap(
        "outgoing:\n",
        "  again:\n    on: Order\n    amount: total\n    when: { status: ready }\noutgoing:\n",
      ),
    ),
  ).toContainEqual(expect.stringContaining('Order is paid for by "orderPayment" already'));
  expect(messages(swap("  invoicePayment:", "  markSent:"))).toContainEqual(
    expect.stringContaining(`"markSent" is already an action's name`),
  );
  expect(messages(swap("  invoicePayment:", "  Pay:"))).toContainEqual(
    expect.stringContaining('Payment name "Pay"'),
  );
  const own = swap("  Line:\n", "  Payment:\n    fields:\n      sum: money\n  Line:\n");
  expect(errors(own)).toContainEqual(
    expect.objectContaining({
      code: "reserved-model",
      hint: expect.stringContaining("ManualPayment"),
    }),
  );
  // Without a payments section, a model may be called Payment.
  expect(messages(own.slice(0, own.indexOf("payments:")))).toEqual([]);
});

test("a pay-to-create model an incoming call fills is warned about", () => {
  const text = `${spec}incoming:\n  phoneOrder:\n    create: Order\n    set: { number: number }\n`;
  const warned = validateSpec({ path: "smithable.yml", text }).diagnostics;
  expect(warned).toContainEqual(expect.objectContaining({ code: "payment-skipped" }));
});

test("outgoing's when names a payment; a typo is told, with the payments among the hints", () => {
  expect(messages(swap("when: orderPayment", "when: orderPaymnt"))).toContainEqual(
    expect.stringContaining("the name of an action, a timer or a payment"),
  );
});

test("the states and their moves are one table", () => {
  expect(PAYMENT_MOVES.map((m) => `${m.from}>${m.to}`)).toEqual([
    "pending>paid",
    "pending>failed",
    "failed>paid",
    "paid>refunding",
    "paid>refunded",
    "refunding>refunded",
    "refunding>paid",
  ]);
  expect(paymentMoves("pending", "paid", "provider")).toBe(true);
  expect(paymentMoves("pending", "paid", "person")).toBe(false);
  expect(paymentMoves("paid", "refunding", "person")).toBe(true);
  expect(paymentMoves("refunded", "paid", "provider")).toBe(false);
  expect(paymentMoves("paid", "failed", "provider")).toBe(false);
});

test("the summary's words", () => {
  const ir = validateSpec({ path: "smithable.yml", text: spec }).ir;
  if (!ir) throw new Error("no IR");
  const [order, invoice] = ir.payments;
  if (!order || !invoice) throw new Error("no payments");
  expect(paymentText(order, ir.models)).toBe(
    "An order is paid when it is added, on the payment provider's page; a paid order becomes paid: yes. Admins may refund a declined order.",
  );
  expect(paymentText(invoice, ir.models)).toBe(
    "An invoice can be paid while it is sent or overdue; a paid invoice becomes paid.",
  );
  expect(paymentText({ ...invoice, paid: undefined, refund: { by: ["cashier"] } }, ir.models)).toBe(
    "An invoice can be paid while it is sent or overdue. Admins and cashiers may refund a paid invoice.",
  );
});

test("{pay} is a placeholder only for a model that is paid for", () => {
  const text = `${spec}  overdue:\n    when: Invoice changed\n    where: { status: overdue }\n    to: mail\n    recipient: admin\n  lineAdded:\n    when: Line created\n    to: mail\n    recipient: admin\n`;
  const ir = validateSpec({ path: "smithable.yml", text }).ir;
  if (!ir) throw new Error("no IR");
  const check = (content: string) =>
    validateContent(
      { path: "smithable.content.yml", text: `smithableContent: 0.1\n${content}` },
      ir,
    ).diagnostics.map((d) => d.message);
  expect(
    check(`outgoing:\n  overdue:\n    subject: Invoice {number}\n    text: "Pay here: {pay}"\n`),
  ).toEqual([]);
  expect(check(`outgoing:\n  lineAdded:\n    text: "Pay here: {pay}"\n`)).toContainEqual(
    expect.stringContaining('no entry under "payments" is on Line'),
  );
});

test("the context file names the provider; validate notes a missing one", () => {
  const context = (text: string) =>
    validateContext({ path: "smithable.context.yml", text: `smithableContext: 0.1\n${text}` });
  expect(context("payments: { provider: mollie }\n")).toEqual([]);
  expect(context("payments: { provider: paypal }\n")[0]?.message).toContain("payments");
  const ir = validateSpec({ path: "smithable.yml", text: spec }).ir;
  if (!ir) throw new Error("no IR");
  const path = "smithable.context.yml";
  expect(paymentsProviderNote(ir, { path })).toMatchObject({
    severity: "note",
    message: expect.stringContaining(
      "development and preview use fake; a release needs a provider",
    ),
  });
  expect(
    paymentsProviderNote(ir, {
      path,
      text: "smithableContext: 0.1\npayments: { provider: stripe }\n",
    }),
  ).toBeUndefined();
  expect(paymentsProviderNote({ payments: [] }, { path })).toBeUndefined();
});

test("addPayment, setPayment and removePayment; setPaymentProvider writes the context file", () => {
  const bare = spec.slice(0, spec.indexOf("payments:"));
  const op = findOperation("addPayment");
  if (!op) throw new Error("no addPayment");
  const args = parseOperationArgs(op, [
    "invoicePayment",
    "--on",
    "Invoice",
    "--amount",
    "sum",
    "--when",
    "status=sent|overdue",
    "--paid-set",
    "status=paid",
    "--refund-by",
    "admin",
    "--description",
    "Invoice {number}",
  ]);
  const added = applyOperation({ spec: bare }, "addPayment", args);
  if (!added.ok) throw new Error(added.message);
  expect(added.files.spec).toContain(
    "payments:\n  invoicePayment:\n    on: Invoice\n    amount: sum\n    when:\n      status: [sent, overdue]\n    paid:\n      set:\n        status: paid\n    refund:\n      by: [admin]\n    description: Invoice {number}\n",
  );
  const created = applyOperation({ spec: bare }, "addPayment", {
    name: "orderPayment",
    on: "Order",
    amount: "total",
    when: "created",
    paidSet: { paid: "true" },
  });
  if (!created.ok) throw new Error(created.message);
  expect(created.files.spec).toContain(
    "    when: created\n    paid:\n      set:\n        paid: true\n",
  );
  expect(
    applyOperation({ spec: bare }, "addPayment", {
      name: "orderPayment",
      on: "Order",
      amount: "number",
      when: "created",
    }),
  ).toMatchObject({
    ok: false,
    diagnostics: expect.arrayContaining([
      expect.objectContaining({ message: expect.stringContaining("money field") }),
    ]),
  });

  const changed = applyOperation({ spec }, "setPayment", {
    name: "orderPayment",
    paidSet: { none: "" },
    refundBy: ["none"],
    description: "none",
  });
  if (!changed.ok) throw new Error(changed.message);
  expect(changed.files.spec).toContain(
    "  orderPayment:\n    on: Order\n    amount: total\n    when: created\n  invoicePayment:",
  );
  const condition = applyOperation({ spec }, "setPayment", {
    name: "invoicePayment",
    when: { status: "sent" },
    refundBy: ["admin"],
    refundWhen: { status: "paid" },
  });
  if (!condition.ok) throw new Error(condition.message);
  expect(condition.files.spec).toContain(
    "    when:\n      status: sent\n    paid: { set: { status: paid } }\n    refund:\n      by: [admin]\n      when:\n        status: paid\n",
  );

  expect(applyOperation({ spec }, "removePayment", { name: "orderPayment" })).toMatchObject({
    ok: false,
    message: expect.stringContaining('"receipt" under outgoing listens to the payment'),
  });
  const removed = applyOperation({ spec }, "removePayment", { name: "invoicePayment" });
  if (!removed.ok) throw new Error(removed.message);
  expect(removed.files.spec).not.toContain("invoicePayment");
  expect(removed.description).toContain("the Payment lines already made stay");

  const provider = applyOperation({ spec }, "setPaymentProvider", { provider: "mollie" });
  if (!provider.ok) throw new Error(provider.message);
  expect(provider.files.context).toContain("payments:\n  provider: mollie\n");
  expect(provider.description).toContain("you are the merchant");
  const again = applyOperation(provider.files, "setPaymentProvider", { provider: "stripe" });
  expect(again.ok && again.description).toBe("Take payments through stripe");
  const off = applyOperation(again.ok ? again.files : provider.files, "setPaymentProvider", {
    provider: "none",
  });
  expect(off.ok && off.files.context).not.toContain("payments");
});

test("a payment follows a renamed field and refuses the removal of one it uses", () => {
  const renamed = (model: string, from: string, to: string) => {
    const r = applyOperation({ spec }, "renameField", { model, from, to });
    if (!r.ok) throw new Error(r.message);
    return r.files.spec;
  };
  expect(renamed("Order", "total", "sum")).toContain("    amount: sum\n");
  expect(renamed("Order", "paid", "settled")).toContain("paid: { set: { settled: true } }");
  expect(renamed("Order", "status", "state")).toContain("when: { state: declined }");
  expect(renamed("Order", "number", "no")).toContain("description: Order {no} for {customer.name}");
  expect(renamed("Customer", "name", "fullName")).toContain("{customer.fullName}");
  expect(renamed("Invoice", "status", "state")).toContain(
    "when: { state: [sent, overdue] }\n    paid: { set: { state: paid } }",
  );
  for (const [model, field] of [
    ["Order", "total"],
    ["Order", "paid"],
    ["Invoice", "sum"],
    ["Customer", "name"],
  ])
    expect(applyOperation({ spec }, "removeField", { model, field })).toMatchObject({
      ok: false,
      message: expect.stringContaining("change or remove the payment first"),
    });
  // A paid.set formula follows too, and keeps its field; {title} is the record's title, not a field.
  const withFormula = swap(
    "      base: money\n",
    "      base: money\n      fee: money\n      received: money\n      title: string\n",
  ).replace(
    "{ set: { status: paid } }",
    '{ set: { status: paid, received: ROUND(fee * 2) } }\n    description: "{title} {number}"',
  );
  const moved = applyOperation({ spec: withFormula }, "renameField", {
    model: "Invoice",
    from: "fee",
    to: "charge",
  });
  if (!moved.ok) throw new Error(moved.message);
  expect(moved.files.spec).toContain("received: ROUND(charge * 2)");
  const retitled = applyOperation({ spec: withFormula }, "renameField", {
    model: "Invoice",
    from: "title",
    to: "heading",
  });
  if (!retitled.ok) throw new Error(retitled.message);
  expect(retitled.files.spec).toContain('description: "{title} {number}"');
  expect(
    applyOperation({ spec: withFormula }, "removeField", { model: "Invoice", field: "fee" }),
  ).toMatchObject({ ok: false, message: expect.stringContaining("the payment") });
  // A list's field in an aggregate counts too.
  const viaList = swap(
    "{ set: { paid: true } }",
    "{ set: { paid: true, total: SUM(lines.amount) } }",
  );
  expect(
    applyOperation({ spec: viaList }, "removeField", { model: "Line", field: "amount" }),
  ).toMatchObject({
    ok: false,
    message: expect.stringContaining("the payment"),
  });
  const renamedLine = applyOperation({ spec: viaList }, "renameField", {
    model: "Line",
    from: "amount",
    to: "price",
  });
  expect(renamedLine.ok && renamedLine.files.spec).toContain("total: SUM(lines.price)");
});
