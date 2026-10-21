import {
  type AuthIR,
  emptyContent,
  type SpecIR,
  validateAuth,
  validateContent,
  validateSpec,
} from "@smithable/core";
import { expect, test } from "vitest";
import { generateApp } from "./generate.js";

const spec = `smithable: 0.1
app: { name: Studio }
models:
  Session:
    fields:
      startsAt: datetime!
      capacity: int! = 12
      bookings: Booking[]
  Booking:
    fields:
      session: Session! unique
      status: confirmed | canceled
    capacity: { per: session, max: session.capacity, where: { status: confirmed } }
pages:
  sessions: { crud: Session }
  bookings: { crud: Booking }
`;
const ir = validateSpec({ path: "smithable.yml", text: spec }).ir as SpecIR;
const auth = validateAuth(
  {
    path: "smithable.auth.yml",
    text: "smithableAuth: 0.1\nsignIn: { providers: [google] }\ndefaultAccess: private\n",
  },
  ir,
).auth as AuthIR;
const files = generateApp(ir, { smithableVersion: "0.0.0", auth, content: emptyContent() });
const file = (path: string) => files.find((f) => f.path === path)?.content ?? "";

test("the deadlines are read from the referenced record in the write's transaction; staff pass", () => {
  const timed = validateSpec({
    path: "smithable.yml",
    text: spec.replace(
      "capacity: { per: session, max: session.capacity, where: { status: confirmed } }",
      "capacity: { per: session, max: session.capacity, closes: 2 hours before session.startsAt, cancelUntil: session.startsAt }",
    ),
  }).ir as SpecIR;
  const made = generateApp(timed, { smithableVersion: "0.0.0", auth, content: emptyContent() });
  const booking = made.find((f) => f.path === "src/generated/booking.server.ts")?.content ?? "";
  expect(booking).toContain("if (!(viewer && bookingAccess.write.roles.includes(viewer.role))) {");
  expect(booking).toContain("return at ? new Date(at.getTime() - 7200000) : undefined;");
  expect(booking).toContain('throw new Conflict("closed")');
  expect(booking).toContain("if (!(viewer && bookingAccess.delete.roles.includes(viewer.role))) {");
  expect(booking).toContain("return at ? new Date(at.getTime() - 0) : undefined;");
  expect(booking).toContain('throw new Conflict("cancel-closed")');
  // The places tell the block the deadlines.
  const module = made.find((f) => f.path === "src/generated/booking.ts")?.content ?? "";
  expect(module).toContain("closesAt: closesAt?.toISOString() ?? null,");
  // Without deadlines nothing of it is written.
  expect(file("src/generated/booking.server.ts")).not.toContain('Conflict("closed")');
});

test("a capacity is checked in the write's transaction, and the referenced record guards its number", () => {
  const booking = file("src/generated/booking.server.ts");
  expect(booking).toContain("row = db.transaction((tx) => {");
  expect(booking).toContain(
    'eq(schema.bookings.sessionId, values.sessionId), eq(schema.bookings.status, "confirmed")',
  );
  expect(booking).toContain("tx.select({ n: schema.sessions.capacity }).from(schema.sessions)");
  expect(booking).toContain('throw new Conflict("full")');
  expect(booking).toContain("ne(schema.bookings.id, id)");
  expect(booking).toContain("error instanceof Conflict ? error : refusal(error)");
  const session = file("src/generated/session.server.ts");
  expect(session).toContain(
    "if (values.capacity < booked) throw new Conflict(`booked:$" + "{booked}`);",
  );
  expect(session).toContain(
    'eq(schema.bookings.sessionId, id), eq(schema.bookings.status, "confirmed")',
  );
  // With a where, the generated access test leaves the capacity case out (its values may not count).
  expect(file("src/generated/access.test.ts")).not.toContain("a capacity:");
});

test("without a capacity nothing of it is generated", () => {
  const plain = validateSpec({
    path: "smithable.yml",
    text: spec.replace(/\n {4}capacity: \{.*\n/, "\n"),
  }).ir as SpecIR;
  const app = generateApp(plain, { smithableVersion: "0.0.0", auth, content: emptyContent() });
  const booking = app.find((f) => f.path === "src/generated/booking.server.ts")?.content ?? "";
  // Every write has its transaction (for its audit line); the capacity's count is not in it.
  expect(booking).not.toContain("tx.select({ n: sessions.capacity })");
  expect(booking).not.toContain('Conflict("full")');
});

test("the reservation block: a session's page books and cancels through the data functions; no sample places", () => {
  // Numbers only, never whose: the places counted over every booking, and the viewer's own.
  const data = file("src/generated/booking.server.ts");
  expect(data).toContain(
    "places(sessionId: number): { taken: number; max: number; closesAt?: Date; cancelUntilAt?: Date }",
  );
  expect(data).toContain('eq(schema.bookings.status, "confirmed")');
  expect(data).toContain("mine(viewer: Viewer, sessionId: number)");
  const module = file("src/generated/booking.ts");
  expect(module).toContain("export const bookingPlaces = createServerFn()");
  expect(module).toContain("if (!sessionData.canRead(viewer, id)) return null;");
  expect(module).toContain(
    "bookingData.create(await writer(), { sessionId: id } as BookingValues)",
  );
  const page = file("src/routes/sessions/$id.tsx");
  expect(page).toContain(
    "<Reserve id={row.id} load={bookingPlaces} book={reserveBooking} cancel={deleteBooking} />",
  );
  expect(files.some((f) => f.path === "src/kit/Reserve.tsx")).toBe(true);
  expect(file("src/db/seed.ts")).not.toContain("db.insert(bookings)");
});

test("without sign-in there is no one to book: no block and no kit file", () => {
  const none = validateAuth(
    { path: "smithable.auth.yml", text: "smithableAuth: 0.1\nsignIn: none\n" },
    ir,
  ).auth as AuthIR;
  const open = generateApp(ir, { smithableVersion: "0.0.0", auth: none, content: emptyContent() });
  expect(open.some((f) => f.path === "src/kit/Reserve.tsx")).toBe(false);
  expect(open.find((f) => f.path === "src/routes/sessions/$id.tsx")?.content).not.toContain(
    "Reserve",
  );
});

test("the block's words come from the content file", () => {
  const content = validateContent(
    {
      path: "smithable.content.yml",
      text: "smithableContent: 0.1\nmodels:\n  Booking:\n    reserve: { book: Book a mat, full: No mats left }\n",
    },
    ir,
  ).content;
  const app = generateApp(ir, { smithableVersion: "0.0.0", auth, content });
  expect(app.find((f) => f.path === "src/routes/sessions/$id.tsx")?.content).toContain(
    'cancel={deleteBooking} bookLabel="Book a mat" fullLabel="No mats left" />',
  );
});
