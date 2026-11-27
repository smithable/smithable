import { expect, test } from "vitest";
import { validateContent } from "./content.js";
import type { SpecIR } from "./ir.js";
import { fitSamples, validateSamples } from "./samples.js";
import { validateSpec } from "./spec.js";

const ir = validateSpec({
  path: "smithable.yml",
  text: `smithable: 0.1
app: { name: Studio }
models:
  Instructor:
    fields: { name: string!, bio: text }
  ClassType:
    fields:
      name: string!
      level: all | beginner | advanced
      price: money
      instructor: Instructor
      photo: picture
  Session:
    fields: { classType: ClassType!, startsAt: datetime!, day: date }
pages:
  classes: { crud: ClassType }
`,
}).ir;
if (!ir) throw new Error("the spec is invalid");
const content = validateContent(
  {
    path: "smithable.content.yml",
    text: "smithableContent: 0.1\nmodels:\n  ClassType:\n    fields:\n      level: { values: { all: All levels } }\n",
  },
  ir,
).content;

const check = (files: Record<string, string>) =>
  validateSamples(
    Object.entries(files).map(([path, text]) => ({ path, text })),
    ir,
    content,
  );

test("a model's records: references by title, choices by label, money in cents, pictures by file", () => {
  const { samples, diagnostics } = check({
    "samples/Instructor.yml": "- { name: Emma Lind, bio: Teaches calm. }\n- name: Oskar Berg\n",
    "samples/ClassType.yml": `- name: Hatha
  level: All levels
  price: 16.5
  instructor: Oskar Berg
  photo: { file: hatha.webp, alt: A class stretching }
- { name: Yin, level: beginner, photo: yin.webp }
`,
    "samples/Session.yml": "- { classType: Yin, startsAt: 2026-10-05 08:00, day: 2026-10-05 }\n",
  });
  expect(diagnostics).toEqual([]);
  expect(samples.ClassType).toEqual([
    {
      name: "Hatha",
      level: "all",
      price: 1650,
      instructor: 2,
      photo: { picture: "hatha.webp", alt: "A class stretching" },
    },
    { name: "Yin", level: "beginner", photo: { picture: "yin.webp", alt: "A picture of Yin" } },
  ]);
  expect(samples.Session).toEqual([
    { classType: 2, startsAt: "2026-10-05T08:00", day: "2026-10-05" },
  ]);
});

test("a sample naming a field or model that is gone warns and is left out, never blocks", () => {
  const stale = check({
    "samples/Teacher.yml": "- { name: A }\n",
    "samples/Instructor.yml": "- { name: Emma, age: 3 }\n",
  });
  expect(stale.diagnostics.map((d) => d.severity)).toEqual(["warning", "warning"]);
  expect(stale.samples.Instructor).toEqual([{ name: "Emma" }]);
});

test("mistakes are reported where they are: model, field, kind, required, reference", () => {
  const messages = (files: Record<string, string>) =>
    check(files).diagnostics.map((d) => d.message);
  expect(messages({ "samples/Teacher.yml": "- { name: A }\n" })[0]).toContain(
    'There is no model "Teacher"',
  );
  expect(messages({ "samples/Instructor.yml": "- { name: A, age: 3 }\n" })[0]).toContain(
    'Instructor has no field "age"',
  );
  expect(messages({ "samples/ClassType.yml": "- { name: A, price: cheap }\n" })[0]).toContain(
    '"price" of ClassType is an amount',
  );
  expect(messages({ "samples/Instructor.yml": "- { bio: Calm. }\n" })[0]).toContain(
    'Record 1 of Instructor needs "name"',
  );
  expect(
    messages({
      "samples/Instructor.yml": "- { name: Emma Lind }\n",
      "samples/ClassType.yml": "- { name: A, instructor: Emma Lindh }\n",
    })[0],
  ).toContain('samples/Instructor.yml has no record called "Emma Lindh"');
  // A wrong value is one problem, not also a missing field.
  expect(
    check({
      "samples/ClassType.yml": "- { name: Yin }\n",
      "samples/Session.yml": "- { classType: Yinn, startsAt: 2026-10-05 08:00 }\n",
    }).diagnostics,
  ).toHaveLength(1);
  // Without the referenced model's file, a generated record by its number.
  expect(messages({ "samples/ClassType.yml": "- { name: A, instructor: Emma }\n" })[0]).toContain(
    "Instructor has no samples/Instructor.yml; refer to a generated instructor by its number",
  );
  expect(check({ "samples/ClassType.yml": "- { name: A, instructor: 2 }\n" }).diagnostics).toEqual(
    [],
  );
  const where = check({ "samples/Instructor.yml": "- name: A\n  age: 3\n" }).diagnostics[0];
  expect([where?.line, where?.column]).toEqual([2, 3]);
});

