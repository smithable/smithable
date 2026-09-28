import { type FieldIR, identifier, type SpecIR, typeKey } from "@smithable/core";
import { KINDS, type SummarySection } from "./summary.js";

export interface SummaryOperation {
  op: string;
  args: Record<string, unknown>;
}

/**
 * An edit of a model's part of the summary, read back without AI when it only changes the
 * items of its first sentence ("Customers have a name (required), a website (a web address)
 * …"): a new item adds a field, a missing one removes it, and an item with new notes changes
 * it. Undefined for anything else, which is the model's to read; [] when nothing changed.
 */
export function readSummaryEdit(
  section: SummarySection,
  text: string,
  ir: SpecIR,
): SummaryOperation[] | undefined {
  const model = ir.models.find((m) => `model:${m.name}` === section.concept);
  const first = section.sentences[0];
  if (!model || !section.fields || !first) return undefined;
  const lines = text
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
  const prefix = first.slice(0, first.indexOf(" have ") + " have ".length);
  const [head, ...rest] = lines;
  const sameRest =
    rest.length === section.sentences.length - 1 &&
    rest.every((l, i) => l === section.sentences[i + 1]);
  if (!head?.startsWith(prefix) || !head.endsWith(".") || !sameRest) return undefined;

  const items = splitList(head.slice(prefix.length, -1));
  const norm = (s: string) => s.replace(/\s+/g, " ").trim().toLowerCase();
  const kept = new Set<string>();
  const added: string[] = [];
  for (const item of items) {
    const old = section.fields.find((f) => norm(f.text) === norm(item));
    if (old) kept.add(old.field);
    else added.push(item);
  }
  const removed = section.fields.filter((f) => !kept.has(f.field));
  const operations: SummaryOperation[] = [];
  for (const item of added) {
    const parsed = parseItem(item);
    if (!parsed) return undefined;
    const before = removed.find((f) => norm(f.label) === norm(parsed.label));
    if (before) {
      // The same field with new notes: its type or modifiers change.
      const field = model.fields.find((f) => f.name === before.field) as FieldIR;
      if (field.type.kind !== "scalar") return undefined;
      removed.splice(removed.indexOf(before), 1);
      const type = shorthand(parsed.kind ?? typeKey(field.type), parsed);
      operations.push({ op: "changeField", args: { model: model.name, field: field.name, type } });
    } else {
      const field = identifier(parsed.label);
      if (!field) return undefined;
      const type = shorthand(parsed.kind ?? "string", parsed);
      operations.push({ op: "addField", args: { model: model.name, field, type } });
    }
  }
  for (const f of removed)
    operations.unshift({ op: "removeField", args: { model: model.name, field: f.field } });
  return operations;
}

interface Item {
  label: string;
  kind?: string;
  required: boolean;
  unique: boolean;
}

/** "a website (a web address, required)" → website, url, required; undefined if unclear. */
function parseItem(item: string): Item | undefined {
  const match = /^(?:(?:a|an)\s+)?([^()]+?)\s*(?:\((.*)\))?$/i.exec(item.trim());
  if (!match?.[1]) return undefined;
  const parsed: Item = { label: match[1], required: false, unique: false };
  for (const note of (match[2] ?? "").split(",").map((n) => n.trim().toLowerCase())) {
    const kind = Object.entries(KINDS).find(([, phrase]) => phrase === note)?.[0];
    if (!note) continue;
    if (note === "required") parsed.required = true;
    else if (note === "unique") parsed.unique = true;
    else if (kind && !parsed.kind) parsed.kind = kind;
    else return undefined;
  }
  return parsed;
}

const shorthand = (kind: string, item: Item) =>
  `${kind}${item.required ? "!" : ""}${item.unique ? " unique" : ""}`;

/** "a, b (c, d) and e" → [a, "b (c, d)", e]: commas inside parentheses stay. */
function splitList(list: string): string[] {
  const items: string[] = [];
  let depth = 0;
  let current = "";
  const parts = list.split(/(\(|\)|,\s*|\s+and\s+)/);
  for (const part of parts) {
    if (part === "(") depth++;
    if (part === ")") depth--;
    if (depth === 0 && (/^,\s*$/.test(part) || /^\s+and\s+$/.test(part))) {
      if (current.trim()) items.push(current.trim());
      current = "";
    } else current += part;
  }
  if (current.trim()) items.push(current.trim());
  return items;
}
