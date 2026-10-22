// Property-based checks (backlog A 63): files no one wrote by hand, made at random from the
// examples, never crash a validator, and a spec it cannot read always says why.
import fc from "fast-check";
import { describe, expect, test } from "vitest";
import { stringify } from "yaml";
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
// More with FC_RUNS=3000 to hunt, FC_SEED for other cases; a gate tries the same few hundred.
const runs = {
  numRuns: Number(import.meta.env.FC_RUNS ?? 150),
  seed: Number(import.meta.env.FC_SEED ?? 1),
};

describe.each(examples)("%s", (example) => {
  const spec = fileOf(example, "") as string;
  const ir = validateSpec({ path: "smithable.yml", text: spec }).ir;
  if (!ir) throw new Error(`${example} is invalid`);

  test("an edited spec is read or refused with a reason, never a crash", () => {
    fc.assert(
      fc.property(edits, (e) => {
        const result = validateSpec({ path: "smithable.yml", text: edited(spec, e) });
        if (!result.ir) expect(result.diagnostics.some((d) => d.severity === "error")).toBe(true);
      }),
      runs,
    );
    // Hundreds of runs over a whole spec: seconds on a loaded machine, so not vitest's five.
  }, 60_000);

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
    60_000,
  );
});

test("any text or YAML as any file: a reason, never a crash", () => {
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
      numRuns: Number(import.meta.env.FC_RUNS ?? 300),
      seed: Number(import.meta.env.FC_SEED ?? 1),
      examples: [["*!"], ["a: *x"]],
    },
  );
});
