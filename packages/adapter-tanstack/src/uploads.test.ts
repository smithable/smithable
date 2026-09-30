import { expect, test } from "vitest";

// The kit's uploads.ts, as the generated apps get it (a path the build does not follow).
const path: string = "../templates/src/kit/uploads.ts";
const kit = (await import(path)) as {
  webpSize(bytes: Uint8Array): { width: number; height: number } | undefined;
  pictureTag(picture: { file: string }): string;
};

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
