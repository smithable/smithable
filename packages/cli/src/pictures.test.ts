import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { validateSpec } from "@smithable/core";
import { afterEach, expect, test } from "vitest";
import { addLibraryPictures, type Fetch, libraryIndex, writePictures } from "./pictures.js";

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
    tags: ["sample", "cafe"],
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
  const d = mkdtempSync(join(tmpdir(), "smithable-pictures-"));
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
    fields: { name: string!, price: money }
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
  expect(written.map((w) => w.file)).toEqual(["samples/1.webp", "hero.webp"]);
  expect(files["smithable.content.yml"]).toContain("src: images/hero.webp");
  expect(files["smithable.content.yml"]).toContain("alt: A café");
  expect(out.join("")).toContain("Pictures from the Smithable image library");
  const dir = temp();
  writePictures(dir, written);
  expect(readFileSync(join(dir, "public", "images", "hero.webp"))).toHaveLength(4);
  expect(readFileSync(join(dir, "public", "images", "samples", "1.webp"))).toHaveLength(4);
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
