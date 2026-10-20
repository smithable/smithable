import { expect, test } from "vitest";

// The kit's uploads.ts, as the generated apps get it (a path the build does not follow).
const path: string = "../templates/src/kit/uploads.ts";
const kit = (await import(path)) as {
  webpSize(bytes: Uint8Array): { width: number; height: number } | undefined;
  pictureTag(picture: { file: string }): string;
  fileKind(bytes: Uint8Array, name: string): { ext: string; type: string } | undefined;
  fileHeaders(stored: { file: string; name: string; type: string }): Record<string, string>;
};

/** A ZIP archive of stored entries (no compression), with its central directory and end record. */
function zipOf(entries: [string, string][]): Uint8Array {
  const out: number[] = [];
  const u16 = (n: number) => [n & 255, (n >> 8) & 255];
  const u32 = (n: number) => [...u16(n & 0xffff), ...u16(n >>> 16)];
  const chars = (t: string) => [...t].map((c) => c.charCodeAt(0));
  const central: number[] = [];
  for (const [name, content] of entries) {
    const offset = out.length;
    const sizes = [...u32(0), ...u32(content.length), ...u32(content.length)];
    out.push(...chars("PK\x03\x04"), ...u16(20), ...u16(0), ...u16(0), ...u16(0), ...u16(0));
    out.push(...sizes, ...u16(name.length), ...u16(0), ...chars(name), ...chars(content));
    central.push(...chars("PK\x01\x02"), ...u16(20), ...u16(20), ...u16(0), ...u16(0));
    central.push(...u16(0), ...u16(0), ...sizes, ...u16(name.length), ...u16(0), ...u16(0));
    central.push(...u16(0), ...u16(0), ...u32(0), ...u32(offset), ...chars(name));
  }
  const start = out.length;
  out.push(...central, ...chars("PK\x05\x06"), ...u16(0), ...u16(0));
  out.push(...u16(entries.length), ...u16(entries.length), ...u32(central.length), ...u32(start));
  out.push(...u16(0));
  return new Uint8Array(out);
}

/** A WebP file's header: RIFF, then one chunk of the given kind with its bytes. */
function webp(kind: string, payload: number[]): Uint8Array {
  const chunk = [...kind].map((c) => c.charCodeAt(0));
  const size = (n: number) => [n & 255, (n >> 8) & 255, (n >> 16) & 255, (n >> 24) & 255];
  return new Uint8Array([
    ...[..."RIFF"].map((c) => c.charCodeAt(0)),
    ...size(4 + 8 + payload.length),
    ...[..."WEBP"].map((c) => c.charCodeAt(0)),
    ...chunk,
    ...size(payload.length),
    ...payload,
  ]);
}

test("a WebP's size comes from its header, lossy, lossless or extended", () => {
  // Lossless: 14 bits width-1, 14 bits height-1, after a signature byte.
  const bits = 639 | (479 << 14);
  const lossless = webp("VP8L", [
    0x2f,
    bits & 255,
    (bits >> 8) & 255,
    (bits >> 16) & 255,
    (bits >> 24) & 255,
    0,
    0,
    0,
    0,
    0,
  ]);
  expect(kit.webpSize(lossless)).toEqual({ width: 640, height: 480 });
  // Lossy: the key frame's width and height at bytes 26 and 28, 14 bits each.
  const lossy = webp("VP8 ", [
    0,
    0,
    0,
    0x9d,
    0x01,
    0x2a,
    800 & 255,
    800 >> 8,
    600 & 255,
    600 >> 8,
    0,
    0,
    0,
    0,
    0,
    0,
  ]);
  expect(kit.webpSize(lossy)).toEqual({ width: 800, height: 600 });
  // Extended: 24-bit width-1 and height-1 after four flag bytes and three reserved bytes.
  const extended = webp("VP8X", [0, 0, 0, 0, 0xff, 0x03, 0, 0xff, 0x01, 0, 0, 0, 0, 0, 0, 0]);
  expect(kit.webpSize(extended)).toEqual({ width: 1024, height: 512 });
  expect(kit.webpSize(new Uint8Array([0x89, 0x50, 0x4e, 0x47]))).toBeUndefined();
  expect(kit.webpSize(webp("ALPH", new Array(20).fill(0)))).toBeUndefined();
});

