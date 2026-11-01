import { emptyUx, FONTS, parseTheme, type ThemeIR } from "@smithable/core";
import { expect, test } from "vitest";
import { FONT_PACKAGES, themeCss } from "./themes.js";

test("the owner's switch for the AI badge (aiBadge: false) hides every mark", () => {
  expect(themeCss(emptyUx())).not.toContain("ai-mark");
  expect(themeCss({ ...emptyUx(), aiBadge: false })).toContain(
    '[data-part="ai-mark"] {\n  display: none;',
  );
});

test("an owner's background goes in under the brand color, in both modes", () => {
  const ux = {
    ...emptyUx(),
    theme: { ...emptyUx().theme, background: "#f5efe6", primary: "#7c3aed" },
  };
  const css = themeCss(ux);
  const plain = themeCss({ ...ux, theme: { ...ux.theme, background: undefined } });
  // The light mode's background, then the dark mode's.
  const backgrounds = (text: string) =>
    [...text.matchAll(/--background: ([^;]+);/g)].map((m) => m[1]);
  const [light, dark] = backgrounds(css);
  const [plainLight, plainDark] = backgrounds(plain);
  expect(light).toBe("#f9f3ea");
  expect(dark).toBe("#130f09");
  expect([plainLight, plainDark]).not.toContain(light);
  // The brand's primary is the same with or without the background.
  const primary = (text: string) => /:root \{[^}]*--primary: ([^;]+);/.exec(text)?.[1];
  expect(primary(css)).toBe(primary(plain));
});

test("every font a theme may name is one the app can host: it has a package", () => {
  for (const font of FONTS) expect(FONT_PACKAGES[font], font).toBeTruthy();
});

test("a theme's style is one variable per field; the presets read as before by the defaults", () => {
  const css = (preset: string) =>
    themeCss({ ...emptyUx(), theme: { ...emptyUx().theme, preset: preset as never } });
  const root = (text: string, name: string) =>
    new RegExp(`:root \\{[^}]*--${name}: ([^;]+);`).exec(text)?.[1];
  const modern = css("modern");
  expect(root(modern, "heading-weight")).toBe("700");
  expect(root(modern, "heading-tracking")).toBe("-0.02em");
  expect(root(modern, "card-border")).toBe("1px");
  expect(root(modern, "button-radius")).toBe("calc(var(--radius) - 2px)");
  // Section headings at the start unless a theme centers them (headings.align).
  expect(root(modern, "heading-align")).toBe("start");
  expect(root(modern, "heading-inline")).toBe("0");
  expect(root(css("playful"), "card-border")).toBe("0");
  expect(root(css("playful"), "button-radius")).toBe("9999px");
  expect(root(css("corporate"), "table-numbers")).toBe("tabular-nums");
  // A serif face falls back to a serif.
  expect(root(css("restaurant"), "font-heading")).toMatch(
    /^"Fraunces Variable", ui-serif,.* serif$/,
  );
  // Street food: capitals tracked wide, its heading font imported beside the body's.
  const street = css("street-food");
  expect(root(street, "heading-case")).toBe("uppercase");
  expect(root(street, "section-gap")).toBe("1.5rem");
  expect(root(street, "heading-tracking")).toBe("0.05em");
  expect(root(street, "font-heading")).toContain("Archivo Narrow Variable");
  expect(street).toContain('@import "@fontsource-variable/archivo-narrow";');
  expect(street).toContain('@import "@fontsource-variable/dm-sans";');
});

