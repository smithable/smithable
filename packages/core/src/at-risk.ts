/**
 * The fields whose words a question may read two ways (docs/design/ask-words.md §3, the rule-only
 * pre-pass): a choice whose values are everyday words ("down" is a status and a word people use
 * for "not working"), a kind with more than one date (which is "newest"?) or more than one amount
 * (which is "the total"?). The ones without a
 * `description` are at risk; with one, the assistant has the app's words. No model: the spec alone.
 */
import type { FieldIR, ModelIR, SpecIR } from "./ir.js";

export interface AtRisk {
  model: string;
  field: string;
  /** Why, in a sentence for the pass and for Studio. */
  why: string;
  /** The field has a description already: not at risk, but still a word to ask about. */
  explained: boolean;
}

/**
 * Choice values that are also words people use loosely in a question. A value is split into its
 * words (onHold: on, hold) and matches on a whole word only: "online" is not "on".
 */
export const EVERYDAY_WORDS = [
  "active",
  "approved",
  "blocked",
  "busy",
  "cancelled",
  "canceled",
  "closed",
  "complete",
  "completed",
  "confirmed",
  "degraded",
  "delayed",
  "done",
  "down",
  "draft",
  "due",
  "failed",
  "free",
  "full",
  "high",
  "inactive",
  "late",
  "live",
  "low",
  "new",
  "off",
  "on",
  "open",
  "overdue",
  "paid",
  "pending",
  "published",
  "ready",
  "rejected",
  "resolved",
  "sent",
  "unpaid",
  "up",
  "urgent",
  "waiting",
] as const;

const DATES = ["date", "datetime"];
// Counts (int) are left out: quantities and sort orders are rarely "the total".
const AMOUNTS = ["money", "decimal"];

const words = (value: string): string[] =>
  value
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean);

/** The everyday words among a choice's values. */
export function everyday(values: readonly string[]): string[] {
  return values.filter((v) => words(v).some((w) => EVERYDAY_WORDS.includes(w as never)));
}

const label = (fields: FieldIR[]) => fields.map((f) => f.name).join(", ");

/** The fields at risk in every model, the unexplained first. */
export function wordsAtRisk(ir: SpecIR): AtRisk[] {
  const found: AtRisk[] = [];
  for (const model of ir.models) {
    for (const field of model.fields) {
      if (field.type.kind !== "choice") continue;
      const loose = everyday(field.type.values);
      if (!loose.length) continue;
      found.push(
        risk(
          model,
          field,
          `${loose.length === 1 ? `"${loose[0]}" is` : `${loose.map((v) => `"${v}"`).join(", ")} are`} both a value of ${field.name} and a word a question uses loosely.`,
        ),
      );
    }
    const dates = model.fields.filter(
      (f) => !f.formula && f.type.kind === "scalar" && DATES.includes(f.type.name),
    );
    if (dates.length > 1)
      for (const field of dates)
        found.push(
          risk(
            model,
            field,
            `${model.name} has ${dates.length} dates (${label(dates)}): "newest" or "latest" may mean any of them.`,
          ),
        );
    const amounts = model.fields.filter(
      (f) => !f.formula && f.type.kind === "scalar" && AMOUNTS.includes(f.type.name),
    );
    if (amounts.length > 1)
      for (const field of amounts)
        found.push(
          risk(
            model,
            field,
            `${model.name} has ${amounts.length} numbers (${label(amounts)}): "the total" or "how much" may mean any of them.`,
          ),
        );
  }
  return found.sort((a, b) => Number(a.explained) - Number(b.explained));
}

const risk = (model: ModelIR, field: FieldIR, why: string): AtRisk => ({
  model: model.name,
  field: field.name,
  why,
  explained: !!field.description,
});
