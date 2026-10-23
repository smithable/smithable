import { type AuthIR, type SpecIR, validateAuth, validateSpec } from "@smithable/core";
import { expect, test } from "vitest";
import { generateApp } from "./generate.js";

// Timers (docs/design/timed-actions.md §5): the tick's module, its table, and the outgoing entry
// that listens to a timer, kept out of what writes fire.
test("a record timer, a clock timer and an outgoing entry on a timer", () => {
  const ir = validateSpec({
    path: "smithable.yml",
    text: `smithable: 0.1
app: { name: Studio }
models:
  Session:
    fields:
      startsAt: datetime
  Booking:
    ownedBy: member
    fields:
      member: User
      session: Session
      status: confirmed | cancelled
  Invoice:
    fields:
      dueOn: date
      status: sent | overdue
actions:
  markOverdue:
    on: Invoice
    when: { status: sent }
    set: { status: overdue }
  digest:
    custom: true
timers:
  remind:
    on: Booking
    at: 1 day before session.startsAt
    where: { status: confirmed }
  markOverdue:
    on: Invoice
    at: 7 days after dueOn
    run: markOverdue
  weekly:
    every: monday
    at: "08:00"
    run: digest
outgoing:
  reminder:
    when: remind
    to: mail
    recipient: owner
`,
  }).ir as SpecIR;
  const auth = validateAuth(
    {
      path: "smithable.auth.yml",
      text: "smithableAuth: 0.1\nsignIn: { providers: [email] }\ndefaultAccess: private\nroles: { admin: {} }\n",
    },
    ir,
  ).auth as AuthIR;
  const files = generateApp(ir, { smithableVersion: "0.0.0", auth });
  const file = (path: string) => files.find((f) => f.path === path)?.content ?? "";
  const timers = file("src/generated/timers.server.ts");
  // A date one reference away, with its offset, among the records that fit.
  expect(timers).toContain(
    'db.select({ id: schema.bookings.id, at: schema.sessions.startsAt }).from(schema.bookings).innerJoin(schema.sessions, eq(schema.bookings.sessionId, schema.sessions.id)).where(and(gt(schema.sessions.startsAt, new Date(Math.min(from, late) - (-86400000))), lte(schema.sessions.startsAt, new Date(now.getTime() - (-86400000))), eq(schema.bookings.status, "confirmed"))).all()',
  );
  expect(timers).toContain("const due = row.at.getTime() - 86400000;");
  // The event for outgoing, in the record's own transaction.
  expect(timers).toContain('outgoing(tx, as("remind"), "Booking", "timer:remind", now)');
  // A date is its day's start in the app's zone; the action where it fits, else a skip in Activity.
  // A week after a date is seven calendar days, then that day's midnight in the app's zone.
  expect(timers).toContain(
    "instantOf(`${new Date(Date.parse(`${row.at}T00:00:00Z`) + 604800000).toISOString().slice(0, 10)}T00:00`, app.timeZone).getTime()",
  );
  expect(timers).toContain('if (!markOverdueFits(row, as("markOverdue"))) {');
  expect(timers).toContain('await runMarkOverdue(as("markOverdue"), id);');
  // A retry, or a run a stopped process left running, is taken by one tick only.
  expect(timers).toContain(
    'lt(runs.tries, TRIES), or(eq(runs.outcome, "failed"), and(eq(runs.outcome, "running"), lt(runs.ranAt, stale)))',
  );
  // A failed clock run is tried again by its time; one left running on its last try is given up.
  expect(timers).toContain(
    'for (const run of again) if (run.due !== due && run.due !== "seen") await timer.run(run.due);',
  );
  expect(timers).toContain("gte(runs.tries, TRIES - 1)");
  // A clock timer running a custom action, once.
  expect(timers).toContain('clock: {"every":"monday","at":"08:00"}');
  expect(timers).toContain('await digest({} as DigestInput, as("weekly"));');
  // The table, the kit's clock, the data modules loading the tick.
  expect(file("src/db/schema.ts")).toContain('"timer_runs"');
  expect(files.some((f) => f.path === "src/kit/clock.ts")).toBe(true);
  expect(file("src/generated/booking.server.ts")).toContain('import "./timers.server";');
  // The entry on a timer is in the outgoing table under a name no write says.
  expect(file("src/generated/outgoing.server.ts")).toContain('when: "timer:remind"');
});

test("an app without timers has no tick, no table and no clock", () => {
  const ir = validateSpec({
    path: "smithable.yml",
    text: "smithable: 0.1\napp: { name: Plain }\nmodels:\n  Note:\n    fields:\n      text: string\n",
  }).ir as SpecIR;
  const auth = validateAuth(
    { path: "smithable.auth.yml", text: "smithableAuth: 0.1\nsignIn: none\n" },
    ir,
  ).auth as AuthIR;
  const files = generateApp(ir, { smithableVersion: "0.0.0", auth });
  expect(files.some((f) => f.path.includes("timers") || f.path === "src/kit/clock.ts")).toBe(false);
  expect(files.find((f) => f.path === "src/db/schema.ts")?.content).not.toContain("timer_runs");
});

test("a date on a parent record of the same model is read through another name for the table", () => {
  const ir = validateSpec({
    path: "smithable.yml",
    text: `smithable: 0.1
app: { name: Tasks }
models:
  Task:
    fields:
      title: string
      dueAt: datetime
      parent: Task
timers:
  nudge:
    on: Task
    at: 1 hour before parent.dueAt
`,
  }).ir as SpecIR;
  const auth = validateAuth(
    { path: "smithable.auth.yml", text: "smithableAuth: 0.1\nsignIn: none\n" },
    ir,
  ).auth as AuthIR;
  const timers =
    generateApp(ir, { smithableVersion: "0.0.0", auth }).find(
      (f) => f.path === "src/generated/timers.server.ts",
    )?.content ?? "";
  expect(timers).toContain('import { alias } from "drizzle-orm/sqlite-core";');
  expect(timers).toContain('const referenced = alias(schema.tasks, "referenced");');
  expect(timers).toContain(".innerJoin(referenced, eq(schema.tasks.parentId, referenced.id))");
});
