import { Ajv } from "ajv";
import { expect, test } from "vitest";
import { parse } from "yaml";
import { applyOperation } from "./apply.js";
import { validateAuth } from "./auth.js";
import { validateSpec } from "./spec.js";
import { BUILT_IN_THEMES, parseTheme, type ThemeIR } from "./theme.js";
import type { ThemeUxDefaults } from "./theme-default-schema.js";
import { THEME_DEFAULT_TREE, themeDefaultsSchema } from "./theme-default-schema.js";
import { buildThemeSchema } from "./theme-schema.js";
import { emptyUx, validateUx } from "./ux.js";
import { UX_CAPABILITIES, type UxCapability } from "./ux-capabilities.js";

const files = import.meta.glob("../../../examples/booking/*.yml", {
  query: "?raw",
  import: "default",
  eager: true,
}) as Record<string, string>;
const specText = files["../../../examples/booking/smithable.yml"] as string;
const authText = files["../../../examples/booking/smithable.auth.yml"] as string;
const ir = validateSpec({ path: "smithable.yml", text: specText }).ir;
if (!ir) throw new Error("invalid fixture");
const auth = validateAuth({ path: "smithable.auth.yml", text: authText }, ir).auth;
const base = BUILT_IN_THEMES[0];
if (!base) throw new Error("missing theme");
const direction: ThemeIR & { defaults: ThemeUxDefaults } = {
  ...base,
  name: "direction",
  source: "project",
  defaults: {
    app: { navigation: "topbar" },
    kinds: { landing: { header: { over: "hero" }, width: "wide" } },
    sections: { hero: { layout: "cover", overlay: "dark" } },
  },
};
const read = (extra = "", theme = direction) =>
  validateUx(
    { path: "smithable.ux.yml", text: "smithableUx: 0.1\ntheme: {preset: direction}\n" + extra },
    ir,
    [theme],
    auth,
  );
test("inherited values participate before contextual validation; explicit platform values mask them", () => {
  const result = read();
  expect(result.diagnostics).toEqual([]);
  expect(result.ux?.navigation).toBe("topbar");
  expect(result.ux?.pages.home?.looks?.hero).toMatchObject({ layout: "cover", overlay: "dark" });
  expect(result.ux?.pages.home?.header?.over).toBe("hero");
  const explicit = read("navigation: sidebar\npages:\n  home:\n    width: contained\n");
  expect(explicit.diagnostics).toEqual([]);
  expect(explicit.ux?.navigation).toBe("sidebar");
  expect(explicit.ux?.pages.home?.width).toBeUndefined();
  expect(explicit.ux?.inherited?.masked.map((f) => f.path.join("."))).toEqual(
    expect.arrayContaining(["navigation", "pages.home.width"]),
  );
});
test("only incompatible inherited keys skip, preserving authored diagnostics and locations", () => {
  const skipped = read("pages:\n  home:\n    sections:\n      hero: {layout: split}\n");
  expect(skipped.diagnostics).toEqual([]);
  expect(skipped.ux?.pages.home?.looks?.hero).toMatchObject({ layout: "split" });
  expect(skipped.ux?.pages.home?.looks?.hero?.overlay).toBeUndefined();
  expect(skipped.ux?.pages.home?.header?.over).toBeUndefined();
  expect(skipped.ux?.inherited?.skipped.map((f) => f.path.join("."))).toContain(
    "pages.home.sections.hero.overlay",
  );
  const explicit = read(
    "pages:\n  home:\n    sections:\n      hero: {layout: split, overlay: dark}\n",
  );
  expect(explicit.ux).toBeUndefined();
  expect(explicit.diagnostics.find((d) => d.code === "invalid-key")?.line).toBe(6);
});

