import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { createServer, type Server } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, expect, test } from "vitest";
import { describePage, readPage, readPageCommand } from "./from-page.js";
import { type SiteBundleResult, siteBundleResult } from "./site-bundle.js";
import { readSite } from "./site-fetch.js";
import { allowedByRobots, createSiteFetch } from "./site-fetch-policy.js";

let server: Server;
let base: string;
const hits: string[] = [];
let slow = false;
const html = (body: string) =>
  `<html><head><title>Example Workshop</title><meta property="og:site_name" content="Example Workshop"></head><body>${body}</body></html>`;
beforeAll(async () => {
  server = createServer((req, res) => {
    hits.push(req.url ?? "");
    if (req.url === "/robots.txt") return res.end("User-agent: *\nDisallow: /secret\n");
    if (req.url === "/image.png")
      return res
        .writeHead(200, { "content-type": "image/png" })
        .end(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 0]));
    if (req.url === "/one" && slow) return;
    if (req.url === "/one")
      return res
        .writeHead(200, { "content-type": "text/html" })
        .end(
          html('<h1>Services</h1><p>Repair services cost €25.</p><a href="/two">Opening hours</a>'),
        );
    if (req.url === "/two")
      return res
        .writeHead(200, { "content-type": "text/html" })
        .end(html('<h1>Opening hours</h1><p>Monday 09:00–17:00</p><a href="/three">More</a>'));
    res
      .writeHead(200, { "content-type": "text/html" })
      .end(
        html(
          '<h1>Example Workshop</h1><address>12 Example Road</address><a href="tel:+3581812345">Phone</a><a href="/one">Services</a><a href="/secret">Private</a><img src="/image.png" alt="Workshop entrance" width="640" height="480">',
        ),
      );
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  base = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
});
afterAll(() => server.close());
const options = () => ({ refuse: () => false, ports: [80, 443, Number(new URL(base).port)] });

test("local readSite follows breadth-first depth2 with one robots policy and retains source evidence", async () => {
  hits.length = 0;
  const result = await readSite(`${base}/#start`, options());
  expect(result.bundle.startUrl).toBe(`${base}/`);
  expect(result.bundle.pages.map((page) => page.url)).toEqual([
    `${base}/`,
    `${base}/one`,
    `${base}/two`,
  ]);
  expect(result.bundle.pages.map((page) => page.depth)).toEqual([0, 1, 2]);
  expect(hits).not.toContain("/three");
  expect(hits).not.toContain("/secret");
  expect(hits.filter((path) => path === "/robots.txt")).toHaveLength(1);
  expect(result.originals).toEqual([]);
  expect(hits).not.toContain("/image.png");
  expect(result.reading.images[0]?.page).toBe(`${base}/`);
  expect(result.reading.sourceCorpus.pages).toHaveLength(3);
  expect(
    result.bundle.pages.every(
      (page) =>
        page.bytes === Buffer.byteLength(page.html) && !Number.isNaN(Date.parse(page.fetchedAt)),
    ),
  ).toBe(true);
});

test("authorized local originals use context IDs and inert raster bytes without accepting source file paths", async () => {
  hits.length = 0;
  const result = await readSite(`${base}/`, { ...options(), allowAssets: true });
  expect(result.originals).toHaveLength(1);
  expect(result.originals[0]?.id).toBe(result.reading.images[0]?.id);
  expect(result.originals[0]?.mediaType).toBe("image/png");
  expect(result.originals[0]?.sourceUrl).toBe(`${base}/image.png`);
  expect(result.originals[0]?.bytes).toBeInstanceOf(Uint8Array);
  expect(result.originals[0]).not.toHaveProperty("file");
  expect(result.bundle.crawl.bytes).toBeGreaterThan(
    result.bundle.pages.reduce((sum, page) => sum + page.bytes, 0),
  );
});

test("the saved-bundle command uses the same deterministic facts and rejects malformed bundles", async () => {
  const result = await readSite(`${base}/`, options());
  const dir = mkdtempSync(join(tmpdir(), "site-bundle-command-"));
  const out: string[] = [];
  const err: string[] = [];
  const io = { out: (text: string) => out.push(text), err: (text: string) => err.push(text) };
  try {
    const file = join(dir, "site.json");
    writeFileSync(file, JSON.stringify(result.bundle));
    expect(await readPageCommand(file, base, io, false, true, true)).toBe(0);
    const saved = JSON.parse(out.join("")) as SiteBundleResult;
    // A fresh read gets a fresh private key; the persisted map makes its projection replayable.
    expect(saved.personalMap.key).not.toBe(result.reading.personalMap.key);
    for (const key of [
      "facts",
      "images",
      "links",
      "sourceCorpus",
      "diagnostics",
      "tooLittle",
    ] as const)
      expect(saved[key]).toEqual(result.reading[key]);
    const replay = siteBundleResult(result.bundle, { personalMap: saved.personalMap });
    expect(replay).toEqual(saved);
    expect(saved.description).toBe(saved.model.description);
    writeFileSync(file, '{"version":1,"pages":[]}');
    expect(await readPageCommand(file, base, io, false, true, true)).toBe(1);
    expect(err.join("")).toContain("bundle is invalid");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("legacy description instruction preserves actual contacts and location", () => {
  const described = describePage(
    readPage(
      html(
        "<h1>Example Workshop</h1><address>12 Example Road</address><p>Call +3581812345 for repair services.</p>",
      ),
      "https://example.test/",
    ),
  );
  expect(described).toContain("Keep its real contact details and location as facts");
  expect(described).not.toContain("without its phone numbers or addresses");
});

test("wildcard robots policies are bounded and session depth cannot be supplied by an unvisited parent", async () => {
  expect(
    allowedByRobots(`User-agent: *\nDisallow: /${"*a".repeat(2000)}$\n`, `/${"a".repeat(2040)}`),
  ).toBe(false);
  const session = createSiteFetch(base, options());
  await expect(session.page(`${base}/two`, `${base}/one`)).rejects.toThrow(
    "referring page has not been read",
  );
});

test("upstream cancellation never turns an interrupted local crawl into generation input", async () => {
  slow = true;
  const controller = new AbortController();
  const reason = new Error("Owner cancelled");
  const timer = setTimeout(() => controller.abort(reason), 30);
  try {
    await expect(readSite(`${base}/`, { ...options(), signal: controller.signal })).rejects.toBe(
      reason,
    );
  } finally {
    slow = false;
    clearTimeout(timer);
  }
});

test("local outer traversal honors caller-lowered page, depth and byte limits without extra fetches", async () => {
  hits.length = 0;
  const result = await readSite(`${base}/`, { ...options(), limits: { pages: 1, depth: 0 } });
  expect(result.bundle.pages).toHaveLength(1);
  expect(hits).not.toContain("/one");
  expect(result.bundle.crawl.diagnostics.some((message) => message.includes("At most"))).toBe(
    false,
  );
});
