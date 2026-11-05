import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { Provider } from "@smithable/ai";
import { type SpecIR, YamlEditor } from "@smithable/core";
import { afterEach, expect, test, vi } from "vitest";
import { extractImageContexts } from "./image-context.js";
import { extractSiteFacts } from "./site-facts.js";
import { tempDir } from "./test-dir.js";
import { prepareWebsiteContext, websitePictures } from "./website-generation.js";
import { digest, parseWebsiteInput } from "./website-input.js";

const library = vi.hoisted(() => ({ pictures: [] as unknown[] }));
vi.mock("./pictures.js", async (original) => ({
  ...(await original<object>()),
  addLibraryPictures: async () => library.pictures,
}));
afterEach(() => {
  library.pictures = [];
});
const io = { out: () => {}, err: () => {} };
const url = "https://business.example/";
function input(
  html = '<meta property="og:site_name" content="Harbour"><img src="/room.jpg" alt="Room">',
) {
  return parseWebsiteInput({
    version: 1,
    facts: extractSiteFacts(
      `${html}<a href="tel:+3581812345">Call</a><a href="mailto:a@example.test">Mail</a>`,
      url,
    ),
    images: extractImageContexts(html, url, "p1"),
    sourceCorpus: {
      version: 1,
      pages: [
        {
          id: "p1",
          text: "Private source prose never sent to image interpretation",
          sha256: digest("Private source prose never sent to image interpretation"),
        },
      ],
    },
    originals: [],
    authorization: { id: "auth", site: url, images: false },
  });
}
const ir = {
  pages: [
    {
      id: "home",
      pattern: {
        kind: "landing",
        sections: [
          { kind: "hero", name: "hero" },
          { kind: "gallery", name: "gallery" },
        ],
      },
    },
  ],
} as SpecIR;
const files = (): Record<string, string> => ({
  "smithable.content.yml": JSON.stringify({
    logo: { src: "invented-logo.svg" },
    pages: { home: { hero: { title: "Harbour", image: { src: "invented.jpg" } } } },
  }),
});
test("website pictures remove unprovenanced logos and use an explicit neutral placeholder", async () => {
  const context = await prepareWebsiteContext(input(), false, [], () => {}),
    content = files();
  const selected = await websitePictures({ context, files: content, ir, io });
  expect(selected.assets).toHaveLength(1);
  expect(selected.assets[0]).toMatchObject({
    source: { kind: "placeholder" },
    factualPhotoReview: false,
    concept: false,
  });
  const text = new YamlEditor(content["smithable.content.yml"] ?? "").get([]);
  expect(JSON.stringify(text)).not.toContain("invented");
  expect(JSON.stringify(text)).toContain("Image placeholder");
});
test("a CC0 library photograph remains a visibly labelled concept requiring factual review", async () => {
  library.pictures = [
    {
      file: "hero.png",
      bytes: Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
      alt: "Concept room",
      generated: false,
      sourceUrl: "https://library.example/photo",
      credit: { author: "Artist", licence: "CC0" },
    },
  ];
  const context = await prepareWebsiteContext(input(), false, [], () => {}),
    content = files();
  const selected = await websitePictures({ context, files: content, ir, io });
  expect(selected.assets[0]).toMatchObject({
    source: { kind: "library", licence: "CC0" },
    concept: true,
    factualPhotoReview: true,
  });
  expect(content["smithable.content.yml"]).toContain("Concept image");
  expect(content["smithable.content.yml"]).toContain("People and contact details are samples");
  expect(selected.pictures[0]?.file).toMatch(/^library\/[a-f0-9]{64}\.png$/);
});
test("optional interpretation is opt-in and receives metadata without the source corpus or image bytes", async () => {
  let calls = 0,
    prompt = "";
  const provider: Provider = {
    name: "fixture",
    tier: "local",
    location: "local",
    price: { input: 0, output: 0 },
    complete: async (request) => {
      calls++;
      prompt = request.user;
      return { text: '{"interpretations":[]}', model: "fixture", inputTokens: 1, outputTokens: 1 };
    },
  };
  await prepareWebsiteContext(input(), false, [provider], () => {});
  expect(calls).toBe(0);
  await prepareWebsiteContext(input(), true, [provider], () => {});
  expect(calls).toBe(1);
  expect(prompt).toContain("Room");
  expect(prompt).not.toContain("Private source prose");
  expect(prompt).not.toContain("base64");
  expect(prompt).not.toContain("business.example");
});

