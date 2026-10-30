// A custom action's examples in words, a row each (docs/design/intents.md §6, A 199): the records
// given, the input, the records after, the output, and who runs it when; read from the IR only.
import type { ActionExampleIR } from "@smithable/core";

export interface ExampleRow {
  given: string[];
  input: string[];
  after: string[];
  output: string[];
  /** Who runs it and when, and whether nothing else may change: what changes the test. */
  how: string[];
}

const value = (v: unknown): string =>
  v === null ? "empty" : Array.isArray(v) ? v.map(value).join(", ") : String(v);

/** The records of each kind, a line each: "Invoice 1: number INV-1, status sent". */
const records = (byKind?: Record<string, Record<string, unknown>[]>): string[] =>
  Object.entries(byKind ?? {}).flatMap(([kind, rows]) =>
    rows.map((row) => {
      const { id, ...rest } = row;
      const fields = Object.entries(rest).map(([k, v]) => `${k} ${value(v)}`);
      return `${kind}${id === undefined ? "" : ` ${value(id)}`}${fields.length ? `: ${fields.join(", ")}` : ""}`;
    }),
  );

export function exampleRows(examples: ActionExampleIR[]): ExampleRow[] {
  return examples.map((e) => ({
    given: records(e.given),
    input: Object.entries(e.input ?? {}).map(([k, v]) => `${k}: ${value(v)}`),
    after: records(e.after),
    // A refusal is its own word, not an empty output.
    output:
      e.output === "refused"
        ? ["refused"]
        : Object.entries(e.output ?? {}).map(([k, v]) => `${k}: ${value(v)}`),
    how: [
      ...(e.as ? [`as ${e.as}`] : []),
      ...(e.now ? [`on ${e.now}`] : []),
      ...(e.nothingElse ? ["nothing else changes"] : []),
    ],
  }));
}
