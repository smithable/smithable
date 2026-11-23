import { expect, test } from "vitest";
import { applyOperation } from "../apply.js";
import { validateContent } from "../content.js";
import { validateSpec } from "../spec.js";

// section-film.md (T1278): a hero's film is one optional key beside its picture.
const spec =
  "smithable: 0.1\napp:\n  name: Roofs\npages:\n  home:\n    route: /\n    landing:\n      hero: {}\n      story: { mediaText: }\n";
const files = (image = "{ src: images/hero.webp, alt: A roof }") => ({
  spec,
  content: `smithableContent: 0.1\npages:\n  home:\n    hero:\n      image: ${image}\n    story:\n      image: { src: images/story.webp, alt: A ladder }\n`,
});
const ir = validateSpec({ path: "smithable.yml", text: spec }).ir;
const problems = (text: string) =>
  validateContent({ path: "smithable.content.yml", text }, ir ?? (undefined as never))
    .diagnostics.filter((d) => d.severity === "error")
    .map((d) => d.message);
const film = (from: ReturnType<typeof files>, args: Record<string, unknown>) =>
  applyOperation(from, "setSectionFilm", { page: "home", section: "hero", ...args });

test("setSectionFilm puts a film on a hero's picture and takes it off again (T1278)", () => {
  const set = film(files(), { src: "images/hero.mp4" });
  if (!set.ok) throw new Error(set.message);
  expect(set.files.content).toContain("film: { src: images/hero.mp4 }");
  expect(problems(set.files.content ?? "")).toEqual([]);
  // Another file replaces it, and loses the origin the old one had.
  const made = files(
    "{ src: images/hero.webp, alt: A roof, film: { src: images/a.mp4, generated: true, kind: ai-realistic } }",
  );
  expect(problems(made.content)).toEqual([]);
  const own = film(made, { src: "images/own.mp4" });
  expect(own.ok && own.files.content).toContain("src: images/own.mp4");
  expect(own.ok && own.files.content).not.toContain("generated");
  // Without a file it goes, and the content is what it was before.
  const off = film({ ...files(), content: set.files.content ?? "" }, {});
  expect(off.ok && off.files.content).toBe(files().content);
  expect(film(files(), {}).ok).toBe(false);
});

test("a film needs a hero with a picture and an MP4 under images/ (T1278)", () => {
  const bare = { spec, content: "smithableContent: 0.1\n" };
  const none = film(bare, { src: "images/hero.mp4" });
  expect(!none.ok && none.message).toMatch(/no picture/);
  const story = film(files(), { section: "story", src: "images/story.mp4" });
  expect(!story.ok && story.message).toMatch(/Only a hero takes a film/);
  for (const src of ["images/hero.webm", "../hero.mp4", "images/hero.mov", ""])
    expect(film(files(), { src }).ok).toBe(false);
  // The file says the same: only a hero's picture has one, and only an MP4.
  expect(
    problems(files("{ src: images/hero.webp, alt: A, film: { src: images/a.webm } }").content),
  ).toEqual([
    '"src" of the film of the image of "hero" of page "home" must be an MP4 file in the app\'s public/images/ folder, e.g. images/hero.mp4.',
  ]);
  expect(
    problems(
      "smithableContent: 0.1\npages:\n  home:\n    story:\n      image: { src: images/s.webp, alt: S, film: { src: images/s.mp4 } }\n",
    ).join(),
  ).toMatch(/film/);
  expect(
    problems(
      files(
        "{ src: images/hero.webp, alt: A, film: { src: images/a.mp4, kind: photograph, generated: true } }",
      ).content,
    ).join(),
  ).toMatch(/must agree/);
});

test("another picture drops the film, the same picture keeps it (T1278)", () => {
  const filmed = files("{ src: images/hero.webp, alt: A roof, film: { src: images/hero.mp4 } }");
  const same = applyOperation(filmed, "setSectionPicture", {
    page: "home",
    section: "hero",
    src: "images/hero.webp",
    alt: "A red roof",
  });
  expect(same.ok && same.files.content).toContain("images/hero.mp4");
  const other = applyOperation(filmed, "setSectionPicture", {
    page: "home",
    section: "hero",
    src: "images/other.webp",
  });
  expect(other.ok && other.files.content).not.toContain("mp4");
});
