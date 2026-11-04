import { expect, test } from "vitest";
import { applyOperation } from "../apply.js";
import { validateAuth } from "../auth.js";
import { validateContent } from "../content.js";
import type { SpecIR } from "../ir.js";
import { validateSpec } from "../spec.js";
import { outgoingText } from "./outgoing.js";

// A list mail on a clock timer (docs/design/reports.md §2.2), on the booking starter's models.
const SPEC = `smithable: 0.1
app:
  name: Stillwater Yoga
  timezone: Europe/Mariehamn
models:
  Session:
    fields:
      title: string!
      startsAt: datetime!
      endsAt: datetime
      bookings: Booking[]
  Booking:
    fields:
      session: Session!
      attendee: User
      status: pending | confirmed | canceled
      notes: text
      password: string
      photo: picture
      seats: int
      places: { type: int, formula: seats * 2 }
    ownedBy: attendee
queries:
  churnRisk: { custom: true, returns: "Booking[]" }
timers:
  morning: { every: day, at: "06:30" }
  monthly: { cron: "0 6 1 * *" }
  remind: { on: Booking, at: 1 day before session.startsAt }
`;

const ROLES = ["admin", "staff", "member", "notes"];
const read = (outgoing: string) =>
  validateSpec({ path: "smithable.yml", text: `${SPEC}outgoing:\n${outgoing}` }, { roles: ROLES });
const errors = (outgoing: string) =>
  read(outgoing)
    .diagnostics.filter((d) => d.severity === "error")
    .map((d) => d.message);

const TODAYS = `  todaysBookings:
    when: morning
    to: mail
    recipient: admin
    list: { model: Booking, when: session.startsAt, within: today, columns: [session, attendee, status] }
`;

test("the reports.md §2.2 example: a clock timer's entry carries a list and reads into the IR", () => {
  const result = read(`${TODAYS}  weekAhead:
    when: morning
    to: mail
    recipient: staff
    list:
      model: Booking
      where: { status: confirmed }
      when: session.startsAt
      within: 2 weeks
      limit: 20
      columns: [session, status]
    empty: send
  atRisk:
    when: monthly
    to: mail
    recipient: staff
    list: { query: churnRisk, columns: [session, status], limit: 10 }
`);
  expect(result.diagnostics.filter((d) => d.severity === "error")).toEqual([]);
  expect(result.ir?.outgoing).toEqual([
    {
      name: "todaysBookings",
      when: { model: "Booking", timer: "morning", clock: true },
      to: "mail",
      recipient: { kind: "role", role: "admin" },
      list: {
        model: "Booking",
        when: { path: ["session", "startsAt"] },
        within: "today",
        columns: ["session", "attendee", "status"],
      },
      empty: "skip",
    },
    {
      name: "weekAhead",
      when: { model: "Booking", timer: "morning", clock: true },
      to: "mail",
      recipient: { kind: "role", role: "staff" },
      list: {
        model: "Booking",
        where: { status: "confirmed" },
        when: { path: ["session", "startsAt"] },
        within: { amount: 2, unit: "week" },
        limit: 20,
        columns: ["session", "status"],
      },
      empty: "send",
    },
    {
      name: "atRisk",
      when: { model: "Booking", timer: "monthly", clock: true },
      to: "mail",
      recipient: { kind: "role", role: "staff" },
      list: { model: "Booking", query: "churnRisk", limit: 10, columns: ["session", "status"] },
      empty: "skip",
    },
  ]);
  // A record timer's entry is as before: per record, no clock.
  const record = read("  reminder: { when: remind, to: mail, recipient: owner }\n");
  expect(record.ir?.outgoing[0]?.when).toEqual({ model: "Booking", timer: "remind" });
  // A role named like a field is a role all the same, when the roles are known.
  const named = read(
    "  x: { when: morning, to: mail, recipient: notes, list: { model: Booking, columns: [session] } }\n",
  );
  expect(named.ir?.outgoing[0]?.recipient).toEqual({ kind: "role", role: "notes" });
  // The clock timer nobody names is warned about; the one an entry names is not.
  const idle = read(TODAYS).diagnostics.filter((d) => d.code === "timer-does-nothing");
  expect(idle.map((d) => [d.severity, d.line, d.message])).toEqual([
    [
      "warning",
      27,
      'Timer "monthly" does nothing: it is on a clock with no records, runs no action, and no outgoing entry names it.',
    ],
  ]);
});

