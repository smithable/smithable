import { createHash } from "node:crypto";
import { parse } from "node-html-parser";
import {
  enumValue,
  inlineHidden,
  integer,
  list,
  record,
  string,
  webAddress,
} from "./site-validation.js";
export const IMAGE_ROLES = [
  "hero",
  "gallery",
  "card",
  "product",
  "background",
  "logo",
  "icon",
  "unknown",
] as const;
export type SiteImageRole = (typeof IMAGE_ROLES)[number];
export interface SiteImageContext {
  id: string;
  page: string;
  src: string;
  filename: string;
  alt: string;
  title: string;
  caption: string;
  nearbyHeadings: string[];
  nearbyParagraphs: string[];
  parent: string;
  dimensions: { width?: number; height?: number };
  role: SiteImageRole;
  subject: string[];
  basis: "observed" | "inferred";
  evidence: { page: string; element: string; text: string };
}
const text = (value: string | undefined, max: number) =>
  (value ?? "").replace(/\0/g, "").replace(/\s+/g, " ").trim().slice(0, max);
export function extractImageContexts(
  html: string,
  page: string,
  pageId: string,
  limit = 60,
): SiteImageContext[] {
  page = webAddress(page);
  if (!/^[\w-]{1,128}$/.test(pageId)) throw new Error("Invalid image source page identity.");
  if (!Number.isSafeInteger(limit) || limit < 0) throw new Error("Invalid image context limit.");
  if (limit === 0) return [];
  const root = parse(html, { comment: false });
  const locators = new Map(
    root
      .querySelectorAll("*")
      .map((el, index) => [el, `${(el.tagName ?? "element").toLowerCase()}@${index}`]),
  );
  for (const el of root.querySelectorAll('script, style, template, [hidden], [aria-hidden="true"]'))
    el.remove();
  for (const el of root.querySelectorAll("*"))
    if (inlineHidden(el.getAttribute("style") ?? "")) el.remove();
  const images: SiteImageContext[] = [];
  for (const el of root.querySelectorAll("img, [style]")) {
    if (images.length >= Math.min(60, limit)) break;
    const background = el.tagName !== "IMG";
    const raw = background
      ? /background(?:-image)?\s*:[^;]*url\(\s*['"]?([^'"\s)]+)/i.exec(
          el.getAttribute("style") ?? "",
        )?.[1]
      : [
          el.getAttribute("src"),
          el.getAttribute("data-src"),
          el.getAttribute("srcset")?.trim().split(/\s+/)[0]?.replace(/,$/, ""),
        ].find((value) => value && !/^data:|^blob:/i.test(value));
    if (!raw || /^data:|^blob:/i.test(raw)) continue;
    let src: string;
    try {
      src = webAddress(new URL(raw, page).href);
    } catch {
      continue;
    }
    if (images.some((image) => image.src === src)) continue;
    const parent = el.parentNode,
      section = el.closest("article, section, header") ?? el.closest("figure") ?? parent ?? el;
    const alt = text(el.getAttribute("alt"), 500),
      title = text(el.getAttribute("title"), 500);
    const caption = text(el.closest("figure")?.querySelector("figcaption")?.text, 1000);
    const near = (candidate: ReturnType<typeof parse>, distance: number) =>
      Math.abs(
        Number(locators.get(candidate)?.split("@")[1]) - Number(locators.get(el)?.split("@")[1]),
      ) <= distance;
    const nearbyHeadings = section
      .querySelectorAll("h1, h2, h3")
      .filter((candidate) => near(candidate, 20))
      .slice(0, 3)
      .map((h) => text(h.text, 300))
      .filter(Boolean);
    const nearbyParagraphs = section
      .querySelectorAll("p")
      .filter((candidate) => near(candidate, 12))
      .slice(0, 2)
      .map((p) => text(p.text, 1000))
      .filter(Boolean);
    let filename = new URL(src).pathname.split("/").at(-1) ?? "";
    try {
      filename = decodeURIComponent(filename);
    } catch {
      /* Keep the encoded filename. */
    }
    filename = text(filename, 200);
    const hint = `${new URL(src).pathname} ${filename} ${el.getAttribute("class") ?? ""} ${el.getAttribute("id") ?? ""} ${parent?.getAttribute("class") ?? ""} ${section.getAttribute("class") ?? ""} ${alt}`;
    const dimension = (key: string) => {
      const raw = el.getAttribute(key);
      const n = raw && /^\d+$/.test(raw) ? Number(raw) : undefined;
      return n && n <= 100_000 ? n : undefined;
    };
    const width = dimension("width"),
      height = dimension("height");
    const role: SiteImageRole = /(?:^|[-_\s./])logos?(?:[-_\s./@]|$)|brandmark|wordmark/i.test(hint)
      ? "logo"
      : /\bicon\b|favicon|sprite/i.test(hint) ||
          (width !== undefined && height !== undefined && width <= 64 && height <= 64)
        ? "icon"
        : /\bhero\b|banner|masthead/i.test(hint) || el.closest("header")
          ? "hero"
          : /\bproduct\b|item-image/i.test(hint)
            ? "product"
            : /gallery|carousel/i.test(hint)
              ? "gallery"
              : /\bcard\b|thumbnail/i.test(hint)
                ? "card"
                : background
                  ? "background"
                  : "unknown";
    const subject = [
      ...new Set(
        text(
          alt || title || caption || filename.replace(/[-_]/g, " ").replace(/\.[a-z\d]+$/i, ""),
          300,
        )
          .split(/[^\p{L}\p{N}]+/u)
          .filter(
            (word) =>
              word.length > 2 &&
              word.length <= 100 &&
              !/^(the|and|with|from|image|photo|picture|jpg|jpeg|webp|png|logo|img)$/i.test(word),
          ),
      ),
    ].slice(0, 16);
    if (
      /\b(no|not|without|never|inte|ingen|utan|ei|ilman)\b/i.test([alt, title, caption].join(" "))
    )
      subject.length = 0;
    images.push({
      id: createHash("sha256").update(`${pageId}\n${src}`).digest("hex"),
      page,
      src,
      filename,
      alt,
      title,
      caption,
      nearbyHeadings,
      nearbyParagraphs,
      parent: text(
        `${(parent?.tagName ?? "unknown").toLowerCase() ?? "unknown"}${parent?.getAttribute("class") ? `.${parent.getAttribute("class")}` : ""}`,
        300,
      ),
      dimensions: { ...(width ? { width } : {}), ...(height ? { height } : {}) },
      role,
      subject,
      basis: "inferred",
      evidence: {
        page,
        element: locators.get(el) ?? "unknown element",
        text: text([alt, title, caption, filename].filter(Boolean).join(" | "), 2000),
      },
    });
  }
  return images;
}
export function parseSiteImageContexts(input: unknown): SiteImageContext[] {
  const ids = new Set<string>();
  return list(input, 60).map((value) => {
    const item = record(value, [
      "id",
      "page",
      "src",
      "filename",
      "alt",
      "title",
      "caption",
      "nearbyHeadings",
      "nearbyParagraphs",
      "parent",
      "dimensions",
      "role",
      "subject",
      "basis",
      "evidence",
    ]);
    const id = string(item.id, 128);
    if (!/^[\w-]+$/.test(id) || ids.has(id))
      throw new Error("Invalid or duplicate image context identity.");
    ids.add(id);
    const dimensions = record(item.dimensions, ["width", "height"]),
      evidence = record(item.evidence, ["page", "element", "text"]);
    const page = webAddress(item.page);
    if (webAddress(evidence.page) !== page)
      throw new Error("Image evidence belongs to another page.");
    return {
      id,
      page,
      src: webAddress(item.src),
      filename: string(item.filename, 200, true),
      alt: string(item.alt, 500, true),
      title: string(item.title, 500, true),
      caption: string(item.caption, 1000, true),
      nearbyHeadings: list(item.nearbyHeadings, 3).map((s) => string(s, 300)),
      nearbyParagraphs: list(item.nearbyParagraphs, 2).map((s) => string(s, 1000)),
      parent: string(item.parent, 300),
      dimensions: {
        ...(dimensions.width === undefined ? {} : { width: integer(dimensions.width, 100_000, 1) }),
        ...(dimensions.height === undefined
          ? {}
          : { height: integer(dimensions.height, 100_000, 1) }),
      },
      role: enumValue(item.role, IMAGE_ROLES),
      subject: list(item.subject, 16).map((s) => string(s, 100)),
      basis: enumValue(item.basis, ["observed", "inferred"]),
      evidence: {
        page,
        element: string(evidence.element, 300),
        text: string(evidence.text, 2000, true),
      },
    };
  });
}
export interface SiteImageInference {
  imageId: string;
  role: SiteImageRole;
  subject: string;
  attributes: string[];
  basis: "observed" | "inferred";
  evidence: { field: string; text: string }[];
  needsVisualCheck: boolean;
}
export const IMAGE_INFERENCE_SCHEMA = {
  type: "array",
  maxItems: 60,
  items: {
    type: "object",
    additionalProperties: false,
    required: ["imageId", "role", "subject", "attributes", "basis", "evidence", "needsVisualCheck"],
    properties: {
      imageId: { type: "string", maxLength: 128 },
      role: { type: "string", enum: IMAGE_ROLES },
      subject: { type: "string", maxLength: 200 },
      attributes: { type: "array", maxItems: 12, items: { type: "string", maxLength: 200 } },
      basis: { type: "string", enum: ["observed", "inferred"] },
      evidence: {
        type: "array",
        maxItems: 8,
        items: {
          type: "object",
          additionalProperties: false,
          required: ["field", "text"],
          properties: {
            field: {
              type: "string",
              enum: [
                "alt",
                "title",
                "caption",
                "filename",
                "nearbyHeadings",
                "nearbyParagraphs",
                "parent",
              ],
            },
            text: { type: "string", maxLength: 1000 },
          },
        },
      },
      needsVisualCheck: { type: "boolean" },
    },
  },
} as const;
export function validateImageInference(
  input: unknown,
  contexts: SiteImageContext[],
): SiteImageInference[] {
  const safe = parseSiteImageContexts(contexts),
    ids = new Set<string>();
  return list(input, 60).map((value) => {
    const item = record(value, [
      "imageId",
      "role",
      "subject",
      "attributes",
      "basis",
      "evidence",
      "needsVisualCheck",
    ]);
    const imageId = string(item.imageId, 128),
      context = safe.find((c) => c.id === imageId);
    if (!context || ids.has(imageId) || typeof item.needsVisualCheck !== "boolean")
      throw new Error("Invalid image interpretation identity.");
    ids.add(imageId);
    const role = enumValue(item.role, IMAGE_ROLES);
    if (
      role !== context.role &&
      (["logo", "icon"].includes(context.role) || ["logo", "icon"].includes(role))
    )
      throw new Error("An interpretation cannot change logo or icon separation.");
    if (role !== context.role && (item.basis !== "inferred" || !item.needsVisualCheck))
      throw new Error("A changed image role needs an inference and visual review mark.");
    const evidence = list(item.evidence, 8).map((value) => {
      const e = record(value, ["field", "text"]),
        field = enumValue(e.field, [
          "alt",
          "title",
          "caption",
          "filename",
          "nearbyHeadings",
          "nearbyParagraphs",
          "parent",
        ]),
        quote = string(e.text, 1000);
      const original = context[field];
      if (
        !(Array.isArray(original) ? original : [original]).some((text) => {
          if (item.basis === "observed") return text === quote;
          const at = text.indexOf(quote);
          if (at < 0) return false;
          const letter = /[\p{L}\p{N}]/u;
          return (
            (!letter.test(quote[0] ?? "") || !letter.test(text[at - 1] ?? "")) &&
            (!letter.test(quote.at(-1) ?? "") || !letter.test(text[at + quote.length] ?? ""))
          );
        })
      )
        throw new Error("Image interpretation evidence is not in its context.");
      return { field, text: quote };
    });
    if (!evidence.length) throw new Error("Image interpretation needs source evidence.");
    const subject = string(item.subject, 200),
      attributes = list(item.attributes, 12).map((s) => string(s, 200));
    const basis = enumValue(item.basis, ["observed", "inferred"]);
    const directEvidence = evidence.filter((e) =>
      ["alt", "title", "caption", "filename"].includes(e.field),
    );
    const quotes = (basis === "observed" ? directEvidence : evidence).map((e) =>
      e.text.toLowerCase(),
    );
    if (
      basis === "inferred" &&
      evidence.some((e) => ["nearbyHeadings", "nearbyParagraphs", "parent"].includes(e.field)) &&
      !item.needsVisualCheck
    )
      throw new Error("Contextual image inferences require review.");
    const unsupported = [subject, ...attributes].some(
      (text) => !quotes.includes(text.toLowerCase()),
    );
    if (
      /\b(no|not|without|never|inte|ingen|utan|ei|ilman)\b/i.test(
        evidence.map((e) => e.text).join(" "),
      ) &&
      !item.needsVisualCheck
    )
      throw new Error("Negated image descriptions require review.");
    if (basis === "observed" && unsupported)
      throw new Error("An observed image claim needs matching source text.");
    if (basis === "inferred" && unsupported && !item.needsVisualCheck)
      throw new Error("Unsupported image inferences need a visual review mark.");
    return {
      imageId,
      role,
      subject,
      attributes,
      basis,
      evidence,
      needsVisualCheck: item.needsVisualCheck as boolean,
    };
  });
}
