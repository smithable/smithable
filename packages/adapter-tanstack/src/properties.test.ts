// Property-based checks (backlog A 63): random sequences of operations on the examples. An
// operation is applied or refused with a reason, never a crash; what it writes is a valid
// project; the app generated from it is byte-identical each time; and the files it started from
// still generate what they did, so going back (an undo restores them) is clean.
import {
  type AuthIR,
  applyOperation,
  type JsonSchema,
  OPERATIONS,
  type ProjectFiles,
  type SpecIR,
  validateAuth,
  validateContent,
  validateSpec,
  validateUx,
} from "@smithable/core";
import fc from "fast-check";
import { describe, expect, test } from "vitest";
import { generateApp } from "./generate.js";

const raw = import.meta.glob("../../../examples/*/smithable*.yml", {
  query: "?raw",
  import: "default",
  eager: true,
}) as Record<string, string>;
const examples = Object.keys(raw)
  .filter((p) => p.endsWith("/smithable.yml"))
  .map((p) => p.split("/").at(-2) as string);
const fileOf = (example: string, kind: string) =>
  raw[`../../../examples/${example}/smithable${kind ? `.${kind}` : ""}.yml`];

function irOf(files: ProjectFiles): { ir: SpecIR; auth: AuthIR } {
  const ir = validateSpec({ path: "smithable.yml", text: files.spec }).ir;
  const auth =
    files.auth && validateAuth({ path: "smithable.auth.yml", text: files.auth }, ir).auth;
  if (!ir || !auth) throw new Error("an operation left the project invalid");
  return { ir, auth };
}

function generate(files: ProjectFiles) {
  const { ir, auth } = irOf(files);
  const content = files.content
    ? validateContent({ path: "smithable.content.yml", text: files.content }, ir).content
    : undefined;
  const ux = files.ux ? validateUx({ path: "smithable.ux.yml", text: files.ux }, ir).ux : undefined;
  return generateApp(ir, {
    smithableVersion: "0.0.0",
    auth,
    ...(content ? { content } : {}),
    ...(ux ? { ux } : {}),
  });
}

/** The names the spec has, for arguments that name something, with a few it does not have. */
function names(ir: SpecIR, auth: AuthIR) {
  const fields = ir.models.flatMap((m) => m.fields);
  return {
    model: ir.models.map((m) => m.name),
    field: fields.map((f) => f.name),
    page: ir.pages.map((p) => p.id),
    role: auth.roles.map((r) => r.name),
    choiceValue: fields.flatMap((f) => (f.type.kind === "choice" ? f.type.values : [])),
    outgoing: (ir.outgoing ?? []).map((o) => o.name),
    menu: ["main"],
    section: ["hero", "features"],
    grantNames: [...ir.models.map((m) => m.name), ...ir.pages.map((p) => p.id), "all"],
    text: [
      "note",
      "Thing",
      "status",
      "phone",
      "string!",
      "draft | sent",
      "a b",
      "",
      "x".repeat(70),
    ],
  } as Record<string, string[]>;
}

/** An argument's value from its schema, chosen by the next number of `pick`; a field (or a
 * choice) of the model another argument names, when it says so. */
function value(
  schema: JsonSchema,
  known: Record<string, string[]>,
  pick: () => number,
  ir: SpecIR,
  args: Record<string, unknown>,
): unknown {
  const s = schema as {
    type?: string | string[];
    enum?: unknown[];
    items?: JsonSchema;
    "x-smithable"?: { ref: string; model?: string; page?: string; field?: string };
  };
  const choose = <T>(list: T[]) => list[pick() % list.length] as T;
  if (s.enum) return choose(s.enum);
  const ref = s["x-smithable"]?.ref;
  const by = s["x-smithable"];
  const modelName = by?.model
    ? args[by.model]
    : by?.page
      ? (ir.pages.find((p) => p.id === args[by.page as string])?.pattern as { model?: string })
          ?.model
      : undefined;
  const model = ir.models.find((m) => m.name === modelName);
  if (model && ref === "field" && pick() % 4 !== 0)
    known = { ...known, field: model.fields.map((f) => f.name) };
  const field = model?.fields.find((f) => f.name === args[by?.field ?? ""]);
  if (ref === "choiceValue" && field?.type.kind === "choice")
    known = { ...known, choiceValue: field.type.values };
  const type = Array.isArray(s.type) ? choose(s.type) : s.type;
  // The spec's own names three times in four, so most operations get somewhere.
  const own = known[ref ?? ""] ?? [];
  const word = () => choose(own.length && pick() % 4 !== 0 ? own : (known.text as string[]));
  if (type === "array") return Array.from({ length: pick() % 3 }, word);
  if (type === "boolean") return pick() % 2 === 0;
  if (type === "integer" || type === "number") return choose([0, 1, 2, 5, 100, -1]);
  if (type === "object") return {};
  return word();
}

