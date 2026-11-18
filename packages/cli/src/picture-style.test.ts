import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, test } from "vitest";
import {
  type LibraryVersion,
  offeredStyles,
  placeStyle,
  readRecords,
  rebuildRecords,
  sha256,
  type VersionEntry,
} from "./picture-style.js";
import type { Fetch } from "./pictures.js";

const bytes = (text: string) => new TextEncoder().encode(text);
const files: Record<string, Uint8Array> = {};
const entry = (
  id: string,
  kind: string,
  style: string | undefined,
  subject: string | undefined,
  extra: Partial<VersionEntry> = {},
): VersionEntry => {
  const content = bytes(`picture ${id}`);
  const hash = sha256(content);
  files[hash] = content;
  return {
    id,
    kind,
    url: `https://docs.smithable.ai/images/files/${hash}.webp`,
    alt: `The ${id}`,
    tags: [],
    sha256: hash,
    ...(style ? { style, generated: style !== "photographs" } : {}),
    ...(subject ? { subject } : {}),
    ...extra,
  };
};

const version: LibraryVersion = {
  version: "2026-11-18.1",
  styles: [
    { id: "lifelike", generated: true, words: { en: { name: "Lifelike", line: "" } } },
    { id: "pastel", generated: true, words: { en: { name: "Pastel", line: "" } } },
    { id: "ink-wash", generated: true, words: { en: { name: "Ink wash", line: "" } } },
  ],
  entries: [
    entry("cafe-hero", "hero", "lifelike", "cafe"),
    entry("cafe-hero-pastel", "hero", "pastel", "cafe"),
    entry("cafe-hero-ink", "hero", "ink-wash", "cafe"),
    entry("bicycle", "sample", "lifelike", "bicycle"),
    entry("bicycle-pastel", "sample", "pastel", "bicycle"),
    entry("lamp", "sample", "lifelike", "lamp"),
    entry("lamp-pastel", "sample", "pastel", "lamp"),
    // Ink wash has no lamp: it cannot dress an app with one.
    entry("mark", "logo", undefined, undefined),
  ],
};

const byId = (id: string) => version.entries.find((e) => e.id === id) as VersionEntry;
const fileOf = (id: string) => files[byId(id).sha256] as Uint8Array;

const library = (calls: string[] = []): Fetch =>
  (async (url: string | URL | Request) => {
    const address = String(url);
    calls.push(address);
    if (address.endsWith("/library.json")) return Response.json({ latest: version.version });
    if (address.endsWith(`/versions/${version.version}.json`)) return Response.json(version);
    const hash = address.match(/files\/([a-f0-9]{64})\.webp$/)?.[1];
    const content = hash && files[hash];
    return content ? new Response(content) : new Response("", { status: 404 });
  }) as Fetch;

const offline: Fetch = (async () => {
  throw new TypeError("fetch failed");
}) as Fetch;

/** An app as one made before the record: its library pictures, by name, and no hashes said. */
function oldApp(): string {
  const dir = mkdtempSync(join(tmpdir(), "picture-style-"));
  const images = join(dir, "public", "images");
  mkdirSync(join(images, "samples"), { recursive: true });
  writeFileSync(join(images, "hero.webp"), fileOf("cafe-hero"));
  writeFileSync(join(images, "logo.webp"), fileOf("mark"));
  writeFileSync(join(images, "samples", "0.webp"), fileOf("bicycle"));
  writeFileSync(join(images, "samples", "1.webp"), fileOf("lamp"));
  writeFileSync(
    join(images, "pictures.json"),
    JSON.stringify({
      "samples/0.webp": { generated: true },
      "samples/1.webp": { generated: true },
    }),
  );
  writeFileSync(
    join(dir, "smithable.content.yml"),
    "smithableContent: 0.1\npages:\n  home:\n    hero:\n      title: Café\n      image: { src: images/hero.webp, alt: The cafe-hero, generated: true }\n",
  );
  return dir;
}

