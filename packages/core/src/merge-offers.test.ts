import { expect, test } from "vitest";
import { assistantOffer } from "./assistant.js";
import { type AuthIR, apiOffers, validateAuth } from "./auth.js";
import { mergeAsked, type SpecIR, type StandardActionIR } from "./ir.js";
import { movesFor } from "./moves.js";
import { validateSpec } from "./spec.js";

// A merge and a split through the API, Ask and the sample users (docs/design/intents.md §3, §4).
const spec = `smithable: 0.1
app: { name: Northwind }
models:
  Customer:
    fields:
      name: string!
      email: email unique
      segment: smb | enterprise
      revenue: money
      code: { type: int!, sequence: true }
      size: { type: int, formula: "COUNT(orders)" }
      manager: User
      parent: Customer
      orders: "Order[]"
    ownedBy: manager
  Order:
    fields: { customer: Customer!, note: text, lines: "Line[]" }
  Line:
    fields: { order: Order!, item: string!, amount: money! }
actions:
  mergeCustomers:
    merge: Customer
    keep: newest
    fields: { name: keep, revenue: add }
  splitOrder:
    split: Order
    move: lines
pages:
  customers: { crud: Customer }
  orders: { crud: Order }
`;
const ir = validateSpec({ path: "smithable.yml", text: spec }).ir as SpecIR;
const auth = (() => {
  const read = validateAuth(
    {
      path: "smithable.auth.yml",
      text: `smithableAuth: 0.1
signIn: { providers: [email] }
defaultAccess: private
roles:
  admin: all
  sales: { pages: all, read: all, create: all, write: [Order], actions: [splitOrder] }
api: { models: all, actions: all, assistants: true }
`,
    },
    ir,
  );
  if (!read.auth) throw new Error(read.diagnostics.map((d) => d.message).join("\n"));
  return read.auth as AuthIR;
})();
const merge = ir.actions.find((a) => a.name === "mergeCustomers") as StandardActionIR;
const customer = ir.models.find((m) => m.name === "Customer") as SpecIR["models"][number];

test("a merge asks for the stored fields with no rule: not the computed, the sequence, the owner, a self-reference or the lists", () => {
  expect(mergeAsked(merge, customer)).toEqual(["email", "segment"]);
});

test("the API offers a merge and a split with their model", () => {
  expect(apiOffers(auth, ir).actions).toEqual(["mergeCustomers", "splitOrder"]);
});

test("Ask's run tool takes the other record and the choices for a merge, the ids to move for a split", () => {
  const offer = assistantOffer(ir, auth, { role: "admin" });
  const run = offer.tools.find((t) => t.name === "run");
  const properties = run?.inputSchema.properties as Record<string, unknown>;
  expect(Object.keys(properties)).toEqual(["action", "id", "other", "choices", "move", "input"]);
  expect(run?.description).toContain(
    "mergeCustomers (`id` must be the newest) merge two records: `id` stays",
  );
  expect((properties.choices as { additionalProperties: unknown }).additionalProperties).toEqual({
    enum: ["keep", "other"],
  });
  expect(run?.description).toContain("splitOrder split a record: `move` holds the ids");
  expect(offer.summary).toContain(
    "Actions: mergeCustomers (Customer: two into one), splitOrder (Order: one into two, moving lines).",
  );
  expect(offer.kinds.find((k) => k.model === "Customer")?.description).toContain(
    "- mergeCustomers: Merge customers. Two records become one: everything that points to the other moves to the one that stays, and the other goes to the trash. Asked when the two differ: email, segment.",
  );
  // Sales is granted the split alone: no merge; it may add orders, so it splits.
  const sales = assistantOffer(ir, auth, { role: "sales" });
  expect(sales.actions).toEqual(["splitOrder"]);
  const salesRun = sales.tools.find((t) => t.name === "run");
  expect(Object.keys(salesRun?.inputSchema.properties as object)).toEqual([
    "action",
    "id",
    "move",
    "input",
  ]);
});

test("the sample users merge and split where they are granted it", () => {
  const admin = movesFor(ir, auth, { role: "admin" });
  expect(admin.filter((m) => m.kind === "merge" || m.kind === "split")).toEqual([
    {
      id: "merge:mergeCustomers",
      kind: "merge",
      action: "mergeCustomers",
      model: "Customer",
      choices: ["email", "segment"],
    },
    { id: "split:splitOrder", kind: "split", action: "splitOrder", model: "Order", list: "lines" },
  ]);
  expect(movesFor(ir, auth, { role: "sales" }).map((m) => m.id)).not.toContain(
    "merge:mergeCustomers",
  );
  expect(movesFor(ir, auth, { role: "sales" }).map((m) => m.id)).toContain("split:splitOrder");
});
