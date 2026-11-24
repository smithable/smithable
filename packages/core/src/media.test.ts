// A business's stored pictures (docs/design/media-storage.md): the content file's grammar, the
// operation that sets one, who may name it, and every place that would lose one.
import { expect, test } from "vitest";
import { applyOperation, applyOperations, findOperation } from "./apply.js";
import { pictureAt, pictureFile, validateContent } from "./content.js";
import { broughtMedia, lostMedia, mediaInUse, slotName } from "./media.js";
import { refusedArgs } from "./operation.js";
import { validateSpec } from "./spec.js";
import { verificationBefore } from "./verification.js";

const ID = "m_01hz8k3q4r5s6t7v8w9x0y1z2a";
const OTHER = "m_7zzzzzzzzzzzzzzzzzzzzzzzzz";
const spec =
  "smithable: 0.1\napp:\n  name: Roofs\npages:\n  home:\n    route: /\n    landing:\n      hero: {}\n      jobs: { gallery: }\n";
const ir = validateSpec({ path: "smithable.yml", text: spec }).ir;
if (!ir) throw new Error("spec");
const content = (hero: string) =>
  `smithableContent: 0.1\npages:\n  home:\n    hero:\n      title: Roofs\n      image: ${hero}\n`;
const errors = (text: string) =>
  validateContent({ path: "smithable.content.yml", text }, ir).diagnostics.filter(
    (d) => d.severity === "error",
  );

test("a stored picture names its id and its largest width, never a file as well", () => {
  const good = `{ asset: ${ID}, alt: A roof, width: 1600, widths: [480, 960], generated: true }`;
  expect(errors(content(good))).toEqual([]);
  const read = validateContent({ path: "smithable.content.yml", text: content(good) }, ir).content;
  // Its sizes and marks are kept as a file's are: the kit's srcset and the badge need them.
  expect(read?.pages.home?.sections?.hero?.image).toEqual({
    asset: ID,
    alt: "A roof",
    width: 1600,
    widths: [480, 960],
    generated: true,
  });
  for (const [hero, says] of [
    [`{ asset: ${ID}, src: images/a.webp, alt: A, width: 1600 }`, "names its file twice"],
    ["{ asset: m_SHOUTING, alt: A, width: 1600 }", "must be a stored file's id"],
    [`{ asset: ${ID}, alt: A }`, 'needs "width" beside "asset"'],
    [`{ asset: ${ID}, width: 1600 }`, 'needs "alt"'],
    [`{ asset: ${ID}, alt: A, width: 960, widths: [480, 1600] }`, "narrower than its"],
  ] as [string, string][])
    expect(
      errors(content(hero)).map((d) => d.message),
      hero,
    ).toEqual([expect.stringContaining(says)]);
});

test("the kit's file for a stored picture is its copy by width; a file's stays its own", () => {
  const stored = { asset: ID, width: 1600 };
  expect(pictureFile(stored)).toBe(`media/${ID}/w1600.webp`);
  expect(pictureAt(stored, 480)).toBe(`media/${ID}/w480.webp`);
  expect(pictureFile({ src: "images/hero.webp" })).toBe("images/hero.webp");
});

test("mediaInUse lists each stored file once, with every width its places name", () => {
  const text = `smithableContent: 0.1
pages:
  home:
    hero: { image: { asset: ${ID}, alt: A, width: 1600, widths: [480] } }
    jobs:
      items:
        - image: { asset: ${OTHER}, alt: B, width: 960 }
        - image: { asset: ${ID}, alt: A again, width: 960 }
        - image: { asset: not-an-id, alt: C, width: 960 }
        - image: { src: images/d.webp, alt: D }
`;
  expect(mediaInUse({ content: text })).toEqual([
    { asset: ID, variants: ["w480.webp", "w960.webp", "w1600.webp"] },
    { asset: OTHER, variants: ["w960.webp"] },
  ]);
  expect(mediaInUse({})).toEqual([]);
});

