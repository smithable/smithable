// Part of the TanStack adapter's generator (generate.ts), split out by concern (C7): a custom
// action's examples as a test the app runs (docs/design/intents.md §6).
import {
  type AuthIR,
  type CustomActionIR,
  type FieldIR,
  type FieldValue,
  kebab,
  type ModelIR,
  type SpecIR,
  USER_MODEL,
} from "@smithable/core";
import { actionNames } from "./actions.js";
import { hasSignIn } from "./auth.js";
import { sampleRows } from "./sample-data.js";
import { dependencyOrder } from "./schema.js";
import { dataKey, HEADER, modelNamed, ownerKey, SCHEMA_IMPORT, tableRef } from "./shared.js";

type Value = FieldValue | null | FieldValue[];

/**
 * A value of an example as code, as the app stores it: an amount in cents, a date and time as a
 * Date, a reference as the id its record got (the example's own ids are mapped), a list of ids
 * each mapped.
 */
function valueCode(field: FieldIR, value: Value, viewer: string): string {
  if (value === null || value === undefined) return "null";
  if (field.type.kind === "relation") {
    if (field.type.model === USER_MODEL) return viewer;
    const target = field.type.model;
    return Array.isArray(value)
      ? `[${value.map((v) => `id(${JSON.stringify(target)}, ${JSON.stringify(v)})`).join(", ")}]`
      : `id(${JSON.stringify(target)}, ${JSON.stringify(value)})`;
  }
  if (field.type.kind === "scalar" && field.type.name === "money")
    return String(Math.round(Number(value) * 100));
  if (field.type.kind === "scalar" && field.type.name === "datetime")
    return `new Date(${JSON.stringify(value)})`;
  return JSON.stringify(value);
}

/**
 * The test file of a custom action's examples (src/generated/actions/<name>.test.ts): each
 * example in an empty database, its given records seeded with their ids mapped (a required field
 * left out takes the sample data's value for its kind), the clock at `now`, the action run as a
 * person of the role `as` (an administrator when left out), then the output and the records
 * checked as `output`, `after` and `nothingElse` say. Undefined without examples.
 */
