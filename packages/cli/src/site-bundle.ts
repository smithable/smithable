import { createHash } from "node:crypto";
import { parse } from "node-html-parser";
import { extractImageContexts, type SiteImageContext } from "./image-context.js";
import { extractSiteFacts, parseSiteFacts, type SiteFacts } from "./site-facts.js";
import {
  projectSitePersonal,
  type SiteContentMode,
  type SiteModelProjection,
  type SitePersonalMap,
} from "./site-personal.js";
import { inlineHidden, integer, list, record, string, webAddress } from "./site-validation.js";

export interface SiteReadPage {
  id: string;
  url: string;
  html: string;
  fetchedAt: string;
  bytes: number;
  depth: number;
  requestedUrl?: string;
}
export interface SiteReadBundle {
  version: 1;
  startUrl: string;
  pages: SiteReadPage[];
  crawl: {
    pages: number;
    bytes: number;
    elapsedMs: number;
    stoppedReason?: string;
    diagnostics: string[];
  };
}
export interface SiteSourceCorpus {
  version: 1;
  pages: { id: string; text: string; sha256: string }[];
}
export interface SiteBundleResult {
  facts: SiteFacts;
  description: string;
  tooLittle: boolean;
  links: { url: string; page: string; depth: number }[];
  images: SiteImageContext[];
  sourceCorpus: SiteSourceCorpus;
  diagnostics: string[];
  model: SiteModelProjection;
  personalMap: SitePersonalMap;
}
const MAX_BYTES = 8 * 1024 * 1024;
const siteHost = (url: URL) => url.hostname.toLowerCase().replace(/^www\./, "");
/** Only the starting host and its www twin, same port, with optional HTTP to HTTPS. */
export function sameSiteAddress(address: string, start: string): boolean {
  const url = new URL(address),
    base = new URL(start);
  return (
    siteHost(url) === siteHost(base) &&
    url.port === base.port &&
    (url.protocol === base.protocol || (base.protocol === "http:" && url.protocol === "https:"))
  );
}
export function parseSiteReadBundle(value: unknown): SiteReadBundle {
  const item = record(value, ["version", "startUrl", "pages", "crawl"]);
  if (item.version !== 1) throw new Error("Unsupported site bundle version.");
  const startUrl = webAddress(item.startUrl);
  const ids = new Set<string>(),
    urls = new Set<string>();
  const pages = list(item.pages, 12).map((value) => {
    const page = record(value, [
      "id",
      "url",
      "html",
      "fetchedAt",
      "bytes",
      "depth",
      "requestedUrl",
    ]);
    const id = string(page.id, 128),
      url = webAddress(page.url),
      html = string(page.html, MAX_BYTES, true);
    if (!/^[\w-]+$/.test(id) || ids.has(id) || urls.has(url) || !sameSiteAddress(url, startUrl))
      throw new Error("Conflicting or out-of-site bundle page.");
    ids.add(id);
    urls.add(url);
    const fetchedAt = string(page.fetchedAt, 40);
    if (!Number.isFinite(Date.parse(fetchedAt)) || !/^\d{4}-\d\d-\d\dT/.test(fetchedAt))
      throw new Error("Invalid page fetch time.");
    const bytes = integer(page.bytes, MAX_BYTES);
    if (Buffer.byteLength(html, "utf8") !== bytes)
      throw new Error("Page byte count does not match its HTML.");
    const requestedUrl =
      page.requestedUrl === undefined ? undefined : webAddress(page.requestedUrl);
    if (requestedUrl && !sameSiteAddress(requestedUrl, startUrl))
      throw new Error("Out-of-site requested page.");
    return {
      id,
      url,
      html,
      fetchedAt,
      bytes,
      depth: integer(page.depth, 2),
      ...(requestedUrl ? { requestedUrl } : {}),
    };
  });
  if (!pages.length || pages[0]?.depth !== 0)
    throw new Error("A site bundle needs its starting page.");
  const first = pages[0];
  if (first) {
    const requested = new URL(first.requestedUrl ?? first.url),
      start = new URL(startUrl);
    if (
      !sameSiteAddress(requested.href, startUrl) ||
      requested.pathname !== start.pathname ||
      requested.search !== start.search
    )
      throw new Error("The first page does not correspond to the starting address.");
  }
  const crawl = record(item.crawl, ["pages", "bytes", "elapsedMs", "stoppedReason", "diagnostics"]);
  const count = integer(crawl.pages, 12),
    bytes = integer(crawl.bytes, MAX_BYTES),
    elapsedMs = integer(crawl.elapsedMs, 60_000);
  if (count !== pages.length || pages.reduce((sum, p) => sum + p.bytes, 0) > bytes)
    throw new Error("Inconsistent site crawl bounds.");
  return {
    version: 1,
    startUrl,
    pages,
    crawl: {
      pages: count,
      bytes,
      elapsedMs,
      ...(crawl.stoppedReason === undefined
        ? {}
        : { stoppedReason: string(crawl.stoppedReason, 200) }),
      diagnostics: list(crawl.diagnostics, 100).map((d) => string(d, 1000)),
    },
  };
}
/** Conservative visible corpus: no truncation, including fallback/accessible image and form text. */
export function visibleSourceText(html: string): string {
  const root = parse(html, { comment: false });
  for (const el of root.querySelectorAll(
    'script, style, template, [hidden], input[type="hidden"], input[type="password"]',
  ))
    el.remove();
  for (const el of root.querySelectorAll("*"))
    if (inlineHidden(el.getAttribute("style") ?? "")) el.remove();
  const attributes = root
    .querySelectorAll("[alt], [aria-label], [title], [placeholder], input[value]")
    .flatMap((el) =>
      ["alt", "aria-label", "title", "placeholder", "value"].flatMap(
        (key) => el.getAttribute(key) ?? [],
      ),
    );
  const meta = root
    .querySelectorAll(
      'meta[name="description"], meta[property="og:site_name"], meta[property="og:title"], meta[property="og:description"]',
    )
    .map((el) => el.getAttribute("content") ?? "");
  const text = [root.structuredText, ...attributes, ...meta]
    .join("\n")
    .replace(/\s+/gu, " ")
    .trim();
  if (Buffer.byteLength(text, "utf8") > MAX_BYTES)
    throw new Error("Source corpus exceeds its bound.");
  return text;
}
export function siteBundleResult(
  input: SiteReadBundle,
  options: {
    contentMode?: SiteContentMode;
    personalMap?: SitePersonalMap;
    personalKey?: string;
  } = {},
): SiteBundleResult {
  const bundle = parseSiteReadBundle(input);
  const diagnostics = [...bundle.crawl.diagnostics];
  const firstPage = bundle.pages[0];
  if (!firstPage) throw new Error("Missing starting page.");
  const firstReading = extractSiteFacts(firstPage.html, firstPage.url);
  const readings = [
    firstReading,
    ...bundle.pages.slice(1).map((page) =>
      extractSiteFacts(page.html, page.url, {
        identityUrl: firstPage.url,
        identityName: firstReading.fields.find((f) => f.kind === "name")?.value,
      }),
    ),
  ];
  const names = new Set(
    readings.flatMap((r) =>
      r.fields
        .filter((f) => f.kind === "name")
        .map((f) => f.value.toLowerCase().replace(/[^\p{L}\p{N}]/gu, "")),
    ),
  );
  const ambiguous = readings.some((r) => r.ambiguous) || names.size > 1;
  const unique = <T>(values: T[], key: (value: T) => string): T[] => {
    const seen = new Set<string>();
    return values.filter((value) => {
      const id = key(value);
      if (seen.has(id)) return false;
      seen.add(id);
      return true;
    });
  };
  const facts: SiteFacts = {
    version: 1,
    url: bundle.startUrl,
    ...(ambiguous ? { ambiguous: true } : {}),
    fields: ambiguous
      ? []
      : unique(
          readings.flatMap((r) => r.fields),
          (f) => `${f.kind}|${f.value}|${f.basis}|${f.url ?? ""}`,
        ),
    navigation: ambiguous
      ? []
      : unique(
          readings.flatMap((r) => r.navigation),
          (f) => `${f.value}|${f.url ? new URL(f.url).pathname : ""}`,
        ),
    forms: ambiguous
      ? []
      : unique(
          readings.flatMap((r) => r.forms),
          (f) => JSON.stringify(f.fields.map((field) => field.value)),
        ),
  };
  if (ambiguous) {
    const omitted = diagnostics.length === 100;
    if (omitted) diagnostics.pop();
    diagnostics.push(
      `The pages identify different businesses; their facts were not combined.${omitted ? " One crawl diagnostic omitted at the output limit." : ""}`,
    );
  }
  const links: SiteBundleResult["links"] = [];
  const images: SiteImageContext[] = [];
  const corpus: SiteSourceCorpus = { version: 1, pages: [] };
  let corpusBytes = 0;
  for (const page of bundle.pages) {
    const text = visibleSourceText(page.html);
    corpusBytes += Buffer.byteLength(text, "utf8");
    if (corpusBytes > MAX_BYTES) throw new Error("Source corpus exceeds its bound.");
    corpus.pages.push({
      id: page.id,
      text,
      sha256: createHash("sha256").update(text).digest("hex"),
    });
    const root = parse(page.html, { comment: false });
    for (const anchor of root.querySelectorAll("a[href]")) {
      if (links.length >= 500) break;
      try {
        const url = new URL(anchor.getAttribute("href") ?? "", page.url);
        url.hash = "";
        if (
          !url.username &&
          !url.password &&
          ["http:", "https:"].includes(url.protocol) &&
          sameSiteAddress(url.href, bundle.startUrl) &&
          !links.some((l) => l.url === url.href)
        )
          links.push({ url: url.href, page: page.url, depth: page.depth + 1 });
      } catch {
        /* A malformed link is not a crawl target. */
      }
      if (links.length >= 500) break;
    }
    images.push(...extractImageContexts(page.html, page.url, page.id, 60 - images.length));
  }
  parseSiteFacts(facts);
  const { model, personalMap } = projectSitePersonal(
    { facts, images, sourceCorpus: corpus, pages: bundle.pages },
    options,
  );
  const description = model.description;
  const useful =
    model.facts.fields.filter((fact) => fact.kind !== "name").length +
    model.facts.navigation.length +
    model.facts.forms.length;
  if (description.length > 64_000 || diagnostics.length > 100)
    throw new Error("Extracted site context exceeds its bound.");
  return {
    facts,
    model,
    personalMap,
    description,
    tooLittle: model.facts.ambiguous === true || useful < 2,
    links,
    images,
    sourceCorpus: corpus,
    diagnostics,
  };
}
