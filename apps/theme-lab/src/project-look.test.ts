import {
  BUILT_IN_THEMES,
  type ProjectLook,
  parseTheme,
  sameLookTheme,
  type ThemeIR,
  validateSpec,
  validateUx,
} from "@smithable/core";
import { expect, test } from "vitest";
import { openProjectLook, previewProjectLook } from "./project-look";
import { changeModes, editDraft, newDraft } from "./theme-draft";
import { setField, themeText } from "./theme-text";

const specText = Object.values(
  import.meta.glob("../../../examples/booking/smithable.yml", {
    query: "?raw",
    import: "default",
    eager: true,
  }),
)[0] as string;
const ir = validateSpec({ path: "smithable.yml", text: specText }).ir;
if (!ir) throw new Error("invalid fixture");
const project = (uxText: string): ProjectLook => ({
  ir,
  specText,
  uxText,
  themes: [],
  themeFiles: [],
  page: "home",
});
const corporate = BUILT_IN_THEMES.find((t) => t.name === "corporate") as ThemeIR;

test("open selects the page's current source and retains project comments without mutation", () => {
  const text = `# authored theme\n${setField(themeText(corporate), ["name"], "my-theme")}`;
  const theme = parseTheme({ path: "my-theme.yml", text }).theme as ThemeIR;
  const snapshot = {
    ...project(
      "smithableUx: 0.1\ntheme: { preset: modern }\npages:\n  home:\n    theme: { preset: my-theme }\n",
    ),
    themes: [theme],
    themeFiles: [{ name: theme.name, text }],
  };
  const before = structuredClone(snapshot);
  const opened = openProjectLook(snapshot);
  expect(opened.text).toBe(text);
  expect(opened.look.theme.name).toBe("my-theme");
  expect(snapshot).toEqual(before);
});

test("draft values stay masked by explicit app overrides until canonical reset operations are staged", () => {
  const snapshot = project(
    'smithableUx: 0.1\ntheme: { preset: corporate, density: comfortable, motion: none, brand: { primary: "#335577", font: "DM Sans" } }\n',
  );
  const draft = {
    ...corporate,
    name: "future-fork",
    font: "Inter",
    density: "compact" as const,
    motion: "lively" as const,
  };
  const preview = previewProjectLook(snapshot, draft, null, "home");
  expect(preview.look.settings).toMatchObject({
    primary: "#335577",
    font: "DM Sans",
    density: "comfortable",
    motion: "none",
  });
  const reset = previewProjectLook(snapshot, draft, "home", "home", [
    { key: "density" },
    { key: "motion" },
    { key: "font" },
  ]);
  expect(reset.look.settings).toMatchObject({ density: "compact", motion: "lively" });
  expect(reset.look.font).toBe("Inter");
  expect(reset.look.provenance.density.kind).toBe("theme");
  expect(snapshot.uxText).toContain("density: comfortable");
});

test("a palette mode edit and ordinary text edit retain the same staged UX reset transaction", () => {
  const draft = { ...newDraft(themeText(corporate)), resets: [{ key: "motion" as const }] };
  const single = changeModes(draft, "dark").draft;
  expect(single.resets).toEqual(draft.resets);
  expect(editDraft(single, setField(single.text, ["radius"], "9px")).resets).toEqual(draft.resets);
});

test("invalid saved UX is reported instead of pretending the project uses a platform default", () => {
  expect(() => openProjectLook(project("smithableUx: 0.1\ntheme: { preset: missing }"))).toThrow(
    /missing/,
  );
});

test("a host-validated project with plugin grammar can stage theme edits without reloading its plugin", () => {
  const snapshot = {
    ...project("smithableUx: 0.1\ntheme: {preset: corporate}\n"),
    specText: `${specText}\ngreeting: Hello\n`,
  };
  expect(validateSpec({ path: "smithable.yml", text: snapshot.specText }).ir).toBeUndefined();
  const before = structuredClone(snapshot);
  const draft = { ...corporate, radius: "19px" };
  const preview = previewProjectLook(snapshot, draft, null, "home", [{ key: "density" }]);
  expect(preview.look.theme.radius).toBe("19px");
  expect(snapshot).toEqual(before);
});

test("editor and generator resolve identical default UX without writing inferred source", () => {
  const draft: ThemeIR = {
    ...corporate,
    name: "direction",
    source: "project",
    defaults: {
      app: { navigation: "topbar" },
      kinds: { landing: { width: "full" } },
      sections: { hero: { layout: "cover", overlay: "dark" } },
    },
  };
  const snapshot = project(
    "smithableUx: 0.1\nnavigation: sidebar\npages: {home: {width: contained}}\n",
  );
  const before = structuredClone(snapshot);
  const preview = previewProjectLook(snapshot, draft, null, "home");
  const persisted = validateUx(
    { path: "smithable.ux.yml", text: snapshot.uxText + "theme: {preset: direction}\n" },
    ir,
    [draft],
  );
  expect(preview.ux).toEqual(persisted.ux);
  expect(preview.ux.navigation).toBe("sidebar");
  expect(preview.ux.pages.home?.width).toBeUndefined();
  expect(preview.look.defaults?.masked.map((f) => f.path.join("."))).toContain("pages.home.width");
  expect(snapshot).toEqual(before);
  expect(
    sameLookTheme(draft, {
      ...draft,
      defaults: { ...draft.defaults, app: { navigation: "sidebar" } },
    }),
  ).toBe(false);
});
