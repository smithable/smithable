// The hosted workspace's cache of stored pictures (media-storage.md §3, §4): what is fetched, what
// is checked before a file is placed, where it may go, and what validate says of absent files.
import { createHash } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, expect, test } from "vitest";
import {
  hostedMediaSource,
  hostRecord,
  type MediaSource,
  mediaFindings,
  mediaSyncer,
  placeMedia,
  syncMedia,
} from "./media-cache.js";

const roots: string[] = [];
afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});
const folder = (prefix: string) => {
  const dir = mkdtempSync(join(tmpdir(), prefix));
  roots.push(dir);
  return dir;
};

const ID = "m_01hz8k3q4r5s6t7v8w9x0y1z2a";
const OTHER = "m_01hz8k3q4r5s6t7v8w9x0y1z2b";
const hash = (text: string) => createHash("sha256").update(text).digest("hex");
const bytes = (text: string) => new TextEncoder().encode(text);

function project(content: string) {
  const dir = folder("smithable-media-cache-");
  writeFileSync(join(dir, "smithable.content.yml"), content);
  return dir;
}
const hero = (asset: string) => `smithableContent: 0.1
pages:
  home:
    hero:
      title: Roofs
      image: { asset: ${asset}, alt: A roof, width: 1600, widths: [480] }
`;

/** A source holding the given files (`asset/variant` → text), counting the fetches. */
function source(files: Record<string, string>, overrides: Partial<MediaSource> = {}) {
  const fetched: string[] = [];
  const s: MediaSource = {
    async record(asset) {
      const names = Object.keys(files).filter((k) => k.startsWith(`${asset}/`));
      if (!names.length) return undefined;
      return Object.fromEntries(names.map((k) => [k.slice(asset.length + 1), hash(files[k]!)]));
    },
    async fetch(asset, variant) {
      fetched.push(`${asset}/${variant}`);
      const text = files[`${asset}/${variant}`];
      return text === undefined ? undefined : { bytes: bytes(text), sha256: hash(text) };
    },
    ...overrides,
  };
  return { source: s, fetched };
}

test("§4 the renditions in use are fetched, checked and written; cached ones are not fetched again", async () => {
  const dir = project(hero(ID));
  const { source: s, fetched } = source({
    [`${ID}/w480.webp`]: "small",
    [`${ID}/w1600.webp`]: "large",
  });
  const first = await syncMedia(dir, s);
  expect(first.written).toEqual([`${ID}/w480.webp`, `${ID}/w1600.webp`]);
  expect(readFileSync(join(dir, "public/media", ID, "w1600.webp"), "utf8")).toBe("large");
  // Nothing but the two files: the temporary names were moved into place.
  expect(readdirSync(join(dir, "public/media", ID)).sort()).toEqual(["w1600.webp", "w480.webp"]);
  await syncMedia(dir, s);
  expect(fetched).toHaveLength(2);
  expect(mediaFindings(dir)).toEqual([]);
});

test("§4 a file whose hash is not its record's is never placed", async () => {
  const dir = project(hero(ID));
  const sent = source({ [`${ID}/w480.webp`]: "small", [`${ID}/w1600.webp`]: "large" });
  // The bytes changed on the way; the header still names the record's hash.
  const { source: s } = source(
    { [`${ID}/w480.webp`]: "small", [`${ID}/w1600.webp`]: "large" },
    {
      fetch: async (asset, variant) => ({
        bytes: bytes("tampered"),
        sha256: (await sent.source.record(asset))?.[variant] ?? "",
      }),
    },
  );
  const done = await syncMedia(dir, s);
  // Each wrong rendition is counted missing, with why, and the others are still tried.
  expect(done.missing).toEqual([`${ID}/w480.webp`, `${ID}/w1600.webp`]);
  expect(done.faults[0]).toContain("another hash than its record's");
  expect(existsSync(join(dir, "public/media", ID))).toBe(false);
  // And the writer checks again on its own, whoever calls it.
  expect(() => placeMedia(dir, ID, "w480.webp", bytes("small"), hash("other"))).toThrow(
    "not the recorded file",
  );
});

test("§4 only a valid id and rendition name are written, under public/media, through no link", () => {
  const dir = project(hero(ID));
  const outside = folder("smithable-media-outside-");
  expect(() => placeMedia(dir, "../x", "w480.webp", bytes("a"), hash("a"))).toThrow(
    "Not a media name",
  );
  expect(() => placeMedia(dir, ID, "../w480.webp", bytes("a"), hash("a"))).toThrow(
    "Not a media name",
  );
  expect(() => placeMedia(dir, ID, "index.html", bytes("a"), hash("a"))).toThrow(
    "Not a media name",
  );
  mkdirSync(join(dir, "public"));
  symlinkSync(outside, join(dir, "public/media"));
  expect(() => placeMedia(dir, ID, "w480.webp", bytes("a"), hash("a"))).toThrow("is not a folder");
  expect(readdirSync(outside)).toEqual([]);
});

