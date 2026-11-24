import {
  type AuthIR,
  type SpecIR,
  validateAuth,
  validateContent,
  validateSpec,
} from "@smithable/core";
import { expect, test } from "vitest";
import { generateApp } from "./generate.js";

// A hero's film (docs/design/section-film.md, T1278): one prop on the hero, and the film's code
// only in an app that has one.
const ir = validateSpec({
  path: "smithable.yml",
  text: "smithable: 0.1\napp: { name: Roofs }\npages:\n  home:\n    route: /\n    landing:\n      hero: {}\n",
}).ir as SpecIR;
const auth = validateAuth(
  {
    path: "smithable.auth.yml",
    text: "smithableAuth: 0.1\nsignIn: none\npublic: { pages: [home] }\n",
  },
  ir,
).auth as AuthIR;
const app = (image: string) => {
  const { content, diagnostics } = validateContent(
    {
      path: "smithable.content.yml",
      text: `smithableContent: 0.1\npages:\n  home:\n    hero:\n      image: ${image}\n`,
    },
    ir,
  );
  expect(diagnostics.filter((d) => d.severity === "error")).toEqual([]);
  return generateApp(ir, { smithableVersion: "0.0.0", auth, content });
};

test("a hero's film is handed to the hero, and its code is written only with it (T1278)", () => {
  const still = app("{ src: images/hero.webp, alt: A roof }");
  const moving = app(
    "{ src: images/hero.webp, alt: A roof, film: { src: images/hero.mp4, generated: true, kind: ai-realistic } }",
  );
  const file = (files: typeof still, path: string) => files.find((f) => f.path === path)?.content;
  expect(file(still, "src/kit/Film.tsx")).toBeUndefined();
  expect(file(moving, "src/kit/Film.tsx")).toContain("export function Film(");
  const home = file(moving, "src/routes/index.tsx") ?? "";
  expect(home).toContain('import { Film } from "#/kit/Film";');
  expect(home).toContain(
    'film={(framed) => <Film src="/images/hero.mp4" generated kind="ai-realistic" framed={framed} />}',
  );
  // Without the film every other file is byte for byte the still app's.
  const others = (files: typeof still) =>
    files.filter((f) => f.path !== "src/kit/Film.tsx" && f.path !== "src/routes/index.tsx");
  expect(others(moving)).toEqual(others(still));
  expect(file(still, "src/routes/index.tsx")).not.toContain("Film");
});
