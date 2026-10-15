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
const noSignIn = validateAuth({
  path: "smithable.auth.yml",
  text: "smithableAuth: 0.1\nsignIn: none\npublic: { pages: [orders], read: [Order], create: [Order] }\n",
}).auth as AuthIR;
const ir = validateSpec({ path: "smithable.yml", text: spec }).ir as SpecIR;
const files = generateApp(ir, {
  smithableVersion: "0.0.0",
  auth: noSignIn,
  content: emptyContent(),
});
const file = (path: string) => files.find((f) => f.path === path)?.content ?? "";

test("a sequence is the next after the highest, set in the create's transaction and never in a form", () => {
  const data = file("src/generated/order.server.ts");
  expect(data).toContain(
    "number: (tx.select({ n: max(schema.orders.number) }).from(schema.orders).get()?.n ?? 0) + 1",
  );
  expect(data).toMatch(/import \{[^}]*\bmax\b[^}]*\} from "drizzle-orm"/);
  expect(file("src/generated/order.schema.ts")).toContain("number: true");
});
