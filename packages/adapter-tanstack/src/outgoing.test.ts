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
    fields?: string[],
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
  // With fields, only a change of one of them; a date by its instant; with a condition too.
  const t = new Date("2026-11-01T10:00:00Z");
  const moved = { startsAt: new Date("2026-11-01T11:00:00Z"), title: "Yoga" };
  expect(
    counts("changed", "changed", undefined, moved, { startsAt: t, title: "Yoga" }, ["startsAt"]),
  ).toBe(true);
  expect(
    counts(
      "changed",
      "changed",
      undefined,
      { startsAt: new Date(t), title: "Pilates" },
      { startsAt: t, title: "Yoga" },
      ["startsAt"],
    ),
  ).toBe(false);
  expect(
    counts(
      "changed",
      "changed",
      undefined,
      { startsAt: t, title: "Pilates" },
      { startsAt: t, title: "Yoga" },
      ["startsAt", "title"],
    ),
  ).toBe(true);
  expect(
    counts("changed", "changed", shipped, { status: "shipped", n: 2 }, { status: "placed", n: 2 }, [
      "n",
    ]),
  ).toBe(false);
  expect(
    counts("changed", "changed", shipped, { status: "shipped", n: 2 }, { status: "placed", n: 1 }, [
      "n",
    ]),
  ).toBe(true);
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
      orders: Order[]
  Order:
    fields:
      customer: Customer!
      status: placed | shipped
      note: text
      receipt: file
    trash: true
  Session:
    fields:
      title: string!
      startsAt: datetime!
      bookings: Booking[]
  Booking:
    fields:
      session: Session!
      contact: email
outgoing:
  sessionMoved:
    when: Session changed
    fields: [startsAt]
    to: mail
    recipient: bookings.owner
  sessionNamed:
    when: Session changed
    fields: [title]
    to: mail
    recipient: bookings.contact
  customerMoved:
    when: Customer changed
    to: mail
    recipient: orders.owner

  orderShipped:
    when: Order changed
    where: { status: shipped }
    to: mail
    recipient: customer.email
  orderPlaced:
    when: Order created
    to: mail
    recipient: owner
  orderMoved:
    when: Order changed
    fields: [customer, note]
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
  // A list's records, each told: the bookings' owners as people, the contacts as addresses; the
  // orders of a customer without the trashed ones; only a change of the fields named counts.
  expect(module).toContain('fields: ["startsAt"],');
  // A reference is watched by its column.
  expect(module).toContain('fields: ["customerId","note"],');
  expect(module).toContain(
    "((ids) => (ids.length ? people(tx, inArray(schema.user.id, ids)) : []))(tx.select({ v: schema.bookings.ownerId }).from(schema.bookings).where(eq(schema.bookings.sessionId, r.id as number)).all().map((x) => x.v).filter((v) => v != null).map(String))",
  );
  expect(module).toContain(
    "tx.select({ v: schema.bookings.contact }).from(schema.bookings).where(eq(schema.bookings.sessionId, r.id as number)).all().map((x) => ({ email: x.v as string | null }))",
  );
  expect(module).toContain(
    "and(eq(schema.orders.customerId, r.id as number), isNull(schema.orders.deletedAt))",
  );
  expect(module).toContain("counts(entry.when, what, entry.fits, record, before, entry.fields)");
  expect(module).toMatch(/import \{ and, eq, inArray, isNull(, type SQL)? \} from "drizzle-orm";/);
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
  expect(files.some((f) => f.path === "src/generated/booking.server.ts")).toBe(true);
  expect(file("src/generated/booking.server.ts")).not.toContain("outgoing");
  expect(file("src/db/schema.ts")).toContain(
    'export const outgoingMail = sqliteTable(\n  "outgoing_mail"',
  );
  expect(files.some((f) => f.path === "src/kit/outgoing.server.ts")).toBe(true);
});

test("an app whose only mail goes to a list's addresses still imports what the query needs", () => {
  const only = validateSpec({
    path: "smithable.yml",
    text: `smithable: 0.1
app: { name: Studio }
models:
  Session:
    fields:
      title: string!
      bookings: Booking[]
  Booking:
    fields:
      session: Session!
      contact: email
outgoing:
  named:
    when: Session changed
    to: mail
    recipient: bookings.contact
pages:
  sessions: { crud: Session }
`,
  }).ir as SpecIR;
  const files = generateApp(only, { smithableVersion: "0.0.0", auth, content: emptyContent() });
  const module = files.find((f) => f.path === "src/generated/outgoing.server.ts")?.content ?? "";
  expect(module).toContain('import { eq } from "drizzle-orm";');
  expect(module).toContain("where(eq(schema.bookings.sessionId, r.id as number))");
  // A mail on any change of a session: saving any changed field asks first (A 134).
  expect(files.find((f) => f.path === "src/routes/sessions/$id.tsx")?.content).toContain(
    'tells={[{"fields":[],"list":"bookings","label":"Bookings"}]}',
  );
});

