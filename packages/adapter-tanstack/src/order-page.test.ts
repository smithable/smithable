import {
  type AuthIR,
  emptyContent,
  type SpecIR,
  validateAuth,
  validateSpec,
} from "@smithable/core";
import { expect, test } from "vitest";
import kiosk from "../../core/src/order.test.ts?raw";
import { generateApp } from "./generate.js";

const spec = /const KIOSK = `([\s\S]*?)`;/.exec(kiosk)?.[1] ?? "";
const ir = validateSpec({ path: "smithable.yml", text: spec }).ir as SpecIR;
const auth = validateAuth(
  {
    path: "smithable.auth.yml",
    text: "smithableAuth: 0.1\nsignIn: { providers: [email] }\ndefaultAccess: shared\nroles: { staff: { pages: all } }\ndefaultRole: staff\npublic: { pages: [menu], read: [Dish], create: [Order] }\n",
  },
  ir,
).auth as AuthIR;
const files = generateApp(ir, { smithableVersion: "0.0.0", auth, content: emptyContent() });
const file = (path: string) => files.find((f) => f.path === path)?.content ?? "";

test("the order page reads the menu as visitors may and sends ids and quantities, never a price", () => {
  const route = file("src/routes/index.tsx");
  expect(route).toContain("const rows = await dishData.list(viewer);");
  expect(route).toContain("const sent = orderSchema.pick(");
  expect(route).toMatch(/quantity: z\.number\(\)\.int\(\)\.min\(1\)\.max\(99\)/);
  expect(route).toContain(".min(1).max(50)");
  expect(route).toContain('throw new BadInput("closed")');
  expect(route).toContain("orderData.create(viewer, data.values as OrderValues, data.lines)");
  expect(files.some((f) => f.path === "src/kit/OrderPage.tsx")).toBe(true);
  expect(files.some((f) => f.path === "src/kit/refusal.ts")).toBe(true);
});

test("the order and its lines are one write: each chosen record read as the viewer may, its price copied", () => {
  const data = file("src/generated/order.server.ts");
  expect(data).toContain("lines?: { id: number; quantity: number }[]");
  expect(data).toContain(
    "const item = tx.select().from(schema.dishes).where(and(eq(schema.dishes.id, chosen.id), dishData.readable(viewer))).get();",
  );
  expect(data).toContain(
    "if (item.available === false) throw new Conflict(`sold-out:${item.name}`);",
  );
  expect(data).toMatch(
    /tx\.insert\(schema\.orderLines\)\.values\(\{ orderId: made\.id, dishId: item\.id, quantity: chosen\.quantity, unitPrice: item\.price/,
  );
  expect(data).toContain(
    'number: nextInSequence(tx, "Order.number", tx.select({ n: max(schema.orders.number) })',
  );
});