test("an older app's record is rebuilt by the files' hashes, not their names", () => {
  const dir = oldApp();
  // The owner's own picture under a library name: no hash matches, so no record.
  writeFileSync(join(dir, "public", "images", "samples", "1.webp"), bytes("my own lamp"));
  const records = rebuildRecords(dir, version);
  expect(records["hero.webp"]).toMatchObject({
    entry: "cafe-hero",
    role: "hero",
    style: "lifelike",
  });
  expect(records["logo.webp"]).toMatchObject({ entry: "mark", role: "logo" });
  expect(records["samples/0.webp"]).toMatchObject({ entry: "bicycle", role: "sample" });
  expect(records["samples/1.webp"]).toEqual({ generated: true });
});

test("a style is offered only when it has a picture for every library picture the app holds", () => {
  const dir = oldApp();
  expect(offeredStyles(dir, version).map((s) => s.id)).toEqual(["lifelike", "pastel"]);
});

test("a style's pictures are fetched, checked and written with their record; the mark stays", async () => {
  const dir = oldApp();
  const placed = await placeStyle(dir, "pastel", library());
  if (typeof placed === "string") throw new Error(placed);
  expect(placed.files.map((f) => f.path).sort()).toEqual([
    "public/images/hero.webp",
    "public/images/samples/0.webp",
    "public/images/samples/1.webp",
  ]);
  expect(placed.files.find((f) => f.path.endsWith("hero.webp"))?.bytes).toEqual(
    fileOf("cafe-hero-pastel"),
  );
  const record = JSON.parse(
    placed.texts.find((t) => t.path.endsWith("pictures.json"))?.text ?? "{}",
  );
  expect(record["hero.webp"]).toEqual({
    generated: true,
    version: "2026-11-18.1",
    entry: "cafe-hero-pastel",
    style: "pastel",
    sha256: byId("cafe-hero-pastel").sha256,
    role: "hero",
  });
  expect(record["logo.webp"]).toMatchObject({ entry: "mark" });
  // The hero's words follow its picture.
  expect(placed.texts.find((t) => t.path === "smithable.content.yml")?.text).toContain(
    "alt: The cafe-hero-pastel",
  );
});

test("a picture the owner changed stays, and is named", async () => {
  const dir = oldApp();
  const first = await placeStyle(dir, "pastel", library());
  if (typeof first === "string") throw new Error(first);
  for (const f of [...first.files]) writeFileSync(join(dir, f.path), f.bytes);
  for (const t of first.texts) writeFileSync(join(dir, t.path), t.text);
  writeFileSync(join(dir, "public", "images", "samples", "0.webp"), bytes("my bicycle"));
  const back = await placeStyle(dir, "lifelike", library());
  if (typeof back === "string") throw new Error(back);
  expect(back.kept).toEqual(["samples/0.webp"]);
  expect(back.files.map((f) => f.path).sort()).toEqual([
    "public/images/hero.webp",
    "public/images/samples/1.webp",
  ]);
});

