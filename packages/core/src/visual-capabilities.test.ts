import { expect, test } from "vitest";
import { applyOperation } from "./apply.js";
import { validateContent } from "./content.js";
import { validateSpec } from "./spec.js";
import { validateUx } from "./ux.js";

const spec =
  "smithable: 0.1\napp: {name: Studio}\nmodels: {Item: {fields: {name: string!}}}\npages:\n  home: {route: /, landing: {hero: {}, story: {mediaText: true, button: items}, gallery: {}}}\n  items: {crud: Item}\n";
const ir = validateSpec({ path: "smithable.yml", text: spec }).ir;
if (!ir) throw new Error("invalid fixture");
test("finite rhythm/reading/media choices parse; arbitrary CSS/numbers and wrong contexts refuse", () => {
  const valid = validateUx(
    {
      path: "smithable.ux.yml",
      text: "smithableUx: 0.1\npages: {home: {sections: {story: {rhythm: airy, measure: reading, layout: split, image: right, fit: contain, aspect: portrait, focal: left}, gallery: {aspect: square, fit: contain}}}}\n",
    },
    ir,
  );
  expect(valid.diagnostics).toEqual([]);
  expect(valid.ux?.pages.home?.looks?.story).toMatchObject({
    rhythm: "airy",
    measure: "reading",
    focal: "left",
  });
  for (const [key, value] of [
    ["rhythm", "17px"],
    ["measure", "calc(100vw)"],
    ["focal", "30% 20%"],
    ["aspect", "17/4"],
    ["fit", "stretch"],
  ])
    expect(
      validateUx(
        {
          path: "smithable.ux.yml",
          text: `smithableUx: 0.1\npages: {home: {sections: {story: {${key}: ${JSON.stringify(value)}}}}}\n`,
        },
        ir,
      ).ux,
    ).toBeUndefined();
  expect(
    validateUx(
      {
        path: "smithable.ux.yml",
        text: "smithableUx: 0.1\npages: {home: {sections: {hero: {measure: reading}}}}\n",
      },
      ir,
    ).ux,
  ).toBeUndefined();
});
test("media section retains existing image identity, required alt, captions and safe plain texts", () => {
  const content =
    "smithableContent: 0.1\npages:\n  home:\n    story:\n      title: A local story\n      text: First paragraph\n      caption: At work\n      image: {src: images/story.png, alt: A maker near the edge}\n";
  const read = validateContent({ path: "smithable.content.yml", text: content }, ir);
  expect(read.diagnostics).toEqual([]);
  expect(read.content?.pages.home?.sections?.story?.image?.alt).toBe("A maker near the edge");
  expect(
    validateContent(
      { path: "smithable.content.yml", text: content.replace(", alt: A maker near the edge", "") },
      ir,
    ).content,
  ).toBeUndefined();
});
test("the existing add/move/remove and language/text operations own the new section", () => {
  const initial = {
    spec: "smithable: 0.1\napp: {name: Studio}\npages: {about: {sections: {intro: {text: true}}}}\n",
  };
  const added = applyOperation(initial, "addSection", {
    page: "about",
    section: "story",
    kind: "mediaText",
  });
  if (!added.ok) throw new Error(`${added.message} ${JSON.stringify(added.diagnostics)}`);
  const words = applyOperation(added.files, "setTexts", {
    texts: {
      "pages.about.story.title": "Our makers",
      "pages.about.story.text": "Two paragraphs\n\nMore words",
      "pages.about.story.caption": "A working day",
      "pages.about.story.image.src": "images/story.png",
      "pages.about.story.image.alt": "A maker at work",
    },
  });
  if (!words.ok) throw new Error(words.message);
  const moved = applyOperation(words.files, "moveSection", {
    page: "about",
    section: "story",
    before: "intro",
  });
  if (!moved.ok) throw new Error(moved.message);
  expect(moved.files.content).toBe(words.files.content);
  const language = applyOperation(moved.files, "addLanguage", { language: "sv" });
  if (!language.ok) throw new Error(language.message);
  const translated = applyOperation(language.files, "setText", {
    path: ["pages", "about", "story", "caption"],
    text: "En arbetsdag",
    language: "sv",
  });
  if (!translated.ok) throw new Error(translated.message);
  expect(translated.files.translations?.sv).toContain("En arbetsdag");
  const removed = applyOperation(translated.files, "removeSection", {
    page: "about",
    section: "story",
  });
  if (!removed.ok) throw new Error(removed.message);
  expect(removed.files.content).not.toContain("Our makers");
  expect(removed.files.translations?.sv).not.toContain("En arbetsdag");
});
