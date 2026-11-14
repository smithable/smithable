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
  expect(choices).toContain("return namesHolding(");
  expect(choices).toContain(
    'if (!text) throw new BadInput("Give two letters or more of the name.");',
  );
  // Never an address: the lookup selects no other column.
  const lookup = choices.slice(choices.indexOf("export function peopleNamed"));
  expect(lookup).not.toMatch(/email|phone|role/);
  expect(of("src/generated/mcp.server.ts")).toContain(
    'if (!offerFor(viewer).tools.some((tool) => tool.name === "people")) throw new NotFound(`There is no tool "people".`);\n      return { people: peopleNamed(String(args.name ?? "")) };',
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

test("names outside ASCII are found as they are written, folded alike on both sides", async () => {
  // The kit file itself, as the app runs it (outside this package's sources, so not type-checked here).
  const kit = "../templates/src/kit/people-match.ts";
  const { lookedFor, namesHolding } = (await import(/* @vite-ignore */ kit)) as {
    lookedFor: (words: string) => string | undefined;
    namesHolding: <T extends { name: string | null }>(people: T[], text: string) => T[];
  };
  const people = [
    { id: "1", name: "Åsa Lind" },
    { id: "2", name: "Örjan Berg" },
    { id: "3", name: "Mats Ås" },
    { id: "4", name: null },
  ];
  const find = (words: string) => namesHolding(people, lookedFor(words) ?? "").map((p) => p.id);
  expect(find("ås")).toEqual(["1", "3"]);
  expect(find("ÅS")).toEqual(["1", "3"]);
  expect(find("örj")).toEqual(["2"]);
  // Decomposed (o + combining diaeresis) as some keyboards send it.
  expect(find("Örjan".toLowerCase())).toEqual(["2"]);
  expect(lookedFor("å")).toBeUndefined();
  expect(lookedFor("  ")).toBeUndefined();
  expect(
    namesHolding(
      Array.from({ length: 30 }, (_, i) => ({ id: `${i}`, name: `Anna ${i}` })),
      "an",
    ),
  ).toHaveLength(10);
});

test("an action's card names each asked value by its field, and a person or a record by name (T821)", () => {
  const spec = validateSpec({
    path: "smithable.yml",
    text: "smithable: 0.1\napp: { name: Studio }\nmodels:\n  Room:\n    fields: { name: string! }\n  Booking:\n    fields: { when: datetime!, attendee: User, room: Room, note: string }\nactions:\n  assign:\n    on: Booking\n    set: { attendee:, room:, note: }\npages:\n  bookings: { crud: Booking, actions: [assign] }\n  rooms: { crud: Room }\n  team: { users: manage }\n",
  });
  expect(spec.ir).toBeDefined();
  const auth = validateAuth(
    {
      path: "smithable.auth.yml",
      text: "smithableAuth: 0.1\nsignIn: { providers: [email] }\ndefaultAccess: private\nroles: { admin: all }\nassistant: { for: signed-in, may: change }\n",
    },
    spec.ir as SpecIR,
  ).auth as AuthIR;
  const out = generateApp(spec.ir as SpecIR, {
    smithableVersion: "0.0.0",
    auth,
    content: emptyContent(),
  });
  const all = out.map((f) => f.content).join("\n");
  expect(all).toContain(
    'shows: {"attendeeId":["Booking","attendee","person"],"roomId":["Booking","room","Room"],"note":["Booking","note",null]}',
  );
  expect(all).toContain("to = personName(String(value)) ?? to;");
});