export function examplesTest(action: CustomActionIR, ir: SpecIR, auth: AuthIR): string | undefined {
  if (!action.examples?.length) return undefined;
  const a = actionNames(action);
  const ordered = dependencyOrder(ir.models);
  const signedIn = hasSignIn(auth);
  const insertOf = (model: ModelIR, row: Record<string, Value>, i: number) => {
    // A required field left out: the sample data's value for its kind (a reference, the first
    // record given of its model).
    const sample = sampleRows(model)[0] ?? {};
    const entries = model.fields
      .filter((f) => !f.formula && !(f.type.kind === "relation" && f.type.many))
      .flatMap((f) => {
        if (f.name in row)
          return [`${dataKey(f)}: ${valueCode(f, row[f.name] as Value, "viewer.id")}`];
        if (!f.required || f.default !== undefined) return [];
        if (f.type.kind === "relation")
          return [
            `${dataKey(f)}: ${f.type.model === USER_MODEL ? "viewer.id" : `first(${JSON.stringify(f.type.model)})`}`,
          ];
        return [`${dataKey(f)}: ${JSON.stringify(sample[f.name] ?? null)}`];
      });
    const owner = signedIn && !model.ownedBy ? `, ${ownerKey(model)}: viewer.id` : "";
    const key = row.id === undefined ? `"#${i}"` : JSON.stringify(row.id);
    return `  given(${JSON.stringify(model.name)}, ${key}, db.insert(${tableRef(model)}).values({ ${entries.join(", ")}${owner} } as never).returning().get().id);`;
  };
  const tests = action.examples.map((example, i) => {
    const seeded = ordered.flatMap((model) =>
      (example.given[model.name] ?? []).map((row, k) => insertOf(model, row, k)),
    );
    const input = Object.entries(example.input ?? {}).map(([name, value]) => {
      const field = action.input.find((f) => f.name === name) as FieldIR;
      return `${name}: ${valueCode(field, value, "viewer.id")}`;
    });
    const run = `${a.run}(viewer, { ${input.join(", ")} } as never)`;
    const output =
      example.output === "refused"
        ? `  await expect(${run}).rejects.toThrow();`
        : example.output
          ? `  expect(await ${run}).toMatchObject({ ${Object.entries(example.output)
              .map(([name, value]) => {
                const field = (action.output ?? []).find((f) => f.name === name) as FieldIR;
                return `${name}: ${valueCode(field, value, "viewer.id")}`;
              })
              .join(", ")} });`
          : `  await ${run};`;
    // The records after: one with an id is that record; one without, some record of its model.
    const named = Object.entries(example.after ?? {}).flatMap(([name, rows]) => {
      const model = modelNamed(ir, name);
      return rows.map((row) => {
        const fields = Object.entries(row)
          .filter(([key]) => key !== "id")
          .map(([key, value]) => {
            const field = model.fields.find((f) => f.name === key) as FieldIR;
            return `${dataKey(field)}: ${valueCode(field, value, "viewer.id")}`;
          });
        return row.id === undefined
          ? `  expect(named(${JSON.stringify(name)}, db.select().from(${tableRef(model)}).all(), { ${fields.join(", ")} }), ${JSON.stringify(`no ${name} with ${JSON.stringify(Object.fromEntries(Object.entries(row).filter(([k]) => k !== "id")))}`)}).toBe(true);`
          : `  expect(db.select().from(${tableRef(model)}).all().find((r) => r.id === id(${JSON.stringify(name)}, ${JSON.stringify(row.id)}))).toMatchObject({ ${fields.join(", ")} });`;
      });
    });
    // What "after" names, as stored values: "nothing else" passes over these.
    const after = Object.entries(example.after ?? {}).map(([name, rows]) => {
      const model = modelNamed(ir, name);
      return `${JSON.stringify(name)}: [${rows
        .map(
          (row) =>
            `{ ${Object.entries(row)
              .map(([key, value]) => {
                if (key === "id")
                  return `id: id(${JSON.stringify(name)}, ${JSON.stringify(value)})`;
                const field = model.fields.find((f) => f.name === key) as FieldIR;
                return `${dataKey(field)}: ${valueCode(field, value, "viewer.id")}`;
              })
              .join(", ")} }`,
        )
        .join(", ")}]`;
    });
    const said = [
      ...(example.as ? [`as ${example.as}`] : []),
      ...(example.now ? [`at ${example.now}`] : []),
    ].join(", ");
    return `test(${JSON.stringify(`example ${i + 1} of ${action.name}${said ? ` (${said})` : ""}`)}, async () => {
${example.now ? `  vi.useFakeTimers({ now: new Date(${JSON.stringify(example.now.length === 10 ? `${example.now}T00:00:00Z` : example.now)}), toFake: ["Date"] });\n` : ""}  empty();
  const viewer = person(${JSON.stringify(example.as ?? "admin")});
${seeded.join("\n")}
${example.nothingElse ? "  const before = snapshot();\n" : ""}${output}
${named.join("\n")}${
  example.nothingElse
    ? `
  // Nothing else: every record not named in "after" is as it was, and none came or went.
  expect(unnamed(before, snapshot(), { ${after.join(", ")} })).toEqual([]);`
    : ""
}
});`;
  });
  const tables = [...ordered].reverse();
  const body = tests.join("\n\n");
  const uses = (name: string) => new RegExp(`\\b${name}\\(`).test(body);
  const helpers = [
    `/** Each model's records the example gave, by the example's own id: the ids they got. */
const ids = new Map<string, Map<unknown, number>>();
/** Notes the id a given record got. */
function given(model: string, key: unknown, got: number) {
  ids.set(model, (ids.get(model) ?? new Map()).set(key, got));
}`,
    uses("id")
      ? `/** The id the example's record of a model got. */
function id(model: string, key: unknown): number {
  const got = ids.get(model)?.get(key);
  if (got === undefined) throw new Error(\`The example gives no \${model} \${String(key)}.\`);
  return got;
}`
      : "",
    uses("first")
      ? `/** The first record given of a model: what a required reference left out points to. */
function first(model: string): number {
  const got = [...(ids.get(model)?.values() ?? [])][0];
  if (got === undefined) throw new Error(\`A \${model} is needed: give one in the example.\`);
  return got;
}`
      : "",
    `/** Every record of the app's models goes: an example starts from an empty database. */
function empty() {
  ids.clear();
  for (const table of Object.values(TABLES)) db.delete(table as never).run();
}
let people = 0;
/** A person of the role, signed in. */
function person(role: string) {
  const n = ++people;
  const viewer = { id: \`example-\${n}\`, name: \`Example \${role}\`, email: \`example\${n}@example.com\`, role };
  db.insert(schema.user).values(viewer).run();
  return viewer;
}`,
    uses("named")
      ? `/** Whether some record has every value named. */
function named(_model: string, rows: Record<string, unknown>[], values: Record<string, unknown>) {
  return rows.some((row) => Object.entries(values).every(([key, value]) => JSON.stringify(row[key]) === JSON.stringify(value)));
}`
      : "",
    uses("snapshot")
      ? `/** Every record of the app's models, by model and id. */
function snapshot() {
  return Object.fromEntries(
    Object.entries(TABLES).map(([model, table]) => [model, new Map(db.select().from(table as never).all().map((row: Record<string, unknown>) => [row.id as number, JSON.stringify(row)]))]),
  );
}
/**
 * The records that came, went or changed and that "after" does not name (by their id, or by
 * their values).
 */
function unnamed(
  before: ReturnType<typeof snapshot>,
  now: ReturnType<typeof snapshot>,
  after: Record<string, Record<string, unknown>[]>,
): string[] {
  const mentioned = (model: string, key: number, row: string) =>
    (after[model] ?? []).some((values) =>
      "id" in values
        ? values.id === key
        : Object.entries(values).every(([k, v]) => JSON.stringify(JSON.parse(row)[k]) === JSON.stringify(v)),
    );
  const out: string[] = [];
  for (const [model, rows] of Object.entries(now)) {
    const was = before[model] ?? new Map();
    for (const [key, row] of rows) if (was.get(key) !== row && !mentioned(model, key, row)) out.push(\`\${model} \${key}\`);
    for (const key of was.keys()) if (!rows.has(key)) out.push(\`\${model} \${key} (gone)\`);
  }
  return out;
}`
      : "",
  ].filter(Boolean);
  const clock = body.includes("vi.useFakeTimers");
  return `${HEADER}// The examples of the "${action.name}" action in smithable.yml, as tests (docs/design/intents.md §6).
import { ${clock ? "afterEach, " : ""}expect, test${clock ? ", vi" : ""} } from "vitest";
import { db } from "#/db";
${SCHEMA_IMPORT}
import { ${a.run} } from "./${kebab(action.name)}.server";

/** The app's tables, records that refer to others first: what an example empties. */
const TABLES = { ${tables.map((m) => `${JSON.stringify(m.name)}: ${tableRef(m)}`).join(", ")} };

${helpers.join("\n\n")}
${clock ? "\nafterEach(() => {\n  vi.useRealTimers();\n});\n" : ""}
${body}
`;
}
