import { validateSpec } from "@smithable/core";
import { expect, test } from "vitest";
import { type PictureEntry, pickPictures, words } from "./pictures.js";

const entry = (id: string, kind: string, tags: string[]): PictureEntry => ({
  id,
  kind,
  url: `https://docs.smithable.ai/images/${kind}/${id}.webp`,
  alt: id,
  tags,
});
const index: PictureEntry[] = [
  entry("hero-yoga-studio", "hero", ["hero", "yoga", "studio", "fitness", "indoor", "calm"]),
  entry("hero-cafe", "hero", ["hero", "cafe", "coffee", "indoor", "warm"]),
  entry("hero-abstract-calm", "hero", ["hero", "abstract", "calm"]),
  entry("cafe-barista", "sample", ["sample", "cafe", "coffee", "people", "indoor"]),
  entry("sofa-grey", "sample", ["sample", "second-hand", "furniture", "sofa", "indoor"]),
  entry("bike-red", "sample", ["sample", "second-hand", "bicycle", "outdoor"]),
  entry("people-meeting", "sample", ["sample", "people", "office", "meeting", "indoor"]),
];

test("words: lowercase, no accents, singular-ish", () => {
  expect(words("Cafés and Sofas, yoga!")).toEqual(["cafe", "and", "sofa", "yoga"]);
});

test("a yoga studio gets the yoga hero; a café the café hero and barista", () => {
  const yoga = pickPictures(index, {
    description: "A yoga studio in Mariehamn with a class schedule",
  });
  expect(yoga.hero?.id).toBe("hero-yoga-studio");
  const cafe = pickPictures(index, { description: "Our café's menu and opening hours" });
  expect(cafe.hero?.id).toBe("hero-cafe");
  expect(cafe.samples[0]?.id).toBe("cafe-barista");
});

test("the models' names and fields count: a marketplace of items gets second-hand samples", () => {
  const ir = validateSpec({
    path: "smithable.yml",
    text: `smithable: 0.1
app: { name: Torget, description: A place to sell things. }
models:
  Item:
    fields: { title: string!, price: money, category: furniture | bicycle | other }
pages:
  items: { crud: Item }
`,
  }).ir;
  if (!ir) throw new Error("invalid");
  const picked = pickPictures(index, {
    description: "a site where people sell things",
    ir,
    count: 2,
  });
  expect(picked.samples.map((s) => s.id)).toEqual(["bike-red", "sofa-grey"]);
});

test("nothing fits: the calm abstract hero and the first samples, deterministically", () => {
  const a = pickPictures(index, { description: "Quarterly compliance filings", count: 2 });
  const b = pickPictures(index, { description: "Quarterly compliance filings", count: 2 });
  expect(a.hero?.id).toBe("hero-abstract-calm");
  expect(a.samples).toHaveLength(2);
  expect(a).toEqual(b);
});
