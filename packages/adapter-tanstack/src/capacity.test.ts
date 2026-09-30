import {
  type AuthIR,
  emptyContent,
  type SpecIR,
  validateAuth,
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
      status: confirmed | cancelled
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

test("a capacity is checked in the write's transaction, and the referenced record guards its number", () => {
  const booking = file("src/generated/booking.server.ts");
  expect(booking).toContain("row = db.transaction((tx) => {");
  expect(booking).toContain(
    'eq(bookings.sessionId, values.sessionId), eq(bookings.status, "confirmed")',
  );
  expect(booking).toContain("tx.select({ n: sessions.capacity }).from(sessions)");
  expect(booking).toContain('throw new Conflict("full")');
  expect(booking).toContain("ne(bookings.id, id)");
  expect(booking).toContain("error instanceof Conflict ? error : refusal(error)");
  const session = file("src/generated/session.server.ts");
  expect(session).toContain(
    "if (values.capacity < booked) throw new Conflict(`booked:$" + "{booked}`);",
  );
  expect(session).toContain('eq(bookings.sessionId, id), eq(bookings.status, "confirmed")');
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
  expect(booking).not.toContain("transaction");
  expect(booking).not.toContain("Conflict");
});
