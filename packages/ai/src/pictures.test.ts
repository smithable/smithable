import { validateContent, validateSpec } from "@smithable/core";
import { expect, test } from "vitest";
import libraryText from "./library-samples.test.json?raw";
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
  // A model without pictures gets none; this one stores none.
  expect(picked.models).toEqual({});
  const pictured = validateSpec({
    path: "smithable.yml",
    text: `smithable: 0.1
app: { name: Torget, description: A place to sell things. }
models:
  Item:
    fields: { title: string!, photo: picture, category: furniture | bicycle | other }
pages:
  items: { crud: Item }
`,
  }).ir;
  const items = pickPictures(index, {
    description: "a site where people sell things",
    ir: pictured,
  });
  expect(items.models.Item?.map((s) => s.id)).toEqual(["bike-red", "sofa-grey"]);
});

test("nothing fits: the calm abstract hero and no samples, deterministically", () => {
  const ir = validateSpec({
    path: "smithable.yml",
    text: "smithable: 0.1\napp: { name: Filings }\nmodels:\n  Filing:\n    fields: { title: string!, scan: picture }\npages:\n  filings: { crud: Filing }\n",
  }).ir;
  const a = pickPictures(index, { description: "Quarterly compliance filings", ir });
  const b = pickPictures(index, { description: "Quarterly compliance filings", ir });
  expect(a.hero?.id).toBe("hero-abstract-calm");
  expect(a.models).toEqual({ Filing: [] });
  expect(a).toEqual(b);
});

/** The image library's sample pictures as its index lists them (ids and tags, 2026-10-25). */
const library: PictureEntry[] = (JSON.parse(libraryText) as { id: string; tags: string[] }[]).map(
  (e) => entry(e.id, "sample", e.tags),
);

const app = (spec: string, content?: string) => {
  const ir = validateSpec({ path: "smithable.yml", text: spec }).ir;
  if (!ir) throw new Error("invalid");
  const texts = content
    ? validateContent({ path: "smithable.content.yml", text: content }, ir).content
    : undefined;
  return { ir, ...(texts ? { content: texts } : {}) };
};

test("each model's samples follow its own subject: dishes for a bistro, nothing off topic for a padel club", () => {
  // The bistro: "book a table" and "cooking classes" in the description drew books and a yoga class.
  const bistro = app(
    `smithable: 0.1
app: { name: Le Petit Zinc, description: A bistro in Bayonne. }
models:
  Dish:
    fields: { name: string!, price: money, photo: picture, course: starter | main | dessert }
  Booking:
    fields: { name: string!, guests: int! }
pages:
  dishes: { crud: Dish }
`,
    "smithableContent: 0.1\nlanguage: fr\nmodels:\n  Dish:\n    label: Plat\n",
  );
  const dishes = pickPictures(library, {
    description:
      "A bistro where guests book a table, see the dishes of the day and join cooking classes",
    ...bistro,
  }).models.Dish?.map((e) => e.id);
  expect(dishes?.length).toBeGreaterThan(3);
  for (const id of dishes ?? []) expect(id).toMatch(/^food-/);
  // The padel club: a court type is no bicycle, dumbbell or yoga mat. Nothing fits: none.
  const padel = app(`smithable: 0.1
app: { name: Pasio Padel Club, description: Padel courts to book in Bayonne. }
models:
  CourtType:
    fields: { name: string!, price: money, photo: picture, players: doubles | singles | kids }
pages:
  courts: { crud: CourtType }
`);
  expect(
    pickPictures(library, {
      description:
        "A padel club with seven panoramic courts, sports bar, racket rental and classes",
      ...padel,
    }).models,
  ).toEqual({ CourtType: [] });
  // An app named after its subject lends it to a model whose own words name none.
  const cafe = app(`smithable: 0.1
app: { name: Harbour Cafe }
models:
  Special:
    fields: { name: string!, photo: picture }
pages:
  specials: { crud: Special }
`);
  const specials = pickPictures(library, { description: "Our weekly specials", ...cafe }).models
    .Special;
  expect(specials?.length).toBeGreaterThan(0);
  for (const e of specials ?? []) expect(e.tags).toContain("cafe");
});

test("a starter's tag and a model's name do not make a subject; what the person wrote does", () => {
  const heroes: PictureEntry[] = [
    entry("fitness-yoga-class", "hero", ["hero", "yoga", "fitness", "starter-booking"]),
    entry("hero-conference", "hero", ["hero", "conference", "talk", "speaker", "event"]),
    entry("hero-salon", "hero", ["hero", "salon", "hair", "hairdresser"]),
    entry("hero-library", "hero", ["hero", "library", "book", "reading"]),
    entry("hero-workshop", "hero", ["hero", "workshop", "tool", "diy"]),
    entry("hero-abstract-calm", "hero", ["hero", "abstract", "calm"]),
  ];
  const booking = validateSpec({
    path: "smithable.yml",
    text: "smithable: 0.1\napp: { name: App }\nmodels:\n  Session:\n    fields: { title: string! }\n  Booking:\n    fields: { session: Session! }\npages:\n  sessions: { crud: Session }\n",
  }).ir;
  // A Booking model is not a yoga studio.
  expect(
    pickPictures(heroes, { description: "Event registration for a conference", ir: booking }).hero
      ?.id,
  ).toBe("hero-conference");
  expect(
    pickPictures(heroes, { description: "Bokning för min frisörsalong, a hair salon", ir: booking })
      .hero?.id,
  ).toBe("hero-salon");
  // Nothing the description says fits: the calm one, not the starter's.
  expect(
    pickPictures(heroes, { description: "Appointments for my dental practice", ir: booking }).hero
      ?.id,
  ).toBe("hero-abstract-calm");
  // "A tool library … tools" is about tools.
  expect(
    pickPictures(heroes, {
      description: "A tool library where neighbors lend each other tools",
    }).hero?.id,
  ).toBe("hero-workshop");
  // A yoga studio still gets the yoga class.
  expect(
    pickPictures(heroes, { description: "A booking site for a yoga studio", ir: booking }).hero?.id,
  ).toBe("fitness-yoga-class");
});