test("several pictures as a list, a number within the file's records, no people who sign in", () => {
  const spec = validateSpec({
    path: "smithable.yml",
    text: `smithable: 0.1
app: { name: Market }
models:
  Seller:
    fields: { name: string! }
  Item:
    fields:
      title: string!
      photos: pictures
      seller: Seller
      owner2: User
pages:
  items: { crud: Item }
`,
  }).ir;
  if (!spec) throw new Error("the spec is invalid");
  const run = (items: string) =>
    validateSamples(
      [
        { path: "samples/Seller.yml", text: "- { name: Ada }\n- { name: Bo }\n" },
        { path: "samples/Item.yml", text: items },
      ],
      spec,
    );
  const ok = run(
    "- { title: Bike, photos: [a.webp, { file: b.webp, alt: The back wheel }], seller: 2 }\n",
  );
  expect(ok.diagnostics).toEqual([]);
  expect(ok.samples.Item?.[0]?.photos).toEqual([
    { picture: "a.webp", alt: "A picture of Bike" },
    { picture: "b.webp", alt: "The back wheel" },
  ]);
  // A picture an AI made says so, for the app's mark on it.
  const made = run("- { title: Bike, photos: [{ file: c.webp, alt: A bike, generated: true }] }\n");
  expect(made.samples.Item?.[0]?.photos).toEqual([
    { picture: "c.webp", alt: "A bike", generated: true },
  ]);
  expect(
    run("- { title: Bike, photos: [{ file: c.webp, alt: A bike, generated: maybe }] }\n")
      .diagnostics,
  ).not.toEqual([]);
  // And its kind (picture-kinds.md §2), which the badge's default follows.
  const drawn = run(
    "- { title: Bike, photos: [{ file: c.webp, alt: A bike, generated: true, kind: ai-drawn }] }\n",
  );
  expect(drawn.samples.Item?.[0]?.photos).toEqual([
    { picture: "c.webp", alt: "A bike", generated: true, kind: "ai-drawn" },
  ]);
  expect(
    run("- { title: Bike, photos: [{ file: c.webp, alt: A bike, kind: sketch }] }\n").diagnostics,
  ).not.toEqual([]);
  const messages = (items: string) => run(items).diagnostics.map((d) => d.message);
  const eleven = Array.from({ length: 11 }, (_, i) => `p${i}.webp`).join(", ");
  expect(messages(`- { title: Bike, photos: [${eleven}] }\n`)[0]).toContain("at most 10 pictures");
  expect(messages("- { title: Bike, seller: 3 }\n")[0]).toContain(
    "samples/Seller.yml has 2 records, not 3",
  );
  expect(messages("- { title: Bike, owner2: Ada }\n")[0]).toContain(
    "a person who signs in; leave it empty",
  );
});

test("a starter's samples are fitted to an app drafted from it", () => {
  const draft = validateSpec({
    path: "smithable.yml",
    text: `smithable: 0.1
app: { name: Status }
models:
  Service:
    fields: { name: string!, state: operational | outage }
  Incident:
    fields:
      title: string!
      status: investigating | resolved
      service: Service
      severity: low | high
pages:
  incidents: { crud: Incident }
  services: { crud: Service }
`,
  }).ir as SpecIR;
  const fitted = fitSamples(
    [
      {
        path: "samples/Service.yml",
        text: "# the services\n- name: Website\n  state: operational\n  uptime: 99.9\n- name: API\n  state: degraded\n",
      },
      {
        path: "samples/Incident.yml",
        text: "- title: Website down\n  status: resolved\n  service: Website\n  resolvedAt: 2026-09-24 09:01\n- title: API slow\n  status: investigating\n  service: API\n- title: Checkout slow\n  status: monitoring\n",
      },
      { path: "samples/Maintenance.yml", text: "- title: Database upgrade\n" },
    ],
    draft,
  );
  // The model that went is left out; a field that went is dropped; a record whose value no
  // longer exists goes, and with it the record that referred to it.
  expect(fitted.map((f) => f.path)).toEqual(["samples/Service.yml", "samples/Incident.yml"]);
  expect(fitted[0]?.text).toBe("- name: Website\n  state: operational\n");
  expect(fitted[1]?.text).toBe("- title: Website down\n  status: resolved\n  service: Website\n");
  expect(validateSamples(fitted, draft).diagnostics).toEqual([]);
});

