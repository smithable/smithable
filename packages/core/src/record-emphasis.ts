// Named record emphasis extends automatic selection without adding access or formula rules.

import type { At, ParseContext } from "./context.js";
import { checkKeys, mapEntries, readNameList } from "./context.js";
import type { FieldIR, ModelIR } from "./ir.js";
export const SUMMARY_PARTS = ["status", "amount", "dates"] as const;
export type SummaryPart = (typeof SUMMARY_PARTS)[number];
/** Omitted slot uses auto; [] explicitly shows none. Names never confer access. */
export type SummaryFields = Partial<Record<SummaryPart, string[]>>;
export const summaryEligible = (field: FieldIR, part: SummaryPart): boolean =>
  part === "status"
    ? field.type.kind === "choice"
    : field.type.kind === "scalar" &&
      (part === "amount"
        ? field.type.name === "money"
        : ["date", "datetime"].includes(field.type.name));
export function recordSummary(
  model: ModelIR,
  tones: Record<string, unknown>,
  fields?: SummaryFields,
): { status?: FieldIR; amount?: FieldIR; dates: FieldIR[] } {
  const choices = model.fields.filter((field) => summaryEligible(field, "status"));
  const status =
    fields?.status === undefined
      ? (choices.find((field) => tones[`${model.name}.${field.name}`]) ?? choices[0])
      : model.fields.find(
          (field) => field.name === fields.status?.[0] && summaryEligible(field, "status"),
        );
  const amount =
    fields?.amount === undefined
      ? model.fields.find((field) => summaryEligible(field, "amount"))
      : model.fields.find(
          (field) => field.name === fields.amount?.[0] && summaryEligible(field, "amount"),
        );
  const dates =
    fields?.dates === undefined
      ? model.fields.filter((field) => summaryEligible(field, "dates")).slice(0, 2)
      : fields.dates.flatMap((name) => {
          const field = model.fields.find(
            (field) => field.name === name && summaryEligible(field, "dates"),
          );
          return field ? [field] : [];
        });
  return { ...(status ? { status } : {}), ...(amount ? { amount } : {}), dates };
}
export function readSummaryFields(
  ctx: ParseContext,
  node: At,
  model: ModelIR | undefined,
): SummaryFields {
  const result: SummaryFields = {};
  if (!model) {
    ctx.error(node, "invalid-key", "Summary fields belong to a record page.");
    return result;
  }
  for (const entry of checkKeys(
    ctx,
    mapEntries(ctx, node, "the summary fields") ?? [],
    "the summary fields",
    { allowed: SUMMARY_PARTS },
  )) {
    const part = entry.key as SummaryPart;
    const names = readNameList(ctx, entry.value, `summary ${part}`);
    const limit = part === "dates" ? 2 : 1;
    if (names.length > limit)
      ctx.error(
        entry.value,
        "invalid-value",
        `Summary ${part} takes at most ${limit} field${limit === 1 ? "" : "s"}.`,
      );
    const selected: string[] = [];
    for (const { name, at } of names) {
      const field = model.fields.find((field) => field.name === name);
      if (!field) ctx.error(at, "unknown-field", `${model.name} has no field named "${name}".`);
      else if (!summaryEligible(field, part))
        ctx.error(
          at,
          "invalid-field",
          `Summary ${part} needs ${part === "status" ? "a choice" : part === "amount" ? "a money" : "a date or date-time"} field; ${name} is not one.`,
        );
      else if (selected.includes(name))
        ctx.error(at, "duplicate-name", `${name} appears twice in summary ${part}.`);
      else selected.push(name);
    }
    result[part] = selected; // Explicit [] stays distinct from omission.
  }
  return result;
}
