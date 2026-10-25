import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { validateContent, validateSamples, validateSpec } from "@smithable/core";
import { afterEach, expect, test } from "vitest";
// new.js pulls in most of the CLI: imported here, its load time is not a test's (5 s) on a busy machine.
import { named, sampleFiles } from "./new.js";
import {
  addLibraryPictures,
  atLibrary,
  dropMissingPictures,
  type Fetch,
  libraryBase,
  libraryIndex,
  placePictures,
  writePictures,
} from "./pictures.js";
import { tempDir } from "./test-dir.js";

const index = [
  {
    id: "hero-cafe",
    kind: "hero",
    url: "https://x/hero/hero-cafe.webp",
    alt: "A café",
    tags: ["hero", "cafe"],
  },
  {
    id: "cafe-barista",
    kind: "sample",
    url: "https://x/sample/cafe-barista.webp",
    alt: "A barista",
    tags: ["sample", "cafe", "dish"],
  },
  {
    id: "far",
    kind: "sample",
    url: "https://x/sample/far.webp",
    alt: "Far",
    tags: ["sample", "nature"],
  },
];
const calls: string[] = [];
const fakeFetch: Fetch = (async (url: string | URL | Request) => {
  const u = String(url);
  calls.push(u);
  if (u.endsWith("index.json")) return new Response(JSON.stringify(index), { status: 200 });
  if (u.endsWith("far.webp")) return new Response("", { status: 404 });
  return new Response(new Uint8Array([82, 73, 70, 70]), {
    status: 200,
    headers: { "content-length": "4" },
  });
}) as Fetch;
const dirs: string[] = [];
const temp = () => {
  const d = tempDir("smithable-pictures-");
  dirs.push(d);
  return d;
};
afterEach(() => {
  for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
  calls.length = 0;
});

test("the index is fetched once a day and cached", async () => {
  const cache = temp();
  expect(await libraryIndex(fakeFetch, cache)).toHaveLength(3);
  expect(await libraryIndex(fakeFetch, cache)).toHaveLength(3);
  expect(calls.filter((c) => c.endsWith("index.json"))).toHaveLength(1);
  expect(JSON.parse(readFileSync(join(cache, "index.json"), "utf8"))).toHaveLength(3);
});

test("a drafted café gets the café hero into the content file and the barista as a sample", async () => {
  const ir = validateSpec({
    path: "smithable.yml",
    text: `smithable: 0.1
app: { name: Kaffe, description: A café. }
models:
  Dish:
    fields: { name: string!, price: money, photo: picture }
pages:
  home: { route: /, landing: { hero: { button: menu } } }
  menu: { crud: Dish }
`,
  }).ir;
  if (!ir) throw new Error("invalid");
  const files: Record<string, string> = { "smithable.content.yml": "smithableContent: 0.1\n" };
  const out: string[] = [];
  const written = await addLibraryPictures({
    description: "a café with its menu",
    ir,
    files,
    io: { out: (s: string) => out.push(s), err: (s: string) => out.push(s) } as never,
    fetchFn: fakeFetch,
    index,
  });
  // The Dish's rows are generated: its picture is a numbered one, which generated rows take.
  expect(written.map((w) => w.file)).toEqual(["samples/0.webp", "hero.webp"]);
  expect(files["smithable.content.yml"]).toContain("src: images/hero.webp");
  expect(files["smithable.content.yml"]).toContain("alt: A café");
  // The content file stays valid: the hero's texts are under the page by its name, and the same
  // when the page already has texts of its own (as a draft's content file does).
  const content = (text: string) =>
    validateContent({ path: "smithable.content.yml", text }, ir).diagnostics.filter(
      (d) => d.severity === "error",
    );
  expect(content(files["smithable.content.yml"] ?? "")).toEqual([]);
  expect(files["smithable.content.yml"]).toContain("  home:\n    hero:\n      image:");
  const drafted: Record<string, string> = {
    "smithable.content.yml": "smithableContent: 0.1\npages:\n  home:\n    title: Kaffe\n",
  };
  await addLibraryPictures({
    description: "a café with its menu",
    ir,
    files: drafted,
    io: { out: () => {}, err: () => {} } as never,
    fetchFn: fakeFetch,
    index,
  });
  expect(content(drafted["smithable.content.yml"] ?? "")).toEqual([]);
  expect(out.join("")).toContain("Pictures from the Smithable image library");
  const dir = temp();
  writePictures(dir, written);
  expect(readFileSync(join(dir, "public", "images", "hero.webp"))).toHaveLength(4);
  expect(readFileSync(join(dir, "public", "images", "samples", "0.webp"))).toHaveLength(4);
});

