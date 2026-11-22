/**
 * A film's bytes against the rules of docs/design/section-film.md §2, read from the MP4's boxes
 * alone: nothing is decoded. Each problem names the rule it breaks. Studio's upload and
 * `smithable validate` both ask this, so a film placed by hand meets the same rules.
 */

export const FILM_MAX_BYTES = 5_000_000;
export const FILM_MAX_BITS_PER_SECOND = 5_000_000;
export const FILM_SECONDS = [3, 12] as const;
export const FILM_LONG_SIDE = 1920;
export const FILM_SHORT_SIDE = 1080;

export interface FilmReading {
  problems: string[];
  seconds?: number;
  width?: number;
  height?: number;
}

interface Box {
  type: string;
  start: number; // where its content starts
  end: number;
}

const text = (b: Uint8Array, at: number) => String.fromCharCode(...b.subarray(at, at + 4));

function boxes(b: Uint8Array, start: number, end: number): Box[] {
  const view = new DataView(b.buffer, b.byteOffset, b.byteLength);
  const found: Box[] = [];
  for (let at = start; at + 8 <= end; ) {
    let size = view.getUint32(at);
    let head = 8;
    if (size === 1) {
      if (at + 16 > end) break;
      size = Number(view.getBigUint64(at + 8));
      head = 16;
    } else if (size === 0) size = end - at;
    if (size < head || at + size > end) break;
    found.push({ type: text(b, at + 4), start: at + head, end: at + size });
    at += size;
  }
  return found;
}

const child = (b: Uint8Array, box: Box | undefined, type: string) =>
  box && boxes(b, box.start, box.end).find((c) => c.type === type);

// Brands an MP4 player takes; QuickTime's own ("qt  ") is not one.
const MP4_BRANDS = /^(isom|iso[2-9]|mp41|mp42|avc1|M4V |dash|msnv)$/;

export function readFilm(bytes: Uint8Array): FilmReading {
  const problems: string[] = [];
  const top = boxes(bytes, 0, bytes.length);
  const ftyp = top[0]?.type === "ftyp" ? top[0] : undefined;
  const brands = ftyp
    ? [0, ...Array.from({ length: (ftyp.end - ftyp.start - 8) / 4 }, (_, i) => 8 + i * 4)]
        .filter((o) => ftyp.start + o + 4 <= ftyp.end)
        .map((o) => text(bytes, ftyp.start + o))
    : [];
  const moov = top.findIndex((x) => x.type === "moov");
  const mdat = top.findIndex((x) => x.type === "mdat");
  if (!brands.some((brand) => MP4_BRANDS.test(brand)) || moov < 0)
    return {
      problems: ["Format: it is not an MP4 file; save the film as MP4 with H.264 picture."],
    };
  if (mdat < 0) problems.push("Format: it has no film data (mdat) after its index.");
  else if (mdat < moov)
    problems.push(
      "Format: its index (moov) comes after the film's data, so nothing shows until the whole file is fetched; save it again with the index first (often called fast start).",
    );

  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const index = top[moov];
  // Each field is read only when its box holds it: a short box is unreadable, never borrowed from.
  const holds = (box: Box | undefined, from: number, length: number): box is Box =>
    box !== undefined && box.start + from + length <= box.end;
  const mvhd = child(bytes, index, "mvhd");
  let seconds: number | undefined;
  const v1 = mvhd !== undefined && bytes[mvhd.start] === 1;
  if (holds(mvhd, 0, v1 ? 32 : 20)) {
    const scale = view.getUint32(mvhd.start + (v1 ? 20 : 12));
    const length = v1
      ? Number(view.getBigUint64(mvhd.start + 24))
      : view.getUint32(mvhd.start + 16);
    if (scale > 0 && length > 0) seconds = length / scale;
  }

  let width: number | undefined;
  let height: number | undefined;
  const codecs: string[] = [];
  const sizes: [number, number][] = [];
  let unmeasured = false;
  let sound = false;
  for (const trak of boxes(bytes, index?.start ?? 0, index?.end ?? 0)) {
    if (trak.type !== "trak") continue;
    const mdia = child(bytes, trak, "mdia");
    const hdlr = child(bytes, mdia, "hdlr");
    const handler = holds(hdlr, 8, 4) ? text(bytes, hdlr.start + 8) : "";
    if (handler === "soun") sound = true;
    if (handler !== "vide") continue;
    // Every picture track, and every sample description in it, is H.264.
    const stsd = child(bytes, child(bytes, child(bytes, mdia, "minf"), "stbl"), "stsd");
    const entries = holds(stsd, 8, 0) ? boxes(bytes, stsd.start + 8, stsd.end) : [];
    codecs.push(...(entries.length ? entries.map((e) => e.type) : ["an unreadable kind"]));
    const tkhd = child(bytes, trak, "tkhd");
    // The matrix, then the width and height after it (16.16 each).
    const at = tkhd ? (bytes[tkhd.start] === 1 ? 52 : 40) : 0;
    if (!holds(tkhd, at, 44)) {
      unmeasured = true;
      continue;
    }
    const w = view.getUint32(tkhd.start + at + 36) / 65536;
    const h = view.getUint32(tkhd.start + at + 40) / 65536;
    // A turned film (a = 0 in its matrix) is shown with its sides swapped.
    const shown: [number, number] = view.getInt32(tkhd.start + at) === 0 ? [h, w] : [w, h];
    sizes.push(shown);
    [width, height] = sizes[0] as [number, number];
  }

  if (!codecs.length) problems.push("Format: it has no picture track.");
  for (const codec of new Set(codecs.filter((c) => c !== "avc1" && c !== "avc3")))
    problems.push(
      `Format: its picture is ${codec.trim()}, not H.264; save it again with H.264 (AVC) picture.`,
    );
  if (sound)
    problems.push(
      "Sound: it has a sound track; a film plays without sound, so save it without one.",
    );
  if (seconds === undefined) problems.push("Length: its length could not be read.");
  else if (seconds < FILM_SECONDS[0] || seconds > FILM_SECONDS[1])
    problems.push(
      `Length: it runs ${seconds.toFixed(1)} seconds; a film runs ${FILM_SECONDS[0]} to ${FILM_SECONDS[1]} seconds.`,
    );
  if (unmeasured) problems.push("Picture size: its shown size could not be read.");
  const over = sizes.find(
    ([w, h]) => Math.max(w, h) > FILM_LONG_SIDE || Math.min(w, h) > FILM_SHORT_SIDE,
  );
  if (over)
    problems.push(
      `Picture size: it is shown ${Math.round(over[0])}×${Math.round(over[1])}; at most ${FILM_LONG_SIDE} on the long side and ${FILM_SHORT_SIDE} on the short.`,
    );
  problems.push(...sizeProblems(bytes.length, seconds));
  return { problems, seconds, width, height };
}

/** The file-size rules alone, for a file too large to be worth reading. */
export function sizeProblems(size: number, seconds?: number): string[] {
  if (size > FILM_MAX_BYTES)
    return [
      `File size: it is ${size.toLocaleString("en")} bytes; a film is at most ${FILM_MAX_BYTES.toLocaleString("en")}.`,
    ];
  if (seconds && (size * 8) / seconds > FILM_MAX_BITS_PER_SECOND)
    return [
      `File size: it spends ${((size * 8) / seconds / 1e6).toFixed(1)} Mbit/s; a film spends at most ${FILM_MAX_BITS_PER_SECOND / 1e6} Mbit/s on average.`,
    ];
  return [];
}
