import type { Provider } from "@smithable/ai";
import { type SpecIR, YamlEditor } from "@smithable/core";
import { afterEach, expect, test, vi } from "vitest";
import { extractImageContexts } from "./image-context.js";
import { extractSiteFacts } from "./site-facts.js";
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
