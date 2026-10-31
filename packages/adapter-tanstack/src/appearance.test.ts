import { expect, test } from "vitest";

// The kit's appearance.ts, as the generated apps get it (a path the build does not follow).
const path: string = "../templates/src/kit/appearance.ts";
const kit = async () => (await import(path)) as { APPEARANCE_SCRIPT: string };

/** A browser stand-in: the device's mode, what the page keeps, and <html>. */
function page(device: "light" | "dark", kept: string | null) {
  const root = { dataset: {} as Record<string, string>, style: {} as Record<string, string> };
  const window = {
    matchMedia: () => ({ matches: device === "dark", addEventListener() {} }),
    localStorage: { getItem: () => kept },
    addEventListener() {},
  };
  return { root, window, document: { documentElement: root } };
}

test("the head's script runs on its own, before the app's code: it names nothing from a module", async () => {
  const { APPEARANCE_SCRIPT } = await kit();
  // Only what a page has before any script loads: the document and the window.
  const run = new Function("document", "window", APPEARANCE_SCRIPT);
  for (const [device, kept, shown] of [
    ["light", null, "light"],
    ["dark", null, "dark"],
    ["light", "dark", "dark"],
    ["dark", "light", "light"],
  ] as const) {
    const p = page(device, kept);
    run(p.document, p.window);
    expect(p.root.dataset.appearance, `${device} device, ${kept} kept`).toBe(shown);
    expect(p.root.style.colorScheme).toBe(shown);
  }
});

test("a theme with one mode shows it whatever the device says, and imports no appearance script", async () => {
  const { emptyContent, emptyUx, parseTheme, validateAuth, validateSpec } = await import(
    "@smithable/core"
  );
  const { generateApp } = await import("./generate.js");
  const ir = validateSpec({
    path: "smithable.yml",
    text: "smithable: 0.1\napp: { name: Night }\nmodels:\n  Note: { fields: { title: string! } }\npages:\n  notes: { crud: Note }\n",
  }).ir;
  const auth = validateAuth(
    {
      path: "smithable.auth.yml",
      text: "smithableAuth: 0.1\nsignIn: { providers: [email] }\ndefaultAccess: shared\n",
    },
    ir,
  ).auth;
  const night = parseTheme({
    path: "themes/night.yml",
    text: 'smithableTheme: 0.1\nname: night\nmodes: dark\ndark:\n  background: "#101218"\n  foreground: "#eef0f5"\n  primary: "#8fb4ff"\n',
  }).theme;
  if (!ir || !auth || !night) throw new Error("the fixture does not read");
  const root = (themes: (typeof night)[]) => {
    const ux = {
      ...emptyUx(),
      theme: { ...emptyUx().theme, preset: (themes[0]?.name ?? "modern") as never },
    };
    const files = generateApp(ir, {
      smithableVersion: "0.0.0",
      auth,
      content: emptyContent(),
      ux,
      themes,
    });
    return files.find((f) => f.path === "src/routes/__root.tsx")?.content ?? "";
  };
  const dark = root([night]);
  expect(dark).toContain('document.documentElement.dataset.appearance=\\"dark\\"');
  expect(dark).not.toContain("APPEARANCE_SCRIPT");
  expect(root([])).toContain("<ScriptOnce children={APPEARANCE_SCRIPT} />");
}, 60_000);