test("§4 at start a cached file the service refuses is taken out; one it cannot answer for stays", async () => {
  const dir = project(hero(ID));
  const files = {
    [`${ID}/w480.webp`]: "small",
    [`${ID}/w1600.webp`]: "large",
    [`${OTHER}/w480.webp`]: "o",
  };
  for (const [name, text] of Object.entries(files)) {
    mkdirSync(join(dir, "public/media", name.split("/")[0]!), { recursive: true });
    writeFileSync(join(dir, "public/media", name), text);
  }
  const down = source(files, {
    record: async () => {
      throw new Error("The service answered 503.");
    },
  });
  await expect(syncMedia(dir, down.source, { recheck: true })).rejects.toThrow("503");
  expect(existsSync(join(dir, "public/media", OTHER))).toBe(true);
  // OTHER is no longer the project's: the service refuses it.
  const { source: s } = source({ [`${ID}/w480.webp`]: "small", [`${ID}/w1600.webp`]: "large" });
  const done = await syncMedia(dir, s, { recheck: true });
  expect(done.removed).toEqual([OTHER]);
  expect(existsSync(join(dir, "public/media", OTHER))).toBe(false);
  expect(existsSync(join(dir, "public/media", ID, "w480.webp"))).toBe(true);
});

test("§3 a file the service does not give is missing, and validate warns of it", async () => {
  const dir = project(hero(ID));
  const { source: s } = source({ [`${ID}/w1600.webp`]: "large" });
  const done = await syncMedia(dir, s);
  expect(done.missing).toEqual([`${ID}/w480.webp`]);
  const [warning, ...rest] = mediaFindings(dir);
  expect(rest).toEqual([]);
  expect(warning).toMatchObject({ severity: "warning", code: "media-absent" });
  expect(warning?.message).toContain(`${ID} has no w480.webp`);
});

test("§4 Studio's syncs run one at a time, and a change asked for meanwhile is fetched after", async () => {
  const dir = project(hero(ID));
  let release = () => {};
  const gate = new Promise<void>((r) => {
    release = r;
  });
  let records = 0;
  const { source: s } = source({
    [`${ID}/w480.webp`]: "small",
    [`${ID}/w1600.webp`]: "large",
    [`${OTHER}/w480.webp`]: "o",
  });
  const slow: MediaSource = {
    ...s,
    record: async (asset) => {
      records++;
      await gate;
      return s.record(asset);
    },
  };
  const said: string[] = [];
  const { sync } = mediaSyncer(dir, slow, (line) => said.push(line));
  const first = sync();
  while (!records) await new Promise((r) => setTimeout(r, 1));
  writeFileSync(join(dir, "smithable.content.yml"), hero(OTHER));
  const second = sync();
  const third = sync();
  expect(third).toBe(second);
  release();
  await Promise.all([first, second]);
  expect(existsSync(join(dir, "public/media", ID, "w1600.webp"))).toBe(true);
  expect(existsSync(join(dir, "public/media", OTHER, "w480.webp"))).toBe(true);
  expect(records).toBe(2);
  // OTHER has no w1600 in the source: said, and the preview goes on.
  expect(said.join("")).toContain(`${OTHER}/w1600.webp`);
});

