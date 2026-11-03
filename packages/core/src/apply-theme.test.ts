import { expect, test } from "vitest";
import { applyOperation, applyOperations } from "./apply.js";
import { parseTheme, type ThemeIR } from "./theme.js";
import { THEME_LIBRARY } from "./theme-library.js";

const spec = Object.values(
  import.meta.glob("../../../examples/booking/smithable.yml", {
    query: "?raw",
    import: "default",
    eager: true,
  }),
)[0] as string;
const text =
  '# keep my palette\nsmithableTheme: 0.1\nname: paper\ndensity: compact\nmodes: light\nlight: { background: "#ffffff", foreground: "#101522", primary: "#335588", sidebar: "#112233" }\n';
const theme = parseTheme({ path: "paper.yml", text }).theme as ThemeIR;
const args = { name: "paper", text, mode: "create" };

test("new theme plus selection and requested resets are one validated operation", () => {
  const result = applyOperation(
    { spec, ux: 'smithableUx: 0.1\ntheme: { brand: { primary: "#114455", font: "DM Sans" } }\n' },
    "applyTheme",
    { ...args, resets: [{ key: "primary" }] },
  );
  if (!result.ok) throw new Error(result.message);
  expect(result.added).toEqual([{ path: "themes/paper.yml", text }]);
  expect(result.files.ux).toContain("preset: paper");
  expect(result.files.ux).toContain("DM Sans");
  expect(result.files.ux).not.toContain("#114455");
});

test("update preserves the original project path/source comments and can select a page", () => {
  const updated = text.replace("density: compact", "density: standard");
  const result = applyOperation(
    {
      spec,
      themes: [theme],
      themePaths: { paper: "themes/original.yaml" },
      ux: "smithableUx: 0.1\ntheme: { preset: modern }\n",
    },
    "applyTheme",
    { ...args, text: updated, mode: "update", page: "home" },
  );
  if (!result.ok) throw new Error(result.message);
  expect(result.added).toEqual([{ path: "themes/original.yaml", text: updated }]);
  expect(result.files.themes?.find((t) => t.name === "paper")?.density).toBe("standard");
  expect(result.files.ux).toContain("preset: modern");
  expect(result.files.ux).toContain("preset: paper");
});

test.each([
  { name: "modern", text: text.replace("paper", "modern") },
  { name: "../escape" },
  { text: "invalid: [" },
  { text: "x".repeat(262145) },
  { page: "missing" },
  { resets: [{ key: "density", page: "missing" }] },
  // The host's precondition and request id travel beside the operation, never as arguments.
  { expectedRevision: "a".repeat(64) },
  { requestId: "request_123" },
  { mode: "update" },
])("invalid apply refuses the whole edit before producing files: %j", (override) => {
  expect(applyOperation({ spec }, "applyTheme", { ...args, ...override }).ok).toBe(false);
});

test("duplicate creation and a built-in update are refused", () => {
  expect(applyOperation({ spec, themes: [theme] }, "applyTheme", args).ok).toBe(false);
  expect(
    applyOperation({ spec }, "applyTheme", {
      ...args,
      name: "modern",
      mode: "update",
      text: text.replace("paper", "modern"),
    }).ok,
  ).toBe(false);
});

test("atomic batches retain added/project theme and plugin context for later steps", () => {
  const result = applyOperations({ spec }, [
    { op: "addTheme", args: { name: "paper", text } },
    { op: "setTheme", args: { preset: "paper" } },
    { op: "resetThemeOverride", args: { key: "density" } },
  ]);
  if (!result.ok) throw new Error(result.message);
  expect(result.files.ux).toContain("preset: paper");
  expect(result.files.themes?.map((t) => t.name)).toContain("paper");
  expect(result.added).toEqual([{ path: "themes/paper.yml", text }]);
});

test("select uses a theme as it is: an unchanged project theme, or a built-in given as its own text", () => {
  const own = applyOperation({ spec, themes: [theme] }, "applyTheme", { ...args, mode: "select" });
  if (!own.ok) throw new Error(own.message);
  expect(own.added).toEqual([]);
  expect(own.files.ux).toContain("preset: paper");
  expect(own.files.themes?.map((t) => t.name)).toEqual(["paper"]);
  // A built-in cannot be created or updated, but may be selected when the draft says the same
  // (sameLookTheme reads the meaning, not the text), as the look editor's unchanged draft does.
  const [name, library] = Object.entries(THEME_LIBRARY)[0] as [string, string];
  const builtIn = applyOperation({ spec }, "applyTheme", {
    ...args,
    name,
    text: library,
    mode: "select",
  });
  if (!builtIn.ok) throw new Error(builtIn.message);
  expect(builtIn.added).toEqual([]);
  expect(builtIn.files.ux).toContain(`preset: ${name}`);
  // A draft that differs is not a selection: update a project theme, or create a copy.
  expect(
    applyOperation({ spec, themes: [theme] }, "applyTheme", {
      ...args,
      mode: "select",
      text: text.replace("density: compact", "density: standard"),
    }).ok,
  ).toBe(false);
  expect(
    applyOperation({ spec }, "applyTheme", {
      ...args,
      name,
      text: library.replace(/radius: .*/, "radius: 0px"),
      mode: "select",
    }).ok,
  ).toBe(false);
});
