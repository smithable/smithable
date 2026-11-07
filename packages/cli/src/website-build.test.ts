import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createServer } from "node:http";
import { dirname, join } from "node:path";
import { Readable } from "node:stream";
import { YamlEditor } from "@smithable/core";
import { expect, test, vi } from "vitest";
import { generationReceipt, startGeneration } from "./generation-job.js";
import { create } from "./new.js";
import { replaceProject, sync } from "./replace.js";
import { extractSiteFacts } from "./site-facts.js";
import { readSite } from "./site-fetch.js";
import { STARTERS } from "./starters.gen.js";
import { tempDir } from "./test-dir.js";
import { assetReview } from "./website-assets.js";
import { digest, installWebsiteInputCommand, parseWebsiteInput } from "./website-input.js";

const state = vi.hoisted(() => ({ descriptions: [] as string[], artifact: "", personalEmail: "" }));
vi.mock("@smithable/ai", async (original) => ({
  ...(await original<object>()),
  clarifyProject: async (options: { description: string }) => {
    state.descriptions.push(options.description);
    return { starter: "barbers", questions: [], usage: [] };
  },
  draftProject: async (options: { description: string; starter: Record<string, string> }) => {
    state.descriptions.push(options.description);
    const files = { ...options.starter };
    const content = new YamlEditor(files["smithable.content.yml"] ?? "");
    content.set(
      ["pages", "home", "hero", "subtitle"],
      "These ten very familiar words are copied from our website.",
    );
    files["smithable.content.yml"] = content.text;
    if (state.personalEmail) {
      const spec = new YamlEditor(files["smithable.yml"] ?? "");
      const description = `Contact ${state.personalEmail}. These ten very familiar words are copied from our website.`;
      if (spec.has(["app", "description"])) spec.set(["app", "description"], description);
      else spec.add(["app"], "description", description);
      files["smithable.yml"] = spec.text;
      const auth = new YamlEditor(files["smithable.auth.yml"] ?? "");
      auth.set(["roles", "admin", "description"], `Contact ${state.personalEmail}.`);
      files["smithable.auth.yml"] = auth.text;
    }
    return { kind: "draft", files, assumptions: [], usage: [] };
  },
}));
vi.mock("./ask.js", async (original) => ({
  ...(await original<object>()),
  providersFor: () => [],
}));
vi.mock("./generate.js", async (original) => ({
  ...(await original<object>()),
  generate: async (dir: string) => {
    expect(existsSync(state.artifact)).toBe(false);
    const { loadSpec } = await import("./validate.js");
    const messages: string[] = [];
    const loaded = loadSpec(dir, { out: () => {}, err: (message) => messages.push(message) });
    expect(loaded.ir, messages.join("\n")).toBeDefined();
    expect(loaded.auth, messages.join("\n")).toBeDefined();
    writeFileSync(join(dir, "package.json"), '{"name":"fixture"}');
    return 0;
  },
}));
const quiet = { out: () => {}, err: () => {} };
test("real multi-page extraction feeds only facts into the existing create pipeline, with final copy and asset checks", async () => {
  const server = createServer((request, response) => {
    response.setHeader("Content-Type", "text/html");
    response.end(
      request.url === "/robots.txt"
        ? "User-agent: *\nAllow: /"
        : request.url === "/about"
          ? '<h1>Harbour</h1><a href="mailto:hello@example.test">Email</a>'
          : '<meta property="og:site_name" content="Harbour"><h1>Harbour</h1><a href="tel:+3581812345">Call</a><a href="/about">About</a><p>These ten very familiar words are copied from our website.</p>',
    );
  });
  await new Promise<void>((done) => server.listen(0, "127.0.0.1", done));
  try {
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("fixture server");
    const site = await readSite(`http://127.0.0.1:${address.port}/`, {
      refuse: () => false,
      ports: [address.port],
    });
    expect(site.bundle.pages).toHaveLength(2);
    // Test transport hooks never enter the artifact: normalize only the fixture origin to the public contract.
    const value = JSON.parse(
      JSON.stringify({
        version: 1,
        facts: site.reading.facts,
        images: site.reading.images,
        sourceCorpus: site.reading.sourceCorpus,
        originals: [],
        authorization: { id: "auth", site: `http://127.0.0.1:${address.port}/`, images: false },
      }).replaceAll(`http://127.0.0.1:${address.port}`, "https://business.example"),
    );
    const dir = join(tempDir("website-build-"), "app"),
      raw = JSON.stringify(value),
      sha256 = digest(raw);
    mkdirSync(dir);
    expect(await installWebsiteInputCommand(dir, "job", sha256, quiet, Readable.from([raw]))).toBe(
      0,
    );
    state.artifact = join(
      dirname(dir),
      ".smithable-site-inputs",
      digest(dir),
      "job",
      `${sha256}.json`,
    );
    writeFileSync(join(dir, "smithable.yml"), "placeholder");
    vi.stubEnv("SMITHABLE_DRAFT", "files");
    vi.stubEnv("SMITHABLE_NO_PICTURES", "1");
    expect(STARTERS.barbers).toBeDefined();
    const make: typeof replaceProject = async (target, _io, _replacement, _progress, control) => {
      expect(control?.websiteInput).toBeDefined();
      const incoming = `${target}.test-incoming`;
      const result = await create(incoming, quiet, "barbers", {
        websiteInput: control?.websiteInput,
        yes: true,
        unattended: true,
        admin: "owner@example.test",
        installed: true,
        onWebsite: control?.websiteSummary,
      });
      if (result !== 0) return result;
      control?.beforeArrival();
      sync(incoming, target);
      return 0;
    };
    startGeneration(
      dir,
      "job",
      { website: { input: { version: 1, sha256 } } },
      true,
      quiet,
      false,
      undefined,
      make,
    );
    for (let i = 0; i < 100 && generationReceipt(dir, "job")?.status === "running"; i++)
      await new Promise((done) => setTimeout(done, 10));
    const receipt = generationReceipt(dir, "job");
    expect(receipt?.status).toBe("ready");
    expect(receipt?.checkpoint).toMatch(/^[a-f0-9]{40}$/);
    expect(receipt?.website?.inputDigest).toBe(sha256);
    expect(receipt?.website?.assetManifestDigest).toMatch(/^[a-f0-9]{64}$/);
    expect(state.descriptions.length).toBeGreaterThan(0);
    for (const description of state.descriptions)
      expect(description).not.toContain("These ten very familiar words");
    expect(readFileSync(join(dir, "smithable.content.yml"), "utf8")).not.toContain(
      "These ten very familiar words",
    );
    expect(existsSync(join(dir, "samples"))).toBe(false);
    expect(assetReview(dir).diagnostics).toEqual([]);
    expect(existsSync(join(dir, "smithable.assets.json"))).toBe(true);
  } finally {
    vi.unstubAllEnvs();
    await new Promise<void>((done) => server.close(() => done()));
  }
  // Last resort (2026-11-08): it runs the real create pipeline once, which takes about 0.9 s
  // alone, 0.7 s of it the test runner loading the modules create reaches, and over 5 s under a
  // gate's load. What it proves is that pipeline end to end; lightening it is open (A's backlog).
}, 30_000);

