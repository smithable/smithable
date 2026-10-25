import { expect, test } from "vitest";
import { clarifyProject, describedWith } from "./clarify.js";
import { checkSpecFiles } from "./draft.js";
import { draftProjectByOperations } from "./draft-operations.js";
import type { Provider } from "./provider.js";

function scripted(answers: unknown[]): Provider & { prompts: string[] } {
  const prompts: string[] = [];
  return {
    name: "smithable",
    tier: "smithable",
    location: "eu",
    price: { input: 1, output: 3 },
    prompts,
    async complete({ user }) {
      prompts.push(user);
      const next = answers.shift();
      if (next instanceof Error) throw next;
      return { text: JSON.stringify(next), model: "smithable", inputTokens: 500, outputTokens: 60 };
    },
  };
}
const starters = {
  crm: { description: "A CRM for a sales team.", models: ["Customer", "Order"] },
  records: { description: "Things and what we know about them.", models: ["Item"] },
};

test("questions follow the description's language, or askIn when the description is a page's", async () => {
  const swedish =
    "Elbolaget på Åland: vi har kunder som kan anmäla avbrott och se när de är lagade.";
  const model = scripted([
    { starter: "records", questions: [] },
    { starter: "records", questions: [] },
  ]);
  await clarifyProject({ description: swedish, starters, providers: [model] });
  await clarifyProject({ description: swedish, starters, providers: [model], askIn: "en" });
  expect(model.prompts[0]).toContain("texts are in Swedish");
  expect(model.prompts[1]).not.toContain("texts are in Swedish");
  expect(model.prompts[1]).toContain("suggested answer in English");
});

test("the questions step picks a starter and asks at most three questions; a bad answer asks none", async () => {
  const model = scripted([
    {
      starter: "records",
      questions: [
        { question: "Who will use it?", options: ["Only me", "Anyone"] },
        { question: "Q2", options: [] },
        { question: "Q3", options: ["a"] },
        { question: "Q4, one too many", options: [] },
      ],
    },
    { starter: "nope", questions: "not a list" },
    new Error("down"),
  ]);
  const first = await clarifyProject({
    description: "A site for my dogs",
    starters,
    providers: [model],
  });
  expect(first.starter).toBe("records");
  expect(first.questions.map((q) => q.question)).toEqual(["Who will use it?", "Q2", "Q3"]);
  expect(model.prompts[0]).toContain(
    "- records: Things and what we know about them. Records: Item.",
  );
  const second = await clarifyProject({ description: "x", starters, providers: [model] });
  expect(second).toMatchObject({ questions: [] });
  expect(second.starter).toBeUndefined();
  const third = await clarifyProject({ description: "x", starters, providers: [model] });
  expect(third.questions).toEqual([]);
  expect(await clarifyProject({ description: "x", starters, providers: [] })).toMatchObject({
    questions: [],
  });
});

test("answers are folded into the description; blank ones are left out", () => {
  expect(
    describedWith("A site for my dogs", [
      { question: "Who will use it?", answer: "Anyone" },
      { question: "Q2", answer: " " },
    ]),
  ).toBe("A site for my dogs\n\nAnswers:\n- Who will use it? Anyone");
  expect(describedWith("x", [])).toBe("x");
});

test("a draft as operations: slips are mended, refusals go back together, extras that still fail are dropped", async () => {
  const model = scripted([
    {
      operations: [
        { op: "setApp", args: { name: "Dog Show", description: "My dogs.", currency: "EUR" } },
        { op: "addModel", args: { model: "User", fields: { name: "string!" } } },
        { op: "addPage", args: { page: "dogs", model: "Dog" } },
        {
          op: "addModel",
          args: {
            model: "Dog",
            fields: {
              name: "string required",
              breed: "string",
              mood: "calm | playful = playful",
              keeper: "User",
            },
          },
        },
        { op: "addLandingPage", args: { page: "home" } },
        { op: "addSection", args: { page: "home", section: "hero" } },
        { op: "setPublic", args: { pages: ["home", "dogs"], read: ["Dog"] } },
        { op: "setText", args: { text: "Meet the pack" } },
        { op: "addPage", args: { page: "toys", model: "Toy" } },
      ],
    },
    // The refused ones come back: the text corrected, the toys page given up.
    {
      operations: [
        {
          op: "setText",
          args: { text: "Meet the pack", path: ["pages", "home", "hero", "title"] },
        },
      ],
    },
  ]);
  const draft = await draftProjectByOperations({
    description: "A site for my dogs",
    providers: [model],
  });
  expect(draft.kind).toBe("draft");
  if (draft.kind !== "draft") return;
  expect(checkSpecFiles(draft.files)).toEqual([]);
  expect(draft.files["smithable.yml"]).toContain("name: Dog Show");
  expect(draft.files["smithable.yml"]).toContain("name: string!");
  expect(draft.files["smithable.yml"]).toContain("mood: playful | calm");
  expect(draft.files["smithable.yml"]).toContain("keeper: User");
  expect(draft.files["smithable.yml"]).not.toContain("Toy");
  expect(draft.files["smithable.content.yml"]).toContain("Meet the pack");
  expect(draft.operations?.map((o) => o.op)).toEqual([
    "setApp",
    "addModel",
    "addPage",
    "addLandingPage",
    "setPublic",
    "setText",
  ]);
  expect(model.prompts[1]).toContain("These operations were refused:");
  expect(model.prompts[1]).toContain('"path" is missing');
  // Dogs are public and name their keeper: the valid draft goes back once with that, and since
  // the script has no third answer, it stays as it was.
  expect(model.prompts[2]).toContain("Anyone on the internet can read Dog");
  expect(model.prompts).toHaveLength(3);
});

