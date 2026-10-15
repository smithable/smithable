import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, test } from "vitest";
import { complete } from "./completion.js";

const dir = mkdtempSync(join(tmpdir(), "smithable-complete-"));
writeFileSync(
  join(dir, "smithable.yml"),
  `smithable: 0.1
app: { name: Shop }
models:
  Customer:
    fields: { name: string!, email: email }
  Order:
    fields: { number: string!, customer: Customer! }
pages:
  customers: { crud: Customer }
`,
);
writeFileSync(
  join(dir, "smithable.auth.yml"),
  "smithableAuth: 0.1\nsignIn: none\nroles:\n  admin: { description: Admin. }\n",
);

test("an operation's arguments complete with the names in the project's spec", () => {
  expect(complete(["op", "addField"], "", dir)).toEqual(["Customer", "Order"]);
  expect(complete(["op", "removeField", "Customer"], "e", dir)).toEqual(["email"]);
  // A new field is a new name: nothing to complete.
  expect(complete(["op", "addField", "Customer"], "e", dir)).toEqual([]);
  expect(complete(["op", "renameField", "Order"], "", dir)).toEqual(["number", "customer"]);
  expect(complete(["op", "setSearch"], "", dir)).toEqual(["customers"]);
  expect(complete(["op", "grant"], "", dir)).toEqual(["admin", "member"]);
  expect(complete(["op", "grant", "member", "write"], "", dir)).toEqual(["Customer", "Order"]);
  expect(complete(["op", "grant", "member", "pages"], "", dir)).toEqual(["customers"]);
  expect(complete(["op", "addField", "Customer", "phone"], "", dir)).toEqual([]);
});

test("concepts complete for inspect and code, and hooks is a code target", () => {
  expect(complete(["code"], "h", dir)).toEqual(["hooks"]);
  expect(complete(["inspect"], "field:Order.", dir)).toEqual([
    "field:Order.number",
    "field:Order.customer",
  ]);
  expect(complete(["customize"], "", dir)).toEqual(["page:customers"]);
});

test("outside a project, only what needs no spec completes", () => {
  expect(complete(["op", "addField"], "", mkdtempSync(join(tmpdir(), "empty-")))).toEqual([]);
  expect(complete(["new", "--starter"], "", dir)).toEqual([
    "crm",
    "booking",
    "invoicing",
    "marketplace",
    "records",
    "status",
    "api",
    "support",
    "kiosk",
  ]);
});
