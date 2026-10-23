import { type AuthIR, type SpecIR, validateAuth, validateSpec, validateUx } from "@smithable/core";
import { expect, test } from "vitest";
import { generateApp } from "./generate.js";

// A record's name from its parts (docs/design/record-names.md, step 2): a session named by its
// class type and its start, a booking by its session, and the line a picker shows under a name.
const ir = validateSpec({
  path: "smithable.yml",
  text: `smithable: 0.1
app: { name: Studio }
models:
  ClassType:
    fields:
      name: string!
      level: beginner | advanced
  Instructor:
    fields:
      name: string!
  Session:
    namedBy: [classType, startsAt]
    fields:
      classType: ClassType!
      instructor: Instructor
      startsAt: datetime!
  Booking:
    namedBy: session
    fields:
      session: Session!
outgoing:
  booked:
    when: Booking created
    to: mail
    recipient: admin
pages:
  sessions:
    crud: Session
  bookings:
    crud: Booking
`,
}).ir as SpecIR;
const auth = validateAuth(
  {
    path: "smithable.auth.yml",
    text: "smithableAuth: 0.1\nsignIn: { providers: [email] }\ndefaultAccess: shared\nroles: { admin: {} }\n",
  },
  ir,
).auth as AuthIR;
const ux = validateUx(
  {
    path: "smithable.ux.yml",
    text: "smithableUx: 0.1\npages:\n  sessions:\n    record: { subtitle: instructor.name, detail: [classType.level] }\n",
  },
  ir,
).ux;
const files = generateApp(ir, { smithableVersion: "0.0.0", auth, ux });
const file = (path: string) => files.find((f) => f.path === path)?.content ?? "";

test("a name of parts is a function of its own, composed one reference at a time", () => {
  const session = file("src/generated/session.name.ts");
  expect(session).toContain("export function sessionName(row: Record<string, unknown>): string {");
  expect(session).toContain("shortWhen(row.startsAt, false, app.timeZone)");
  expect(session).toContain("`Session #${row.id}`");
  // The booking is named as its session is.
  const booking = file("src/generated/booking.name.ts");
  expect(booking).toContain('import { sessionName } from "./session.name";');
  // The level's label comes from the model's description, written once there.
  expect(session).toContain('classTypeUi.fields.find((f) => f.name === "level")');
  // A model named by one stored text field has no name module: its title column, as before.
  expect(files.some((f) => f.path === "src/generated/class-type.name.ts")).toBe(false);
});

test("the data functions load what the name needs and set it on what the viewer may read", () => {
  const booking = file("src/generated/booking.server.ts");
  expect(booking).toContain(
    "session: { columns: { id: true, startsAt: true }, with: { classType: { columns: { id: true, name: true } } } }",
  );
  // After the references the viewer may not read are hidden, a session is shown as its own
  // model shows it (its class type hidden there too), and the booking named from that.
  expect(booking).toContain(
    "const shown = { ...row, session: row.session ? sessionData.shownRefs(viewer, [row.session as Record<string, unknown>])[0] : row.session };",
  );
  expect(booking).toContain("return { ...shown, $name: bookingName(shown) } as R;");
  // The picker's choices pass through the same hiding.
  expect(file("src/generated/session.server.ts")).toContain(
    "const rows = sessionData.shownRefs(viewer, await db.query.sessions.findMany(",
  );
  // The kit reads the composed name under $name.
  expect(file("src/generated/booking.ts")).toContain('titleField: "$name"');
});

test("the picker's choices are named by their parts, with the page's subtitle under each", () => {
  const session = file("src/generated/session.server.ts");
  expect(session).toContain("async options(viewer: Viewer | null) {");
  expect(session).toContain("label: sessionName(row)");
  expect(session).toContain("detail: sessionLines(row).subtitle");
  expect(file("src/generated/session.name.ts")).toContain(
    "subtitle: titleOf((row.instructor as Record<string, unknown> | null | undefined)?.name) || undefined,",
  );
});

test("a mail and the record's page say the name", () => {
  const outgoing = file("src/generated/outgoing.server.ts");
  expect(outgoing).toContain("subject: `Booking: ${bookingNamed(tx, r.id as number)}`");
  expect(outgoing).toContain("function bookingNamed(tx: Tx, id: number | null): string {");
  expect(file("src/routes/sessions/$id.tsx")).toContain(
    "sessionName(row as Record<string, unknown>)",
  );
});

