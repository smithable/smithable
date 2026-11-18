// The app in plain words as its own tab beside No code and Code (T962, Johan 2026-11-18,
// decisions.summary-tab): where each section and sentence leads, in No code or in Code, and which
// sections are open. Pure, so the browser-free tests cover it.
import type { SummarySection } from "@smithable/index";

/** No code's sub-views a part can open in. */
export type NoCodeSub = "behavior" | "layout" | "who" | "content";
/** A part as No code opens it: a concept ("model:Order") or a file and a path in it. */
export type OpenPart = string | { file: string; path: (string | number)[] };
/** Where the summary's links open: No code (as before) or Code. */
export type SummaryTarget = "nocode" | "code";

/** The spec's area of each kind of concept, the same in No code's Behavior and in Code. */
const AREAS: Record<string, string> = {
  model: "models",
  action: "actions",
  query: "queries",
  outgoing: "outgoing",
  timer: "timers",
  incoming: "incoming",
  page: "pages",
};

/** Where a summary's part is set in No code: its entry in Behavior, or Who can for sign-in and access. */
export function entryOf(
  concept: OpenPart,
): { sub: NoCodeSub; path: (string | number)[] } | undefined {
  if (typeof concept !== "string") {
    const subs: Record<string, NoCodeSub> = {
      "smithable.auth.yml": "who",
      "smithable.ux.yml": "layout",
      "smithable.content.yml": "content",
    };
    const file = concept.file.split(/[\\/]/).at(-1) ?? concept.file;
    return { sub: subs[file] ?? "behavior", path: concept.path };
  }
  const [kind = "", name = ""] = concept.split(/:(.*)/s);
  const area = AREAS[kind];
  if (area) return { sub: "behavior", path: [area, name] };
  if (kind === "app" || kind === "pages") return { sub: "behavior", path: [kind] };
  if (kind === "auth") return { sub: "who", path: [] };
  return undefined;
}

/** Where a summary's part is written in Code: its file and dotted path. */
function codeOf(concept: string, field?: string): { file: string; path: string } | undefined {
  const [kind = "", name = ""] = concept.split(/:(.*)/s);
  if (kind === "auth") return { file: "smithable.auth.yml", path: "" };
  if (kind === "app" || kind === "pages") return { file: "smithable.yml", path: kind };
  const area = kind === "payment" ? "payments" : AREAS[kind];
  if (!area || !name) return undefined;
  const path = `${area}.${name}`;
  return {
    file: "smithable.yml",
    path: field && kind === "model" ? `${path}.fields.${field}` : path,
  };
}

/** Where a link leads under the setting: an OpenPart for No code, a file and path for Code, or none. */
export type SummaryLink =
  | { in: "nocode"; part: OpenPart }
  | { in: "code"; file: string; path: string }
  | undefined;

/**
 * A section's title (no field) or one of its sentences (a model's field line names its field):
 * where it leads under the setting. A part with no place there stays plain text.
 */
export function summaryLink(target: SummaryTarget, concept: string, field?: string): SummaryLink {
  if (target === "code") {
    const at = codeOf(concept, field);
    return at && { in: "code", ...at };
  }
  const at = entryOf(concept);
  if (!at) return undefined;
  if (field && at.sub === "behavior")
    return { in: "nocode", part: { file: "smithable.yml", path: [...at.path, "fields", field] } };
  return { in: "nocode", part: concept };
}

/** The field a sentence of a section stands for: a model's field line, else none. */
export const fieldOf = (section: SummarySection, sentence: string) =>
  section.fields?.find((f) => f.text === sentence.replace(/^- /, ""))?.field;

/**
 * Which sections are open: as kept while Studio is open, else the first one. A kept concept that
 * is gone is dropped.
 */
export function openSections(sections: SummarySection[], kept?: readonly string[]): string[] {
  if (kept) return kept.filter((concept) => sections.some((s) => s.concept === concept));
  const first = sections[0]?.concept;
  return first ? [first] : [];
}

/** A section opened or closed. */
export const toggled = (open: readonly string[], concept: string): string[] =>
  open.includes(concept) ? open.filter((c) => c !== concept) : [...open, concept];

/** The setting's key in the browser, and its value read safely. */
export const TARGET_KEY = "smithable:summary-opens-in";
export const readTarget = (stored: string | null): SummaryTarget =>
  stored === "code" ? "code" : "nocode";
