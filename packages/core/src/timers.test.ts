import { expect, test } from "vitest";
import { applyOperation } from "./apply.js";
import { cronText, timerText } from "./sections/timers.js";
import { validateSpec } from "./spec.js";

// Timers (docs/design/timed-actions.md): on a clock or at a date of a record, running an action;
// outgoing listens to a timer by name.
const spec = `smithable: 0.1
app: { name: Studio }
models:
  Session:
    fields:
      title: string
      startsAt: datetime
      bookings: Booking[]
  Booking:
    fields:
      session: Session!
      status: pending | confirmed | cancelled
  Invoice:
    fields:
      number: string
      dueOn: date
      status: draft | sent | overdue | paid
  Post:
    fields:
      title: string
      publishAt: datetime
      published: bool
actions:
  markOverdue: { on: Invoice, when: { status: sent }, set: { status: overdue } }
  publish: { on: Post, set: { published: true } }
  sendDigest: { custom: true }
  closePayroll: { custom: true }
timers:
  remind:
    on: Booking
    at: 1 day before session.startsAt
    where: { status: confirmed }
  markOverdue:
    on: Invoice
    at: 7 days after dueOn
    where: { status: sent }
    run: markOverdue
  publish:
    on: Post
    at: publishAt
    run: publish
  weeklyDigest:
    every: monday
    at: "08:00"
    run: sendDigest
  payroll:
    cron: "0 6 25 * *"
    run: closePayroll
outgoing:
  reminder:
    when: remind
    to: mail
    recipient: owner
`;

const read = (text: string) => validateSpec({ path: "smithable.yml", text });
const codes = (text: string) => read(text).diagnostics.map((d) => `${d.code}: ${d.message}`);

test("the three forms of a timer read into the IR, and outgoing listens to one by name", () => {
  const { ir, diagnostics } = read(spec);
  expect(diagnostics).toEqual([]);
  expect(ir?.timers.map((t) => t.name)).toEqual([
    "remind",
    "markOverdue",
    "publish",
    "weeklyDigest",
    "payroll",
  ]);
  expect(ir?.timers[0]).toEqual({
    name: "remind",
    on: "Booking",
    where: { status: "confirmed" },
    schedule: {
      kind: "record",
      path: ["session", "startsAt"],
      offset: { amount: 1, unit: "day", direction: "before" },
    },
  });
  expect(ir?.timers[2]?.schedule).toEqual({ kind: "record", path: ["publishAt"] });
  expect(ir?.timers[3]?.schedule).toEqual({ kind: "every", every: "monday", at: "08:00" });
  expect(ir?.timers[4]).toEqual({
    name: "payroll",
    run: "closePayroll",
    schedule: { kind: "cron", cron: "0 6 25 * *" },
  });
  expect(ir?.outgoing[0]?.when).toEqual({ model: "Booking", timer: "remind" });
});

test("a timer says itself in one sentence", () => {
  const timers = read(spec).ir?.timers ?? [];
  const words = Object.fromEntries(timers.map((t) => [t.name, timerText(t)]));
  expect(words).toEqual({
    remind:
      "A day before a booking's session's starts at, where status is confirmed: raises its event, for outgoing to tell someone.",
    markOverdue: "7 days after an invoice's due on, where status is sent: runs “Mark overdue”.",
    publish: "When a post's publish at comes: runs “Publish”.",
    weeklyDigest: "Every Monday at 08:00: runs “Send digest”.",
    payroll: "At 06:00 on the 25th of every month: runs “Close payroll”.",
  });
  expect(cronText("30 7 * * 1")).toBe("at 07:30 on Mondays");
  expect(cronText("0 0 1 1 *")).toBe("at 00:00 on the 1st of January");
  expect(cronText("*/15 * * * *")).toBe('on the schedule "*/15 * * * *"');
});

test("a timer with two forms, no records, a wrong date, a wrong action or a wrong cron is refused with the reason", () => {
  const one = (from: string, to: string) => codes(spec.replace(from, to));
  expect(
    one('    cron: "0 6 25 * *"\n', '    cron: "0 6 25 * *"\n    every: day\n'),
  ).toContainEqual(expect.stringContaining("one of the three, not every and cron"));
  expect(one("    on: Post\n", "")).toContainEqual(
    expect.stringContaining('it needs "on": the model whose records it runs for'),
  );
  expect(one("at: 1 day before session.startsAt", "at: 1 day before session.title")).toContainEqual(
    expect.stringContaining("Session.title is not a stored date or date-time"),
  );
  expect(one("at: 1 day before session.startsAt", "at: 1 day before status")).toContainEqual(
    expect.stringContaining("Booking.status is not a date or a date-time"),
  );
  expect(
    one("at: 1 day before session.startsAt", "at: a day before session.startsAt"),
  ).toContainEqual(expect.stringContaining('"<number> minutes|hours|days before|after <field>"'));
  expect(one("    run: markOverdue\n", "    run: publish\n")).toContainEqual(
    expect.stringContaining('"publish", which is an action of Post, not of Invoice'),
  );
  expect(one("    run: markOverdue\n", "    run: sendDigest\n")).toContainEqual(
    expect.stringContaining('runs once with no record, so it takes no "on"'),
  );
  expect(
    one('    every: monday\n    at: "08:00"\n', '    every: monday\n    at: "8 am"\n'),
  ).toContainEqual(expect.stringContaining('a clock time like "08:00"'));
  expect(
    one('    every: monday\n    at: "08:00"\n', '    every: fortnight\n    at: "08:00"\n'),
  ).toContainEqual(expect.stringContaining('"fortnight" is none of them'));
  expect(one('cron: "0 6 25 * *"', 'cron: "0 6 25 * mon"')).toContainEqual(
    expect.stringContaining("names a day or a month; cron takes numbers"),
  );
  expect(one('cron: "0 6 25 * *"', 'cron: "0 25 25 * *"')).toContainEqual(
    expect.stringContaining('the hour field "25" is outside 0–23'),
  );
  expect(
    one(
      '    every: monday\n    at: "08:00"\n    run: sendDigest\n',
      '    every: monday\n    at: "08:00"\n',
    ),
  ).toContainEqual(expect.stringContaining("does nothing"));
  // A timer may be named like the action it runs; outgoing's when then cannot tell them apart.
  expect(one("    when: remind\n", "    when: publish\n")).toContainEqual(
    expect.stringContaining('is both an action and a timer, so "when" cannot tell which'),
  );
  // Outgoing on a timer without records has nothing to tell about.
  expect(one("    when: remind\n", "    when: weeklyDigest\n")).toContainEqual(
    expect.stringContaining('runs for no records (no "on")'),
  );
});

