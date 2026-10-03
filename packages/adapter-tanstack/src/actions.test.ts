import {
  type AuthIR,
  emptyContent,
  type SpecIR,
  validateAuth,
  validateSpec,
} from "@smithable/core";
import { expect, test } from "vitest";
import { generateApp } from "./generate.js";

const generate = (name: string, action: string) => {
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
  const files = generateApp(ir, { smithableVersion: "0.0.0", auth, content: emptyContent() });
  return (path: string) => files.find((f) => f.path === path)?.content ?? "";
};

test("a record page whose only action is a copy has no router (the copy opens the new record)", () => {
  const copyOnly = generate("duplicate", "{ on: Task, copy: { status: open } }");
  expect(copyOnly("src/routes/tasks/$id.tsx")).toContain("duplicate");
  expect(copyOnly("src/routes/tasks/$id.tsx")).not.toContain("useRouter");
  const change = generate("finish", "{ on: Task, when: { status: open }, set: { status: done } }");
  expect(change("src/routes/tasks/$id.tsx")).toContain("await router.invalidate();");
});