test("a list mail says itself in one sentence, with the timer's clock", () => {
  const ir = read(`${TODAYS}  weekAhead:
    when: morning
    to: mail
    recipient: staff
    list: { model: Booking, where: { status: confirmed }, when: session.startsAt, within: 2 weeks, limit: 20, columns: [session, status] }
    empty: send
  atRisk:
    when: monthly
    to: mail
    recipient: staff
    list: { query: churnRisk, columns: [session, status] }
  newest:
    when: morning
    to: mail
    recipient: admin
    list: { model: Booking, when: session.startsAt, columns: [session] }
`).ir as SpecIR;
  const words = ir.outgoing.map((o) => outgoingText(o, undefined, ir.timers));
  expect(words).toEqual([
    "Every day at 06:30: the day's bookings (session, attendee, status) to the administrators by mail; nothing to send is skipped.",
    "Every day at 06:30: the bookings whose session's starts at comes within 2 weeks where status is confirmed, the first 20 (session, status) to every staff by mail; with nothing to send, a mail says so.",
    "At 06:00 on the 1st of every month: the bookings of “Churn risk” (session, status) to every staff by mail; nothing to send is skipped.",
    "Every day at 06:30: the bookings whose session's starts at comes within 7 days (session) to the administrators by mail; nothing to send is skipped.",
  ]);
  // Without the timers, the sentence still stands.
  expect(outgoingText(ir.outgoing[0] as SpecIR["outgoing"][number])).toContain(
    "When the timer “Morning” comes: the day's bookings",
  );
});

