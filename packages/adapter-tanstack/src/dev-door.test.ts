import {
  type AuthIR,
  emptyContent,
  type SpecIR,
  validateAuth,
  validatePeople,
  validateSpec,
} from "@smithable/core";
import { expect, test } from "vitest";
import { generateApp } from "./generate.js";

// The development door for sample users (docs/design/sample-users.md §4–§5).
const spec = validateSpec({
  path: "smithable.yml",
  text: "smithable: 0.1\napp: { name: Studio }\nmodels:\n  Session:\n    fields: { title: string!, startsAt: datetime! }\n  Booking:\n    fields: { session: Session!, note: text }\nactions:\n  tag:\n    custom: true\n    input: { sessions: 'Session[]', label: string }\npages:\n  sessions: { crud: Session, actions: [tag] }\n  bookings: { crud: Booking }\n",
}).ir as SpecIR;
const auth = validateAuth(
  {
    path: "smithable.auth.yml",
    text: "smithableAuth: 0.1\nsignIn: { providers: [email] }\ndefaultAccess: shared\nroles: { admin: {}, member: { pages: all } }\n",
  },
  spec,
).auth as AuthIR;
const people = validatePeople(
  {
    path: "samples/people.yml",
    text: "- name: Åsa Öberg\n  role: member\n  persona: Books every Tuesday.\n- name: Front desk\n  role: admin\n  persona: Adds next week's sessions.\n",
  },
  auth,
).people;

const out = generateApp(spec, {
  smithableVersion: "0.0.0",
  auth,
  content: emptyContent(),
  ...(people ? { people } : {}),
});
const of = (path: string) => out.find((f) => f.path === path)?.content ?? "";

test("sample users are seeded as development users with plain addresses, and listed for the door", () => {
  expect(people?.length).toBe(2);
  const seed = of("src/db/seed.ts");
  // Only where the door is: a production database holds no user nobody controls.
  expect(seed).toContain(
    'if (process.env.NODE_ENV !== "production" || process.env.DEMO_SIGN_IN === "1") {',
  );
  expect(seed).toContain(
    '{ id: "sample-asa-oberg", name: "Åsa Öberg", email: "asa-oberg@sample.example", emailVerified: true, role: "member" },',
  );
  const listed = of("src/generated/people.ts");
  expect(listed).toContain('import.meta.env.DEV || process.env.DEMO_SIGN_IN === "1"');
  expect(listed).toContain('id: "sample-front-desk"');
  // No column or flag in the schema: the list is the mark.
  expect(of("src/db/schema.ts")).not.toContain("sample");
});

test("the door's routes are at /_dev/, shut without the secret, the clock in development only", () => {
  expect(of("src/routes/[_dev]/moves.ts")).toContain('createFileRoute("/_dev/moves")');
  expect(of("src/routes/[_dev]/act.ts")).toContain('createFileRoute("/_dev/act")');
  expect(of("src/routes/[_dev]/clock.ts")).toContain("doorShut(request, true)");
  expect(of("src/kit/dev-door.server.ts")).toContain("process.env.SMITHABLE_DEV_DOOR");
  // Ask's side only where the app has Ask.
  expect(of("src/routes/[_dev]/ask.ts")).toBe("");
});

test("each move is the app's own function, as the viewer; the moves are data, never core's", () => {
  const door = of("src/generated/dev-door.server.ts");
  expect(door).toContain(
    '"add:Booking": async (viewer, move, body) => bookingData.create(viewer, bookingSchema.parse(',
  );
  expect(door).toContain(
    '"delete:Session": async (viewer, _move, body) => sessionData.remove(viewer, record(body)),',
  );
  expect(door).toContain(
    "runTag(viewer, tagInput.parse({ ...stored(move.slots ?? [], body.values), sessions: body.records ?? [] }))",
  );
  // A reference is stored under its key.
  expect(door).toContain('{ session: "sessionId", note: "note" }');
  expect(door).toContain("  member: [");
  for (const file of out) expect(file.content).not.toMatch(/from "@smithable\//);
});

test("a custom action runs through its own server module", () => {
  expect(of("src/generated/actions/tag.server.ts")).toContain("export async function runTag(");
  expect(of("src/generated/actions/tag.ts")).toContain("return runTag(viewer, data);");
});