test("among heroes that fit as well, the description and the app's name choose: variety, the same app always the same", () => {
  const heroes: PictureEntry[] = [
    entry("fitness-yoga-class", "hero", ["hero", "yoga", "studio", "class", "fitness"]),
    entry("hero-yoga-studio", "hero", ["hero", "studio", "yoga", "fitness", "calm"]),
    entry("hero-music", "hero", ["hero", "music", "studio"]),
    entry("hero-library", "hero", ["hero", "library", "book"]),
    entry("hero-workshop", "hero", ["hero", "workshop", "tool"]),
    entry("hero-abstract-calm-b", "hero", ["hero", "abstract", "calm"]),
  ];
  const named = (name: string) =>
    validateSpec({ path: "smithable.yml", text: `smithable: 0.1\napp: { name: ${name} }\n` }).ir;
  const pick = (description: string, name: string) =>
    pickPictures(heroes, { description, ir: named(name) }).hero?.id;
  const yoga = "A booking site for a yoga studio";
  const picked = new Set(
    ["Stillwater", "Sol Yoga", "Lotus", "Breathe", "Flow", "Om", "Asana", "Prana"].map((n) =>
      pick(yoga, n),
    ),
  );
  // Both yoga pictures come up, and never the music studio, which only shares "studio".
  expect([...picked].sort()).toEqual(["fitness-yoga-class", "hero-yoga-studio"]);
  expect(pick(yoga, "Stillwater")).toBe(pick(yoga, "Stillwater"));
  // "A tool library … tools" says tools twice: the books are not as good a choice, whatever the name.
  for (const name of ["Alpha", "Beta", "Gamma", "Delta", "Epsilon"])
    expect(pick("A tool library where neighbors lend each other tools", name)).toBe(
      "hero-workshop",
    );
  // A tag ending in "s" is met by the same word: "status", "tools".
  const plural = [
    entry("hero-office", "hero", ["hero", "office", "status", "incidents"]),
    entry("hero-shed", "hero", ["hero", "tools"]),
    entry("hero-abstract-calm-b", "hero", ["hero", "abstract", "calm"]),
  ];
  expect(pickPictures(plural, { description: "A status page for our API" }).hero?.id).toBe(
    "hero-office",
  );
  expect(pickPictures(plural, { description: "Lend a tool to a neighbor" }).hero?.id).toBe(
    "hero-shed",
  );
  // Nothing fits: the calm abstract one, under the name its remake has.
  expect(pick("Quarterly compliance filings", "Alpha")).toBe("hero-abstract-calm-b");
});

const marks: PictureEntry[] = [
  entry("logo-cup", "logo", ["logo", "mark", "cafe", "coffee"]),
  entry("logo-bean", "logo", ["logo", "mark", "cafe", "coffee"]),
  entry("logo-lotus", "logo", ["logo", "mark", "starter-booking", "yoga"]),
  entry("logo-leaf", "logo", ["logo", "mark", "abstract", "garden", "nature"]),
  entry("logo-wave", "logo", ["logo", "mark", "abstract", "sea"]),
  entry("logo-star", "logo", ["logo", "mark", "abstract", "bold"]),
];

test("a mark that fits wins, and no fitting mark still gives an abstract one", () => {
  expect(pickPictures(marks, { description: "A yoga studio's classes" }).logo?.id).toBe(
    "logo-lotus",
  );
  expect(pickPictures(marks, { description: "Our garden club's plots" }).logo?.id).toBe(
    "logo-leaf",
  );
  const none = pickPictures(marks, { description: "Quarterly compliance filings" }).logo;
  expect(none?.tags).toContain("abstract");
  expect(pickPictures(index, { description: "A café" }).logo).toBeUndefined();
  // A starter's monogram is its own name's letter: never another app's mark.
  const monogram = entry("logo-mono-northwind-c", "logo", ["logo", "monogram", "monogram-status"]);
  expect(pickPictures([monogram, ...marks], { description: "A status page" }).logo?.id).not.toBe(
    monogram.id,
  );
});

test("the same input the same mark; two cafés can get two marks, independent of the hero's choice", () => {
  const cafe = (description: string) => pickPictures(marks, { description }).logo?.id as string;
  expect(cafe("A café by the harbour")).toBe(cafe("A café by the harbour"));
  const descriptions = Array.from({ length: 12 }, (_, i) => `Café number ${i} and its menu`);
  const chosen = new Set(descriptions.map(cafe));
  expect(chosen).toEqual(new Set(["logo-cup", "logo-bean"]));
  // Salted: the mark's pick among two is not the hero's pick among two.
  const both = [...index, entry("hero-cafe-b", "hero", ["hero", "cafe", "coffee"]), ...marks];
  const pairs = descriptions.map((description) => {
    const p = pickPictures(both, { description });
    return `${p.hero?.id === "hero-cafe"}/${p.logo?.id === "logo-cup"}`;
  });
  expect(new Set(pairs).size).toBe(4);
});
