import {
  type AuthIR,
  emptyContent,
  type SpecIR,
  validateAuth,
  validateContent,
  validateSpec,
} from "@smithable/core";
import { expect, test } from "vitest";
import { generateApp } from "./generate.js";

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
