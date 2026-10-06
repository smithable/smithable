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

test("an entry to a target queues a call with the record as the API gives it", () => {
  const withTarget = {
    ...ir,
    outgoing: [
      ...ir.outgoing,
      { name: "orderFeed", when: { model: "Order", event: "created" as const }, to: "orderFeed" },
    ],
  };
  const files = generateApp(withTarget, {
    smithableVersion: "0.0.0",
    auth,
    content: emptyContent(),
  });
  const module = files.find((f) => f.path === "src/generated/outgoing.server.ts")?.content ?? "";
  expect(module).toContain('target: "orderFeed",');
  expect(module).toContain("queueCall(tx, {");
  // The record by its API names: the reference by id, no document.
  expect(module).toContain("customer: row.customerId ?? null,");
  expect(module).not.toContain("receipt: row");
  const schema = files.find((f) => f.path === "src/db/schema.ts")?.content ?? "";
  expect(schema).toContain('export const outgoingCall = sqliteTable(\n  "outgoing_call"');
});

test("a target's settings, and the addresses the guard refuses", () => {
  const { targetSettings, privateAddress } = kit as unknown as {
    targetSettings(t: string): { url: string; secret: string };
    privateAddress(ip: string): boolean;
  };
  expect(targetSettings("statusFeed")).toEqual({
    url: "OUTGOING_STATUSFEED_URL",
    secret: "OUTGOING_STATUSFEED_SECRET",
  });
  for (const ip of [
    "127.0.0.1",
    "10.1.2.3",
    "172.20.0.1",
    "192.168.1.1",
    "169.254.169.254",
    "100.64.0.1",
    "0.0.0.0",
    "::1",
    "fd00::1",
    "fe80::1",
    "::ffff:127.0.0.1",
  ])
    expect(privateAddress(ip), ip).toBe(true);
  for (const ip of ["93.184.216.34", "172.32.0.1", "2606:4700::1111", "8.8.8.8"])
    expect(privateAddress(ip), ip).toBe(false);
});
