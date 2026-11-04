import { createHash } from "node:crypto";
import { describe, expect, test } from "vitest";
import {
  parseSiteReadBundle,
  type SiteReadBundle,
  siteBundleResult,
  visibleSourceText,
} from "./site-bundle.js";
import { parseSiteFacts } from "./site-facts.js";

const startUrl = "https://business.example/";
const metadata = (item: object) =>
  `<script type="application/ld+json">${JSON.stringify(item)}</script>`;
const business = {
  "@type": "LocalBusiness",
  url: startUrl,
  name: "Harbour Workshop",
  telephone: "+358 18 12345",
};
const first = (b: SiteReadBundle) => {
  const page = b.pages[0];
  if (!page) throw new Error("Missing fixture page");
  return page;
};
function bundle(htmls: string[]): SiteReadBundle {
  const pages = htmls.map((html, index) => ({
    id: `page-${index}`,
    url: index ? `${startUrl}services` : startUrl,
    html,
    fetchedAt: "2026-11-04T10:00:00.000Z",
    bytes: Buffer.byteLength(html),
    depth: index ? 1 : 0,
  }));
  return {
    version: 1,
    startUrl,
    pages,
    crawl: {
      pages: pages.length,
      bytes: pages.reduce((n, p) => n + p.bytes, 0) + 20,
      elapsedMs: 500,
      diagnostics: [],
    },
  };
}
describe("bounded site bundle extraction", () => {
  test("combines one identity with evidence and keeps the complete visible corpus outside context", () => {
    const prose =
      "These original sentences describe the source website and must stay outside every factual generation prompt.";
    const input = bundle([
      `${metadata(business)}<p>${prose}</p><nav><a href="/services">Services</a></nav>`,
      metadata({
        ...business,
        address: { streetAddress: "Harbour Road 2", addressLocality: "Island City" },
        openingHoursSpecification: {
          dayOfWeek: ["Monday", "Tuesday"],
          opens: "09:00",
          closes: "17:00",
        },
        hasOfferCatalog: {
          itemListElement: [
            {
              "@type": "Offer",
              itemOffered: { "@type": "Service", name: "Repairs" },
              price: "35",
              priceCurrency: "EUR",
            },
            {
              "@type": "Offer",
              itemOffered: { "@type": "Product", name: "Spare parts" },
              price: "12",
              priceCurrency: "EUR",
            },
          ],
        },
      }) +
        '<section><h2>Services</h2><h3>Inspections</h3></section><a href="/book">Book appointment</a><form><label for="email">Email</label><input id="email" type="email"></form>',
    ]);
    const result = siteBundleResult(input);
    expect(result.tooLittle).toBe(false);
    for (const text of [
      "Harbour Workshop",
      "+358 18 12345",
      "Harbour Road 2",
      "Repairs",
      "Spare parts",
      "35 EUR",
      "09:00-17:00",
      "Inspections",
    ])
      expect(result.description).toContain(text);
    expect(result.description).not.toContain(prose);
    expect(result.description).not.toContain('"evidence"');
    expect(
      result.facts.fields.find((f) => f.kind === "function" && f.value === "Booking concept"),
    ).toMatchObject({
      basis: "inferred",
      evidence: { page: `${startUrl}services`, text: "Book appointment" },
    });
    expect(result.links).toContainEqual({ url: `${startUrl}services`, page: startUrl, depth: 1 });
    expect(result.sourceCorpus.pages[0]?.text).toContain(prose);
    for (const page of result.sourceCorpus.pages)
      expect(page.sha256).toBe(createHash("sha256").update(page.text).digest("hex"));
    expect(parseSiteFacts(result.facts)).toEqual(result.facts);
  });
  test("conflicting page identities never blend contact or business claims", () => {
    const result = siteBundleResult(
      bundle([
        metadata(business),
        metadata({ ...business, name: "Different Workshop", telephone: "+358 18 99999" }),
      ]),
    );
    expect(result.tooLittle).toBe(true);
    expect(result.facts.ambiguous).toBe(true);
    expect(result.facts.fields).toEqual([]);
    expect(result.description).not.toContain("99999");
    expect(result.diagnostics.join(" ")).toMatch(/different businesses/);
  });
  test("bundle schema, counters, actual bytes, site and aggregate bounds fail closed", () => {
    const valid = bundle([metadata(business)]);
    for (const alter of [
      (b: SiteReadBundle) => {
        first(b).bytes++;
      },
      (b: SiteReadBundle) => {
        first(b).depth = 3;
      },
      (b: SiteReadBundle) => {
        first(b).url = "https://other.example/";
      },
      (b: SiteReadBundle) => {
        first(b).url = "https://business.example:8080/";
      },
      (b: SiteReadBundle) => {
        b.crawl.pages++;
      },
      (b: SiteReadBundle) => {
        b.crawl.bytes = 8 * 1024 * 1024 + 1;
      },
      (b: SiteReadBundle) => {
        b.crawl.elapsedMs = 60_001;
      },
      (b: SiteReadBundle) => {
        b.pages = Array.from({ length: 13 }, () => first(b));
      },
    ]) {
      const value = structuredClone(valid);
      alter(value);
      expect(() => parseSiteReadBundle(value)).toThrow();
    }
    expect(() => parseSiteReadBundle({ ...valid, pixels: "hidden" })).toThrow(/Unexpected/);
    const downgrade = structuredClone(valid);
    first(downgrade).url = "http://business.example/";
    expect(() => parseSiteReadBundle(downgrade)).toThrow();
    const twin = structuredClone(valid);
    first(twin).url = "https://www.business.example/";
    expect(parseSiteReadBundle(twin).pages).toHaveLength(1);
  });
  test("source corpus never truncates paragraphs, excludes execution and hidden text", () => {
    const source =
      "Source words that remain verbatim solely in the separate corpus for overlap checks. ".repeat(
        200,
      );
    const text = visibleSourceText(
      `<p>${source}</p><p hidden>Hidden words</p><script>privileged instructions</script><img alt="Accessible caption">`,
    );
    expect(text).toContain(source.trim());
    expect(text).toContain("Accessible caption");
    expect(text).not.toContain("privileged instructions");
    expect(text).not.toContain("Hidden words");
  });
  test("metadata validators reject prototype-shaped and extra input", () => {
    const facts = siteBundleResult(bundle([metadata(business)])).facts;
    expect(() => parseSiteFacts({ ...facts, override: "instructions" })).toThrow();
    expect(() =>
      parseSiteFacts(Object.assign(Object.create({ hidden: "inherited" }), facts)),
    ).toThrow();
    expect(() =>
      parseSiteFacts({ ...facts, fields: [{ ...facts.fields[0], basis: "verified" }] }),
    ).toThrow();
  });
});
test("provider-linked product facts stay with the selected business and malformed coordinates stay unknown", () => {
  const input = bundle([
    metadata({
      "@graph": [
        {
          ...business,
          "@id": `${startUrl}#business`,
          geo: { latitude: "", longitude: false },
          openingHours: "Mo-Fr 99:99-88:88",
        },
        {
          "@type": "Product",
          name: "Brake pads",
          seller: { "@id": `${startUrl}#business` },
          offers: { price: "25", priceCurrency: "EUR" },
        },
        {
          "@type": "Product",
          name: "Unrelated item",
          seller: { "@id": "https://other.example/#business" },
        },
      ],
    }),
  ]);
  const result = siteBundleResult(input);
  expect(result.facts.fields).toContainEqual(
    expect.objectContaining({ kind: "product", value: "Brake pads" }),
  );
  expect(result.description).toContain("Brake pads: 25 EUR");
  expect(result.description).not.toMatch(/Unrelated item|0, 0|99:99/);
});
test("source destinations remain evidence while generated navigation is local and consequential URLs stay out", () => {
  const result = siteBundleResult(
    bundle([
      `${metadata(business)}<nav><a href="/services?tracking=secret">Services</a><a href="https://booking.example/live">Book appointment</a></nav>`,
    ]),
  );
  expect(result.facts.fields).toContainEqual(
    expect.objectContaining({ kind: "cta", url: "https://booking.example/live" }),
  );
  expect(result.description).toContain('"path":"/services"');
  expect(result.description).not.toMatch(/booking.example|tracking=secret/);
});
test("foreign business and Person microdata never supply the selected business's contacts", () => {
  const result = siteBundleResult(
    bundle([
      `${metadata(business)}<section itemscope itemtype="https://schema.org/LocalBusiness"><span itemprop="name">Other business</span><address><a href="tel:+3581899999">Other phone</a></address></section><article itemscope itemtype="https://schema.org/Person"><span itemprop="email">author@example.com</span><address>Author address</address></article><article><section><h2>Services</h2><h3>Real repair</h3></section><section><h2>News</h2><h3>Not a service</h3></section></article>`,
    ]),
  );
  expect(result.description).not.toMatch(/99999|author@example|Author address|Not a service/);
  expect(result.description).toContain("Real repair");
});
test("single business microdata is scoped and staff identity is excluded", () => {
  const result = siteBundleResult(
    bundle([
      '<main itemscope itemtype="https://schema.org/LocalBusiness"><meta itemprop="name" content="Harbour Workshop"><a itemprop="email" href="mailto:shop@example.com">Email</a><div itemprop="address" itemscope itemtype="https://schema.org/PostalAddress"><span itemprop="streetAddress">Main Street 2</span></div><section itemscope itemtype="https://schema.org/Person"><span itemprop="name">Staff Member</span><span itemprop="email">staff@example.com</span></section></main>',
    ]),
  );
  expect(result.description).toMatch(/Harbour Workshop/);
  expect(result.description).toContain("shop@example.com");
  expect(result.description).toContain("Main Street 2");
  expect(result.description).not.toContain("staff@example.com");
});
test("seasonal, malformed and zero-length hours remain unknown rather than unconditional", () => {
  const result = siteBundleResult(
    bundle([
      metadata({
        ...business,
        openingHoursSpecification: [
          {
            dayOfWeek: "Monday",
            opens: "09:00",
            closes: "17:00",
            validFrom: "2026-06-01",
            validThrough: "2026-08-31",
          },
          { dayOfWeek: "Tuesday", opens: "05:00pm", closes: "17:00" },
          { dayOfWeek: "Wednesday", opens: "00:00", closes: "00:00" },
        ],
      }),
    ]),
  );
  expect(result.facts.fields.filter((f) => f.kind === "hours")).toEqual([]);
});
test("header repetition is deduplicated and cannot turn one clue into enough facts", () => {
  const result = siteBundleResult(
    bundle(['<nav><a href="/">Home</a></nav>', '<nav><a href="/">Home</a></nav>']),
  );
  expect(result.facts.navigation).toHaveLength(1);
  expect(result.tooLittle).toBe(true);
});
test("source corpus keeps visible input values, options and aria-hidden visual text", () => {
  const value = "Book your next appointment with our friendly local team today";
  const corpus = visibleSourceText(
    `<input type="submit" value="${value}"><input type="hidden" value="secret"><select><option>Choose your preferred appointment time from these available slots today</option></select><span aria-hidden="true">Decorative visual text</span><p style="display:none;display:block">Visible override</p><p style="--display:none">Custom property visible</p>`,
  );
  expect(corpus).toContain(value);
  expect(corpus).toContain("preferred appointment time");
  expect(corpus).toContain("Decorative visual text");
  expect(corpus).toContain("Visible override");
  expect(corpus).toContain("Custom property visible");
  expect(corpus).not.toContain("secret");
});
test("first-page redirects are represented explicitly and unsafe local paths are omitted", () => {
  const redirected = bundle([metadata(business)]);
  redirected.pages[0] = { ...first(redirected), url: `${startUrl}en/` };
  expect(() => parseSiteReadBundle(redirected)).toThrow(/first page/);
  redirected.pages[0].requestedUrl = startUrl;
  expect(parseSiteReadBundle(redirected).pages[0]?.url).toBe(`${startUrl}en/`);
  const result = siteBundleResult(
    bundle([
      `${metadata(business)}<nav><a href="//business.example//evil.example/book">Book</a><a href="http://business.example/book">Downgrade</a><a href="https://business.example:8080/book">Different port</a></nav>`,
    ]),
  );
  expect(result.description).not.toContain('"path":"//');
  expect(result.description).not.toMatch(/evil.example|8080/);
});
test("ambiguity survives a full diagnostics list with a bounded explanation", () => {
  const input = bundle([metadata(business), metadata({ ...business, name: "Different workshop" })]);
  input.crawl.diagnostics = Array.from({ length: 100 }, (_, i) => `Crawl note ${i}`);
  const result = siteBundleResult(input);
  expect(result.tooLittle).toBe(true);
  expect(result.diagnostics).toHaveLength(100);
  expect(result.diagnostics.at(-1)).toMatch(/different businesses.*omitted/);
  expect(result.facts.navigation).toEqual([]);
});
