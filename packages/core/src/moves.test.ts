import { expect, test } from "vitest";
import { type AuthIR, validateAuth } from "./auth.js";
import type { SpecIR } from "./ir.js";
import {
  choose,
  coverageWalk,
  emptyMemory,
  type Move,
  movesFor,
  REFUSAL_REST,
  seeded,
  valueFor,
  variantsOf,
  walk,
  weightOf,
} from "./moves.js";
import { validateSpec } from "./spec.js";

const spec = `smithable: 0.1
app: { name: Still Water }
models:
  ClassType:
    fields:
      name: string!
      minutes: int = 60
  Session:
    fields:
      classType: ClassType!
      startsAt: datetime!
      capacity: int! = 12
      status: scheduled | cancelled
      bookings: Booking[]
  Booking:
    fields:
      session: Session!
      member: User! = ME()
      places: { type: int!, min: 1, max: 4 }
      note: text
      status: booked | cancelled
      madeOn: { type: date, by: app, default: TODAY() }
    ownedBy: member
  Message:
    fields:
      name: string!
      email: email!
      message: text!
  Flyer:
    fields:
      title: string!
      poster: picture!
actions:
  cancel:
    on: Booking
    when: { status: booked }
    set: { status: cancelled }
  cancelSession:
    on: Session
    when: { status: scheduled }
    set: { status: cancelled }
pages:
  home: { landing: {} }
  schedule: { crud: Session }
  my-bookings: { crud: Booking }
  messages: { crud: Message }
  flyers: { crud: Flyer }
  team: { users: manage }
`;
const ir = validateSpec({ path: "smithable.yml", text: spec }).ir as SpecIR;
const read = validateAuth(
  {
    path: "smithable.auth.yml",
    text: `smithableAuth: 0.1
signIn: { providers: [email] }
defaultAccess: private
roles:
  admin: all
  member: { pages: [my-bookings], create: [Booking] }
public:
  pages: [home, schedule]
  read: [ClassType, Session]
  create: [Message]
`,
  },
  ir,
);
if (!read.auth) throw new Error(read.diagnostics.map((d) => d.message).join("\n"));
const auth = read.auth as AuthIR;
const ids = (moves: Move[]) => moves.map((m) => m.id);

test("a visitor's moves: the public pages, the public forms, no change and no action", () => {
  expect(ids(movesFor(ir, auth, "visitor"))).toEqual(["open:home", "open:schedule", "add:Message"]);
});

// A member changes and deletes their own records: the bookings the model says they own, and the
// messages they sent; never a class type or a session, which they cannot come to own.
test("a member's moves: their pages, booking with the fields a form asks, their own actions", () => {
  const moves = movesFor(ir, auth, { role: "member" });
  expect(ids(moves)).toEqual([
    "open:home",
    "open:schedule",
    "open:my-bookings",
    "add:Booking",
    "change:Booking",
    "delete:Booking",
    "add:Message",
    "change:Message",
    "delete:Message",
    "run:cancel",
  ]);
  const add = moves.find((m) => m.id === "add:Booking");
  // The session is a reference the app picks; the member and the date are the app's own.
  expect(add && "slots" in add ? add.slots : []).toEqual([
    { field: "session", kind: "reference", required: true, model: "Session" },
    { field: "places", kind: "number", required: true, min: 1, max: 4 },
    { field: "note", kind: "text", required: false },
    { field: "status", kind: "choice", required: true, values: ["booked", "cancelled"] },
  ]);
  const cancel = moves.find((m) => m.id === "run:cancel");
  expect(cancel).toMatchObject({ kind: "run", model: "Booking", when: { status: "booked" } });
});

test("an admin may do everything, deleting included", () => {
  const moves = ids(movesFor(ir, auth, { role: "admin" }));
  expect(moves).toContain("delete:Session");
  expect(moves).toContain("run:cancelSession");
  expect(moves).toContain("open:team");
  expect(moves).toContain("open:messages");
  // A flyer needs a poster, which no move can give: adding one is not a move; changing is.
  expect(moves).not.toContain("add:Flyer");
  expect(moves).toContain("change:Flyer");
});

