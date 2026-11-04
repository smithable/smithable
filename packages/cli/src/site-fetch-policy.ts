// Bounded same-site HTTP reading. Imported bytes are passive data; no cookies, scripts or credentials.
import { lookup as dnsLookup } from "node:dns/promises";
import { request as httpRequest, type IncomingMessage } from "node:http";
import { request as httpsRequest } from "node:https";
import { BlockList, isIP, type LookupFunction } from "node:net";

export const MAX_PAGE = 2 * 1024 * 1024;
export const PAGE_TIMEOUT = 15_000;
export const USER_AGENT = "Smithable (+https://smithable.ai)";
export const SITE_LIMITS = Object.freeze({
  pages: 12,
  depth: 2,
  milliseconds: 60_000,
  bytes: 8 * 1024 * 1024,
  assets: 20,
  assetBytes: 1024 * 1024,
  robotsBytes: 512 * 1024,
  redirects: 3,
} as const);
export class SiteFetchError extends Error {
  retryable: boolean;
  code: string;
  constructor(message: string, retryable = false, code = "site-fetch") {
    super(message);
    this.retryable = retryable;
    this.code = code;
  }
}
const blocked = new BlockList();
for (const [net, bits] of [
  ["0.0.0.0", 8],
  ["10.0.0.0", 8],
  ["100.64.0.0", 10],
  ["127.0.0.0", 8],
  ["169.254.0.0", 16],
  ["172.16.0.0", 12],
  ["192.0.0.0", 24],
  ["192.0.2.0", 24],
  ["192.88.99.0", 24],
  ["192.168.0.0", 16],
  ["198.18.0.0", 15],
  ["198.51.100.0", 24],
  ["203.0.113.0", 24],
  ["224.0.0.0", 4],
  ["240.0.0.0", 4],
] as const)
  blocked.addSubnet(net, bits, "ipv4");
for (const [net, bits] of [
  ["::", 128],
  ["::1", 128],
  ["::", 96],
  ["::ffff:0:0:0", 96],
  ["64:ff9b::", 96],
  ["64:ff9b:1::", 48],
  ["100::", 64],
  ["2001::", 23],
  ["2001:db8::", 32],
  ["2002::", 16],
  ["fc00::", 7],
  ["fe80::", 10],
  ["fec0::", 10],
  ["ff00::", 8],
] as const)
  blocked.addSubnet(net, bits, "ipv6");

/** Whether an address is one the service must not fetch from. */
export function isBlocked(address: string): boolean {
  const family = isIP(address);
  if (family === 4) return blocked.check(address, "ipv4");
  if (family !== 6) return true;
  // An IPv4 address written as IPv6 (::ffff:10.0.0.1) is checked as the IPv4 address it is.
  const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/i.exec(address)?.[1];
  if (mapped) return blocked.check(mapped, "ipv4");
  return blocked.check(address, "ipv6");
}

export interface FetchOptions {
  ownDomains?: string[];
  signal?: AbortSignal;
  allowAssets?: boolean;
  userAgent?: string;
  /** Test-only host hooks; no browser input may select them. */
  refuse?: (address: string) => boolean;
  ports?: number[];
  resolve?: (host: string) => Promise<{ address: string; family: number }[]>;
  /** Only lower limits are accepted. */
  limits?: Partial<{
    pages: number;
    depth: number;
    milliseconds: number;
    bytes: number;
    assets: number;
    assetBytes: number;
    robotsBytes: number;
    redirects: number;
  }>;
}
const resolveHost = (hostname: string) => dnsLookup(hostname, { all: true, verbatim: true });
export const guardedLookup =
  (
    refuse: (a: string) => boolean,
    resolve: NonNullable<FetchOptions["resolve"]> = resolveHost,
  ): LookupFunction =>
  (hostname, options, callback) => {
    void resolve(hostname).then(
      (addresses) => {
        if (!addresses.length || addresses.some((a) => refuse(a.address)))
          return callback(
            new SiteFetchError(`${hostname} is not a public address.`, false, "ssrf"),
            "",
            4,
          );
        const first = addresses[0]!;
        if ((options as { all?: boolean }).all)
          (callback as unknown as (e: null, a: typeof addresses) => void)(null, addresses);
        else callback(null, first.address, first.family);
      },
      (error) => callback(error as Error, "", 4),
    );
  };