test("a picture's tag is the content hash in its file name", () => {
  expect(kit.pictureTag({ file: "post/0123456789abcdef01234567.webp" })).toBe(
    '"0123456789abcdef01234567"',
  );
});

const bytes = (text: string) => new Uint8Array([...text].map((c) => c.charCodeAt(0)));

test("a document's kind is read from its own first bytes, not only its name", () => {
  expect(kit.fileKind(bytes("%PDF-1.7\n…"), "Contract.PDF")?.type).toBe("application/pdf");
  // A name alone does not make a PDF, nor a picture renamed to one.
  expect(kit.fileKind(bytes("just text"), "contract.pdf")).toBeUndefined();
  expect(kit.fileKind(bytes("\x89PNG\r\n\x1a\n…"), "contract.pdf")).toBeUndefined();
  expect(kit.fileKind(bytes("MZ…"), "tool.exe")).toBeUndefined();
  // Text is text when it reads as UTF-8 without the NUL bytes of a binary file.
  expect(kit.fileKind(bytes("a,b\n1,2\n"), "rows.csv")?.ext).toBe("csv");
  expect(kit.fileKind(new Uint8Array([97, 0, 98]), "rows.csv")).toBeUndefined();
  // An Office file is a ZIP with a [Content_Types].xml entry; the name as content is not one.
  expect(kit.fileKind(zipOf([["[Content_Types].xml", "<Types/>"]]), "cv.docx")?.ext).toBe("docx");
  expect(kit.fileKind(zipOf([["a.txt", "[Content_Types].xml"]]), "cv.docx")).toBeUndefined();
  expect(kit.fileKind(bytes("PK\x03\x04…[Content_Types].xml…"), "cv.docx")).toBeUndefined();
  // An OpenDocument file's first entry is "mimetype", holding its type.
  const odt = "application/vnd.oasis.opendocument.text";
  expect(
    kit.fileKind(
      zipOf([
        ["mimetype", odt],
        ["content.xml", "<x/>"],
      ]),
      "a.odt",
    )?.ext,
  ).toBe("odt");
  expect(
    kit.fileKind(
      zipOf([
        ["content.xml", odt],
        ["mimetype", odt],
      ]),
      "a.odt",
    ),
  ).toBeUndefined();
  expect(kit.fileKind(bytes("\xff\xd8\xff…"), "receipt.jpeg")?.ext).toBe("jpg");
});

test("a PDF opens in the browser, a document downloads, and neither can run anything", () => {
  const pdf = kit.fileHeaders({
    file: "invoice/0123456789abcdef01234567.pdf",
    name: "Contract 2026.pdf",
    type: "application/pdf",
  });
  expect(pdf["Content-Disposition"]).toBe("inline; filename*=UTF-8''Contract%202026.pdf");
  expect(pdf["Content-Security-Policy"]).toBe("sandbox");
  expect(pdf["X-Content-Type-Options"]).toBe("nosniff");
  const docx = kit.fileHeaders({
    file: "person/0123456789abcdef01234567.docx",
    name: "cv.docx",
    type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  });
  expect(docx["Content-Disposition"]).toMatch(/^attachment;/);
  // The type a record keeps came from a browser: the file is sent with its extension's type.
  const claimed = kit.fileHeaders({
    file: "person/0123456789abcdef01234567.txt",
    name: "notes.txt",
    type: "text/html",
  });
  expect(claimed["Content-Type"]).toBe("text/plain; charset=utf-8");
  expect(claimed["Content-Disposition"]).toMatch(/^attachment;/);
});
