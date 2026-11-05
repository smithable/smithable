import type { Provider } from "@smithable/ai";
import { YamlEditor } from "@smithable/core";
import { expect, test } from "vitest";
import { extractSiteFacts } from "./site-facts.js";
import { projectSitePersonal } from "./site-personal.js";
import {
  NEUTRAL_WEBSITE_TEXT,
  repairWebsiteCopy,
  repeatsWebsiteWords,
  sourcePhrases,
} from "./website-copy.js";
import { prepareWebsiteContext, websitePrivateProviders } from "./website-generation.js";
import { digest, parseWebsiteInput } from "./website-input.js";

const source = "These ten very familiar words are copied from our website.";
const corpus = { version: 1 as const, pages: [{ id: "p1", text: source, sha256: digest(source) }] };

test("ten words match Unicode normalization, case and punctuation; nine do not", () => {
  const phrases = sourcePhrases(corpus);
  expect(
    repeatsWebsiteWords("THESE, ten very familiar words are copied—from our website!", phrases),
  ).toBe(true);
  expect(repeatsWebsiteWords("These ten very familiar words are copied from our", phrases)).toBe(
    false,
  );
  const unicode = sourcePhrases({
    version: 1,
    pages: [{ id: "p", text: "Ａ Ｂ c d e f g h i j", sha256: "x" }],
  });
  expect(repeatsWebsiteWords("a b C d e f g h i j", unicode)).toBe(true);
});

test("only offending visible leaves are regenerated once, with facts and paths but no source prose", async () => {
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
      return {
        text: JSON.stringify({ "0": source, "1": "Contact us to learn more." }),
        model: "fixture",
        inputTokens: 1,
        outputTokens: 1,
      };
    },
  };
  const files = {
    "smithable.content.yml": `smithableContent: 0.1\nlanguage: en\npages:\n  home:\n    hero:\n      title: Safe title\n      text: ${JSON.stringify(source)}\n      image: { src: images/originals/x.jpg, alt: ${JSON.stringify(source)} }\n`,
    "samples/Item.yml": `- { id: 1, name: Safe, price: 12.5, active: true }\n`,
  };
  const fixed = await repairWebsiteCopy(files, corpus, "Facts: phone +3581812345", [provider]);
  expect(calls).toBe(1);
  expect(prompt).not.toContain(source);
  expect(prompt).toContain("hero");
  const content = new YamlEditor(fixed["smithable.content.yml"] ?? "").get([]) as typeof Object;
  expect(JSON.stringify(content)).toContain(NEUTRAL_WEBSITE_TEXT);
  expect(fixed["samples/Item.yml"]).toBe(files["samples/Item.yml"]);
  expect(JSON.stringify(content)).toContain("images/originals/x.jpg");
  expect(JSON.stringify(content)).toContain("Contact us to learn more.");
});

test("sample text repair preserves JSON/YAML numbers, booleans and record keys", async () => {
  const files = {
    "samples/Item.yml": `- id: 7\n  name: ${JSON.stringify(source)}\n  amount: 29.5\n  available: true\n`,
  };
  const fixed = await repairWebsiteCopy(files, corpus, "Facts only", []);
  const rows = new YamlEditor(fixed["samples/Item.yml"] ?? "").get([]) as {
    id: number;
    name: string;
    amount: number;
    available: boolean;
  }[];
  expect(rows).toEqual([{ id: 7, name: NEUTRAL_WEBSITE_TEXT, amount: 29.5, available: true }]);
});

test("sample fields named type and format are visible text, not content routing keys", async () => {
  const fixed = await repairWebsiteCopy(
    { "samples/Item.json": JSON.stringify([{ type: source, format: source, id: 4 }]) },
    corpus,
    "Facts",
    [],
  );
  expect(JSON.parse(fixed["samples/Item.json"] ?? "")).toEqual([
    { type: NEUTRAL_WEBSITE_TEXT, format: NEUTRAL_WEBSITE_TEXT, id: 4 },
  ]);
});

test("adjacent text leaves, regional locales and visible spec labels are checked", async () => {
  const files = {
    "smithable.content.en-US.yml": JSON.stringify({
      pages: {
        home: {
          hero: { title: "These ten very familiar words", text: "are copied from our website." },
        },
      },
    }),
    "smithable.yml": JSON.stringify({
      app: { name: source },
      models: { Item: { fields: { type: "string!" } } },
    }),
  };
  const repaired = await repairWebsiteCopy(files, corpus, "Facts", []);
  expect(repaired["smithable.content.en-US.yml"]).not.toContain("These ten");
  expect(repaired["smithable.yml"]).toContain("string!");
  expect(repaired["smithable.yml"]).not.toContain(source);
});

