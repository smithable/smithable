import { expect, test } from "vitest";
import { applyOperation } from "../apply.js";

const spec = `smithable: 0.1
app: { name: Status }
models:
  Component:
    description: A service we run.
    fields:
      name: string!
      status: operational | degraded | down
      weight: int = 3
actions:
  markDown:
    on: Component
    set: { status: down }
pages:
  components: { crud: Component }
`;

const apply = (text: string, args: Record<string, unknown>) =>
  applyOperation({ spec: text }, "setMeaning", args);
const text = (r: ReturnType<typeof apply>) => {
  if (!r.ok) throw new Error(r.message);
  return r.files.spec;
};

test("a field's description goes in its long form, and leaves it when removed", () => {
  const explained = text(
    apply(spec, {
      concept: "Component.status",
      description: "In a question, down means any status but operational.",
    }),
  );
  expect(explained).toContain(
    "      status:\n        type: operational | degraded | down\n        description: In a question, down means any status but operational.\n",
  );
  // A default keeps its own key; the shorthand comes back when the last extra key goes.
  const weighed = text(apply(spec, { concept: "Component.weight", intent: "How much it counts." }));
  expect(weighed).toContain(
    "      weight:\n        type: int\n        default: 3\n        intent: How much it counts.\n",
  );
  const back = text(apply(weighed, { concept: "Component.weight", intent: "" }));
  expect(back).toContain("      weight: int = 3\n");
  expect(back).not.toContain("intent");
});

test("the app, a model, an action and a page take a description or an intent; empty removes", () => {
  const app = text(
    apply(spec, { concept: "app", description: "Is it working? The state of our services." }),
  );
  expect(app).toContain("description: Is it working? The state of our services.");
  const model = text(
    apply(spec, {
      concept: "Component",
      description: "A part of the service.",
      intent: "Known to everyone.",
    }),
  );
  expect(model).toContain("    description: A part of the service.\n");
  expect(model).toContain("    intent: Known to everyone.\n");
  expect(text(apply(model, { concept: "Component", description: "" }))).not.toContain(
    "A part of the service",
  );
  const action = text(
    apply(spec, { concept: "markDown", description: "Say a component is unreachable." }),
  );
  expect(action).toContain("    description: Say a component is unreachable.\n");
  const page = text(
    apply(spec, { concept: "components", intent: "A glance tells whether all is well." }),
  );
  // A page written on one line stays on one line, its intent beside its kind.
  expect(page).toContain(
    "components: { crud: Component, intent: A glance tells whether all is well. }",
  );
});

test("what is not there is refused, and so is a call that says nothing", () => {
  expect(apply(spec, { concept: "Component.colour", description: "x" })).toMatchObject({
    ok: false,
    message: 'Component has no field named "colour".',
  });
  expect(apply(spec, { concept: "Widget", description: "x" })).toMatchObject({
    ok: false,
    message: expect.stringContaining('There is no "Widget" to explain'),
  });
  expect(apply(spec, { concept: "Component" })).toMatchObject({
    ok: false,
    message: "Say a --description, an --intent, or both.",
  });
});