test("§4 the service's source sends the token read at each fetch and checks nothing it is not given", async () => {
  const seen: string[] = [];
  const server = createServer((req, res) => {
    seen.push(`${req.url} ${req.headers["x-smithable-media-token"]}`);
    if (req.url === `/media/${ID}`) {
      res.writeHead(200, { "content-type": "application/json" });
      return res.end(
        JSON.stringify({
          kind: "image",
          width: 1600,
          widths: [960, 480, 1600, -2, "x"],
          variants: { "w480.webp": hash("small"), "../x": hash("x"), "w960.webp": "short" },
        }),
      );
    }
    if (req.url === `/media/${ID}/w480.webp`) {
      res.writeHead(200, { "x-media-sha256": hash("small") });
      return res.end("small");
    }
    if (req.url === `/media/${OTHER}`) return res.writeHead(403).end();
    res.writeHead(404).end();
  });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  try {
    const home = folder("smithable-media-home-");
    const token = join(home, "media-token");
    writeFileSync(token, "first");
    const url = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
    expect(hostedMediaSource({}, token)).toBeUndefined();
    const s = hostedMediaSource({ SMITHABLE_MEDIA_URL: url }, token);
    if (!s) throw new Error("no source");
    expect(await s.record(ID)).toEqual({ "w480.webp": hash("small") });
    writeFileSync(token, "renewed");
    const got = await s.fetch(ID, "w480.webp");
    expect(new TextDecoder().decode(got?.bytes)).toBe("small");
    expect(got?.sha256).toBe(hash("small"));
    expect(seen).toEqual([`/media/${ID} first`, `/media/${ID}/w480.webp renewed`]);
    // Refused (not found) is none; a caller the service does not know is an error, not a refusal.
    expect(await s.fetch(ID, "w960.webp")).toBeUndefined();
    await expect(s.record(OTHER)).rejects.toThrow("403");
    // Names that are not media are never asked for.
    expect(await s.fetch("../etc", "w480.webp")).toBeUndefined();
    expect(await s.fetch(ID, "../../x")).toBeUndefined();
    expect(seen).toHaveLength(4);
    // The sizes for setSectionPicture: the record's, checked; none for a refused file.
    expect(await s.sizes?.(ID)).toEqual({ width: 1600, widths: [480, 960] });
    expect(await s.sizes?.("m_01hz8k3q4r5s6t7v8w9x0y1z2c")).toBeUndefined();
  } finally {
    server.close();
  }
});

test("§3 media in-use reads the folder's content file only, prints core's list as JSON; none is []", async () => {
  const { mediaInUseCommand } = await import("./media-cache.js");
  const { captureIo } = await import("./test-io.js");
  const dir = project(hero(ID));
  // No smithable.yml: the service gives it the content file alone.
  const io = captureIo();
  expect(mediaInUseCommand(dir, io)).toBe(0);
  expect(JSON.parse(io.stdout)).toEqual([{ asset: ID, variants: ["w480.webp", "w1600.webp"] }]);
  rmSync(join(dir, "smithable.content.yml"));
  const none = captureIo();
  expect(mediaInUseCommand(dir, none)).toBe(0);
  expect(none.stdout).toBe("[]\n");
  writeFileSync(join(dir, "smithable.content.yml"), "pages: [unclosed\n");
  const broken = captureIo();
  expect(mediaInUseCommand(dir, broken)).toBe(1);
  expect(broken.stdout).toBe("");
});

test("§4 a recheck takes out a cached file that is not its record's, and never goes through a link at public", async () => {
  const dir = project(hero(ID));
  mkdirSync(join(dir, "public/media", ID), { recursive: true });
  writeFileSync(join(dir, "public/media", ID, "w480.webp"), "changed");
  writeFileSync(join(dir, "public/media", ID, "w1600.webp"), "large");
  const { source: s } = source({ [`${ID}/w480.webp`]: "small", [`${ID}/w1600.webp`]: "large" });
  const done = await syncMedia(dir, s, { recheck: true });
  expect(done.removed).toEqual([`${ID}/w480.webp`]);
  expect(done.written).toEqual([`${ID}/w480.webp`]);
  expect(readFileSync(join(dir, "public/media", ID, "w480.webp"), "utf8")).toBe("small");
  // public itself a link: nothing is read or taken out through it.
  const linked = project(hero(ID));
  const outside = folder("smithable-media-outside-");
  mkdirSync(join(outside, "media", OTHER), { recursive: true });
  writeFileSync(join(outside, "media", OTHER, "w480.webp"), "o");
  symlinkSync(outside, join(linked, "public"));
  const none = await syncMedia(linked, source({}).source, { recheck: true });
  expect(none.removed).toEqual([]);
  expect(existsSync(join(outside, "media", OTHER, "w480.webp"))).toBe(true);
});

test("§4 a recheck that failed is owed: the next sync rechecks", async () => {
  const dir = project(hero(ID));
  mkdirSync(join(dir, "public/media", OTHER), { recursive: true });
  writeFileSync(join(dir, "public/media", OTHER, "w480.webp"), "o");
  let down = true;
  const { source: s } = source({ [`${ID}/w480.webp`]: "small", [`${ID}/w1600.webp`]: "large" });
  const flaky: MediaSource = {
    ...s,
    record: async (asset) => {
      if (down) throw new Error("The service answered 503.");
      return s.record(asset);
    },
  };
  const said: string[] = [];
  const { sync } = mediaSyncer(dir, flaky, (line) => said.push(line));
  await sync(true);
  expect(said.join("")).toContain("503");
  down = false;
  await sync();
  expect(existsSync(join(dir, "public/media", OTHER))).toBe(false);
});