test("a model with drafted records gets its own pictures, named in its sample file", async () => {
  const ir = validateSpec({
    path: "smithable.yml",
    text: "smithable: 0.1\napp: { name: Kaffe }\nmodels:\n  Dish:\n    fields: { name: string!, price: money, photo: picture }\n  Table:\n    fields: { name: string!, photo: picture }\npages:\n  menu: { crud: Dish }\n  tables: { crud: Table }\n",
  }).ir;
  if (!ir) throw new Error("invalid");
  const written = await addLibraryPictures({
    description: "a café with its menu",
    ir,
    drafted: new Set(["Dish"]),
    files: {},
    io: { out: () => {}, err: () => {} } as never,
    fetchFn: fakeFetch,
    index,
  });
  // The Dish's own picture; nothing fits a Table, so no numbered one for its generated rows.
  expect(written.filter((w) => w.file.startsWith("samples/"))).toMatchObject([
    { file: "samples/dish-1.webp", alt: "A barista", model: "Dish" },
  ]);
  const files = sampleFiles(
    {
      Dish: [
        { name: "Cinnamon bun", price: 4.5 },
        { name: "Fish soup", price: 14 },
      ],
    },
    ir,
    written,
  );
  expect(files.map((f) => f.path)).toEqual(["samples/Dish.yml"]);
  expect(files[0]?.text).toContain("file: dish-1.webp");
  expect(files[0]?.text).toContain("generated: true");
  expect(validateSamples(files, ir).diagnostics).toEqual([]);
  expect(validateSamples(files, ir).samples.Dish?.[1]?.photo).toMatchObject({
    picture: "dish-1.webp",
  });
});

test("an app whose records have no pictures gets no sample pictures, only its hero", async () => {
  const ir = validateSpec({
    path: "smithable.yml",
    text: "smithable: 0.1\napp: { name: Kaffe }\nmodels:\n  Dish: { fields: { name: string! } }\npages:\n  home: { route: /, landing: { hero: { button: menu } } }\n  menu: { crud: Dish }\n",
  }).ir;
  if (!ir) throw new Error("invalid");
  const written = await addLibraryPictures({
    description: "a café with its menu",
    ir,
    files: { "smithable.content.yml": "smithableContent: 0.1\n" },
    io: { out: () => {}, err: () => {} } as never,
    fetchFn: fakeFetch,
    index,
  });
  expect(written.map((w) => w.file)).toEqual(["hero.webp"]);
});

test("an app with no picture fields and no hero wants no pictures, and the line says so", async () => {
  const ir = validateSpec({
    path: "smithable.yml",
    text: "smithable: 0.1\napp: { name: Bageri }\nmodels:\n  Loaf: { fields: { name: string! } }\npages:\n  loaves: { crud: Loaf }\n",
  }).ir;
  if (!ir) throw new Error("invalid");
  const out: string[] = [];
  const written = await addLibraryPictures({
    description: "a bakery's loaves",
    ir,
    files: {},
    io: { out: (s: string) => out.push(s), err: (s: string) => out.push(s) } as never,
    fetchFn: fakeFetch,
    index,
  });
  expect(written).toEqual([]);
  expect(out.join("")).toContain("no picture fields and no landing page with a hero");
  expect(out.join("")).not.toContain("could be fetched");
});

test("an unreachable library means no pictures and one line, never an error", async () => {
  const ir = validateSpec({
    path: "smithable.yml",
    text: "smithable: 0.1\napp: { name: X }\nmodels: {}\n",
  }).ir;
  if (!ir) throw new Error("invalid");
  const out: string[] = [];
  const failing: Fetch = (async () => {
    throw new Error("offline");
  }) as Fetch;
  const cache = temp();
  writeFileSync(join(cache, "unused"), "");
  const written = await addLibraryPictures({
    description: "anything",
    ir,
    files: {},
    io: { out: (s: string) => out.push(s), err: (s: string) => out.push(s) } as never,
    fetchFn: failing,
    index: undefined,
    cacheDir: cache,
  });
  expect(written).toEqual([]);
  expect(out.join("")).toContain("could not be reached");
});

