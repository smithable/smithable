import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import webpDecoder from "@jsquash/webp/codec/dec/webp_dec.js";
import { expect, test } from "vitest";
import { renderInkWashWebp } from "./ink-wash-webp.js";

// Lossless 10 × 8 fixture: ink, violet wash, paper and a transparent band.
const source = Buffer.from(
  "UklGRlAAAABXRUJQVlA4TEQAAAAvCcABEB8gECByREsSY0dAQrwx2U85ICQgTpnsnAmagKDg/+jiA2SfgoI2kpS7Z351a3JNPoqI6H8CHvBrzbWmfGQhCw==",
  "base64",
);
const colours = { foreground: "#232323", background: "#f8f6ef", primary: "#006d66" };

test("the renderer produces a stable, decodable WebP with the IPTC model-made statement", async () => {
  const result = await renderInkWashWebp(source, colours, 300);
  if (!("bytes" in result)) throw new Error(`Ink wash fell back: ${result.reason}`);
  const { bytes } = result;
  expect(createHash("sha256").update(bytes).digest("hex")).toBe(
    "c7fad1c78a167d7b14d62a16a6ffd79b43fcbc4755146d246690f6229307b699",
  );
  expect(
    bytes.includes(
      'Iptc4xmpExt:DigitalSourceType="http://cv.iptc.org/newscodes/digitalsourcetype/trainedAlgorithmicMedia"',
    ),
  ).toBe(true);
  const wasmBinary = await readFile(
    new URL(import.meta.resolve("@jsquash/webp/codec/dec/webp_dec.wasm")),
  );
  const options = { wasmBinary, noInitialRun: true };
  const image = (await webpDecoder(options)).decode(Uint8Array.from(bytes));
  expect(image?.width).toBe(10);
  expect(image?.height).toBe(8);
  expect(image?.data[3]).toBe(255);
  expect(image?.data[image.data.length - 1]).toBe(0);
});

test("the renderer reports a codec fallback for an invalid image", async () => {
  expect(await renderInkWashWebp(source.subarray(0, 30), colours, 300)).toEqual({
    reason: "codec",
  });
});
