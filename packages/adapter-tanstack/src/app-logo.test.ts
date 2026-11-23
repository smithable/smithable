import {
  type AuthIR,
  emptyContent,
  emptyUx,
  type SpecIR,
  validateAuth,
  validateContent,
  validateSpec,
} from "@smithable/core";
import { expect, test } from "vitest";
import { generateApp } from "./generate.js";
import { manifest } from "./push.js";

// The app's mark (docs/design/app-logo.md §2): before the name in the shell and the landing
// page's header, and the tab's icon.
const ir = validateSpec({
  path: "smithable.yml",
  text: `smithable: 0.1
app: { name: Stillwater }
models:
  Class: { fields: { name: string! } }
pages:
  home: { route: /, landing: { hero: { button: classes }, footer: {} } }
  classes: { crud: Class }
navigation:
  main: [classes]
`,
}).ir as SpecIR;
const auth = validateAuth(
  { path: "smithable.auth.yml", text: "smithableAuth: 0.1\nsignIn: none\n" },
  ir,
).auth as AuthIR;
const generate = (text: string) => {
  const content = validateContent({ path: "smithable.content.yml", text }, ir).content;
  const files = generateApp(ir, {
    smithableVersion: "0.0.0",
    auth,
    content: content ?? emptyContent(),
  });
  return (path: string) => files.find((f) => f.path === path)?.content ?? "";
};

test("an app with a logo shows it in the shell and the landing header, and links it as the icon", () => {
  const file = generate("smithableContent: 0.1\nlogo: { src: images/logo.webp, alt: A lotus }\n");
  const root = file("src/routes/__root.tsx");
  expect(root).toContain('<AppShell appName={app.name} logo="/images/logo.webp"');
  expect(root).toContain('{ rel: "icon", href: "/images/logo.webp" }');
  expect(file("src/routes/index.tsx")).toContain('logo="/images/logo.webp"');
  // The initial stays the fallback for apps without one.
  expect(file("public/favicon.svg")).toContain(">S</text>");
});

test("without a logo the app looks as it did: the name alone and the initial as the icon", () => {
  const file = generate("smithableContent: 0.1\n");
  const root = file("src/routes/__root.tsx");
  expect(root).not.toContain("logo=");
  expect(root).toContain('{ rel: "icon", href: "/favicon.svg", type: "image/svg+xml" }');
  expect(file("src/routes/index.tsx")).not.toContain("logo=");
});

// The default identity (app-logo.md §0): the name as a wordmark, and a tile of its initials.
const tile = (content: string, preset?: string) => {
  const parsed = validateContent(
    { path: "smithable.content.yml", text: `smithableContent: 0.1\n${content}` },
    ir,
  ).content;
  return generateApp(ir, {
    smithableVersion: "0.0.0",
    auth,
    content: parsed ?? emptyContent(),
    ...(preset
      ? { ux: { ...emptyUx(), theme: { ...emptyUx().theme, preset: preset as never } } }
      : {}),
  }).find((f) => f.path === "public/favicon.svg")?.content as string;
};

test("the tile carries the initials on the theme's light primary, a fifth round, the same bytes each time", () => {
  const modern = tile("");
  expect(modern).toContain('rx="6.4"');
  expect(modern).toContain(">S</text>");
  expect(modern).toContain("unicode-bidi:plaintext");
  expect(modern).toBe(tile(""));
  const fill = (svg: string) => /<rect[^>]* fill="(#[0-9a-f]{6})"/.exec(svg)?.[1];
  const ink = (svg: string) => /<text[^>]* fill="(#[0-9a-f]{6})"/.exec(svg)?.[1];
  expect(fill(modern)).toBeDefined();
  expect(ink(modern)).toBeDefined();
  expect(fill(modern)).not.toBe("#3b5bdb");
  // Another theme, another tile.
  const street = tile("", "street-food");
  expect(fill(street)).not.toBe(fill(modern));
  // The content file's initials, two letters set smaller.
  const two = tile("initials: SW\n");
  expect(two).toContain(">SW</text>");
  expect(two).toContain('font-size="14"');
});

test("a name without letters gives the tile alone", () => {
  const bare = validateSpec({
    path: "smithable.yml",
    text: "smithable: 0.1\napp: { name: '🙂' }\nmodels:\n  Class: { fields: { name: string! } }\npages:\n  classes: { crud: Class }\n",
  }).ir as SpecIR;
  const svg = generateApp(bare, { smithableVersion: "0.0.0", auth, content: emptyContent() }).find(
    (f) => f.path === "public/favicon.svg",
  )?.content;
  expect(svg).toContain("<rect");
  expect(svg).not.toContain("<text");
});

test("the name is a wordmark in the shell and the landing header, with or without a logo, in the theme's heading type", () => {
  const file = generate("smithableContent: 0.1\nlogo: { src: images/logo.webp, alt: A lotus }\n");
  // Both of each part's branches (with a mark and without) set the name as the wordmark.
  expect(file("src/kit/AppShell.tsx").match(/data-part="wordmark"/g)).toHaveLength(2);
  expect(file("src/kit/Landing.tsx").match(/data-part="wordmark"/g)).toHaveLength(2);
  const css = file("src/styles.css");
  const rule = /\[data-part="wordmark"\] \{([^}]*)\}/.exec(css)?.[1] ?? "";
  expect(rule).toContain("font-family: var(--font-heading, inherit)");
  expect(rule).toContain("font-weight: var(--heading-weight, 700)");
  expect(rule).toContain("text-transform: var(--heading-case, none)");
  expect(rule).toContain("letter-spacing: -0.02em");
});

test("an installed app with a logo carries it last in its manifest, after the tile", () => {
  const content = validateContent(
    {
      path: "smithable.content.yml",
      text: "smithableContent: 0.1\nlogo: { src: images/logo.webp, alt: A lotus }\n",
    },
    ir,
  ).content;
  const icons = JSON.parse(manifest(ir, content)).icons;
  expect(icons).toEqual([
    { src: "/favicon.svg", sizes: "any", type: "image/svg+xml" },
    { src: "/images/logo.webp", sizes: "any", type: "image/webp" },
  ]);
  expect(JSON.parse(manifest(ir)).icons).toHaveLength(1);
});
