import { createHash, createHmac } from "node:crypto";
import { expect, test } from "vitest";
import { extractImageContexts } from "./image-context.js";
import { extractSiteFacts } from "./site-facts.js";
import {
  parseSitePersonalMap,
  projectSitePersonal,
  replaceSitePersonalText,
} from "./site-personal.js";

const key = "a".repeat(64),
  url = "https://alice.example/Alice-Example/contact?email=alice%40private.test";
const html = `<script type="application/ld+json">${JSON.stringify({ "@type": "LocalBusiness", name: "Alice Example", address: { streetAddress: "Harbour Road 12", addressLocality: "Mariehamn", addressCountry: "Finland" }, email: "hello@alice.example", telephone: "+358 40 1234567", employee: { "@type": "Person", name: "Alice Example" }, hasOfferCatalog: { itemListElement: [{ name: "Haircuts" }] } })}</script><h1>Alice Example</h1><p>Owner Alice Example welcomes visitors.</p><a href="mailto:hello@alice.example">Email</a><img src="/Alice-Example.jpg" alt="Alice Example smiling">`;
function input(source = html) {
  const text = "Owner Alice Example welcomes visitors. Call +358 40 1234567 or hello@alice.example";
  return {
    facts: extractSiteFacts(source, url),
    images: extractImageContexts(source, url, "p1"),
    sourceCorpus: {
      version: 1 as const,
      pages: [{ id: "p1", text, sha256: createHash("sha256").update(text).digest("hex") }],
    },
    pages: [{ id: "p1", url, html: source }],
  };
}
test("the sole trader's typed business name remains; contacts and image metadata are replaced locally", () => {
  const result = projectSitePersonal(input(), { personalKey: key });
  expect(result.model.facts.fields.find((f) => f.kind === "name")?.value).toBe("Alice Example");
  expect(
    result.model.facts.fields.some((f) => f.kind === "location" && f.value === "Mariehamn"),
  ).toBe(true);
  const metadata = JSON.stringify({
    ...result.model,
    description: "",
    facts: {
      ...result.model.facts,
      fields: result.model.facts.fields.filter((f) => f.kind !== "name"),
    },
  });
  expect(metadata).not.toContain("Alice Example");
  expect(metadata).not.toContain("hello@alice.example");
  expect(metadata).not.toContain("Harbour Road");
  expect(metadata).not.toContain("alice.example");
  expect(metadata).toContain("example.com");
  expect(metadata).toContain("+999");
  expect(metadata).toContain("Sample Street");
  expect(result.model.images[0]?.src).toMatch(/^https:\/\/source.invalid\/ref\//);
  expect(result.model.personal.counts.name).toBeGreaterThan(0);
  expect(JSON.stringify(result.model.personal)).not.toContain("Alice");
});
test("reprojection preserves private structural detections; append ordinals do not reshuffle prior values", () => {
  const first = projectSitePersonal(input(), { personalKey: key });
  const again = projectSitePersonal(
    { ...input(), pages: undefined },
    { personalMap: first.personalMap },
  );
  expect(again.model).toEqual(first.model);
  expect(again.personalMap).toEqual(first.personalMap);
  const earlier = JSON.stringify(first.personalMap.entries);
  const nextInput = input(`${html}<p>Manager Zara Newperson</p>`);
  const page = nextInput.sourceCorpus.pages[0];
  if (!page) throw new Error("fixture");
  page.text += " Manager Zara Newperson";
  const next = projectSitePersonal(nextInput, { personalMap: first.personalMap });
  expect(JSON.stringify(next.personalMap.entries.slice(0, first.personalMap.entries.length))).toBe(
    earlier,
  );
});
test("format-preserving replacement handles encoded and split identifiers without damaging code or JSON", () => {
  const { personalMap } = projectSitePersonal(input(), { personalKey: key });
  const source =
    'title: Safe\nbody: "Alice Example"\n# keep this comment\ncode: |\n  const x = 2;\n';
  const safe = replaceSitePersonalText(source, personalMap);
  expect(safe).toContain('title: Safe\nbody: "');
  expect(safe).toContain("\n# keep this comment\ncode: |\n  const x = 2;\n");
  expect(safe).not.toContain("Alice Example");
  for (const encoded of [
    "Alice%20Example",
    "Alice&#32;Example",
    "Ａｌｉｃｅ Ｅｘａｍｐｌｅ",
    "Alice\u200b Example",
    "\\u0041lice Example",
  ])
    expect(replaceSitePersonalText(encoded, personalMap)).not.toContain("Example");
  const fields = { first: "Alice", last: "Example" };
  for (const [name, value] of Object.entries(fields))
    fields[name as keyof typeof fields] = replaceSitePersonalText(value, personalMap);
  expect(JSON.stringify(fields)).not.toContain("Alice");
  expect(JSON.stringify(fields)).not.toContain('"Example"');
  expect(replaceSitePersonalText(safe, personalMap)).toBe(safe);
});
test("full mode is explicit and maps are validated, including malformed phone entries", () => {
  const result = projectSitePersonal(input(), { contentMode: "full", personalKey: key });
  expect(result.model.facts).toEqual(input().facts);
  expect(result.model.contentMode).toBe("full");
  const original = "Maria Lindholm",
    id = createHmac("sha256", Buffer.from(key, "hex"))
      .update(`phone\0${original.toLowerCase()}`)
      .digest("hex");
  expect(() =>
    parseSitePersonalMap({
      version: 1,
      key,
      entries: [{ id, kind: "phone", ordinal: 0, original, replacement: "+999 000 000001" }],
      handles: [],
    }),
  ).toThrow("phone");
  expect(() => projectSitePersonal(input(), { personalKey: "not-a-key" })).toThrow("key");
});
test("malformed encoded identifiers fail closed", () => {
  const { personalMap } = projectSitePersonal(input(), { personalKey: key });
  for (const value of ["Alice %E0%A4", "Alice\ud800", "Alice\u0001Example", "Alice &#xD800;"])
    expect(() => replaceSitePersonalText(value, personalMap)).toThrow();
});

test("private URL handles cover diagnostics and encoded source blobs fail closed", () => {
  const { personalMap } = projectSitePersonal(input(), { personalKey: key });
  expect(replaceSitePersonalText(`Failed at ${url}`, personalMap)).not.toContain("alice.example");
  expect(() =>
    replaceSitePersonalText(Buffer.from("Alice Example").toString("base64"), personalMap),
  ).toThrow("Encoded");
  expect(() => replaceSitePersonalText("data:image/png;base64,SECRETBLOB", personalMap)).toThrow(
    "Encoded",
  );
});
test("initial mappings are sorted by keyed identity, and sample-name collisions do not cascade", () => {
  const left = input();
  left.facts.fields.reverse();
  const a = projectSitePersonal(left, { personalKey: key });
  const b = projectSitePersonal(input(), { personalKey: key });
  expect(a.personalMap.entries).toEqual(b.personalMap.entries);
  const collision = input(html.replaceAll("Alice Example", "Elin Sjöberg"));
  const page = collision.sourceCorpus.pages[0];
  if (!page) throw new Error("fixture");
  page.text = "Owner Elin Sjöberg";
  expect(() => projectSitePersonal(collision, { personalKey: key })).toThrow("collides");
});

test("accepted name-only maps still cover split fields and hostile separators stay bounded", () => {
  const original = "Alice Example",
    id = createHmac("sha256", Buffer.from(key, "hex"))
      .update(`name\0${original.toLowerCase()}`)
      .digest("hex");
  const map = parseSitePersonalMap({
    version: 1,
    key,
    entries: [{ id, kind: "name", ordinal: 0, original, replacement: "Elin Sjöberg (sample 1)" }],
    handles: [],
  });
  expect(replaceSitePersonalText("Alice", map)).not.toBe("Alice");
  expect(replaceSitePersonalText("Example", map)).not.toBe("Example");
  const identity = "A - - - - - - B",
    identityId = createHmac("sha256", Buffer.from(key, "hex"))
      .update(`identity\0${identity.toLowerCase()}`)
      .digest("hex");
  const hostile = parseSitePersonalMap({
    version: 1,
    key,
    entries: [
      {
        id: identityId,
        kind: "identity",
        ordinal: 0,
        original: identity,
        replacement: "Sample business 1",
      },
    ],
    handles: [],
  });
  const safe = `A${"-".repeat(20000)}C`;
  expect(replaceSitePersonalText(safe, hostile)).toBe(safe);
});
test("newly exposed escapes are decoded after compatibility and format normalization", () => {
  const { personalMap } = projectSitePersonal(input(), { personalKey: key });
  for (const text of ["％４１lice", "%4\u200b1lice", "%2541lice"]) {
    expect(replaceSitePersonalText(text, personalMap)).not.toBe(text);
  }
});
test("overlapping compatibility-grapheme ranges are replaced once; excessive replacements refuse", () => {
  const source = input(
    html +
      '<script type="application/ld+json">{"@type":"Person","name":"الله"}</script><script type="application/ld+json">{"@type":"Person","name":"وسلم"}</script>',
  );
  const { personalMap } = projectSitePersonal(source, { personalKey: key });
  expect(replaceSitePersonalText("Before ﷺ after", personalMap)).toBe("Before Sample text after");
  expect(() => replaceSitePersonalText("Alice ".repeat(12000), personalMap)).toThrow("Too many");
});

test("ambiguous source values colliding with another sample contact refuse", () => {
  const value = input(html.replaceAll("hello@alice.example", "sample-1@example.com"));
  expect(() => projectSitePersonal(value, { personalKey: key })).toThrow("collides");
});

test("literal JSON whitespace escapes share identifier/search normalization and data-URI near misses are bounded", () => {
  const original = "Alice\\nExample",
    normalized = "alice example",
    id = createHmac("sha256", Buffer.from(key, "hex")).update(`name\0${normalized}`).digest("hex");
  const map = parseSitePersonalMap({
    version: 1,
    key,
    entries: [{ id, kind: "name", ordinal: 0, original, replacement: "Elin Sjöberg (sample 1)" }],
    handles: [],
  });
  expect(replaceSitePersonalText(original, map)).not.toBe(original);
  expect(replaceSitePersonalText("Alice Example", map)).not.toBe("Alice Example");
  const near = `data:${"a".repeat(100000)};base64X`;
  expect(replaceSitePersonalText(near, map)).toBe(near);
});
test("cross-swapped sample contacts in a correctly keyed private map refuse", () => {
  const entries = ["sample-2@example.com", "sample-1@example.com"].map((original, ordinal) => ({
    kind: "email",
    ordinal,
    original,
    replacement: `sample-${ordinal + 1}@example.com`,
    id: createHmac("sha256", Buffer.from(key, "hex")).update(`email\0${original}`).digest("hex"),
  }));
  expect(() => parseSitePersonalMap({ version: 1, key, entries, handles: [] })).toThrow("collides");
});

test("percent signs, escaped delimiters, dates and hours preserve unrelated presentation", () => {
  const { personalMap } = projectSitePersonal(input(), { personalKey: key });
  const mixed = "100% natural %20 Alice";
  expect(replaceSitePersonalText(mixed, personalMap)).toContain("100% natural %20");
  const json = String.raw`{"message":"\u0022\u0041lice Example\u0022","number":1}`;
  const safe = replaceSitePersonalText(json, personalMap);
  expect(JSON.parse(safe).number).toBe(1);
  expect(JSON.parse(safe).message).toMatch(/^".*"$/);
  expect(safe).not.toContain("lice Example");
  const source = input();
  source.sourceCorpus.pages.push({
    id: "hours",
    text: "09.00 - 17.00 and 05.11.2026",
    sha256: "fixture",
  });
  const projected = projectSitePersonal(source, { personalKey: key });
  expect(
    projected.personalMap.entries.some(
      (entry) => entry.kind === "phone" && entry.original.includes("09.00"),
    ),
  ).toBe(false);
});
test("URLs in free metadata stay opaque and reprojection does not create handles for handles", () => {
  const source = input();
  source.facts.fields.push({
    kind: "service",
    basis: "observed",
    value: url,
    evidence: { page: url, element: "p", text: url },
  });
  const first = projectSitePersonal(source, { personalKey: key }),
    second = projectSitePersonal(
      { ...source, pages: undefined },
      { personalMap: first.personalMap },
    );
  expect(second.model).toEqual(first.model);
  expect(second.personalMap).toEqual(first.personalMap);
  expect(
    first.personalMap.handles.some((handle) =>
      handle.original.startsWith("https://source.invalid/"),
    ),
  ).toBe(false);
});
test("empty structural contacts and labelled microdata telephones are handled without inventing identifiers", () => {
  const source = input(
    html +
      '<script type="application/ld+json">{"@type":"Person","name":"Zara Newperson","telephone":"","email":"","postalCode":""}</script><a itemprop="telephone" href="tel:+358401234568">Call +358 40 1234568</a>',
  );
  const projected = projectSitePersonal(source, { personalKey: key });
  expect(
    projected.personalMap.entries.some(
      (entry) => entry.original.replace(/\D/g, "") === "358401234568",
    ),
  ).toBe(true);
});
test("Person-only source reports insufficient through the fresh reader and installed-input parser; full mode remains explicit", async () => {
  const { siteBundleResult } = await import("./site-bundle.js"),
    { parseWebsiteInput } = await import("./website-input.js");
  const address = "https://business.example/",
    source =
      '<meta property="og:site_name" content="Alice Example"><script type="application/ld+json">{"@type":"Person","name":"Alice Example"}</script><nav><a href="/about">About</a><a href="/work">Work</a></nav><a href="mailto:alice@example.test">Email</a><a href="tel:+358401234567">Call</a>';
  const bundle = {
    version: 1 as const,
    startUrl: address,
    pages: [
      {
        id: "p1",
        url: address,
        html: source,
        bytes: Buffer.byteLength(source),
        fetchedAt: "2026-11-05T00:00:00Z",
        depth: 0,
      },
    ],
    crawl: { pages: 1, bytes: Buffer.byteLength(source), elapsedMs: 1, diagnostics: [] },
  };
  const reading = siteBundleResult(bundle, { personalKey: key });
  expect(reading.tooLittle).toBe(true);
  expect(reading.model.facts.fields.some((fact) => fact.kind === "name")).toBe(false);
  const parsed = parseWebsiteInput({
    version: 1,
    facts: reading.facts,
    images: reading.images,
    sourceCorpus: reading.sourceCorpus,
    model: reading.model,
    personalMap: reading.personalMap,
    originals: [],
    authorization: { id: "auth", site: address, images: false },
  });
  expect(parsed.model?.facts.ambiguous).toBe(true);
  expect(parsed.model).toEqual(reading.model);
  const full = siteBundleResult(bundle, { contentMode: "full", personalKey: key });
  expect(full.tooLittle).toBe(false);
  expect(
    full.model.facts.fields.some((fact) => fact.kind === "name" && fact.value === "Alice Example"),
  ).toBe(true);
});

test("raw repair, fenced, invalid and nested JSON escapes do not hide known identifiers", () => {
  const { personalMap } = projectSitePersonal(input(), { personalKey: key });
  for (const boundary of [
    String.raw`\n`,
    String.raw`\t`,
    String.raw`\r`,
    String.raw`\\n`,
    String.raw`\u000a`,
  ]) {
    const text = `repair failed: ${boundary}Alice Example`;
    const safe = replaceSitePersonalText(text, personalMap);
    expect(safe).not.toContain("Alice Example");
    expect(safe).toContain(boundary);
  }
  for (const text of [
    String.raw`{"repair":"\\u0041lice Example"}`,
    String.raw`{"repair":"\\u0041\\u006c\\u0069\\u0063\\u0065 Example"}`,
  ]) {
    const safe = replaceSitePersonalText(text, personalMap);
    expect(() => JSON.parse(safe)).not.toThrow();
    expect(JSON.parse(safe).repair).not.toContain("Example");
  }
  const invalid = '```json\n{not-json: "\\nAlice Example"}\n```';
  expect(replaceSitePersonalText(invalid, personalMap)).not.toContain("Alice Example");
});

test("a known full starter name cannot return inside a labelled stand-in", () => {
  const source = input(
    `${html}<script type="application/ld+json">{"@type":"Person","name":"Elin Sjöberg"}</script>`,
  );
  expect(() => projectSitePersonal(source, { personalKey: key })).toThrow("collides");
});

test("an unfetched subpage on a known private source host is opaque in repair text", () => {
  const { personalMap } = projectSitePersonal(input(), { personalKey: key });
  expect(
    replaceSitePersonalText("Repair https://alice.example/private-unread-path failed", personalMap),
  ).toBe("Repair https://source.invalid/omitted failed");
});

test("private known-URL prefixes cannot leave a suffix and long opaque handles remain intact", () => {
  const { personalMap } = projectSitePersonal(input(), { personalKey: key });
  const raw = `${url}/private-secret-id`;
  expect(replaceSitePersonalText(raw, personalMap)).toBe("https://source.invalid/omitted");
  expect(replaceSitePersonalText(encodeURIComponent(raw), personalMap)).toBe(
    "https://source.invalid/omitted",
  );
  const original = "123",
    id = createHmac("sha256", Buffer.from(key, "hex")).update(`phone\0${original}`).digest("hex");
  const handles = Array.from({ length: 123 }, (_, index) => {
    const original = `https://private.example/image-${index}`;
    return {
      original,
      id: createHmac("sha256", Buffer.from(key, "hex")).update(`url\0${original}`).digest("hex"),
      handle: `https://source.invalid/ref/${index + 1}`,
    };
  });
  const map = parseSitePersonalMap({
    version: 1,
    key,
    entries: [{ id, kind: "phone", original, ordinal: 0, replacement: "+999 000 000001" }],
    handles,
  });
  expect(replaceSitePersonalText("https://source.invalid/ref/123", map)).toBe(
    "https://source.invalid/ref/123",
  );
});

test("legacy semicolonless HTML references share browser decoding and structural phone labels skip", () => {
  const original = "José Café",
    id = createHmac("sha256", Buffer.from(key, "hex"))
      .update(`name\0${original.toLowerCase()}`)
      .digest("hex");
  const map = parseSitePersonalMap({
    version: 1,
    key,
    entries: [{ id, kind: "name", ordinal: 0, original, replacement: "Elin Sjöberg (sample 1)" }],
    handles: [],
  });
  for (const text of ["Jos&eacute Caf&eacute", "Jos&#233 Caf&#233", "Jos&eacute; Caf&eacute;"])
    expect(replaceSitePersonalText(text, map)).toBe("Elin Sjöberg (sample 1)");
  const source = input(
    `${html}<script type="application/ld+json">{"@type":"Person","telephone":"see contact page"}</script><span itemprop="telephone">Call us</span>`,
  );
  expect(() => projectSitePersonal(source, { personalKey: key })).not.toThrow();
});