test("a record may name a sample user as its owner, where people sign in (T1704)", () => {
  const people = [
    { name: "Maja", role: "member", persona: "Books a class.", pace: 1 },
    { name: "Ola", role: "visitor", persona: "Looks.", pace: 1 },
  ];
  const signedIn = { signIn: { providers: ["email"] } } as unknown as { signIn: "none" };
  const owned = (text: string, auth: { signIn: "none" } = signedIn) =>
    validateSamples([{ path: "samples/Instructor.yml", text }], ir, content, { people, auth });
  const ok = owned("- { name: Emma, owner: Maja }\n");
  expect(ok.diagnostics).toEqual([]);
  expect(ok.samples.Instructor?.[0]).toEqual({ name: "Emma", "@owner": "Maja" });
  const said = (text: string, auth?: { signIn: "none" }) =>
    owned(text, auth).diagnostics.map((d) => d.message);
  expect(said("- { name: Emma, owner: Maia }\n")[0]).toBe(
    'Record 1 of Instructor is owned by "Maia", who is not a sample user of samples/people.yml.',
  );
  expect(said("- { name: Emma, owner: Ola }\n")[0]).toContain("a visitor, who has no account");
  expect(said("- { name: Emma, owner: Maja }\n", { signIn: "none" })[0]).toContain(
    "nobody signs in to this app",
  );
  // An address-owned model: the owner's address fills its required field.
  const byAddress = validateSpec({
    path: "smithable.yml",
    text: "smithable: 0.1\napp: { name: Studio }\nmodels:\n  Request:\n    fields: { title: string!, email: email! }\n    ownedBy: email\npages:\n  requests: { crud: Request }\n",
  }).ir;
  if (!byAddress) throw new Error("the spec is invalid");
  expect(
    validateSamples(
      [{ path: "samples/Request.yml", text: "- { title: Mats, owner: Maja }\n" }],
      byAddress,
      undefined,
      {
        people,
        auth: signedIn,
      },
    ).diagnostics,
  ).toEqual([]);
  // Without the sample users given, an owner is said, never dropped in silence.
  expect(
    check({ "samples/Instructor.yml": "- { name: Emma, owner: Maja }\n" }).diagnostics,
  ).toHaveLength(1);
});

test("a model with places is seeded within them: the maximum known, never past it (T1704)", () => {
  const spec = validateSpec({
    path: "smithable.yml",
    text: `smithable: 0.1
app: { name: Studio }
models:
  Session:
    fields: { title: string!, capacity: int! = 1 }
  Booking:
    fields: { session: Session!, note: text }
    capacity: { per: session, max: session.capacity }
  Seat:
    fields: { session: Session! }
    capacity: { per: session, max: 1 }
pages:
  bookings: { crud: Booking }
`,
  }).ir;
  if (!spec) throw new Error("the spec is invalid");
  const said = (files: Record<string, string>) =>
    validateSamples(
      Object.entries(files).map(([path, text]) => ({ path, text })),
      spec,
    ).diagnostics.map((d) => d.message);
  const sessions = "- { title: Yoga, capacity: 2 }\n- { title: Pilates }\n";
  expect(
    said({
      "samples/Session.yml": sessions,
      "samples/Booking.yml": "- { session: Yoga }\n- { session: Yoga }\n- { session: Pilates }\n",
    }),
  ).toEqual([]);
  expect(
    said({
      "samples/Session.yml": sessions,
      "samples/Booking.yml": "- { session: Pilates }\n- { session: Pilates }\n",
    }),
  ).toEqual(["Record 2 of Booking is one more than the 1 session 2 takes."]);
  expect(said({ "samples/Seat.yml": "- { session: 1 }\n- { session: 1 }\n" })).toEqual([
    "Record 2 of Seat is one more than the 1 session 1 takes.",
  ]);
  // A record the capacity's `where` leaves out takes no place.
  const counted = validateSpec({
    path: "smithable.yml",
    text: `smithable: 0.1
app: { name: Studio }
models:
  Session:
    fields: { title: string! }
  Seat:
    fields: { session: Session!, status: active | cancelled }
    capacity: { per: session, max: 1, where: { status: active } }
pages:
  seats: { crud: Seat }
`,
  }).ir;
  if (!counted) throw new Error("the spec is invalid");
  const seats = (text: string) =>
    validateSamples(
      [
        { path: "samples/Session.yml", text: "- { title: Yoga }\n" },
        { path: "samples/Seat.yml", text },
      ],
      counted,
    ).diagnostics.map((d) => d.message);
  expect(
    seats("- { session: Yoga, status: cancelled }\n- { session: Yoga, status: active }\n"),
  ).toEqual([]);
  expect(
    seats("- { session: Yoga, status: active }\n- { session: Yoga, status: active }\n"),
  ).toHaveLength(1);
  // A generated session: how many it takes is not known, so no booking is.
  expect(said({ "samples/Booking.yml": "- { session: 1 }\n" })[0]).toContain(
    "Record 1 of Booking: how many bookings session 1 takes is not in the samples",
  );
});