test("values fit their slot and the walk is the same for the same seed", () => {
  const rnd = seeded(7);
  const now = new Date("2026-10-28T10:00:00Z");
  const places = valueFor(
    { field: "places", kind: "number", required: true, min: 1, max: 4 },
    rnd,
    now,
  );
  expect(places).toBeGreaterThanOrEqual(1);
  expect(places).toBeLessThanOrEqual(4);
  expect(valueFor({ field: "session", kind: "reference", required: true }, rnd, now)).toBeNull();
  // Bounds hold with one side given, and a text reaches its shortest length.
  for (let i = 0; i < 20; i++) {
    const small = valueFor({ field: "n", kind: "number", required: true, max: 0 }, rnd, now);
    expect(small).toBe(0);
    const long = String(
      valueFor({ field: "note", kind: "text", required: true, min: 30 }, rnd, now),
    );
    expect(long.length).toBeGreaterThanOrEqual(30);
  }
  const when = valueFor({ field: "startsAt", kind: "datetime", required: true }, rnd, now);
  expect(String(when)).toMatch(/^2026-1[01]-\d\dT(0[89]|1\d):(00|15|30|45):00\.000Z$/);
  expect(valueFor({ field: "email", kind: "email", required: true }, rnd, now)).toMatch(
    /^sample\d+@example\.com$/,
  );
  const moves = movesFor(ir, auth, { role: "member" });
  const first = walk(moves, 42, 12, now);
  expect(first).toHaveLength(12);
  expect(walk(moves, 42, 12, now)).toEqual(first);
  expect(walk(moves, 43, 12, now)).not.toEqual(first);
  for (const step of first) {
    const move = moves.find((m) => m.id === step.move);
    expect(move).toBeDefined();
    if (move && "slots" in move)
      for (const slot of move.slots)
        if (slot.required) expect(step.values).toHaveProperty(slot.field);
  }
  expect(walk([], 1, 5, now)).toEqual([]);
});

const now = new Date("2026-10-29T09:00:00Z");
const by = (moves: Move[], id: string) => moves.find((m) => m.id === id) as Move;

test("the sensible draw: own records weigh more, an add's follow-ups come first, a refusal rests, a visitor looks", () => {
  const member = { role: "member" };
  const moves = movesFor(ir, auth, member);
  const fresh = emptyMemory();
  // Nothing made yet: a page not yet opened weighs more than a form.
  expect(weightOf(by(moves, "open:my-bookings"), fresh, member)).toBe(2);
  expect(weightOf(by(moves, "add:Booking"), fresh, member)).toBe(1);
  // Having bookings of one's own: a move on bookings weighs three times.
  const owning = {
    ...fresh,
    turn: 1,
    made: { Booking: 1 },
    recent: ["add:Booking"],
    touched: { Booking: 0 },
  };
  expect(weightOf(by(moves, "run:cancel"), owning, member)).toBe(3);
  expect(weightOf(by(moves, "change:Booking"), owning, member)).toBe(3);
  // A refused add made nothing: the host sets no justMade, so nothing follows it.
  expect(weightOf(by(moves, "add:Booking"), owning, member)).toBe(1);
  // Right after adding a booking (done): cancelling it comes first, a change next, another booking waits.
  const after = { ...owning, justMade: "Booking" };
  expect(weightOf(by(moves, "run:cancel"), after, member)).toBe(9);
  expect(weightOf(by(moves, "change:Booking"), after, member)).toBe(6);
  expect(weightOf(by(moves, "add:Booking"), after, member)).toBe(0.5);
  // A refusal rests for three turns, unless someone touched the model meanwhile; a touch in the
  // refusal's own turn is the refused move itself.
  const refused = { ...after, turn: 2, refused: [{ move: "run:cancel", turn: 1 }] };
  expect(weightOf(by(moves, "run:cancel"), refused, member)).toBe(0);
  expect(weightOf(by(moves, "run:cancel"), { ...refused, touched: { Booking: 1 } }, member)).toBe(
    0,
  );
  expect(weightOf(by(moves, "run:cancel"), { ...refused, turn: REFUSAL_REST }, member)).toBe(0);
  expect(weightOf(by(moves, "run:cancel"), { ...refused, touched: { Booking: 2 } }, member)).toBe(
    9,
  );
  expect(weightOf(by(moves, "run:cancel"), { ...refused, turn: 1 + REFUSAL_REST }, member)).toBe(9);
  // A visitor mostly opens pages.
  const visiting = movesFor(ir, auth, "visitor");
  expect(weightOf(visiting.find((m) => m.kind === "open") as Move, fresh, "visitor")).toBe(3);
  expect(weightOf(by(visiting, "add:Message"), fresh, "visitor")).toBe(1);
  // The draw is deterministic for a seed and a memory, and empty when every weight is 0.
  const a = choose(moves, after, member, seeded(7), now);
  expect(choose(moves, after, member, seeded(7), now)).toEqual(a);
  expect(a && moves.some((m) => m.id === a.move)).toBe(true);
  expect(choose([by(moves, "run:cancel")], refused, member, seeded(7), now)).toBeUndefined();
  // A resting move is never drawn, even when the draw lands at the very end of the list.
  const rested = { ...refused, refused: [{ move: "open:my-bookings", turn: 1 }] };
  const ending = [
    ...moves.filter((m) => m.id !== "open:my-bookings"),
    by(moves, "open:my-bookings"),
  ];
  const atEnd = choose(ending, rested, member, () => 0.999999999, now);
  expect(atEnd?.move).toBe(ending[ending.length - 2]?.id);
});

