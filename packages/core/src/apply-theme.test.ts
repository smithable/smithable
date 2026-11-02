import { expect, test } from "vitest";
import { applyOperation, applyOperations } from "./apply.js";
import { parseTheme, type ThemeIR } from "./theme.js";

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
const args = {
  name: "paper",
  text,
  mode: "create",
  expectedRevision: "a".repeat(64),
  requestId: "request_123",
};

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
  { expectedRevision: "bad" },
  { requestId: "short" },
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