test("an incomplete style, an unknown one, no network or a wrong hash refuses", async () => {
  const dir = oldApp();
  expect(await placeStyle(dir, "ink-wash", library())).toMatch(
    /no picture for samples\/0.webp, samples\/1.webp/,
  );
  expect(await placeStyle(dir, "neon", library())).toMatch(/no style "neon"/);
  expect(await placeStyle(dir, "pastel", offline)).toMatch(/could not be reached/);
  const tampered: Fetch = (async (url: string | URL | Request) =>
    String(url).includes("/files/")
      ? new Response(bytes("not the picture"))
      : library()(url)) as Fetch;
  expect(await placeStyle(dir, "pastel", tampered)).toMatch(/does not match the library's hash/);
  // Nothing was written by any of them.
  expect(readFileSync(join(dir, "public", "images", "hero.webp"))).toEqual(
    Buffer.from(fileOf("cafe-hero")),
  );
  expect(readRecords(dir)["hero.webp"]).toBeUndefined();
});

test("a library without versions refuses and says so", async () => {
  const none: Fetch = (async () => new Response("", { status: 404 })) as Fetch;
  expect(await placeStyle(oldApp(), "pastel", none)).toMatch(/could not be reached/);
});

test("validate says when smithable.ux.yml names a style the placed pictures are not in", async () => {
  const { validate } = await import("./validate.js");
  const { captureIo } = await import("./test-io.js");
  const dir = oldApp();
  writeFileSync(
    join(dir, "smithable.yml"),
    "smithable: 0.1\napp: { name: Cafe }\nmodels:\n  Dish: { fields: { name: string! } }\npages:\n  home: { route: /, landing: { hero: { button: dishes } } }\n  dishes: { crud: Dish }\n",
  );
  writeFileSync(join(dir, "smithable.auth.yml"), "smithableAuth: 0.1\nsignIn: none\n");
  writeFileSync(join(dir, "smithable.ux.yml"), "smithableUx: 0.1\npictures: { style: pastel }\n");
  writeFileSync(
    join(dir, "public", "images", "pictures.json"),
    JSON.stringify(rebuildRecords(dir, version)),
  );
  const io = captureIo();
  const code = validate(dir, io);
  if (code) throw new Error(io.stderr + io.stdout);
  expect(io.stderr).toContain(
    "smithable.ux.yml says the pictures are pastel, but 3 library pictures",
  );
  expect(io.stderr).toContain("smithable op setPictureStyle pastel");
  // Once they are, nothing is said.
  writeFileSync(join(dir, "smithable.ux.yml"), "smithableUx: 0.1\npictures: { style: lifelike }\n");
  const quiet = captureIo();
  expect(validate(dir, quiet)).toBe(0);
  expect(quiet.stderr).not.toContain("says the pictures are");
});

test("a picture the owner adds after the record is never adopted, even with library bytes", async () => {
  const dir = oldApp();
  const first = await placeStyle(dir, "pastel", library());
  if (typeof first === "string") throw new Error(first);
  for (const f of first.files) writeFileSync(join(dir, f.path), f.bytes);
  for (const t of first.texts) writeFileSync(join(dir, t.path), t.text);
  writeFileSync(join(dir, "public", "images", "samples", "9.webp"), fileOf("bicycle"));
  const back = await placeStyle(dir, "lifelike", library());
  if (typeof back === "string") throw new Error(back);
  expect(back.kept).toEqual(["samples/9.webp"]);
});

test("a picture that is a link is never written through, and generation reads only images/", async () => {
  const { symlinkSync } = await import("node:fs");
  const { taggedContent } = await import("./picture-style.js");
  const dir = oldApp();
  const outside = join(dir, "outside.webp");
  writeFileSync(outside, fileOf("bicycle"));
  const sample = join(dir, "public", "images", "samples", "0.webp");
  const { rmSync } = await import("node:fs");
  rmSync(sample);
  symlinkSync(outside, sample);
  const placed = await placeStyle(dir, "pastel", library());
  if (typeof placed === "string") throw new Error(placed);
  expect(placed.files.map((f) => f.path)).not.toContain("public/images/samples/0.webp");
  const tagged = taggedContent(dir, {
    a: { src: "images/hero.webp" },
    b: { src: "images/../../etc/passwd" },
    c: { src: "images/samples/0.webp" },
  });
  expect(tagged.a.src).toMatch(/^images\/hero\.webp\?v=[a-f0-9]{16}$/);
  expect(tagged.b.src).toBe("images/../../etc/passwd");
  expect(tagged.c.src).toBe("images/samples/0.webp");
});

test("seeded records follow the new samples; an uploaded picture and one replaced by hand stay", async () => {
  const { DatabaseSync } = await import("node:sqlite");
  const { reseedPictures } = await import("./picture-style.js");
  const dir = oldApp();
  mkdirSync(join(dir, "data", "db"), { recursive: true });
  const uploads = join(dir, "data", "uploads", "dish");
  mkdirSync(uploads, { recursive: true });
  const short = (b: Uint8Array) => sha256(b).slice(0, 24);
  const seeded = `dish/${short(fileOf("bicycle"))}.webp`;
  writeFileSync(join(dir, "data", "uploads", seeded), fileOf("bicycle"));
  const own = bytes("my upload");
  const uploaded = `dish/${short(own)}.webp`;
  writeFileSync(join(dir, "data", "uploads", uploaded), own);
  // Named as the seeded lamp, but its bytes were changed by hand.
  const handmade = `dish/${short(fileOf("lamp"))}.webp`;
  writeFileSync(join(dir, "data", "uploads", handmade), bytes("changed"));
  const db = new DatabaseSync(join(dir, "data", "db", "app.db"));
  db.exec("CREATE TABLE dish (id INTEGER PRIMARY KEY, picture TEXT)");
  const put = db.prepare("INSERT INTO dish (picture) VALUES (?)");
  for (const file of [seeded, uploaded, handmade])
    put.run(JSON.stringify({ file, alt: "x", width: 1, height: 1, generated: true }));
  db.close();
  const placed = await placeStyle(dir, "pastel", library());
  if (typeof placed === "string") throw new Error(placed);
  expect(reseedPictures(dir, placed.swaps)).toBe(1);
  const read = new DatabaseSync(join(dir, "data", "db", "app.db"), { readOnly: true });
  const rows = read.prepare("SELECT picture FROM dish ORDER BY id").all();
  read.close();
  const [a, b, c] = rows.map((r) => JSON.parse(String(r.picture)).file);
  expect(a).toBe(`dish/${short(fileOf("bicycle-pastel"))}.webp`);
  expect(readFileSync(join(dir, "data", "uploads", a))).toEqual(
    Buffer.from(fileOf("bicycle-pastel")),
  );
  // The old copy stays, for undo, which puts the database back.
  expect(readFileSync(join(dir, "data", "uploads", seeded))).toEqual(
    Buffer.from(fileOf("bicycle")),
  );
  expect(b).toBe(uploaded);
  expect(c).toBe(handmade);
});

test("a record from before hashes keeps its mark when its picture matches no entry", async () => {
  const dir = oldApp();
  writeFileSync(join(dir, "public", "images", "samples", "drawn.webp"), bytes("an image model's"));
  writeFileSync(
    join(dir, "public", "images", "pictures.json"),
    JSON.stringify({
      "samples/drawn.webp": { generated: true },
      "samples/0.webp": { generated: true },
    }),
  );
  const placed = await placeStyle(dir, "pastel", library());
  if (typeof placed === "string") throw new Error(placed);
  const record = JSON.parse(
    placed.texts.find((t) => t.path.endsWith("pictures.json"))?.text ?? "{}",
  );
  expect(record["samples/drawn.webp"]).toEqual({ generated: true });
});

test("a linked images folder or record file refuses; an app without library pictures gets no record", async () => {
  const { symlinkSync, rmSync, renameSync } = await import("node:fs");
  const linkedFile = oldApp();
  const outside = join(linkedFile, "outside.json");
  writeFileSync(outside, "{}");
  rmSync(join(linkedFile, "public", "images", "pictures.json"));
  symlinkSync(outside, join(linkedFile, "public", "images", "pictures.json"));
  expect(await placeStyle(linkedFile, "pastel", library())).toMatch(
    /public\/images\/pictures.json is a link or not a plain file/,
  );
  expect(readFileSync(outside, "utf8")).toBe("{}");
  const linkedFolder = oldApp();
  renameSync(join(linkedFolder, "public", "images"), join(linkedFolder, "elsewhere"));
  symlinkSync(join(linkedFolder, "elsewhere"), join(linkedFolder, "public", "images"));
  expect(await placeStyle(linkedFolder, "pastel", library())).toMatch(
    /public\/images is a link or not a plain folder/,
  );
  // No library pictures, no record: neither file is written, an own CREDITS.md stays.
  const bare = mkdtempSync(join(tmpdir(), "picture-style-"));
  mkdirSync(join(bare, "public", "images"), { recursive: true });
  writeFileSync(join(bare, "public", "images", "CREDITS.md"), "mine\n");
  const placed = await placeStyle(bare, "pastel", library());
  if (typeof placed === "string") throw new Error(placed);
  expect(placed.texts).toEqual([]);
});
