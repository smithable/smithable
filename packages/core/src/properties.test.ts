// Property-based checks (backlog A 63): files no one wrote by hand, made at random from the
// examples, never crash a validator, and a spec it cannot read always says why.
import fc from "fast-check";
import { describe, expect, test } from "vitest";
import { parse, stringify } from "yaml";
import { validateAuth } from "./auth.js";
import { validateContent } from "./content.js";
import { validateContext } from "./context-file.js";
import { validateSpec } from "./spec.js";
import { validateUx } from "./ux.js";

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

/** A text changed the way a hurried edit changes one: a line gone, doubled, moved, re-indented, or a word replaced. */
const edit = fc.record({
  how: fc.constantFrom("drop", "double", "swap", "indent", "outdent", "word", "cut"),
  at: fc.nat(),
  word: fc.oneof(
    fc.string({ maxLength: 12 }),
    fc.constantFrom(
      "",
      "null",
      "~",
      "[]",
      "{}",
      "-",
      ":",
      "true",
      "0",
      "-1",
      "1e999",
      "&a",
      "*a",
      "!!str",
      "{x",
      '"',
    ),
  ),
});
function edited(text: string, edits: { how: string; at: number; word: string }[]): string {
  const lines = text.split("\n");
  for (const { how, at, word } of edits) {
    const i = at % lines.length;
    const line = lines[i] ?? "";
    if (how === "drop") lines.splice(i, 1);
    else if (how === "double") lines.splice(i, 0, line);
    else if (how === "swap")
      [lines[i], lines[(i + 1) % lines.length]] = [lines[(i + 1) % lines.length] ?? "", line];
    else if (how === "indent") lines[i] = `  ${line}`;
    else if (how === "outdent") lines[i] = line.replace(/^ {1,2}/, "");
    else if (how === "cut") lines[i] = line.slice(0, at % (line.length + 1));
    else {
      const words = line.split(/(\s+|:|,)/);
      words[at % words.length] = word;
      lines[i] = words.join("");
    }
    if (!lines.length) lines.push("");
  }
  return lines.join("\n");
}
const edits = fc.array(edit, { minLength: 1, maxLength: 4 });
/** Any text at all, and any YAML at all: the far ends of what a file can be. */
const anyText = fc.oneof(
  fc.string({ maxLength: 200 }),
  fc.jsonValue({ maxDepth: 4 }).map((v) => stringify(v)),
);
/** The weekly long run multiplies every property's cases (and their time) by FC_SCALE. */
const SCALE = Number(import.meta.env.FC_SCALE ?? 1);
// More with FC_RUNS=3000 to hunt, FC_SEED for other cases; a gate tries the same few hundred.
const runs = {
  numRuns: Number(import.meta.env.FC_RUNS ?? 150 * SCALE),
  seed: Number(import.meta.env.FC_SEED ?? 1),
};

describe.each(examples)("%s", (example) => {
  const spec = fileOf(example, "") as string;
  const ir = validateSpec({ path: "smithable.yml", text: spec }).ir;
  if (!ir) throw new Error(`${example} is invalid`);

  test(
    "an edited spec is read or refused with a reason, never a crash",
    () => {
      fc.assert(
        fc.property(edits, (e) => {
          const result = validateSpec({ path: "smithable.yml", text: edited(spec, e) });
          if (!result.ir) expect(result.diagnostics.some((d) => d.severity === "error")).toBe(true);
        }),
        runs,
      );
      // Hundreds of runs over a whole spec: seconds on a loaded machine, so not vitest's five.
    },
    60_000 * SCALE,
  );

  test.each(["auth", "ux", "content", "context"])(
    "an edited %s file never crashes its validator",
    (kind) => {
      const text = fileOf(example, kind);
      if (text === undefined) return;
      const check = (t: string) => {
        const file = { path: `smithable.${kind}.yml`, text: t };
        if (kind === "auth") return validateAuth(file, ir).diagnostics;
        if (kind === "ux") return validateUx(file, ir).diagnostics;
        if (kind === "content") return validateContent(file, ir).diagnostics;
        return validateContext(file);
      };
      fc.assert(
        fc.property(edits, (e) => {
          expect(Array.isArray(check(edited(text, e)))).toBe(true);
        }),
        runs,
      );
    },
    60_000 * SCALE,
  );
});

test(
  "any text or YAML as any file: a reason, never a crash",
  () => {
    const ir = validateSpec({ path: "smithable.yml", text: fileOf("crm", "") as string }).ir;
    if (!ir) throw new Error("crm is invalid");
    fc.assert(
      fc.property(anyText, (text) => {
        const spec = validateSpec({ path: "smithable.yml", text });
        if (!spec.ir) expect(spec.diagnostics.length).toBeGreaterThan(0);
        validateAuth({ path: "smithable.auth.yml", text }, ir);
        validateUx({ path: "smithable.ux.yml", text }, ir);
        validateContent({ path: "smithable.content.yml", text }, ir);
        validateContext({ path: "smithable.context.yml", text });
      }),
      // Found by this test: an alias with no anchor crashed the context file's validator.
      {
        numRuns: Number(import.meta.env.FC_RUNS ?? 300 * SCALE),
        seed: Number(import.meta.env.FC_SEED ?? 1),
        examples: [["*!"], ["a: *x"]],
      },
    );
  },
  60_000 * SCALE,
);