test("§4 one picture that cannot be placed stops only itself; the others are fetched", async () => {
  const dir = project(`smithableContent: 0.1
pages:
  home:
    hero:
      title: Roofs
      image: { asset: ${ID}, alt: A roof, width: 480 }
    about:
      title: Us
      image: { asset: ${OTHER}, alt: Us, width: 480 }
`);
  const outside = folder("smithable-media-outside-");
  mkdirSync(join(dir, "public/media"), { recursive: true });
  symlinkSync(outside, join(dir, "public/media", ID));
  const { source: s } = source({ [`${ID}/w480.webp`]: "a", [`${OTHER}/w480.webp`]: "o" });
  const done = await syncMedia(dir, s);
  expect(done.missing).toEqual([`${ID}/w480.webp`]);
  expect(done.written).toEqual([`${OTHER}/w480.webp`]);
  expect(readdirSync(outside)).toEqual([]);
});

test("§7 the service's film record: only a video's, a height only with its file, none without the poster", async () => {
  const records: Record<string, unknown> = {
    [ID]: {
      kind: "video",
      width: 3840,
      height: 2160,
      heights: [720, 1080, 480, "x"],
      duration: 6.5,
      sound: true,
      variants: { "720.mp4": hash("a"), "poster.webp": hash("p") },
    },
    [OTHER]: {
      kind: "video",
      width: 1920,
      height: 1080,
      heights: [720],
      duration: 4,
      sound: false,
      variants: { "720.mp4": hash("a") },
    },
    m_01hz8k3q4r5s6t7v8w9x0y1z2c: { kind: "image", width: 1600, widths: [480] },
    m_01hz8k3q4r5s6t7v8w9x0y1z2d: { kind: "video", width: 1920, heights: [720] },
  };
  const server = createServer((req, res) => {
    const record = records[(req.url ?? "").slice("/media/".length)];
    if (!record) return res.writeHead(404).end();
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify(record));
  });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  try {
    const token = join(folder("smithable-media-home-"), "media-token");
    writeFileSync(token, "t");
    const url = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
    const s = hostedMediaSource({ SMITHABLE_MEDIA_URL: url }, token);
    if (!s?.film) throw new Error("no source");
    expect(await s.film(ID)).toEqual({
      width: 3840,
      height: 2160,
      heights: [720],
      duration: 6.5,
      sound: true,
    });
    expect((await s.film(OTHER))?.heights).toEqual([]);
    expect(await s.film("m_01hz8k3q4r5s6t7v8w9x0y1z2c")).toBeUndefined();
    expect(await s.film("m_01hz8k3q4r5s6t7v8w9x0y1z2d")).toBeUndefined();
    expect(await s.film("m_01hz8k3q4r5s6t7v8w9x0y1z2e")).toBeUndefined();
    expect(await s.film("../x")).toBeUndefined();
  } finally {
    server.close();
  }
});

test("§7 the host fills a stored choice's record from the service, never the caller's", async () => {
  const film = { width: 1920, height: 1080, heights: [720, 1080], duration: 5, sound: false };
  const { source: s } = source(
    {},
    {
      sizes: async (asset) => (asset === ID ? { width: 1600, widths: [480] } : undefined),
      film: async (asset) => (asset === ID ? film : undefined),
    },
  );
  const picture: Record<string, unknown> = { asset: ID, rendition: { width: 9999 } };
  expect(await hostRecord("setSectionPicture", picture, s)).toBe(true);
  expect(picture.rendition).toEqual({ width: 1600, widths: [480] });
  const stranger: Record<string, unknown> = { asset: OTHER, rendition: { width: 9999 } };
  expect(await hostRecord("setSectionPicture", stranger, s)).toBe(false);
  expect(stranger).not.toHaveProperty("rendition");
  const chosen: Record<string, unknown> = { asset: ID, record: { duration: 1 } };
  expect(await hostRecord("setSectionFilm", chosen, s)).toBe(true);
  expect(chosen.record).toEqual(film);
  // A caller's record with a file of its own, or with no source, is dropped and nothing is filled.
  const own: Record<string, unknown> = { src: "images/a.mp4", record: film };
  expect(await hostRecord("setSectionFilm", own, s)).toBe(false);
  expect(own).not.toHaveProperty("record");
  const none: Record<string, unknown> = { asset: ID, record: film };
  expect(await hostRecord("setSectionFilm", none, undefined)).toBe(false);
  expect(none).not.toHaveProperty("record");
  expect(await hostRecord("setText", { asset: ID }, s)).toBe(false);
});
