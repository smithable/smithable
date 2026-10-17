import {
  type AuthIR,
  type ContentIR,
  type SpecIR,
  validateAuth,
  validateContent,
  validateSpec,
} from "@smithable/core";
import { expect, test } from "vitest";
import { generateApp } from "./generate.js";

const raw = import.meta.glob("../../../examples/crm/smithable*.yml", {
  query: "?raw",
  import: "default",
  eager: true,
}) as Record<string, string>;
const at = (file: string) => raw[`../../../examples/crm/${file}`] as string;

test("a reference named by its record's title is found only among the records the viewer may read", () => {
  const ir = validateSpec({ path: "smithable.yml", text: at("smithable.yml") }).ir as SpecIR;
  const auth = validateAuth({ path: "smithable.auth.yml", text: at("smithable.auth.yml") }, ir)
    .auth as AuthIR;
  const content = validateContent(
    { path: "smithable.content.yml", text: at("smithable.content.yml") },
    ir,
  ).content as ContentIR;
  const files = generateApp(ir, { smithableVersion: "0.0.0", auth, content });
  const order = files.find((f) => f.path === "src/generated/order.server.ts")?.content ?? "";
  // An order's customer by its name: through the customers' named(), which reads the viewer's.
  expect(order).toContain('customer: { kind: "reference", column: schema.orders.customerId }');
  expect(order).toContain(
    "customer: { find: (text: string) => customerData.named(viewer, text), titles: () => customerData.titles(viewer) }",
  );
  // A person by their name, which only a signed-in viewer is matched on (the kit's whereOf).
  const customer = files.find((f) => f.path === "src/generated/customer.server.ts")?.content ?? "";
  expect(customer).toContain(
    'accountManager: { kind: "reference", column: schema.customers.accountManagerId, title: { table: schema.user, column: schema.user.name } }',
  );
  const kit = files.find((f) => f.path === "src/kit/where.ts")?.content ?? "";
  expect(kit).toContain("if (titles.length && (!field.title || me === undefined))");
});