test("what a list mail refuses, each with its reason", () => {
  const entry = (body: string) => `  x:\n${body}`;
  const list = (list: string, rest = "    to: mail\n    recipient: admin\n") =>
    entry(`    when: morning\n${rest}    list: ${list}\n`);
  const cases: [string, string][] = [
    [
      entry("    when: morning\n    to: mail\n    recipient: admin\n"),
      'Outgoing "x" listens to the timer "morning", which is on a clock with no records, so it needs "list"',
    ],
    [
      list(
        "{ model: Booking, columns: [session] }",
        "    to: mail\n    recipient: admin\n    where: { status: confirmed }\n    show: [session]\n",
      ),
      'Outgoing "x" is a list mail (its timer "morning" is on a clock with no records), so "where" and "show" say nothing; the list\'s own "where" goes under "list".',
    ],
    [
      entry(
        "    when: remind\n    to: mail\n    recipient: owner\n    list: { model: Booking, columns: [session] }\n",
      ),
      'Outgoing "x": "list" and "empty" are for a mail on a clock timer (one with "every" or "cron" and no "on"); "remind" tells about one record at a time.',
    ],
    [
      entry("    when: Booking created\n    to: mail\n    recipient: owner\n    empty: send\n"),
      'Outgoing "x": "list" and "empty" are for a mail on a clock timer (one with "every" or "cron" and no "on"); "Booking created" tells about one record at a time.',
    ],
    [
      list("{ model: Booking, columns: [session] }", "    to: statusFeed\n"),
      'Outgoing "x" is a list mail, which goes by mail; a call to a target ("statusFeed") comes later.',
    ],
    [
      list("{ model: Booking, columns: [session] }", "    to: mail\n"),
      'Outgoing "x" mails a list, so it needs "recipient": a role that reads every Booking.',
    ],
    [
      list("{ model: Booking, columns: [session] }", "    to: mail\n    recipient: owner\n"),
      'Outgoing "x": a list mail has no record: name a role that reads every Booking; owner is not a role.',
    ],
    [
      list("{ model: Booking, columns: [session] }", "    to: mail\n    recipient: attendee\n"),
      'Outgoing "x": a list mail has no record: name a role that reads every Booking; "attendee", a field of Booking is not a role.',
    ],
    [
      list(
        "{ model: Booking, columns: [session] }",
        "    to: mail\n    recipient: session.title\n",
      ),
      'Outgoing "x": a list mail has no record: name a role that reads every Booking; "session.title" is not a role.',
    ],
    [
      list("{ model: Booking }"),
      'Outgoing "x": "list" needs "columns": the fields the mail\'s table shows, in order',
    ],
    [
      list("{ model: Booking, columns: [] }"),
      'Outgoing "x": "columns" names at least one field of Booking.',
    ],
    [
      list("{ model: Booking, columns: [photo] }"),
      'Outgoing "x": Booking.photo holds files or pictures, so it cannot be shown.',
    ],
    [
      list("{ model: Booking, columns: [password] }"),
      'Outgoing "x": Booking.password looks like a card number, a password or an identity number, so it cannot be shown.',
    ],
    [
      list("{ model: Session, columns: [bookings] }"),
      'Outgoing "x": Session.bookings lists other records, so it cannot be shown.',
    ],
    [
      list("{ model: Booking, columns: [places] }"),
      'Outgoing "x": Booking.places is worked out when the record is read, which a mail or a call does not do, so it cannot be shown.',
    ],
    [
      list("{ model: Booking, columns: [sessions] }"),
      'Outgoing "x": Booking has no field named "sessions".',
    ],
    [
      list("{ model: Booking, within: today, columns: [session] }"),
      'Outgoing "x": "within" goes with "when": how far the list reaches from the timer\'s time.',
    ],
    [
      list("{ model: Booking, when: session.startsAt, within: soon, columns: [session] }"),
      'Outgoing "x": "within" is today, tomorrow, or a number of days or weeks, as in 7 days or 2 weeks.',
    ],
    [
      list("{ model: Booking, when: session.startsAt, within: 0 days, columns: [session] }"),
      'Outgoing "x": "within" is today, tomorrow, or a number of days or weeks, as in 7 days or 2 weeks.',
    ],
    [
      list("{ model: Booking, when: notes, columns: [session] }"),
      'Outgoing "x": Booking.notes is not a date or a date-time.',
    ],
    [
      list("{ model: Booking, when: session.title, columns: [session] }"),
      'Outgoing "x": Session.title is not a stored date or date-time.',
    ],
    [
      list("{ model: Booking, when: session.startsAt.day, columns: [session] }"),
      'Outgoing "x": "when" is a date field of Booking, or one reference away like session.startsAt; "session.startsAt.day" is neither.',
    ],
    [
      list("{ model: Booking, query: churnRisk, columns: [session] }"),
      'Outgoing "x": "list" takes "model" or "query", not both.',
    ],
    [
      list("{ columns: [session] }"),
      'Outgoing "x": "list" needs "model" (the records the mail shows) or "query" (a query\'s records).',
    ],
    [
      list("{ query: churnRisk, where: { status: confirmed }, columns: [session] }"),
      'Outgoing "x": "where" does not apply to a query: its code chooses the records.',
    ],
    [
      list("{ query: churn, columns: [session] }"),
      'Outgoing "x": There is no query named "churn".',
    ],
    [
      list("{ model: Bookings, columns: [session] }"),
      'Outgoing "x": There is no model named "Bookings".',
    ],
    [
      list("{ model: Booking, limit: 0, columns: [session] }"),
      'Outgoing "x": "limit" must be a whole number above 0.',
    ],
    [
      list(
        "{ model: Booking, columns: [session] }",
        "    to: mail\n    recipient: admin\n    empty: maybe\n",
      ),
      'Outgoing "x": "empty" is skip (nothing to show, no mail) or send (a mail that says so); "maybe" is neither.',
    ],
  ];
  for (const [text, message] of cases) {
    const found = errors(text);
    expect(found, text).toContainEqual(expect.stringContaining(message));
    expect(found, text).toHaveLength(1);
  }
});

