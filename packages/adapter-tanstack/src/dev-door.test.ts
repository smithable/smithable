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
  expect(of("src/kit/dev-door.server.ts")).toContain("process.env.DEV_DOOR_SECRET");
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
    "runTag(viewer, tagInput.parse({ ...stored(move.slots ?? [], body.values), sessions: rows }))",
  );
  // Only rows the move is open to: any other id is refused before the action runs (T845).
  expect(door).toContain(
    "if (!rows.every((row) => open.has(row))) throw new AccessDenied(viewer !== null);",
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

// T845: the door offers and makes merges and splits by the action's own rule and each record's.
test("the door merges and splits only what the action and each record allow, and moves the clock one at a time", () => {
  const raw = import.meta.glob("../../../examples/invoicing/smithable*.yml", {
    query: "?raw",
    import: "default",
    eager: true,
  }) as Record<string, string>;
  const at = (file: string) => raw[`../../../examples/invoicing/${file}`] as string;
  const ir = validateSpec({
    path: "smithable.yml",
    text: at("smithable.yml")
      .replace("number: { type: string!, unique: true", "number: { type: string, unique: true")
      .replace(
        "actions:\n",
        "actions:\n  mergeInvoices:\n    merge: Invoice\n  splitInvoice:\n    split: Invoice\n    move: lines\n",
      ),
  }).ir as SpecIR;
  const invoicingAuth = validateAuth(
    { path: "smithable.auth.yml", text: at("smithable.auth.yml") },
    ir,
  ).auth as AuthIR;
  const admins = validatePeople(
    {
      path: "samples/people.yml",
      text: "- name: Office\n  role: admin\n  persona: Keeps the books.\n",
    },
    invoicingAuth,
  ).people;
  const files = generateApp(ir, {
    smithableVersion: "0.0.0",
    auth: invoicingAuth,
    content: emptyContent(),
    ...(admins ? { people: admins } : {}),
  });
  const door = files.find((f) => f.path === "src/generated/dev-door.server.ts")?.content ?? "";
  // A merge is offered only to whom its own rule allows.
  expect(door).toContain("if (!allows(mergeInvoicesAccess, viewer)) return undefined;");
  // A split is offered for a record with two or more lines, one of which the person may change,
  // and moves only lines the person may change.
  expect(door).toContain("&& movable.has(row.id as number));");
  expect(door).toContain("allows(invoiceLineAccess.write, viewer, row.ownerId as string | null)");
  expect(door).toContain("const movable = on.filter((id) => mine.has(id));");
  // A removed sample user stays removed.
  expect(door).toContain('eq(auditLog.action, "user removed")');
  const clock = files.find((f) => f.path === "src/routes/[_dev]/clock.ts")?.content ?? "";
  // An exact time may be any canonical one (a scenario replays history); an offset stays within a year.
  expect(clock).not.toContain("Math.abs(at - Date.now()) > MOST");
  expect(clock).toContain("const move = moving.then(async () => {");
  expect(clock).toContain("return refused(error);");
});