/**
 * A change to the files' shape rather than their text, in any of the four at once: a key added
 * or removed, two values swapped, a value of the wrong kind, a model renamed in the spec so the
 * companions name one that is gone (C 67).
 */
const mutation = fc.record({
  file: fc.constantFrom("spec", "auth", "ux", "content"),
  how: fc.constantFrom("add", "remove", "swap", "kind", "rename"),
  at: fc.nat(),
  at2: fc.nat(),
  value: fc.oneof(
    fc.string({ maxLength: 8 }),
    fc.integer(),
    fc.boolean(),
    fc.constant(null),
    fc.constant([]),
    fc.constant({}),
  ),
});

type Node = Record<string, unknown> | unknown[];
const isNode = (v: unknown): v is Node => typeof v === "object" && v !== null;

/** Every place in a document a value sits: its container and its key. */
function places(doc: unknown): { in: Node; key: string | number }[] {
  const out: { in: Node; key: string | number }[] = [];
  const walk = (node: unknown) => {
    if (!isNode(node)) return;
    for (const key of Array.isArray(node) ? node.keys() : Object.keys(node)) {
      out.push({ in: node, key });
      walk((node as Record<string | number, unknown>)[key]);
    }
  };
  walk(doc);
  return out;
}

function mutate(doc: unknown, m: MutationValue): void {
  // A fresh copy each time: fast-check's constants are one object, and two places holding it make a cycle.
  m = { ...m, value: JSON.parse(JSON.stringify(m.value)) };
  const all = places(doc);
  if (!all.length) return;
  const one = all[m.at % all.length] as { in: Node; key: string | number };
  const get = (p: { in: Node; key: string | number }) =>
    (p.in as Record<string | number, unknown>)[p.key];
  const set = (p: { in: Node; key: string | number }, v: unknown) => {
    (p.in as Record<string | number, unknown>)[p.key] = v;
  };
  if (m.how === "add") {
    const at = get(one);
    if (Array.isArray(at)) at.push(m.value);
    else if (isNode(at)) (at as Record<string, unknown>)[`x${m.at2 % 7}`] = m.value;
    else set(one, m.value);
  } else if (m.how === "remove") {
    if (Array.isArray(one.in)) one.in.splice(Number(one.key), 1);
    else delete one.in[one.key as string];
  } else if (m.how === "swap") {
    const other = all[m.at2 % all.length] as { in: Node; key: string | number };
    const a = get(one);
    set(one, get(other));
    set(other, a);
  } else if (m.how === "kind") set(one, m.value);
  else {
    const models = (doc as { models?: Record<string, unknown> })?.models;
    if (!isNode(models) || Array.isArray(models)) return;
    const names = Object.keys(models);
    const name = names[m.at % names.length];
    if (!name) return;
    models[`${name}Gone`] = models[name];
    delete models[name];
  }
}
type MutationValue = {
  file: string;
  how: string;
  at: number;
  at2: number;
  value: unknown;
};

describe.each(examples)("%s, its files changed together", (example) => {
  test(
    "the spec and its companions changed in shape: read or refused with a reason, never a crash",
    () => {
      fc.assert(
        fc.property(fc.array(mutation, { minLength: 1, maxLength: 5 }), (ms) => {
          const docs: Record<string, unknown> = {};
          for (const kind of ["spec", "auth", "ux", "content"]) {
            const text = fileOf(example, kind === "spec" ? "" : kind);
            docs[kind] = text === undefined ? undefined : parse(text);
          }
          for (const m of ms)
            if (docs[m.file] !== undefined) mutate(docs[m.file], m as MutationValue);
          const text = (kind: string) =>
            docs[kind] === undefined ? undefined : stringify(docs[kind]);
          const spec = validateSpec({ path: "smithable.yml", text: text("spec") ?? "" });
          if (!spec.ir) {
            expect(spec.diagnostics.some((d) => d.severity === "error")).toBe(true);
            return;
          }
          const ir = spec.ir;
          for (const [kind, check] of [
            [
              "auth",
              (t: string) => validateAuth({ path: "smithable.auth.yml", text: t }, ir).diagnostics,
            ],
            [
              "ux",
              (t: string) => validateUx({ path: "smithable.ux.yml", text: t }, ir).diagnostics,
            ],
            [
              "content",
              (t: string) =>
                validateContent({ path: "smithable.content.yml", text: t }, ir).diagnostics,
            ],
          ] as const) {
            const t = text(kind);
            if (t !== undefined) expect(Array.isArray(check(t))).toBe(true);
          }
        }),
        runs,
      );
    },
    60_000 * SCALE,
  );
});
