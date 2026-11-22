import { expect, test } from "vitest";
import { applyOperation } from "../apply.js";
import { validateContent } from "../content.js";
import { YamlEditor } from "../edit.js";
import { validateSpec } from "../spec.js";

const spec = (landing: string) =>
  `smithable: 0.1\napp:\n  name: Roofs\npages:\n  home:\n    route: /\n    landing:\n${landing}`;
const sections = (text: string) => {
  const { ir, diagnostics } = validateSpec({ path: "smithable.yml", text });
  return { sections: ir?.pages.find((p) => p.id === "home")?.sections ?? [], diagnostics, ir };
};

test("a gallery's pictures are the owner's work when the spec says so, and only then (T1175)", () => {
  const said = sections(
    spec("      hero: {}\n      jobs: { gallery:, pictures: work }\n      gallery:\n"),
  );
  expect(said.diagnostics.filter((d) => d.severity === "error")).toEqual([]);
  expect(said.sections.find((s) => s.name === "jobs")?.pictures).toBe("work");
  // Never guessed from a name: a section called jobs without the key is decoration.
  expect(said.sections.find((s) => s.name === "gallery")?.pictures).toBeUndefined();
  const faq = sections(spec("      faq: { pictures: work }\n"));
  expect(faq.diagnostics.map((d) => d.message)).toContain(
    'Only a gallery or mediaText section has "pictures".',
  );
  const other = sections(spec("      gallery: { pictures: decoration }\n"));
  expect(other.diagnostics.map((d) => d.message)).toContain(
    '"pictures" is "work" or not said, not "decoration".',
  );
});

test("setSectionPictures marks a section's pictures as work and takes it off again (T1175)", () => {
  const files = { spec: spec("      hero: {}\n      gallery:\n      faq:\n") };
  const marked = applyOperation(files, "setSectionPictures", {
    page: "home",
    section: "gallery",
    pictures: "work",
  });
  if (!marked.ok) throw new Error(marked.message);
  expect(sections(marked.files.spec).sections.find((s) => s.name === "gallery")?.pictures).toBe(
    "work",
  );
  const off = applyOperation(marked.files, "setSectionPictures", {
    page: "home",
    section: "gallery",
  });
  if (!off.ok) throw new Error(off.message);
  expect(off.files.spec).not.toContain("pictures");
  const faq = applyOperation(files, "setSectionPictures", {
    page: "home",
    section: "faq",
    pictures: "work",
  });
  expect(faq.ok).toBe(false);
});

test("setSectionPicture replaces or removes a gallery's picture by its place (T1175)", () => {
  const files = {
    spec: spec("      hero: {}\n      jobs: { gallery:, pictures: work }\n      faq:\n"),
    content: `smithableContent: 0.1
pages:
  home:
    jobs:
      items:
        - image: { src: images/jobs/a.webp, alt: A roof, generated: true, kind: ai-realistic }
          caption: First
        - image: { src: images/jobs/b.webp, alt: B roof, generated: true }
          caption: Second
`,
  };
  const picture = (args: Record<string, unknown>) =>
    applyOperation(files, "setSectionPicture", { page: "home", section: "jobs", ...args });
  // The owner's own file in its place: the mark and the kind go, the caption and alt stay.
  const own = picture({ item: 0, src: "images/jobs-own.webp" });
  if (!own.ok) throw new Error(own.message);
  expect(own.files.content).toContain("images/jobs-own.webp");
  expect(own.files.content).toContain("caption: First");
  expect(own.files.content).not.toContain("ai-realistic");
  expect(own.files.content).toMatch(/b\.webp.*generated: true/);
  // Remove takes the item, caption and all; the other stays.
  const gone = picture({ item: 0 });
  if (!gone.ok) throw new Error(gone.message);
  expect(gone.files.content).not.toContain("First");
  expect(gone.files.content).toContain("caption: Second");
  expect(picture({ item: 2 }).ok).toBe(false);
  expect(
    applyOperation(files, "setSectionPicture", { page: "home", section: "hero", item: 0 }).ok,
  ).toBe(false);
});

const fail = (): never => {
  throw new Error("invalid spec");
};
const keptFiles = (content = "") => ({
  spec: spec("      hero: {}\n      jobs: { gallery:, pictures: work }\n"),
  content: `smithableContent: 0.1
pages:
  home:
    hero:
      image: { src: images/hero.webp, alt: A roof, generated: true, kind: ai-realistic }
    jobs:
      items:
        - image: { src: images/jobs/a.webp, alt: A roof, generated: true }
        - image: { src: images/jobs/b.webp, alt: B roof, generated: true }
${content}`,
});
const run = (files: ReturnType<typeof keptFiles>, op: string, args: Record<string, unknown>) => {
  const done = applyOperation(files, op, args);
  if (!done.ok) throw new Error(done.message);
  return { ...files, content: done.files.content ?? "" };
};
const keptAt = (content: string) => {
  const found: string[] = [];
  const walk = (node: unknown): void => {
    if (!node || typeof node !== "object") return;
    const image = node as { kept?: unknown; src?: string };
    if (image.kept === true && image.src) found.push(image.src);
    for (const value of Object.values(node)) walk(value);
  };
  walk(new YamlEditor(content).get([]));
  return found;
};