test("a customer in the trash is neither mailed nor named, and its orders show a dash", () => {
  const customer = ir.models.find((m) => m.name === "Customer");
  const order = ir.models.find((m) => m.name === "Order");
  const trashed = {
    ...ir,
    models: ir.models.map((m) =>
      m === customer
        ? { ...m, trash: true }
        : m === order
          ? {
              ...m,
              fields: m.fields.map((f) => (f.name === "customer" ? { ...f, required: false } : f)),
            }
          : m,
    ),
  } as SpecIR;
  const files = generateApp(trashed, { smithableVersion: "0.0.0", auth, content: emptyContent() });
  const file = (p: string) => files.find((f) => f.path === p)?.content ?? "";
  const module = file("src/generated/outgoing.server.ts");
  expect(module).toContain(
    "one(tx, schema.customers, schema.customers.id, schema.customers.email, r.customerId, schema.customers.deletedAt)",
  );
  expect(module).toContain("trashed ? and(eq(id, value), isNull(trashed)) : eq(id, value)");
  const data = file("src/generated/order.server.ts");
  expect(data).toContain("customer: { columns: { id: true, name: true, deletedAt: true } }");
  expect(file("src/generated/order.ts")).toContain(
    "(row) => (row.customer && !row.customer.deletedAt ? row.customer.name : null)",
  );
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
    // IPv4 carried in IPv6, as URL and dns.lookup write it (C, #404): loopback, the metadata
    // service, a home network; and NAT64, the old form, more reserved ranges.
    "::ffff:7f00:1",
    "::ffff:a9fe:a9fe",
    "::ffff:c0a8:101",
    "64:ff9b::7f00:1",
    "::7f00:1",
    "198.18.0.1",
    "203.0.113.5",
    "2001:db8::1",
    // The same written out longer, which a pattern on the short form missed.
    "0:0:0:0:0:ffff:7f00:1",
    "0000:0000:0000:0000:0000:ffff:127.0.0.1",
    "0:0:0:0:0:0:0:1",
    "FE80:0:0:0:0:0:0:1",
    // With a zone, through 6to4 or Teredo, or not an address at all.
    "fe80::1%eth0",
    "2002:7f00:1::1",
    "2001:0:4136:e378::1",
    "1::2::3",
    // Nine groups, the local NAT64 prefix, and the translated form.
    "1:2:3:4:5:6:7:8::9",
    "64:ff9b:1::7f00:1",
    "::ffff:0:127.0.0.1",
    "not an address",
  ])
    expect(privateAddress(ip), ip).toBe(true);
  for (const ip of [
    "93.184.216.34",
    "172.32.0.1",
    "2606:4700::1111",
    "8.8.8.8",
    "::ffff:5db8:d822",
  ])
    expect(privateAddress(ip), ip).toBe(false);
});

test("a custom action's entries are told once it returns: its input and output, no record", () => {
  const custom = validateSpec({
    path: "smithable.yml",
    text: `smithable: 0.1
app: { name: Shop }
models:
  Customer:
    fields: { name: string! }
actions:
  importCustomers:
    custom: true
    input: { file: string! }
    output: { added: int }
outgoing:
  imported: { when: importCustomers, to: crmFeed }
  importMailed: { when: importCustomers, to: mail, recipient: admin }
pages:
  customers: { crud: Customer }
`,
  }).ir as SpecIR;
  const files = generateApp(custom, {
    smithableVersion: "0.0.0",
    auth: validateAuth(
      {
        path: "smithable.auth.yml",
        text: "smithableAuth: 0.1\nsignIn: { providers: [email] }\ndefaultAccess: shared\n",
      },
      custom,
    ).auth as AuthIR,
    content: emptyContent(),
  });
  const module = files.find((f) => f.path === "src/generated/outgoing.server.ts")?.content ?? "";
  expect(module).toContain('export const TARGETS = ["crmFeed"] as const;');
  expect(module).toContain("export function outgoingAfter(");
  expect(module).toContain(
    "body: JSON.stringify({ event: entry.name, action, at: new Date().toISOString(), input, output: output ?? null }),",
  );
  expect(module).toContain(
    'fields: (input, output) => [["File", shownValue(input?.file)], ["Added", shownValue(output?.added)]],',
  );
  const action =
    files.find((f) => f.path === "src/generated/actions/import-customers.ts")?.content ?? "";
  expect(action).toContain(
    'db.transaction((tx) => outgoingAfter(tx, viewer, "importCustomers", data, output));',
  );
  // The kit's tell for src/custom code comes with the outbox, and the outbox's record is optional.
  expect(files.some((f) => f.path === "src/kit/tell.server.ts")).toBe(true);
  const schema = files.find((f) => f.path === "src/db/schema.ts")?.content ?? "";
  expect(schema).not.toContain("recordId: integer().notNull()");
});