test("owner fallback uses no ambiguous site facts, imagery or name", async () => {
  const source = input();
  source.facts.ambiguous = true;
  await expect(prepareWebsiteContext(source, false, [], () => {})).rejects.toThrow("too little");
  const notes: string[] = [];
  const context = await prepareWebsiteContext(
    source,
    true,
    [],
    (message) => notes.push(message),
    "A community events calendar",
    true,
  );
  expect(context.description).toBe("A community events calendar");
  expect(context.images).toEqual([]);
  expect(context.input.originals).toEqual([]);
  expect(context.input.sourceCorpus).toEqual(source.sourceCorpus);
  expect(notes).toHaveLength(1);
});

test("gallery-only layouts still receive a neutral image when the library is disabled", async () => {
  const context = await prepareWebsiteContext(input(), false, [], () => {}),
    content = files();
  content["smithable.content.fr-CA.yml"] = "# intentionally empty\n";
  const gallery = {
    pages: [
      {
        id: "home",
        pattern: { kind: "landing", sections: [{ kind: "gallery", name: "gallery" }] },
      },
    ],
  } as SpecIR;
  const result = await websitePictures({
    context,
    files: content,
    ir: gallery,
    io,
    allowLibrary: false,
  });
  expect(result.assets[0]?.source.kind).toBe("placeholder");
  expect(content["smithable.content.yml"]).toContain("Image placeholder");
  expect(content["smithable.content.fr-CA.yml"]).toBe("{}\n");
});

test("every model boundary replaces known source identifiers in keys, repairs and returned JSON", async () => {
  const source = input(
    '<meta property="og:site_name" content="Jane Doe"><img src="/staff.jpg" alt="Portrait of owner Jane Doe">',
  );
  const context = await prepareWebsiteContext(source, false, [], () => {});
  const requests: unknown[] = [];
  const provider: Provider = {
    name: "fixture",
    tier: "local",
    location: "local",
    price: { input: 0, output: 0 },
    complete: async (request) => {
      requests.push(request);
      return {
        text: JSON.stringify({ caption: "Jane Doe", code: "// Jane Doe\nconst value = 1;" }),
        model: "fixture",
        inputTokens: 1,
        outputTokens: 1,
      };
    },
  };
  const { websitePrivateProviders, replaceWebsitePersonalFiles } = await import(
    "./website-generation.js"
  );
  const wrapped = websitePrivateProviders([provider], context.personalMap)[0];
  if (!wrapped) throw new Error("fixture provider missing");
  const result = await wrapped.complete({
    system: "Repair Jane Doe output",
    user: "Jane Doe a@example.test +3581812345 https://business.example/",
    schema: { properties: { "Jane Doe": { type: "string" } } },
    repair: true,
  });
  expect(JSON.stringify(requests)).not.toContain("Jane Doe");
  expect(JSON.stringify(requests)).not.toContain("a@example.test");
  expect(JSON.stringify(requests)).not.toContain("+3581812345");
  expect(JSON.stringify(requests)).not.toContain("business.example");
  const answer = JSON.parse(result.text);
  expect(answer.caption).not.toContain("Jane Doe");
  expect(answer.code).toContain("\nconst value = 1;");
  const files = replaceWebsitePersonalFiles(
    {
      "smithable.yml": "app:\n  name: Jane Doe\n  description: Jane Doe welcomes you\n",
      "smithable.content.yml": JSON.stringify({
        body: '[Write](mailto:a%40example.test) <a href="tel:+3581812345">Call</a>',
        ctaUrl: "https://openstreetmap.org/?query=Jane%20Doe",
        pages: { home: { hero: { title: "Jane Doe" } } },
        contact: {
          href: "mailto:a@example.test",
          phone: { href: "tel:+3581812345" },
          map: { href: "https://maps.google.com/?q=Jane%20Doe" },
        },
      }),
    },
    context,
  );
  const spec = new YamlEditor(files["smithable.yml"] ?? "").get([]) as {
    app: { name: string; description: string };
  };
  expect(spec.app.name).toBe("Jane Doe");
  expect(spec.app.description).not.toContain("Jane Doe");
  const content = new YamlEditor(files["smithable.content.yml"] ?? "").get([]);
  expect(JSON.stringify(content)).not.toContain("Jane Doe");
  expect(JSON.stringify(content)).not.toContain("mailto:");
  expect(JSON.stringify(content)).not.toContain("tel:");
  expect(JSON.stringify(content)).not.toContain("maps.google");
  expect(files["smithable.website.json"]).toContain("sampleFields");
  expect(files["smithable.website.json"]).not.toContain("Jane Doe");
});