const themeSource = `smithableTheme: 0.1
modes: light
light: {background: "#ffffff", foreground: "#111111", primary: "#2255aa"}
`;
test("finite defaults parse from one capability vocabulary; references and executable values are refused", () => {
  const valid = parseTheme({
    path: "themes/direction.yml",
    text:
      themeSource +
      "defaults: {app: {navigation: topbar}, kinds: {crud: {record: {header: summary}}}, sections: {hero: {layout: cover, height: full}}}\n",
  });
  expect(valid.diagnostics.filter((d) => d.severity === "error")).toEqual([]);
  expect(valid.theme?.defaults).toMatchObject({
    app: { navigation: "topbar" },
    sections: { hero: { height: "full" } },
  });
  for (const invalid of [
    "pages: {home: {width: full}}",
    "app: {permissions: admin}",
    "sections: {hero: {stage: customers}}",
    "sections: {hero: {facts: [Customer]}}",
    "sections: {hero: {overlay: 'url(https://example.test)'}}",
    "kinds: {crud: {table: {mark: admin}}}",
  ]) {
    const result = parseTheme({
      path: "themes/direction.yml",
      text: themeSource + `defaults: {${invalid}}\n`,
    });
    expect(result.theme, invalid).toBeUndefined();
    expect(
      result.diagnostics.some((d) => d.severity === "error"),
      invalid,
    ).toBe(true);
  }
  expect(
    JSON.parse(JSON.stringify(themeDefaultsSchema())).properties.sections.properties.hero.properties
      .stage,
  ).toBeUndefined();
});

test("unusable inherited record and filter choices skip without rejecting legacy explicit choices", () => {
  const theme = {
    ...direction,
    defaults: {
      kinds: {
        crud: {
          record: { header: "summary" },
          form: { aside: "summary" },
          filters: { look: "chips" },
        },
      },
    },
  };
  const result = read("", theme);
  expect(result.diagnostics.filter((d) => d.severity === "error")).toEqual([]);
  expect(result.ux?.inherited?.skipped.some((f) => f.reason.includes("no filters"))).toBe(true);
  expect(result.ux?.inherited?.skipped.some((f) => f.reason.includes("summarize"))).toBe(true);
});

test("published theme schema agrees on valid defaults, rejects unknown values and stays deterministic", () => {
  const schema = buildThemeSchema();
  expect(buildThemeSchema()).toEqual(schema);
  const validate = new Ajv({ allErrors: true }).compile(schema);
  const valid = parse(
    themeSource + "defaults: {app: {navigation: topbar}, sections: {hero: {layout: cover}}}\n",
  );
  expect(validate(valid), JSON.stringify(validate.errors)).toBe(true);
  valid.defaults.app.navigation = "sideways";
  expect(validate(valid)).toBe(false);
});

test("legacy themes keep the exact platform UX without defaults metadata", () => {
  for (const theme of BUILT_IN_THEMES) {
    const result = validateUx(
      { path: "smithable.ux.yml", text: `smithableUx: 0.1\ntheme: {preset: ${theme.name}}\n` },
      ir,
    );
    expect(result.diagnostics).toEqual([]);
    expect(result.ux).toEqual({
      ...emptyUx(),
      theme: { preset: theme.name, density: theme.density, motion: theme.motion },
    });
  }
});
test("literal platform values survive theme changes; only inherit removes their authorship", () => {
  const defaults: ThemeIR = {
    ...direction,
    defaults: {
      app: { navigation: "topbar", chrome: "dark", menuActive: "underline" },
      kinds: {
        landing: { width: "full", header: { position: "scrolling", over: "hero" } },
        crud: {
          table: { mark: "initials", actions: "menu" },
          record: { header: "summary", pictures: "top" },
          form: { aside: "summary" },
        },
        calendar: { calendar: { view: "agenda" }, filters: { look: "chips" } },
      },
      sections: { hero: { layout: "cover" } },
    },
  };
  const cases: [keyof typeof UX_CAPABILITIES, string | undefined, string][] = [
    ["navigation", undefined, "sidebar"],
    ["chrome", undefined, "light"],
    ["menuActive", undefined, "filled"],
    ["width", "home", "contained"],
    ["headerPosition", "home", "sticky"],
    ["headerOver", "home", "none"],
    ["mark", "instructors", "none"],
    ["rowActions", "instructors", "below"],
    ["calendarView", "schedule", "week"],
    ["filtersLook", "schedule", "default"],
    ["recordHeader", "sessions", "none"],
    ["formAside", "sessions", "none"],
    ["recordPictures", "instructors", "none"],
  ];
  for (const [id, page, value] of cases) {
    const cap: UxCapability = UX_CAPABILITIES[id];
    const initial = {
      spec: specText,
      auth: authText,
      themes: [defaults],
      ux: "smithableUx: 0.1\ntheme: {preset: direction}\n",
    };
    const args = { ...cap.fixed, ...(page ? { page } : {}), [cap.argument]: value };
    const explicit = applyOperation(initial, cap.operation, args);
    if (!explicit.ok)
      throw new Error(`${id}: ${explicit.message} ${JSON.stringify(explicit.diagnostics)}`);
    const path = [...(page ? ["pages", page] : []), ...cap.rawPath];
    const at = (text: string) => path.reduce((node, key) => node?.[key], parse(text));
    expect(at(explicit.files.ux ?? ""), id).toBe(value);
    const swapped = applyOperation(explicit.files, "setTheme", { preset: "modern" });
    if (!swapped.ok) throw new Error(swapped.message);
    expect(at(swapped.files.ux ?? ""), id).toBe(value);
    const reset = applyOperation(explicit.files, cap.operation, {
      ...args,
      [cap.argument]: "inherit",
    });
    if (!reset.ok) throw new Error(`${id}: ${reset.message}`);
    expect(at(reset.files.ux ?? ""), id).toBeUndefined();
    const result = validateUx(
      { path: "smithable.ux.yml", text: reset.files.ux ?? "" },
      ir,
      [defaults],
      auth,
    );
    expect(
      result.diagnostics.filter((d) => d.severity === "error"),
      id,
    ).toEqual([]);
    expect(
      result.ux?.inherited?.used.some((f) => f.path.join(".") === path.join(".")),
      id,
    ).toBe(true);
    expect(initial.ux).toBe("smithableUx: 0.1\ntheme: {preset: direction}\n");
  }
});

