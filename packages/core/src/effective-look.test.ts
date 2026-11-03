import { expect, test } from "vitest";
import { lookAuthorship, resolveLook } from "./look.js";
import { validateSpec } from "./spec.js";
import { parseTheme, type ThemeIR } from "./theme.js";
import { emptyUx, validateUx } from "./ux.js";

const spec = Object.values(
  import.meta.glob("../../../examples/booking/smithable.yml", {
    query: "?raw",
    import: "default",
    eager: true,
  }),
)[0] as string;
const ir = validateSpec({ path: "smithable.yml", text: spec }).ir;
if (!ir) throw new Error("invalid fixture");
const read = (body: string, themes: ThemeIR[] = [], page?: string) => {
  const text = `smithableUx: 0.1\n${body}\n`;
  const parsed = validateUx({ path: "smithable.ux.yml", text }, ir, themes);
  if (!parsed.ux) throw new Error(JSON.stringify(parsed.diagnostics));
  return resolveLook(parsed.ux, themes, page, lookAuthorship(text));
};

test("authored omission differs from an explicit value equal to the default", () => {
  expect(read("theme: { preset: playful }").provenance.density).toMatchObject({
    kind: "theme",
    name: "playful",
  });
  const explicit = read("theme: { preset: playful, density: comfortable }");
  expect(explicit.settings.density).toBe("comfortable");
  expect(explicit.provenance.density).toEqual({ kind: "app-ux", path: ["theme", "density"] });
  expect(read("").provenance.density).toEqual({ kind: "default" });
});

test("page preset defaults preserve existing precedence while brand/font inherit from app", () => {
  const look = read(
    'theme: { preset: corporate, density: compact, motion: none, brand: { font: "DM Sans", primary: "#663399" } }\npages:\n  home:\n    theme: { preset: playful }',
    [],
    "home",
  );
  expect(look.theme.name).toBe("playful");
  expect(look.settings).toMatchObject({
    density: "comfortable",
    motion: "lively",
    primary: "#663399",
  });
  expect(look.font).toBe("DM Sans");
  expect(look.provenance.density).toMatchObject({ kind: "theme", scope: "page" });
  expect(look.provenance.font.kind).toBe("app-ux");
  expect(look.provenance.primary.kind).toBe("app-ux");
});

test("explicit page values win and keep their reset paths", () => {
  const look = read(
    'theme: { preset: corporate }\npages:\n  home:\n    theme: { preset: playful, density: standard, motion: none, brand: { font: Inter, primary: "#336699" } }',
    [],
    "home",
  );
  expect(look.settings).toMatchObject({ density: "standard", motion: "none", font: "Inter" });
  expect(look.provenance.primary).toEqual({
    kind: "page-ux",
    page: "home",
    path: ["pages", "home", "theme", "brand", "primary"],
  });
});

test("project theme defaults and changed drafts retain explicit choices", () => {
  const theme = parseTheme({
    path: "custom.yml",
    text: 'smithableTheme: 0.1\nname: custom\nmodes: light\ndensity: standard\nlight: { background: "#ffffff", foreground: "#101522", primary: "#335588" }',
  }).theme as ThemeIR;
  expect(read("theme: { preset: custom }", [theme]).provenance.font).toMatchObject({
    kind: "theme",
    source: "project",
    name: "custom",
  });
  const changed = { ...theme, density: "compact" as const };
  expect(read("theme: { preset: custom }", [changed]).settings.density).toBe("compact");
  expect(read("theme: { preset: custom, density: comfortable }", [changed]).settings.density).toBe(
    "comfortable",
  );
});

test("missing theme has an explicit fallback; invalid UX is refused before resolution", () => {
  const stale = resolveLook({ ...emptyUx(), theme: { ...emptyUx().theme, preset: "deleted" } });
  expect(stale.missingTheme).toBe("deleted");
  expect(stale.theme.name).toBe("modern");
  expect(
    validateUx({ path: "smithable.ux.yml", text: "smithableUx: 0.1\ntheme: { density: tiny }" }, ir)
      .ux,
  ).toBeUndefined();
  expect(lookAuthorship("theme: [")).toBeUndefined();
});
