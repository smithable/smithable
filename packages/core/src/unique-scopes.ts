import { uniqueScope } from "./access.js";
import type { AuthIR } from "./auth.js";
import { YamlEditor, type YamlValue } from "./edit.js";
import type { SpecIR, UniqueScope } from "./ir.js";
import { longForm } from "./sections/model-operations.js";

/**
 * Writes out where each unique value is unique (docs/design/uniqueness.md): every field whose
 * `unique` is the short form `true` (or a number counting up, unique by its nature) gets
 * `unique: owner` or `unique: app` as the access reads it today, and every rule of fields
 * unique together without a scope gets one. Run once by `smithable upgrade`, so that a later
 * change of roles or public pages never moves an index. Returns the text unchanged when nothing
 * was implicit.
 */
export function writeUniqueScopes(
  text: string,
  ir: SpecIR,
  auth: AuthIR,
): { text: string; written: string[] } {
  const spec = new YamlEditor(text);
  const written: string[] = [];
  for (const model of ir.models) {
    for (const f of model.fields) {
      if (f.unique !== true && !(f.sequence && !f.unique)) continue;
      const path = ["models", model.name, "fields", f.name];
      if (!spec.has(path)) continue;
      const scope: UniqueScope = uniqueScope(true, model, auth) ?? "app";
      const current = spec.get(path);
      const long: Record<string, YamlValue> =
        typeof current === "object" && current !== null
          ? { ...(current as Record<string, YamlValue>) }
          : longForm(String(current));
      long.type = String(long.type).replace(/\s+unique\b/, "");
      long.unique = scope;
      spec.set(path, long);
      written.push(`${model.name}.${f.name}: unique ${scope}`);
    }
    if (model.unique?.some((u) => u.scope === true)) {
      spec.set(
        ["models", model.name, "unique"],
        model.unique.map((u) => ({
          fields: u.fields,
          scope: (u.scope === true ? uniqueScope(true, model, auth) : u.scope) ?? "app",
        })),
      );
      written.push(
        `${model.name}: ${model.unique
          .filter((u) => u.scope === true)
          .map((u) => `${u.fields.join(" and ")} unique ${uniqueScope(true, model, auth)}`)
          .join(", ")}`,
      );
    }
  }
  return { text: written.length ? spec.text : text, written };
}