test("the theme's motion is a few variables, all 0 for a visitor who asks for less", () => {
  const css = (motion: "none" | "subtle" | "lively") =>
    themeCss({ ...emptyUx(), theme: { ...emptyUx().theme, motion } });
  const slow = (text: string) => /:root \{[^}]*--motion-slow: ([^;]+);/.exec(text)?.[1];
  expect(slow(css("none"))).toBe("0ms");
  expect(slow(css("subtle"))).toBe("180ms");
  expect(slow(css("lively"))).toBe("200ms");
  expect(css("lively")).toMatch(
    /@media \(prefers-reduced-motion: reduce\) \{\s*:root \{\s*--motion-fast: 0ms;\s*--motion-slow: 0ms;\s*--motion-distance: 0px;/,
  );
});

test("only lively motion moves a landing page: its sections rise into view and the hero settles", () => {
  const css = (motion: "none" | "subtle" | "lively") =>
    themeCss({ ...emptyUx(), theme: { ...emptyUx().theme, motion } });
  expect(css("lively")).toContain("--landing-motion: kit-rise;");
  expect(css("lively")).toContain("--hero-motion: kit-settle;");
  expect(css("subtle")).toContain("--landing-motion: none;");
  expect(css("lively")).toMatch(/prefers-reduced-motion: reduce[^}]*--landing-motion: none;/);
});

test("the three densities size the kit's controls, rows, cells and cards; standard sits between", () => {
  const css = (density: "comfortable" | "standard" | "compact") =>
    themeCss({ ...emptyUx(), theme: { ...emptyUx().theme, density } });
  const root = (text: string, name: string) =>
    new RegExp(`:root \\{[^}]*--${name}: ([^;]+);`).exec(text)?.[1];
  const sizes = (density: "comfortable" | "standard" | "compact") =>
    ["control-height", "row-height", "cell-padding", "card-padding"].map((n) =>
      root(css(density), n),
    );
  expect(sizes("comfortable")).toEqual(["2.75rem", "4rem", "1rem", "1.5rem"]);
  expect(sizes("standard")).toEqual(["2.5rem", "3.5rem", "0.875rem", "1.25rem"]);
  expect(sizes("compact")).toEqual(["2.25rem", "3.25rem", "0.75rem", "1.25rem"]);
});

test("the style layer's new fields render, in the combinations where misses would show (look-breadth.md §3)", () => {
  const theme = (name: string, body: string) => {
    const parsed = parseTheme({
      path: `themes/${name}.yml`,
      text: `smithableTheme: 0.1\nname: ${name}\n${body}`,
    });
    expect(parsed.diagnostics, name).toEqual([]);
    return parsed.theme as ThemeIR;
  };
  const colors = (mode: string, background: string, foreground: string, primary: string) =>
    `${mode}:\n  background: "${background}"\n  foreground: "${foreground}"\n  primary: "${primary}"\n`;
  const both =
    colors("light", "#f4f1ea", "#1b1d22", "#3346c8") +
    colors("dark", "#14161b", "#eceef2", "#e8b04a");
  const themes = [
    // Glass in dark: the card's tint over the page and a strong band, blurred, a lit top edge.
    theme(
      "glassy",
      `surfaces: { cards: glass, sections: banded, bands: strong }\nmodes: dark\n${colors("dark", "#101218", "#eef0f5", "#8fb4ff")}`,
    ),
    // Duotone in both modes: each mode's primary washes the pictures.
    theme("toned", `pictures: { treatment: duotone }\n${both}`),
    // A condensed display face, huge, in capitals: labels follow in capitals, tracked wide.
    theme(
      "poster",
      `fonts: { body: Inter, heading: Oswald, labels: JetBrains Mono }\nheadings: { weight: 700, tracking: normal, scale: huge, case: upper }\n${both}`,
    ),
    // Texture with bands.
    theme("papery", `texture: paper\nsurfaces: { sections: banded, bands: strong }\n${both}`),
  ];
  const css = (name: string) =>
    themeCss({ ...emptyUx(), theme: { ...emptyUx().theme, preset: name as never } }, themes);
  const root = (text: string, name: string) =>
    new RegExp(`:root \\{[^}]*--${name}: ([^;]+);`).exec(text)?.[1];
  const dark = (text: string, name: string) =>
    new RegExp(`:root\\[data-appearance="dark"\\] \\{[^}]*--${name}: ([^;]+);`).exec(text)?.[1];

  const glassy = css("glassy");
  expect(root(glassy, "card-surface")).toBe("color-mix(in oklab, var(--card) 65%, transparent)");
  expect(root(glassy, "card-blur")).toBe("blur(14px) saturate(1.2)");
  expect(root(glassy, "band-step")).toBe("12%");
  // One mode by design: the same colours under both, and no appearance to choose.
  expect(root(glassy, "background")).toBe(dark(glassy, "background"));
  expect(glassy).toContain('[data-part="appearance"] {\n  display: none;');
  expect(css("toned")).not.toContain('[data-part="appearance"]');

  const toned = css("toned");
  expect(root(toned, "picture-filter")).toMatch(
    /^grayscale\(1\) sepia\(1\) hue-rotate\(-?\d+deg\)/,
  );
  expect(root(toned, "picture-filter")).not.toBe(dark(toned, "picture-filter"));
  expect(root(css("papery"), "picture-filter")).toBe("none");

  const poster = css("poster");
  expect(root(poster, "heading-scale")).toBe("1.45");
  expect(root(poster, "font-heading")).toContain('"Oswald Variable"');
  expect(root(poster, "font-labels")).toContain('"JetBrains Mono Variable", ui-monospace');
  expect(root(poster, "label-case")).toBe("uppercase");
  expect(root(poster, "label-tracking")).toBe("0.05em");
  expect(poster).toContain('@import "@fontsource-variable/jetbrains-mono/wght-italic.css";');
  expect(poster).not.toContain("oswald/wght-italic");

  expect(root(css("papery"), "texture")).toMatch(/^url\("data:image\/svg\+xml,/);
  // Labels unsaid follow the headings: sentence case under headings in sentence case.
  expect(root(css("papery"), "label-case")).toBe("none");
  for (const t of themes) expect(css(t.name)).toMatchSnapshot(t.name);
});
