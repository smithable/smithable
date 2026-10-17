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
app: { name: Acme }
models:
  Customer:
    fields: { name: string!, email: email, orders: "Order[]" }
  Order:
    fields: { number: string!, customer: Customer!, total: money }
  Message:
    fields: { body: text! }
pages:
  customers: { crud: Customer }
  admin: { data: all }
`;
const ir = validateSpec({ path: "smithable.yml", text: spec }).ir as SpecIR;
const auth = validateAuth(
  {
    path: "smithable.auth.yml",
    text: "smithableAuth: 0.1\nsignIn: { providers: [google] }\ndefaultAccess: shared\nroles: { admin: {}, support: {} }\n",
  },
  ir,
).auth as AuthIR;
const app = generateApp(ir, { smithableVersion: "0.0.0", auth, content: emptyContent() });
const file = (path: string) => app.find((f) => f.path === path)?.content ?? "";

test("a data page has an overview and each model's list, new and record routes inside it", () => {
  const paths = app.map((f) => f.path);
  for (const models of ["customers", "orders", "messages"])
    for (const route of ["index.tsx", "new.tsx", "$id.tsx"])
      expect(paths).toContain(`src/routes/admin/${models}/${route}`);
  const overview = file("src/routes/admin/index.tsx");
  // Every model, counted through its data function (so by access), linking inside the page.
  for (const data of ["customerData", "orderData", "messageData"])
    expect(overview).toContain(`${data}.count(viewer)`);
  expect(overview).toContain('to: "/admin/orders"');
  expect(file("src/generated/pages.ts")).toMatch(/admin: \{\s*public: false,\s*roles: \["admin"\]/);
});

test("the routes inside are guarded by the data page's rule, titled by the model, and capped", () => {
  const list = file("src/routes/admin/orders/index.tsx");
  expect(list).toContain('createFileRoute("/admin/orders/")');
  expect(list).toContain('pageAccess["admin"]');
  expect(list).toContain("title={orderUi.pluralLabel}");
  // No text marker points at the data page's own title from a model's list.
  expect(list).not.toContain('page="admin"');
  expect(list).toContain("orderData.list(viewer, where, 501)");
  expect(list).toContain("The newest 500 are shown");
  expect(file("src/routes/admin/orders/$id.tsx")).toContain('pageAccess["admin"]');
  // A related record opens inside the data page, not on its crud page.
  expect(file("src/routes/admin/customers/$id.tsx")).toContain('"/admin/orders/$id"');
  expect(file("src/routes/customers/$id.tsx")).not.toContain("/admin/");
});

test("only the models a data page shows get a count and a limit on their list", () => {
  expect(file("src/generated/order.server.ts")).toContain("limit?: number");
  expect(file("src/generated/order.server.ts")).toContain("count(viewer: Viewer | null)");
  const ordinary = generateApp(
    validateSpec({ path: "s", text: spec.replace("  admin: { data: all }\n", "") }).ir as SpecIR,
    { smithableVersion: "0.0.0", auth, content: emptyContent() },
  );
  const server = ordinary.find((f) => f.path === "src/generated/order.server.ts")?.content ?? "";
  expect(server).not.toContain("limit?: number");
  expect(server).not.toContain("count(viewer");
});
