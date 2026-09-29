import { type AnyOperation, OPERATIONS } from "@smithable/core";
import type { ConceptInfo, ProjectIndex, SourceFile } from "./project-index.js";

export interface ContextOptions {
  /** Custom code to include for these concepts; only when AI works on custom code. */
  implementation?: SourceFile[];
  /** At most this many concepts (default 6). */
  limit?: number;
  /** The project's operations, its plugins' included (default: the built-in ones). */
  operations?: readonly AnyOperation[];
}

export interface ContextSlice {
  request: string;
  /** The shortlisted concepts, most relevant first. */
  concepts: string[];
  text: string;
  tokens: { semantic: number; implementation: number; total: number };
}

/**
 * An estimate of how many tokens a text takes for a typical LLM tokenizer (about four
 * characters per token for English and code). Good enough to compare contexts and budgets.
 */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

/**
 * The smallest useful context for a request (ARCHITECTURE §9.3): the concepts it is about,
 * with their meaning and rules, the operations that can change them, and custom code only
 * when asked for. Every AI tier gets the same semantic slice.
 */
export function buildContext(
  index: ProjectIndex,
  request: string,
  options: ContextOptions = {},
): ContextSlice {
  const concepts = shortlist(index, request, options.limit ?? 6);
  const semantic = [
    `Request: ${request}`,
    "",
    concepts.length
      ? "Relevant parts of the app (smithable.yml):"
      : "No part of the app matches the request; the app:",
    ...(concepts.length
      ? concepts
      : index.concepts.filter((c) => c.concept === "app" || c.concept.startsWith("model:"))
    ).map(conceptText),
    "",
    `Menus: ${index.menus.map((m) => `${m.name}: [${m.pages.join(", ")}]`).join("; ")}`,
    "",
    "Operations (change the app only through these):",
    ...(options.operations ?? OPERATIONS).map(
      (op) =>
        `- ${op.name} ${op.positional.map((p) => `<${p.replace("...", "")}>`).join(" ")}: ${op.summary}`,
    ),
  ].join("\n");
  const wanted = new Set(
    concepts.flatMap((c) => c.files.filter((f) => f.role !== "generated").map((f) => f.path)),
  );
  const code = (options.implementation ?? [])
    .filter((f) => wanted.has(f.path))
    .map((f) => `--- ${f.path}\n${f.text}`)
    .join("\n");
  const implementation = code ? `\n\nCustom code:\n${code}` : "";
  const tokens = {
    semantic: estimateTokens(semantic),
    implementation: estimateTokens(implementation),
  };
  return {
    request,
    concepts: concepts.map((c) => c.concept),
    text: semantic + implementation,
    tokens: { ...tokens, total: tokens.semantic + tokens.implementation },
  };
}

/** One concept, compactly: what it is, what it means, its rules. */
function conceptText(c: ConceptInfo): string {
  return [
    `- ${c.concept}: ${c.summary}`,
    ...(c.description ? [`  ${c.description}`] : []),
    ...(c.intent ? [`  Intent: ${c.intent}`] : []),
    ...c.rules.map((r) => `  Rule${r.id ? ` ${r.id}` : ""}: ${r.text}`),
  ].join("\n");
}

/**
 * Concepts whose names, summaries or free text share words with the request. Names count
 * most; a field's model comes along with it, so a change is always seen in its context.
 */
function shortlist(index: ProjectIndex, request: string, limit: number): ConceptInfo[] {
  const wanted = words(request);
  const matches = (candidates: string[]) =>
    wanted.filter((w) =>
      candidates.some(
        (c) => c === w || (w.length >= 4 && c.startsWith(w)) || (c.length >= 4 && w.startsWith(c)),
      ),
    ).length;
  const scored = index.concepts
    .map((c) => {
      // A field is found by its own name; its model's name finds the model.
      const id = c.concept.split(":")[1] ?? c.concept;
      const name = words(c.concept.startsWith("field:") ? (id.split(".")[1] ?? "") : id);
      const text = words(
        [c.summary, c.description, c.intent, ...c.rules.map((r) => r.text)].join(" "),
      );
      return { c, score: 3 * matches(name) + matches(text) };
    })
    .filter((s) => s.score > 0 && s.c.concept !== "app")
    .sort((a, b) => b.score - a.score);
  // Weak matches are noise: keep those at least half as relevant as the best one.
  const cutoff = (scored[0]?.score ?? 0) / 2;
  const chosen: ConceptInfo[] = [];
  for (const { c } of scored.filter((s) => s.score >= cutoff)) {
    if (chosen.length >= limit) break;
    if (!chosen.includes(c)) chosen.push(c);
    const owner = c.concept.startsWith("field:")
      ? `model:${c.concept.slice(6).split(".")[0]}`
      : undefined;
    const model = index.concepts.find((x) => x.concept === owner);
    if (model && !chosen.includes(model) && chosen.length < limit) chosen.push(model);
  }
  return chosen;
}

/** Lowercase words without "s", "ing" or "ed": "Merging customers' phoneNumbers" → merg, customer, phone, number. */
function words(text: string): string[] {
  return text
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length > 2 && !STOP_WORDS.has(w))
    .map((w) => w.replace(/(?<!s)s$/, "").replace(/(?<=\w{3})(ing|ed)$/, ""));
}

const STOP_WORDS = new Set([
  "the",
  "and",
  "for",
  "with",
  "should",
  "have",
  "has",
  "can",
  "not",
  "all",
  "any",
  "from",
  "into",
  "that",
  "this",
  "each",
  "our",
  "their",
  "they",
  "when",
  "then",
  "also",
  "add",
  "new",
]);
