import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, symlinkSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { Readable } from "node:stream";
import { expect, test } from "vitest";
import { extractImageContexts } from "./image-context.js";
import { extractSiteFacts } from "./site-facts.js";
import { tempDir } from "./test-dir.js";
import {
  consumeWebsiteInput,
  digest,
  installWebsiteInputCommand,
  parseWebsiteInput,
} from "./website-input.js";

const quiet = { out: () => {}, err: () => {} };
const url = "https://business.example/";
function input() {
  const html =
    '<meta property="og:site_name" content="Harbour"><a href="tel:+3581812345">Call</a><a href="mailto:hello@example.test">Email</a><img src="/hero.jpg" alt="A cup">';
  const text = "These ten very familiar words are copied from our website.";
  const images = extractImageContexts(html, url, "p1");
  return {
    version: 1,
    facts: extractSiteFacts(html, url),
    images,
    sourceCorpus: { version: 1, pages: [{ id: "p1", text, sha256: digest(text) }] },
    originals: [],
    authorization: { id: "auth-1", site: url, images: false },
  };
}

test("host input is digest bound, consumed before building and cannot name arbitrary paths", async () => {
  const dir = join(tempDir("website-input-"), "project");
  mkdirSync(dir);
  const value = input(),
    raw = JSON.stringify(value),
    sha256 = digest(raw);
  expect(await installWebsiteInputCommand(dir, "job-1", sha256, quiet, Readable.from([raw]))).toBe(
    0,
  );
  const file = join(dirname(dir), ".smithable-site-inputs", digest(dir), "job-1", `${sha256}.json`);
  expect(existsSync(file)).toBe(true);
  expect(consumeWebsiteInput(dir, "job-1", { version: 1, sha256 }).facts.url).toBe(url);
  expect(existsSync(file)).toBe(false);
  expect(
    await installWebsiteInputCommand(dir, "../escape", sha256, quiet, Readable.from([raw])),
  ).toBe(1);
  expect(
    await installWebsiteInputCommand(dir, "job-1", "a".repeat(64), quiet, Readable.from([raw])),
  ).toBe(1);
});

test("prototype keys, changed corpus hashes and unaudited originals are refused", () => {
  expect(() =>
    parseWebsiteInput(
      JSON.parse(JSON.stringify(input()).replace('"version":1', '"__proto__":{},"version":1')),
    ),
  ).toThrow("forbidden");
  const value = input();
  const page = value.sourceCorpus.pages[0];
  if (!page) throw new Error("fixture");
  page.text += "changed";
  expect(() => parseWebsiteInput(value)).toThrow("corpus");
  const original = {
    id: input().images[0]?.id,
    mediaType: "image/jpeg",
    sha256: digest(Buffer.from([255, 216, 255, 0])),
    base64: Buffer.from([255, 216, 255, 0]).toString("base64"),
    authorizationId: "auth-1",
  };
  expect(() => parseWebsiteInput({ ...input(), originals: [original] })).toThrow("authorized");
  expect(() =>
    parseWebsiteInput({
      ...input(),
      authorization: { id: "auth-1", site: url, images: true },
      originals: [{ ...original, authorizationId: "other" }],
    }),
  ).toThrow("invalid");
});

test("artifact directories and input files cannot be symlink redirects", async () => {
  const base = tempDir("website-input-links-"),
    dir = join(base, "project");
  mkdirSync(dir);
  const elsewhere = tempDir("website-elsewhere-");
  symlinkSync(elsewhere, join(base, ".smithable-site-inputs"));
  const raw = JSON.stringify(input()),
    sha256 = digest(raw);
  expect(await installWebsiteInputCommand(dir, "job-1", sha256, quiet, Readable.from([raw]))).toBe(
    1,
  );
  const other = join(tempDir("website-input-file-"), "project");
  mkdirSync(other);
  expect(
    await installWebsiteInputCommand(other, "job-1", sha256, quiet, Readable.from([raw])),
  ).toBe(0);
  const file = join(
    dirname(other),
    ".smithable-site-inputs",
    digest(other),
    "job-1",
    `${sha256}.json`,
  );
  const target = join(elsewhere, "secret");
  writeFileSync(target, raw);
  const { unlinkSync } = await import("node:fs");
  unlinkSync(file);
  symlinkSync(target, file);
  expect(() => consumeWebsiteInput(other, "job-1", { version: 1, sha256 })).toThrow();
  expect(readFileSync(target, "utf8")).toBe(raw);
});

test("originals require an explicit recognized raster media type", () => {
  const value = input(),
    bytes = Buffer.from("not an image");
  expect(() =>
    parseWebsiteInput({
      ...value,
      authorization: { ...value.authorization, images: true },
      originals: [
        {
          id: value.images[0]?.id,
          base64: bytes.toString("base64"),
          sha256: digest(bytes),
          authorizationId: "auth-1",
        },
      ],
    }),
  ).toThrow("invalid");
});
test("sibling projects cannot consume each other's input with the same generation id", async () => {
  const base = tempDir("website-siblings-"),
    left = join(base, "left"),
    right = join(base, "right");
  mkdirSync(left);
  mkdirSync(right);
  const raw = JSON.stringify(input()),
    sha256 = digest(raw);
  for (const dir of [left, right])
    expect(
      await installWebsiteInputCommand(dir, "same-id", sha256, quiet, Readable.from([raw])),
    ).toBe(0);
  expect(consumeWebsiteInput(left, "same-id", { version: 1, sha256 }).facts.url).toBe(url);
  expect(consumeWebsiteInput(right, "same-id", { version: 1, sha256 }).facts.url).toBe(url);
});

test("a special input file is refused without blocking", async () => {
  const dir = join(tempDir("website-input-fifo-"), "project");
  mkdirSync(dir);
  const raw = JSON.stringify(input()),
    sha256 = digest(raw);
  expect(await installWebsiteInputCommand(dir, "job", sha256, quiet, Readable.from([raw]))).toBe(0);
  const file = join(dirname(dir), ".smithable-site-inputs", digest(dir), "job", `${sha256}.json`);
  const { unlinkSync } = await import("node:fs");
  unlinkSync(file);
  execFileSync("mkfifo", [file]);
  expect(() => consumeWebsiteInput(dir, "job", { version: 1, sha256 })).toThrow("regular file");
});
