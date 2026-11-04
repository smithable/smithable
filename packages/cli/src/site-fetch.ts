// The local CLI uses the same bounded transport contract as the hosted site reader.
import { createHash } from "node:crypto";
import { type SiteBundleResult, type SiteReadBundle, siteBundleResult } from "./site-bundle.js";
import {
  createSiteFetch,
  type FetchOptions,
  SiteFetchError,
  siteFetchLimits,
} from "./site-fetch-policy.js";
import { VERSION } from "./version.js";

export interface SiteOriginal {
  id: string;
  mediaType: "image/jpeg" | "image/png" | "image/webp";
  sourceUrl: string;
  alt: string;
  bytes: Uint8Array;
}
export interface ReadSiteResult {
  bundle: SiteReadBundle;
  reading: SiteBundleResult;
  originals: SiteOriginal[];
}

/** Read up to three breadth-first layers, never giving a model source prose or image pixels. */
export async function readSite(start: string, options: FetchOptions = {}): Promise<ReadSiteResult> {
  const session = createSiteFetch(start, {
    userAgent: `Smithable/${VERSION} (+https://smithable.ai)`,
    ...options,
  });
  const limits = siteFetchLimits(options.limits);
  const canonicalStart = new URL(start);
  canonicalStart.hash = "";
  const bundle: SiteReadBundle = {
    version: 1,
    startUrl: canonicalStart.href,
    pages: [],
    crawl: { pages: 0, bytes: 0, elapsedMs: 0, diagnostics: [] },
  };
  const diagnostics: string[] = [];
  const visited = new Set<string>();
  let frontier: { url: string; page?: string; depth: number }[] = [
    { url: bundle.startUrl, depth: 0 },
  ];
  const update = () => {
    const snapshot = session.snapshot();
    const decoded = bundle.pages.reduce((total, page) => total + page.bytes, 0);
    if (decoded > limits.bytes)
      throw new SiteFetchError(
        "The decoded pages exceed the site reading limit.",
        false,
        "site-bytes",
      );
    bundle.crawl = {
      pages: bundle.pages.length,
      bytes: Math.max(snapshot.bytes, decoded),
      elapsedMs: snapshot.elapsedMs,
      ...(snapshot.stoppedReason ? { stoppedReason: snapshot.stoppedReason } : {}),
      diagnostics: [...new Set([...snapshot.diagnostics, ...diagnostics])].slice(0, 64),
    };
  };
  for (let round = 0; round <= limits.depth && frontier.length; round++) {
    for (const link of frontier) {
      if (session.snapshot().pageAttempts >= limits.pages || session.signal.aborted) break;
      const address = new URL(link.url);
      address.hash = "";
      if (visited.has(address.href)) continue;
      visited.add(address.href);
      try {
        const response = await session.page(address.href, link.page);
        if (bundle.pages.some((page) => page.url === response.url)) continue;
        visited.add(response.url);
        const html = new TextDecoder().decode(response.bytes);
        bundle.pages.push({
          id: createHash("sha256").update(response.url).digest("hex").slice(0, 24),
          url: response.url,
          html,
          fetchedAt: response.fetchedAt,
          bytes: Buffer.byteLength(html, "utf8"),
          depth: response.depth,
        });
      } catch (error) {
        if (options.signal?.aborted) throw options.signal.reason;
        if (!bundle.pages.length) throw error;
        if (diagnostics.length < 64)
          diagnostics.push(
            (error instanceof Error ? error.message : "A discovered page could not be read.").slice(
              0,
              1000,
            ),
          );
      }
    }
    update();
    options.signal?.throwIfAborted();
    const reading = siteBundleResult(bundle);
    frontier = reading.links.filter((link) => link.depth <= limits.depth && !visited.has(link.url));
  }
  update();
  options.signal?.throwIfAborted();
  let reading = siteBundleResult(bundle);
  const originals: SiteOriginal[] = [];
  if (options.allowAssets) {
    for (const image of reading.images) {
      if (
        session.snapshot().assetAttempts >= limits.assets ||
        originals.length >= limits.assets ||
        session.signal.aborted
      )
        break;
      try {
        const asset = await session.asset(image.src, image.page);
        originals.push({
          id: image.id,
          mediaType: asset.type as SiteOriginal["mediaType"],
          sourceUrl: asset.url,
          alt: image.alt,
          bytes: asset.bytes,
        });
      } catch (error) {
        if (options.signal?.aborted) throw options.signal.reason;
        if (diagnostics.length < 64)
          diagnostics.push(
            (error instanceof Error
              ? error.message
              : "An original picture could not be read."
            ).slice(0, 1000),
          );
      }
    }
    update();
    options.signal?.throwIfAborted();
    reading = siteBundleResult(bundle);
  }
  if (options.signal?.aborted) throw options.signal.reason;
  return { bundle, reading, originals };
}