test("keepPicture keeps a generated picture, never the owner's own, and undo is the file before (T1175)", () => {
  const files = keptFiles();
  const hero = run(files, "keepPicture", { page: "home", section: "hero" });
  expect(keptAt(hero.content)).toEqual(["images/hero.webp"]);
  const item = run(hero, "keepPicture", { page: "home", section: "jobs", item: 1 });
  expect(keptAt(item.content)).toEqual(["images/hero.webp", "images/jobs/b.webp"]);
  // Asked again with kept false.
  expect(
    keptAt(run(item, "keepPicture", { page: "home", section: "hero", kept: false }).content),
  ).toEqual(["images/jobs/b.webp"]);
  // An owner's own picture is never kept, by the operation or by hand.
  const own = run(files, "setSectionPicture", {
    page: "home",
    section: "hero",
    src: "images/own.webp",
  });
  expect(applyOperation(own, "keepPicture", { page: "home", section: "hero" }).ok).toBe(false);
  const noise = validateContent(
    {
      path: "smithable.content.yml",
      text: "smithableContent: 0.1\npages:\n  home:\n    hero:\n      image: { src: images/own.webp, alt: Ours, kept: true }\n",
    },
    sections(files.spec).ir ?? fail(),
  );
  expect(noise.diagnostics.map((d) => d.message)).toContain(
    '"kept" of the image of "hero" of page "home" says the owner kept a picture an AI made: it needs "generated: true" beside it.',
  );
});

test("kept goes wherever another picture takes the place, whatever the operation (T1175)", () => {
  let kept = run(keptFiles(), "keepPicture", { page: "home", section: "hero" });
  kept = run(kept, "keepPicture", { page: "home", section: "jobs", item: 0 });
  kept = run(kept, "keepPicture", { page: "home", section: "jobs", item: 1 });
  expect(keptAt(kept.content)).toHaveLength(3);
  const hero = { page: "home", section: "hero" };
  // Replace: the owner's own file, in the hero and in a gallery.
  expect(
    keptAt(run(kept, "setSectionPicture", { ...hero, src: "images/own.webp" }).content),
  ).not.toContain("images/own.webp");
  expect(
    keptAt(
      run(kept, "setSectionPicture", {
        page: "home",
        section: "jobs",
        item: 0,
        src: "images/jobs-own.webp",
      }).content,
    ),
  ).toEqual(["images/hero.webp", "images/jobs/b.webp"]);
  // Clear: the picture goes, and a gallery's next picture moves up still kept (the same file).
  expect(keptAt(run(kept, "setSectionPicture", hero).content)).toEqual([
    "images/jobs/a.webp",
    "images/jobs/b.webp",
  ]);
  expect(
    keptAt(run(kept, "setSectionPicture", { page: "home", section: "jobs", item: 0 }).content),
  ).toEqual(["images/hero.webp", "images/jobs/b.webp"]);
  // Another file by its src, as a text: setText remembers nothing of kept, and kept still goes.
  expect(
    keptAt(
      run(kept, "setText", {
        text: "images/other.webp",
        path: ["pages", "home", "hero", "image", "src"],
      }).content,
    ),
  ).toEqual(["images/jobs/a.webp", "images/jobs/b.webp"]);
  // Even an edit of the file's text by hand, through the operation layer.
  const edited = run(kept, "editSpec", {
    file: "smithable.content.yml",
    text: kept.content.split("images/jobs/b.webp").join("images/jobs/c.webp"),
  });
  expect(keptAt(edited.content)).toEqual(["images/hero.webp", "images/jobs/a.webp"]);
  // The same picture with new words (and so a recolour, which keeps its file) stays kept.
  expect(
    keptAt(
      run(kept, "setSectionPicture", { ...hero, src: "images/hero.webp", alt: "Ink" }).content,
    ),
  ).toContain("images/hero.webp");
  // The owner's own file, by name one the owner kept elsewhere, is not kept: it is not an AI's.
  expect(
    keptAt(run(kept, "setSectionPicture", { ...hero, src: "images/jobs/a.webp" }).content),
  ).toEqual(["images/jobs/a.webp", "images/jobs/b.webp"]);
  // A file kept in another place is no keep here: the hero given the gallery's kept file by its
  // src asks again (a second reviewer's point).
  expect(
    keptAt(
      run(kept, "setText", {
        text: "images/jobs/b.webp",
        path: ["pages", "home", "hero", "image", "src"],
      }).content,
    ),
  ).toEqual(["images/jobs/a.webp", "images/jobs/b.webp"]);
  // Studio's form tries a picture on (kept goes); its Cancel is undo, the files as they were,
  // where the picture the owner kept is back and still kept.
  const tried = run(kept, "setSectionPicture", { ...hero, src: "images/try.webp" });
  expect(keptAt(tried.content)).not.toContain("images/try.webp");
  expect(keptAt(kept.content)).toContain("images/hero.webp");
});

test("keepPicture keeps only what the review asks about, and a stale row changes nothing (T1175)", () => {
  const files = keptFiles();
  // A decorative gallery is never asked about, so nothing in it is kept ahead.
  const decoration = { ...files, spec: spec("      hero: {}\n      jobs: { gallery: }\n") };
  const ahead = applyOperation(decoration, "keepPicture", {
    page: "home",
    section: "jobs",
    item: 0,
  });
  expect(ahead.ok).toBe(false);
  // A row that shows another file than the one there now is refused, for each choice.
  const was = { page: "home", section: "jobs", item: 0, was: "images/jobs/b.webp" };
  for (const [op, args] of [
    ["keepPicture", was],
    ["setSectionPicture", was],
    ["setSectionPicture", { ...was, src: "images/own.webp", alt: "Ours" }],
  ] as const) {
    const done = applyOperation(files, op, args);
    expect(done.ok, op).toBe(false);
    if (!done.ok) expect(done.message).toContain("no longer images/jobs/b.webp");
  }
  expect(applyOperation(files, "setSectionPicture", { ...was, was: "images/jobs/a.webp" }).ok).toBe(
    true,
  );
});
