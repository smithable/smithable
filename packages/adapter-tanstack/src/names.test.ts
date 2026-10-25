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
  schedule:
    calendar: { model: Session }
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
  expect(session).toContain(
    "export function sessionName(row: Record<string, unknown>, leave: readonly string[] = []): string {",
  );
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
    "subtitle: (titleOf((row.instructor as Record<string, unknown> | null | undefined)?.name)) || undefined,",
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

test("Ask names a record of parts, and a reference to one, as its page does", () => {
  const asked = validateAuth(
    {
      path: "smithable.auth.yml",
      text: "smithableAuth: 0.1\nsignIn: { providers: [email] }\ndefaultAccess: shared\nroles: { admin: {} }\nassistant: { for: signed-in }\n",
    },
    ir,
  ).auth as AuthIR;
  const ask =
    generateApp(ir, { smithableVersion: "0.0.0", auth: asked, ux }).find(
      (f) => f.path === "src/generated/ask.server.ts",
    )?.content ?? "";
  expect(ask).toContain(
    'Booking: { data: bookingData, toApi: bookingToApi, fromApi: bookingFromApi, title: "$name", refs: {"session":"$name"}',
  );
  expect(ask).toContain('if (field === "$name") return row.$name ?? null;');
  // Its sentences to a person say "name", never the key.
  expect(ask).toContain(
    'const titleWord = (kind: Kind) => (kind.title === "$name" ? "name" : kind.title);',
  );
  expect(ask).not.toContain("Give its whole ${kind.title}");
});

test("a calendar names a record without the start it is placed by", () => {
  expect(file("src/generated/session.name.ts")).toContain(
    "export function sessionName(row: Record<string, unknown>, leave: readonly string[] = []): string {",
  );
  expect(files.find((f) => f.path === "src/routes/schedule/index.tsx")?.content).toContain(
    'title: sessionName(row as Record<string, unknown>, ["startsAt"]),',
  );
});

test("a reference as the subtitle is bracketed before its fallback, so the app type-checks", () => {
  const byReference = validateUx(
    {
      path: "smithable.ux.yml",
      text: "smithableUx: 0.1\npages:\n  sessions:\n    record: { subtitle: instructor }\n",
    },
    ir,
  ).ux;
  const lines =
    generateApp(ir, { smithableVersion: "0.0.0", auth, ux: byReference }).find(
      (f) => f.path === "src/generated/session.name.ts",
    )?.content ?? "";
  // A reference's part is a ternary: without the brackets `|| undefined` binds to its "" arm.
  expect(lines).toMatch(/subtitle: \(\(row\.instructor .*\) \|\| undefined,/);
});

test("a subtitle alone imports only what it uses, so the app type-checks", () => {
  const speakers = validateSpec({
    path: "smithable.yml",
    text: "smithable: 0.1\napp: { name: Talks }\nmodels:\n  Speaker:\n    fields: { name: string!, company: string, bio: markdown }\npages:\n  speakers: { crud: Speaker }\n",
  }).ir as SpecIR;
  const ux = validateUx(
    {
      path: "smithable.ux.yml",
      text: "smithableUx: 0.1\npages:\n  speakers:\n    record: { subtitle: company }\n",
    },
    speakers,
  ).ux;
  const lines =
    generateApp(speakers, { smithableVersion: "0.0.0", auth, ux }).find(
      (f) => f.path === "src/generated/speaker.name.ts",
    )?.content ?? "";
  // No name of parts and no detail: nameOf has nothing to join.
  expect(lines).toContain("subtitle: (titleOf(row.company)) || undefined,");
  expect(lines).toContain('import { titleOf } from "#/kit/format";');
});

test("a record page named by its parts does not import titleOf, and an owner by ME() is set once", () => {
  const spec = validateSpec({
    path: "smithable.yml",
    text: `smithable: 0.1
app: { name: Birds }
models:
  Sighting:
    namedBy: [species, seenOn]
    ownedBy: observer
    fields:
      notes: text!
      species: string!
      seenOn: date!
      observer: User! = ME()
pages:
  sightings: { crud: Sighting }
`,
  }).ir as SpecIR;
  const out = generateApp(spec, { smithableVersion: "0.0.0", auth });
  const of = (path: string) => out.find((f) => f.path === path)?.content ?? "";
  const route = of("src/routes/sightings/$id.tsx");
  // The heading is the name function's: titleOf is imported only where it is written.
  expect(route).toContain("sightingName(row as Record<string, unknown>)");
  expect(route.includes("titleOf")).toBe(false);
  // ownerFor sets the owner (falling back to the viewer); ME() does not write it a second time.
  const data = of("src/generated/sighting.server.ts");
  expect(data).toContain("observerId: ownerFor(viewer, values.observerId)");
  expect(data).not.toContain("observerId: values.observerId ?? personOf(viewer)");
});

test("a conversation without a reply box has its Add button as JSX, not as text", () => {
  const desk = validateSpec({
    path: "smithable.yml",
    text: "smithable: 0.1\napp: { name: Status }\nmodels:\n  Incident:\n    fields: { title: string!, updates: 'IncidentUpdate[]' }\n  IncidentUpdate:\n    fields: { at: datetime!, message: text!, incident: Incident! }\npages:\n  incidents: { crud: Incident }\n  incidentUpdates: { crud: IncidentUpdate }\n",
  }).ir as SpecIR;
  const ux = validateUx(
    {
      path: "smithable.ux.yml",
      text: "smithableUx: 0.1\npages:\n  incidents:\n    record:\n      lists: { updates: thread }\n",
    },
    desk,
  ).ux;
  const route =
    generateApp(desk, { smithableVersion: "0.0.0", auth, ux }).find(
      (f) => f.path === "src/routes/incidents/$id.tsx",
    )?.content ?? "";
  expect(route).toContain("{canAdd?.updates && (");
  expect(route).not.toMatch(/\n\s+canAdd\?\.updates && \(/);
});

test("a record's rules write was and next only where a line reads them, so the app type-checks", () => {
  const spec = validateSpec({
    path: "smithable.yml",
    text: `smithable: 0.1
app: { name: Tools }
models:
  Tool:
    fields:
      name: string!
      available: bool
      borrower: { type: User, locked: { available: false } }
  Stamp:
    fields:
      code: { type: string, locked: true }
  Order:
    fields:
      status: draft | placed
      placedAt: { type: date, required: { status: placed } }
pages:
  tools: { crud: Tool }
  stamps: { crud: Stamp }
  orders: { crud: Order }
`,
  }).ir as SpecIR;
  const out = generateApp(spec, { smithableVersion: "0.0.0", auth });
  const of = (name: string) =>
    out.find((f) => f.path === `src/generated/${name}.server.ts`)?.content ?? "";
  // A lock with a condition reads the record as it was; nothing reads what it becomes.
  expect(of("tool")).toContain("const was: Record<string, unknown> = before;");
  expect(of("tool")).not.toContain("const next: Record<string, unknown>");
  // A lock that always holds reads neither.
  expect(of("stamp")).not.toContain("const was: Record<string, unknown>");
  // A field required in a state reads what the record becomes.
  expect(of("order")).toContain("const next: Record<string, unknown> = { ...was, ...given };");
});