test("fallback instructions are sanitized and full mode actually includes instructed source prose", async () => {
  const source = input(
    '<meta property="og:site_name" content="Harbour"><img src="/staff.jpg" alt="Portrait of owner Jane Doe">',
  );
  source.facts.ambiguous = true;
  const fallback = await prepareWebsiteContext(
    source,
    false,
    [],
    () => {},
    "Make a calendar for Jane Doe at a@example.test",
    true,
  );
  expect(fallback.description).not.toContain("Jane Doe");
  expect(fallback.description).not.toContain("a@example.test");
  source.facts.ambiguous = false;
  source.options = { contentMode: "full" };
  const full = await prepareWebsiteContext(source, false, [], () => {});
  expect(full.contentMode).toBe("full");
  expect(full.description).toContain("Private source prose never sent to image interpretation");
  expect(full.description).toContain("a@example.test");
});

test("the final artifact pass replaces content leaves but refuses unsafe program rewrites", async () => {
  const context = await prepareWebsiteContext(input(), false, [], () => {});
  const { replaceWebsitePersonalArtifacts } = await import("./website-generation.js");
  const dir = tempDir("website-personal-output-");
  writeFileSync(
    join(dir, "smithable.content.yml"),
    "contact:\n  email: a@example.test\n  phone: +3581812345\n",
  );
  replaceWebsitePersonalArtifacts(dir, context);
  expect(readFileSync(join(dir, "smithable.content.yml"), "utf8")).not.toContain("a@example.test");
  mkdirSync(join(dir, "src"));
  const program = "// a@example.test\nexport const value = 1;\n";
  writeFileSync(join(dir, "src", "app.ts"), program);
  expect(() => replaceWebsitePersonalArtifacts(dir, context)).toThrow("source contact details");
  expect(readFileSync(join(dir, "src", "app.ts"), "utf8")).toBe(program);
});

test("sample mode omits known staff portraits while full instruction retains authorized originals", async () => {
  const source = input(
    '<meta property="og:site_name" content="Harbour"><img src="/staff.jpg" alt="Staff portrait of owner Jane Doe">',
  );
  const image = source.images[0];
  if (!image) throw new Error("fixture image missing");
  const bytes = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  source.authorization.images = true;
  source.originals = [
    {
      id: image.id,
      mediaType: "image/png",
      sha256: digest(bytes),
      base64: bytes.toString("base64"),
      authorizationId: "auth",
    },
  ];
  const sample = await prepareWebsiteContext(source, false, [], () => {});
  const selected = await websitePictures({
    context: sample,
    files: files(),
    ir,
    io,
    allowLibrary: false,
  });
  expect(selected.assets.some((asset) => asset.source.kind === "original")).toBe(false);
  source.options = { contentMode: "full" };
  const full = await prepareWebsiteContext(source, false, [], () => {});
  const original = await websitePictures({
    context: full,
    files: files(),
    ir,
    io,
    allowLibrary: false,
  });
  expect(original.assets[0]?.source).toMatchObject({ kind: "original", url: image.src });
});

