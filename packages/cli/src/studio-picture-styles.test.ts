import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, test } from "vitest";
import { type LibraryVersion, libraryVersion, sha256, type VersionEntry } from "./picture-style.js";
import { libraryBase } from "./pictures.js";
import { pictureHashes, pictureStyleCards, pinnedPictureVersion } from "./studio-picture-styles.js";

function fixture() {
  const dir = mkdtempSync(join(tmpdir(), "style-cards-"));
  const images = join(dir, "public/images");
  mkdirSync(join(images, "samples"), { recursive: true });
  const entries: VersionEntry[] = [];
  const records: Record<string, unknown> = {};
  for (const [i, subject] of ["cafe", "bicycle", "lamp"].entries()) {
    const kind = i === 0 ? "hero" : "sample";
    for (const style of ["lifelike", "pastel", "ink-wash"]) {
      if (style === "ink-wash" && subject === "lamp") continue;
      const id = `${subject}-${style}`;
      const bytes = Buffer.from(id);
      const entry = {
        id,
        kind,
        style,
        subject,
        generated: true,
        tags: [],
        alt: subject,
        sha256: sha256(bytes),
        url: `${libraryBase()}/files/${id}.webp`,
      };
      entries.push(entry);
      if (style === "lifelike") {
        const file = i === 0 ? "hero.webp" : `samples/${i}.webp`;
        writeFileSync(join(images, file), bytes);
        records[file] = { entry: id, style, sha256: entry.sha256, role: kind, generated: true };
      }
    }
  }
  writeFileSync(join(images, "logo.webp"), "An owner's logo");
  writeFileSync(join(images, "pictures.json"), JSON.stringify(records));
  const version: LibraryVersion = {
    version: "v1",
    entries,
    styles: ["lifelike", "pastel", "ink-wash"].map((id) => ({
      id,
      generated: true,
      words: { en: { name: id, line: `${id} pictures` }, sv: { name: `sv-${id}`, line: "Bilder" } },
    })),
  };
  return { dir, images, version };
}

test("cards show three matching app subjects, exclude incomplete sets and use library words", () => {
  const f = fixture();
  try {
    const before = readFileSync(join(f.images, "pictures.json"), "utf8");
    const cards = pictureStyleCards(f.dir, f.version, "sv");
    expect(cards.current).toBe("lifelike");
    expect(cards.styles.map((s) => s.id)).toEqual(["lifelike", "pastel"]);
    expect(cards.styles[1]?.name).toBe("sv-pastel");
    expect(cards.styles[1]?.previews.map((p) => p.alt)).toEqual(["cafe", "bicycle", "lamp"]);
    expect(cards.styles[1]?.total).toBe(3);
    expect(cards.styles[1]?.kept).toBe(0);
    expect(readFileSync(join(f.images, "pictures.json"), "utf8")).toBe(before);
  } finally {
    rmSync(f.dir, { recursive: true, force: true });
  }
});

test("owner-changed pictures stay, and both bytes and record changes invalidate an offer", () => {
  const f = fixture();
  try {
    const original = pictureHashes(f.dir);
    writeFileSync(join(f.images, "samples/2.webp"), "Owner picture");
    expect(pictureHashes(f.dir)).not.toBe(original);
    const cards = pictureStyleCards(f.dir, f.version);
    expect(cards.styles.find((s) => s.id === "pastel")?.kept).toBe(1);
    expect(cards.styles.find((s) => s.id === "pastel")?.previews).toHaveLength(2);
    const changed = pictureHashes(f.dir);
    writeFileSync(join(f.images, "pictures.json"), "{}");
    expect(pictureHashes(f.dir)).not.toBe(changed);
  } finally {
    rmSync(f.dir, { recursive: true, force: true });
  }
});

test("an app with only its own pictures has no empty style cards", () => {
  const f = fixture();
  try {
    for (const file of ["hero.webp", "samples/1.webp", "samples/2.webp"])
      writeFileSync(join(f.images, file), "Owner picture");
    expect(pictureStyleCards(f.dir, f.version).styles).toEqual([]);
  } finally {
    rmSync(f.dir, { recursive: true, force: true });
  }
});

test("the offered immutable index is used when latest changes; image fetches still go to the host", async () => {
  const f = fixture();
  try {
    const called: string[] = [];
    const remote: typeof fetch = async (input) => {
      called.push(String(input));
      return Response.json({ version: "v2" });
    };
    const pinned = pinnedPictureVersion(f.version, remote);
    expect(await libraryVersion(pinned)).toEqual(f.version);
    expect(called).toEqual([]);
    await pinned(`${libraryBase()}/files/a.webp`);
    expect(called).toEqual([`${libraryBase()}/files/a.webp`]);
  } finally {
    rmSync(f.dir, { recursive: true, force: true });
  }
});

test("the current style shows the app's actual files when the library has newer variants", () => {
  const f = fixture();
  try {
    const current = f.version.entries.find((entry) => entry.id === "cafe-lifelike");
    if (!current) throw new Error("Missing fixture");
    current.sha256 = "f".repeat(64);
    current.generated = false;
    const cards = pictureStyleCards(f.dir, f.version);
    const card = cards.styles.find((style) => style.id === "lifelike");
    expect(card?.previews[0]?.src).toBe(
      `/api/images/hero.webp?v=${sha256(Buffer.from("cafe-lifelike"))}`,
    );
    expect(card?.generated).toBe(3);
  } finally {
    rmSync(f.dir, { recursive: true, force: true });
  }
});