test("resumed owner-description fallback ignores ambiguous identity and originals but still checks source copy", async () => {
  const { extractSiteFacts } = await import("./site-facts.js");
  const { extractImageContexts } = await import("./image-context.js");
  const { parseWebsiteInput } = await import("./website-input.js");
  const url = "https://business.example/",
    html =
      '<meta property="og:site_name" content="Ambiguous source identity"><img src="/room.jpg" alt="Source room">',
    source = "These ten very familiar words are copied from our website.",
    bytes = Buffer.from([255, 216, 255, 0]);
  const facts = extractSiteFacts(html, url);
  facts.ambiguous = true;
  const images = extractImageContexts(html, url, "p1");
  const input = parseWebsiteInput({
    version: 1,
    facts,
    images,
    sourceCorpus: { version: 1, pages: [{ id: "p1", text: source, sha256: digest(source) }] },
    originals: [
      {
        id: images[0]?.id,
        mediaType: "image/jpeg",
        base64: bytes.toString("base64"),
        sha256: digest(bytes),
        authorizationId: "auth",
      },
    ],
    authorization: { id: "auth", site: url, images: true },
  });
  state.descriptions = [];
  state.artifact = "/this-fixture-does-not-exist";
  const dir = join(tempDir("website-owner-fallback-"), "app");
  vi.stubEnv("SMITHABLE_DRAFT", "files");
  try {
    expect(
      await create(dir, quiet, "barbers", {
        websiteInput: input,
        websiteOwnerDescription: true,
        instructions: "An events calendar for our community",
        yes: true,
        unattended: true,
        admin: "owner@example.test",
        pictureData: false,
      }),
    ).toBe(0);
    expect(
      state.descriptions.every(
        (description) => description === "An events calendar for our community",
      ),
    ).toBe(true);
    expect(readFileSync(join(dir, "smithable.content.yml"), "utf8")).not.toContain(source);
    expect(existsSync(join(dir, "public/images/originals"))).toBe(false);
    expect(existsSync(join(dir, "smithable.assets.json"))).toBe(true);
    expect(assetReview(dir).diagnostics).toEqual([]);
  } finally {
    vi.unstubAllEnvs();
  }
});

