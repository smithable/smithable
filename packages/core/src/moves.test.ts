import { expect, test } from "vitest";
import { type AuthIR, validateAuth } from "./auth.js";
import type { SpecIR } from "./ir.js";
import { type Move, movesFor, seeded, valueFor, walk } from "./moves.js";
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