test("a draft as operations fails when nothing could be applied", async () => {
  const model = scripted([
    { operations: [{ op: "addPage", args: { page: "dogs", model: "Dog" } }] },
    { operations: [{ op: "addPage", args: { page: "dogs", model: "Dog" } }] },
    { operations: [] },
  ]);
  const draft = await draftProjectByOperations({ description: "x", providers: [model] });
  expect(draft.kind).toBe("failed");
  if (draft.kind === "failed") expect(draft.message).toContain("addPage");
  // Four rounds of the same refusal: the essential operation ends it.
  const stubborn = scripted(
    Array.from({ length: 4 }, () => ({
      operations: [{ op: "addPage", args: { page: "dogs", model: "Dog" } }],
    })),
  );
  const again = await draftProjectByOperations({ description: "x", providers: [stubborn] });
  expect(again.kind).toBe("failed");
});

test("two models referring to each other are added without the fields that need the other, then completed", async () => {
  const model = scripted([
    {
      operations: [
        { op: "setApp", args: { name: "Jobs" } },
        {
          op: "addModel",
          args: { model: "JobPost", fields: { title: "string!", applications: "Application[]" } },
        },
        {
          op: "addModel",
          args: { model: "Application", fields: { job: "JobPost!", name: "string!" } },
        },
        { op: "addPage", args: { page: "jobs", model: "JobPost" } },
      ],
    },
  ]);
  const draft = await draftProjectByOperations({ description: "x", providers: [model] });
  expect(draft.kind).toBe("draft");
  if (draft.kind !== "draft") return;
  expect(checkSpecFiles(draft.files)).toEqual([]);
  expect(draft.files["smithable.yml"]).toContain("applications: Application[]");
  expect(draft.files["smithable.yml"]).toContain("job: JobPost!");
  expect(draft.operations?.map((o) => o.op)).toEqual([
    "setApp",
    "addModel",
    "addModel",
    "addPage",
    "addField",
  ]);
});

test("a list of records the other model does not refer back to is left out, in a model or a field", async () => {
  const model = scripted([
    {
      operations: [
        { op: "setApp", args: { name: "Bakery" } },
        { op: "addModel", args: { model: "Supplier", fields: { name: "string!" } } },
        {
          op: "addModel",
          args: { model: "Ingredient", fields: { name: "string!", suppliers: "Supplier[]" } },
        },
        { op: "addField", args: { model: "Supplier", field: "ingredients", type: "Ingredient[]" } },
        { op: "addPage", args: { page: "ingredients", model: "Ingredient" } },
      ],
    },
  ]);
  const draft = await draftProjectByOperations({ description: "x", providers: [model] });
  expect(draft.kind).toBe("draft");
  if (draft.kind !== "draft") return;
  expect(checkSpecFiles(draft.files)).toEqual([]);
  expect(draft.files["smithable.yml"]).not.toContain("[]");
  expect(draft.operations?.map((o) => o.op)).toEqual(["setApp", "addModel", "addModel", "addPage"]);
});

test("a refused action name goes back with the name to use instead (A 159)", async () => {
  const model = scripted([
    {
      operations: [
        { op: "setApp", args: { name: "Tool Library" } },
        {
          op: "addModel",
          args: { model: "Tool", fields: { name: "string!", status: "in | out" } },
        },
        { op: "addPage", args: { page: "tools", model: "Tool" } },
        { op: "addAction", args: { action: "return", on: "Tool", set: { status: "in" } } },
      ],
    },
    { operations: [] },
  ]);
  await draftProjectByOperations({ description: "A tool library", providers: [model] });
  expect(model.prompts[1]).toContain('name the action "returnTool"');
});
