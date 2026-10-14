// Hints say how to fix a mistake: people read them, and so do models repairing a draft.
import { expect, test } from "vitest";
import { validateAuth } from "./auth.js";
import { validateSpec } from "./spec.js";

const hints = (text: string) =>
  validateSpec({ path: "smithable.yml", text }).diagnostics.map((d) => d.hint);

test("two models listing each other get a link model suggested", () => {
  expect(
    hints(`smithable: 0.1
app: { name: Conference }
models:
  Talk:
    fields:
      title: string!
      attendees: Attendee[]
  Attendee:
    fields:
      name: string!
      talks: Talk[]
`),
  ).toContain(
    'Talk and Attendee list each other: add a model that links them, like TalkAttendee with "talk: Talk!" and "attendee: Attendee!", and list TalkAttendee records on both sides.',
  );
});

test("declaring owner explains the automatic owner and ownedBy", () => {
  expect(
    hints(`smithable: 0.1
app: { name: Tools }
models:
  Tool:
    fields: { name: string!, owner: User }
`)[0],
  ).toContain('add a user field (like "lender: User") and "ownedBy: lender"');
});

test("a model called User explains the owner and how to point at a user", () => {
  expect(
    hints(`smithable: 0.1
app: { name: Market }
models:
  User:
    fields: { name: string! }
`)[0],
  ).toContain(
    'add a field of type User (e.g. "seller: User"), or make that field the owner with "ownedBy"',
  );
});

test("a landing section written as a list shows the accepted forms", () => {
  expect(
    hints(`smithable: 0.1
app: { name: Site }
pages:
  home:
    route: /
    landing:
      features: [fast, simple]
`)[0],
  ).toContain('Write "features:" with nothing after it');
});

test("a comma or colon that splits a description is explained", () => {
  const { diagnostics } = validateAuth({
    path: "smithable.auth.yml",
    text: `smithableAuth: 0.1
signIn: { providers: [google] }
defaultAccess: shared
roles:
  admin: { description: Runs the app. }
  sales: { description: Works with contacts, deals and follow-ups. }
defaultRole: sales
`,
  });
  const hint =
    'A ", " inside { … } or a ": " inside a text starts a new entry: put the whole text in quotes.';
  expect(diagnostics.map((d) => d.hint)).toContain(hint);
  const colon = validateAuth({
    path: "smithable.auth.yml",
    text: "smithableAuth: 0.1\nroles:\n  sales:\n    description: Works with contacts: deals.\n",
  });
  expect(colon.diagnostics.map((d) => d.hint)).toContain(hint);
});

test("shortcuts belong to a hero, at most four, each a page", () => {
  const messages = (landing: string) =>
    validateSpec({
      path: "smithable.yml",
      text: `smithable: 0.1
app: { name: Studio }
models:
  Class:
    fields: { name: string! }
pages:
  classes: { crud: Class }
  home:
    route: /
    landing:
${landing}
`,
    }).diagnostics.map((d) => d.message);
  expect(messages("      hero: { shortcuts: [classes] }")).toEqual([]);
  expect(messages("      hero:\n      faq: { shortcuts: [classes] }")).toContain(
    "Only a hero section has shortcuts.",
  );
  expect(
    messages("      hero: { shortcuts: [classes, classes, classes, classes, classes] }"),
  ).toContain("A hero has at most four shortcuts.");
  expect(messages("      hero: { shortcuts: [nowhere] }").join(" ")).toContain("nowhere");
});

test("people are not filters (owner is a Mine toggle), and calculated fields are not sorted by", () => {
  const messages = (keys: string) =>
    validateSpec({
      path: "smithable.yml",
      text: `smithable: 0.1
app: { name: Market }
models:
  Item:
    fields:
      title: string!
      price: money
      seller: User
      double: { type: money, formula: price * 2 }
pages:
  items:
    crud: Item
${keys}
`,
    }).diagnostics.map((d) => d.message);
  expect(messages("    filters: [owner, price]")).toEqual([]);
  // A person is a filter (record-rules.md §6): Mine, Unassigned and the people by name.
  expect(messages("    filters: [seller]")).toEqual([]);
  expect(messages("    sortable: [double]")[0]).toContain(
    "a calculated field has no stored value to sort by",
  );
});
