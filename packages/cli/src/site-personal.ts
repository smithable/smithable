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
// Version 1: names already used by the barbers and booking starters. Labels remain samples.
export const SITE_PERSONAL_SAMPLES = {
  version: 1,
  names: [
    "Elin Sjöberg",
    "Omar Haddad",
    "Emma Lindqvist",
    "Oskar Berg",
    "Aino Virtanen",
    "Nils Ek",
  ],
} as const;
const MAX_TEXT = 8 * 1024 * 1024;
const MAX_ENTRIES = 2000;
const HTML_REFERENCE = /&(?:#x[\da-f]{1,8};?|#\d{1,8};?|[a-z][a-z\d]{0,31};?)/giu;
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
    text = text.replace(/(?:%[a-f\d]{2})+/giu, (run) => {
      try {
        return decodeURIComponent(run);
      } catch {
        throw new Error("Malformed source text encoding.");
      }
    });
    text = text.replace(/(?:\\{1,8}u[a-f\d]{4})+/giu, (match) => {
      try {
        return JSON.parse(`"${match.replace(/\\{1,8}u/g, "\\u")}"`) as string;
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
function sample(kind: SitePersonalKind, ordinal: number, original = ""): string {
  const n = ordinal + 1;
  const base =
    kind === "name"
      ? `${SITE_PERSONAL_SAMPLES.names[ordinal % SITE_PERSONAL_SAMPLES.names.length]} (sample ${n})`
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
function rejectSampleCollisions(entries: SitePersonalMap["entries"]): void {
  const originals = new Set(entries.map((entry) => canonical(entry.original)));
  if (entries.some((entry) => originals.has(canonical(entry.replacement))))
    throw new Error("A sample replacement collides with a detected source value.");
  const fullNames = [
    ...new Set(
      entries
        .filter(
          (entry) =>
            ["name", "identity"].includes(entry.kind) &&
            canonical(entry.original).split(" ").length > 1,
        )
        .map((entry) => escapePattern(canonical(entry.original))),
    ),
  ];
  const source = fullNames.join("|");
  if (source.length > 128000) throw new Error("Source name guard exceeds its bound.");
  if (source) {
    const names = new RegExp(`(?<![\\p{L}\\p{N}])(?:${source})(?![\\p{L}\\p{N}])`, "iu");
    if (entries.some((entry) => names.test(entry.replacement)))
      throw new Error("A sample replacement collides with a detected full name.");
  }
}
export function parseSitePersonalMap(value: unknown): SitePersonalMap {
  const item = record(value, ["version", "key", "entries", "handles", "classification"]);
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
      (!/^\+?[\d\s().-]+$/.test(original) || original.replace(/\D/g, "").length < 3)
    )
      throw new Error("Invalid source phone identifier.");
    if (
      entry.id !== id ||
      ids.has(id) ||
      seen.has(canonical(original)) ||
      ordinal !== (ordinals.get(kind) ?? 0) ||
      entry.replacement !== sample(kind, ordinal, original)
    )
      throw new Error("Invalid source replacement mapping.");
    if (kind === "email" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(original))
      throw new Error("Invalid source email identifier.");
    ids.add(id);
    seen.add(canonical(original));
    ordinals.set(kind, ordinal + 1);
    return { id, kind, ordinal, original, replacement: sample(kind, ordinal, original) };
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
  rejectSampleCollisions(entries);
  return {
    version: 1,
    key,
    entries,
    handles,
    classification: { business: classification.business, person: classification.person },
  };
}
const escapePattern = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
interface SearchText {
  text: string;
  starts: number[];
  ends: number[];
}
function searchable(value: string): SearchText {
  wellFormed(value);
  if (/\\{9}/u.test(value)) throw new Error("Source text has excessive encoding layers.");
  let current: SearchText = {
    text: value,
    starts: Array.from({ length: value.length }, (_, i) => i),
    ends: Array.from({ length: value.length }, (_, i) => i + 1),
  };
  const transform = (regex: RegExp, decode: (value: string) => string) => {
    const changes: { at: number; length: number; next: string }[] = [];
    for (const match of current.text.matchAll(regex)) {
      const next = decode(match[0]);
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
    for (const run of current.text.matchAll(/(?:%[a-f\d]{2})+/giu)) {
      try {
        decodeURIComponent(run[0]);
      } catch {
        throw new Error("Malformed source text encoding.");
      }
    }
    transform(
      /%(?:[0-7][a-f\d]|[cd][a-f\d]%[89ab][a-f\d]|e[a-f\d](?:%[89ab][a-f\d]){2}|f[0-4](?:%[89ab][a-f\d]){3})/giu,
      (text) => decodeURIComponent(text),
    );
    transform(
      /\\{1,8}u[dD][89aAbB][a-f\d]{2}\\{1,8}u[dD][c-fC-F][a-f\d]{2}|\\{1,8}u[a-f\d]{4}/giu,
      (text) => JSON.parse(`"${text.replace(/\\{1,8}u/g, "\\u")}"`) as string,
    );
    transform(/\\{1,8}[nrt]/g, (text) =>
      text.endsWith("n") ? "\n" : text.endsWith("r") ? "\r" : "\t",
    );
    transform(/\\{1,8}\//g, () => "/");
    wellFormed(current.text);
    if (current.text === before) {
      transform(/\s+/gu, () => " ");
      return current;
    }
  }
  throw new Error("Source text has excessive encoding layers.");
}
/** Search normalized text, but splice only matched ranges in the original formatting. */
export function replaceSitePersonalText(
  value: string,
  map: SitePersonalMap,
  options: { preserveSamples?: boolean } = {},
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
  const entries = [
    ...map.entries,
    ...map.entries
      .filter((entry) => entry.kind === "name")
      .flatMap((entry) =>
        entry.original
          .split(/[\s.-]+/u)
          .filter((part) => part.length >= 3)
          .map((original) => ({ ...entry, original })),
      ),
    ...map.handles.map((handle) => ({
      original: handle.original,
      replacement: handle.handle,
      kind: "url" as const,
    })),
  ].sort((a, b) => b.original.length - a.original.length);
  if (!entries.length) return value;
  const source = searchable(value);
  const lookups = new Map<string, (typeof entries)[number]>();
  const patterns = entries.map((entry) => {
    const normalized = normalizeSitePersonalText(entry.original);
    if (entry.kind === "url") {
      lookups.set(`literal:${canonical(normalized)}`, entry);
      return escapePattern(normalized);
    }
    if (
      /^\+?[\d\s().-]+$/.test(normalized) &&
      (entry.kind === "phone" || normalized.replace(/\D/g, "").length >= 3)
    ) {
      const digits = normalized.replace(/\D/g, "");
      if (digits.length < 3) throw new Error("Invalid source phone identifier.");
      lookups.set(`phone:${digits}`, entry);
      return `\\+?${digits.split("").map(escapePattern).join("[\\s().+-]*")}`;
    }
    if (
      entry.kind === "name" ||
      entry.kind === "identity" ||
      /^[\p{L}\s.’'-]+$/u.test(normalized)
    ) {
      const tokens = normalized.split(/[\s._-]+/u).filter(Boolean);
      if (!tokens.length) throw new Error("An identity has no searchable characters.");
      lookups.set(`name:${canonical(tokens.join(""))}`, entry);
      return tokens.map(escapePattern).join("[\\s._-]*");
    }
    lookups.set(`literal:${canonical(normalized)}`, entry);
    return escapePattern(normalized).replace(/ /g, "\\s+");
  });
  const sourceHosts = new Set<string>();
  for (const handle of map.handles) {
    try {
      const url = new URL(handle.original);
      if (["http:", "https:"].includes(url.protocol) && url.hostname !== "source.invalid")
        sourceHosts.add(url.hostname.replace(/^www\./, ""));
    } catch {
      /* Non-web handles are exact matches only. */
    }
  }
  if (sourceHosts.size)
    patterns.unshift(
      `https?:\\/\\/(?:www\\.)?(?:${[...sourceHosts].map(escapePattern).join("|")})(?::[0-9]{1,5})?(?:[/?#][^\\s<>"']*)?`,
    );
  const combined = patterns.join("|");
  if (combined.length > 128000) throw new Error("Source replacement patterns exceed their bound.");
  const protectedRanges: { start: number; end: number }[] = [];
  {
    const targets = [
      ...new Set([
        ...(options.preserveSamples !== false ? entries.map((entry) => entry.replacement) : []),
        ...map.handles.map((entry) => entry.handle),
        "https://source.invalid/omitted",
      ]),
    ]
      .sort((a, b) => b.length - a.length)
      .map(escapePattern)
      .join("|");
    if (targets.length > 400000) throw new Error("Sample text protection exceeds its bound.");
    for (const match of targets ? source.text.matchAll(new RegExp(targets, "gu")) : []) {
      const at = match.index ?? 0;
      protectedRanges.push({ start: at, end: at + match[0].length });
      if (protectedRanges.length > 10000) throw new Error("Too many sample text fragments.");
    }
  }
  protectedRanges.sort((a, b) => a.start - b.start || b.end - a.end);
  let protection = 0;
  const regex = new RegExp(`(?<![\\p{L}\\p{N}])(?:${combined})(?![\\p{L}\\p{N}])`, "giu"),
    changes: { start: number; end: number; text: string }[] = [];
  for (const match of source.text.matchAll(regex)) {
    const at = match.index ?? 0;
    while (protection < protectedRanges.length && (protectedRanges[protection]?.end ?? 0) <= at)
      protection++;
    const range = protectedRanges[protection];
    if (range && at >= range.start && at + match[0].length <= range.end) continue;
    const normalized = canonical(match[0]),
      entry =
        lookups.get(`literal:${normalized}`) ??
        lookups.get(`name:${normalized.replace(/[\s._-]/g, "")}`) ??
        lookups.get(`phone:${match[0].replace(/\D/g, "")}`);
    let replacement = entry?.replacement;
    if (!replacement && /^https?:\/\//iu.test(match[0])) {
      try {
        const url = new URL(match[0]);
        if (sourceHosts.has(url.hostname.replace(/^www\./, "")))
          replacement = "https://source.invalid/omitted";
      } catch {
        /* Unresolvable text is refused below. */
      }
    }
    if (!replacement) throw new Error("A source replacement could not be resolved.");
    if (changes.length >= 10000) throw new Error("Too many source text replacements.");
    changes.push({
      start: source.starts[at] ?? at,
      end: source.ends[at + match[0].length - 1] ?? at + match[0].length,
      text: replacement,
    });
  }
  const merged: typeof changes = [];
  for (const change of changes) {
    const previous = merged.at(-1);
    if (previous && change.start < previous.end) {
      previous.end = Math.max(previous.end, change.end);
      previous.text = "Sample text";
    } else merged.push({ ...change });
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
  const map = options.personalMap
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
    const original = normalizeSitePersonalText(value);
    if (!original || /^[-–—.]+$|^(?:n\/a|none|null)$/iu.test(original)) return;
    if (kind === "phone" && !/^\+?[\d\s().-]+$/.test(original)) {
      const numbers = [...original.matchAll(/\+?[\d\s().-]{3,40}\d/g)].filter(
        (match) => match[0].replace(/\D/g, "").length >= 3,
      );
      if (!numbers.length) throw new Error("Invalid source phone identifier.");
      for (const number of numbers) add("phone", number[0]);
      return;
    }
    if (original.length > 1000) throw new Error("A source identifier exceeds its bound.");
    if (
      kind === "phone" &&
      (!/^\+?[\d\s().-]+$/.test(original) || original.replace(/\D/g, "").length < 3)
    )
      throw new Error("Invalid source phone identifier.");
    if (
      !map.entries.some((entry) => canonical(entry.original) === canonical(original)) &&
      !pending.has(canonical(original))
    )
      pending.set(canonical(original), { kind, original });
    if (map.entries.length + pending.size > MAX_ENTRIES)
      throw new Error("Too many source identifiers.");
    if (kind === "name")
      for (const part of original.split(/[\s.-]+/u))
        if (
          part.length >= 3 &&
          !pending.has(canonical(part)) &&
          !map.entries.some((entry) => canonical(entry.original) === canonical(part))
        )
          pending.set(canonical(part), { kind, original: part });
  };
  const scan = (value: string, names = false) => {
    const text = normalizeSitePersonalText(value);
    for (const match of text.matchAll(
      /[\p{L}\p{N}.!#$%&'*+/=?^_`{|}~-]+@[\p{L}\p{N}.-]+\.[\p{L}]{2,}/gu,
    ))
      add("email", match[0]);
    const phoneText = text.replace(
      /\b\d{1,2}\.\d{2}\s*[-–]\s*\d{1,2}\.\d{2}\b|\b\d{1,2}[./-]\d{1,2}[./-]\d{2,4}\b/gu,
      (part) => " ".repeat(part.length),
    );
    for (const match of phoneText.matchAll(/(?:\+\d|0\d)[\d\s().-]{5,35}\d/g))
      if (match[0].replace(/\D/g, "").length >= 7) add("phone", match[0]);
    for (const match of text.matchAll(
      /(?:\b\d{1,5}\s+[\p{Lu}][\p{L} .'-]{1,60}(?:Street|Road|Lane|Avenue|Way|Drive)\b|\b[\p{Lu}][\p{L}'-]*(?:\s+[\p{Lu}][\p{L}'-]*)?\s+(?:Street|Road|Lane|Avenue|Way|Drive|gatan|vägen|tie|katu)\s+\d{1,5}[a-z]?\b)/gu,
    ))
      add("address", match[0]);
    const roleWords =
      "team|staff|owner|founder|director|manager|instructor|therapist|doctor|author|review|testimonial|contact|portrait|photo|medarbetare|ägare|personal|yrittäjä|henkilökunta";
    const beforeRole = new RegExp(`(?:${roleWords})[\\s:—,-]*$`, "iu"),
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
      /(?<![\p{L}\p{N}])\p{Lu}[\p{L}'’-]+(?:\s+\p{Lu}[\p{L}'’-]+){1,3}/gu,
    )) {
      const at = match.index ?? 0,
        parts = match[0].split(" ");
      let prefixed = false;
      while (parts[0] && stop.has(parts[0].toLowerCase())) {
        parts.shift();
        prefixed = true;
      }
      while (parts.at(-1) && stop.has(parts.at(-1)?.toLowerCase() ?? "")) parts.pop();
      if (
        parts.length >= 2 &&
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
      if (match[0].replace(/\D/g, "").length >= 3) add("phone", match[0]);
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
    )
      classification.business = true;
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
      )
        classification.business = true;
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
        else add(property === "email" ? "email" : "address", value);
      }
    }
  }
  for (const { kind, original } of [...pending.values()].sort((a, b) =>
    keyed(map.key, a.kind, canonical(a.original)).localeCompare(
      keyed(map.key, b.kind, canonical(b.original)),
    ),
  )) {
    if (map.entries.length >= MAX_ENTRIES) throw new Error("Too many source identifiers.");
    const ordinal = map.entries.filter((entry) => entry.kind === kind).length;
    map.entries.push({
      id: keyed(map.key, kind, canonical(original)),
      kind,
      ordinal,
      original,
      replacement: sample(kind, ordinal, original),
    });
  }
  rejectSampleCollisions(map.entries);
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
      value.replace(/(?:https?:\/\/|mailto:|tel:)[^\s<>"']+/giu, opaque),
      map,
      { preserveSamples: false },
    );
  const projectFact = (fact: SiteFact): SiteFact => {
    const value = fact.kind === "name" ? fact.value : replace(fact.value);
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
  const personalOnly = classification.person && !classification.business;
  const facts: SiteFacts = {
    ...input.facts,
    ...(personalOnly ? { ambiguous: true } : {}),
    url: opaque(input.facts.url),
    fields: input.facts.fields
      .filter((fact) => !personalOnly || fact.kind !== "name")
      .map(projectFact),
    navigation: input.facts.navigation.map(projectFact),
    forms: input.facts.forms.map((form) => ({ fields: form.fields.map(projectFact) })),
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
    subject: image.subject.map(replace),
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
