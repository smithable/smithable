// Deleting a record that others point to (docs/design/delete-together.md): the generated data
// modules count what points to it, refuse with the facts, trash the group together with one
// mark, restore and remove it together, and the trash view shows the group.
import {
  type AuthIR,
  emptyContent,
  type SpecIR,
  validateAuth,
  validateSpec,
} from "@smithable/core";
import { expect, test } from "vitest";
import { generateApp } from "./generate.js";

const spec = (shipment: string) => `smithable: 0.1
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
    trash: true
    fields:
      order: Order!
      quantity: int!
  Shipment:
    ${shipment}
    fields:
      line: OrderLine!
      carrier: string
  Note:
    fields:
      text: text!
      customer: Customer
pages:
  customers: { crud: Customer }
  orders: { crud: Order }
  team: { users: manage }
`;
const generate = (shipment: string) => {
  const ir = validateSpec({ path: "smithable.yml", text: spec(shipment) }).ir as SpecIR;
  const auth = validateAuth(
    {
      path: "smithable.auth.yml",
      text: "smithableAuth: 0.1\nsignIn: { providers: [google] }\ndefaultAccess: shared\napi: { models: all }\n",
    },
    ir,
  ).auth as AuthIR;
  const files = generateApp(ir, { smithableVersion: "0.0.0", auth, content: emptyContent() });
  return (path: string) => files.find((f) => f.path === path)?.content ?? "";
};

test("a root counts what points to it, directly and one join deep, and names the deeper", () => {
  const customer = generate("trash: true")("src/generated/customer.server.ts");
  expect(customer).toContain("function usedBy(tx: Tx, id: number, title: string)");
  expect(customer).toContain(
    '{ model: "Order", label: orderUi.label, plural: orderUi.pluralLabel, from: "Customer", depth: 1, count: tx.select({ n: count() }).from(schema.orders).where(and(eq(schema.orders.customerId, id), isNull(schema.orders.deletedAt))).get()?.n ?? 0 }',
  );
  expect(customer).toContain(
    "depth: 2, count: tx.select({ n: count() }).from(schema.orderLines).innerJoin(schema.orders, eq(schema.orderLines.orderId, schema.orders.id)).where(and(eq(schema.orders.customerId, id), isNull(schema.orders.deletedAt), isNull(schema.orderLines.deletedAt))).get()?.n ?? 0 }",
  );
  expect(customer).toContain('from: "OrderLine", depth: 3, count: null }');
  expect(customer).toContain(
    '{ model: "Note", label: noteUi.label, plural: noteUi.pluralLabel, count: tx.select({ n: count() }).from(schema.notes).where(and(eq(schema.notes.customerId, id))).get()?.n ?? 0 }',
  );
  expect(customer).toContain(
    'return { id, title, model: "Customer", label: customerUi.label, with: with_, loose, together: true, missing: [] };',
  );
});

