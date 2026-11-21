import { afterAll, expect, test } from "vitest";

// The kit's smaller copies of a record's picture (T1054), as the generated apps get them, storing
// into a folder of the test's own (the kit reads DATA_DIR when it loads). Engine packages import
// no Node modules, so the files are looked at through the kit itself.
process.env.DATA_DIR = `${process.env.TMPDIR ?? "/tmp"}/picture-widths-${crypto.randomUUID()}`;

type Stored = { file: string; alt: string; width: number; height: number; smaller?: unknown[] };
const uploadsPath: string = "../templates/src/kit/uploads.ts";
const kit = (await import(uploadsPath)) as {
  savePicture(model: string, bytes: Uint8Array, alt: string): Stored;
  saveSmaller(
    model: string,
    bytes: Uint8Array,
    main: { width: number; height: number; bytes: number },
  ): { file: string; width: number; height: number };
  deletePicture(picture: Stored, stillUsed: boolean, used?: (file: string) => boolean): void;
  dropCopies(before: Stored | null, after: Stored | null, used: (file: string) => boolean): void;
  uploadResponse(
    request: Request,
    kind: "picture" | "file",
    stored: unknown,
    everyone: boolean,
  ): Response;
};
const addressPath: string = "../templates/src/kit/file-address.ts";
const address = (await import(addressPath)) as {
  pictureSet(address: string, stored: unknown): string | undefined;
};

/** A WebP file with an extended header of the given size, `extra` bytes of body after it. */
function webp(width: number, height: number, extra = 0, fill = 0): Uint8Array {
  const payload = [
    0,
    0,
    0,
    0,
    (width - 1) & 255,
    ((width - 1) >> 8) & 255,
    ((width - 1) >> 16) & 255,
    (height - 1) & 255,
    ((height - 1) >> 8) & 255,
    ((height - 1) >> 16) & 255,
    ...new Array(extra).fill(fill),
  ];
  const size = (n: number) => [n & 255, (n >> 8) & 255, (n >> 16) & 255, (n >> 24) & 255];
  const chars = (t: string) => [...t].map((c) => c.charCodeAt(0));
  return new Uint8Array([
    ...chars("RIFF"),
    ...size(4 + 8 + payload.length),
    ...chars("WEBP"),
    ...chars("VP8X"),
    ...size(payload.length),
    ...payload,
  ]);
}

const mainBytes = webp(1200, 800, 400);
const main = kit.savePicture("post", mainBytes, "");
const shape = { width: 1200, height: 800, bytes: mainBytes.length };
const at = (query: string) => new Request(`https://shop.example/files/post/1/picture${query}`);
const served = async (stored: unknown, query: string) =>
  new Uint8Array(await kit.uploadResponse(at(query), "picture", stored, true).arrayBuffer());
afterAll(() => kit.deletePicture({ ...main, alt: "" }, false));

test("a smaller copy is taken only at a width the app keeps, narrower, of the picture's shape and smaller (T1054)", () => {
  // Not one of the widths, as wide as the picture, the wrong shape, no smaller, not a WebP.
  expect(() => kit.saveSmaller("post", webp(500, 333, 10), shape)).toThrow();
  expect(() =>
    kit.saveSmaller("post", webp(960, 640, 10), { width: 960, height: 640, bytes: 9999 }),
  ).toThrow();
  expect(() => kit.saveSmaller("post", webp(480, 400, 10), shape)).toThrow();
  expect(() => kit.saveSmaller("post", webp(480, 320, 500), shape)).toThrow();
  expect(() => kit.saveSmaller("post", new Uint8Array(40), shape)).toThrow();
  // Its shape to a pixel: 1200×800 at 480 is 320 high, 321 is still the same picture.
  const copy = kit.saveSmaller("post", webp(480, 321, 10), shape);
  expect(copy).toEqual({
    file: expect.stringMatching(/^post\/[a-f0-9]{24}\.webp$/),
    width: 480,
    height: 321,
  });
  // Named by its own content, never by the picture's.
  expect(copy.file).not.toBe(main.file);
});

