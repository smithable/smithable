import { hexOf, parseTheme, resolveLook, validateSpec, validateUx } from "@smithable/core";
import { expect, test } from "vitest";
import { sourceFontTheme, sourceLayout, sourceSectionLooks } from "./website-layout.js";

test("reads source sections, same-site buttons, reversed picture sides and inline visual hints", () => {
  const html = `<style>body { font-family: Inter } h1, h2 { font-family: 'Playfair Display', serif }</style>
    <body><main>
      <section style="background: linear-gradient(rgba(0,0,0,0.5),rgba(0,0,0,0.3))">
        <h1>Welcome</h1><p>Visit the market.</p>
      </section>
      <section style="display:flex;flex-direction:row-reverse">
        <figure><img src="/stall.webp" alt="The market stall"></figure>
        <div><h2>Find us</h2><p>We are by the quay.</p><a href="/hours">Hours</a>
        <a href="//outside.example/">Outside</a></div>
      </section>
      <section hidden><h2>Ignore this</h2></section>
    </main></body>`;
  const [home] = sourceLayout([
    {
      id: "home",
      url: "https://business.example/",
      html,
      depth: 0,
      fetchedAt: "2026-01-01T00:00:00.000Z",
      bytes: Buffer.byteLength(html),
    },
  ]);
  expect(home).toEqual({
    page: 1,
    bodyFont: "Inter",
    headingFont: "Playfair Display",
    blocks: [
      { title: "Welcome", copy: ["Visit the market."], buttons: [], darkOverlay: true },
      {
        title: "Find us",
        copy: ["We are by the quay."],
        buttons: [{ label: "Hours", href: "/hours" }],
        picture: { alt: "The market stall", side: "right" },
      },
    ],
  });
  const spec = `smithable: 0.1
app: { name: Market }
pages:
  home:
    route: /
    landing: { hero: {}, story: { mediaText: true } }
`;
  const ir = validateSpec({ path: "smithable.yml", text: spec }).ir;
  if (!home || !ir) throw new Error("Invalid test website");
  expect(
    sourceSectionLooks(
      home,
      {
        "smithable.content.yml":
          "smithableContent: 0.1\npages:\n  home:\n    hero: { title: Welcome }\n    story: { title: Find us }\n",
        "smithable.ux.yml":
          "smithableUx: 0.1\npages:\n  home:\n    sections:\n      hero: { layout: cover, overlay: brand }\n      story: { image: left }\n",
      },
      ir,
    ),
  ).toEqual([
    {
      op: "setSectionLook",
      args: { page: "home", section: "hero", key: "overlay", value: "dark" },
    },
    {
      op: "setSectionLook",
      args: { page: "home", section: "story", key: "image", value: "right" },
    },
  ]);
});

test("keeps a declared heading face on the selected preset without changing the app's fonts", () => {
  const spec = `smithable: 0.1
app: { name: Market }
pages:
  home:
    route: /
    landing: { hero: {}, footer: {} }
`;
  const ir = validateSpec({ path: "smithable.yml", text: spec }).ir;
  if (!ir) throw new Error("Invalid test specification");
  const uxText = "smithableUx: 0.1\ntheme: { preset: minimal }\n";
  const result = sourceFontTheme(
    { page: 1, headingFont: "Instrument Serif", bodyFont: "Inter", blocks: [] },
    { "smithable.yml": spec, "smithable.ux.yml": uxText },
    ir,
  );
  if (!result?.ok) throw new Error(result?.message ?? "Expected a source theme");
  expect(result.added).toHaveLength(1);
  const themeFile = result.added[0];
  if (!themeFile || !result.files.ux) throw new Error("Expected theme and UX source");
  const { theme } = parseTheme(themeFile);
  if (!theme) throw new Error("Invalid generated theme");
  const { ux } = validateUx({ path: "smithable.ux.yml", text: result.files.ux }, ir, [theme]);
  if (!ux) throw new Error("Invalid generated UX");
  const home = resolveLook(ux, [theme], "home");
  const app = resolveLook(ux, [theme]);
  expect(home.font).toBe("Inter");
  expect(home.theme.style.headingFont).toBe("Instrument Serif");
  expect(hexOf(home.tokens.light.background)).toBe(hexOf(app.tokens.light.background));
  expect(home.theme.style.buttons).toEqual(app.theme.style.buttons);
  expect(app.theme.name).toBe("minimal");
  expect(app.theme.style.headingFont).toBeUndefined();
});
