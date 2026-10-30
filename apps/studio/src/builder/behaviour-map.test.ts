import { type SpecIR, validateSpec } from "@smithable/core";
import { expect, test } from "vitest";
import invoicingSpec from "../../../../examples/invoicing/smithable.yml?raw";
import { behaviourOf, pictureOf } from "./behaviour-map";
import { behaviourMermaid } from "./mermaid";

const ir = validateSpec({ path: "smithable.yml", text: invoicingSpec }).ir as SpecIR;

test("the invoicing starter's behaviour: actions with when and set, the timer, the mail", () => {
  const { nodes, edges } = behaviourOf(ir);
  expect(nodes.find((n) => n.id === "action:markPaid")).toEqual({
    id: "action:markPaid",
    kind: "action",
    title: "markPaid",
    lines: ["when status is sent or overdue", "sets status = paid"],
  });
  // An action and a timer may share a name: each is its own box.
  expect(nodes.find((n) => n.id === "timer:markOverdue")?.lines).toEqual([
    "at dueOn, 7 days after",
    "for status = sent",
  ]);
  expect(edges).toContainEqual({
    id: "runs:markOverdue",
    source: "timer:markOverdue",
    target: "action:markOverdue",
    label: "runs",
  });
  // The mail goes when markSent ran, to the address on the invoice's client.
  expect(nodes.find((n) => n.id === "outgoing:invoiceSent")?.lines).toEqual([
    "mail to client.email",
  ]);
  expect(edges).toContainEqual(
    expect.objectContaining({
      source: "action:markSent",
      target: "outgoing:invoiceSent",
      label: "ran",
    }),
  );
  // Only the kinds of record that have behaviour.
  expect(nodes.filter((n) => n.kind === "model").map((n) => n.title)).toEqual(["Invoice"]);
});

test("a custom action is a box of its own, its code not read; Mermaid draws it as a subroutine", () => {
  const custom = validateSpec({
    path: "smithable.yml",
    text: "smithable: 0.1\napp: { name: Desk }\nmodels:\n  Customer:\n    fields:\n      name: string!\nactions:\n  mergeCustomers:\n    custom: true\n    input:\n      keep: Customer!\n",
  }).ir as SpecIR;
  const map = behaviourOf(custom);
  expect(map.nodes).toEqual([
    {
      id: "action:mergeCustomers",
      kind: "custom",
      title: "mergeCustomers",
      lines: ["custom code"],
    },
  ]);
  expect(behaviourMermaid(map)).toContain(
    'b_action_mergeCustomers[["mergeCustomers<br/>custom code"]]',
  );
});

test("the layout gives each box a place of its own", async () => {
  const { laidOut } = await import("./map-layout");
  const at = laidOut(
    ["a", "b", "c"],
    [
      { source: "a", target: "b" },
      { source: "a", target: "c" },
    ],
    { width: 100, height: 40 },
  );
  expect(new Set(Object.values(at).map((p) => `${p.x},${p.y}`)).size).toBe(3);
});

test("a custom action's contract draws what it reads, writes and may send; its picture adds its input", () => {
  const spec = validateSpec({
    path: "smithable.yml",
    text: `smithable: 0.1
app: { name: Books }
models:
  Invoice:
    fields:
      number: string!
      status: draft | sent | paid
  Payment:
    fields:
      amount: money!
      invoice: Invoice
  Client:
    fields:
      name: string!
actions:
  reconcilePayments:
    custom: true
    input: { statement: file!, note: string }
    output: { matched: int! }
    intent: Match a bank statement's lines to open invoices.
    touches: { reads: [Invoice, Payment, Client], writes: [Payment, Invoice.status] }
    triggers: [paymentBooked, paymentLogged]
outgoing:
  paymentBooked:
    when: reconcilePayments
    to: mail
    recipient: admin
  paymentLogged:
    when: Payment created
    to: mail
    recipient: owner
`,
  });
  const ir = spec.ir as SpecIR;
  expect(spec.diagnostics.filter((d) => d.severity === "error")).toEqual([]);
  const { nodes, edges } = behaviourOf(ir);
  expect(nodes.find((n) => n.id === "action:reconcilePayments")?.lines).toEqual([
    "custom code",
    "Match a bank statement's lines to open invoices.",
    "gives matched",
  ]);
  const of = (id: string) => edges.filter((e) => e.source === id || e.target === id);
  expect(of("action:reconcilePayments").map((e) => [e.source, e.target, e.label])).toEqual(
    expect.arrayContaining([
      ["action:reconcilePayments", "model:Payment", "writes"],
      ["action:reconcilePayments", "model:Invoice", "writes status"],
      // Read and not written: an arrow in; one written is read too, one arrow.
      ["model:Client", "action:reconcilePayments", "reads"],
      // Its own entry follows it already; one on a record it writes, it may set off.
      ["action:reconcilePayments", "outgoing:paymentBooked", "returned"],
      ["action:reconcilePayments", "outgoing:paymentLogged", "may send"],
    ]),
  );
  expect(edges.filter((e) => e.label === "reads").map((e) => e.source)).toEqual(["model:Client"]);
  const picture = pictureOf(ir, "reconcilePayments");
  expect(picture.nodes[0]).toEqual({
    id: "input:reconcilePayments",
    kind: "input",
    title: "Input",
    lines: ["statement", "note (optional)"],
  });
  expect(picture.nodes.map((n) => n.id).sort()).toEqual(
    [
      "action:reconcilePayments",
      "input:reconcilePayments",
      "model:Client",
      "model:Invoice",
      "model:Payment",
      "outgoing:paymentBooked",
      "outgoing:paymentLogged",
    ].sort(),
  );
  expect(pictureOf(ir, "nothing")).toEqual({ nodes: [], edges: [] });
});