test("pure compiler provenance permits typed identity but rejects injected identity in compiler/custom/public files", async () => {
  const { STARTERS } = await import("./starters.gen.js");
  const { loadSpec } = await import("./validate.js");
  const { replaceWebsitePersonalArtifacts } = await import("./website-generation.js");
  const context = await prepareWebsiteContext(
    input('<meta property="og:site_name" content="Jane Doe">'),
    false,
    [],
    () => {},
  );
  context.authoritativeAdmin = "a@example.test";
  const dir = tempDir("website-identity-compile-");
  const starter = STARTERS.barbers;
  if (!starter) throw new Error("fixture starter missing");
  for (const [file, text] of Object.entries(starter)) writeFileSync(join(dir, file), text);
  const spec = new YamlEditor(readFileSync(join(dir, "smithable.yml"), "utf8"));
  spec.set(["app", "name"], "Jane Doe");
  writeFileSync(join(dir, "smithable.yml"), spec.text);
  const administrator = new YamlEditor(readFileSync(join(dir, "smithable.auth.yml"), "utf8"));
  administrator.set(["admins"], ["a@example.test"]);
  writeFileSync(join(dir, "smithable.auth.yml"), administrator.text);
  const { replaceWebsitePersonalFiles } = await import("./website-generation.js");
  const primary = Object.fromEntries(
    Object.keys(starter).map((file) => [file, readFileSync(join(dir, file), "utf8")]),
  );
  for (const [file, text] of Object.entries(replaceWebsitePersonalFiles(primary, context)))
    writeFileSync(join(dir, file), text);
  const loaded = loadSpec(dir, io);
  if (!loaded.ir || !loaded.auth) throw new Error("fixture spec invalid");
  const { generate } = await import("./generate.js");
  const shell = await import("./io.js");
  const commands: string[] = [];
  const exec = vi.spyOn(shell, "exec").mockImplementation((command, args) => {
    commands.push([command, ...args].join(" "));
    return 0;
  });
  const execQuiet = vi.spyOn(shell, "execQuiet").mockImplementation((command, args) => {
    commands.push([command, ...args].join(" "));
    return 0;
  });
  try {
    expect(await generate(dir, io, { tools: true, force: false, installed: true })).toBe(0);
  } finally {
    exec.mockRestore();
    execQuiet.mockRestore();
  }
  expect(commands.some((command) => command.includes("drizzle-kit"))).toBe(true);
  expect(commands.some((command) => command.includes("tsr"))).toBe(true);
  expect(commands.some((command) => command.includes("install"))).toBe(false);
  expect(() => replaceWebsitePersonalArtifacts(dir, context, true)).not.toThrow();
  const originalSpec = readFileSync(join(dir, "smithable.yml"), "utf8");
  writeFileSync(join(dir, "smithable.yml"), `${originalSpec}# Jane Doe a@example.test\n`);
  expect(() => replaceWebsitePersonalArtifacts(dir, context, true)).toThrow(
    "source contact details",
  );
  expect(readFileSync(join(dir, "smithable.yml"), "utf8")).toContain("# Jane Doe");
  writeFileSync(join(dir, "smithable.yml"), originalSpec);
  const authTarget = join(dir, "src/lib/auth.ts");
  const authSource = readFileSync(authTarget, "utf8");
  expect(authSource).toContain("a@example.test");
  writeFileSync(authTarget, `${authSource}\nexport const publicContact="a@example.test";\n`);
  expect(() => replaceWebsitePersonalArtifacts(dir, context, true)).toThrow(
    "source contact details",
  );
  writeFileSync(authTarget, authSource);
  const target = join(dir, "src/generated/app.ts");
  const original = readFileSync(target, "utf8");
  writeFileSync(target, `${original}\nexport const customerName = "Jane Doe";\n`);
  expect(() => replaceWebsitePersonalArtifacts(dir, context, true)).toThrow(
    "source contact details",
  );
  writeFileSync(target, original);
  mkdirSync(join(dir, "src/custom"), { recursive: true });
  writeFileSync(
    join(dir, "src/custom/page.ts"),
    '// Generated by Smithable from smithable.yml. Do not edit: this file is overwritten on every change.\nexport const person="Jane Doe";',
  );
  expect(() => replaceWebsitePersonalArtifacts(dir, context, true)).toThrow(
    "source contact details",
  );
  writeFileSync(join(dir, "src/custom/page.ts"), "export const value=1;");
  writeFileSync(join(dir, "public/person.html"), "<p>Jane Doe</p>");
  expect(() => replaceWebsitePersonalArtifacts(dir, context, true)).toThrow(
    "source contact details",
  );
}, 30_000);

test("JSON sample records remain valid JSON and all embedded contact actions are inert", async () => {
  const context = await prepareWebsiteContext(
    input('<meta property="og:site_name" content="Jane Doe">'),
    false,
    [],
    () => {},
  );
  const { replaceWebsitePersonalFiles } = await import("./website-generation.js");
  const output = replaceWebsitePersonalFiles(
    {
      "samples/Customer.json": JSON.stringify([
        {
          name: "Jane Doe",
          link: "mailto:a@example.test",
          body: "[Call](tel:+3581812345)",
          ctaUrl: "https://waze.com/?q=Jane%20Doe",
        },
      ]),
    },
    context,
  );
  const source = output["samples/Customer.json"];
  if (!source) throw new Error("fixture sample missing");
  expect(() => JSON.parse(source)).not.toThrow();
  expect(source).not.toMatch(/Jane Doe|mailto:|tel:|waze\.com/);
  expect(JSON.parse(output["smithable.website.json"] ?? "{}").sampleFields.length).toBeGreaterThan(
    0,
  );
});

