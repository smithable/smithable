import {
  type AuthIR,
  emptyContent,
  type SpecIR,
  validateAuth,
  validateSpec,
} from "@smithable/core";
import { expect, test } from "vitest";
import { generateApp } from "./generate.js";

// People by name for a key whose role may set a field that refers to a user (T729,
// docs/design/api-only.md §3.6): by id and name only, at most ten, the route only for those roles.
const ir = validateSpec({
  path: "smithable.yml",
  text: "smithable: 0.1\napp: { name: Studio }\nmodels:\n  Booking:\n    fields: { when: datetime!, attendee: User! }\n  Note:\n    fields: { text: string! }\npages:\n  bookings: { crud: Booking }\n  notes: { crud: Note }\n  team: { users: manage }\n",
}).ir as SpecIR;
const generate = (roles: string) => {
  const auth = validateAuth(
    {
      path: "smithable.auth.yml",
      text: `smithableAuth: 0.1\nsignIn: { providers: [email] }\ndefaultAccess: private\nroles: ${roles}\napi: { models: all, assistants: true }\n`,
    },
    ir,
  ).auth as AuthIR;
  const out = generateApp(ir, { smithableVersion: "0.0.0", auth, content: emptyContent() });
  return (path: string) => out.find((f) => f.path === path)?.content;
};

test("the lookup gives id and name only, at most ten, and asks for two letters", () => {
  const of = generate(
    "{ admin: all, staff: { pages: all, read: [Booking], create: [Booking], write: [Booking] } }",
  );
  const choices = of("src/generated/user-choices.server.ts") ?? "";
  expect(choices).toContain(".select({ id: user.id, name: user.name })");
  expect(choices).toContain(".limit(10)");
  expect(choices).toContain(
    'if (text.length < 2) throw new BadInput("Give two letters or more of the name.");',
  );
  // Never an address: the lookup selects no other column.
  const lookup = choices.slice(choices.indexOf("export function peopleNamed"));
  expect(lookup).not.toMatch(/email|phone|role/);
  expect(of("src/generated/mcp.server.ts")).toContain(
    'case "people":\n      return { people: peopleNamed(String(args.name ?? "")) };',
  );
  const route = of("src/routes/api/v1/users.ts") ?? "";
  expect(route).toContain('const ROLES: readonly string[] = ["admin","staff"];');
  expect(route).toContain(
    'if (!ROLES.includes(viewer.role)) throw new NotFound("There is nothing here.");',
  );
});

test("a key whose role may set no user field gets nothing: an owner field counts only for roles that change every record", () => {
  const notes = validateSpec({
    path: "smithable.yml",
    text: "smithable: 0.1\napp: { name: Notes }\nmodels:\n  Note:\n    fields: { text: string!, by: User }\n    ownedBy: by\npages:\n  notes: { crud: Note }\n  team: { users: manage }\n",
  }).ir as SpecIR;
  const auth = validateAuth(
    {
      path: "smithable.auth.yml",
      text: "smithableAuth: 0.1\nsignIn: { providers: [email] }\ndefaultAccess: private\nroles: { admin: all, reader: { pages: all, read: [Note] } }\napi: { models: all, assistants: true }\n",
    },
    notes,
  ).auth as AuthIR;
  const out = generateApp(notes, { smithableVersion: "0.0.0", auth, content: emptyContent() });
  const of = (path: string) => out.find((f) => f.path === path)?.content ?? "";
  expect(of("src/routes/api/v1/users.ts")).toContain('const ROLES: readonly string[] = ["admin"];');
  // The tool is in the admin's offer, not the reader's.
  const offers = of("src/generated/mcp.server.ts");
  const reader = offers.slice(offers.indexOf('"reader": {'));
  expect(offers.slice(0, offers.indexOf('"reader": {'))).toContain('"name": "people"');
  expect(reader.slice(0, reader.indexOf('"describe"'))).not.toContain('"name": "people"');
});
