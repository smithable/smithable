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
