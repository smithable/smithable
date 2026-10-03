import { expect, test } from "vitest";
import { checkSpecFiles } from "./draft.js";
import {
  BLANK,
  blankFor,
  draftOperations,
  draftProjectByOperations,
  repairFieldShorthand,
} from "./draft-operations.js";
import type { Provider } from "./provider.js";

test("the empty app is valid, and the draft's operations leave out what a draft never needs", () => {
  expect(checkSpecFiles(BLANK)).toEqual([]);
  const names = draftOperations().map((o) => o.name);
  expect(names).toEqual(
    expect.arrayContaining(["setApp", "addModel", "addPage", "setRoles", "setPublic"]),
  );
  expect(names).not.toContain("editSpec");
  expect(names).not.toContain("removeField");
});

test("field shorthand slips are mended", () => {
  expect(repairFieldShorthand("email unique!")).toBe("email! unique");
  expect(repairFieldShorthand("string required")).toBe("string!");
  expect(repairFieldShorthand("low | normal | high = normal")).toBe("normal | low | high");
  expect(repairFieldShorthand("choices: good | worn")).toBe("good | worn");
  expect(repairFieldShorthand("boolean")).toBe("bool");
  expect(repairFieldShorthand("integer! = 12")).toBe("int! = 12");
  expect(repairFieldShorthand("Customer!")).toBe("Customer!");
});

test("a draft starts with the starter's access default and sees the starter as its example", async () => {
  const starter = {
    "smithable.yml":
      "smithable: 0.1\napp:\n  name: Team\nmodels:\n  Task:\n    fields:\n      title: string!\npages:\n  tasks: { crud: Task }\n",
    "smithable.auth.yml":
      "smithableAuth: 0.1\nsignIn:\n  providers: [google]\ndefaultAccess: shared\n",
  };
  expect(blankFor(starter)["smithable.auth.yml"]).toContain("defaultAccess: shared");
  expect(blankFor(undefined)).toBe(BLANK);
  expect(blankFor({ "smithable.yml": "" })).toBe(BLANK);
  const prompts: string[] = [];
  const provider: Provider = {
    name: "fake",
    tier: "frontier",
    location: "eu",
    price: { input: 1, output: 3 },
    async complete({ user }) {
      prompts.push(user);
      return {
        text: JSON.stringify({
          operations: [
            { op: "setApp", args: { name: "Tasks" } },
            { op: "addModel", args: { model: "Task", fields: { title: "string!" } } },
            { op: "addPage", args: { page: "tasks", model: "Task" } },
          ],
        }),
        model: "fake",
        inputTokens: 10,
        outputTokens: 10,
      };
    },
  };
  const draft = await draftProjectByOperations({
    description: "a task list for our team",
    providers: [provider],
    starter: { name: "crm", files: starter },
  });
  expect(draft.kind).toBe("draft");
  expect(draft.kind === "draft" && draft.files["smithable.auth.yml"]).toContain(
    "defaultAccess: shared",
  );
  expect(prompts[0]).toContain("The crm starter, the example for this kind of app:");
  expect(prompts[0]).toContain("tasks: { crud: Task }");
  // The starter's roles and access are part of the example: its auth file is shown too.
  expect(prompts[0]).toContain("smithable.auth.yml:\n```yaml\nsmithableAuth: 0.1");
  expect(draftOperations().map((o) => o.name)).toContain("setDefaultAccess");
});

test("a shared draft with open sign-up is made invite-only, with a team page", async () => {
  const steps = [
    { op: "setApp", args: { name: "Tasks" } },
    { op: "addModel", args: { model: "Task", fields: { title: "string!" } } },
    { op: "addPage", args: { page: "tasks", model: "Task" } },
  ];
  const provider = (answer: unknown): Provider => ({
    name: "fake",
    tier: "frontier",
    location: "eu",
    price: { input: 1, output: 3 },
    async complete() {
      return { text: JSON.stringify(answer), model: "fake", inputTokens: 1, outputTokens: 1 };
    },
  });
  const shared = {
    "smithable.yml": "smithable: 0.1\napp:\n  name: Team\n",
    "smithable.auth.yml":
      "smithableAuth: 0.1\nsignIn:\n  providers: [google]\ndefaultAccess: shared\n",
  };
  const draft = await draftProjectByOperations({
    description: "a task list for our team",
    providers: [provider({ operations: steps })],
    starter: { name: "crm", files: shared },
  });
  if (draft.kind !== "draft") throw new Error("no draft");
  expect(draft.files["smithable.auth.yml"]).toContain("selfSignUp: false");
  expect(draft.files["smithable.yml"]).toContain("users: manage");
  expect(draft.operations?.slice(-2).map((o) => o.op)).toEqual(["addUsersPage", "setSignUp"]);
  expect(checkSpecFiles(draft.files)).toEqual([]);
  // A private app stays open to sign-up: each person sees only their own records.
  const own = await draftProjectByOperations({
    description: "a personal task list",
    providers: [provider({ operations: steps })],
  });
  if (own.kind !== "draft") throw new Error("no draft");
  expect(own.files["smithable.auth.yml"]).not.toContain("selfSignUp");
  expect(own.operations?.map((o) => o.op)).toEqual(["setApp", "addModel", "addPage"]);
});

