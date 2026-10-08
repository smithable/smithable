import { expect, test } from "vitest";
import type { SpecIR } from "./ir.js";
import { validateSpec } from "./spec.js";
import { looseReferrers, trashGroup } from "./trash-group.js";

const spec = `smithable: 0.1
app: { name: Shop }
models:
  Customer:
    trash: true
    fields:
      name: string!
      orders: Order[]
  Order:
    trash: true
    fields:
      number: string!
      customer: Customer!
      lines: OrderLine[]
  OrderLine:
    fields:
      order: Order!
      product: Product!
      quantity: int!
  Product:
    fields:
      name: string!
  Shipment:
    fields:
      line: OrderLine!
      carrier: string
  Note:
    fields:
      text: text!
      customer: Customer
      order: Order
pages:
  customers: { crud: Customer }
`;
const ir = validateSpec({ path: "smithable.yml", text: spec }).ir as SpecIR;

test("the group of a root: its required referrers, theirs, and so on, by depth", () => {
  expect(trashGroup(ir, "Customer")).toEqual([
    { model: "Order", via: "customer", from: "Customer", depth: 1 },
    { model: "OrderLine", via: "order", from: "Order", depth: 2 },
    { model: "Shipment", via: "line", from: "OrderLine", depth: 3 },
  ]);
  expect(trashGroup(ir, "Product")).toEqual([
    { model: "OrderLine", via: "product", from: "Product", depth: 1 },
    { model: "Shipment", via: "line", from: "OrderLine", depth: 2 },
  ]);
  expect(trashGroup(ir, "Shipment")).toEqual([]);
  expect(trashGroup(ir, "Note")).toEqual([]);
});

test("optional references are loose: they stay, and show no record", () => {
  expect(looseReferrers(ir, "Customer")).toEqual([{ model: "Note", via: "customer" }]);
  expect(looseReferrers(ir, "Order")).toEqual([{ model: "Note", via: "order" }]);
  expect(looseReferrers(ir, "Product")).toEqual([]);
});

test("a cycle of required references, and two references to the same model, end", () => {
  const cyclic = validateSpec({
    path: "smithable.yml",
    text: `smithable: 0.1
app: { name: Cycle }
models:
  Account:
    fields:
      name: string!
      parent: Account!
  Transfer:
    fields:
      from: Account!
      to: Account!
      amount: money!
  Receipt:
    fields:
      transfer: Transfer!
pages:
  accounts: { crud: Account }
`,
  }).ir as SpecIR;
  expect(trashGroup(cyclic, "Account")).toEqual([
    { model: "Account", via: "parent", from: "Account", depth: 1 },
    { model: "Transfer", via: "from", from: "Account", depth: 1 },
    { model: "Transfer", via: "to", from: "Account", depth: 1 },
    { model: "Receipt", via: "transfer", from: "Transfer", depth: 2 },
  ]);
});