test("response key collisions fail closed instead of falling back to duplicate JSON keys", async () => {
  const context = await prepareWebsiteContext(
    input('<meta property="og:site_name" content="Jane Doe">'),
    false,
    [],
    () => {},
  );
  const replacement = context.personalMap.entries.find(
    (entry) => entry.original === "Jane Doe",
  )?.replacement;
  if (!replacement) throw new Error("fixture replacement missing");
  const provider: Provider = {
    name: "fixture",
    tier: "local",
    location: "local",
    price: { input: 0, output: 0 },
    complete: async () => ({
      text: JSON.stringify({ "Jane Doe": 1, [replacement]: 2 }),
      model: "fixture",
      inputTokens: 1,
      outputTokens: 1,
    }),
  };
  const { websitePrivateProviders } = await import("./website-generation.js");
  const wrapped = websitePrivateProviders([provider], context.personalMap)[0];
  if (!wrapped) throw new Error("fixture provider missing");
  await expect(
    wrapped.complete({ system: "Return JSON", user: "Return values", schema: {} }),
  ).rejects.toThrow("could not finish");
});

test("public nested build and dist folders cannot hide source identities", async () => {
  const context = await prepareWebsiteContext(
    input('<meta property="og:site_name" content="Jane Doe">'),
    false,
    [],
    () => {},
  );
  const { replaceWebsitePersonalArtifacts } = await import("./website-generation.js");
  for (const folder of ["build", "dist"]) {
    const dir = tempDir("website-public-personal-");
    mkdirSync(join(dir, "public", folder), { recursive: true });
    writeFileSync(join(dir, "public", folder, "person.html"), "<p>Jane Doe</p>");
    expect(() => replaceWebsitePersonalArtifacts(dir, context)).toThrow("source contact details");
  }
});

test("Person-only sample input refuses before optional calls; full sparse portfolios use substantive instructed prose", async () => {
  const { siteBundleResult } = await import("./site-bundle.js");
  const prose =
    "I make handmade objects and share a changing collection of sketches stories notes photographs projects ideas materials experiments workshops and other things from my everyday creative practice.";
  const personal = (rich: boolean) => {
    const html = `<meta property="og:site_name" content="Jane Doe"><script type="application/ld+json">{"@type":"Person","name":"Jane Doe"}</script><p>${prose}</p><img src="/portrait.jpg" alt="Portrait Jane Doe">${rich ? '<a href="tel:+3581812345">Call</a><a href="mailto:a@example.test">Mail</a><a href="/work">Work</a>' : ""}`;
    const bytes = Buffer.byteLength(html);
    const reading = siteBundleResult({
      version: 1,
      startUrl: url,
      pages: [{ id: "person", url, html, bytes, depth: 0, fetchedAt: new Date().toISOString() }],
      crawl: { pages: 1, bytes, elapsedMs: 1, diagnostics: [] },
    });
    return parseWebsiteInput({
      version: 1,
      facts: reading.facts,
      images: reading.images,
      personalMap: reading.personalMap,
      sourceCorpus: reading.sourceCorpus,
      originals: [],
      authorization: { id: "owner", site: url, images: false },
    });
  };
  let calls = 0;
  const provider: Provider = {
    name: "fixture",
    tier: "local",
    location: "local",
    price: { input: 0, output: 0 },
    complete: async () => {
      calls++;
      return { text: '{"interpretations":[]}', model: "fixture", inputTokens: 1, outputTokens: 1 };
    },
  };
  const rich = personal(true);
  await expect(prepareWebsiteContext(rich, true, [provider], () => {})).rejects.toThrow(
    "too little",
  );
  expect(calls).toBe(0);
  const fallback = await prepareWebsiteContext(
    rich,
    false,
    [],
    () => {},
    "Make a community calendar for Jane Doe",
    true,
  );
  expect(fallback.businessName).toBeUndefined();
  expect(fallback.description).not.toContain("Jane Doe");
  for (const source of [rich, personal(false)]) {
    source.options = { contentMode: "full" };
    const full = await prepareWebsiteContext(source, false, [], () => {});
    expect(full.description).toContain(prose);
    expect(full.contentMode).toBe("full");
  }
  const short = personal(false);
  short.options = { contentMode: "full" };
  short.sourceCorpus = {
    version: 1,
    pages: [
      { id: "short", text: "A very short portfolio", sha256: digest("A very short portfolio") },
    ],
  };
  await expect(prepareWebsiteContext(short, false, [], () => {})).rejects.toThrow("too little");
  const ambiguous = personal(false);
  ambiguous.options = { contentMode: "full" };
  ambiguous.facts.ambiguous = true;
  await expect(prepareWebsiteContext(ambiguous, false, [], () => {})).rejects.toThrow("too little");
});

