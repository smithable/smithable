import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { ContentIR } from "@smithable/core";
import { expect, test } from "vitest";
import { readFilm } from "./film-check.js";
import { pictureRefusal } from "./studio.js";
import { filmFindings } from "./validate.js";

// MP4 files built box by box (ISO/IEC 14496-12): only the boxes the check reads, with the
// fields before the ones it reads in place.
const u32 = (n: number) => {
  const b = new Uint8Array(4);
  new DataView(b.buffer).setInt32(0, n);
  return b;
};
const ascii = (s: string) => Uint8Array.from(s, (c) => c.charCodeAt(0));
const join8 = (...parts: Uint8Array[]) => {
  const all = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let at = 0;
  for (const p of parts) {
    all.set(p, at);
    at += p.length;
  }
  return all;
};
const box = (type: string, ...content: Uint8Array[]) => {
  const body = join8(...content);
  return join8(u32(body.length + 8), ascii(type), body);
};
const zeros = (n: number) => new Uint8Array(n);

interface Shape {
  brand?: string;
  indexLast?: boolean;
  seconds?: number;
  codec?: string;
  sound?: boolean;
  width?: number;
  height?: number;
  turned?: boolean;
  data?: number;
  version1?: boolean;
}

function mp4({
  brand = "isom",
  indexLast = false,
  seconds = 5,
  codec = "avc1",
  sound = false,
  width = 1280,
  height = 720,
  turned = false,
  data = 1000,
  version1 = false,
}: Shape = {}) {
  const scale = 1000;
  const mvhd = version1
    ? box("mvhd", u32(1 << 24), zeros(16), u32(scale), zeros(4), u32(seconds * scale), zeros(80))
    : box("mvhd", u32(0), zeros(8), u32(scale), u32(seconds * scale), zeros(80));
  const one = 0x10000;
  const matrix = turned
    ? [0, one, 0, -one, 0, 0, 0, 0, 0x40000000]
    : [one, 0, 0, 0, one, 0, 0, 0, 0x40000000];
  const tkhd = box(
    "tkhd",
    u32(0),
    zeros(36),
    ...matrix.map(u32),
    u32(width * one),
    u32(height * one),
  );
  const hdlr = (kind: string) => box("hdlr", u32(0), zeros(4), ascii(kind), zeros(13));
  const stsd = box("stsd", u32(0), u32(1), box(codec, zeros(78)));
  const video = box("trak", tkhd, box("mdia", hdlr("vide"), box("minf", box("stbl", stsd))));
  const audio = box("trak", box("mdia", hdlr("soun")));
  const moov = box("moov", mvhd, video, ...(sound ? [audio] : []));
  const ftyp = box("ftyp", ascii(brand), u32(0), ascii(brand));
  const mdat = box("mdat", zeros(data));
  return indexLast ? join8(ftyp, mdat, moov) : join8(ftyp, moov, mdat);
}

test("a film within the rules passes, with its length and shown size read", () => {
  expect(readFilm(mp4())).toEqual({ problems: [], seconds: 5, width: 1280, height: 720 });
  expect(readFilm(mp4({ version1: true, seconds: 12 })).problems).toEqual([]);
  // Portrait is allowed: 1080 wide and 1920 high is within the long and the short side.
  expect(readFilm(mp4({ width: 1080, height: 1920 })).problems).toEqual([]);
});

test("each rule broken is named (section-film.md §2)", () => {
  const first = (shape: Shape) => readFilm(mp4(shape)).problems;
  expect(first({ indexLast: true })).toEqual([
    expect.stringMatching(/^Format: its index \(moov\)/),
  ]);
  expect(first({ codec: "hvc1" })).toEqual([
    "Format: its picture is hvc1, not H.264; save it again with H.264 (AVC) picture.",
  ]);
  expect(first({ sound: true })).toEqual([expect.stringMatching(/^Sound: it has a sound track/)]);
  expect(first({ seconds: 2 })[0]).toBe(
    "Length: it runs 2.0 seconds; a film runs 3 to 12 seconds.",
  );
  expect(first({ seconds: 13 })[0]).toMatch(/^Length: it runs 13.0 seconds/);
  expect(first({ width: 2560, height: 1440 })).toEqual([
    "Picture size: it is shown 2560×1440; at most 1920 on the long side and 1080 on the short.",
  ]);
  expect(first({ width: 1920, height: 1200 })[0]).toMatch(/^Picture size/);
  expect(first({ data: 5_000_000 })).toEqual([
    expect.stringMatching(/^File size: it is 5,000,\d{3} bytes; a film is at most 5,000,000\.$/),
  ]);
  // 2 MB in three seconds is 5.3 Mbit/s.
  expect(first({ seconds: 3, data: 2_000_000 })).toEqual([
    "File size: it spends 5.3 Mbit/s; a film spends at most 5 Mbit/s on average.",
  ]);
  // Several at once, each named.
  expect(first({ sound: true, seconds: 20 })).toHaveLength(2);
});

