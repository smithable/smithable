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
  url = "https://alice.example/Alice-Lindholm/contact?email=alice%40private.test";
const html = `<script type="application/ld+json">${JSON.stringify({ "@type": "LocalBusiness", name: "Harbour Workshop", address: { streetAddress: "Harbour Road 12", addressLocality: "Mariehamn", addressCountry: "Finland" }, email: "hello@alice.example", telephone: "+358 40 1234567", employee: { "@type": "Person", name: "Alice Lindholm" }, hasOfferCatalog: { itemListElement: [{ name: "Haircuts" }] } })}</script><h1>Harbour Workshop</h1><p>Owner Alice Lindholm welcomes visitors.</p><a href="mailto:hello@alice.example">Email</a><img src="/Alice-Lindholm.jpg" alt="Alice Lindholm smiling">`;
function input(source = html) {
  const text =
    "Owner Alice Lindholm welcomes visitors. Call +358 40 1234567 or hello@alice.example";
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
test("the typed business name remains; contacts and image metadata are replaced locally", () => {
  const result = projectSitePersonal(input(), { personalKey: key });
  expect(result.model.facts.fields.find((f) => f.kind === "name")?.value).toBe("Harbour Workshop");
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
  expect(metadata).not.toContain("Alice Lindholm");
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
    'title: Safe\nbody: "Alice Lindholm"\n# keep this comment\ncode: |\n  const x = 2;\n';
  const safe = replaceSitePersonalText(source, personalMap);
  expect(safe).toContain('title: Safe\nbody: "');
  expect(safe).toContain("\n# keep this comment\ncode: |\n  const x = 2;\n");
  expect(safe).not.toContain("Alice Lindholm");
  for (const encoded of [
    "Alice%20Lindholm",
    "Alice&#32;Lindholm",
    "Ａｌｉｃｅ Ｌｉｎｄｈｏｌｍ",
    "Alice\u200b Lindholm",
    "\\u0041lice Lindholm",
  ])
    expect(replaceSitePersonalText(encoded, personalMap)).not.toContain("Lindholm");
  const fields = { first: "Alice", last: "Lindholm" };
  for (const [name, value] of Object.entries(fields))
    fields[name as keyof typeof fields] = replaceSitePersonalText(value, personalMap);
  expect(JSON.stringify(fields)).not.toContain("Alice");
  expect(JSON.stringify(fields)).not.toContain('"Lindholm"');
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
  for (const value of ["Alice\ud800", "Alice\u0001Lindholm", "Alice &#xD800;"])
    expect(() => replaceSitePersonalText(value, personalMap)).toThrow();
});

test("private URL handles cover diagnostics and encoded source blobs fail closed", () => {
  const { personalMap } = projectSitePersonal(input(), { personalKey: key });
  expect(replaceSitePersonalText(`Failed at ${url}`, personalMap)).not.toContain("alice.example");
  expect(() =>
    replaceSitePersonalText(Buffer.from("Alice Lindholm").toString("base64"), personalMap),
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
  const collision = input(html.replaceAll("Alice Lindholm", "Elin Sjöberg"));
  const page = collision.sourceCorpus.pages[0];
  if (!page) throw new Error("fixture");
  page.text = "Owner Elin Sjöberg";
  const collisionRead = projectSitePersonal(collision, { personalKey: key });
  expect(collisionRead.model.description).not.toContain("Elin Sjöberg");
});

test("accepted name-only maps still cover split fields and hostile separators stay bounded", () => {
  const original = "Alice Lindholm",
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
  expect(replaceSitePersonalText("Lindholm", map)).not.toBe("Lindholm");
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
  const safe = replaceSitePersonalText("Before ﷺ after", personalMap);
  expect(safe).toMatch(/^Before .* after$/);
  expect(safe).not.toContain("Sample text");
  expect(safe).not.toContain("ﷺ");
  expect(() => replaceSitePersonalText("Alice ".repeat(12000), personalMap)).toThrow("Too many");
});

test("ambiguous source values colliding with another sample contact refuse", () => {
  const value = input(html.replaceAll("hello@alice.example", "sample-1@example.com"));
  const safe = projectSitePersonal(value, { personalKey: key });
  expect(safe.model.facts.fields.find((fact) => fact.kind === "email")?.value).not.toBe(
    "sample-1@example.com",
  );
});

test("literal JSON whitespace escapes share identifier/search normalization and data-URI near misses are bounded", () => {
  const original = "Alice\\nLindholm",
    normalized = "alice lindholm",
    id = createHmac("sha256", Buffer.from(key, "hex")).update(`name\0${normalized}`).digest("hex");
  const map = parseSitePersonalMap({
    version: 1,
    key,
    entries: [{ id, kind: "name", ordinal: 0, original, replacement: "Elin Sjöberg (sample 1)" }],
    handles: [],
  });
  expect(replaceSitePersonalText(original, map)).not.toBe(original);
  expect(replaceSitePersonalText("Alice Lindholm", map)).not.toBe("Alice Lindholm");
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
  const safe = parseSitePersonalMap({ version: 1, key, entries, handles: [] });
  expect(
    safe.entries.every((entry) => !entries.some((source) => source.original === entry.replacement)),
  ).toBe(true);
});

test("percent signs, escaped delimiters, dates and hours preserve unrelated presentation", () => {
  const { personalMap } = projectSitePersonal(input(), { personalKey: key });
  const mixed = "100% natural %20 Alice";
  expect(replaceSitePersonalText(mixed, personalMap)).toContain("100% natural %20");
  const json = String.raw`{"message":"\u0022\u0041lice Lindholm\u0022","number":1}`;
  const safe = replaceSitePersonalText(json, personalMap);
  expect(JSON.parse(safe).number).toBe(1);
  expect(JSON.parse(safe).message).toMatch(/^".*"$/);
  expect(safe).not.toContain("lice Lindholm");
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
      '<meta property="og:site_name" content="Alice Lindholm"><script type="application/ld+json">{"@type":"Person","name":"Alice Lindholm"}</script><nav><a href="/about">About</a><a href="/work">Work</a></nav><a href="mailto:alice@example.test">Email</a><a href="tel:+358401234567">Call</a>';
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
    full.model.facts.fields.some((fact) => fact.kind === "name" && fact.value === "Alice Lindholm"),
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
    const text = `repair failed: ${boundary}Alice Lindholm`;
    const safe = replaceSitePersonalText(text, personalMap);
    expect(safe).not.toContain("Alice Lindholm");
    expect(safe).toContain(boundary);
  }
  for (const text of [
    String.raw`{"repair":"\\u0041lice Lindholm"}`,
    String.raw`{"repair":"\\u0041\\u006c\\u0069\\u0063\\u0065 Lindholm"}`,
  ]) {
    const safe = replaceSitePersonalText(text, personalMap);
    expect(() => JSON.parse(safe)).not.toThrow();
    expect(JSON.parse(safe).repair).not.toContain("Lindholm");
  }
  const invalid = '```json\n{not-json: "\\nAlice Lindholm"}\n```';
  expect(replaceSitePersonalText(invalid, personalMap)).not.toContain("Alice Lindholm");
});

test("a known full starter name cannot return inside a labelled stand-in", () => {
  const source = input(
    `${html}<script type="application/ld+json">{"@type":"Person","name":"Elin Sjöberg"}</script>`,
  );
  const safe = projectSitePersonal(source, { personalKey: key });
  expect(safe.model.description).not.toContain("Elin Sjöberg");
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

test("Nordic compounds, abbreviated streets and separator-grouped phones are detected, not ordinary hours and prices", () => {
  const source = input(
    `${html}<p>Storgatan 12; Mannerheimintie 5; Hamngatan 3B; Main St. 9; 12 Oak Rd.; Pine Ave. 7</p><p>Call (555) 234-5678 or 555-234-5678 or 18 12345.</p>`,
  );
  const corpusPage = source.sourceCorpus.pages[0];
  if (!corpusPage) throw new Error("fixture");
  corpusPage.text =
    "Storgatan 12; Mannerheimintie 5; Hamngatan 3B; Main St. 9; 12 Oak Rd.; Pine Ave. 7. Phones (555) 234-5678 and 555-234-5678 and 18 12345. Open 0900-1700 and 09:00-17:00 and 09.00-17.00; dates 2026-11-05 and 05-11-2026; price 1 234 567.";
  const reading = projectSitePersonal(source, { personalKey: key });
  for (const text of [
    "Storgatan 12",
    "Mannerheimintie 5",
    "Hamngatan 3B",
    "Main St. 9",
    "12 Oak Rd.",
    "Pine Ave. 7",
    "(555) 234-5678",
    "555-234-5678",
    "18 12345",
  ])
    expect(replaceSitePersonalText(text, reading.personalMap)).not.toBe(text);
  for (const text of [
    "0900-1700",
    "09:00-17:00",
    "09.00-17.00",
    "2026-11-05",
    "05-11-2026",
    "1 234 567",
    "100%beef %E9 %41lice",
  ]) {
    expect(() => replaceSitePersonalText(text, reading.personalMap)).not.toThrow();
    if (!text.includes("%")) expect(replaceSitePersonalText(text, reading.personalMap)).toBe(text);
  }
});
function mapped(names: string[], phones: string[] = []) {
  const counters = new Map<string, number>();
  return parseSitePersonalMap({
    version: 1,
    key,
    entries: [
      ...names.map((original) => ({ kind: "name", original })),
      ...phones.map((original) => ({ kind: "phone", original })),
    ].map(({ kind, original }) => {
      const ordinal = counters.get(kind) ?? 0;
      counters.set(kind, ordinal + 1);
      return {
        kind,
        original,
        ordinal,
        id: createHmac("sha256", Buffer.from(key, "hex"))
          .update(`${kind}\0${original.toLowerCase()}`)
          .digest("hex"),
        replacement:
          kind === "name"
            ? `${["Elin Sjöberg", "Omar Haddad", "Emma Lindqvist", "Oskar Berg", "Aino Virtanen", "Nils Ek"][ordinal % 6]} (sample ${ordinal + 1})`
            : `+999 000 ${String(ordinal + 1).padStart(6, "0")}`,
      };
    }),
    handles: [],
  });
}
test("explicit fragments and first ordinals win on shared names and phone aliases across reuse", () => {
  const original = mapped(["Anna Lind", "Anna Berg", "Anna"], ["+46 8 123", "468-123"]);
  const anna = replaceSitePersonalText("Anna", original);
  expect(anna).toBe(original.entries.find((entry) => entry.original === "Anna")?.replacement);
  const firstPhone = original.entries.find((entry) => entry.kind === "phone")?.replacement;
  expect(replaceSitePersonalText("468-123", original)).toBe(firstPhone);
  const appended = mapped(
    ["Anna Lind", "Anna Berg", "Anna", "Anna Stone"],
    ["+46 8 123", "468-123", "46 8123"],
  );
  expect(replaceSitePersonalText("Anna", appended)).toBe(anna);
  expect(replaceSitePersonalText("46 8123", appended)).toBe(firstPhone);
  const derived = mapped(["Anna Lind", "Anna Berg"]);
  expect(replaceSitePersonalText("Anna", derived)).toBe(derived.entries[0]?.replacement);
});
test("single ordinary-name words are safe and code/keys never match name fragments; identity is never split", () => {
  const map = mapped(["Anna Page", "Will Smith", "Rose Hill", "Elin Andersson"]);
  const code = "const page = user.name; // will rose hill Page Will Smith";
  expect(
    replaceSitePersonalText("page, will, rose, hill, Page, Will, Rose Hill", map, {
      context: "key",
    }),
  ).toContain("page, will, rose, hill, Page, Will");
  expect(
    replaceSitePersonalText("page, will, rose, hill, Page, Will", map, { context: "code" }),
  ).toBe("page, will, rose, hill, Page, Will");
  expect(replaceSitePersonalText(code, map, { context: "code" })).not.toContain("Will Smith");
  expect(replaceSitePersonalText("Elin", map, { context: "text" })).not.toBe("Elin");
  expect(replaceSitePersonalText("elin", map, { context: "text" })).toBe("elin");
  expect(replaceSitePersonalText("Elin", map, { context: "code" })).toBe("Elin");
  const business = input(html.replaceAll("Harbour Workshop", "Harbour Workshop"));
  const result = projectSitePersonal(business, { personalKey: key });
  expect(
    result.personalMap.entries.some(
      (entry) => entry.kind === "name" && ["Harbour", "Workshop"].includes(entry.original),
    ),
  ).toBe(false);
});
test("fresh collisions choose free samples, appended collisions change only unsafe choices, and unprotected samples stay inert to replacement", () => {
  const first = projectSitePersonal(input(), { personalKey: key }),
    name = first.personalMap.entries.find((entry) => entry.kind === "name");
  if (!name) throw new Error("fixture");
  const token = name.replacement.split(" ")[0] ?? "Elin";
  const next = projectSitePersonal(
    input(
      `${html}<script type="application/ld+json">${JSON.stringify({ "@type": "Person", name: `${token} Newperson` })}</script>`,
    ),
    { personalMap: first.personalMap },
  );
  for (const before of first.personalMap.entries) {
    const after = next.personalMap.entries.find((entry) => entry.id === before.id);
    expect(after?.ordinal).toBe(before.ordinal);
    if (new RegExp(`\\b${token}\\b`, "iu").test(before.replacement))
      expect(after?.replacement).not.toBe(before.replacement);
    else expect(after?.replacement).toBe(before.replacement);
  }
  for (const entry of next.personalMap.entries)
    expect(
      replaceSitePersonalText(entry.replacement, next.personalMap, { preserveSamples: false }),
    ).toBe(entry.replacement);
  expect(
    projectSitePersonal({ ...input(), pages: undefined }, { personalMap: first.personalMap })
      .personalMap,
  ).toEqual(first.personalMap);
  for (const kind of ["address", "phone", "email"] as const) {
    const original =
      kind === "address"
        ? "Sample Street 1"
        : kind === "phone"
          ? "+999000000001"
          : "sample-1@example.com";
    const source = input();
    source.facts.fields.push({
      kind,
      value: original,
      basis: "observed",
      evidence: { page: url, element: "contact", text: original },
    });
    const projected = projectSitePersonal(source, { personalKey: key });
    for (const entry of projected.personalMap.entries)
      expect(
        replaceSitePersonalText(entry.replacement, projected.personalMap, {
          preserveSamples: false,
        }),
      ).toBe(entry.replacement);
  }
});
test("query-form plus spaces are normalized only in query values, URL closers and exact/full URL boundaries survive", () => {
  const source = input();
  source.facts.fields.push({
    kind: "address",
    value: "Storgatan 12.",
    basis: "observed",
    evidence: { page: url, element: "address", text: "Storgatan 12." },
  });
  const reading = projectSitePersonal(source, { personalKey: key });
  expect(replaceSitePersonalText("Storgatan 12.Details", reading.personalMap)).not.toContain(
    "Storgatan",
  );
  const address = mapped(["Anna Lind"]);
  expect(replaceSitePersonalText("?name=Anna+Lind", address)).not.toContain("Anna");
  expect(replaceSitePersonalText("C++ and +358 50 111", address)).toBe("C++ and +358 50 111");
  const raw = reading.personalMap.handles.find((handle) => handle.original === url);
  if (!raw) throw new Error("fixture");
  expect(replaceSitePersonalText(`[x](${url})`, reading.personalMap)).toBe(`[x](${raw.handle})`);
  expect(replaceSitePersonalText(`[x](${url}/private)`, reading.personalMap)).toBe(
    "[x](https://source.invalid/omitted)",
  );
});
test("unstructured person-shaped titles cannot acquire the business-name exception, unlike business words or structured organizations", () => {
  for (const name of ["Jane Doe", "Anna Marie Lind"]) {
    const source = input(
      `<meta property="og:site_name" content="${name}"><a href="/services">Services</a><a href="mailto:a@example.test">Email</a>`,
    );
    expect(projectSitePersonal(source, { personalKey: key }).model.facts.ambiguous).toBe(true);
    expect(
      projectSitePersonal(source, {
        contentMode: "full",
        personalKey: key,
      }).model.facts.fields.some((fact) => fact.kind === "name" && fact.value === name),
    ).toBe(true);
  }
  const business = input(
    '<meta property="og:site_name" content="Anna Lind Photography"><a href="/services">Services</a><a href="mailto:a@example.test">Email</a>',
  );
  expect(projectSitePersonal(business, { personalKey: key }).model.facts.ambiguous).not.toBe(true);
});

test("derived lowercase image subjects never reintroduce detected person-name fragments", () => {
  const reading = projectSitePersonal(input(), { personalKey: key });
  const subjects = reading.model.images.flatMap((image) => image.subject).join(" ");
  expect(subjects).not.toMatch(/alice|lindholm/iu);
});

test("hostile bad percent scalars preserve ordinary text and do not manufacture forbidden controls", () => {
  const { personalMap } = projectSitePersonal(input(), { personalKey: key });
  for (const text of ["100%beef", "%FF%41", "%FF%00", "%00", "%7f", "%E9%41lice"]) {
    expect(() => replaceSitePersonalText(text, personalMap)).not.toThrow();
  }
  expect(() => replaceSitePersonalText("actual\u0000control", personalMap)).toThrow();
});
test("form-space matching ignores query keys and fragments and charges rejected candidates", () => {
  const map = mapped(["Anna Lind"]);
  for (const text of ["?Anna+Lind=x", "?x=1#Anna+Lind", "?x=1#?q=Anna+Lind", "C++"])
    expect(replaceSitePersonalText(text, map, { context: "code" })).toBe(text);
  expect(replaceSitePersonalText("?key=Anna+Lind", map, { context: "code" })).not.toContain("Anna");
  expect(() => replaceSitePersonalText(`${"?".repeat(10001)}+`, map)).toThrow(
    "Query normalization",
  );
});
test("hyphenated single names retain text case and cannot rewrite keys or code", () => {
  const map = mapped(["Anne-Marie"]);
  expect(replaceSitePersonalText("const anne_marie = 1", map, { context: "code" })).toBe(
    "const anne_marie = 1",
  );
  expect(replaceSitePersonalText("Anne-Marie", map, { context: "key" })).toBe("Anne-Marie");
  expect(replaceSitePersonalText("anne-marie", map)).toBe("anne-marie");
  expect(replaceSitePersonalText("Anne-Marie", map)).not.toBe("Anne-Marie");
});
test("map allocation excludes implicit fragments even if no persisted fragment entry exists", () => {
  const map = mapped(["Elin Andersson"]);
  expect(map.entries[0]?.replacement).not.toContain("Elin");
  expect(
    replaceSitePersonalText(map.entries[0]?.replacement ?? "", map, { preserveSamples: false }),
  ).toBe(map.entries[0]?.replacement);
});

test("structured email labels normalize before private-map serialization", () => {
  const source = `<script type="application/ld+json">{"@type":"LocalBusiness","name":"Harbour Workshop","email":"Email: anna@example.test"}</script><a itemprop="email" href="mailto:other@example.test">Email us</a>`;
  const result = projectSitePersonal(input(source), { personalKey: key });
  expect(
    result.personalMap.entries
      .filter((entry) => entry.kind === "email")
      .map((entry) => entry.original),
  ).toEqual(expect.arrayContaining(["anna@example.test", "other@example.test"]));
  expect(parseSitePersonalMap(JSON.parse(JSON.stringify(result.personalMap)))).toEqual(
    result.personalMap,
  );
});

test("ordinary heading prefixes are not role evidence but dotted titles are", () => {
  const source = `<h1>Harbour Workshop</h1><p>Our Opening Hours</p><p>Our Coffee Shop</p><p>Welcome To Stockholm</p><p>Dr. Anna Lind</p><p>Mr. Oskar Berg</p>`;
  const reading = input(source);
  const text =
    "Our Opening Hours. Our Coffee Shop. Welcome To Stockholm. Dr. Anna Lind. Mr. Oskar Berg.";
  reading.sourceCorpus.pages = [
    { id: "p1", text, sha256: createHash("sha256").update(text).digest("hex") },
  ];
  const result = projectSitePersonal(reading, { personalKey: key });
  const names = result.personalMap.entries
    .filter((entry) => entry.kind === "name")
    .map((entry) => entry.original);
  expect(names).not.toContain("Opening Hours");
  expect(names).not.toContain("Coffee Shop");
  expect(names).not.toContain("To Stockholm");
  expect(names).toContain("Anna Lind");
  expect(names).toContain("Oskar Berg");
});

test("refused person titles cannot leave personal fragments in their projection", () => {
  const source = `<meta property="og:site_name" content="Jane Lindholm"><p>Jane is available.</p><img src="/portrait.png" alt="Lindholm">`;
  const result = projectSitePersonal(input(source), { personalKey: key });
  expect(result.model.facts.ambiguous).toBe(true);
  expect(JSON.stringify(result.model)).not.toContain("Jane");
  expect(JSON.stringify(result.model)).not.toContain("Lindholm");
});

test("short structured phone identifiers cannot survive inside allocated samples", () => {
  const source = `<script type="application/ld+json">{"@type":"LocalBusiness","name":"Harbour Workshop","telephone":"000 001"}</script>`;
  const result = projectSitePersonal(input(source), { personalKey: key });
  for (const entry of result.personalMap.entries)
    expect(
      replaceSitePersonalText(entry.replacement, result.personalMap, { preserveSamples: false }),
    ).toBe(entry.replacement);
});

test("literal uppercase Unicode-like text stays literal and encoded person titles scrub fragments", () => {
  const map = mapped(["Jane Lindholm"]);
  expect(replaceSitePersonalText(String.raw`C:\U0001`, map)).toBe(String.raw`C:\U0001`);
  const result = projectSitePersonal(
    input(`<meta property="og:site_name" content="Jane%20Lindholm"><img src="/a.png" alt="Jane">`),
    { personalKey: key },
  );
  expect(result.model.facts.ambiguous).toBe(true);
  expect(JSON.stringify(result.model)).not.toContain("Jane");
});

test("Unicode business words and ordinary phone labels do not reject the site", () => {
  const result = projectSitePersonal(
    input(
      `<meta property="og:site_name" content="Anna Café"><script type="application/ld+json">{"@type":"LocalBusiness","name":"Anna Café","telephone":"Call us"}</script>`,
    ),
    { personalKey: key },
  );
  expect(result.model.facts.ambiguous).not.toBe(true);
  expect(parseSitePersonalMap(result.personalMap)).toEqual(result.personalMap);
});
