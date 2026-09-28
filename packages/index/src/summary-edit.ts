import { type FieldIR, identifier, type SpecIR, typeKey } from "@smithable/core";
import { KINDS, type SummarySection } from "./summary.js";

export interface SummaryOperation {
  op: string;
  args: Record<string, unknown>;
}

/**
 * An edit of a model's part of the summary, read back without AI when it only changes its
 * list of fields ("Customers have:" and a line per field, "- a website (a web address)"): a
 * new line adds a field, a missing one removes it, and a line with new notes changes it.
 * Undefined for anything else, which is the model's to read; [] when nothing changed.
 */
export function readSummaryEdit(
  section: SummarySection,
  text: string,
  ir: SpecIR,
): SummaryOperation[] | undefined {
  const model = ir.models.find((m) => `model:${m.name}` === section.concept);
  if (!model || !section.fields) return undefined;
  const lines = text
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
  const bullet = (l: string) => /^[-•*]\s+/.test(l);
  const others = (all: string[]) => all.slice(1).filter((l) => !bullet(l));
  // The list's heading and every other sentence stay as they were.
  const sameRest =
    lines[0] === section.sentences[0] &&
    others(lines).join("\n") === others(section.sentences).join("\n");
  if (!sameRest) return undefined;

  const items = lines.filter(bullet).map((l) => l.replace(/^[-•*]\s+/, ""));
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