const host = (value: string) =>
  value
    .replace(/^\[|\]$/g, "")
    .replace(/\.+$/g, "")
    .toLowerCase();
const site = (value: string) => host(value).replace(/^www\./, "");
const effectivePort = (url: URL) =>
  url.port ? Number(url.port) : url.protocol === "https:" ? 443 : 80;
/** Match the starting host or www twin and permit only same-port edges or an ordinary HTTP upgrade. */
export function sameSiteAddress(address: string, start: string, from = start): boolean {
  try {
    const target = new URL(address),
      root = new URL(start),
      parent = new URL(from);
    return (
      ["http:", "https:"].includes(target.protocol) &&
      !target.username &&
      !target.password &&
      site(target.hostname) === site(root.hostname) &&
      ((target.protocol === parent.protocol && effectivePort(target) === effectivePort(parent)) ||
        (parent.protocol === "http:" &&
          target.protocol === "https:" &&
          effectivePort(parent) === 80 &&
          effectivePort(target) === 443))
    );
  } catch {
    return false;
  }
}
const normalized = (url: URL) => {
  const copy = new URL(url);
  copy.hash = "";
  return copy.href;
};
const normalizeOctets = (value: string) =>
  value
    .replace(/[^\p{ASCII}]/gu, (c) => encodeURIComponent(c))
    .replace(/%([0-9a-f]{2})/gi, (_all, hex: string) => {
      const character = String.fromCharCode(Number.parseInt(hex, 16));
      return /[a-z0-9._~-]/i.test(character) ? character : `%${hex.toUpperCase()}`;
    });
