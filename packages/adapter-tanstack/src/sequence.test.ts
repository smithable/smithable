import {
  type AuthIR,
  emptyContent,
  type SpecIR,
  validateAuth,
  validateSpec,
} from "@smithable/core";
import { expect, test } from "vitest";
import { generateApp } from "./generate.js";

const spec = `smithable: 0.1
app: { name: Kiosk }
models:
  Order:
    fields:
      number: { type: int!, sequence: true }
      name: string!
pages:
  orders: { crud: Order }
`;
const authOf = (text: string) => validateAuth({ path: "smithable.auth.yml", text }).auth as AuthIR;
const noSignIn = authOf(
  "smithableAuth: 0.1\nsignIn: none\npublic: { pages: [orders], read: [Order], create: [Order] }\n",
);
const privateApp = authOf(
  "smithableAuth: 0.1\nsignIn: { providers: [google] }\ndefaultAccess: private\n",
);
const ir = validateSpec({ path: "smithable.yml", text: spec }).ir as SpecIR;
const generated = (auth: AuthIR) => {
  const files = generateApp(ir, { smithableVersion: "0.0.0", auth, content: emptyContent() });
  return (path: string) => files.find((f) => f.path === path)?.content ?? "";
};

test("a sequence is taken from the field's counter in the create's transaction, ahead of the highest, and never from a form", () => {
  const file = generated(noSignIn);
  const data = file("src/generated/order.server.ts");
  expect(data).toContain(
    'number: nextInSequence(tx, "Order.number", tx.select({ n: max(schema.orders.number) }).from(schema.orders).get()?.n ?? 0)',
  );
  expect(data).toContain('import { nextInSequence } from "#/kit/sequence.server";');
  expect(data).toMatch(/import \{[^}]*\bmax\b[^}]*\} from "drizzle-orm"/);
  expect(file("src/generated/order.schema.ts")).toContain("number: true");
  // The counters' table, and the kit's helper that advances them.
  expect(file("src/db/schema.ts")).toContain('export const sequences = sqliteTable("sequences"');
  expect(file("src/kit/sequence.server.ts")).toContain("onConflictDoUpdate");
  // The number is unique.
  expect(file("src/db/schema.ts")).toMatch(/number: integer\(\)\.notNull\(\)\.unique\(\)/);
});

test("where unique fields are per owner, so is the sequence: one counter per owner", () => {
  const file = generated(privateApp);
  const data = file("src/generated/order.server.ts");
  expect(data).toContain(
    "number: nextInSequence(tx, `Order.number:${personOf(viewer)}`, tx.select({ n: max(schema.orders.number) }).from(schema.orders).where(eq(schema.orders.ownerId, personOf(viewer))).get()?.n ?? 0)",
  );
  expect(file("src/db/schema.ts")).toContain("unique().on(t.ownerId, t.number)");
});

test("an app without a sequence has neither the table nor the helper", () => {
  const plain = validateSpec({
    path: "smithable.yml",
    text: "smithable: 0.1\napp: { name: Plain }\nmodels:\n  Note:\n    fields:\n      title: string!\npages:\n  notes: { crud: Note }\n",
  }).ir as SpecIR;
  const files = generateApp(plain, {
    smithableVersion: "0.0.0",
    auth: authOf("smithableAuth: 0.1\nsignIn: { providers: [google] }\ndefaultAccess: shared\n"),
    content: emptyContent(),
  });
  expect(files.find((f) => f.path === "src/db/schema.ts")?.content).not.toContain("sequences");
  expect(files.some((f) => f.path === "src/kit/sequence.server.ts")).toBe(false);
});

test("a copy, and a record an action adds, take their own numbers from the counter", () => {
  const withActions = validateSpec({
    path: "smithable.yml",
    text: `smithable: 0.1
app: { name: Kiosk }
models:
  Order:
    fields:
      number: { type: int!, sequence: true }
      name: string!
      status: open | done
      receipts: Receipt[]
  Receipt:
    fields:
      number: { type: int!, sequence: true }
      order: Order!
actions:
  duplicate: { on: Order, copy: { status: open } }
  close: { on: Order, set: { status: done }, add: { Receipt: {} } }
pages:
  orders: { crud: Order, actions: [duplicate, close] }
`,
  }).ir as SpecIR;
  const files = generateApp(withActions, {
    smithableVersion: "0.0.0",
    auth: authOf("smithableAuth: 0.1\nsignIn: { providers: [google] }\ndefaultAccess: shared\n"),
    content: emptyContent(),
  });
  const file = (path: string) => files.find((f) => f.path === path)?.content ?? "";
  const copy = file("src/generated/actions/duplicate.server.ts");
  expect(copy).toContain(
    'ownerId: personOf(viewer) }), number: nextInSequence(tx, "Order.number", tx.select({ n: max(schema.orders.number) }).from(schema.orders).get()?.n ?? 0) })',
  );
  expect(copy).toContain('import { max } from "drizzle-orm";');
  expect(copy).toContain('import { nextInSequence } from "#/kit/sequence.server";');
  expect(copy).not.toContain("number: row.number");
  const close = file("src/generated/actions/close.server.ts");
  expect(close).toContain(
    'ownerId: personOf(viewer) }), number: nextInSequence(tx, "Receipt.number", tx.select({ n: max(schema.receipts.number) }).from(schema.receipts).get()?.n ?? 0) })',
  );
  expect(close).toContain('import { eq, max } from "drizzle-orm";');
});
