import { isPair, isScalar, type ParsedNode, type parseDocument, visit } from "yaml";
import type { ParseContext } from "./context.js";

/**
 * The keys whose text may run over several lines: what something is for, the rules, and a page's
 * longer texts. Every other text is a name, a label, a title or a subject, and is one line.
 */
const LONG_TEXTS = new Set([
  "about",
  "address",
  "answer",
  "description",
  "greeting",
  "help",
  "hours",
  "intent",
  "quote",
  "rule",
  "rules",
  "text",
  "thanks",
]);

/**
 * The maps whose keys are names (a field, a choice's value, a page): a key there called "text" or
 * "help" is a name like any other, and what it holds is one line.
 */
const NAMED_MAPS = new Set([
  "actions",
  "fields",
  "incoming",
  "menus",
  "models",
  "outgoing",
  "pages",
  "payments",
  "queries",
  "roles",
  "sections",
  "tiles",
  "timers",
  "values",
]);

/** Line breaks only a machine writes: they end a line in code as \n does. */
const RARE_BREAKS = /[\u2028\u2029\u0085]/;
/** Characters that turn the order text shows in, so it reads otherwise than it is. */
const BIDI_CONTROLS = /[\u202a-\u202e\u2066-\u2069]/;
const LINE_BREAK = /[\r\n]/;

/** A control character other than a tab or a line break. */
const hasControl = (text: string) =>
  [...text].some(
    (c) => /\p{Cc}/u.test(c) && c !== "\t" && c !== "\n" && c !== "\r" && c !== "\u0085",
  );

/**
 * Refuses text that could act as something else where the app's code or files carry it: control
 * and bidirectional-override characters anywhere, the rare line breaks anywhere, and a line break
 * in a name, label, title or other one-line text.
 */
/** The keys of the pairs from the root to a value, each a name or a keyword. */
type Pairs = { key: unknown }[];

/**
 * Whether the pair at `i` is an entry of a named map (a field called "text" under `fields`), so
 * its key is a name, not a keyword: its map's own key is one of the named maps and is itself a
 * keyword (a field called "values" is a name, and what is under it are keywords again).
 */
function isName(pairs: Pairs, i: number): boolean {
  if (i === 0) return false;
  const holder = pairs[i - 1] as Pairs[number];
  const key = isScalar(holder.key) ? String(holder.key.value) : "";
  return NAMED_MAPS.has(key) && !isName(pairs, i - 1);
}

export function rejectUnsafeText(ctx: ParseContext, doc: ReturnType<typeof parseDocument>): void {
  visit(doc, {
    Scalar(where, node, path) {
      if (typeof node.value !== "string") return;
      const text = node.value;
      const n = node as ParsedNode;
      if (hasControl(text) || BIDI_CONTROLS.test(text) || RARE_BREAKS.test(text)) {
        ctx.error(
          n,
          "text-control-character",
          "This text holds an invisible control character (or a line break of an unusual kind), which could make it read otherwise than it is.",
          "Type the text again without it.",
        );
        return;
      }
      // A block scalar (label: |) ends in a line break of its own, which says nothing.
      if (!LINE_BREAK.test(text.replace(/\r?\n$/, ""))) return;
      if (where === "key") {
        ctx.error(n, "text-line-break", "A name cannot run over several lines.");
        return;
      }
      const pairs = path.filter(isPair);
      for (let i = pairs.length - 1; i >= 0; i--) {
        const parent = pairs[i] as (typeof pairs)[number];
        const key = isScalar(parent.key) ? String(parent.key.value) : "";
        if (LONG_TEXTS.has(key) && !isName(pairs, i)) return;
        ctx.error(
          n,
          "text-line-break",
          `"${key}" is one line: it cannot hold a line break.`,
          "Write it on one line, or put the longer words in a description or a text.",
        );
        return;
      }
    },
  });
}
