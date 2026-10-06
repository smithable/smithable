import {
  type AuthIR,
  emptyContent,
  type SpecIR,
  validateAuth,
  validateSpec,
} from "@smithable/core";
import { expect, test } from "vitest";
import { generateApp } from "./generate.js";

// The kit's outgoing.ts, as the generated apps get it (a path the build does not follow).
const path: string = "../templates/src/kit/outgoing.ts";
const kit = (await import(path)) as {
  counts(
    when: string,
    what: string,
    fits: ((r: Record<string, unknown>) => boolean) | undefined,
    record: Record<string, unknown>,
    before?: Record<string, unknown>,
  ): boolean;
  pauseAfter(tries: number): number;
};

test("an entry counts when the record comes to fit, not on every edit of one that fits", () => {
  const { counts, pauseAfter } = kit;
  const shipped = (r: Record<string, unknown>) => r.status === "shipped";
  expect(counts("changed", "changed", shipped, { status: "shipped" }, { status: "placed" })).toBe(
    true,
  );
  expect(counts("changed", "changed", shipped, { status: "shipped" }, { status: "shipped" })).toBe(
    false,
  );
  expect(counts("changed", "changed", shipped, { status: "placed" }, { status: "shipped" })).toBe(
    false,
  );
  // An action's change is a change; a creation is not.
  expect(
    counts("changed", "markShipped", shipped, { status: "shipped" }, { status: "placed" }),
  ).toBe(true);
  expect(counts("changed", "created", undefined, {})).toBe(false);
  // Without a condition, every change counts.
  expect(counts("changed", "changed", undefined, { a: 1 }, { a: 1 })).toBe(true);
  // A creation, deletion or action counts when the record fits.
  expect(counts("created", "created", shipped, { status: "placed" })).toBe(false);
  expect(counts("deleted", "deleted", shipped, { status: "shipped" })).toBe(true);
  expect(counts("markShipped", "markShipped", undefined, {})).toBe(true);
  expect(counts("markShipped", "changed", undefined, {})).toBe(false);
  expect([1, 2, 3, 9, 20].map(pauseAfter)).toEqual([
    60_000, 120_000, 240_000, 10_800_000, 10_800_000,
  ]);
});

const ir = validateSpec({
  path: "smithable.yml",
  text: `smithable: 0.1
app: { name: Shop }
models:
  Customer:
    fields:
      name: string!
      email: email!
  Order:
    fields:
      customer: Customer!
      status: placed | shipped
      note: text
      receipt: file
outgoing:
  orderShipped:
    when: Order changed
    where: { status: shipped }
    to: mail
    recipient: customer.email
  orderPlaced:
    when: Order created
    to: mail
    recipient: owner
pages:
  orders: { crud: Order }
  customers: { crud: Customer }
`,
}).ir as SpecIR;
const auth = validateAuth(
  {
    path: "smithable.auth.yml",
    text: "smithableAuth: 0.1\nsignIn: { providers: [email] }\ndefaultAccess: shared\n",
  },
  ir,
).auth as AuthIR;

test("the generated app queues outgoing mail in the change's transaction", () => {
  const files = generateApp(ir, { smithableVersion: "0.0.0", auth, content: emptyContent() });
  const file = (p: string) => files.find((f) => f.path === p)?.content ?? "";
  const module = file("src/generated/outgoing.server.ts");
  expect(module).toContain('when: "changed",\n    fits: (r) => r.status === "shipped",');
  // The customer's address, one reference away; the owner's from the users.
  expect(module).toContain(
    "one(tx, schema.customers, schema.customers.id, schema.customers.email, r.customerId)",
  );
  expect(module).toContain("people(tx, eq(schema.user.id, String(r.ownerId)))");
  // The record as its page shows it, without the document, and a link to it.
  expect(module).toContain('["Customer", String(one(tx, schema.customers');
  expect(module).not.toContain('"Receipt"');
  expect(module).toContain("link: `/orders/${r.id}`");
  const data = file("src/generated/order.server.ts");
  expect(data).toContain('outgoing(tx, viewer, "Order", "created", made);');
  expect(data).toContain('outgoing(tx, viewer, "Order", what, after, before);');
  expect(data).toContain('outgoing(tx, viewer, "Order", "deleted", gone);');
  // A model nobody is told about has no calls.
  expect(file("src/generated/customer.server.ts")).not.toContain("outgoing");
  expect(file("src/db/schema.ts")).toContain(
    'export const outgoingMail = sqliteTable(\n  "outgoing_mail"',
  );
  expect(files.some((f) => f.path === "src/kit/outgoing.server.ts")).toBe(true);
});

test("a target other than mail is refused until the signed call is built", () => {
  const withTarget = {
    ...ir,
    outgoing: [
      { name: "feed", when: { model: "Order", event: "created" as const }, to: "statusFeed" },
    ],
  };
  expect(() =>
    generateApp(withTarget, { smithableVersion: "0.0.0", auth, content: emptyContent() }),
  ).toThrow(/cannot tell "statusFeed" yet/);
});
