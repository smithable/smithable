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
