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
  expect(draftOperations().map((o) => o.name)).toContain("setDefaultAccess");
});