test("the existing hosted replacement enables library selection only for website jobs", async () => {
  const module = await import("./new.js"),
    seen: boolean[] = [];
  const mock = vi
    .spyOn(module, "create")
    .mockImplementation(async (_dir, _io, _starter, options) => {
      seen.push(options?.pictureData === true);
      return 1;
    });
  try {
    const control = {
      stage: () => {},
      assumptions: () => {},
      usage: () => {},
      diagnostic: () => {},
      beforeArrival: () => {},
    };
    const input = { version: 1 } as import("./website-input.js").WebsiteGenerationInput;
    await replaceProject(
      tempDir("website-replace-"),
      quiet,
      { website: { input: { version: 1, sha256: "a".repeat(64) } } },
      () => {},
      { ...control, websiteInput: input },
    );
    await replaceProject(
      tempDir("ordinary-replace-"),
      quiet,
      { describe: "A calendar" },
      () => {},
      control,
    );
    expect(seen).toEqual([true, false]);
  } finally {
    mock.mockRestore();
  }
});

test("explicit full-content input carries source prose and retains requested copied text", async () => {
  const text = "These ten very familiar words are copied from our website.";
  const source = parseWebsiteInput({
    version: 1,
    options: { contentMode: "full" },
    facts: extractSiteFacts(
      '<meta property="og:site_name" content="Harbour"><a href="tel:+3581812345">Call</a><a href="mailto:hello@example.test">Email</a>',
      "https://business.example/",
    ),
    images: [],
    originals: [],
    sourceCorpus: { version: 1, pages: [{ id: "p1", text, sha256: digest(text) }] },
    authorization: { id: "local-owner", site: "https://business.example/", images: false },
  });
  const dir = join(tempDir("website-full-build-"), "app");
  vi.stubEnv("SMITHABLE_DRAFT", "files");
  vi.stubEnv("SMITHABLE_NO_PICTURES", "1");
  try {
    vi.stubEnv("SMITHABLE_HOSTED_LEVEL", "normal");
    const calls = state.descriptions.length;
    expect(
      await create(dir, quiet, "barbers", {
        websiteInput: source,
        yes: true,
        unattended: true,
        installed: true,
      }),
    ).toBe(1);
    expect(state.descriptions).toHaveLength(calls);
    vi.stubEnv("SMITHABLE_HOSTED_LEVEL", "");
    expect(
      await create(dir, quiet, "barbers", {
        websiteInput: source,
        yes: true,
        unattended: true,
        admin: "owner@example.test",
        installed: true,
      }),
    ).toBe(0);
    expect(state.descriptions.at(-1)).toContain(text);
    expect(readFileSync(join(dir, "smithable.content.yml"), "utf8")).toContain(text);
    expect(readFileSync(join(dir, "smithable.content.yml"), "utf8")).not.toContain(
      "People and contact details are samples",
    );
  } finally {
    vi.unstubAllEnvs();
  }
});

test("actual copy-repair branch retains earlier spec/auth sample fields and YAML shape", async () => {
  const text = "These ten very familiar words are copied from our website.";
  const source = parseWebsiteInput({
    version: 1,
    facts: extractSiteFacts(
      '<meta property="og:site_name" content="Harbour"><a href="tel:+3581812345">Call</a><a href="mailto:a@example.test">Email</a>',
      "https://business.example/",
    ),
    images: [],
    originals: [],
    sourceCorpus: { version: 1, pages: [{ id: "p1", text, sha256: digest(text) }] },
    authorization: { id: "owner", site: "https://business.example/", images: false },
  });
  const dir = join(tempDir("website-copy-sidecar-"), "app");
  vi.stubEnv("SMITHABLE_DRAFT", "files");
  vi.stubEnv("SMITHABLE_NO_PICTURES", "1");
  state.personalEmail = "a@example.test";
  try {
    expect(
      await create(dir, quiet, "barbers", {
        websiteInput: source,
        yes: true,
        unattended: true,
        admin: "owner@example.test",
        installed: true,
      }),
    ).toBe(0);
    const spec = readFileSync(join(dir, "smithable.yml"), "utf8");
    const auth = readFileSync(join(dir, "smithable.auth.yml"), "utf8");
    const content = readFileSync(join(dir, "smithable.content.yml"), "utf8");
    expect(spec).not.toContain(text);
    expect(content).not.toContain(text);
    expect(spec.trimStart()).not.toMatch(/^[{]/);
    expect(auth.trimStart()).not.toMatch(/^[{]/);
    expect(content.trimStart()).not.toMatch(/^[{]/);
    expect(content).toContain("# What people read.");
    const sidecar = JSON.parse(readFileSync(join(dir, "smithable.website.json"), "utf8"));
    expect(sidecar.sampleFields).toContainEqual({
      file: "smithable.yml",
      path: ["app", "description"],
    });
    expect(sidecar.sampleFields).toContainEqual({
      file: "smithable.auth.yml",
      path: ["roles", "admin", "description"],
    });
  } finally {
    state.personalEmail = "";
    vi.unstubAllEnvs();
  }
});