test("a turned film is measured as it is shown", () => {
  const turned = readFilm(mp4({ width: 1920, height: 1080, turned: true }));
  expect([turned.width, turned.height]).toEqual([1080, 1920]);
  expect(turned.problems).toEqual([]);
});

test("a file that is not an MP4 is refused as one, whatever else it is", () => {
  const notMp4 = ["Format: it is not an MP4 file; save the film as MP4 with H.264 picture."];
  expect(readFilm(mp4({ brand: "qt  " })).problems).toEqual(notMp4);
  expect(readFilm(ascii("not a film at all")).problems).toEqual(notMp4);
  expect(readFilm(new Uint8Array()).problems).toEqual(notMp4);
  // A box claiming more bytes than the file has stops the reading, never reads past the end.
  const cut = mp4().subarray(0, 60);
  expect(readFilm(cut).problems).toEqual(notMp4);
});

test("smithable validate refuses a hero's film that is missing or breaks a rule", () => {
  const dir = mkdtempSync(join(tmpdir(), "film-check-"));
  mkdirSync(join(dir, "public", "images"), { recursive: true });
  writeFileSync(join(dir, "public", "images", "good.mp4"), mp4());
  writeFileSync(join(dir, "public", "images", "loud.mp4"), mp4({ sound: true }));
  const withFilm = (src: string) =>
    ({
      pages: { home: { sections: { hero: { image: { src: "images/a.webp", film: { src } } } } } },
    }) as unknown as ContentIR;
  expect(filmFindings(dir, withFilm("images/good.mp4"))).toEqual([]);
  expect(filmFindings(dir, undefined)).toEqual([]);
  const [loud] = filmFindings(dir, withFilm("images/loud.mp4"));
  expect(loud?.severity).toBe("error");
  expect(loud?.message).toMatch(/^The film images\/loud\.mp4 of home hero: Sound: /);
  expect(loud?.hint).toContain("smithable op setSectionFilm home hero");
  expect(filmFindings(dir, withFilm("images/gone.mp4"))[0]?.message).toBe(
    "The film images/gone.mp4 of home hero: its file is not in public/images/gone.mp4.",
  );
});

test("Studio takes a film with its change only as a new MP4 within the rules, named as its src", () => {
  const send = (path: string, bytes: Uint8Array, there = false, src = path.slice(7)) =>
    pictureRefusal("setSectionFilm", path, bytes, { src }, () => there);
  expect(send("public/images/home-hero-1.mp4", mp4())).toBeUndefined();
  // Each broken rule is named, as smithable validate names it.
  expect(send("public/images/home-hero-1.mp4", mp4({ sound: true, seconds: 20 }))).toBe(
    "Sound: it has a sound track; a film plays without sound, so save it without one. Length: it runs 20.0 seconds; a film runs 3 to 12 seconds.",
  );
  expect(send("public/images/home-hero-1.mp4", ascii("<html>"))).toMatch(
    /^Format: it is not an MP4/,
  );
  // Never over a file that is there, never under another name, folder or extension.
  expect(send("public/images/hero.mp4", mp4(), true)).toMatch(/already there/);
  expect(send("public/images/a.mp4", mp4(), false, "images/b.mp4")).toBe(
    "A film must be an MP4 file.",
  );
  expect(send("public/images/a/b.mp4", mp4())).toBe("A film must be an MP4 file.");
  expect(send("public/images/hero.mov", mp4())).toBe("A film must be an MP4 file.");
  expect(send("public/hero.mp4", mp4())).toBe("A film must be an MP4 file.");
});