test("the group goes to the trash together, with one mark, and comes back and goes for good together", () => {
  const file = generate("trash: true");
  const customer = file("src/generated/customer.server.ts");
  expect(customer).toContain("async remove(viewer: Viewer | null, id: number, together = false)");
  expect(customer).toContain(
    "if (used && !together) throw new Conflict(`in-use:${JSON.stringify(used)}`);",
  );
  // Level by level: the orders that point to the customer, then the lines of those orders.
  expect(customer).toContain("const tag = `Customer:${id}`;");
  expect(customer).toContain(
    "orderData.trashWith(tx, viewer, eq(schema.orders.customerId, id), tag, when);",
  );
  expect(customer).toContain(
    "orderLineData.trashWith(tx, viewer, inArray(schema.orderLines.orderId, tx.select({ id: schema.orders.id }).from(schema.orders).where(eq(schema.orders.deletedWith, tag))), tag, when);",
  );
  expect(customer).toContain(
    "shipmentData.trashWith(tx, viewer, inArray(schema.shipments.lineId, tx.select({ id: schema.orderLines.id }).from(schema.orderLines).where(eq(schema.orderLines.deletedWith, tag))), tag, when);",
  );
  // Restoring the root restores the group; removing it for good removes the group first, deepest first.
  expect(customer).toContain("orderData.restoreWith(tx, viewer, `Customer:${row.id}`);");
  expect(customer).toContain("shipmentData.restoreWith(tx, viewer, `Customer:${row.id}`);");
  const erase = customer.slice(customer.indexOf("erase(viewer: Viewer | null, ids: number[])"));
  expect(erase.indexOf("shipmentData.erase(")).toBeLessThan(erase.indexOf("orderLineData.erase("));
  expect(erase.indexOf("orderLineData.erase(")).toBeLessThan(erase.indexOf("orderData.erase("));
  expect(erase).toContain(
    "orderData.erase(viewer, db.select({ id: schema.orders.id }).from(schema.orders).where(and(isNotNull(schema.orders.deletedAt), inArray(schema.orders.customerId, ids))).all().map((r) => r.id));",
  );
  expect(erase).toContain(
    "inArray(schema.orderLines.orderId, db.select({ id: schema.orders.id }).from(schema.orders).where(inArray(schema.orders.customerId, ids)))",
  );
  // The trash view: how many went with a root; a member names its root and is not restored alone.
  expect(customer).toContain("withCount: withCount.get(`Customer:${row.id}`) ?? 0");
  const order = file("src/generated/order.server.ts");
  expect(order).toContain("function rootInTrash(tag: string): string | undefined");
  expect(order).toContain('case "Customer": {');
  expect(order).toContain("if (root) throw new Conflict(`restore-root-first:${root}`);");
  expect(order).toContain(
    "trashWith(tx: Tx, viewer: Viewer | null, fits: SQL, tag: string, when: Date): void",
  );
  expect(order).toContain('throw new Conflict("no-right:Order")');
  expect(order).toContain(
    "deletedWith: tag }).where(and(fits, isNull(schema.orders.deletedAt))).run();",
  );
  expect(order).toContain("restoreWith(tx: Tx, viewer: Viewer | null, tag: string): void");
  expect(order).toContain("withTitle: (row.deletedWith && withTitle.get(row.deletedWith)) ?? null");
  // The column, and the daily emptying in the order the models point to each other.
  const schema = file("src/db/schema.ts");
  expect(schema).toContain("deletedWith: text(),");
  expect(schema).toContain('index("customers_deleted_with").on(t.deletedWith)');
  expect(file("src/generated/trash.server.ts")).toContain(
    '[["Shipment", shipmentData], ["OrderLine", orderLineData], ["Order", orderData], ["Customer", customerData]] as const',
  );
  expect(customer).toContain('import "./trash.server";');
  expect(customer).not.toContain("setInterval(purge");
  // The pages pass `together`; the API takes it as a query parameter and the tool as an argument.
  expect(file("src/generated/customer.ts")).toContain(
    ".validator(z.object({ id: z.number().int(), together: z.boolean().optional() }))",
  );
  expect(file("src/routes/customers/$id.tsx")).toContain(
    "await deleteCustomer({ data: { id: row.id, together } });",
  );
  expect(file("src/routes/customers/index.tsx")).toContain(
    "onDelete={(together) => deleteCustomers({ data: { ids: chosen.map((row) => row.id), together } })}",
  );
  expect(file("src/routes/api/v1/customers/$id.ts")).toContain(
    'await customerData.remove(viewer, row.id, new URL(request.url).searchParams.get("together") === "true");',
  );
  const openapi = file("src/generated/api.server.ts");
  expect(openapi).toContain('"name": "together",');
  expect(openapi).toContain(
    "With together=true they are moved to the trash with it, and restored with it.",
  );
});

test("a member without a trash keeps the delete refused, with the facts and the models to turn it on for", () => {
  const file = generate("description: Sent by a carrier.");
  const customer = file("src/generated/customer.server.ts");
  expect(customer).toContain(
    'return { id, title, model: "Customer", label: customerUi.label, with: with_, loose, together: false, missing: [shipmentUi.label] };',
  );
  expect(customer).toContain("if (used) throw new Conflict(`in-use:${JSON.stringify(used)}`);");
  expect(customer).not.toContain("trashWith(");
  expect(customer).not.toContain("restoreWith(");
  // Removing trashed customers for good still takes the trashed orders and lines that point to them.
  expect(customer).toContain("orderLineData.erase(viewer,");
  // Without a trash of its own, the root is the missing one.
  const line = file("src/generated/order-line.server.ts");
  expect(line).toContain("together: false, missing: [shipmentUi.label]");
  expect(line).toContain("async remove(viewer: Viewer | null, id: number, _together = false)");
  expect(file("src/generated/shipment.server.ts")).toContain("_together = false");
});

test("a model nothing points to has no facts, and the server function still takes together", () => {
  const file = generate("trash: true");
  const note = file("src/generated/note.server.ts");
  expect(note).not.toContain("usedBy");
  expect(note).toContain("async remove(viewer: Viewer | null, id: number, _together = false)");
});
