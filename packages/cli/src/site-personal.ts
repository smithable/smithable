// Deterministic local projection. The map is private source data, never model context.
import { createHmac, randomBytes } from "node:crypto";
import { parse, TextNode } from "node-html-parser";
import type { SiteImageContext } from "./image-context.js";
import type { SiteSourceCorpus } from "./site-bundle.js";
import {
  describeSiteFacts,
  isSiteBusinessType,
  type SiteFact,
  type SiteFacts,
} from "./site-facts.js";
import { integer, list, record, string } from "./site-validation.js";

export type SiteContentMode = "sample" | "full";
export type SitePersonalKind = "name" | "email" | "phone" | "address" | "identity";
export interface SitePersonalMap {
  version: 1;
  key: string;
  classification?: { business: boolean; person: boolean };
  nextPhoneOrdinal?: number;
  entries: {
    id: string;
    kind: SitePersonalKind;
    ordinal: number;
    original: string;
    replacement: string;
  }[];
  handles: { id: string; original: string; handle: string }[];
}
export interface SiteModelProjection {
  version: 1;
  contentMode: SiteContentMode;
  facts: SiteFacts;
  images: SiteImageContext[];
  description: string;
  personal: { version: 1; counts: Record<SitePersonalKind, number> };
}
const KINDS: SitePersonalKind[] = ["name", "email", "phone", "address", "identity"];
// Version 2 expands the starter-name collision pool; safe version 1 choices stay pinned.
export const SITE_PERSONAL_SAMPLES = {
  version: 2,
  names: [
    "Elin Sjöberg",
    "Omar Haddad",
    "Emma Lindqvist",
    "Oskar Berg",
    "Aino Virtanen",
    "Nils Ek",
    "Maja Lindqvist",
    "Tomas Berg",
  ],
} as const;
const MAX_TEXT = 8 * 1024 * 1024;
const MAX_ENTRIES = 2000;
const ORDINARY_NAMES = new Set(
  "a an and art as at be bill black blue brown business by call example code company contact data day field for from grace green hill home in is it june lane mark may model name of on or our page person private product public record red rose sample service shop source staff street studio team text the their they this to type us user was we white will with workshop you your".split(
    " ",
  ),
);
function nameToken(value: string, allowOrdinary = false): boolean {
  const text = normalizeSitePersonalText(value);
  return (
    /^[\p{L}][\p{L}\p{M}’'-]+$/u.test(text) &&
    (/^\p{Lu}/u.test(text) || !/[\p{Lu}\p{Ll}]/u.test(text)) &&
    (allowOrdinary || !ORDINARY_NAMES.has(text.toLowerCase()))
  );
}

const HTML_REFERENCE = /&(?:#x[\da-f]{1,8};?|#\d{1,8};?|[a-z][a-z\d]{0,31};?)/giu;
const PERCENT_SCALAR =
  /%(?:[0-7][a-f\d]|[cd][a-f\d]%[89ab][a-f\d]|e[a-f\d](?:%[89ab][a-f\d]){2}|f[0-4](?:%[89ab][a-f\d]){3})/giu;
const decodePercent = (part: string) => {
  try {
    const decoded = decodeURIComponent(part);
    // Encoded controls in otherwise ordinary text remain literal; raw controls still refuse.
    wellFormed(decoded);
    return decoded;
  } catch {
    return part;
  }
};

/** A bare person-shaped label is not, by itself, evidence of a trading name. */
const BUSINESS_WORD =
  /(?<![\p{L}\p{N}])(?:photography|photographer|workshop|studio|salon|shop|store|cafe|café|bakery|cuts|repair|repairs|yoga|consulting|services|company|restaurant|hotel|harbour|harbor|ltd|llc|inc|ab|oy|frisör|salong|bageri|massage|verkstad|kiosk|butik|gård)(?![\p{L}\p{N}])/iu;
export function isSitePersonNameShape(value: string): boolean {
  const text = normalizeSitePersonalText(value);
  return (
    /^(?:\p{Lu}[\p{L}’'-]+\s+){1,3}\p{Lu}[\p{L}’'-]+$/u.test(text) && !BUSINESS_WORD.test(text)
  );
}
const keyed = (key: string, kind: string, value: string) =>
  createHmac("sha256", Buffer.from(key, "hex")).update(`${kind}\0${value}`).digest("hex");
function wellFormed(value: string): void {
  if (value.includes("\ufffd") || Buffer.byteLength(value) > MAX_TEXT)
    throw new Error("Source text cannot be normalized safely.");
  for (let i = 0; i < value.length; i++) {
    const code = value.charCodeAt(i);
    if ((code < 32 && ![9, 10, 13].includes(code)) || (code >= 127 && code <= 159))
      throw new Error("Malformed source text control character.");
    if (code >= 0xd800 && code <= 0xdbff) {
      const next = value.charCodeAt(++i);
      if (!(next >= 0xdc00 && next <= 0xdfff)) throw new Error("Malformed source text encoding.");
    } else if (code >= 0xdc00 && code <= 0xdfff) throw new Error("Malformed source text encoding.");
  }
}
/** Bounded canonical decoding also applies to output, repair messages, and metadata. */
export function normalizeSitePersonalText(value: string): string {
  wellFormed(value);
  if (/\\{9}/u.test(value)) throw new Error("Source text has excessive encoding layers.");
  let text = value;
  for (let round = 0; round < 4; round++) {
    const before = text;
    text = text.normalize("NFKC").replace(/\p{Cf}/gu, "");
    text = text.replace(new RegExp(HTML_REFERENCE), (part) => new TextNode(part).text);
    text = text.replace(new RegExp(PERCENT_SCALAR), decodePercent);
    text = text.replace(/(?:\\{1,8}u[a-fA-F\d]{4})+/gu, (match) => {
      try {
        return JSON.parse(`"${match.replace(/\\{1,8}u/gi, "\\u")}"`) as string;
      } catch {
        throw new Error("Malformed source text encoding.");
      }
    });
    text = text
      .replace(/\\{1,8}[nrt]/g, (part) =>
        part.endsWith("n") ? "\n" : part.endsWith("r") ? "\r" : "\t",
      )
      .replace(/\\{1,8}\//g, "/");
    wellFormed(text);
    if (text === before) return text.replace(/\s+/gu, " ").trim();
  }
  throw new Error("Source text has excessive encoding layers.");
}
const canonical = (text: string) => normalizeSitePersonalText(text).toLowerCase();
function legacySample(kind: SitePersonalKind, ordinal: number, original = ""): string {
  const n = ordinal + 1;
  const base =
    kind === "name"
      ? `${SITE_PERSONAL_SAMPLES.names[ordinal % 6]} (sample ${n})`
      : kind === "email"
        ? `sample-${n}@example.com`
        : kind === "phone"
          ? `+999 000 ${String(n).padStart(6, "0")}`
          : kind === "address"
            ? `Sample Street ${n}`
            : `Sample business ${n}`;
  if (canonical(original) !== canonical(base)) return base;
  return kind === "email"
    ? `sample-${n}-preview@example.com`
    : kind === "phone"
      ? `+999 001 ${String(n).padStart(6, "0")}`
      : `${base} (preview)`;
}
function sampleCandidate(entry: SitePersonalMap["entries"][number], value: string): boolean {
  const n = entry.ordinal + 1;
  if (value === legacySample(entry.kind, entry.ordinal, entry.original)) return true;
  if (
    entry.kind === "name" &&
    SITE_PERSONAL_SAMPLES.names.some((name) => value === `${name} (sample ${n})`)
  )
    return true;
  const match =
    entry.kind === "name"
      ? /^Person (\d+) \(sample\)$/.exec(value)
      : entry.kind === "email"
        ? /^sample-(\d+)@example\.com$/.exec(value)
        : entry.kind === "phone"
          ? /^\+999 000 (\d+)$/.exec(value)
          : entry.kind === "address"
            ? /^Sample Street (\d+)$/.exec(value)
            : /^Preview (\d+)$/.exec(value);
  if (!match) return false;
  const slot = Number(match[1]);
  return (
    Number.isSafeInteger(slot) &&
    slot >= n &&
    slot <= n + (MAX_ENTRIES + 1) * MAX_ENTRIES &&
    (slot - n) % MAX_ENTRIES === 0 &&
    (entry.kind !== "phone" || value === `+999 000 ${String(slot).padStart(6, "0")}`)
  );
}
/** Allocate against the whole detected set. Existing IDs/ordinals remain pinned; only a
 * newly colliding display value moves to the next deterministic candidate. */
function allocateSamples(entries: SitePersonalMap["entries"]): SitePersonalMap["entries"] {
  const full = new Set(entries.map((entry) => canonical(entry.original)));
  const phone = new Set(
    entries
      .filter((entry) => entry.kind === "phone")
      .map((entry) => entry.original.replace(/\D/g, "")),
  );
  const phrases = entries.flatMap((entry) => {
    const text = normalizeSitePersonalText(entry.original);
    if (entry.kind === "name")
      return [
        ...(text.split(/\s+/u).length > 1 || nameToken(text) ? [text] : []),
        ...text.split(/[\s.-]+/u).filter((part) => nameToken(part, true)),
      ];
    if (entry.kind === "identity")
      return text.split(/\s+/u).length > 1 || nameToken(text) ? [text] : [];
    return entry.kind === "address" && /\p{L}/u.test(text) ? [text] : [];
  });
  const source = [...new Set(phrases)]
    .map((text) => {
      const first = /^[\p{L}\p{N}]/u.test(text) ? "(?<![\\p{L}\\p{N}])" : "";
      const last = /[\p{L}\p{N}]$/u.test(text) ? "(?![\\p{L}\\p{N}])" : "";
      return `${first}${escapePattern(text).replace(/ /g, "\\s+")}${last}`;
    })
    .join("|");
  if (source.length > 128000) throw new Error("Source sample guard exceeds its bound.");
  const blocked = source ? new RegExp(source, "iu") : undefined;
  const safe = (kind: SitePersonalKind, value: string) =>
    !full.has(canonical(value)) &&
    !blocked?.test(normalizeSitePersonalText(value)) &&
    !(kind === "phone" && [...phone].some((digits) => value.replace(/\D/g, "").includes(digits)));
  return entries.map((entry) => {
    const n = entry.ordinal + 1;
    if (sampleCandidate(entry, entry.replacement) && safe(entry.kind, entry.replacement))
      return entry;
    const candidates: string[] = [];
    if (entry.kind === "name") {
      for (let offset = 0; offset < SITE_PERSONAL_SAMPLES.names.length; offset++)
        candidates.push(
          `${SITE_PERSONAL_SAMPLES.names[((entry.ordinal % 6) + offset) % SITE_PERSONAL_SAMPLES.names.length]} (sample ${n})`,
        );
    } else candidates.push(legacySample(entry.kind, entry.ordinal, entry.original));
    for (const replacement of candidates)
      if (safe(entry.kind, replacement)) return { ...entry, replacement };
    for (let offset = 1; offset <= MAX_ENTRIES + 1; offset++) {
      const slot = n + offset * MAX_ENTRIES;
      const replacement =
        entry.kind === "name"
          ? `Person ${slot} (sample)`
          : entry.kind === "email"
            ? `sample-${slot}@example.com`
            : entry.kind === "phone"
              ? `+999 000 ${String(slot).padStart(6, "0")}`
              : entry.kind === "address"
                ? `Sample Street ${slot}`
                : `Preview ${slot}`;
      if (safe(entry.kind, replacement)) return { ...entry, replacement };
    }
    throw new Error("No safe sample value fits the bounded source context.");
  });
}
export function parseSitePersonalMap(value: unknown): SitePersonalMap {
  const item = record(value, [
    "version",
    "key",
    "entries",
    "handles",
    "classification",
    "nextPhoneOrdinal",
  ]);
  if (item.version !== 1 || typeof item.key !== "string" || !/^[a-f\d]{64}$/.test(item.key))
    throw new Error("Invalid private source map.");
  const key = item.key,
    ids = new Set<string>(),
    seen = new Set<string>(),
    ordinals = new Map<string, number>();
  const entries = list(item.entries, MAX_ENTRIES).map((value) => {
    const entry = record(value, ["id", "kind", "ordinal", "original", "replacement"]);
    if (!KINDS.includes(entry.kind as SitePersonalKind))
      throw new Error("Invalid source replacement kind.");
    const kind = entry.kind as SitePersonalKind,
      original = string(entry.original, 1000),
      ordinal = integer(entry.ordinal, MAX_ENTRIES),
      id = keyed(key, kind, canonical(original));
    if (!canonical(original)) throw new Error("An identifier has no searchable characters.");
    if (
      kind === "phone" &&
      (!/^\+?[\d\s().-]+$/.test(original) || original.replace(/\D/g, "").length < 1)
    )
      throw new Error("Invalid source phone identifier.");
    if (
      entry.id !== id ||
      ids.has(id) ||
      seen.has(canonical(original)) ||
      (kind === "phone"
        ? ordinal < (ordinals.get(kind) ?? 0)
        : ordinal !== (ordinals.get(kind) ?? 0))
    )
      throw new Error("Invalid source replacement mapping.");
    if (kind === "email" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(original))
      throw new Error("Invalid source email identifier.");
    ids.add(id);
    seen.add(canonical(original));
    ordinals.set(kind, ordinal + 1);
    return { id, kind, ordinal, original, replacement: string(entry.replacement, 1000) };
  });
  const handles = list(item.handles, 5000).map((value, index) => {
    const entry = record(value, ["id", "original", "handle"]),
      original = string(entry.original, 4096),
      id = keyed(key, "url", original),
      handle = `https://source.invalid/ref/${index + 1}`;
    if (entry.id !== id || entry.handle !== handle || ids.has(id))
      throw new Error("Invalid opaque source handle.");
    ids.add(id);
    return { id, original, handle };
  });
  const classification =
    item.classification === undefined
      ? { business: false, person: false }
      : record(item.classification, ["business", "person"]);
  if (typeof classification.business !== "boolean" || typeof classification.person !== "boolean")
    throw new Error("Invalid private source classification.");
  for (const entry of entries)
    if (!sampleCandidate(entry, entry.replacement))
      throw new Error("Invalid source replacement mapping.");
  const historicalNext =
    Math.max(
      -1,
      ...entries.filter((entry) => entry.kind === "phone").map((entry) => entry.ordinal),
    ) + 1;
  const nextPhoneOrdinal =
    item.nextPhoneOrdinal === undefined
      ? historicalNext
      : integer(item.nextPhoneOrdinal, MAX_ENTRIES + 1);
  if (nextPhoneOrdinal < historicalNext)
    throw new Error("Invalid source phone allocation watermark.");
  const retiredPhones = entries.some(
    (entry) => entry.kind === "phone" && entry.original.replace(/\D/g, "").length < 7,
  );
  const allocated = allocateSamples(
    entries.filter(
      (entry) => entry.kind !== "phone" || entry.original.replace(/\D/g, "").length >= 7,
    ),
  );
  return {
    version: 1,
    key,
    entries: allocated,
    handles,
    ...(retiredPhones || item.nextPhoneOrdinal !== undefined ? { nextPhoneOrdinal } : {}),
    classification: { business: classification.business, person: classification.person },
  };
}
const escapePattern = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
interface SearchText {
  text: string;
  starts: number[];
  ends: number[];
}
function searchable(value: string, queryPlus = false): SearchText {
  wellFormed(value);
  if (/\\{9}/u.test(value)) throw new Error("Source text has excessive encoding layers.");
  let current: SearchText = {
    text: value,
    starts: Array.from({ length: value.length }, (_, i) => i),
    ends: Array.from({ length: value.length }, (_, i) => i + 1),
  };
  const transform = (regex: RegExp, decode: (value: string, index: number) => string) => {
    const changes: { at: number; length: number; next: string }[] = [];
    for (const match of current.text.matchAll(regex)) {
      const next = decode(match[0], match.index ?? 0);
      if (next !== match[0]) {
        changes.push({ at: match.index ?? 0, length: match[0].length, next });
        if (changes.length > 100000)
          throw new Error("Text normalization exceeds its fragment bound.");
      }
    }
    if (!changes.length) return;
    const text: string[] = [],
      starts: number[] = [],
      ends: number[] = [];
    let at = 0;
    for (const change of changes) {
      text.push(current.text.slice(at, change.at));
      for (let i = at; i < change.at; i++) {
        starts.push(current.starts[i] ?? i);
        ends.push(current.ends[i] ?? i + 1);
      }
      text.push(change.next);
      for (let i = 0; i < change.next.length; i++) {
        starts.push(current.starts[change.at] ?? change.at);
        ends.push(current.ends[change.at + change.length - 1] ?? change.at + change.length);
      }
      at = change.at + change.length;
    }
    text.push(current.text.slice(at));
    for (let i = at; i < current.text.length; i++) {
      starts.push(current.starts[i] ?? i);
      ends.push(current.ends[i] ?? i + 1);
    }
    current = { text: text.join(""), starts, ends };
  };
  for (let round = 0; round < 4; round++) {
    const before = current.text;
    if (current.text !== current.text.normalize("NFKC")) {
      // Grapheme boundaries preserve composed and decomposed names across scripts.
      const segmenter = new Intl.Segmenter("und", { granularity: "grapheme" }),
        parts: string[] = [],
        starts: number[] = [],
        ends: number[] = [];
      for (const item of segmenter.segment(current.text)) {
        const next = item.segment.normalize("NFKC");
        parts.push(next);
        for (let i = 0; i < next.length; i++) {
          starts.push(current.starts[item.index] ?? item.index);
          ends.push(
            current.ends[item.index + item.segment.length - 1] ?? item.index + item.segment.length,
          );
        }
      }
      current = { text: parts.join(""), starts, ends };
    }
    transform(/\p{Cf}/gu, () => "");
    transform(new RegExp(HTML_REFERENCE), (text) => new TextNode(text).text);
    transform(new RegExp(PERCENT_SCALAR), decodePercent);
    transform(
      /\\{1,8}u[dD][89aAbB][a-fA-F\d]{2}\\{1,8}u[dD][c-fC-F][a-fA-F\d]{2}|\\{1,8}u[a-fA-F\d]{4}/gu,
      (text) => JSON.parse(`"${text.replace(/\\{1,8}u/gi, "\\u")}"`) as string,
    );
    transform(/\\{1,8}[nrt]/g, (text) =>
      text.endsWith("n") ? "\n" : text.endsWith("r") ? "\r" : "\t",
    );
    transform(/\\{1,8}\//g, () => "/");
    wellFormed(current.text);
    if (current.text === before) {
      if (queryPlus && current.text.includes("+")) {
        const ranges: { start: number; end: number }[] = [];
        const fragments: { start: number; end: number }[] = [];
        for (const fragment of current.text.matchAll(/#[^\s<>"'`)\]}]*/gu)) {
          fragments.push({ start: fragment.index, end: fragment.index + fragment[0].length });
          if (fragments.length > 10000) throw new Error("Query normalization exceeds its bound.");
        }
        let examined = 0,
          fragmentIndex = 0;
        for (const match of current.text.matchAll(/\?/g)) {
          if (++examined > 10000) throw new Error("Query normalization exceeds its bound.");
          const start = match.index ?? 0;
          while (fragmentIndex < fragments.length && (fragments[fragmentIndex]?.end ?? 0) <= start)
            fragmentIndex++;
          const fragment = fragments[fragmentIndex];
          if (fragment && start >= fragment.start && start < fragment.end) continue;
          const tail = current.text.slice(start + 1, start + 4097),
            delimiter = tail.search(/[\s<>"'`)\]}#]/u),
            query = tail.slice(0, delimiter < 0 ? tail.length : delimiter);
          let offset = 0;
          for (const parameter of query.split("&")) {
            const equals = parameter.indexOf("=");
            if (equals >= 0 && equals + 1 < parameter.length) {
              ranges.push({
                start: start + 1 + offset + equals + 1,
                end: start + 1 + offset + parameter.length,
              });
              if (ranges.length > 10000) throw new Error("Query normalization exceeds its bound.");
            }
            offset += parameter.length + 1;
          }
        }
        ranges.sort((a, b) => a.start - b.start || a.end - b.end);
        let range = 0;
        transform(/\+/g, (part, index) => {
          while (range < ranges.length && (ranges[range]?.end ?? 0) <= index) range++;
          const active = ranges[range];
          if (
            !active ||
            index < active.start ||
            value.slice(current.starts[index], current.ends[index]) !== "+" ||
            (current.text[index - 1] === "=" && /\d/.test(current.text[index + 1] ?? ""))
          )
            return part;
          return " ";
        });
      }
      transform(/\s+/gu, () => " ");
      return current;
    }
  }
  throw new Error("Source text has excessive encoding layers.");
}
/** Search normalized text, splicing only matched source ranges. Single names are visible
 * text only; ordinary-word names also require a person context. Keys and code keep identifiers. */
export function replaceSitePersonalText(
  value: string,
  map: SitePersonalMap,
  options: { preserveSamples?: boolean; context?: "text" | "value" | "name" | "key" | "code" } = {},
): string {
  wellFormed(value);
  for (const match of value.matchAll(/data:/giu)) {
    const header = value.slice((match.index ?? 0) + 5, (match.index ?? 0) + 261),
      comma = header.indexOf(",");
    if (
      comma >= 0 &&
      !/\s/u.test(header.slice(0, comma)) &&
      /;base64$/iu.test(header.slice(0, comma))
    )
      throw new Error("Encoded source blobs are not model context.");
  }
  for (const entry of map.entries) {
    const encoded = Buffer.from(entry.original).toString("base64");
    if (encoded.length >= 8 && value.includes(encoded))
      throw new Error("Encoded source identifiers are not model context.");
  }
  type Row = {
    original: string;
    replacement: string;
    kind: SitePersonalKind | "url";
    ordinal: number;
    derived: boolean;
    normalized: string;
    key: string;
    single: boolean;
    pattern: string;
  };
  const selected = new Map<string, Row>();
  const visible = options.context !== "code" && options.context !== "key";
  const insert = (
    entry: {
      original: string;
      replacement: string;
      kind: SitePersonalKind | "url";
      ordinal: number;
    },
    derived = false,
  ) => {
    const normalized = normalizeSitePersonalText(entry.original);
    let key: string,
      pattern: string,
      single = false;
    const first = /^[\p{L}\p{N}]/u.test(normalized) ? "(?<![\\p{L}\\p{N}])" : "";
    const last = /[\p{L}\p{N}]$/u.test(normalized) ? "(?![\\p{L}\\p{N}])" : "";
    if (entry.kind === "url") {
      key = `url:${canonical(normalized)}`;
      pattern = `${escapePattern(normalized)}(?=$|[\\s<>"'\\x60)\\]}]|[.,;!?](?=$|[\\s<>"'\\x60)\\]}]))`;
    } else if (
      entry.kind === "phone" ||
      (/^\+?[\d\s().-]+$/.test(normalized) && normalized.replace(/\D/g, "").length >= 7)
    ) {
      const digits = normalized.replace(/\D/g, "");
      if (digits.length < 7) return;
      key = `phone:${digits}`;
      pattern = `(?<![\\p{L}\\p{N}])\\+?\\(?${digits.split("").map(escapePattern).join("[\\s().+-]*")}${normalized.endsWith(")") ? "\\)?" : ""}(?![\\p{L}\\p{N}])`;
    } else if (entry.kind === "identity" && !/\s/u.test(normalized)) {
      if (/^[\p{L}\p{M}]+$/u.test(normalized) && !visible) return;
      if (ORDINARY_NAMES.has(normalized.toLowerCase())) {
        if (!visible) return;
        single = true;
        key = `single:${canonical(normalized)}`;
      } else key = `literal:${canonical(normalized)}`;
      pattern = `${first}${escapePattern(normalized)}${last}`;
    } else if (entry.kind === "name" || entry.kind === "identity") {
      const tokens = normalized.split(/[\s._-]+/u).filter(Boolean);
      if (!tokens.length) return;
      if (!/\s/u.test(normalized)) {
        if (!visible || !nameToken(normalized, true)) return;
        single = true;
        key = `single:${canonical(normalized)}`;
      } else key = `name:${canonical(tokens.join(""))}`;
      pattern = single
        ? `${first}${escapePattern(normalized)}${last}`
        : `${first}${tokens.map(escapePattern).join("[\\s._-]*")}${last}`;
    } else {
      key = `literal:${canonical(normalized)}`;
      pattern = `${first}${escapePattern(normalized).replace(/ /g, "\\s+")}${last}`;
    }
    if (!selected.has(key))
      selected.set(key, { ...entry, derived, normalized, key, single, pattern });
  };
  const explicit = [...map.entries].sort((a, b) => a.ordinal - b.ordinal);
  for (const entry of explicit) insert(entry);
  for (const entry of explicit.filter(
    (entry) => entry.kind === "name" && entry.original.split(/\s+/u).length > 1,
  ))
    for (const original of entry.original.split(/[\s.-]+/u).filter((part) => nameToken(part, true)))
      insert({ ...entry, original }, true);
  for (const [ordinal, handle] of map.handles.entries())
    insert({ original: handle.original, replacement: handle.handle, kind: "url", ordinal });
  const rows = [...selected.values()].sort(
    (a, b) =>
      b.normalized.length - a.normalized.length ||
      Number(a.derived) - Number(b.derived) ||
      a.ordinal - b.ordinal,
  );
  const source = searchable(value),
    query = value.includes("+") && value.includes("?") ? searchable(value, true) : source;
  const protections: { start: number; end: number }[] = [];
  const targets = [
    ...new Set([
      ...(options.preserveSamples !== false ? map.entries.map((entry) => entry.replacement) : []),
      ...map.handles.map((entry) => entry.handle),
      "https://source.invalid/omitted",
    ]),
  ]
    .sort((a, b) => b.length - a.length)
    .map(escapePattern)
    .join("|");
  if (targets.length > 400000) throw new Error("Sample text protection exceeds its bound.");
  for (const match of source.text.matchAll(new RegExp(targets, "gu"))) {
    const at = match.index ?? 0;
    protections.push({
      start: source.starts[at] ?? at,
      end: source.ends[at + match[0].length - 1] ?? at + match[0].length,
    });
    if (protections.length > 10000) throw new Error("Too many sample text fragments.");
  }
  type Change = {
    start: number;
    end: number;
    text: string;
    length: number;
    priority: number;
    ordinal: number;
  };
  const changes: Change[] = [];
  const collect = (patterns: string[], input: SearchText, single: boolean, url = false) => {
    if (!patterns.length) return;
    const combined = patterns.join("|");
    if (combined.length > 128000)
      throw new Error("Source replacement patterns exceed their bound.");
    const regex = new RegExp(`(?=(${combined}))`, "giu");
    let attempts = 0;
    let protection = 0;
    for (const match of input.text.matchAll(regex)) {
      if (++attempts > 10000) throw new Error("Too many source text replacements.");
      const text = match[1] ?? "",
        at = match.index ?? 0;
      let row: Row | undefined,
        replacement: string | undefined,
        matched = text;
      const norm = normalizeSitePersonalText(text);
      if (url) {
        row = selected.get(`url:${canonical(norm)}`);
        if (row) replacement = row.replacement;
        else {
          matched = text.replace(/[.,;!?]+$/u, "");
          replacement = "https://source.invalid/omitted";
        }
      } else {
        row = single
          ? selected.get(`single:${canonical(norm)}`)
          : (selected.get(`literal:${canonical(norm)}`) ??
            selected.get(`name:${canonical(norm).replace(/[\s._-]/g, "")}`) ??
            selected.get(`phone:${norm.replace(/\D/g, "")}`));
        replacement = row?.replacement;
      }
      if (
        row?.single &&
        ORDINARY_NAMES.has(row.normalized.toLowerCase()) &&
        options.context !== "name"
      ) {
        const before = input.text.slice(Math.max(0, at - 40), at);
        const salutation =
          /(?:^|[^\p{L}\p{N}])(?:thanks|thank you|regards|dear|hello|hi|owner|founder|author|contact|tack|hälsningar)[\s,:!—-]*$/iu.test(
            before,
          );
        // Complete detected names already have their own longest-match row.
        if (!salutation) continue;
      }
      if (!replacement) throw new Error("A source replacement could not be resolved.");
      const start = input.starts[at] ?? at,
        end = input.ends[at + matched.length - 1] ?? at + matched.length;
      while (protection < protections.length && (protections[protection]?.end ?? 0) <= start)
        protection++;
      const protectedRange = protections[protection];
      if (protectedRange && start < protectedRange.end && end > protectedRange.start) continue;
      if (changes.length >= 10000) throw new Error("Too many source text replacements.");
      changes.push({
        start,
        end,
        text: replacement,
        length: matched.length,
        priority: url ? -1 : Number(row?.derived),
        ordinal: row?.ordinal ?? MAX_ENTRIES,
      });
    }
  };
  const urlRows = rows.filter((row) => row.kind === "url");
  const hosts = new Set<string>();
  for (const handle of map.handles) {
    try {
      const url = new URL(handle.original);
      if (["http:", "https:"].includes(url.protocol) && url.hostname !== "source.invalid")
        hosts.add(url.hostname.replace(/^www\./, ""));
    } catch {
      /* Non-web handles are exact only. */
    }
  }
  const urlPatterns = urlRows.map((row) => row.pattern);
  if (hosts.size)
    urlPatterns.push(
      `https?:\\/\\/(?:www\\.)?(?:${[...hosts].map(escapePattern).join("|")})(?::[0-9]{1,5})?(?![\\p{L}\\p{N}-]|\\.[\\p{L}\\p{N}])(?:[/?#][^\\s<>"'\\x60)\\]\\}]*)?`,
    );
  collect(urlPatterns, source, false, true);
  collect(
    rows.filter((row) => row.kind !== "url" && !row.single).map((row) => row.pattern),
    query,
    false,
  );
  collect(
    rows.filter((row) => row.single).map((row) => row.pattern),
    query,
    true,
  );
  changes.sort(
    (a, b) =>
      a.start - b.start || b.length - a.length || a.priority - b.priority || a.ordinal - b.ordinal,
  );
  const merged: Change[] = [];
  for (const change of changes) {
    const previous = merged.at(-1);
    if (previous && change.start < previous.end) previous.end = Math.max(previous.end, change.end);
    else merged.push({ ...change });
  }
  const output: string[] = [];
  let at = 0;
  for (const change of merged) {
    output.push(value.slice(at, change.start), change.text);
    at = change.end;
  }
  output.push(value.slice(at));
  const result = output.join("");
  if (Buffer.byteLength(result) > MAX_TEXT) throw new Error("Replaced text exceeds its bound.");
  return result;
}
export function projectSitePersonal(
  input: {
    facts: SiteFacts;
    images: SiteImageContext[];
    sourceCorpus: SiteSourceCorpus;
    pages?: { html: string; url: string; id: string }[];
  },
  options: {
    contentMode?: SiteContentMode;
    personalMap?: SitePersonalMap;
    personalKey?: string;
  } = {},
): { model: SiteModelProjection; personalMap: SitePersonalMap } {
  const mode = options.contentMode ?? "sample";
  if (!["sample", "full"].includes(mode)) throw new Error("Invalid website content mode.");
  const map: SitePersonalMap = options.personalMap
    ? parseSitePersonalMap(options.personalMap)
    : {
        version: 1 as const,
        key: options.personalKey ?? randomBytes(32).toString("hex"),
        entries: [],
        handles: [],
      };
  if (
    !/^[a-f\d]{64}$/.test(map.key) ||
    (options.personalKey !== undefined && options.personalKey !== map.key)
  )
    throw new Error("Invalid private source key.");
  const classification = map.classification ?? { business: false, person: false };
  map.classification = classification;
  const businessNames = new Set(
    input.facts.fields.filter((fact) => fact.kind === "name").map((fact) => canonical(fact.value)),
  );
  // These name locators are emitted only for the extractor's selected business entity.
  // Preserve that distinction when a saved input is replayed without its HTML.
  const structuredBusinessNames = new Set(
    input.facts.fields
      .filter(
        (fact) =>
          fact.kind === "name" &&
          ((fact.evidence.element.startsWith('script[type="application/ld+json"][') &&
            fact.evidence.element.endsWith(".name")) ||
            fact.evidence.element === '[itemscope] [itemprop="name"]'),
      )
      .map((fact) => canonical(fact.value)),
  );
  const counts = () =>
    Object.fromEntries(
      KINDS.map((kind) => [kind, map.entries.filter((entry) => entry.kind === kind).length]),
    ) as Record<SitePersonalKind, number>;
  if (mode === "full")
    return {
      model: {
        version: 1,
        contentMode: mode,
        facts: input.facts,
        images: input.images,
        description: describeSiteFacts(input.facts),
        personal: { version: 1, counts: { name: 0, email: 0, phone: 0, address: 0, identity: 0 } },
      },
      personalMap: map,
    };
  const pending = new Map<string, { kind: SitePersonalKind; original: string }>();
  const add = (kind: SitePersonalKind, value: string) => {
    let original = normalizeSitePersonalText(value);
    if (kind === "email") {
      const email = original.match(
        /[\p{L}\p{N}.!#$%&'*+/=?^_`{|}~-]+@[\p{L}\p{N}.-]+\.[\p{L}]{2,}/u,
      )?.[0];
      if (!email) return;
      original = email;
    }
    if (!original || /^[-–—.]+$|^(?:n\/a|none|null)$/iu.test(original)) return;
    if (kind === "phone" && !/^\+?[\d\s().-]+$/.test(original)) {
      const numbers = [...original.matchAll(/\+?[\d\s().-]{3,40}\d/g)].filter(
        (match) => match[0].replace(/\D/g, "").length >= 7,
      );
      if (!numbers.length) return;
      for (const number of numbers) add("phone", number[0]);
      return;
    }
    if (original.length > 1000) throw new Error("A source identifier exceeds its bound.");
    if (kind === "phone" && original.replace(/\D/g, "").length < 7) return;
    if (
      !map.entries.some((entry) => canonical(entry.original) === canonical(original)) &&
      !pending.has(canonical(original))
    )
      pending.set(canonical(original), { kind, original });
    if (map.entries.length + pending.size > MAX_ENTRIES)
      throw new Error("Too many source identifiers.");
    const identity =
      (
        map.entries.find((entry) => canonical(entry.original) === canonical(original)) ??
        pending.get(canonical(original))
      )?.kind === "identity";
    if (kind === "name" && !identity)
      for (const part of original.split(/[\s.-]+/u))
        if (
          nameToken(part, true) &&
          !pending.has(canonical(part)) &&
          !map.entries.some((entry) => canonical(entry.original) === canonical(part))
        )
          pending.set(canonical(part), { kind, original: part });
  };
  const scan = (value: string, names = false) => {
    const text =
      value.includes("?") && value.includes("+")
        ? searchable(value, true).text
        : normalizeSitePersonalText(value);
    for (const match of text.matchAll(
      /[\p{L}\p{N}.!#$%&'*+/=?^_`{|}~-]+@[\p{L}\p{N}.-]+\.[\p{L}]{2,}/gu,
    ))
      add("email", match[0]);
    const phoneText = text.replace(
      /(?<!\d[ .-]?)\b(?:(?:\d{1,2}[.:]\d{2}|\d{4})\s*[-–]\s*(?:\d{1,2}[.:]\d{2}|\d{4})|[12]\d{3}[- ](?:0?[1-9]|1[0-2])[- ](?:0?[1-9]|[12]\d|3[01])|(?:0?[1-9]|[12]\d|3[01])[./ -](?:0?[1-9]|1[0-2])[./ -][12]\d{3}|(?:0?[1-9]|[12]\d|3[01])[./-](?:0?[1-9]|1[0-2])[./-]\d{2})\b(?![ .-]\d)/gu,
      (part) => " ".repeat(part.length),
    );
    const phonePatterns = [
      /(?<![\p{L}\p{N}])(?:\+\d|0\d)[\d\s().-]{5,35}\d(?![\p{L}\p{N}])/gu,
      /(?<![\p{L}\p{N}])\(?\d{2,4}\)?(?:[ .-]\d{2,7}){1,4}(?![\p{L}\p{N}])/gu,
      /(?<![\p{L}\p{N}])\d{7,15}(?![\p{L}\p{N}])/gu,
    ];
    for (const pattern of phonePatterns)
      for (const match of phoneText.matchAll(pattern))
        if (match[0].replace(/\D/g, "").length >= 7) {
          const at = match.index ?? 0,
            context = text.slice(Math.max(0, at - 16), at + match[0].length + 16);
          if (
            !/[+().-]/u.test(match[0]) &&
            /(?:€|£|:-|\bkr\b|\bEUR\b|\bUSD\b|\$|\bSEK\b)/iu.test(context) &&
            !/\b(?:call|phone|tel)\b/iu.test(context)
          )
            continue;
          if (
            /^\d{7,15}$/u.test(match[0]) &&
            !/\b(?:call|phone|tel|telephone|mobile|ring|telefon|mobil)\b/iu.test(context)
          )
            continue;
          add("phone", match[0]);
        }
    for (const match of text.matchAll(
      /(?<![\p{L}\p{N}])(?:\d{1,5}\s+\p{Lu}[\p{L}'’-]*(?:\s+\p{Lu}[\p{L}'’-]*){0,3}\s+(?:Street|Road|Lane|Avenue|Way|Drive|St\.|Rd\.|Ave\.)|\p{Lu}[\p{L}'’-]*(?:\s+\p{Lu}[\p{L}'’-]*){0,2}\s+(?:Street|Road|Lane|Avenue|Way|Drive|St\.|Rd\.|Ave\.)\s+\d{1,5}[a-zA-Z]?|\p{Lu}[\p{L}'’-]*(?:gatan|vägen|tie|katu)\s+\d{1,5}[a-zA-Z]?)(?![\p{L}\p{N}])/gu,
    ))
      add("address", match[0]);
    const roleWords =
      "team|staff|owner|founder|director|manager|instructor|therapist|doctor|author|review|testimonial|contact|portrait|photo|medarbetare|ägare|personal|yrittäjä|henkilökunta";
    const beforeRole = new RegExp(`(?:${roleWords}|dr\\.|mr\\.|mrs\\.|ms\\.)[\\s:—,-]*$`, "iu"),
      afterRole = new RegExp(`^[\\s,:—(-]*(?:${roleWords})\\b`, "iu");
    const stop = new Set([
      "our",
      "meet",
      "welcome",
      "dr",
      "mr",
      "mrs",
      "ms",
      ...roleWords.split("|"),
    ]);
    for (const match of text.matchAll(
      /(?<![\p{L}\p{N}])\p{Lu}[\p{L}'’-]+(?:\s+\p{Lu}[\p{L}'’-]+){1,4}/gu,
    )) {
      const at = match.index ?? 0,
        parts = match[0].split(" ");
      let prefixed = false;
      while (parts[0] && stop.has(parts[0].toLowerCase())) {
        const prefix = parts.shift()?.toLowerCase() ?? "";
        if (["meet", "dr", "mr", "mrs", "ms", ...roleWords.split("|")].includes(prefix))
          prefixed = true;
      }
      while (parts.at(-1) && stop.has(parts.at(-1)?.toLowerCase() ?? "")) parts.pop();
      if (
        parts.length >= 2 &&
        parts.length <= 4 &&
        (names ||
          prefixed ||
          beforeRole.test(text.slice(Math.max(0, at - 30), at)) ||
          afterRole.test(text.slice(at + match[0].length, at + match[0].length + 30)))
      )
        add("name", parts.join(" "));
    }
  };
  const sourceTelephone = (value: string) => {
    const normalized = normalizeSitePersonalText(value);
    for (const match of normalized.matchAll(/\+?\d[\d\s().-]{1,38}\d/g))
      if (match[0].replace(/\D/g, "").length >= 7) add("phone", match[0]);
  };
  for (const entry of map.entries.filter((entry) => entry.kind === "name"))
    add("name", entry.original);
  const allFacts = [
    ...input.facts.fields,
    ...input.facts.navigation,
    ...input.facts.forms.flatMap((form) => form.fields),
  ];
  for (const fact of input.facts.fields.filter((fact) => fact.kind === "name"))
    add("identity", fact.value);
  for (const fact of allFacts) {
    if (fact.kind === "email" || fact.kind === "phone" || fact.kind === "address")
      add(fact.kind, fact.value);
    if (fact.kind === "location" && /\d/.test(fact.value)) add("address", fact.value);
    scan(fact.value);
    scan(fact.evidence.text);
  }
  let corpusBytes = 0;
  for (const page of input.sourceCorpus.pages) {
    corpusBytes += Buffer.byteLength(page.text);
    if (corpusBytes > MAX_TEXT) throw new Error("Source corpus exceeds its bound.");
    scan(page.text);
  }
  for (const image of input.images)
    for (const text of [
      image.alt,
      image.title,
      image.caption,
      ...image.nearbyHeadings,
      ...image.nearbyParagraphs,
      ...image.subject,
      image.evidence.text,
    ])
      scan(text, [image.alt, image.title, image.caption].includes(text));
  let nodes = 0;
  const visit = (value: unknown, depth = 0) => {
    if (++nodes > 100000 || depth > 30)
      throw new Error("Structured source data exceeds its bound.");
    if (Array.isArray(value)) {
      for (const item of value) visit(item, depth + 1);
      return;
    }
    if (!value || typeof value !== "object") return;
    const item = value as Record<string, unknown>;
    if (Object.keys(item).some((key) => ["__proto__", "constructor", "prototype"].includes(key)))
      throw new Error("Invalid structured source key.");
    const types = Array.isArray(item["@type"]) ? item["@type"] : [item["@type"]];
    const declaredName =
      typeof item.name === "string"
        ? item.name
        : item.name && typeof item.name === "object"
          ? (item.name as { "@value"?: unknown })["@value"]
          : item.legalName;
    if (
      types.some((type) => typeof type === "string" && isSiteBusinessType(type)) &&
      typeof declaredName === "string" &&
      businessNames.has(canonical(declaredName))
    ) {
      classification.business = true;
      structuredBusinessNames.add(canonical(declaredName));
    }
    if (types.some((type) => typeof type === "string" && /(?:^|\/)Person$/.test(type))) {
      classification.person = true;
      for (const key of ["name", "alternateName"])
        if (typeof item[key] === "string") add("name", item[key] as string);
      if (typeof item.givenName === "string" && typeof item.familyName === "string")
        add("name", `${item.givenName} ${item.familyName}`);
    }
    for (const key of ["email", "telephone", "streetAddress", "postalCode"])
      if (typeof item[key] === "string") {
        if (key === "telephone") sourceTelephone(item[key] as string);
        else add(key === "email" ? "email" : "address", item[key] as string);
      }
    for (const [key, child] of Object.entries(item)) {
      if (
        ["author", "founder", "employee", "member"].includes(key) &&
        child &&
        typeof child === "object" &&
        !Array.isArray(child) &&
        typeof (child as { name?: unknown }).name === "string"
      )
        add("name", (child as { name: string }).name);
      if (typeof child === "object") visit(child, depth + 1);
    }
  };
  for (const page of input.pages ?? []) {
    wellFormed(page.html);
    const root = parse(page.html, { comment: false });
    if (root.querySelectorAll("*").length > 100000)
      throw new Error("Source page exceeds its element bound.");
    for (const element of root.querySelectorAll("[itemtype]")) {
      const types = (element.getAttribute("itemtype") ?? "").split(/\s+/u);
      if (types.some((type) => /(?:^|\/)Person$/.test(type))) classification.person = true;
      const name = element.querySelector('[itemprop="name"]');
      if (
        types.some(isSiteBusinessType) &&
        name &&
        businessNames.has(canonical(name.getAttribute("content") ?? name.text))
      ) {
        classification.business = true;
        structuredBusinessNames.add(canonical(name.getAttribute("content") ?? name.text));
      }
    }
    for (const script of root.querySelectorAll('script[type="application/ld+json"]')) {
      let value: unknown;
      try {
        value = JSON.parse(script.rawText);
      } catch {
        continue;
      }
      visit(value);
    }
    for (const element of root.querySelectorAll(
      '[itemtype$="/Person"], [itemprop="author"], [rel="author"], .author, .staff, .team, .person',
    ))
      scan(element.structuredText, true);
    for (const element of root.querySelectorAll(
      '[itemprop="email"], [itemprop="telephone"], [itemprop="streetAddress"], address',
    )) {
      const value = element.getAttribute("content") ?? element.text,
        property = element.getAttribute("itemprop");
      if (value.trim()) {
        if (property === "telephone") sourceTelephone(element.getAttribute("href") ?? value);
        else
          add(
            property === "email" ? "email" : "address",
            property === "email" ? (element.getAttribute("href") ?? value) : value,
          );
      }
    }
  }
  // A refused personal site still receives a scrubbed projection. Keep persisted
  // identity IDs intact, but detect its personal components before allocation.
  if (
    input.facts.fields.some(
      (fact) => fact.kind === "name" && BUSINESS_WORD.test(normalizeSitePersonalText(fact.value)),
    )
  )
    classification.business = true;
  const personalTitle = input.facts.fields.some(
    (fact) =>
      fact.kind === "name" &&
      isSitePersonNameShape(fact.value) &&
      !structuredBusinessNames.has(canonical(fact.value)),
  );
  if (personalTitle) classification.person = true;
  // Person evidence remains relevant when a trade word also grants business eligibility.
  if (classification.person)
    for (const fact of input.facts.fields.filter(
      (fact) => fact.kind === "name" && !structuredBusinessNames.has(canonical(fact.value)),
    )) {
      const person = normalizeSitePersonalText(fact.value)
        .split(/\s+/u)
        .filter((part) => !BUSINESS_WORD.test(part))
        .join(" ");
      if (isSitePersonNameShape(person)) {
        add("name", person);
        for (const part of person.split(/[\s.-]+/u)) if (nameToken(part, true)) add("name", part);
      }
    }
  if (classification.person && !classification.business)
    for (const fact of input.facts.fields.filter((fact) => fact.kind === "name"))
      for (const part of normalizeSitePersonalText(fact.value).split(/[\s.-]+/u))
        if (nameToken(part, true)) add("name", part);
  for (const { kind, original } of [...pending.values()].sort((a, b) =>
    keyed(map.key, a.kind, canonical(a.original)).localeCompare(
      keyed(map.key, b.kind, canonical(b.original)),
    ),
  )) {
    if (map.entries.length >= MAX_ENTRIES) throw new Error("Too many source identifiers.");
    const ordinal = Math.max(
      Math.max(
        -1,
        ...map.entries.filter((entry) => entry.kind === kind).map((entry) => entry.ordinal),
      ) + 1,
      kind === "phone" ? (map.nextPhoneOrdinal ?? 0) : 0,
    );
    if (ordinal > MAX_ENTRIES) throw new Error("Source allocation ordinals exceed their bound.");
    if (kind === "phone" && map.nextPhoneOrdinal !== undefined) map.nextPhoneOrdinal = ordinal + 1;
    map.entries.push({
      id: keyed(map.key, kind, canonical(original)),
      kind,
      ordinal,
      original,
      replacement: legacySample(kind, ordinal, original),
    });
  }
  map.entries = allocateSamples(map.entries);
  const opaque = (value: string) => {
    wellFormed(value);
    if (value.length > 4096) throw new Error("A source URL exceeds its bound.");
    if (map.handles.some((entry) => entry.handle === value)) return value;
    const found = map.handles.find((entry) => entry.original === value);
    if (found) return found.handle;
    if (map.handles.length >= 5000) throw new Error("Too many source handles.");
    const handle = `https://source.invalid/ref/${map.handles.length + 1}`;
    map.handles.push({ id: keyed(map.key, "url", value), original: value, handle });
    return handle;
  };
  for (const page of input.pages ?? []) opaque(page.url);
  const replace = (value: string) =>
    replaceSitePersonalText(
      value.replace(
        /(?:tel:\+?[\d\s().-]{3,40}\d|https?:\/\/[^\s<>"'`)\]}]+|mailto:[^\s<>"'`)\]}]+)/giu,
        (token) => {
          const tail = /[.,;!?]+$/u.exec(token)?.[0] ?? "";
          return opaque(tail ? token.slice(0, -tail.length) : token) + tail;
        },
      ),
      map,
      { preserveSamples: false },
    );
  const projectFact = (fact: SiteFact, businessSlot = false): SiteFact => {
    const value = businessSlot && fact.kind === "name" ? fact.value : replace(fact.value);
    return {
      ...fact,
      value,
      evidence: {
        page: opaque(fact.evidence.page),
        element: "source-element",
        text: replace(fact.evidence.text),
      },
      ...(fact.url ? { url: opaque(fact.url) } : {}),
    };
  };
  const unstructuredPerson =
    !classification.business &&
    input.facts.fields.some((fact) => fact.kind === "name" && isSitePersonNameShape(fact.value));
  if (unstructuredPerson) classification.person = true;
  const personalOnly = classification.person && !classification.business;
  const facts: SiteFacts = {
    ...input.facts,
    ...(personalOnly ? { ambiguous: true } : {}),
    url: opaque(input.facts.url),
    fields: input.facts.fields
      .filter((fact) => !personalOnly || fact.kind !== "name")
      .map((fact) => projectFact(fact, true)),
    navigation: input.facts.navigation.map((fact) => projectFact(fact)),
    forms: input.facts.forms.map((form) => ({
      fields: form.fields.map((fact) => projectFact(fact)),
    })),
  };
  const images = input.images.map((image, index) => ({
    ...image,
    page: opaque(image.page),
    src: opaque(image.src),
    filename: `source-image-${index + 1}`,
    alt: replace(image.alt),
    title: replace(image.title),
    caption: replace(image.caption),
    nearbyHeadings: image.nearbyHeadings.map(replace),
    nearbyParagraphs: image.nearbyParagraphs.map(replace),
    parent: `source-section-${index + 1}`,
    subject: image.subject.map((value) =>
      map.entries.some(
        (entry) =>
          entry.kind === "name" &&
          nameToken(entry.original, true) &&
          canonical(entry.original) === canonical(value),
      )
        ? "person"
        : replace(value),
    ),
    evidence: {
      page: opaque(image.page),
      element: `source-image-${index + 1}`,
      text: replace(image.evidence.text),
    },
  }));
  return {
    model: {
      version: 1,
      contentMode: mode,
      facts,
      images,
      description: describeSiteFacts(facts),
      personal: { version: 1, counts: counts() },
    },
    personalMap: map,
  };
}
