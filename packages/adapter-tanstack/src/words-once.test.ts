import {
  type ContentIR,
  emptyContent,
  type SpecIR,
  validateAuth,
  validateContent,
  validateSpec,
  validateUx,
} from "@smithable/core";
import { expect, test } from "vitest";
import { roleLabels } from "./auth.js";
import { generateApp } from "./generate.js";

// docs/design/words-once.md §2: a word the app uses in more than one file is written once, in a
// generated module, and imported where it is used.

const files = import.meta.glob("../../../examples/{crm,booking}/smithable*.yml", {
  query: "?raw",
  import: "default",
  eager: true,
}) as Record<string, string>;

const read = (starter: string, name: string) =>
  files[`../../../examples/${starter}/${name}`] as string;

/** The string literals of a file of code, by value. */
function literals(code: string): Set<string> {
  const found = new Set<string>();
  for (const [quoted] of code.matchAll(/"(?:[^"\\\n]|\\.)*"/g)) {
    try {
      found.add(JSON.parse(quoted));
    } catch {}
  }
  return found;
}

test.each(["crm", "booking"])(
  "the %s starter writes each page title, the app's name, a role's label and a choice's label in one file",
  (starter) => {
    const ir = validateSpec({ path: "smithable.yml", text: read(starter, "smithable.yml") })
      .ir as SpecIR;
    const auth = validateAuth(
      { path: "smithable.auth.yml", text: read(starter, "smithable.auth.yml") },
      ir,
    ).auth;
    const ux = validateUx(
      { path: "smithable.ux.yml", text: read(starter, "smithable.ux.yml") },
      ir,
    ).ux;
    const content: ContentIR =
      validateContent(
        { path: "smithable.content.yml", text: read(starter, "smithable.content.yml") },
        ir,
      ).content ?? emptyContent();
    if (!auth) throw new Error(`${starter}'s auth file is invalid`);
    // Words no other text happens to share: a page's title is not its kind's plural.
    const pages = ir.pages.map((p) => p.id);
    const choices = ir.models.flatMap((m) =>
      m.fields.flatMap((f) =>
        f.type.kind === "choice" ? f.type.values.map((v) => [m.name, f.name, v] as const) : [],
      ),
    );
    const words: ContentIR = {
      ...content,
      pages: Object.fromEntries(
        pages.map((id) => [id, { ...content.pages[id], title: `Page title ${id}` }]),
      ),
      models: Object.fromEntries(
        ir.models.map((m) => {
          const own = content.models[m.name];
          const fields = Object.fromEntries(
            m.fields.map((f) => [
              f.name,
              {
                ...own?.fields[f.name],
                ...(f.type.kind === "choice"
                  ? {
                      values: Object.fromEntries(
                        f.type.values.map((v) => [v, `Choice ${m.name}.${f.name}.${v}`]),
                      ),
                    }
                  : {}),
              },
            ]),
          );
          return [m.name, { ...own, fields }];
        }),
      ),
    };
    const named = { ...ir, app: { ...ir.app, name: "The app's own name" } };
    const generated = generateApp(named, {
      smithableVersion: "0.0.0",
      auth,
      ux,
      content: words,
    }).filter((f) => f.zone !== "kit" && /\.tsx?$/.test(f.path) && !f.path.endsWith(".test.ts"));
    const where = (value: string) =>
      generated.filter((f) => literals(f.content).has(value)).map((f) => f.path);
    const values = [
      named.app.name,
      ...pages.map((id) => `Page title ${id}`),
      ...Object.values(roleLabels(auth)),
      ...choices.map(([m, f, v]) => `Choice ${m}.${f}.${v}`),
    ];
    expect(choices.length).toBeGreaterThan(0);
    const twice = values
      .map((value) => [value, where(value)] as const)
      .filter(([, paths]) => paths.length > 1);
    expect(twice).toEqual([]);
  },
);
