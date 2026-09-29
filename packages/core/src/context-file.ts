// smithable.context.yml (ARCHITECTURE §3.4): how the app is built. Checked against its JSON
// Schema like the other companions; the CLI reads its plugins and packages.
import { isMap, LineCounter, parseDocument } from "yaml";
import { ParseContext } from "./context.js";
import type { Diagnostic } from "./diagnostics.js";
import { checkJson } from "./plugin.js";
import type { JsonSchema } from "./section.js";

const strings: JsonSchema = { type: "array", items: { type: "string" } };

export const CONTEXT_SCHEMA: JsonSchema = {
  type: "object",
  required: ["smithableContext"],
  additionalProperties: false,
  properties: {
    smithableContext: { enum: [0.1] },
    adapter: { type: "string" },
    database: { type: "string" },
    conventions: strings,
    guidance: { type: "string" },
    plugins: strings,
    packages: { type: "object", additionalProperties: { type: ["string", "number"] } },
    ai: {
      type: "object",
      additionalProperties: false,
      properties: {
        policy: { enum: ["local-only", "eu-only", "best-available", "custom"] },
        allow: strings,
      },
    },
  },
};

/** Checks smithable.context.yml; each problem is placed on the top-level key it is under. */
export function validateContext(file: { path: string; text: string }): Diagnostic[] {
  const lines = new LineCounter();
  const doc = parseDocument(file.text, {
    lineCounter: lines,
    uniqueKeys: true,
    prettyErrors: false,
  });
  const ctx = new ParseContext(file.path, lines);
  for (const error of doc.errors)
    ctx.errorAtOffset(error.pos[0], "yaml-syntax", error.message.split("\n")[0] ?? "");
  if (doc.errors.length) return ctx.diagnostics;
  const keys = isMap(doc.contents) ? doc.contents.items : [];
  for (const problem of checkJson(CONTEXT_SCHEMA, doc.toJSON() ?? {}, "")) {
    const key = /^"?([^".[]+)/.exec(problem.replace(/^Unknown key /, ""))?.[1];
    const node = keys.find((p) => (p.key as { value?: unknown }).value === key)?.key as
      | { range?: [number, number] }
      | undefined;
    ctx.errorAtOffset(
      node?.range?.[0] ?? 0,
      "invalid-context",
      `smithable.context.yml: ${problem}`,
    );
  }
  return ctx.diagnostics;
}
