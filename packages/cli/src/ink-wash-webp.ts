import { readFile } from "node:fs/promises";
import webpDecoder from "@jsquash/webp/codec/dec/webp_dec.js";
import webpEncoder from "@jsquash/webp/codec/enc/webp_enc.js";
import { defaultOptions } from "@jsquash/webp/meta.js";
import { type InkWashColours, tintInkWash } from "./ink-wash-raster.js";

const maxPixels = 4_000_000;
const maxBytes = 2_000_000;
const alphaFlag = 0x10;
const xmpFlag = 0x04;
const xmp = Buffer.from(
  '<x:xmpmeta xmlns:x="adobe:ns:meta/"><rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#"><rdf:Description rdf:about="" xmlns:Iptc4xmpExt="http://iptc.org/std/Iptc4xmpExt/2008-02-29/" Iptc4xmpExt:DigitalSourceType="http://cv.iptc.org/newscodes/digitalsourcetype/trainedAlgorithmicMedia"/></rdf:RDF></x:xmpmeta>',
);

async function wasmOptions(path: string) {
  const wasmBinary = await readFile(new URL(import.meta.resolve(`@jsquash/webp/codec/${path}`)));
  return { wasmBinary, noInitialRun: true };
}

// Always use the baseline WASM encoder. Hardware SIMD must not change output bytes.
let decoder: ReturnType<typeof webpDecoder> | undefined;
let encoder: ReturnType<typeof webpEncoder> | undefined;
const decode = () => (decoder ??= wasmOptions("dec/webp_dec.wasm").then(webpDecoder));
const encode = () => (encoder ??= wasmOptions("enc/webp_enc.wasm").then(webpEncoder));

function chunks(file: Buffer) {
  if (
    file.length < 20 ||
    file.toString("ascii", 0, 4) !== "RIFF" ||
    file.toString("ascii", 8, 12) !== "WEBP" ||
    file.readUInt32LE(4) !== file.length - 8
  )
    throw new Error("Expected a WebP RIFF file");
  const result: { type: string; data: Buffer }[] = [];
  for (let offset = 12; offset < file.length; ) {
    if (offset + 8 > file.length) throw new Error("Truncated WebP chunk header");
    const size = file.readUInt32LE(offset + 4);
    const end = offset + 8 + size;
    if (end + (size & 1) > file.length) throw new Error("Truncated WebP chunk");
    result.push({
      type: file.toString("ascii", offset, offset + 4),
      data: file.subarray(offset + 8, end),
    });
    offset = end + (size & 1);
  }
  return result;
}

function dimensions(file: Buffer) {
  const parts = chunks(file);
  const header = parts[0];
  if (!header) throw new Error("Missing WebP image");
  if (parts.some(({ type }) => type === "ANIM" || type === "ANMF"))
    throw new Error("Ink wash needs a still image");
  const image = parts.find(({ type }) => type === "VP8 " || type === "VP8L");
  const data = image?.data;
  let width: number;
  let height: number;
  if (image?.type === "VP8 " && data && data.length >= 10) {
    width = data.readUInt16LE(6) & 0x3fff;
    height = data.readUInt16LE(8) & 0x3fff;
  } else if (image?.type === "VP8L" && data && data.length >= 5 && data[0] === 0x2f) {
    const packed = data.readUInt32LE(1);
    width = (packed & 0x3fff) + 1;
    height = ((packed >>> 14) & 0x3fff) + 1;
  } else throw new Error("Unsupported WebP header");
  if (
    header.type === "VP8X" &&
    (header.data.length !== 10 ||
      width !== header.data.readUIntLE(4, 3) + 1 ||
      height !== header.data.readUIntLE(7, 3) + 1)
  )
    throw new Error("WebP canvas differs from its image");
  if (width === 0 || height === 0 || width * height > maxPixels)
    throw new Error("WebP dimensions exceed the Ink wash limit");
  return { width, height };
}

function chunk(type: string, data: Buffer) {
  const result = Buffer.alloc(8 + data.length + (data.length & 1));
  result.write(type, "ascii");
  result.writeUInt32LE(data.length, 4);
  data.copy(result, 8);
  return result;
}

function markedWebp(encoded: Buffer, width: number, height: number) {
  const parts = chunks(encoded).filter(({ type }) => type !== "VP8X" && type !== "XMP ");
  const flags = Buffer.alloc(10);
  flags[0] = xmpFlag | (parts.some(({ type }) => type === "ALPH") ? alphaFlag : 0);
  flags.writeUIntLE(width - 1, 4, 3);
  flags.writeUIntLE(height - 1, 7, 3);
  const body = Buffer.concat([
    Buffer.from("WEBP"),
    chunk("VP8X", flags),
    ...parts.map(({ type, data }) => chunk(type, data)),
    chunk("XMP ", xmp),
  ]);
  const riff = Buffer.alloc(8);
  riff.write("RIFF");
  riff.writeUInt32LE(body.length, 4);
  const result = Buffer.concat([riff, body]);
  if (!chunks(result).some(({ type, data }) => type === "XMP " && data.equals(xmp)))
    throw new Error("The Ink wash WebP lost its AI statement");
  return result;
}

/** Re-encode a library drawing with a deterministic light tint and a fresh AI statement. */
export async function renderInkWashWebp(
  original: Buffer,
  colours: InkWashColours,
  washHue: number,
): Promise<{ bytes: Buffer } | { reason: "theme" | "picture" | "codec" }> {
  try {
    if (original.byteLength > maxBytes) return { reason: "codec" };
    const { width, height } = dimensions(original);
    const image = (await decode()).decode(Uint8Array.from(original));
    if (!image || image.width !== width || image.height !== height) return { reason: "codec" };
    const tinted = tintInkWash(image.data, colours, washHue);
    if ("reason" in tinted) return tinted;
    const encoded = (await encode()).encode(Uint8Array.from(tinted.pixels), width, height, {
      ...defaultOptions,
      quality: 82,
    });
    if (!encoded) return { reason: "codec" };
    return { bytes: markedWebp(Buffer.from(encoded), width, height) };
  } catch {
    return { reason: "codec" };
  }
}
