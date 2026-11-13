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
import {
  keptPrivate,
  noSignInAssumption,
  openQuestions,
  publicNote,
  publicRecords,
  starterFor,
} from "./new.js";
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

test("a first build is as private as its description, in both draft modes", async () => {
  const records = STARTERS.records as Record<string, string>;
  const drafts = async (description: string) => {
    // Whole files adapted from the starter: the model keeps its public read as it was.
    const whole = await draftProject({
      description,
      starter: records,
      providers: [answering(records)],
    });
    // As operations: the model makes a record of its own public.
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
    for (const d of [whole, ops]) if (d.kind !== "draft") throw new Error(`no draft: ${d.message}`);
    return [whole, ops].map((d) => (d as { files: Record<string, string> }).files);
  };
  // (a) The reader settled no visitors: closed in both modes, and said.
  const recipe = "A recipe collection for a family, with ingredients and shopping lists";
  for (const drafted of await drafts(recipe)) {
    expect(readable(drafted).length, "the draft itself").toBeGreaterThan(0);
    const kept = keptPrivate(drafted, recipe, records);
    expect(readable(kept.files)).toEqual([]);
    expect(kept.assumption?.chosen).toMatch(
      /kept private, since your description names no visitors/,
    );
  }
  // The reader cannot tell for this one (unattended, its default answers folded in).
  const team = describedWith("A place for my team to track the equipment we lend out", [
    { question: "Who signs in?", answer: "Only the team" },
  ]);
  const [whole, ops] = await drafts(team);
  // (b) Unsettled, and the public read is the starter's own (inherited): closed.
  const inherited = keptPrivate(whole as Record<string, string>, team, records);
  expect(readable(inherited.files)).toEqual([]);
  expect(inherited.assumption?.chosen).toMatch(/kept private/);
  // (c) Unsettled, and the draft decided what is public: kept, and said the other way round.
  const decided = keptPrivate(ops as Record<string, string>, team, records);
  expect(readable(decided.files)).toEqual(["Thing"]);
  expect(decided.assumption?.chosen).toBe("Anyone can read the Thing records without signing in.");
  expect(decided.assumption?.options).toEqual(["Keep them private"]);
  // A description that asks for visitors keeps what it asked for, unsaid.
  const open = keptPrivate(
    records,
    "A public catalogue of our museum's objects for visitors to browse online",
    records,
  );
  expect(readable(open.files)).toEqual(["Item"]);
  expect(open.assumption).toBeUndefined();
});

test("a starter or a first build with no sign-in says what anyone can use, and nothing else", () => {
  const files = {
    "smithable.yml": `smithable: 0.1
app: { name: Blog }
models:
  Post:
    fields: { title: string!, status: draft | published }
  Note:
    fields: { text: string! }
pages:
  posts: { crud: Post }
  notes: { crud: Note }
`,
    "smithable.auth.yml": `smithableAuth: 0.1
signIn: none
public: { pages: [posts], read: [{ Post: { where: { status: published } } }] }
`,
  };
  // As a starter (no real starter is without sign-in; a fixture stands in for one).
  (STARTERS as Record<string, Record<string, string>>).nosignin = files;
  try {
    expect(publicRecords("nosignin")).toEqual(["Post"]);
    expect(publicNote("nosignin")).toBe(
      "The nosignin starter has no sign-in. Anyone with the address can use the Posts page and read posts (some of them); nothing else can be used by anyone, you included, until you add sign-in (smithable op setProviders email).",
    );
  } finally {
    delete (STARTERS as Record<string, unknown>).nosignin;
  }
  // As a first build from a description that names no visitors: an assumption the person sees.
  const said = noSignInAssumption(files, "My own notes and blog drafts, just for me");
  expect(said?.chosen).toMatch(
    /^This app has no sign-in\. Anyone with the address can use the Posts page/,
  );
  expect(said?.options).toEqual(["People sign in with a code sent to their email"]);
  // Visitors asked for: said all the same, since without sign-in nobody can write the posts.
  expect(noSignInAssumption(files, "A public blog for visitors to read online")?.chosen).toMatch(
    /you included/,
  );
});
