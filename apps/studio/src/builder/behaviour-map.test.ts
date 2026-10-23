import { type SpecIR, validateSpec } from "@smithable/core";
import { expect, test } from "vitest";
import invoicingSpec from "../../../../examples/invoicing/smithable.yml?raw";
import { behaviourOf } from "./behaviour-map";
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
