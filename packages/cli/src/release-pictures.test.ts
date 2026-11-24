import { applyOperation, validateContent, validateSpec, validateUx } from "@smithable/core";
import { expect, test } from "vitest";
import { picturesToReview } from "./release-review.js";

const spec = `smithable: 0.1
app:
  name: Roofs
pages:
  home:
    route: /
    landing:
      hero: {}
      jobs: { gallery:, pictures: work }
      gallery:
      about: { mediaText: }
`;
const made = (src: string) => `{ src: ${src}, alt: A roof, generated: true }`;
const content = `smithableContent: 0.1
pages:
  home:
    hero:
      title: Roofs
      image: ${made("images/hero.webp")}
    jobs:
      items:
        - image: { src: images/jobs/own.webp, alt: Our roof }
        - image: ${made("images/jobs/made.webp")}
    gallery:
      items:
        - image: ${made("images/gallery/deco.webp")}
    about:
      image: ${made("images/about.webp")}
`;

test("the release review lists the hero's and the work sections' generated pictures, nothing else (T1175)", () => {
  const ir = validateSpec({ path: "smithable.yml", text: spec }).ir;
  if (!ir) throw new Error("invalid spec");
  const read = validateContent({ path: "smithable.content.yml", text: content }, ir);
  expect(read.diagnostics.filter((d) => d.severity === "error")).toEqual([]);
  expect(picturesToReview(ir, read.content, undefined)).toEqual([
    { page: "home", section: "hero", src: "images/hero.webp", alt: "A roof" },
    { page: "home", section: "jobs", item: 1, src: "images/jobs/made.webp", alt: "A roof" },
  ]);
  expect(picturesToReview(ir, undefined, undefined)).toEqual([]);
  // A picture the owner kept is not asked about again.
  const kept = validateContent(
    {
      path: "smithable.content.yml",
      text: content
        .split("images/hero.webp, alt: A roof, generated: true")
        .join("images/hero.webp, alt: A roof, generated: true, kept: true"),
    },
    ir,
  );
  expect(picturesToReview(ir, kept.content, undefined).map((p) => p.src)).toEqual([
    "images/jobs/made.webp",
  ]);
});

test("a work collage asks to keep a generated extra picture only while shown", () => {
  const withWork = spec.replace("about: { mediaText: }", "about: { mediaText:, pictures: work }");
  const { ir } = validateSpec({ path: "smithable.yml", text: withWork });
  if (!ir) throw new Error("invalid spec");
  const withExtra = content + `      items:\n        - image: ${made("images/about-extra.webp")}\n`;
  const visible = (text: string) =>
    validateContent({ path: "smithable.content.yml", text }, ir).content;
  const ux = validateUx(
    {
      path: "smithable.ux.yml",
      text: "smithableUx: 0.1\npages: { home: { sections: { about: { layout: collage } } } }\n",
    },
    ir,
  ).ux;
  expect(ux).toBeDefined();
  expect(
    picturesToReview(ir, visible(withExtra), undefined).map((picture) => picture.src),
  ).not.toContain("images/about-extra.webp");
  expect(picturesToReview(ir, visible(withExtra), ux)).toContainEqual({
    page: "home",
    section: "about",
    item: 0,
    src: "images/about-extra.webp",
    alt: "A roof",
  });
  const kept = applyOperation({ spec: withWork, content: withExtra }, "keepPicture", {
    page: "home",
    section: "about",
    item: 0,
  });
  if (!kept.ok || !kept.files.content) throw new Error("Cannot keep extra picture");
  expect(
    picturesToReview(ir, visible(kept.files.content), ux).map((picture) => picture.src),
  ).not.toContain("images/about-extra.webp");
});
