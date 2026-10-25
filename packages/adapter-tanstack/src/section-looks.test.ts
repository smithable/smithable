import {
  type AuthIR,
  emptyContent,
  type SpecIR,
  validateAuth,
  validateContent,
  validateSpec,
  validateUx,
} from "@smithable/core";
import { expect, test } from "vitest";
import { generateApp } from "./generate.js";

test("a landing section's look from smithable.ux.yml is its component's props", () => {
  const ir = validateSpec({
    path: "smithable.yml",
    text: "smithable: 0.1\napp: { name: Site }\npages:\n  home:\n    route: /\n    landing:\n      hero:\n      features:\n      testimonials:\n      footer:\n",
  }).ir as SpecIR;
  const auth = validateAuth(
    {
      path: "smithable.auth.yml",
      text: "smithableAuth: 0.1\nsignIn: none\npublic: { pages: [home] }\n",
    },
    ir,
  ).auth as AuthIR;
  const ux = validateUx(
    {
      path: "smithable.ux.yml",
      text: "smithableUx: 0.1\npages:\n  home:\n    sections:\n      hero: { layout: split, image: left }\n      features: { columns: 4 }\n      testimonials: { layout: carousel }\n",
    },
    ir,
  ).ux;
  // Sections of items show only with items.
  const content = validateContent(
    {
      path: "smithable.content.yml",
      text: "smithableContent: 0.1\npages:\n  home:\n    features: { items: [{ title: Fast }] }\n    testimonials: { items: [{ quote: Great, name: Ann }] }\n",
    },
    ir,
  ).content;
  if (!content || !ux) throw new Error("the files do not validate");
  const route =
    generateApp(ir, { smithableVersion: "0.0.0", auth, content, ux }).find(
      (f) => f.path === "src/routes/index.tsx",
    )?.content ?? "";
  // The hero's side is imageSide: its image is the picture.
  expect(route).toContain('layout="split"\n          imageSide="left"');
  expect(route).toContain("columns={4}");
  expect(route).toContain('layout="carousel"');
});

test("a landing page's own theme is a second scope in theme.css, and its font is installed", () => {
  const ir = validateSpec({
    path: "smithable.yml",
    text: "smithable: 0.1\napp: { name: Site }\npages:\n  home:\n    route: /\n    landing:\n      hero:\n      footer:\n",
  }).ir as SpecIR;
  const auth = validateAuth(
    {
      path: "smithable.auth.yml",
      text: "smithableAuth: 0.1\nsignIn: none\npublic: { pages: [home] }\n",
    },
    ir,
  ).auth as AuthIR;
  const ux = validateUx(
    {
      path: "smithable.ux.yml",
      text: "smithableUx: 0.1\ntheme: { preset: corporate }\npages:\n  home: { theme: { preset: playful } }\n",
    },
    ir,
  ).ux;
  if (!ux) throw new Error("no ux");
  const files = generateApp(ir, { smithableVersion: "0.0.0", auth, content: emptyContent(), ux });
  const css = files.find((f) => f.path === "src/theme.css")?.content ?? "";
  expect(css).toContain(
    '@import "@fontsource-variable/source-sans-3";\n@import "@fontsource-variable/nunito-sans";',
  );
  expect(css).toContain("/* The home page's own theme: playful");
  expect(css).toContain('[data-page="home"] {');
  // Dark as the visitor's appearance resolves on <html> (src/kit/appearance.ts): the app's, then
  // the page's own.
  expect(css).toMatch(
    /:root\[data-appearance="dark"\] \{[^}]*\}\n\[data-appearance="dark"\] \[data-page="home"\] \{/,
  );
  expect(css).not.toContain("prefers-color-scheme");
  const pkg = JSON.parse(files.find((f) => f.path === "package.json")?.content ?? "{}");
  expect(Object.keys(pkg.dependencies)).toEqual(
    expect.arrayContaining([
      "@fontsource-variable/source-sans-3",
      "@fontsource-variable/nunito-sans",
    ]),
  );
});

