import { validateContent, validateSpec } from "@smithable/core";
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
  expect(picturesToReview(ir, read.content)).toEqual([
    { page: "home", section: "hero", src: "images/hero.webp", alt: "A roof" },
    { page: "home", section: "jobs", item: 1, src: "images/jobs/made.webp", alt: "A roof" },
  ]);
  expect(picturesToReview(ir, undefined)).toEqual([]);
});