test("a resource's time is taken once by the samples, with its gap, where the seed puts it (T1712)", () => {
  const spec = (calendar: string) =>
    validateSpec({
      path: "smithable.yml",
      text: `smithable: 0.1
app: { name: Cuts }
models:
  Service:
    fields: { name: string!, minutes: int! = 30 }
  Barber:
    fields: { name: string! }
    schedule: { hours: { mon-sat: "09:00-17:00" }, gap: 10 }
  Appointment:
    fields: { service: Service!, barber: Barber!, startsAt: datetime!, status: requested | confirmed | cancelled }
    occupies: { resource: barber, starts: startsAt, duration: service.minutes, while: { status: [requested, confirmed] } }
pages:
  ${calendar}
`,
    }).ir;
  const said = (
    ir: ReturnType<typeof spec>,
    appointments: string,
    services = "- { name: Cut }\n",
  ) => {
    if (!ir) throw new Error("the spec is invalid");
    return validateSamples(
      [
        ...(services ? [{ path: "samples/Service.yml", text: services }] : []),
        { path: "samples/Barber.yml", text: "- { name: Ola }\n- { name: Pia }\n" },
        { path: "samples/Appointment.yml", text: appointments },
      ],
      ir,
    ).diagnostics.map((d) => d.message);
  };
  const plain = spec("appointments: { crud: Appointment }");
  const row = (barber: string, at: string, status = "confirmed") =>
    `- { service: Cut, barber: ${barber}, startsAt: ${at}, status: ${status} }\n`;
  // Another barber, the end of the gap, or a cancelled one: free.
  expect(
    said(
      plain,
      row("Ola", "2026-09-29 10:00") +
        row("Pia", "2026-09-29 10:00") +
        row("Ola", "2026-09-29 10:40") +
        row("Ola", "2026-09-29 10:10", "cancelled"),
    ),
  ).toEqual([]);
  expect(said(plain, row("Ola", "2026-09-29 10:00") + row("Ola", "2026-09-29 10:35"))).toEqual([
    "Record 2 of Appointment takes barber 1's time while record 1 does (with the 10 minutes kept free after each).",
  ]);
  // A length from a generated service is not known.
  expect(said(plain, row("Ola", "2026-09-29 10:00").replace("Cut", "1"), "")).toEqual([
    "Record 1 of Appointment: how long it takes (service.minutes) is not in the samples; give the record it names a sample minutes.",
  ]);
  // A service that is not there is said once, by the reference's own check.
  const wrong = said(plain, row("Ola", "2026-09-29 10:00").replace("Cut", "Perm"));
  expect(wrong.length).toBe(1);
  expect(wrong[0]).not.toContain("how long");
  // On a calendar the seed moves rows to this week (1st, 3rd, …) or the next on the same weekday:
  // two Tuesdays a week apart meet when both land in the same week.
  const moved = spec("diary: { calendar: { model: Appointment, starts: startsAt } }");
  const tuesdays =
    row("Ola", "2026-09-29 10:00") +
    row("Ola", "2026-10-06 10:00") +
    row("Ola", "2026-10-13 10:00");
  expect(said(moved, tuesdays)).toEqual([
    "Record 3 of Appointment takes barber 1's time while record 1 does (with the 10 minutes kept free after each).",
  ]);
  expect(said(plain, tuesdays)).toEqual([]);
});
