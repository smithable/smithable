import { Ajv } from "ajv";
import { describe, expect, test } from "vitest";
import { parse } from "yaml";
import schemaText from "../schema/smithable.schema.json?raw";
import { COMPANION_SCHEMAS } from "./companion-schemas.js";
import { buildJsonSchema } from "./schema.js";
import { buildThemeSchema } from "./theme-schema.js";

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
  .addVocabulary(["x-hidden", "x-suggest", "x-examples", "x-unset", "x-semantic", "x-docs"])
  .compile(buildJsonSchema());

test("the committed schema file is up to date (run `pnpm schema` to regenerate)", () => {
  expect(JSON.parse(schemaText)).toEqual(buildJsonSchema());
  expect(JSON.parse(companions["../schema/smithable.theme.schema.json"] as string)).toEqual(
    buildThemeSchema(),
  );
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

test("the content schema takes a film in one of its two forms only (readFilm; T1557)", () => {
  const check = new Ajv({ allErrors: true, strict: false }).compile(
    COMPANION_SCHEMAS["smithable.content.yml"] as object,
  );
  const ok = (film: unknown) =>
    check({
      smithableContent: 0.1,
      pages: {
        home: { hero: { title: "Roofs", image: { src: "images/hero.webp", alt: "A roof", film } } },
      },
    });
  const id = "m_01hz8k3q4r5s6t7v8w9x0y1z2a";
  expect(ok({ src: "images/hero.mp4" }), JSON.stringify(check.errors)).toBe(true);
  expect(
    ok({ asset: id, heights: [720, 1080], generated: true }),
    JSON.stringify(check.errors),
  ).toBe(true);
  for (const film of [
    {},
    { asset: id },
    { heights: [720] },
    { src: "images/hero.mp4", asset: id, heights: [720] },
    { src: "images/hero.mp4", heights: [720] },
    { src: "images/hero.mp4", asset: id },
  ])
    expect(ok(film), JSON.stringify(film)).toBe(false);
});