const answering = (answer: unknown): Provider => ({
  name: "fake",
  tier: "frontier",
  location: "eu",
  price: { input: 1, output: 3 },
  async complete() {
    return { text: JSON.stringify(answer), model: "fake", inputTokens: 1, outputTokens: 1 };
  },
});

test("an action still refused after the last round is dropped and named, not the draft", async () => {
  const draft = await draftProjectByOperations({
    description: "event registration",
    providers: [
      answering({
        operations: [
          { op: "setApp", args: { name: "Events" } },
          { op: "addModel", args: { model: "Talk", fields: { title: "string!" } } },
          { op: "addPage", args: { page: "talks", model: "Talk" } },
          { op: "addAction", args: { action: "register", on: "Talk", set: { seats: "1" } } },
        ],
      }),
    ],
  });
  if (draft.kind !== "draft") throw new Error(draft.message);
  expect(draft.files["smithable.yml"]).not.toContain("register");
  expect(draft.dropped).toHaveLength(1);
  expect(draft.dropped?.[0]).toMatch(/^addAction register: /);
});

test("a total over a list added in the same model follows the list", async () => {
  const draft = await draftProjectByOperations({
    description: "invoices",
    providers: [
      answering({
        operations: [
          { op: "setApp", args: { name: "Invoices" } },
          {
            op: "addModel",
            args: {
              model: "Invoice",
              fields: {
                number: "string!",
                lines: "InvoiceLine[]",
                total: "money = SUM(lines.amount)",
              },
            },
          },
          {
            op: "addModel",
            args: { model: "InvoiceLine", fields: { invoice: "Invoice!", amount: "money!" } },
          },
          { op: "addPage", args: { page: "invoices", model: "Invoice" } },
        ],
      }),
    ],
  });
  if (draft.kind !== "draft") throw new Error(draft.message);
  expect(draft.files["smithable.yml"]).toContain("SUM(lines.amount)");
  expect(checkSpecFiles(draft.files)).toEqual([]);
});

test("a total over a list that is never added is left out and named, not the draft", async () => {
  const draft = await draftProjectByOperations({
    description: "invoices",
    providers: [
      answering({
        operations: [
          { op: "setApp", args: { name: "Invoices" } },
          { op: "addModel", args: { model: "Invoice", fields: { number: "string!" } } },
          // Sent again in every correction round, as the bench's model did.
          {
            op: "addField",
            args: { model: "Invoice", field: "total", type: "money = SUM(lines.amount)" },
          },
          { op: "addPage", args: { page: "invoices", model: "Invoice" } },
        ],
      }),
    ],
  });
  if (draft.kind !== "draft") throw new Error(draft.message);
  expect(draft.files["smithable.yml"]).toContain("number:");
  expect(draft.files["smithable.yml"]).not.toContain("SUM(");
  expect(draft.dropped).toEqual([expect.stringMatching(/^addField Invoice\.total: /)]);
});

test("invite-only asked before the team page gets the team page first", async () => {
  const shared = {
    "smithable.yml": "smithable: 0.1\napp:\n  name: Team\n",
    "smithable.auth.yml":
      "smithableAuth: 0.1\nsignIn:\n  providers: [google]\ndefaultAccess: shared\n",
  };
  const draft = await draftProjectByOperations({
    description: "a task list for our team",
    providers: [
      answering({
        operations: [
          { op: "setApp", args: { name: "Tasks" } },
          { op: "addModel", args: { model: "Task", fields: { title: "string!" } } },
          { op: "addPage", args: { page: "tasks", model: "Task" } },
          { op: "setSignUp", args: { who: "invited" } },
        ],
      }),
    ],
    starter: { name: "crm", files: shared },
  });
  if (draft.kind !== "draft") throw new Error(draft.message);
  expect(draft.files["smithable.auth.yml"]).toContain("selfSignUp: false");
  expect(draft.files["smithable.yml"]).toContain("users: manage");
  expect(draft.dropped).toBeUndefined();
});