test("the recipient must read every record of the list's model: the auth file's check", () => {
  const auth = (staff: string) => `smithableAuth: 0.1
signIn:
  providers: [email]
defaultAccess: private
roles:
  admin: { description: Runs it. }
  staff: { description: Works.${staff} }
  member: { description: Books. }
defaultRole: member
admins: [owner@stillwateryoga.fi]
`;
  const spec = read(`  weekAhead:
    when: morning
    to: mail
    recipient: staff
    list: { model: Booking, columns: [session] }
`).ir as SpecIR;
  const check = (text: string) =>
    validateAuth({ path: "smithable.auth.yml", text }, spec).diagnostics.filter(
      (d) => d.code === "recipient-cannot-read",
    );
  const [refused] = check(auth(""));
  expect(refused?.severity).toBe("error");
  expect(refused?.message).toBe(
    '"weekAhead" under outgoing: every staff would get a list of Booking records, which staff may not read beyond their own: the mail would show them records they cannot open.',
  );
  expect(refused?.hint).toBe(
    "Let staff read every Booking (read: [Booking] under roles.staff in smithable.auth.yml), or mail another role.",
  );
  expect(check(auth(", read: [Booking]"))).toEqual([]);
  expect(check(auth(", read: all"))).toEqual([]);
  // The administrators always read everything.
  const admins = read(TODAYS).ir as SpecIR;
  expect(
    validateAuth({ path: "smithable.auth.yml", text: auth("") }, admins).diagnostics.filter(
      (d) => d.severity === "error",
    ),
  ).toEqual([]);
});

test("a list mail's texts take {count} and {date}, not a record's fields", () => {
  const ir = read(TODAYS).ir as SpecIR;
  const check = (text: string) =>
    validateContent({ path: "smithable.content.yml", text }, ir).diagnostics.map((d) => d.message);
  expect(
    check(
      'smithableContent: 0.1\noutgoing:\n  todaysBookings:\n    subject: "{count} bookings on {date}"\n',
    ),
  ).toEqual([]);
  expect(
    check('smithableContent: 0.1\noutgoing:\n  todaysBookings:\n    subject: "{status} today"\n'),
  ).toContainEqual(
    expect.stringContaining(
      'a list mail has no record, so "{status}" cannot be filled; its placeholders are {count} (how many records) and {date} (the day).',
    ),
  );
});

const AUTH = `smithableAuth: 0.1
signIn:
  providers: [email]
defaultAccess: private
roles:
  admin: { description: Runs it. }
  staff: { description: Works. }
admins: [owner@example.com]
`;
const FILES = { spec: SPEC, auth: AUTH };
const ok = (result: ReturnType<typeof applyOperation>) => {
  if (!result.ok) throw new Error(result.message);
  return result;
};
const refused = (result: ReturnType<typeof applyOperation>) => (result.ok ? "" : result.message);

