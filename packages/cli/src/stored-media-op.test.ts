// Studio's /api/op path for a stored choice (media-storage.md §2, §7; T1544): the host fills the
// record from the service and runs the operation as the host's; a person's own record is refused.
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, expect, test, vi } from "vitest";
import { ensureRepository } from "./git.js";
import { hostRecord, type MediaSource } from "./media-cache.js";
import { runOperation } from "./op.js";
import { captureIo } from "./test-io.js";

vi.mock("./generate.js", () => ({ generate: vi.fn(async () => 0) }));
const roots: string[] = [];
afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

const PICTURE = "m_01hz8k3q4r5s6t7v8w9x0y1z2a";
const FILM = "m_7zzzzzzzzzzzzzzzzzzzzzzzzz";
const source: MediaSource = {
  record: async () => undefined,
  fetch: async () => undefined,
  sizes: async (asset) => (asset === PICTURE ? { width: 1600, widths: [480, 960] } : undefined),
  film: async (asset) =>
    asset === FILM
      ? { width: 3840, height: 2160, heights: [720, 1080], duration: 5, sound: true }
      : undefined,
};

function project() {
  const dir = mkdtempSync(join(tmpdir(), "smithable-stored-op-"));
  roots.push(dir);
  writeFileSync(join(dir, ".gitignore"), "data/\n");
  writeFileSync(
    join(dir, "smithable.yml"),
    "smithable: 0.1\napp: { name: Roofs }\npages:\n  home:\n    route: /\n    landing:\n      hero: {}\n",
  );
  writeFileSync(
    join(dir, "smithable.content.yml"),
    "smithableContent: 0.1\npages:\n  home:\n    hero:\n      title: Roofs\n      image: { src: images/hero.webp, alt: A roof }\n",
  );
  mkdirSync(join(dir, ".smithable"), { recursive: true });
  writeFileSync(join(dir, ".smithable/files.json"), '{"files":{}}\n');
  ensureRepository(dir);
  return dir;
}

/** What Studio's /api/op does with a person's stored choice. */
async function asStudio(dir: string, name: string, args: Record<string, unknown>) {
  const io = captureIo();
  const filled = await hostRecord(name, args, source);
  const code = await runOperation(dir, io, name, args, {
    yes: true,
    reportLater: true,
    ...(filled ? { from: "host" as const } : {}),
  });
  return { code, io };
}

test("a stored picture and a stored film chosen in Studio are placed with the service's record", async () => {
  const dir = project();
  const picture = await asStudio(dir, "setSectionPicture", {
    page: "home",
    section: "hero",
    asset: PICTURE,
    alt: "A roof",
  });
  expect(picture.code, picture.io.stderr).toBe(0);
  const film = await asStudio(dir, "setSectionFilm", {
    page: "home",
    section: "hero",
    asset: FILM,
  });
  expect(film.code, film.io.stderr).toBe(0);
  const text = readFileSync(join(dir, "smithable.content.yml"), "utf8");
  expect(text).toContain(`asset: ${PICTURE}`);
  expect(text).toContain("widths: [480, 960]");
  expect(text, text).toContain(`film:\n          asset: ${FILM}\n          heights: [720, 1080]\n`);
});

test("a caller's own record is dropped, and a file the service does not know is refused", async () => {
  const dir = project();
  const forged = { width: 1920, height: 1080, heights: [720], duration: 5, sound: false };
  const unknown = await asStudio(dir, "setSectionFilm", {
    page: "home",
    section: "hero",
    asset: "m_01hz8k3q4r5s6t7v8w9x0y1z2c",
    record: forged,
  });
  expect(unknown.code).not.toBe(0);
  expect(unknown.io.stderr).toMatch(/Photos and videos/);
  // Without the host, a record given by a person is refused outright.
  const io = captureIo();
  const args = { page: "home", section: "hero", asset: FILM, record: forged };
  expect(
    await runOperation(dir, io, "setSectionFilm", args, { yes: true, reportLater: true }),
  ).not.toBe(0);
  expect(io.stderr).toMatch(/record/);
});