test("escaped invalid repair JSON stays private without changing unrelated string escapes", async () => {
  const context = await prepareWebsiteContext(
    input('<meta property="og:site_name" content="Jane Doe">'),
    false,
    [],
    () => {},
  );
  const raw = String.raw`{"code":"\nJane Doe\ta@example.test","literal":"\\u0041", BROKEN}`;
  let request = "";
  const provider: Provider = {
    name: "fixture",
    tier: "local",
    location: "local",
    price: { input: 0, output: 0 },
    complete: async (value) => {
      request = value.user;
      return { text: raw, model: "fixture", inputTokens: 1, outputTokens: 1 };
    },
  };
  const { websitePrivateProviders } = await import("./website-generation.js");
  const wrapped = websitePrivateProviders([provider], context.personalMap)[0];
  if (!wrapped) throw new Error("fixture provider missing");
  const answer = await wrapped.complete({
    system: "Repair",
    user: `Prior result: ${raw}`,
    schema: {},
    repair: true,
  });
  expect(request).not.toMatch(/Jane Doe|a@example\.test/);
  expect(answer.text).not.toMatch(/Jane Doe|a@example\.test/);
  expect(answer.text).toContain(String.raw`\\u0041`);
});

test("already drafted sample values receive field marks and prose labels keep their words", async () => {
  const context = await prepareWebsiteContext(input(), false, [], () => {});
  const { replaceWebsitePersonalFiles } = await import("./website-generation.js");
  const sample = context.personalMap.entries.find((entry) => entry.kind === "email")?.replacement;
  if (!sample) throw new Error("fixture sample missing");
  const output = replaceWebsitePersonalFiles(
    {
      "smithable.content.yml": JSON.stringify({
        title: "Hotel: open late",
        phoneLabel: "Tel: open late",
        contact: sample,
      }),
    },
    context,
  );
  const metadata = JSON.parse(output["smithable.website.json"] ?? "{}");
  expect(metadata.sampleFields).toContainEqual({
    file: "smithable.content.yml",
    path: ["contact"],
  });
  expect(output["smithable.content.yml"]).toContain("Hotel: open late");
  expect(output["smithable.content.yml"]).toContain("Tel: open late");
});

test("auth and UX source-derived values are sanitized while only explicitly selected admins survive", async () => {
  const context = await prepareWebsiteContext(input(), false, [], () => {});
  const { replaceWebsitePersonalFiles } = await import("./website-generation.js");
  const files = {
    "smithable.auth.yml":
      'admins: [a@example.test]\nroles: {admin: {description: "Call a@example.test"}}\n',
    "smithable.ux.yml": "description: a@example.test\nctaUrl: mailto:a@example.test\n",
  };
  const drafted = replaceWebsitePersonalFiles(files, context);
  expect(JSON.stringify(drafted)).not.toContain("a@example.test");
  context.authoritativeAdmin = "a@example.test";
  const selected = replaceWebsitePersonalFiles(
    { ...files, "smithable.website.json": drafted["smithable.website.json"] ?? "{}" },
    context,
  );
  expect(JSON.parse(selected["smithable.website.json"] ?? "{}").sampleFields).not.toContainEqual({
    file: "smithable.auth.yml",
    path: ["admins", 0],
  });
  const auth = new YamlEditor(selected["smithable.auth.yml"] ?? "").get([]) as {
    admins: string[];
    roles: { admin: { description: string } };
  };
  expect(auth.admins).toEqual(["a@example.test"]);
  expect(auth.roles.admin.description).not.toContain("a@example.test");
  expect(selected["smithable.ux.yml"]).not.toContain("mailto:");
});

test("non-record text in samples cannot bypass final artifact checks", async () => {
  const context = await prepareWebsiteContext(
    input('<meta property="og:site_name" content="Jane Doe">'),
    false,
    [],
    () => {},
  );
  const { replaceWebsitePersonalArtifacts } = await import("./website-generation.js");
  const dir = tempDir("website-sample-text-");
  mkdirSync(join(dir, "samples"));
  writeFileSync(join(dir, "samples", "person.md"), "# Jane Doe\n");
  expect(() => replaceWebsitePersonalArtifacts(dir, context)).toThrow("source contact details");
  expect(readFileSync(join(dir, "samples", "person.md"), "utf8")).toBe("# Jane Doe\n");
});
