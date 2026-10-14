import {
  type AuthIR,
  emptyContent,
  type SpecIR,
  validateAuth,
  validateSpec,
} from "@smithable/core";
import { expect, test } from "vitest";
import { generateApp } from "./generate.js";

const generate = (name: string, action: string, content = emptyContent()) => {
  const ir = validateSpec({
    path: "smithable.yml",
    text: `smithable: 0.1
app: { name: Tasks }
models:
  Task:
    fields:
      title: string!
      status: open | done
actions:
  ${name}: ${action}
pages:
  tasks: { crud: Task, actions: [${name}] }
`,
  }).ir as SpecIR;
  const auth = validateAuth(
    {
      path: "smithable.auth.yml",
      text: "smithableAuth: 0.1\nsignIn: { providers: [google] }\ndefaultAccess: shared\n",
    },
    ir,
  ).auth as AuthIR;
  const files = generateApp(ir, { smithableVersion: "0.0.0", auth, content });
  return (path: string) => files.find((f) => f.path === path)?.content ?? "";
};

test("a record page whose only action is a copy has no router (the copy opens the new record)", () => {
  const copyOnly = generate("duplicate", "{ on: Task, copy: { status: open } }");
  expect(copyOnly("src/routes/tasks/$id.tsx")).toContain("duplicate");
  expect(copyOnly("src/routes/tasks/$id.tsx")).not.toContain("useRouter");
  const change = generate("finish", "{ on: Task, when: { status: open }, set: { status: done } }");
  expect(change("src/routes/tasks/$id.tsx")).toContain("await router.invalidate();");
});

test("an action's help in the content file is its button's tooltip and its dialog's line", () => {
  const help = "Marks the task done for everyone.";
  const file = generate("finish", "{ on: Task, when: { status: open }, set: { status: done } }", {
    ...emptyContent(),
    actions: { finish: { help } },
  });
  expect(file("src/routes/tasks/$id.tsx")).toContain(`help="${help}"`);
  expect(
    generate("finish", "{ on: Task, set: { status: done } }")("src/routes/tasks/$id.tsx"),
  ).not.toContain("help=");
});

test("a copy run by Ask or through the API answers with the new record, read by the id the copy gives", () => {
  const ir = validateSpec({
    path: "smithable.yml",
    text: "smithable: 0.1\napp: { name: Tasks }\nmodels:\n  Task:\n    fields: { title: string!, status: open | done }\nactions:\n  duplicate: { on: Task, copy: { status: open } }\npages:\n  tasks: { crud: Task, actions: [duplicate] }\n  team: { users: manage }\n",
  }).ir as SpecIR;
  const auth = validateAuth(
    {
      path: "smithable.auth.yml",
      text: "smithableAuth: 0.1\nsignIn: { providers: [google] }\ndefaultAccess: shared\nassistant: { for: signed-in, may: change }\napi: { models: [Task], actions: [duplicate] }\n",
    },
    ir,
  ).auth as AuthIR;
  const files = generateApp(ir, { smithableVersion: "0.0.0", auth, content: emptyContent() });
  const file = (path: string) => files.find((f) => f.path === path)?.content ?? "";
  expect(file("src/generated/ask.server.ts")).toContain(
    "taskToApi((await KINDS.Task.data.get(keyed(viewer), await runDuplicate(keyed(viewer), row.id))) as Record<string, any>)",
  );
  const route = file("src/routes/api/v1/tasks/$id.actions.$action.ts");
  expect(route).toContain(
    "taskToApi((await taskData.get(viewer, await runDuplicate(viewer, id))) as Record<string, any>)",
  );
  expect(route).toContain('import { taskData } from "#/generated/task.server";');
});