/** The longest matching Allow/Disallow across every matching agent group and wildcard group; Allow wins ties. */
export function robotsDecision(
  robots: string,
  path: string,
): { allowed: boolean; reason: "rule" | "complexity" } {
  const groups: { agents: string[]; rules: { allow: boolean; pattern: string }[] }[] = [];
  let group: (typeof groups)[number] | undefined;
  let agents = false;
  for (const raw of robots.replace(/^\ufeff/, "").split(/\r\n|\r|\n/)) {
    const line = raw.replace(/#.*/, "").trim();
    if (!line) continue;
    const colon = line.indexOf(":");
    if (colon < 0) continue;
    const name = line.slice(0, colon).trim().toLowerCase();
    const value = line.slice(colon + 1).trim();
    if (name === "user-agent") {
      if (!agents || !group) {
        group = { agents: [], rules: [] };
        groups.push(group);
      }
      group.agents.push(value.toLowerCase());
      agents = true;
    } else if (name === "allow" || name === "disallow") {
      agents = false;
      if (group && value)
        group.rules.push({ allow: name === "allow", pattern: normalizeOctets(value) });
    }
  }
  const target = normalizeOctets(path);
  const targetTokens = target.match(/%[0-9A-F]{2}|./g) ?? [];
  let score = -1;
  let allowed = true;
  let steps = 0;
  for (const g of groups.filter((g) =>
    g.agents.some((a) => a === "*" || a.split(/[\s/]/, 1)[0] === "smithable"),
  ))
    for (const rule of g.rules) {
      const anchored = rule.pattern.endsWith("$");
      const pattern = (anchored ? rule.pattern.slice(0, -1) : rule.pattern).replace(/\*+/g, "*");
      const tokens = pattern.match(/%[0-9A-F]{2}|./g) ?? [];
      const length = tokens.filter((token) => token !== "*").length;
      let matches = false;
      if (!pattern.includes("*"))
        matches = anchored ? target === pattern : target.startsWith(pattern);
      else {
        let state = new Uint8Array(targetTokens.length + 1);
        state[0] = 1;
        for (const token of tokens) {
          const next = new Uint8Array(targetTokens.length + 1);
          if (token === "*") next[0] = state[0]!;
          for (let j = 1; j <= targetTokens.length; j++) {
            if (++steps > 1_000_000) return { allowed: false, reason: "complexity" };
            next[j] =
              token === "*"
                ? state[j] || next[j - 1]
                  ? 1
                  : 0
                : state[j - 1] && token === targetTokens[j - 1]
                  ? 1
                  : 0;
          }
          state = next;
        }
        matches = anchored ? state[targetTokens.length] === 1 : state.some(Boolean);
      }
      if (matches && (length > score || (length === score && rule.allow))) {
        score = length;
        allowed = rule.allow;
      }
    }
  return { allowed, reason: "rule" };
}
export const allowedByRobots = (robots: string, path: string) =>
  robotsDecision(robots, path).allowed;

export interface SiteResponse {
  bytes: Uint8Array;
  url: string;
  type: string;
  requestedUrl: string;
  fromUrl?: string;
  depth: number;
  fetchedAt: string;
  evidence: {
    robotsUrl: string;
    robotsStatus: number;
    redirects: { from: string; to: string; status: number }[];
  };
}
export interface SiteFetchSnapshot {
  version: 1;
  startUrl: string;
  pages: number;
  pageAttempts: number;
  assets: number;
  assetAttempts: number;
  bytes: number;
  elapsedMs: number;
  stoppedReason?: string;
  diagnostics: string[];
}
function raster(bytes: Uint8Array, type: string): boolean {
  if (type === "image/jpeg") return bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255;
  if (type === "image/png")
    return bytes.length >= 8 && [137, 80, 78, 71, 13, 10, 26, 10].every((v, i) => bytes[i] === v);
  return (
    type === "image/webp" &&
    bytes.length >= 12 &&
    Buffer.from(bytes.slice(0, 4)).toString() === "RIFF" &&
    Buffer.from(bytes.slice(8, 12)).toString() === "WEBP"
  );
}
export type SiteLimits = { -readonly [K in keyof typeof SITE_LIMITS]: number };
export function siteFetchLimits(options: FetchOptions["limits"]): SiteLimits {
  const limits: SiteLimits = { ...SITE_LIMITS };
  for (const key of Object.keys(SITE_LIMITS) as (keyof typeof SITE_LIMITS)[]) {
    const value = options?.[key];
    if (value !== undefined)
      limits[key] =
        Number.isSafeInteger(value) && value >= 0 ? Math.min(value, SITE_LIMITS[key]) : 0;
  }
  return limits;
}
export function createSiteFetch(start: string, options: FetchOptions = {}) {
  const limits = siteFetchLimits(options.limits);
  const began = Date.now();
  const controller = new AbortController();
  const deadline = AbortSignal.timeout(limits.milliseconds);
  const signal = AbortSignal.any([
    controller.signal,
    deadline,
    ...(options.signal ? [options.signal] : []),
  ]);
  const refuse = options.refuse ?? isBlocked;
  const resolver = options.resolve ?? resolveHost;
  let startUrl: URL;
  try {
    startUrl = new URL(start.trim());
    startUrl.hash = "";
  } catch {
    throw new SiteFetchError(
      `"${start}" is not a web address; it starts with https://.`,
      false,
      "url",
    );
  }
  const snapshot: SiteFetchSnapshot = {
    version: 1,
    startUrl: startUrl.href,
    pages: 0,
    pageAttempts: 0,
    assets: 0,
    assetAttempts: 0,
    bytes: 0,
    elapsedMs: 0,
    diagnostics: [],
  };
  const known = new Map<string, number>();
  const pages = new Map<string, Promise<SiteResponse>>();
  const assets = new Map<string, Promise<SiteResponse>>();
  const policies = new Map<string, Promise<{ text: string; url: string; status: number }>>();
  const failure = (code: string, message: string, retryable = false): never => {
    if (["site-timeout", "site-bytes", "site-pages", "site-assets", "site-depth"].includes(code))
      snapshot.stoppedReason ??= code;
    const words = message.slice(0, 1000);
    if (!snapshot.diagnostics.includes(words) && snapshot.diagnostics.length < 64)
      snapshot.diagnostics.push(words);
    throw new SiteFetchError(words, retryable, code);
  };
  const active = () => {
    if (options.signal?.aborted) throw options.signal.reason;
    if (controller.signal.aborted && controller.signal.reason instanceof SiteFetchError)
      throw controller.signal.reason;
    if (signal.aborted || Date.now() - began >= limits.milliseconds)
      failure(
        "site-timeout",
        `The site took longer than ${Math.round(limits.milliseconds / 1000)} seconds.`,
        true,
      );
  };
  function check(url: URL, from?: URL) {
    if (url.href.length > 2048)
      failure("url-length", "The web address is longer than 2048 characters.");
    if (!["http:", "https:"].includes(url.protocol))
      failure("url", `"${url.href}" is not a web address; it starts with https://.`);
    if (url.username || url.password)
      failure("credentials", "A web address with a name and password in it is not read.");
    if (
      options.ports
        ? !options.ports.includes(effectivePort(url))
        : effectivePort(url) !== (url.protocol === "https:" ? 443 : 80)
    )
      failure("port", `${url.host} is not on the web's usual ports.`);
    const hostname = host(url.hostname);
    if (
      (options.ownDomains ?? []).some(
        (d) => hostname === host(d) || hostname.endsWith(`.${host(d)}`),
      )
    )
      failure("ssrf", "Smithable's own addresses cannot be the starting page.");
    if (isIP(hostname) && refuse(hostname)) failure("ssrf", `${hostname} is not a public address.`);
    if (
      hostname === "localhost" ||
      hostname.endsWith(".localhost") ||
      hostname.endsWith(".internal") ||
      hostname.endsWith(".local")
    )
      failure("ssrf", `${hostname} is not a public address.`);
    if (site(url.hostname) !== site(startUrl.hostname))
      failure(
        "site-scope",
        `${from?.href ?? startUrl.href} redirects to another site (${url.hostname}).`,
      );
    if (from && !sameSiteAddress(url.href, startUrl.href, from.href))
      failure(
        "site-scope",
        "Only the same site's addresses and an HTTP to HTTPS upgrade may be read; ports cannot change.",
      );
  }
  check(startUrl);
  const redirectUrl = (location: string, at: URL) => {
    try {
      const next = new URL(location, at);
      next.hash = "";
      return next;
    } catch {
      return failure("redirect-url", "The site redirects to an invalid web address.");
    }
  };
  async function once(
    url: URL,
    max: number,
  ): Promise<{ status: number; type: string; location: string | undefined; bytes: Buffer }> {
    active();
    check(url);
    const requestSignal = AbortSignal.any([signal, AbortSignal.timeout(PAGE_TIMEOUT)]);
    try {
      return await new Promise((resolve, reject) => {
        const req = (url.protocol === "https:" ? httpsRequest : httpRequest)(
          url,
          {
            method: "GET",
            agent: false,
            signal: requestSignal,
            headers: {
              "user-agent": options.userAgent ?? USER_AGENT,
              accept: "text/html,image/jpeg,image/png,image/webp;q=0.9,*/*;q=0.5",
              "accept-encoding": "identity",
            },
            lookup: guardedLookup(refuse, resolver),
          },
          (response: IncomingMessage) => {
            response.on("error", reject);
            const status = response.statusCode ?? 0;
            const type = String(response.headers["content-type"] ?? "")
              .split(";")[0]!
              .trim()
              .toLowerCase();
            const location = response.headers.location;
            // Never drain unneeded redirect/error bodies: no unbounded transfer hidden outside the byte budget.
            if ((status >= 300 && status < 400) || status >= 400) {
              response.destroy();
              resolve({ status, type, location, bytes: Buffer.alloc(0) });
              return;
            }
            if (
              response.headers["content-encoding"] &&
              response.headers["content-encoding"] !== "identity"
            ) {
              response.destroy();
              reject(
                new SiteFetchError(
                  "Compressed site responses are not read.",
                  false,
                  "content-encoding",
                ),
              );
              return;
            }
            const chunks: Buffer[] = [];
            let length = 0;
            response.on("data", (chunk: Buffer) => {
              try {
                active();
                const remaining = limits.bytes - snapshot.bytes;
                snapshot.bytes += Math.min(chunk.length, remaining);
                length += chunk.length;
                if (chunk.length > remaining) {
                  const error = new SiteFetchError(
                    `The site's responses exceed ${Math.round(limits.bytes / 1024 / 1024)} MB.`,
                    false,
                    "site-bytes",
                  );
                  snapshot.stoppedReason ??= error.code;
                  if (
                    snapshot.diagnostics.length < 64 &&
                    !snapshot.diagnostics.includes(error.message)
                  )
                    snapshot.diagnostics.push(error.message);
                  reject(error);
                  controller.abort(error);
                  response.destroy();
                  return;
                }
                if (length > max)
                  failure(
                    "response-size",
                    `The response is larger than ${max >= 1024 * 1024 ? `${max / 1024 / 1024} MB` : `${Math.round(max / 1024)} KB`}.`,
                  );
                chunks.push(chunk);
              } catch (error) {
                reject(error);
                response.destroy();
              }
            });
            response.on("end", () =>
              resolve({ status, type, location, bytes: Buffer.concat(chunks) }),
            );
            response.on("aborted", () =>
              reject(
                new SiteFetchError("The site response ended early.", true, "response-interrupted"),
              ),
            );
          },
        );
        req.on("error", reject);
        req.end();
      });
    } catch (error) {
      if (options.signal?.aborted) throw options.signal.reason;
      if (error instanceof SiteFetchError) throw error;
      const cause = (error as { cause?: unknown }).cause;
      if (cause instanceof SiteFetchError) throw cause;
      if (signal.aborted) active();
      throw new SiteFetchError(
        `${url.href} could not be read.`.slice(0, 1000),
        true,
        requestSignal.aborted ? "request-timeout" : "network",
      );
    }
  }
  async function robots(url: URL) {
    const origin = url.origin;
    let pending = policies.get(origin);
    if (!pending) {
      pending = (async () => {
        let at = new URL("/robots.txt", url);
        const visited = new Set<string>();
        for (let hop = 0; hop <= limits.redirects; hop++) {
          active();
          if (visited.has(at.href))
            failure("robots-redirect", "The site's robots.txt redirects in a loop.");
          visited.add(at.href);
          const result = await once(at, limits.robotsBytes);
          if (result.status >= 300 && result.status < 400 && result.location) {
            if (hop === limits.redirects)
              failure("robots-redirect", "The site's robots.txt redirects more than three times.");
            const next = redirectUrl(result.location, at);
            check(next, at);
            at = next;
            continue;
          }
          if (result.status >= 400 && result.status < 500)
            return { text: "", url: at.href, status: result.status };
          if (result.status < 200 || result.status >= 300)
            failure(
              "robots-unavailable",
              `${at.host}'s robots.txt is unavailable; the site is not read.`,
              result.status >= 500 || result.status === 0,
            );
          const policy = {
            text: result.bytes.toString("utf8"),
            url: at.href,
            status: result.status,
          };
          if (at.pathname === "/robots.txt" && !at.search)
            policies.set(at.origin, Promise.resolve(policy));
          return policy;
        }
        return failure("robots-redirect", "The site's robots.txt could not be read.");
      })();
      policies.set(origin, pending);
    }
    return pending;
  }
  async function content(
    address: string,
    fromUrl: string | undefined,
    kind: "page" | "asset",
  ): Promise<SiteResponse> {
    active();
    let url: URL;
    try {
      url = new URL(address, fromUrl ?? startUrl);
    } catch {
      return failure("url", "The discovered address is not a web address.");
    }
    url.hash = "";
    let depth = 0;
    if (fromUrl) {
      const parent = new URL(fromUrl);
      const parentDepth = known.get(normalized(parent));
      if (parentDepth === undefined)
        return failure("source-page", "The referring page has not been read in this crawl.");
      depth = kind === "page" ? parentDepth + 1 : parentDepth;
      check(url, parent);
    } else if (kind === "asset" || normalized(url) !== normalized(startUrl))
      failure("source-page", "A discovered address needs the page it came from.");
    check(url);
    if (depth > limits.depth)
      failure(
        "site-depth",
        `The site reading stops after ${limits.depth} links from the first page.`,
      );
    const cache = kind === "page" ? pages : assets;
    const key = normalized(url);
    const cached = cache.get(key);
    if (cached) return cached;
    if (kind === "asset") {
      if (!options.allowAssets)
        failure(
          "asset-authorization",
          "Original pictures need authorization before they are downloaded.",
        );
      if (snapshot.assetAttempts >= limits.assets)
        failure("site-assets", `At most ${limits.assets} pictures are downloaded.`);
      snapshot.assetAttempts++;
    } else {
      if (snapshot.pageAttempts >= limits.pages)
        failure("site-pages", `At most ${limits.pages} pages are read.`);
      snapshot.pageAttempts++;
    }
    const requestedUrl = url.href;
    const pending = (async () => {
      let at = url;
      const redirects: SiteResponse["evidence"]["redirects"] = [];
      const visited = new Set<string>();
      for (let hop = 0; hop <= limits.redirects; hop++) {
        active();
        if (visited.has(at.href)) failure("redirect-loop", "The page redirects in a loop.");
        visited.add(at.href);
        const policy = await robots(at);
        const permission = robotsDecision(policy.text, at.pathname + at.search);
        if (permission.reason === "complexity")
          failure(
            "robots-complexity",
            "The site's robots policy is too complex to evaluate safely.",
          );
        if (!permission.allowed)
          failure("robots-denied", `${at.hostname}'s robots.txt asks not to read ${at.pathname}.`);
        const answer = await once(at, kind === "page" ? MAX_PAGE : limits.assetBytes);
        if (answer.status >= 300 && answer.status < 400 && answer.location) {
          if (hop === limits.redirects)
            failure("redirect-limit", `${requestedUrl} redirects more than three times.`);
          const next = redirectUrl(answer.location, at);
          check(next, at);
          redirects.push({ from: at.href, to: next.href, status: answer.status });
          at = next;
          continue;
        }
        if (answer.status < 200 || answer.status >= 300)
          failure(
            "http-status",
            `${at.href} answered ${answer.status}.`,
            answer.status === 408 || answer.status === 429 || answer.status >= 500,
          );
        if (kind === "page" && !["text/html", "application/xhtml+xml"].includes(answer.type))
          failure("content-type", `${at.href} is not a web page.`);
        if (kind === "asset" && !raster(answer.bytes, answer.type))
          failure("asset-type", "The picture is not a supported JPEG, PNG or WebP file.");
        const result: SiteResponse = {
          bytes: answer.bytes,
          url: at.href,
          type: answer.type,
          requestedUrl,
          ...(fromUrl ? { fromUrl } : {}),
          depth,
          fetchedAt: new Date().toISOString(),
          evidence: { robotsUrl: policy.url, robotsStatus: policy.status, redirects },
        };
        if (kind === "page") {
          snapshot.pages++;
          known.set(requestedUrl, depth);
          known.set(at.href, depth);
          pages.set(at.href, Promise.resolve(result));
        } else {
          snapshot.assets++;
          assets.set(at.href, Promise.resolve(result));
        }
        return result;
      }
      return failure("redirect-limit", "The page could not be read.");
    })();
    cache.set(key, pending);
    return pending;
  }
  return {
    page: (url: string, fromUrl?: string) => content(url, fromUrl, "page"),
    asset: (url: string, fromUrl: string) => content(url, fromUrl, "asset"),
    signal,
    snapshot: (): SiteFetchSnapshot => ({
      ...snapshot,
      elapsedMs: Math.min(Date.now() - began, limits.milliseconds),
      ...(deadline.aborted && !snapshot.stoppedReason ? { stoppedReason: "site-timeout" } : {}),
      diagnostics: [...snapshot.diagnostics],
    }),
  };
}