test("each place a stored file is no longer in is named, the same file elsewhere or not", () => {
  const before = {
    pages: {
      home: {
        hero: { image: { asset: ID } },
        jobs: { items: [{ image: { asset: ID } }, { image: { asset: OTHER } }] },
      },
    },
  };
  const after = {
    pages: {
      home: { hero: { image: { asset: ID } }, jobs: { items: [{ image: { asset: OTHER } }] } },
    },
  };
  // The second item only moved up: OTHER keeps its one place, ID has one place fewer.
  const lost = lostMedia(before, after);
  expect(lost.map(slotName)).toEqual(["picture 1 of jobs on home"]);
  expect(slotName({ at: ["pages", "home", "hero", "image"], asset: ID })).toBe(
    "the picture of hero on home",
  );
});

const files = { spec, content: content("{ src: images/hero.webp, alt: A roof }") };
const place = (args: Record<string, unknown>) =>
  applyOperation(files, "setSectionPicture", { page: "home", section: "hero", ...args });

test("a file that only moved loses nothing: an item taken out before it, items reordered, a page renamed", () => {
  const items = (...ids: string[]) => ({ items: ids.map((asset) => ({ image: { asset } })) });
  const page = (name: string, jobs: object) => ({ pages: { [name]: { jobs } } });
  const THIRD = "m_3zzzzzzzzzzzzzzzzzzzzzzzzz";
  expect(
    lostMedia(page("home", items(ID, OTHER, THIRD)), page("home", items(OTHER, THIRD))).map(
      slotName,
    ),
  ).toEqual(["picture 1 of jobs on home"]);
  expect(lostMedia(page("home", items(ID, OTHER)), page("home", items(OTHER, ID)))).toEqual([]);
  expect(lostMedia(page("home", items(ID)), page("start", items(ID)))).toEqual([]);
});

test("broughtMedia names a stored file the change brings in, and none it only moves", () => {
  const hero = (image: string) => ({ content: content(image) });
  expect(
    broughtMedia(
      hero("{ src: images/a.webp, alt: A }"),
      hero(`{ asset: ${ID}, alt: A, width: 960 }`),
    ),
  ).toBe(ID);
  expect(
    broughtMedia(
      hero(`{ asset: ${ID}, alt: A, width: 960 }`),
      hero(`{ asset: ${ID}, alt: B, width: 960 }`),
    ),
  ).toBeUndefined();
  // A file already used once, put in a second place, is brought in too.
  const twice = `${content(`{ asset: ${ID}, alt: A, width: 960 }`)}    jobs:\n      items:\n        - image: { asset: ${ID}, alt: A, width: 960 }\n`;
  expect(broughtMedia(hero(`{ asset: ${ID}, alt: A, width: 960 }`), { content: twice })).toBe(ID);
});

test("setSectionPicture places a stored file with the sizes the host read, and only so", () => {
  const set = place({
    asset: ID,
    alt: "A roof",
    rendition: { width: 1600, widths: [960, 480, 1600] },
  });
  if (!set.ok) throw new Error(set.message);
  expect(set.files.content).toContain(`asset: ${ID}`);
  expect(set.files.content).toContain("width: 1600");
  expect(set.files.content).toContain("widths: [480, 960]");
  expect(set.files.content).not.toContain("images/hero.webp");
  // The file the hero had was the owner's, not a stored one: nothing lost, nothing to confirm.
  expect(set.destructive).toBe(false);
  // A copy outside the content file's range is left out, so what is written always reads back.
  const small = place({ asset: ID, alt: "A", rendition: { width: 960, widths: [50] } });
  if (!small.ok) throw new Error(small.message);
  expect(small.files.content).not.toContain("widths");
  expect(errors(small.files.content ?? "")).toEqual([]);

  for (const [args, says] of [
    [{ asset: ID, alt: "A" }, "placed by the hosted service"],
    [{ asset: "m_bad", alt: "A", rendition: { width: 960 } }, ""],
    [{ asset: ID, src: "images/a.webp", alt: "A", rendition: { width: 960 } }, ""],
    [{ src: "images/a.webp", alt: "A", rendition: { width: 960 } }, ""],
    // The content file's own range (100 to 4000 pixels), so what is written always reads back.
    [{ asset: ID, alt: "A", rendition: { width: 9000 } }, ""],
  ] as const) {
    const refused = place(args);
    expect(refused.ok, JSON.stringify(args)).toBe(false);
    if (!refused.ok && says) expect(refused.message).toContain(says);
  }
});