test("a hero's shortcut to a page behind sign-in shows only to those who may open it", () => {
  const ir = validateSpec({
    path: "smithable.yml",
    text: "smithable: 0.1\napp: { name: Status }\nmodels:\n  Incident: { fields: { title: string! } }\npages:\n  home:\n    route: /\n    landing:\n      hero: { shortcuts: [open, history] }\n  open: { crud: Incident }\n  history: { crud: Incident, route: /history }\n",
  }).ir as SpecIR;
  const auth = validateAuth(
    {
      path: "smithable.auth.yml",
      text: "smithableAuth: 0.1\nsignIn: { providers: [google] }\ndefaultAccess: shared\npublic: { pages: [home, open], read: [Incident] }\n",
    },
    ir,
  ).auth as AuthIR;
  const home =
    generateApp(ir, { smithableVersion: "0.0.0", auth, content: emptyContent() }).find(
      (f) => f.path === "src/routes/index.tsx",
    )?.content ?? "";
  expect(home).toContain('{ to: "/open", label: pageUi["open"].title');
  expect(home).toContain('...(allows(pageAccess["history"], viewer) ? [{ to: "/history"');
  expect(home).toMatch(/import \{ [^}]*\ballows\b[^}]*\} from "#\/kit\/access";/);
});

test("robots.txt lets search engines read the public pages and nothing else", () => {
  const ir = validateSpec({
    path: "smithable.yml",
    text: "smithable: 0.1\napp: { name: Shop }\nmodels:\n  Item: { fields: { name: string! } }\npages:\n  home:\n    route: /\n    landing:\n      hero:\n  items: { crud: Item }\n  orders: { crud: Item, route: /orders }\n",
  }).ir as SpecIR;
  const robots = (publicPart: string) => {
    const auth = validateAuth(
      {
        path: "smithable.auth.yml",
        text: `smithableAuth: 0.1\nsignIn: { providers: [google] }\ndefaultAccess: shared\n${publicPart}`,
      },
      ir,
    ).auth as AuthIR;
    return (
      generateApp(ir, { smithableVersion: "0.0.0", auth, content: emptyContent() }).find(
        (f) => f.path === "src/routes/robots[.]txt.ts",
      )?.content ?? ""
    );
  };
  expect(robots("public: { pages: [home, items], read: [Item] }\n")).toContain(
    'const ROBOTS = "User-agent: *\\nAllow: /$\\nAllow: /items\\nAllow: /assets/\\nAllow: /images/\\nAllow: /files/\\nDisallow: /\\n";',
  );
  expect(robots("")).toContain('const ROBOTS = "User-agent: *\\nDisallow: /\\n";');
});

test("a landing page's header look is the layout's header prop; without one the layout has none", () => {
  const ir = validateSpec({
    path: "smithable.yml",
    text: "smithable: 0.1\napp: { name: Site }\npages:\n  home:\n    route: /\n    landing:\n      hero:\n      footer:\n",
  }).ir as SpecIR;
  const auth = validateAuth(
    {
      path: "smithable.auth.yml",
      text: "smithableAuth: 0.1\nsignIn: none\npublic: { pages: [home] }\n",
    },
    ir,
  ).auth as AuthIR;
  const route = (text: string) => {
    const ux = validateUx({ path: "smithable.ux.yml", text: `smithableUx: 0.1\n${text}` }, ir).ux;
    if (!ux) throw new Error("the ux file does not validate");
    return (
      generateApp(ir, { smithableVersion: "0.0.0", auth, content: emptyContent(), ux }).find(
        (f) => f.path === "src/routes/index.tsx",
      )?.content ?? ""
    );
  };
  expect(route("pages:\n  home: { header: { position: sticky } }\n")).toContain(
    'header={{ position: "sticky" }}',
  );
  expect(route("")).not.toContain("header={{");
});
