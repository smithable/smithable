import { type FieldIR, type ModelIR, storesPictures } from "./ir.js";
import { titleField } from "./samples.js";

/**
 * The columns a list shows when its page names none: the title, a picture, the required fields,
 * then the rest, in the spec's order, five at most, never a long text but one: a model with no
 * short text to be titled by (a message: its words, who sent it) shows its first long text, first,
 * or its list would say nothing of what each record is. The app and Studio both go by this.
 */
export function defaultColumns(model: ModelIR): string[] {
  const long = (f: FieldIR) =>
    f.type.kind === "scalar" && (f.type.name === "text" || f.type.name === "markdown");
  const words = titleField(model) === "id" ? model.fields.find(long) : undefined;
  const rank = (f: FieldIR) =>
    f.name === titleField(model) || f === words ? 0 : storesPictures(f) ? 1 : f.required ? 2 : 3;
  return model.fields
    .filter((f) => !(f.type.kind === "relation" && f.type.many))
    .filter(
      (f) =>
        f === words ||
        !(f.type.kind === "scalar" && ["text", "markdown", "file", "files"].includes(f.type.name)),
    )
    .map((f, i) => ({ f, i }))
    .sort((a, b) => rank(a.f) - rank(b.f) || a.i - b.i)
    .slice(0, 5)
    .map(({ f }) => f.name);
}