test("addOutgoing on a clock timer writes a list mail; setOutgoingList replaces its keys and undoes itself; removeOutgoing takes it away", () => {
  const added = ok(
    applyOperation(FILES, "addOutgoing", {
      outgoing: "todaysBookings",
      when: "morning",
      recipient: "admin",
      list: "Booking",
      date: "session.startsAt",
      within: "today",
      columns: ["session", "attendee", "status"],
    }),
  );
  expect(added.description).toBe("Add todaysBookings: when morning, mail admin the Booking list");
  const written = `outgoing:
  todaysBookings:
    when: morning
    to: mail
    recipient: admin
    list:
      model: Booking
      when: session.startsAt
      within: today
      columns: [session, attendee, status]
`;
  expect(added.files.spec).toContain(written);
  const changed = ok(
    applyOperation(added.files, "setOutgoingList", {
      outgoing: "todaysBookings",
      where: { status: "confirmed" },
      within: "2 weeks",
      limit: 10,
      columns: ["session", "status"],
      empty: "send",
    }),
  );
  expect(changed.files.spec).toContain(`    list:
      model: Booking
      where:
        status: confirmed
      when: session.startsAt
      within: 2 weeks
      limit: 10
      columns: [session, status]
    empty: send
`);
  // Back again: the same keys as before, so the change undoes itself.
  const back = ok(
    applyOperation(changed.files, "setOutgoingList", {
      outgoing: "todaysBookings",
      where: {},
      within: "today",
      limit: "none",
      columns: ["session", "attendee", "status"],
      empty: "skip",
    }),
  );
  expect(back.files.spec).toBe(added.files.spec);
  // A query instead of the model; the model instead of the query.
  const query = ok(
    applyOperation(added.files, "setOutgoingList", {
      outgoing: "todaysBookings",
      query: "churnRisk",
      date: "none",
      within: "none",
    }),
  );
  expect(query.files.spec).toContain(
    "    list:\n      query: churnRisk\n      columns: [session, attendee, status]\n",
  );
  // A query list changed in another key keeps its query alone.
  const limited = ok(
    applyOperation(query.files, "setOutgoingList", {
      outgoing: "todaysBookings",
      limit: 5,
      empty: "send",
    }),
  );
  expect(limited.files.spec).toContain(
    "    list:\n      query: churnRisk\n      limit: 5\n      columns: [session, attendee, status]\n    empty: send\n",
  );
  const model = ok(
    applyOperation(query.files, "setOutgoingList", { outgoing: "todaysBookings", list: "Booking" }),
  );
  expect(model.files.spec).toContain(
    "    list:\n      model: Booking\n      columns: [session, attendee, status]\n",
  );
  const gone = ok(applyOperation(added.files, "removeOutgoing", { outgoing: "todaysBookings" }));
  expect(gone.files.spec).toBe(SPEC);
  // The timer stays needed while the entry listens.
  expect(refused(applyOperation(added.files, "removeTimer", { name: "morning" }))).toContain(
    '"todaysBookings" under outgoing listens to the timer "morning"',
  );
});

test("what the operations refuse", () => {
  const add = (args: Record<string, unknown>) =>
    refused(
      applyOperation(
        FILES,
        "addOutgoing",
        Object.fromEntries(
          Object.entries({
            outgoing: "x",
            when: "morning",
            recipient: "admin",
            list: "Booking",
            columns: ["session"],
            ...args,
          }).filter(([, v]) => v !== undefined),
        ),
      ),
    );
  expect(add({ when: "remind", recipient: "owner" })).toBe(
    '"list" and "empty" are for a mail on a clock timer (one with "every" or "cron" and no "on"); "remind" tells about one record at a time.',
  );
  expect(add({ show: ["session"] })).toContain(
    '"fields", "show" and "previous" say nothing for it',
  );
  expect(add({ to: "statusFeed" })).toBe(
    'A list mail goes by mail; a call to a target ("statusFeed") comes later.',
  );
  expect(add({ recipient: undefined })).toBe(
    "A list mail needs a recipient: --recipient a role that reads every Booking (admin).",
  );
  expect(add({ recipient: "owner" })).toBe(
    "A list mail has no record: name a role that reads every Booking; owner is not a role.",
  );
  // The auth file says staff reads only its own bookings.
  expect(add({ recipient: "staff" })).toBe(
    "Every staff would get a list of Booking records, which staff may not read beyond their own: the mail would show them records they cannot open. Let staff read every Booking (read: [Booking] under roles.staff in smithable.auth.yml), or mail another role.",
  );
  expect(add({ columns: ["photo"] })).toBe(
    "Booking.photo holds files or pictures, so it cannot be shown.",
  );
  expect(add({ columns: undefined })).toContain('"list" needs "columns"');
  expect(add({ within: "today" })).toContain('"within" goes with "when"');
  expect(add({ list: undefined })).toContain('"list" needs "model"');
  expect(add({ empty: "maybe" })).toContain('"empty" must be one of "skip", "send"');

  const added = ok(
    applyOperation(FILES, "addOutgoing", {
      outgoing: "todaysBookings",
      when: "morning",
      recipient: "admin",
      list: "Booking",
      date: "session.startsAt",
      within: "today",
      columns: ["session"],
    }),
  );
  const set = (args: Record<string, unknown>) =>
    refused(
      applyOperation(added.files, "setOutgoingList", { outgoing: "todaysBookings", ...args }),
    );
  expect(set({})).toContain("Say what to change");
  expect(set({ columns: ["none"] })).toBe(
    "A list mail's table has at least one column; --columns none is no table.",
  );
  expect(set({ date: "none" })).toContain('"within" goes with "when"');
  expect(set({ list: "Session" })).toBe('Session has no field named "session".');
  const record = ok(
    applyOperation(FILES, "addOutgoing", {
      outgoing: "reminder",
      when: "remind",
      recipient: "owner",
    }),
  );
  expect(
    refused(applyOperation(record.files, "setOutgoingList", { outgoing: "reminder", limit: 5 })),
  ).toBe(
    '"reminder" tells about one record at a time; setOutgoingList is for a list mail on a clock timer.',
  );
});

