// A hero's stored film (media-storage.md §7; T1544, T1480): its grammar, its files, its own slot
// inside a stored picture, and the checks setSectionFilm makes against the host's record.
import { expect, test } from "vitest";
import { applyOperation, findOperation } from "./apply.js";
import { filmFiles, validateContent } from "./content.js";
import { lostMedia, mediaInUse, mediaSlots, slotName } from "./media.js";
import { refusedArgs } from "./operation.js";
import { validateSpec } from "./spec.js";

const ID = "m_01hz8k3q4r5s6t7v8w9x0y1z2a";
const FILM = "m_7zzzzzzzzzzzzzzzzzzzzzzzzz";
const spec =
  "smithable: 0.1\napp:\n  name: Roofs\npages:\n  home:\n    route: /\n    landing:\n      hero: {}\n";
const ir = validateSpec({ path: "smithable.yml", text: spec }).ir;
if (!ir) throw new Error("spec");
const content = (image: string) =>
  `smithableContent: 0.1\npages:\n  home:\n    hero:\n      title: Roofs\n      image: ${image}\n`;
const errors = (text: string) =>
  validateContent({ path: "smithable.content.yml", text }, ir)
    .diagnostics.filter((d) => d.severity === "error")
    .map((d) => d.message);
const storedPicture = (film = "") =>
  `{ asset: ${ID}, alt: A roof, width: 1600${film ? `, film: ${film}` : ""} }`;

test("a stored film names its id and its renditions, never a file as well", () => {
  const good = content(storedPicture(`{ asset: ${FILM}, heights: [720, 1080] }`));
  expect(errors(good)).toEqual([]);
  const read = validateContent({ path: "smithable.content.yml", text: good }, ir).content;
  expect(read?.pages.home?.sections?.hero?.image?.film).toEqual({
    asset: FILM,
    heights: [720, 1080],
  });
  // Over a picture of the owner's own too.
  expect(
    errors(content(`{ src: images/hero.webp, alt: A, film: { asset: ${FILM}, heights: [720] } }`)),
  ).toEqual([]);
  for (const film of [
    `{ asset: ${FILM}, src: images/a.mp4, heights: [720] }`,
    "{ asset: m_SHOUTING, heights: [720] }",
    `{ asset: ${FILM} }`,
    `{ asset: ${FILM}, heights: [] }`,
    `{ asset: ${FILM}, heights: [1080, 720] }`,
    `{ asset: ${FILM}, heights: [480] }`,
    `{ asset: ${FILM}, heights: [720, 720] }`,
    "{ src: images/a.mp4, heights: [720] }",
  ])
    expect(errors(content(storedPicture(film))), film).not.toEqual([]);
});

test("a stored film plays its tallest rendition, and its 720 one on a narrow screen", () => {
  expect(filmFiles({ asset: FILM, heights: [720, 1080] })).toEqual({
    src: `media/${FILM}/1080.mp4`,
    smaller: `media/${FILM}/720.mp4`,
  });
  expect(filmFiles({ asset: FILM, heights: [720] })).toEqual({ src: `media/${FILM}/720.mp4` });
  expect(filmFiles({ src: "images/hero.mp4" })).toEqual({ src: "images/hero.mp4" });
});

test("a film inside a stored picture is its own place, listed with its renditions and poster (T1480)", () => {
  const text = content(storedPicture(`{ asset: ${FILM}, heights: [720, 1080] }`));
  expect(mediaInUse({ content: text })).toEqual([
    { asset: ID, variants: ["w1600.webp"] },
    { asset: FILM, variants: ["720.mp4", "1080.mp4", "poster.webp"] },
  ]);
  // Over the owner's own picture, the film alone.
  expect(
    mediaInUse({
      content: content(`{ src: images/a.webp, alt: A, film: { asset: ${FILM}, heights: [720] } }`),
    }),
  ).toEqual([{ asset: FILM, variants: ["720.mp4", "poster.webp"] }]);
  const doc = {
    pages: { home: { hero: { image: { asset: ID, film: { asset: FILM, heights: [720] } } } } },
  };
  expect(mediaSlots(doc).map(slotName)).toEqual([
    "the picture of hero on home",
    "the film of hero on home",
  ]);
  // The film taken off, the picture kept: only the film's place is lost.
  const kept = { pages: { home: { hero: { image: { asset: ID } } } } };
  expect(lostMedia(doc, kept).map(slotName)).toEqual(["the film of hero on home"]);
});

