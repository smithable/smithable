// Smithable app kit: whether a model's answer stands on what the tools said (docs/design/
// ask-checks.md §3), without a model: "none" with no empty result, "done" with no change
// proposed, a number no result has, an answer about records with no call. Each failure is a
// line for the model, in its words, so it can try again.
import type { Json, Step } from "./assistant.server";
import { w } from "./words";

/** A kind of record by its names, to see an answer is about records. */
interface Named {
  label: string;
  pluralLabel: string;
}

/** Why the answer is not grounded in the steps, for the model; nothing when it is. */
export function ungrounded(
  text: string,
  question: string,
  steps: Step[],
  kinds: readonly Named[],
): string | undefined {
  const results = steps.filter((s) => s.result !== undefined).map((s) => s.result as Json);
  if (w.doneWords.test(text) && !steps.some((s) => s.proposed))
    return "You said a change was made, but none was: call add, change or run to propose it.";
  if (w.noneWords.test(text)) {
    const note = results.map(noteOf).find(Boolean);
    if (note) return `You answered "none", but the tool said: ${note} Answer with that.`;
    if (!results.some(empty))
      return 'You answered "none", but no tool returned an empty result: look it up with find or measure.';
  }
  const known = new Set([...numbersIn(question), ...results.flatMap(numbersOf)].map(key));
  const made = numbersIn(text).find((n) => !known.has(key(n)));
  if (made !== undefined)
    return `The number ${made} is in no tool result: give only numbers a tool returned, or call measure.`;
  if (!results.length) {
    const lower = text.toLowerCase();
    if (kinds.some((k) => [k.label, k.pluralLabel].some((l) => lower.includes(l.toLowerCase()))))
      return "You answered about records without a tool's result: look them up first.";
  }
  return undefined;
}

/** A result that found nothing: no rows, a total of 0, or no value. */
function empty(result: Json): boolean {
  if (result === null || typeof result !== "object" || Array.isArray(result)) return false;
  return (
    result.total === 0 ||
    (Array.isArray(result.rows) && result.rows.length === 0) ||
    ["sum", "average", "smallest", "largest"].some((k) => k in result && result[k] === null)
  );
}

/** The note a result carries when what was asked does not exist. */
function noteOf(result: Json): string | undefined {
  return result && typeof result === "object" && !Array.isArray(result) && empty(result)
    ? typeof result.note === "string"
      ? result.note
      : undefined
    : undefined;
}

/** Every number a result holds, with each list's length and each column's sum. */
function numbersOf(result: Json): number[] {
  if (typeof result === "number") return [result];
  if (typeof result === "string") return /^-?\d+(\.\d+)?$/.test(result) ? [Number(result)] : [];
  if (!result || typeof result !== "object") return [];
  const values = Array.isArray(result) ? result : Object.values(result);
  const found = values.flatMap(numbersOf);
  if (Array.isArray(result)) {
    found.push(result.length);
    // A table's columns (find's rows) and a split's numbers (measure by), added up.
    const rows = result.map((r) =>
      Array.isArray(r) ? r : r && typeof r === "object" ? Object.values(r) : [r],
    );
    const width = Math.max(0, ...rows.map((r) => r.length));
    for (let i = 0; i < width; i++) {
      const column = rows.map((r) => numbersOf(r[i] ?? null)[0]).filter((n) => n !== undefined);
      if (column.length > 1) found.push(column.reduce((a, b) => a + b, 0));
    }
  }
  return found;
}

/**
 * The numbers in a text as amounts, counts or minutes: not dates, times, years or a list's
 * own numbering, or codes. "12,500.50", "12 500,50" and "12.500" read as people write them.
 */
export function numbersIn(text: string): number[] {
  const plain = text
    .replace(/\d{4}-\d{2}-\d{2}(?:[T ][\d:.]+Z?)?/g, " ")
    .replace(/\b\d{1,2}:\d{2}\b/g, " ")
    .replace(/^\s*\d+[.)]\s/gm, " ");
  const found: number[] = [];
  // A number joined to letters or a hyphen is part of a code (A-1, INV2026): a title, not an amount.
  for (const raw of plain.match(
    /(?<![\p{L}\d_-])(?:\d{1,3}(?:[\u00a0\u202f ,.]\d{3})+(?:[.,]\d+)?|\d+(?:[.,]\d+)?)(?![\p{L}_-])/gu,
  ) ?? []) {
    const n = amount(raw.replace(/[\u00a0\u202f ]/g, ""));
    if (n === undefined || (Number.isInteger(n) && n >= 1900 && n <= 2100)) continue;
    found.push(n);
  }
  return found;
}

/** "1,234.5", "1.234,5", "1 234", "12,5": the decimal mark is the last one not followed by three digits. */
function amount(raw: string): number | undefined {
  const marks = [...raw.matchAll(/[.,]/g)];
  const last = marks.at(-1);
  if (!last || last.index === undefined) return Number(raw);
  const decimals = raw.length - last.index - 1;
  const whole = decimals === 3 && marks.every((m) => m[0] === last[0]);
  const digits = whole
    ? raw.replace(/[.,]/g, "")
    : `${raw.slice(0, last.index).replace(/[.,]/g, "")}.${raw.slice(last.index + 1)}`;
  const n = Number(digits);
  return Number.isFinite(n) ? n : undefined;
}

/** Numbers compared to the cent. */
const key = (n: number) => Math.round(n * 100);