test("a list mail follows renamed fields and models and refuses the removal of what it shows", () => {
  const added = ok(
    applyOperation(FILES, "addOutgoing", {
      outgoing: "weekAhead",
      when: "morning",
      recipient: "admin",
      list: "Booking",
      where: { status: "confirmed" },
      date: "session.endsAt",
      within: "2 weeks",
      columns: ["session", "attendee", "status"],
    }),
  );
  const status = ok(
    applyOperation(added.files, "renameField", { model: "Booking", from: "status", to: "state" }),
  );
  expect(status.files.spec).toContain("      where:\n        state: confirmed\n");
  expect(status.files.spec).toContain("      columns: [session, attendee, state]\n");
  const far = ok(
    applyOperation(added.files, "renameField", {
      model: "Session",
      from: "endsAt",
      to: "finishes",
    }),
  );
  expect(far.files.spec).toContain("      when: session.finishes\n");
  const near = ok(
    applyOperation(added.files, "renameField", { model: "Booking", from: "session", to: "class" }),
  );
  expect(near.files.spec).toContain("      when: class.endsAt\n");
  expect(near.files.spec).toContain("      columns: [class, attendee, status]\n");
  const model = ok(
    applyOperation(added.files, "renameModel", { from: "Booking", to: "Reservation" }),
  );
  expect(model.files.spec).toContain("      model: Reservation\n");
  expect(
    refused(applyOperation(added.files, "removeField", { model: "Booking", field: "attendee" })),
  ).toBe(
    '"weekAhead" under outgoing shows Booking.attendee in its list; change or remove it first.',
  );
  expect(
    refused(applyOperation(added.files, "removeField", { model: "Session", field: "endsAt" })),
  ).toBe(
    '"weekAhead" under outgoing lists Booking records by Session.endsAt; change or remove it first.',
  );
  expect(
    refused(
      applyOperation(added.files, "changeField", {
        model: "Booking",
        field: "status",
        type: "pending | canceled",
      }),
    ),
  ).toBe(
    '"weekAhead" under outgoing wants a value Booking.status no longer has in its list; change or remove it first.',
  );
  // The date's type changing is refused, as the reference it goes through would be.
  expect(
    refused(
      applyOperation(added.files, "changeField", {
        model: "Session",
        field: "endsAt",
        type: "date",
      }),
    ),
  ).toBe(
    '"weekAhead" under outgoing lists Booking records by session.endsAt, whose type is changing; change or remove it first.',
  );
  const renamedValue = ok(
    applyOperation(added.files, "changeField", {
      model: "Booking",
      field: "status",
      type: "pending | booked | canceled",
      renames: ["confirmed=booked"],
    }),
  );
  expect(renamedValue.files.spec).toContain("        status: booked\n");
});

test("setOutgoingList with both a model and a query says so", () => {
  const added = ok(
    applyOperation(FILES, "addOutgoing", {
      outgoing: "x",
      when: "morning",
      recipient: "admin",
      list: "Booking",
      columns: ["session"],
    }),
  );
  expect(
    refused(
      applyOperation(added.files, "setOutgoingList", {
        outgoing: "x",
        list: "Booking",
        query: "churnRisk",
      }),
    ),
  ).toBe('"list" takes "model" or "query", not both.');
});