test("taking a stored file out of its place is destructive and names the place; setText cannot", () => {
  const stored = place({ asset: ID, alt: "A roof", rendition: { width: 1600 } });
  if (!stored.ok) throw new Error(stored.message);
  const other = applyOperation(stored.files, "setSectionPicture", {
    page: "home",
    section: "hero",
    src: "images/new.webp",
    alt: "New",
  });
  if (!other.ok) throw new Error(other.message);
  expect(other.destructive).toBe(true);
  expect(other.lostMedia?.map(slotName)).toEqual(["the picture of hero on home"]);
  expect(other.description).toContain("loses the stored file of the picture of hero on home");

  const removed = applyOperations(stored.files, [
    { op: "removeSection", args: { page: "home", section: "hero" } },
  ]);
  if (!removed.ok) throw new Error(removed.message);
  expect(removed.destructive).toBe(true);
  expect(removed.lostMedia?.length).toBe(1);
  // Destructive for the stored file alone: the CLI says no data goes.
  expect(removed.mediaOnly).toBe(true);

  // A batch is read from its start to its end: taken out and put back, nothing is lost.
  const back = applyOperations(stored.files, [
    {
      op: "setSectionPicture",
      args: { page: "home", section: "hero", src: "images/new.webp", alt: "N" },
    },
    {
      op: "setSectionPicture",
      args: { page: "home", section: "hero", asset: ID, alt: "A roof", rendition: { width: 1600 } },
    },
  ]);
  if (!back.ok) throw new Error(back.message);
  expect(back.lostMedia).toBeUndefined();
  expect(back.destructive).toBe(false);

  for (const path of [
    ["pages", "home", "hero", "image", "asset"],
    ["pages", "home", "hero", "image", "src"],
  ]) {
    const typed = applyOperation(stored.files, "setText", { path, text: "images/x.webp" });
    expect(typed.ok, path.join(".")).toBe(false);
    if (!typed.ok) expect(typed.message).toContain("stored file, not text");
  }
});

test("a model never names a stored file, and nobody but the host gives its sizes", () => {
  const op = findOperation("setSectionPicture", []);
  if (!op) throw new Error("op");
  const base = { page: "home", section: "hero", alt: "A" };
  expect(refusedArgs(op, { ...base, asset: ID }, "model")).toContain('"asset"');
  expect(refusedArgs(op, { ...base, asset: ID }, "person")).toBeUndefined();
  expect(refusedArgs(op, { ...base, rendition: { width: 960 } }, "person")).toContain(
    '"rendition"',
  );
  expect(
    refusedArgs(op, { ...base, asset: ID, rendition: { width: 960 } }, "host"),
  ).toBeUndefined();
  expect(refusedArgs(op, { ...base, src: "images/a.webp" }, "model")).toBeUndefined();
});

test("the stored file already there takes new words without sizes, and a proposal shows each loss", () => {
  const stored = place({ asset: ID, alt: "A roof", rendition: { width: 1600, widths: [480] } });
  if (!stored.ok) throw new Error(stored.message);
  const words = applyOperation(stored.files, "setSectionPicture", {
    page: "home",
    section: "hero",
    asset: ID,
    alt: "A slate roof",
  });
  if (!words.ok) throw new Error(words.message);
  expect(words.files.content).toContain("alt: A slate roof");
  expect(words.files.content).toContain("width: 1600");
  expect(words.files.content).toContain("widths: [480]");
  expect(words.destructive).toBe(false);
  const another = applyOperation(stored.files, "setSectionPicture", {
    page: "home",
    section: "hero",
    asset: OTHER,
    alt: "A",
  });
  expect(another.ok).toBe(false);

  const removed = applyOperations(stored.files, [
    { op: "removeSection", args: { page: "home", section: "hero" } },
  ]);
  const v = verificationBefore(stored.files, removed, {
    base: "abc",
    environment: { where: "studio", engine: "0.0.0" },
    depth: "change",
  });
  expect(v.consequences.filter((c) => c.about === "media")).toEqual([
    {
      about: "media",
      says: "the picture of hero on home loses its stored file; the photo library keeps it.",
      undo: "full",
    },
  ]);
});