test("a landing theme refines page and section defaults while the app keeps its own shell", () => {
  const own: ThemeIR = {
    ...direction,
    name: "own",
    defaults: {
      app: { navigation: "sidebar" },
      kinds: { landing: { width: "full" } },
      sections: { hero: { layout: "photo" } },
    },
  };
  const result = validateUx(
    {
      path: "smithable.ux.yml",
      text: "smithableUx: 0.1\ntheme: {preset: direction}\npages: {home: {theme: {preset: own}}}\n",
    },
    ir,
    [direction, own],
    auth,
  );
  expect(result.diagnostics).toEqual([]);
  expect(result.ux?.navigation).toBe("topbar");
  expect(result.ux?.pages.home?.width).toBe("full");
  expect(result.ux?.pages.home?.looks?.hero).toMatchObject({ layout: "photo", overlay: "dark" });
  expect(
    result.ux?.inherited?.used.find((f) => f.path.join(".") === "pages.home.width")?.theme,
  ).toBe("own");
  expect(result.ux?.pages.schedule?.width).toBeUndefined();
});
test("public-stage access incompatibility skips inherited layout and still refuses authored layout", () => {
  if (!auth) throw new Error("missing auth fixture");
  const restricted = { ...auth, public: { ...auth.public, pages: ["home"], read: [] } };
  const theme: ThemeIR = { ...direction, defaults: { sections: { hero: { layout: "stage" } } } };
  const source = "smithableUx: 0.1\ntheme: {preset: direction}\n";
  const inherited = validateUx({ path: "smithable.ux.yml", text: source }, ir, [theme], restricted);
  expect(inherited.diagnostics.filter((d) => d.severity === "error")).toEqual([]);
  expect(inherited.ux?.pages.home?.looks?.hero?.layout).toBeUndefined();
  expect(
    inherited.ux?.inherited?.skipped.some(
      (f) =>
        f.path.join(".") === "pages.home.sections.hero.layout" && /may not read/.test(f.reason),
    ),
  ).toBe(true);
  const explicit = validateUx(
    {
      path: "smithable.ux.yml",
      text: source + "pages: {home: {sections: {hero: {layout: stage}}}}\n",
    },
    ir,
    [theme],
    restricted,
  );
  expect(explicit.ux).toBeUndefined();
  expect(
    explicit.diagnostics.some((d) => d.severity === "error" && /may not read/.test(d.message)),
  ).toBe(true);
});
test("an inherited stage whose records the page lists again is skipped, and the hero falls back", () => {
  const shop = validateSpec({
    path: "smithable.yml",
    text: [
      "smithable: 0.1",
      "app: { name: Shop }",
      "models:",
      "  Item: { fields: { name: string! } }",
      "pages:",
      "  home: { route: /, landing: { hero: {}, catalogue: { records: Item } } }",
      "  items: { crud: Item }",
      "",
    ].join("\n"),
  }).ir;
  if (!shop) throw new Error("invalid fixture");
  const theme: ThemeIR = { ...direction, defaults: { sections: { hero: { layout: "stage" } } } };
  const source = "smithableUx: 0.1\ntheme: {preset: direction}\n";
  const inherited = validateUx({ path: "smithable.ux.yml", text: source }, shop, [theme]);
  // No warning at 1:1, where nothing is written: the default is skipped with the reason.
  expect(inherited.diagnostics).toEqual([]);
  expect(inherited.ux?.pages.home?.looks?.hero?.layout).toBeUndefined();
  expect(
    inherited.ux?.inherited?.skipped.some(
      (f) =>
        f.path.join(".") === "pages.home.sections.hero.layout" && /lists them again/.test(f.reason),
    ),
  ).toBe(true);
  // Written in the file, the layout stays and the warning stands on its line.
  const explicit = validateUx(
    {
      path: "smithable.ux.yml",
      text: source + "pages: {home: {sections: {hero: {layout: stage}}}}\n",
    },
    shop,
    [theme],
  );
  expect(explicit.ux?.pages.home?.looks?.hero?.layout).toBe("stage");
  expect(explicit.diagnostics).toMatchObject([
    { severity: "warning", code: "stage-repeats", line: 3 },
  ]);
});