test("addTimer, setTimer and removeTimer write the section; a listening outgoing entry blocks a removal", () => {
  const added = applyOperation({ spec }, "addTimer", {
    name: "nudge",
    on: "Invoice",
    at: "3 days before dueOn",
    where: { status: "sent" },
  });
  if (!added.ok) throw new Error(added.message);
  expect(added.files.spec).toContain(
    "  nudge:\n    on: Invoice\n    at: 3 days before dueOn\n    where:\n      status: sent\n",
  );
  expect(applyOperation({ spec }, "addTimer", { name: "nudge", on: "Invoice" })).toMatchObject({
    ok: false,
    message: expect.stringContaining("Say when"),
  });
  const moved = applyOperation({ spec }, "setTimer", {
    name: "payroll",
    every: "month",
    at: "06:00",
  });
  if (!moved.ok) throw new Error(moved.message);
  expect(moved.files.spec).toContain(
    "  payroll:\n    run: closePayroll\n    every: month\n    at: 06:00\n",
  );
  expect(moved.files.spec).not.toContain("cron:");
  const quiet = applyOperation({ spec }, "setTimer", { name: "remind", where: "none" as never });
  expect(quiet.ok && quiet.files.spec).not.toContain("where: { status: confirmed }");
  expect(applyOperation({ spec }, "removeTimer", { name: "remind" })).toMatchObject({
    ok: false,
    message: expect.stringContaining('"reminder" under outgoing listens to the timer "remind"'),
  });
  // addOutgoing takes a timer's name as its when.
  const told = applyOperation({ spec }, "addOutgoing", {
    outgoing: "overdueNotice",
    when: "remind",
    to: "mail",
    recipient: "owner",
  });
  if (!told.ok) throw new Error(told.message);
  expect(told.files.spec).toContain("  overdueNotice:\n    when: remind\n");
  const removed = applyOperation({ spec }, "removeTimer", { name: "payroll" });
  expect(removed.ok && removed.files.spec).not.toContain("payroll");
  // The last timer takes the key with it.
  const only = `smithable: 0.1\napp: { name: X }\nmodels:\n  Post:\n    fields:\n      publishAt: datetime\n      published: bool\nactions:\n  publish: { on: Post, set: { published: true } }\ntimers:\n  publish: { on: Post, at: publishAt, run: publish }\n`;
  const gone = applyOperation({ spec: only }, "removeTimer", { name: "publish" });
  expect(gone.ok && gone.files.spec).not.toContain("timers");
});

test("a timer follows a renamed field in its date and condition, and refuses the removal of what it uses", () => {
  const renamed = applyOperation({ spec }, "renameField", {
    model: "Session",
    from: "startsAt",
    to: "begins",
  });
  if (!renamed.ok) throw new Error(renamed.message);
  expect(renamed.files.spec).toContain("at: 1 day before session.begins");
  const own = applyOperation({ spec }, "renameField", {
    model: "Invoice",
    from: "dueOn",
    to: "due",
  });
  if (!own.ok) throw new Error(own.message);
  expect(own.files.spec).toContain("at: 7 days after due\n");
  const cond = applyOperation({ spec }, "renameField", {
    model: "Booking",
    from: "status",
    to: "state",
  });
  if (!cond.ok) throw new Error(cond.message);
  expect(cond.files.spec).toMatch(
    /at: 1 day before session.startsAt\n\s+where: \{ state: confirmed \}/,
  );
  expect(
    applyOperation({ spec }, "removeField", { model: "Post", field: "publishAt" }),
  ).toMatchObject({
    ok: false,
    message: expect.stringContaining('The timer "publish" uses Post.publishAt'),
  });
  expect(applyOperation({ spec }, "removeAction", { action: "closePayroll" })).toMatchObject({
    ok: false,
    message: expect.stringContaining('The timer "payroll" runs the action "closePayroll"'),
  });
});