test("?w= serves a copy the picture lists, the picture where it has none, and nothing else (T1054)", async () => {
  const copyBytes = webp(480, 320, 20, 7);
  const copy = kit.saveSmaller("post", copyBytes, shape);
  const tag = copy.file.slice(-29, -5);
  const stored = { ...main, alt: "", smaller: [copy] };

  const small = kit.uploadResponse(at(`?w=480&v=${tag}`), "picture", stored, true);
  expect(small.status).toBe(200);
  expect(new Uint8Array(await small.arrayBuffer())).toEqual(copyBytes);
  expect(small.headers.get("etag")).toBe(`"${tag}"`);
  // Kept for a day by the copy's own tag, as the picture is by its.
  expect(small.headers.get("cache-control")).toBe("public, max-age=86400, immutable");

  // A width the picture has no copy at, or a copy gone: the picture itself.
  const none = kit.uploadResponse(at("?w=960"), "picture", stored, true);
  expect(new Uint8Array(await none.arrayBuffer())).toEqual(mainBytes);
  const outside = {
    ...stored,
    smaller: [{ file: "../../../etc/passwd", width: 480, height: 320 }],
  };
  const kept = kit.uploadResponse(at("?w=480"), "picture", outside, true);
  expect(new Uint8Array(await kept.arrayBuffer())).toEqual(mainBytes);

  // Any other width, or a document: refused, never a path made from the address.
  for (const query of ["?w=481", "?w=", "?w=../x", "?w=480.0"])
    expect(kit.uploadResponse(at(query), "picture", stored, true).status, query).toBe(400);
  expect(kit.uploadResponse(at("?w=480"), "file", stored, true).status).toBe(400);
  // A record that cannot be read gives nothing whatever the width.
  expect(kit.uploadResponse(at("?w=480"), "picture", null, true).status).toBe(404);
});

test("a removed picture's copies go unless a record still has them (T1054)", async () => {
  const copyBytes = webp(480, 320, 30, 9);
  const picture = { ...main, alt: "", smaller: [kit.saveSmaller("post", copyBytes, shape)] };
  // Another record shows the same copy: it stays.
  kit.deletePicture(picture, true, () => true);
  expect(await served(picture, "?w=480")).toEqual(copyBytes);
  // No record does: it goes, and the picture, still shown, stays and is served in its place.
  kit.deletePicture(picture, true, () => false);
  expect(await served(picture, "?w=480")).toEqual(mainBytes);
});

test("an edit that keeps a picture but drops a smaller copy removes that copy's file (T1064)", async () => {
  const keptBytes = webp(960, 640, 60, 7);
  const droppedBytes = webp(480, 320, 30, 11);
  const kept = kit.saveSmaller("post", keptBytes, shape);
  const dropped = kit.saveSmaller("post", droppedBytes, shape);
  const before = { ...main, alt: "", smaller: [kept, dropped] };
  const after = { ...main, alt: "", smaller: [kept] };
  // Another record still lists the dropped copy: it stays.
  kit.dropCopies(before, after, () => true);
  expect(await served(before, "?w=480")).toEqual(droppedBytes);
  // A replaced picture is deletePicture's case: nothing here.
  kit.dropCopies(before, { ...after, file: "post/000000000000000000000000.webp" }, () => false);
  expect(await served(before, "?w=480")).toEqual(droppedBytes);
  // No record does: the dropped copy goes, the kept copy and the picture stay.
  kit.dropCopies(before, after, () => false);
  expect(await served(before, "?w=480")).toEqual(mainBytes);
  expect(await served(after, "?w=960")).toEqual(keptBytes);
  kit.deletePicture(after, true, () => false);
});

test("an img's srcset lists each copy with its own tag and the picture at its width (T1054)", () => {
  const base = "/files/post/1/picture";
  expect(
    address.pictureSet(base, { file: "post/0123456789abcdef01234567.webp", width: 1200 }),
  ).toBe(undefined);
  expect(
    address.pictureSet(base, {
      file: "post/0123456789abcdef01234567.webp",
      width: 1200,
      smaller: [
        { file: "post/aaaaaaaaaaaaaaaaaaaaaaaa.webp", width: 480 },
        { file: "post/bbbbbbbbbbbbbbbbbbbbbbbb.webp", width: 960 },
      ],
    }),
  ).toBe(
    `${base}?w=480&v=aaaaaaaaaaaaaaaaaaaaaaaa 480w, ${base}?w=960&v=bbbbbbbbbbbbbbbbbbbbbbbb 960w, ${base}?v=0123456789abcdef01234567 1200w`,
  );
});