// The design's guard (docs/spec/v0.1.md, Themes, defaults): a theme's defaults are added to the
// parsed ux document as nodes of their own, which have no place in the file. A diagnostic on one
// of them would point at 1:1, where nothing is written; an unusable default is skipped with its
// reason instead. Every finite default, one at a time, against every example app's ux file.
test("no theme default raises a diagnostic at the file's first line in any example app", () => {
  const examples = import.meta.glob("../../../examples/*/smithable*.yml", {
    query: "?raw",
    import: "default",
    eager: true,
  }) as Record<string, string>;
  const leaves = (tree: object, prefix: string[] = []): { path: string[]; values: unknown[] }[] =>
    Object.entries(tree).flatMap(([key, value]) =>
      Array.isArray(value)
        ? [{ path: [...prefix, key], values: value }]
        : leaves(value as object, [...prefix, key]),
    );
  const all = leaves(THEME_DEFAULT_TREE);
  expect(all.length).toBeGreaterThan(5);
  const nest = (path: string[], value: unknown): ThemeUxDefaults =>
    path.reduceRight<unknown>((inner, key) => ({ [key]: inner }), value) as ThemeUxDefaults;
  const atLineOne: string[] = [];
  const apps = [...new Set(Object.keys(examples).map((path) => path.split("/").at(-2)))];
  for (const app of apps) {
    const file = (name: string) => examples[`../../../examples/${app}/${name}`];
    const spec = file("smithable.yml");
    if (!spec) continue;
    const appIr = validateSpec({ path: "smithable.yml", text: spec }).ir;
    if (!appIr) throw new Error(`${app}: the spec does not read`);
    const authText = file("smithable.auth.yml");
    const appAuth = authText
      ? validateAuth({ path: "smithable.auth.yml", text: authText }, appIr).auth
      : undefined;
    const uxText = file("smithable.ux.yml") ?? "smithableUx: 0.1\n";
    // The theme the file names (else modern) takes the default, as a project theme of that name.
    const preset = parse(uxText)?.theme?.preset;
    const named = typeof preset === "string" ? preset : "modern";
    const own = BUILT_IN_THEMES.find((t) => t.name === named) ?? base;
    for (const leaf of all)
      for (const value of leaf.values) {
        const theme: ThemeIR = {
          ...own,
          name: named,
          source: "project",
          defaults: nest(leaf.path, value),
        };
        const { diagnostics } = validateUx(
          { path: "smithable.ux.yml", text: uxText },
          appIr,
          [theme],
          appAuth,
        );
        for (const d of diagnostics)
          if (d.line === 1 && d.code !== "yaml")
            atLineOne.push(
              `${app}: ${leaf.path.join(".")}=${String(value)}: ${d.code} ${d.message}`,
            );
      }
  }
  expect(atLineOne).toEqual([]);
});
