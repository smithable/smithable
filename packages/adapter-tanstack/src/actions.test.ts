import {
  type AuthIR,
  emptyContent,
  type SpecIR,
  validateAuth,
  validateSpec,
} from "@smithable/core";
import { expect, test } from "vitest";
import { generateApp } from "./generate.js";

const generate = (
  name: string,
  action: string,
  content = emptyContent(),
  status = "status: open | done",
  authMore = "",
) => {
  const ir = validateSpec({
    path: "smithable.yml",
    text: `smithable: 0.1
app: { name: Tasks }
models:
  Task:
    fields:
      title: string!
      ${status}
actions:
  ${name}: ${action}
pages:
  tasks: { crud: Task, actions: [${name}] }
`,
  }).ir as SpecIR;
  const auth = validateAuth(
    {
      path: "smithable.auth.yml",
      text: `smithableAuth: 0.1\nsignIn: { providers: [google] }\ndefaultAccess: shared\n${authMore}`,
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

test("a standard action writes only the fields it sets, and frees only those from their locks", () => {
  const close = generate("close", "{ on: Task, set: { status: done } }");
  const server = close("src/generated/actions/close.server.ts");
  expect(server).toContain(
    'values: taskSettable.partial().parse({\n      status: "done",\n    }),',
  );
  expect(server).not.toContain("...row,");
  expect(server).toContain('return taskData.update(viewer, id, one.values, "close", ["status"]);');
});

test("the fields freed from their locks are the set's columns, never an asked one", () => {
  const assign = generate("assign", "{ on: Task, set: { status: done, title: } }");
  const server = assign("src/generated/actions/assign.server.ts");
  expect(server).toContain('"assign", ["status"]);');
});

test("an action sets what a form cannot: a field the app fills", () => {
  const confirm = generate(
    "confirm",
    "{ on: Task, set: { status: done } }",
    undefined,
    "status: { type: open | done, by: app }",
  );
  const schema = confirm("src/generated/task.schema.ts");
  // The form's schema leaves the app's field out; the settable one keeps it for the action.
  expect(schema).toContain("export const taskSettable = createInsertSchema(schema.tasks, {");
  expect(schema).toContain(".partial({ status: true });");
  expect(schema).toContain("export const taskSchema = taskSettable.omit({ status: true });");
  expect(schema).toContain("export type TaskSettable = z.output<typeof taskSettable>;");
  const server = confirm("src/generated/actions/confirm.server.ts");
  expect(server).toContain(
    'values: taskSettable.partial().parse({\n      status: "done",\n    }),',
  );
  expect(confirm("src/generated/task.server.ts")).toContain(
    'values: Partial<TaskSettable>, what = "changed"',
  );
  // A record an action adds may get the app's fields too.
  const noted = generate(
    "note",
    "{ on: Task, add: { Note: { body: Noted, kind: system } } }",
    undefined,
    "status: open | done\n      notes: Note[]\n  Note:\n    fields:\n      body: text!\n      kind: { type: user | system, by: app }\n      task: Task!",
  );
  expect(noted("src/generated/actions/note.server.ts")).toContain("added0: noteSettable.parse({");
  // Without a field the app fills, the two schemas are one.
  expect(
    generate("close", "{ on: Task, set: { status: done } }")("src/generated/task.schema.ts"),
  ).toContain("export const taskSchema = taskSettable;");
});

test("a form's change needs write on the record; an action checked its own access", () => {
  const close = generate("close", "{ on: Task, set: { status: done } }");
  const data = close("src/generated/task.server.ts");
  expect(data).toContain('if (what === "changed") check(taskAccess.write, viewer, row.ownerId);');
});

test("an action's condition on a reference reads the stored key and the viewer: not ME() is anyone's but theirs, or nobody's", () => {
  const take = generate(
    "assignToMe",
    "{ on: Task, when: { assignee: not ME() }, set: { assignee: ME() } }",
    emptyContent(),
    "assignee: User",
  );
  const module = take("src/generated/actions/assign-to-me.ts");
  expect(module).toContain(
    "export function assignToMeFits(row: { assigneeId?: unknown }, viewer: { id: string } | null): boolean {\n  return (viewer == null || row.assigneeId !== viewer.id);\n}",
  );
  expect(take("src/generated/actions/assign-to-me.server.ts")).toContain("Fits(row, viewer)");
  expect(take("src/routes/tasks/$id.tsx")).toContain("Fits(row, viewer)");
  // Ask proposing the action checks the condition with the viewer too.
  const asked = generate(
    "assignToMe",
    "{ on: Task, when: { assignee: not ME() }, set: { assignee: ME() } }",
    emptyContent(),
    "assignee: User",
    "assistant: { for: signed-in, may: change }\n",
  )("src/generated/ask.server.ts");
  expect(asked).toContain(
    "fits: assignToMeFits as (row: never, viewer: { id: string } | null) => boolean",
  );
  expect(asked).toContain("run.fits(row as never, viewer)");
  const release = generate(
    "release",
    "{ on: Task, when: { assignee: ME() }, set: { assignee: } }",
    emptyContent(),
    "assignee: User",
  );
  expect(release("src/generated/actions/release.ts")).toContain(
    "return viewer != null && row.assigneeId === viewer.id;",
  );
  const plain = generate("finish", "{ on: Task, when: { status: open }, set: { status: done } }");
  expect(plain("src/generated/actions/finish.ts")).toContain(
    'finishFits(row: { status?: unknown }, _viewer: { id: string } | null): boolean {\n  return row.status === "open";',
  );
});