function argsFor(
  op: (typeof OPERATIONS)[number],
  ir: SpecIR,
  known: Record<string, string[]>,
  pick: () => number,
) {
  const schema = op.schema as { properties?: Record<string, JsonSchema>; required?: string[] };
  const args: Record<string, unknown> = {};
  for (const [name, s] of Object.entries(schema.properties ?? {}))
    if (schema.required?.includes(name) || pick() % 2 === 0)
      args[name] = value(s, known, pick, ir, args);
  return args;
}

/**
 * The runs, and a fixed seed, so a gate always tries the same cases: FC_SEED (with FC_PATH, as a
 * failure prints them) tries others or one again, FC_RUNS more of them.
 */
const fcOptions = (runs: number) => ({
  numRuns: Number(import.meta.env.FC_RUNS ?? runs),
  seed: Number(import.meta.env.FC_SEED ?? 1),
  ...(import.meta.env.FC_PATH ? { path: import.meta.env.FC_PATH } : {}),
});

const steps = fc.array(fc.array(fc.nat(), { minLength: 24, maxLength: 24 }), {
  minLength: 1,
  maxLength: 6,
});

describe.each(examples)("%s", (example) => {
  const start: ProjectFiles = {
    spec: fileOf(example, "") as string,
    ...Object.fromEntries(
      ["auth", "ux", "content", "context"].flatMap((k) =>
        fileOf(example, k) === undefined ? [] : [[k, fileOf(example, k)]],
      ),
    ),
  };
  const before = generate(start);

  test("random operations: applied or refused, never a crash; the app generated the same each time", () => {
    let applied = 0;
    fc.assert(
      fc.property(steps, (seq) => {
        let files = start;
        for (const numbers of seq) {
          let i = 0;
          const pick = () => numbers[i++ % numbers.length] as number;
          const op = OPERATIONS[pick() % OPERATIONS.length] as (typeof OPERATIONS)[number];
          const { ir, auth } = irOf(files);
          const args = argsFor(op, ir, names(ir, auth), pick);
          const result = applyOperation(files, op.name, args as never);
          if (!result.ok) {
            expect(result.message.length, `${op.name} refused without a reason`).toBeGreaterThan(0);
            continue;
          }
          applied++;
          files = { ...files, ...result.files };
        }
        if (files !== start) expect(generate(files)).toEqual(generate(files));
      }),
      // More with FC_RUNS=400 to hunt; a gate's few dozen keep the suite quick.
      fcOptions(40),
    );
    // Some sequences change something, or the property tests nothing.
    expect(applied).toBeGreaterThan(0);
    // Nothing an operation did reached the files it started from.
    expect(generate(start)).toEqual(before);
  }, 60_000);
});

test("a hero shortcut to the review page gets its shield icon (found by this test, 2026-10-12)", () => {
  const files: ProjectFiles = {
    spec: fileOf("marketplace", "") as string,
    auth: fileOf("marketplace", "auth") as string,
  };
  const result = applyOperation(files, "setShortcuts", {
    page: "home",
    pages: ["review"],
  } as never);
  if (!result.ok) throw new Error(result.message);
  const made = generate({ ...files, ...result.files });
  expect(
    made.some((f) => f.content.includes('label: pageUi["review"].title, icon: Shield }')),
  ).toBe(true);
});
