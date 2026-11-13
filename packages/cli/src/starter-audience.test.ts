// The starter suggestion weighs who the app is for (T767): a private description never gets a starter
// that lets anyone read its records unsaid, and a public catalogue still gets the collection starter.
import {
  describedWith,
  draftProject,
  draftProjectByOperations,
  type Provider,
} from "@smithable/ai";
import { validateAuth, validateSpec } from "@smithable/core";
import { expect, test } from "vitest";
import { keptPrivate, openQuestions, publicNote, publicRecords, starterFor } from "./new.js";
import { STARTERS } from "./starters.gen.js";

const PRIVATE = [
  "A recipe collection for a family, with ingredients and shopping lists",
  "A list of our team's equipment and who has what",
  "My own collection of vinyl records",
];

test("a private description never gets a public starter unsaid", async () => {
  for (const description of PRIVATE) {
    // As the questions step and Studio read it, with no model.
    const asked = await openQuestions(description);
    if (asked.starter && publicRecords(asked.starter).length)
      expect(asked.note, description).toMatch(/is a public site: anyone can read/);
    // As new --describe weighs the closest starter by words, whichever it was.
    for (const picked of ["records", "booking", "barbers", "marketplace"]) {
      const chosen = starterFor(description, picked);
      if (publicRecords(chosen.name).length)
        expect(chosen.note, `${description} / ${picked}`).toBeTruthy();
    }
  }
});

test("a description that asks for a public catalogue still gets the collection starter", async () => {
  const asked = await openQuestions(
    "A public catalogue of our museum's objects for visitors to browse online",
  );
  expect(asked.starter).toBe("records");
  expect(asked.note).toMatch(/records starter is a public site/);
});

test("the note names what anyone can read and the operation that closes it", () => {
  expect(publicNote("records")).toBe(
    'The records starter is a public site: anyone can read its Item records without signing in. To keep them private: smithable op setPublic --pages home --read ""',
  );
  expect(publicNote("crm")).toBeUndefined();
});

/** A model that answers every call the same, as a test's stand-in. */
const answering = (answer: unknown): Provider => ({
  name: "fake",
  tier: "frontier",
  location: "eu",
  price: { input: 0, output: 0 },
  async complete() {
    return { text: JSON.stringify(answer), model: "fake", inputTokens: 1, outputTokens: 1 };
  },
});
const readable = (files: Record<string, string>) => {
  const ir = validateSpec({ path: "smithable.yml", text: files["smithable.yml"] ?? "" }).ir;
  if (!ir) throw new Error("the draft's spec is not valid");
  return (
    validateAuth({ path: "smithable.auth.yml", text: files["smithable.auth.yml"] ?? "" }, ir).auth
      ?.public.read ?? []
  );
};

test("a first build for a private description keeps no record readable without sign-in, in both draft modes", async () => {
  const records = STARTERS.records as Record<string, string>;
  for (const description of [
    "A recipe collection for a family, with ingredients and shopping lists",
    // Unattended: the default answers folded in, as new --yes does.
    describedWith("A place for my team to track the equipment we lend out", [
      { question: "Who signs in?", answer: "Only the team" },
    ]),
  ]) {
    // Whole files adapted from the starter: the model keeps its public read as it was.
    const whole = await draftProject({
      description,
      starter: records,
      providers: [answering(records)],
    });
    // As operations: the model makes the records public itself.
    const ops = await draftProjectByOperations({
      description,
      providers: [
        answering({
          operations: [
            { op: "addModel", args: { model: "Thing", fields: { title: "string!" } } },
            { op: "addPage", args: { page: "things", model: "Thing" } },
            { op: "setPublic", args: { pages: ["things"], read: ["Thing"] } },
          ],
        }),
      ],
      starter: { name: "records", files: records },
    });
    for (const draft of [whole, ops]) {
      if (draft.kind !== "draft") throw new Error(`no draft: ${draft.message}`);
      const drafted = draft.files as Record<string, string>;
      expect(readable(drafted).length, `${description}: the draft itself`).toBeGreaterThan(0);
      const kept = keptPrivate(drafted, description);
      expect(readable(kept.files), description).toEqual([]);
      expect(kept.assumption?.chosen).toMatch(
        /kept private, since your description names no visitors/,
      );
    }
  }
  // A description that asks for visitors keeps what it asked for.
  const open = keptPrivate(
    records,
    "A public catalogue of our museum's objects for visitors to browse online",
  );
  expect(readable(open.files)).toEqual(["Item"]);
  expect(open.assumption).toBeUndefined();
});
