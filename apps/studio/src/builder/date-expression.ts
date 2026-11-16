import type { SpecIR } from "@smithable/core";
import { type ReferenceOption, referenceOptions } from "./reference-options";
import { type ReferencePath, referenceAt } from "./reference-paths";

export type DateOffsets = "both" | "before" | "none";
export interface DateDraft {
  field: string;
  offset: boolean;
  amount: string;
  unit: "minute" | "hour" | "day";
  direction: "before" | "after";
}
export const dateDraft = (value: unknown): DateDraft => {
  const text = typeof value === "string" ? value.trim() : "";
  const parts = /^(\d+)\s+(minute|hour|day)s?\s+(before|after)\s+(.+)$/.exec(text);
  return parts
    ? {
        field: parts[4] ?? "",
        offset: true,
        amount: parts[1] ?? "",
        unit: parts[2] as DateDraft["unit"],
        direction: parts[3] as DateDraft["direction"],
      }
    : { field: text, offset: false, amount: "1", unit: "day", direction: "before" };
};
export const dateText = (draft: DateDraft) =>
  `${draft.offset ? `${draft.amount} ${draft.unit}${Number(draft.amount) === 1 ? "" : "s"} ${draft.direction} ` : ""}${draft.field}`;
const positive = (value: string) =>
  /^\d+$/.test(value) && Number(value) >= 1 && Number.isSafeInteger(Number(value));
export function dateDraftReady(
  draft: DateDraft,
  options: readonly ReferenceOption[],
  offsets: DateOffsets,
): boolean {
  return (
    options.some((option) => option.value === draft.field) &&
    (!draft.offset ||
      (offsets !== "none" &&
        positive(draft.amount) &&
        ["minute", "hour", "day"].includes(draft.unit) &&
        (draft.direction === "before" || (offsets === "both" && draft.direction === "after"))))
  );
}
export interface WindowDraft {
  mode: string;
  amount: string;
  unit: string;
}
export const windowDraft = (value: unknown): WindowDraft => {
  const text = typeof value === "string" ? value : "";
  const parts = /^(\d+) (day|week)s?$/.exec(text);
  return { mode: parts ? "span" : text, amount: parts?.[1] ?? "7", unit: parts?.[2] ?? "day" };
};
export const windowText = (draft: WindowDraft): string | undefined =>
  draft.mode === "span"
    ? `${draft.amount} ${draft.unit}${Number(draft.amount) === 1 ? "" : "s"}`
    : draft.mode || undefined;
export function windowReady(value: unknown): boolean {
  if (value === undefined || value === "today" || value === "tomorrow") return true;
  const draft = windowDraft(value);
  return (
    draft.mode === "span" &&
    /^\d+$/.test(draft.amount) &&
    Number(draft.amount) >= 1 &&
    ["day", "week"].includes(draft.unit)
  );
}
export type DateControl =
  | { kind: "date"; offsets: DateOffsets; options: ReferenceOption[] }
  | { kind: "window"; hasDate: boolean };
const object = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
/** Exact validator contexts: deadlines cannot be after, and list mail has a separate window. */
export function dateControl(
  path: ReferencePath,
  document: unknown,
  ir: SpecIR,
): DateControl | undefined {
  const [area, name, key, part] = path;
  const own = object(referenceAt(document, [String(area), String(name)]));
  if (
    area === "models" &&
    key === "capacity" &&
    path.length === 4 &&
    ["closes", "cancelUntil"].includes(String(part))
  ) {
    const per = object(own.capacity).per;
    const model = ir.models.find((model) => model.name === name);
    const reference = model?.fields.find((field) => field.name === per);
    const options =
      reference?.type.kind === "relation" && !reference.type.many
        ? referenceOptions({ kind: "field", model: reference.type.model, use: "datetime" }, ir).map(
            (option) => ({
              value: `${String(per)}.${option.value}`,
              label: `${String(per)} → ${option.label}`,
            }),
          )
        : [];
    return { kind: "date", offsets: "before", options };
  }
  if (area === "outgoing" && key === "list" && path.length === 4) {
    const list = object(own.list);
    const options =
      !list.query && typeof list.model === "string"
        ? referenceOptions({ kind: "field", model: list.model, use: "date", oneHop: true }, ir)
        : [];
    if (part === "when") return { kind: "date", offsets: "none", options };
    if (part === "within")
      return { kind: "window", hasDate: options.some((option) => option.value === list.when) };
  }
  return undefined;
}
/** All incomplete strings stay in the existing local parent draft until every date is valid. */
export function dateTreeReady(
  path: ReferencePath,
  value: unknown,
  document: unknown,
  ir: SpecIR,
): boolean {
  const control = dateControl(path, document, ir);
  if (control) {
    if (value === undefined) return true;
    return control.kind === "window"
      ? control.hasDate && windowReady(value)
      : typeof value === "string" &&
          dateDraftReady(dateDraft(value), control.options, control.offsets);
  }
  return (
    !value ||
    typeof value !== "object" ||
    Object.entries(value).every(([key, child]) =>
      dateTreeReady([...path, Array.isArray(value) ? Number(key) : key], child, document, ir),
    )
  );
}
