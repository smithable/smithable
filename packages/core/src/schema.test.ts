import { Ajv } from "ajv";
import { describe, expect, test } from "vitest";
import { parse } from "yaml";
import schemaText from "../schema/smithable.schema.json?raw";
import { COMPANION_SCHEMAS } from "./companion-schemas.js";
import { buildJsonSchema } from "./schema.js";

const companions = import.meta.glob("../schema/smithable.*.schema.json", {
  query: "?raw",
  import: "default",
  eager: true,
}) as Record<string, string>;

const valid = {
  ...import.meta.glob("./__fixtures__/valid/*.yml", {
    query: "?raw",
    import: "default",
    eager: true,
  }),
  ...import.meta.glob("../../../examples/*/smithable.yml", {
    query: "?raw",
    import: "default",
    eager: true,
  }),
};

// The schema's own keywords for Studio's forms (schema.ts); Ajv's strict mode wants them declared.
const validate = new Ajv({ allErrors: true })
  .addVocabulary(["x-hidden", "x-semantic", "x-docs"])
  .compile(buildJsonSchema());

test("the committed schema file is up to date (run `pnpm schema` to regenerate)", () => {
  expect(JSON.parse(schemaText)).toEqual(buildJsonSchema());
  for (const [file, schema] of Object.entries(COMPANION_SCHEMAS)) {
    const committed = companions[`../schema/${file.replace(/\.yml$/, ".schema.json")}`];
    expect(committed, file).toBeDefined();
    expect(JSON.parse(committed as string), file).toEqual(schema);
  }
});

describe("every valid spec matches the published JSON Schema", () => {
  test.each(Object.entries(valid))("%s", (_, text) => {
    expect(validate(parse(text)), JSON.stringify(validate.errors, null, 2)).toBe(true);
  });
});

describe("the JSON Schema rejects what editors should flag", () => {
  const app = "smithable: 0.1\napp: { name: X }\n";
  test.each([
    ["an unknown top-level key", `${app}foo: 1\n`],
    ["a misspelled field type", `${app}models:\n  A: { fields: { n: strng } }\n`],
    ["a reserved field name", `${app}models:\n  A: { fields: { id: string } }\n`],
    ["a lowercase model name", `${app}models:\n  a: { fields: { n: string } }\n`],
    ["a page without a pattern", `${app}pages:\n  p: { route: /p }\n`],
    ["visible text in a page", `${app}pages:\n  p: { crud: A, title: P }\n`],
  ])("%s", (_, text) => {
    expect(validate(parse(text))).toBe(false);
  });
});
