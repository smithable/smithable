import { YamlEditor } from "./edit.js";
import type { ModelIR, SpecIR } from "./ir.js";
import { titleFieldByRule } from "./samples.js";

/**
 * The title rule before 2026-10-21 (docs/design/inference.md): a short text field called like a
 * name or title came first. Kept here only for `smithable upgrade`, which writes out what it
 * settled where today's rule would pick another field.
 */
function titleFieldByName(model: ModelIR): string | undefined {
  return model.fields.find(
    (f) =>
      f.type.kind === "scalar" &&
      f.type.name === "string" &&
      !f.formula &&
      /name|title/i.test(f.name),
  )?.name;
}

/**
 * Writes `namedBy` on every model whose title the old rule read from a field's name and today's
 * rule would read from another field, so an upgraded app keeps the titles it had. Returns the text
 * unchanged when nothing was implicit.
 */
export function writeNamedBy(text: string, ir: SpecIR): { text: string; written: string[] } {
  const spec = new YamlEditor(text);
  const written: string[] = [];
  for (const model of ir.models) {
    if (model.namedBy || model.nameParts) continue;
    const named = titleFieldByName(model);
    if (!named || named === titleFieldByRule(model)) continue;
    if (!spec.has(["models", model.name])) continue;
    spec.add(["models", model.name], "namedBy", named);
    written.push(`${model.name}: namedBy ${named}`);
  }
  return { text: written.length ? spec.text : text, written };
}