test("removeMedia takes a deleted film off its hero and leaves the picture", () => {
  const files = { spec, content: content(storedPicture(`{ asset: ${FILM}, heights: [720] }`)) };
  const done = applyOperation(files, "removeMedia", { asset: [FILM] });
  if (!done.ok) throw new Error(done.message);
  expect(done.files.content).toBe(content(storedPicture()));
  // Both deleted at once: the film is taken first (last place first), then the picture.
  const both = applyOperation(files, "removeMedia", { asset: [ID, FILM] });
  if (!both.ok) throw new Error(both.message);
  expect(both.files.content).not.toContain("m_");
  expect(both.files.content).toContain("title: Roofs");
});

const record = { width: 3840, height: 2160, heights: [720, 1080], duration: 6.2, sound: true };
const files = { spec, content: content("{ src: images/hero.webp, alt: A roof }") };
const film = (args: Record<string, unknown>, from = files) =>
  applyOperation(from, "setSectionFilm", { page: "home", section: "hero", ...args });

test("setSectionFilm places a stored film with the renditions the record lists", () => {
  // A 4K phone film with sound: its renditions are silent and at most 1080 high, so it plays.
  const set = film({ asset: FILM, record });
  if (!set.ok) throw new Error(set.message);
  expect(set.files.content).toContain(`film: { asset: ${FILM}, heights: [720, 1080] }`);
  expect(errors(set.files.content ?? "")).toEqual([]);
  const portrait = film({
    asset: FILM,
    record: { ...record, width: 1080, height: 1920, heights: [720] },
  });
  expect(portrait.ok && portrait.files.content).toContain("heights: [720] }");
  // The same film again keeps its place, with the renditions the record has now; without a
  // record, as it is.
  const after = { spec, content: set.files.content ?? "" };
  const again = film({ asset: FILM, record: { ...record, heights: [720] } }, after);
  expect(again.ok && again.files.content).toContain("heights: [720] }");
  expect(film({ asset: FILM }, after).ok).toBe(true);
  // A file of the owner's replaces it.
  const own = film({ src: "images/own.mp4" }, after);
  expect(own.ok && own.files.content).toContain("film: { src: images/own.mp4 }");
});

test("setSectionFilm refuses a stored film its record does not allow", () => {
  for (const [args, says] of [
    [{ asset: FILM }, /Photos and videos/],
    [{ asset: FILM, record: { ...record, duration: 2.9 } }, /runs 2\.9 seconds/],
    [{ asset: FILM, record: { ...record, duration: 12.5 } }, /3 to 12/],
    [{ asset: FILM, record: { ...record, heights: [] } }, /not made/],
    [{ asset: FILM, record: { ...record, heights: [480] } }, /not made/],
    [{ asset: FILM, record: { ...record, width: 0 } }, /no size/],
    [{ asset: "m_SHOUTING", record }, /stored file's id/],
    [{ asset: FILM, src: "images/a.mp4", record }, /not both/],
    [{ src: "images/a.mp4", record }, /no stored record/],
  ] as const) {
    const result = film(args);
    expect(!result.ok && result.message, JSON.stringify(args)).toMatch(says);
  }
});

test("a model never names a stored film, and only the host gives its record", () => {
  const op = findOperation("setSectionFilm", []);
  if (!op) throw new Error("op");
  const base = { page: "home", section: "hero" };
  expect(refusedArgs(op, { ...base, asset: FILM }, "model")).toContain('"asset"');
  expect(refusedArgs(op, { ...base, asset: FILM }, "person")).toBeUndefined();
  expect(refusedArgs(op, { ...base, asset: FILM, record }, "person")).toContain('"record"');
  expect(refusedArgs(op, { ...base, asset: FILM, record }, "host")).toBeUndefined();
  expect(refusedArgs(op, { ...base, src: "images/a.mp4" }, "model")).toBeUndefined();
});
