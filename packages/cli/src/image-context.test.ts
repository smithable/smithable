import { expect, test } from "vitest";
import {
  extractImageContexts,
  parseSiteImageContexts,
  validateImageInference,
} from "./image-context.js";

const page = "https://business.example/";
test("extracts bounded textual image context and dimensions without pixels", () => {
  const html =
    '<header><img src="/images/company_logo.svg" alt="Company logo"></header><section class="gallery"><h2>Dining room</h2><p>Tables beside a window.</p><figure><img src="/photos/dining.webp" width="1200" height="800" alt="Dining room" title="Room"><figcaption>Window tables</figcaption></figure></section><div style="background-image: url(/photos/wall.webp)"></div><img src="data:image/png;base64,SECRETPIXELS"><img hidden src="/hidden.jpg">';
  const contexts = extractImageContexts(html, page, "page-1");
  expect(contexts).toHaveLength(3);
  expect(contexts[0]?.role).toBe("logo");
  expect(contexts[1]).toMatchObject({
    src: `${page}photos/dining.webp`,
    filename: "dining.webp",
    alt: "Dining room",
    title: "Room",
    caption: "Window tables",
    dimensions: { width: 1200, height: 800 },
    nearbyHeadings: ["Dining room"],
    nearbyParagraphs: ["Tables beside a window."],
  });
  expect(contexts[2]?.role).toBe("background");
  expect(JSON.stringify(contexts)).not.toMatch(/SECRETPIXELS|hidden.jpg/);
  expect(parseSiteImageContexts(contexts)).toEqual(contexts);
});
test("many images stop at sixty and missing metadata remains empty", () => {
  const html = Array.from({ length: 100 }, (_, i) => `<img src="/img/${i}.jpg">`).join("");
  const contexts = extractImageContexts(html, page, "p");
  expect(contexts).toHaveLength(60);
  expect(contexts[0]).toMatchObject({
    alt: "",
    title: "",
    caption: "",
    role: "unknown",
    dimensions: {},
  });
  expect(extractImageContexts(html, page, "p", 2)).toHaveLength(2);
});
test("text inference requires real context evidence, observed support, review marks and logo isolation", () => {
  const contexts = extractImageContexts(
    '<img src="/room.webp" alt="Dining room"><img src="/company_logo.svg" alt="Company logo">',
    page,
    "p",
  );
  const result = {
    imageId: contexts[0]?.id,
    role: "unknown",
    subject: "Dining room",
    attributes: [],
    basis: "observed",
    evidence: [{ field: "alt", text: "Dining room" }],
    needsVisualCheck: false,
  };
  expect(validateImageInference([result], contexts)[0]?.subject).toBe("Dining room");
  for (const patch of [
    { subject: "Swimming pool" },
    { evidence: [{ field: "alt", text: "Invented evidence" }] },
    { imageId: "other" },
    { pixels: "image bytes" },
    { subject: "Sunny restaurant", basis: "inferred" },
  ])
    expect(() => validateImageInference([{ ...result, ...patch }], contexts)).toThrow();
  expect(
    validateImageInference(
      [{ ...result, subject: "Restaurant interior", basis: "inferred", needsVisualCheck: true }],
      contexts,
    )[0]?.needsVisualCheck,
  ).toBe(true);
  expect(() =>
    validateImageInference(
      [{ ...result, imageId: contexts[1]?.id, evidence: [{ field: "alt", text: "Company logo" }] }],
      contexts,
    ),
  ).toThrow(/logo/);
});

test("image limits and source locators survive filtered images and mixed backgrounds", () => {
  const html =
    '<img src="data:image/png;base64,PIXELS"><div style="background:url(/wall.webp)"></div><img src="/room.webp">';
  const images = extractImageContexts(html, page, "p");
  expect(images[0]?.evidence.element).toBe("div@1");
  expect(images[1]?.evidence.element).toBe("img@2");
  expect(() => extractImageContexts(html, page, "p", Number.NaN)).toThrow();
  expect(() => extractImageContexts(html, page, "p", Number.POSITIVE_INFINITY)).toThrow();
});
test("unsupported role changes and negated metadata cannot become unreviewed observations", () => {
  const contexts = extractImageContexts(
    '<img src="/subject.webp" alt="Not a hospital">',
    page,
    "p",
  );
  expect(contexts[0]?.subject).toEqual([]);
  const result = {
    imageId: contexts[0]?.id,
    role: "unknown",
    subject: "hospital",
    attributes: [],
    basis: "observed",
    evidence: [{ field: "alt", text: "Not a hospital" }],
    needsVisualCheck: false,
  };
  expect(() => validateImageInference([result], contexts)).toThrow();
  expect(() =>
    validateImageInference([{ ...result, subject: "Not a hospital", role: "hero" }], contexts),
  ).toThrow();
  expect(
    validateImageInference(
      [{ ...result, role: "hero", basis: "inferred", needsVisualCheck: true }],
      contexts,
    )[0]?.needsVisualCheck,
  ).toBe(true);
});
test("lazy URLs, path-based logos and null metadata produce valid bounded contexts", () => {
  const contexts = extractImageContexts(
    '<img src="" data-src="/room.webp" alt="Room"><img src="data:image/gif;base64,PIXELS" data-src="/gallery.webp"><img src="/assets/logos/acme.png"><img src="/acme-logo@2x.png"><img src="/a%00.png" alt="A\0title">',
    "https://business.example",
    "p",
  );
  expect(contexts).toHaveLength(5);
  expect(contexts[0]?.page).toBe("https://business.example/");
  expect(contexts[2]?.role).toBe("logo");
  expect(contexts[3]?.role).toBe("logo");
  expect(parseSiteImageContexts(contexts)).toEqual(contexts);
  expect(JSON.stringify(contexts)).not.toContain("\\u0000");
});
test("distant page text cannot be an unreviewed observed image claim", () => {
  const contexts = extractImageContexts(
    `<body><h2>Distant heading</h2><p>Distant pool</p>${"<div>Separate block</div>".repeat(30)}<img src="/room.webp" alt="Room"></body>`,
    page,
    "p",
  );
  expect(contexts[0]?.nearbyParagraphs).toEqual([]);
  const metadata = extractImageContexts(
    '<section><p>Indoor pool</p><img src="/room.webp"></section>',
    page,
    "p",
  );
  const result = {
    imageId: metadata[0]?.id,
    role: "unknown",
    subject: "Indoor pool",
    attributes: [],
    basis: "observed",
    evidence: [{ field: "nearbyParagraphs", text: "Indoor pool" }],
    needsVisualCheck: false,
  };
  expect(() => validateImageInference([result], metadata)).toThrow();
  expect(() =>
    validateImageInference(
      [{ ...result, role: "icon", basis: "inferred", needsVisualCheck: true }],
      metadata,
    ),
  ).toThrow(/logo or icon/);
});

test("observed evidence cannot select a word fragment or synthesize two metadata fields", () => {
  const contexts = extractImageContexts(
    '<img src="/subject.webp" alt="Fred" title="roses">',
    page,
    "p",
  );
  const item = {
    imageId: contexts[0]?.id,
    role: "unknown",
    subject: "red",
    attributes: [],
    basis: "observed",
    evidence: [{ field: "alt", text: "red" }],
    needsVisualCheck: false,
  };
  expect(() => validateImageInference([item], contexts)).toThrow();
  expect(() =>
    validateImageInference(
      [
        {
          ...item,
          subject: "Fred roses",
          evidence: [
            { field: "alt", text: "Fred" },
            { field: "title", text: "roses" },
          ],
        },
      ],
      contexts,
    ),
  ).toThrow();
});
