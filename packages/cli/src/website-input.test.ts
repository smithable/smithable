import { execFileSync } from "node:child_process";
import { createHmac } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, symlinkSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { Readable } from "node:stream";
import { expect, test } from "vitest";
import { extractImageContexts } from "./image-context.js";
import { siteBundleResult } from "./site-bundle.js";
import { extractSiteFacts } from "./site-facts.js";
import { tempDir } from "./test-dir.js";
import {
  consumeWebsiteInput,
  digest,
  installWebsiteInputCommand,
  parseWebsiteGenerationOptions,
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

test("legacy inputs default to sample and model projection cannot be supplied as authority", () => {
  const parsed = parseWebsiteInput(input());
  expect(parsed.options?.contentMode).toBe("sample");
  expect(parsed.model?.contentMode).toBe("sample");
  expect(parsed.model?.description).not.toContain("+3581812345");
  expect(parsed.model?.description).not.toContain("hello@example.test");
  expect(JSON.stringify(parsed.facts)).toContain("+3581812345");
  expect(() =>
    parseWebsiteInput({
      ...parsed,
      model: { ...parsed.model, description: "Raw injected personal details" },
    }),
  ).toThrow("projection");
  expect(() => parseWebsiteInput({ ...input(), options: { contentMode: "invalid" } })).toThrow(
    "mode",
  );
  expect(() =>
    parseWebsiteInput({ ...input(), options: { contentMode: "full", authorized: true } }),
  ).toThrow("object");
  expect(
    parseWebsiteGenerationOptions({
      input: { version: 1, sha256: "a".repeat(64) },
      contentMode: "full",
    }).contentMode,
  ).toBe("full");
  expect(() =>
    parseWebsiteGenerationOptions({
      input: { version: 1, sha256: "a".repeat(64) },
      contentMode: "other",
    }),
  ).toThrow("reference");
});

test("hosted full input needs separate trusted installer expectation and matching generation mode", async () => {
  const dir = join(tempDir("website-full-authority-"), "project");
  mkdirSync(dir);
  const raw = JSON.stringify({ ...input(), options: { contentMode: "full" } });
  const sha256 = digest(raw),
    ref = { version: 1 as const, sha256 };
  expect(
    await installWebsiteInputCommand(dir, "full-job", sha256, quiet, Readable.from([raw])),
  ).toBe(1);
  expect(
    await installWebsiteInputCommand(dir, "full-job", sha256, quiet, Readable.from([raw]), {
      contentMode: "full",
    }),
  ).toBe(0);
  expect(() => consumeWebsiteInput(dir, "full-job", ref)).toThrow("mode");
  const parsed = consumeWebsiteInput(dir, "full-job", ref, "full");
  expect(parsed.options?.contentMode).toBe("full");
  expect(parsed.model?.description).toContain("+3581812345");
});

test("generation parameters cannot elevate installed sample or legacy files to full", async () => {
  const dir = join(tempDir("website-mode-binding-"), "project");
  mkdirSync(dir);
  const raw = JSON.stringify(input()),
    sha256 = digest(raw),
    ref = { version: 1 as const, sha256 };
  expect(await installWebsiteInputCommand(dir, "job", sha256, quiet, Readable.from([raw]))).toBe(0);
  expect(() => consumeWebsiteInput(dir, "job", ref, "full")).toThrow("mode");
  expect(consumeWebsiteInput(dir, "job", ref).options?.contentMode).toBe("sample");
  const full = JSON.stringify({ ...input(), options: { contentMode: "full" } }),
    fullHash = digest(full);
  expect(
    await installWebsiteInputCommand(dir, "job", fullHash, quiet, Readable.from([full]), {
      contentMode: "full",
    }),
  ).toBe(0);
  const path = join(dirname(dir), ".smithable-site-inputs", digest(dir), "job", `${fullHash}.json`);
  const { unlinkSync } = await import("node:fs");
  unlinkSync(`${path}.permit`);
  expect(() => consumeWebsiteInput(dir, "job", { version: 1, sha256: fullHash }, "full")).toThrow(
    "trusted installer authority",
  );
});

test("private permit binds exact project, generation and input digest", async () => {
  const dir = join(tempDir("website-permit-binding-"), "project");
  mkdirSync(dir);
  const raw = JSON.stringify(input()),
    sha256 = digest(raw),
    ref = { version: 1 as const, sha256 };
  expect(await installWebsiteInputCommand(dir, "job", sha256, quiet, Readable.from([raw]))).toBe(0);
  const permit = join(
    dirname(dir),
    ".smithable-site-inputs",
    digest(dir),
    "job",
    `${sha256}.json.permit`,
  );
  const value = JSON.parse(readFileSync(permit, "utf8"));
  value.generation = "another-job";
  writeFileSync(permit, JSON.stringify(value), { mode: 0o600 });
  expect(() => consumeWebsiteInput(dir, "job", ref)).toThrow("authority");
});

test("fresh reader projection and structural private map survive the hosted input boundary", () => {
  const html =
    '<meta property="og:site_name" content="Harbour"><script type="application/ld+json">{"@type":"Person","name":"Maria Lindholm","email":"maria@harbour.example"}</script><p>Our therapist Maria Lindholm welcomes you.</p><a href="tel:+3581812345">Call</a>';
  const bytes = Buffer.byteLength(html);
  const reading = siteBundleResult({
    version: 1,
    startUrl: url,
    pages: [{ id: "p1", url, html, fetchedAt: new Date(0).toISOString(), bytes, depth: 0 }],
    crawl: { pages: 1, bytes, elapsedMs: 1, diagnostics: [] },
  });
  const value = {
    ...input(),
    facts: reading.facts,
    images: reading.images,
    sourceCorpus: reading.sourceCorpus,
    options: { contentMode: "sample" },
    model: reading.model,
    personalMap: reading.personalMap,
  };
  const parsed = parseWebsiteInput(value);
  expect(parsed.model).toEqual(reading.model);
  expect(JSON.stringify(parsed.model)).not.toContain("Maria Lindholm");
  expect(JSON.stringify(parsed.personalMap)).toContain("Maria Lindholm");
  const forged = structuredClone(value);
  const entry = forged.personalMap.entries[0];
  if (!entry) throw new Error("Fixture must detect a personal value");
  entry.replacement = "A forged value";
  expect(() => parseWebsiteInput(forged)).toThrow();
});

test("wrong-kind private mappings cannot suppress a detected person at hosted installation", async () => {
  const dir = join(tempDir("website-wrong-kind-"), "project");
  mkdirSync(dir);
  const key = "a".repeat(64),
    original = "Maria Lindholm";
  const id = createHmac("sha256", Buffer.from(key, "hex"))
    .update(`phone\0${original.toLowerCase()}`)
    .digest("hex");
  const raw = JSON.stringify({
    ...input(),
    personalMap: {
      version: 1,
      key,
      entries: [{ id, kind: "phone", ordinal: 0, original, replacement: "+999 000 000001" }],
      handles: [],
    },
  });
  expect(
    await installWebsiteInputCommand(dir, "job", digest(raw), quiet, Readable.from([raw])),
  ).toBe(1);
});

test("malformed private JSON never copies source snippets into command diagnostics", async () => {
  const dir = join(tempDir("website-json-private-"), "project");
  mkdirSync(dir);
  const raw = '{"private":"Maria Lindholm maria@personal.example",BROKEN';
  let error = "";
  expect(
    await installWebsiteInputCommand(
      dir,
      "job",
      digest(raw),
      {
        out: () => {},
        err: (text) => {
          error += text;
        },
      },
      Readable.from([raw]),
    ),
  ).toBe(1);
  expect(error).toBe("The website input is not valid JSON.\n");
  expect(error).not.toContain("Maria");
  const good = JSON.stringify(input()),
    sha256 = digest(good);
  expect(await installWebsiteInputCommand(dir, "job", sha256, quiet, Readable.from([good]))).toBe(
    0,
  );
  const path = join(
    dirname(dir),
    ".smithable-site-inputs",
    digest(dir),
    "job",
    `${sha256}.json.permit`,
  );
  writeFileSync(path, raw, { mode: 0o600 });
  expect(() => consumeWebsiteInput(dir, "job", { version: 1, sha256 })).toThrow(
    "The installed website authority is not valid JSON.",
  );
});
