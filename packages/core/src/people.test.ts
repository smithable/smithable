import { expect, test } from "vitest";
import { type AuthIR, validateAuth } from "./auth.js";
import type { SpecIR } from "./ir.js";
import { validatePeople } from "./people.js";
import { validateSamples } from "./samples.js";
import { validateSpec } from "./spec.js";

const ir = validateSpec({
  path: "smithable.yml",
  text: "smithable: 0.1\napp: { name: Still Water }\nmodels:\n  Session:\n    fields:\n      name: string!\npages:\n  schedule: { crud: Session }\n",
}).ir as SpecIR;
const auth = validateAuth(
  {
    path: "smithable.auth.yml",
    text: "smithableAuth: 0.1\nsignIn: { providers: [email] }\ndefaultAccess: private\nroles:\n  admin: all\n  member: { pages: [schedule] }\n",
  },
  ir,
).auth as AuthIR;
const people = (text: string) => validatePeople({ path: "samples/people.yml", text }, auth);
const codes = (text: string) => people(text).diagnostics.map((d) => d.code);

test("people with a name, a role of the auth file or visitor, a persona and a pace", () => {
  const read = people(`- name: Maja
  role: member
  persona: A regular who books every Tuesday.
- name: Passer-by
  role: visitor
  persona: Reads the schedule and sends a question.
  pace: 2.5
`);
  expect(read.diagnostics).toEqual([]);
  expect(read.people).toEqual([
    { name: "Maja", role: "member", persona: "A regular who books every Tuesday.", pace: 1 },
    {
      name: "Passer-by",
      role: "visitor",
      persona: "Reads the schedule and sends a question.",
      pace: 2.5,
    },
  ]);
});

test("what is wrong is said: an unknown role with the nearest, a missing key, a pace out of range, a name twice", () => {
  expect(codes("- name: Maja\n  role: membr\n  persona: Books.\n")).toEqual(["unknown-role"]);
  expect(people("- name: Maja\n  role: membr\n  persona: Books.\n").diagnostics[0]?.hint).toContain(
    "member",
  );
  expect(codes("- name: Maja\n  role: member\n")).toEqual(["missing-key"]);
  expect(codes("- name: Maja\n  role: member\n  persona: Books.\n  pace: 0\n")).toEqual([
    "pace-out-of-range",
  ]);
  expect(
    codes(
      "- name: Maja\n  role: member\n  persona: Books.\n- name: Maja\n  role: admin\n  persona: Runs.\n",
    ),
  ).toEqual(["duplicate-name"]);
  expect(codes("- name: Maja\n  role: member\n  persona: Books.\n  mood: cheerful\n")).toEqual([
    "unknown-key",
  ]);
  expect(codes("name: Maja\n")).toEqual(["expected-list"]);
});

test("samples/people.yml is not taken for a model's records", () => {
  const read = validateSamples(
    [
      { path: "samples/people.yml", text: "- name: Maja\n  role: member\n  persona: Books.\n" },
      { path: "samples/Session.yml", text: "- name: Yoga\n" },
    ],
    ir,
  );
  expect(read.diagnostics).toEqual([]);
  expect(Object.keys(read.samples)).toEqual(["Session"]);
});