test("the variants of a move: the plain one, the boundaries to take, the values to refuse", () => {
  const moves = movesFor(ir, auth, { role: "member" });
  const booking = variantsOf(by(moves, "add:Booking"), now);
  const named = Object.fromEntries(booking.map((v) => [v.id.slice("add:Booking#".length), v]));
  expect(named.plain?.expect).toBe("done");
  expect(named["places-at-min"]).toMatchObject({
    expect: "done",
    values: expect.objectContaining({ places: 1 }),
  });
  expect(named["places-at-max"]).toMatchObject({
    expect: "done",
    values: expect.objectContaining({ places: 4 }),
  });
  expect(named["places-below-min"]).toMatchObject({
    expect: "refused",
    values: expect.objectContaining({ places: 0 }),
  });
  expect(named["places-above-max"]).toMatchObject({
    expect: "refused",
    values: expect.objectContaining({ places: 5 }),
  });
  expect(named["places-empty"]).toMatchObject({ expect: "refused" });
  expect(named["status-not-a-choice"]).toMatchObject({ expect: "refused" });
  // A reference is the app's pick: no empty variant; a text without bounds has no rule to vary.
  expect(named["session-empty"]).toBeUndefined();
  expect(Object.keys(named).filter((k) => k.startsWith("note-"))).toEqual([]);
  // The plain values are the same every time (seeded), so a variant's id names one thing.
  expect(variantsOf(by(moves, "add:Booking"), now)).toEqual(booking);
  const message = variantsOf(by(movesFor(ir, auth, "visitor"), "add:Message"), now);
  expect(message.map((v) => v.id)).toEqual([
    "add:Message#plain",
    "add:Message#name-empty",
    "add:Message#email-empty",
    "add:Message#email-not-an-email",
    "add:Message#message-empty",
  ]);
  // A text's bounds, a phone and an address.
  const bounded = variantsOf(
    {
      id: "add:X",
      kind: "add",
      model: "X",
      slots: [
        { field: "code", kind: "text", required: true, min: 3, max: 5 },
        { field: "phone", kind: "phone", required: false },
        { field: "site", kind: "url", required: false },
      ],
    },
    now,
  ).map((v) => [v.id.slice("add:X#".length), v.expect, v.values.code]);
  expect(bounded).toEqual([
    ["plain", "done", expect.any(String)],
    ["code-empty", "refused", null],
    ["code-at-min", "done", "xxx"],
    ["code-too-short", "refused", "xx"],
    ["code-at-max", "done", "xxxxx"],
    ["code-too-long", "refused", "xxxxxx"],
    ["phone-not-a-phone", "refused", expect.any(String)],
    ["site-not-a-url", "refused", expect.any(String)],
  ]);
  // A page has only its plain variant.
  expect(variantsOf(by(moves, "open:my-bookings"), now)).toHaveLength(1);
});

test("the coverage walk: the untried first, then the least tried, the same for the same seed", () => {
  const moves = movesFor(ir, auth, "visitor");
  const all = moves.flatMap((m) => variantsOf(m, now));
  const tried: Record<string, number> = {};
  const seen = new Set<string>();
  const rnd = seeded(3);
  for (let i = 0; i < all.length; i++) {
    const next = coverageWalk(moves, tried, rnd, now);
    if (!next) throw new Error("nothing to try");
    expect(seen.has(next.id)).toBe(false);
    seen.add(next.id);
    tried[next.id] = (tried[next.id] ?? 0) + 1;
  }
  expect(seen.size).toBe(all.length);
  // The least tried comes next: everything twice but one, and that one is drawn.
  for (const id of seen) tried[id] = 2;
  const least = all[1] as (typeof all)[number];
  tried[least.id] = 1;
  expect(coverageWalk(moves, tried, rnd, now)?.id).toBe(least.id);
  expect(coverageWalk([], tried, rnd, now)).toBeUndefined();
  expect(coverageWalk(moves, {}, seeded(5), now)).toEqual(coverageWalk(moves, {}, seeded(5), now));
});