// A parent named on its child's page, and a part in the trash (the follow-ups of record-names.md's step 2).
test("a line back to a parent is loaded, and a trashed part sorts as empty", () => {
  const more = validateSpec({
    path: "smithable.yml",
    text: `smithable: 0.1
app: { name: Desk }
models:
  Venue:
    trash: true
    fields:
      name: string!
  Ticket:
    namedBy: [venue, title]
    fields:
      venue: Venue
      title: string
      tasks: Task[]
  Task:
    fields:
      title: string!
      ticket: Ticket!
pages:
  tickets:
    crud: Ticket
  tasks:
    crud: Task
`,
  }).ir as SpecIR;
  const moreUx = validateUx(
    {
      path: "smithable.ux.yml",
      text: "smithableUx: 0.1\npages:\n  tasks:\n    record: { subtitle: ticket.title }\n",
    },
    more,
  ).ux;
  const out = generateApp(more, { smithableVersion: "0.0.0", auth, ux: moreUx });
  const of = (path: string) => out.find((f) => f.path === path)?.content ?? "";
  const ticket = of("src/generated/ticket.server.ts");
  // A task's line reads its ticket, so a ticket's page loads its tasks' tickets back.
  expect(ticket).toContain(
    "tasks: { where: taskData.readable(viewer), with: { ticket: { columns: { id: true, title: true }",
  );
  // The picker sorts by the venue's name only while the venue is out of the trash.
  expect(ticket).toContain(
    "first: row.venue && !row.venue.deletedAt ? (row.venue.name ?? null) : null",
  );
});

test("a search finds a record by the words of its name, through its references", () => {
  // Ask reads a page at a time, so the data functions search.
  const asked = validateAuth(
    {
      path: "smithable.auth.yml",
      text: "smithableAuth: 0.1\nsignIn: { providers: [email] }\ndefaultAccess: shared\nroles: { admin: {} }\nassistant: { for: signed-in }\n",
    },
    ir,
  ).auth as AuthIR;
  const out = generateApp(ir, { smithableVersion: "0.0.0", auth: asked, ux });
  const file = (path: string) => out.find((f) => f.path === path)?.content ?? "";
  // A session by its class type's name, among the class types the viewer may read.
  expect(file("src/generated/session.server.ts")).toContain(
    "...wordsOf(search).map((word) => inArray(schema.sessions.classTypeId, db.select({ id: schema.classTypes.id }).from(schema.classTypes).where(and(contains([schema.classTypes.name], word), classTypeData.readable(viewer))))),",
  );
  // A booking named by its session: by the session's own parts, each among what the viewer may read.
  expect(file("src/generated/booking.server.ts")).toContain(
    "...wordsOf(search).map((word) => inArray(schema.bookings.sessionId, db.select({ id: schema.sessions.id }).from(schema.sessions).where(and(inArray(schema.sessions.classTypeId, db.select({ id: schema.classTypes.id }).from(schema.classTypes).where(and(contains([schema.classTypes.name], word), classTypeData.readable(viewer)))), sessionData.readable(viewer))))),",
  );
  // A part read through a reference searches that field, out of the trash.
  const venues = validateSpec({
    path: "smithable.yml",
    text: "smithable: 0.1\napp: { name: Desk }\nmodels:\n  Venue:\n    trash: true\n    fields:\n      name: string!\n      city: string\n      where: { type: string, formula: 'CONCAT(name, \" \", city)' }\n  Gig:\n    namedBy: [venue.city, venue.where, day]\n    fields:\n      venue: Venue!\n      day: date!\npages:\n  gigs:\n    crud: Gig\n",
  }).ir as SpecIR;
  const gig = generateApp(venues, { smithableVersion: "0.0.0", auth: asked, ux }).find(
    (f) => f.path === "src/generated/gig.server.ts",
  )?.content;
  expect(gig).toContain(
    "...wordsOf(search).map((word) => inArray(schema.gigs.venueId, db.select({ id: schema.venues.id }).from(schema.venues).where(and(contains([schema.venues.city], word), venueData.readable(viewer), isNull(schema.venues.deletedAt))))),",
  );
  // A computed part is not in the table, so it is not searched; a venue's own list searches its
  // stored texts once.
  expect(gig).not.toContain("schema.venues.where");
  const venue = generateApp(venues, { smithableVersion: "0.0.0", auth: asked, ux }).find(
    (f) => f.path === "src/generated/venue.server.ts",
  )?.content;
  expect(venue).toContain(
    "...wordsOf(search).map((word) => contains([schema.venues.name, schema.venues.city], word)),",
  );
});