test("the library is where SMITHABLE_IMAGE_LIBRARY says, and the index's addresses follow", async () => {
  const before = process.env.SMITHABLE_IMAGE_LIBRARY;
  try {
    delete process.env.SMITHABLE_IMAGE_LIBRARY;
    expect(libraryBase()).toBe("https://docs.smithable.ai/images");
    process.env.SMITHABLE_IMAGE_LIBRARY = "http://172.30.0.2:8081/images/";
    expect(atLibrary("https://docs.smithable.ai/images/sample/desk.webp")).toBe(
      "http://172.30.0.2:8081/images/sample/desk.webp",
    );
    let asked = "";
    await libraryIndex(
      (async (url: string) => {
        asked = url;
        return new Response("[]");
      }) as never,
      tempDir("library-"),
    );
    expect(asked).toBe("http://172.30.0.2:8081/images/index.json");
  } finally {
    if (before === undefined) delete process.env.SMITHABLE_IMAGE_LIBRARY;
    else process.env.SMITHABLE_IMAGE_LIBRARY = before;
  }
});

test("a picture the texts name but the project does not have is left out", async () => {
  const dir = tempDir("drop-");
  mkdirSync(join(dir, "public", "images"), { recursive: true });
  writeFileSync(join(dir, "public", "images", "kept.webp"), "x");
  writeFileSync(
    join(dir, "smithable.content.yml"),
    "smithableContent: 0.1\npages:\n  home:\n    hero:\n      title: Hello\n      image: { src: images/hero.webp, alt: A view }\n    about:\n      image: { src: images/kept.webp, alt: Kept }\n",
  );
  const out: string[] = [];
  dropMissingPictures(dir, { out: (s) => out.push(s), err: () => {} });
  const text = readFileSync(join(dir, "smithable.content.yml"), "utf8");
  expect(text).not.toContain("hero.webp");
  expect(text).toContain("title: Hello");
  expect(text).toContain("images/kept.webp");
  expect(out.join("")).toContain("Left out a picture");
  // A hero whose only key was its picture goes with it: an empty "hero:" is not valid.
  writeFileSync(
    join(dir, "smithable.content.yml"),
    "smithableContent: 0.1\npages:\n  home:\n    hero:\n      image: { src: images/hero.webp, alt: A view }\n",
  );
  dropMissingPictures(dir, { out: () => {}, err: () => {} });
  expect(readFileSync(join(dir, "smithable.content.yml"), "utf8")).toBe("smithableContent: 0.1\n");
});

test("every drafted app gets a mark: the content file's logo and public/images/logo.webp", async () => {
  const marks = [
    ...index,
    {
      id: "logo-star",
      kind: "logo",
      url: "https://x/logo/star.webp",
      alt: "A star",
      tags: ["logo", "abstract"],
    },
  ];
  const ir = validateSpec({
    path: "smithable.yml",
    text: "smithable: 0.1\napp: { name: Bageri }\nmodels:\n  Loaf: { fields: { name: string! } }\npages:\n  loaves: { crud: Loaf }\n",
  }).ir;
  if (!ir) throw new Error("invalid");
  const files: Record<string, string> = {};
  const out: string[] = [];
  const written = await addLibraryPictures({
    description: "a bakery's loaves",
    ir,
    files,
    io: { out: (s: string) => out.push(s), err: () => {} } as never,
    fetchFn: fakeFetch,
    index: marks,
  });
  expect(written.map((w) => w.file)).toEqual(["logo.webp"]);
  expect(out.join("")).toContain("Pictures from the Smithable image library: logo.webp");
  const text = files["smithable.content.yml"] ?? "";
  expect(text).toContain("logo:\n  src: images/logo.webp\n  alt: A star");
  expect(validateContent({ path: "smithable.content.yml", text }, ir).diagnostics).toEqual([]);
  // A logo the texts already name is kept.
  const own: Record<string, string> = {
    "smithable.content.yml": "smithableContent: 0.1\nlogo: { src: images/mine.svg, alt: Mine }\n",
  };
  const again = await addLibraryPictures({
    description: "a bakery's loaves",
    ir,
    files: own,
    io: { out: () => {}, err: () => {} } as never,
    fetchFn: fakeFetch,
    index: marks,
  });
  expect(again).toEqual([]);
  expect(own["smithable.content.yml"]).toContain("images/mine.svg");
  // And a logo whose file the project does not have is left out, like a hero's picture.
  const dir = temp();
  writeFileSync(join(dir, "smithable.content.yml"), text);
  dropMissingPictures(dir, { out: () => {}, err: () => {} });
  expect(readFileSync(join(dir, "smithable.content.yml"), "utf8")).toBe("smithableContent: 0.1\n");
});