test("presentation order is independent of serialized key order and neutral fallback cannot repeat", async () => {
  const files = {
    "smithable.content.yml": JSON.stringify({
      pages: {
        where: {
          hero: { text: "are copied from our website.", title: "These ten very familiar words" },
        },
      },
    }),
  };
  const repaired = await repairWebsiteCopy(files, corpus, "Facts", []);
  expect(repaired["smithable.content.yml"]).not.toContain("These ten");
  const repeated =
    "Please contact the business for details Please contact the business for details";
  const fallback = await repairWebsiteCopy(
    { "smithable.content.yml": JSON.stringify({ title: repeated, text: repeated }) },
    { version: 1, pages: [{ id: "p", text: repeated, sha256: digest(repeated) }] },
    "Facts",
    [],
  );
  expect(fallback["smithable.content.yml"]).not.toContain(NEUTRAL_WEBSITE_TEXT);
});

test("a source sentence split over three reordered presentation fields is refused", async () => {
  const files = {
    "smithable.content.yml": JSON.stringify({
      text: "from our website.",
      subtitle: "words are copied",
      title: "These ten very familiar",
    }),
  };
  const repaired = await repairWebsiteCopy(files, corpus, "Facts", []);
  expect(repaired["smithable.content.yml"]).not.toContain("These ten very familiar");
});

test("the real copy-repair request and returned text stay inside the personal-data boundary", async () => {
  const value = {
    version: 1 as const,
    facts: extractSiteFacts(
      '<meta property="og:site_name" content="Jane Doe"><script type="application/ld+json">{"@type":"LocalBusiness","name":"Jane Doe","url":"https://business.example/","telephone":"+3581812345","email":"a@example.test"}</script><a href="tel:+3581812345">Call</a><a href="mailto:a@example.test">Email</a>',
      "https://business.example/",
    ),
    images: [],
    originals: [],
    sourceCorpus: corpus,
    authorization: { id: "auth", site: "https://business.example/", images: false },
  };
  const personalMap = projectSitePersonal({
    ...value,
    pages: [
      {
        id: "p1",
        url: "https://business.example/",
        html: '<meta property="og:site_name" content="Jane Doe"><script type="application/ld+json">{"@type":"LocalBusiness","name":"Jane Doe","url":"https://business.example/","telephone":"+3581812345","email":"a@example.test"}</script><a href="tel:+3581812345">Call</a><a href="mailto:a@example.test">Email</a>',
      },
    ],
  }).personalMap;
  const input = parseWebsiteInput({ ...value, personalMap });
  const context = await prepareWebsiteContext(input, false, [], () => {});
  let prompt = "";
  const provider: Provider = {
    name: "fixture",
    tier: "local",
    location: "local",
    price: { input: 0, output: 0 },
    complete: async (request) => {
      prompt = JSON.stringify(request);
      return {
        text: JSON.stringify({ "0": "Contact Jane Doe at a@example.test." }),
        model: "fixture",
        inputTokens: 1,
        outputTokens: 1,
      };
    },
  };
  const output = await repairWebsiteCopy(
    { "smithable.content.yml": JSON.stringify({ pages: { "Jane Doe": { body: source } } }) },
    corpus,
    "Call Jane Doe at a@example.test.",
    websitePrivateProviders([provider], context.personalMap),
  );
  expect(prompt).not.toContain("Jane Doe");
  expect(prompt).not.toContain("a@example.test");
  expect(prompt).not.toContain(source);
  expect(output["smithable.content.yml"]).not.toContain("a@example.test");
  expect(output["smithable.content.yml"]).not.toContain("Contact Jane Doe");
});

test("copy repair changes only matched YAML leaves and preserves comments and untouched formatting", async () => {
  const original = `# Owner's content\npages:\n  home:\n    hero:\n      subtitle: ${source} # keep the note\n      title: "A useful title"\n`;
  const output = await repairWebsiteCopy(
    { "smithable.content.yml": original },
    corpus,
    "Facts",
    [],
  );
  const repaired = output["smithable.content.yml"] ?? "";
  expect(repaired).toContain("# Owner's content\npages:\n  home:\n    hero:\n");
  expect(repaired).toContain("# keep the note");
  expect(repaired).toContain('title: "A useful title"');
  expect(repaired).not.toContain(source);
  const clean = '# Keep this comment\npages:\n  home: {title: "Fresh words"}\n';
  expect(
    (await repairWebsiteCopy({ "smithable.content.yml": clean }, corpus, "Facts", []))[
      "smithable.content.yml"
    ],
  ).toBe(clean);
  expect((await repairWebsiteCopy(output, corpus, "Facts", []))["smithable.content.yml"]).toBe(
    repaired,
  );
});
