import { expect, test } from "vitest";
import { applyOperation } from "../apply.js";
import { validateSpec } from "../spec.js";

const spec = (landing: string) =>
  `smithable: 0.1\napp:\n  name: Roofs\npages:\n  home:\n    route: /\n    landing:\n${landing}`;
const sections = (text: string) => {
  const { ir, diagnostics } = validateSpec({ path: "smithable.yml", text });
  return { sections: ir?.pages.find((p) => p.id === "home")?.sections ?? [], diagnostics };
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