test("a name someone typed names the app, over the starter's or the draft's own", async () => {
  const files = {
    "smithable.yml": "smithable: 0.1\napp:\n  name: Payments API Status\n  description: Ours.\n",
  };
  expect(named(files, "Pulse API Status")["smithable.yml"]).toContain("  name: Pulse API Status\n");
  expect(named({ "smithable.yml": "smithable: 0.1\n" }, "X")["smithable.yml"]).toBe(
    "smithable: 0.1\n",
  );
});

test("a starter's sample allowedDomains go, and a shared app open to sign-up becomes invite-only", async () => {
  const { withoutSampleDomains } = await import("./new.js");
  const out: string[] = [];
  const files = withoutSampleDomains(
    {
      "smithable.yml":
        "smithable: 0.1\napp: { name: Desk }\nmodels:\n  Ticket:\n    fields: { title: string! }\npages:\n  tickets: { crud: Ticket }\n",
      "smithable.auth.yml":
        "smithableAuth: 0.1\nsignIn:\n  providers: [email]\n  allowedDomains: [desk.example]\ndefaultAccess: shared\nadmins: [you@gmail.com]\n",
    },
    { out: (s) => out.push(s), err: () => {} },
  );
  expect(files["smithable.auth.yml"]).not.toContain("allowedDomains");
  expect(files["smithable.auth.yml"]).toContain("selfSignUp: false");
  expect(files["smithable.yml"]).toContain("users: manage");
  expect(out.join("")).toContain("only invited people and the administrator may sign in");
});

test("the hero picked for the app replaces the starter's, which has the same file name", () => {
  const dir = tempDir("smithable-place-");
  placePictures(
    dir,
    {
      "public/images/hero.webp": Buffer.from("starter").toString("base64"),
      "public/images/logo.webp": Buffer.from("logo").toString("base64"),
    },
    [{ file: "hero.webp", bytes: new TextEncoder().encode("picked") }],
  );
  expect(readFileSync(join(dir, "public", "images", "hero.webp"), "utf8")).toBe("picked");
  expect(readFileSync(join(dir, "public", "images", "logo.webp"), "utf8")).toBe("logo");
});

test("a photograph from the library is not badged, and the app credits it", async () => {
  const ir = validateSpec({
    path: "smithable.yml",
    text: "smithable: 0.1\napp: { name: Kaffe }\nmodels:\n  Dish: { fields: { name: string!, photo: picture } }\npages:\n  home: { route: /, landing: { hero: { button: menu } } }\n  menu: { crud: Dish }\n",
  }).ir;
  if (!ir) throw new Error("invalid");
  const credit = {
    page: "https://commons.wikimedia.org/wiki/File:Cafe.jpg",
    author: "A. Photographer",
    licence: "CC0",
    licenceUrl: "https://creativecommons.org/publicdomain/zero/1.0/",
    fetched: "2026-10-25",
  };
  const photos = [
    { ...index[0], generated: false, credit },
    { ...index[1], generated: true },
  ] as typeof index;
  const files: Record<string, string> = { "smithable.content.yml": "smithableContent: 0.1\n" };
  const written = await addLibraryPictures({
    description: "a café with its menu",
    ir,
    files,
    io: { out: () => {}, err: () => {} } as never,
    fetchFn: fakeFetch,
    index: photos,
  });
  // Said either way in the content file: a photograph's false is written, not left out.
  expect(files["smithable.content.yml"]).toContain("generated: false");
  const dir = temp();
  writePictures(dir, written);
  const images = join(dir, "public", "images");
  expect(JSON.parse(readFileSync(join(images, "pictures.json"), "utf8"))).toEqual({
    "samples/1.webp": { generated: true },
    "hero.webp": { generated: false },
  });
  expect(readFileSync(join(images, "CREDITS.md"), "utf8")).toContain(
    "- hero.webp: A. Photographer, [CC0](https://creativecommons.org/publicdomain/zero/1.0/), from https://commons.wikimedia.org/wiki/File:Cafe.jpg (fetched 2026-10-25)",
  );
});
