// Part of the TanStack adapter's generator: a record's name from its parts
// (docs/design/record-names.md). A model named by one stored text field keeps today's title
// column; one named by several parts, a reference, a path or a date is named by a function of
// its own (src/generated/<model>.name.ts), from the columns its parts need, loaded with the record.
import {
  camel,
  type FieldIR,
  humanize,
  kebab,
  type ModelIR,
  type NamePartIR,
  type SpecIR,
  USER_MODEL,
} from "@smithable/core";
import {
  composedName as composed,
  HEADER,
  literal,
  modelNamed,
  type Texts,
  titleField,
} from "./shared.js";

export { composed };

/** The function that names a composed model's records, in its module. */
export const nameFunction = (model: ModelIR) => `${camel(model.name)}Name`;

const fieldOf = (model: ModelIR, name: string) =>
  model.fields.find((f) => f.name === name) as FieldIR;

const targetOf = (ir: SpecIR, f: FieldIR) =>
  f.type.kind === "relation" && f.type.model !== USER_MODEL
    ? modelNamed(ir, f.type.model)
    : undefined;

/**
 * The columns Drizzle loads for a record to be named: its title column, or what its parts need,
 * with the referenced records' own (one reference at a time, as names compose).
 */
export function nameColumns(ir: SpecIR, model: ModelIR, extra = ""): string {
  if (!composed(model)) {
    const f = titleField(model);
    return `{ columns: { id: true${f === "id" ? "" : `, ${f}: true`}${extra} } }`;
  }
  const columns = new Set<string>(["id"]);
  const withs = new Map<string, string>();
  for (const part of model.nameParts ?? []) {
    const ref = fieldOf(model, part.through ?? part.field);
    if (ref.type.kind !== "relation") {
      columns.add(part.field);
      continue;
    }
    if (ref.type.model === USER_MODEL) {
      withs.set(ref.name, "{ columns: { id: true, name: true } }");
      continue;
    }
    const target = modelNamed(ir, ref.type.model);
    withs.set(
      ref.name,
      part.through
        ? `{ columns: { id: true, ${part.field}: true } }`
        : nameColumns(ir, target, target.trash ? ", deletedAt: true" : ""),
    );
  }
  const cols = [...columns].map((c) => `${c}: true`).join(", ");
  const nested = [...withs].map(([k, v]) => `${k}: ${v}`).join(", ");
  return `{ columns: { ${cols}${extra} }${nested ? `, with: { ${nested} }` : ""} }`;
}

/**
 * A composed model's naming function, for its module: each part's words, " · " between them,
 * the empty ones left out, and the label and number when all are empty (record-names.md §1).
 */
export function nameModule(ir: SpecIR, model: ModelIR, t: Texts): string {
  const imports: [string, string][] = [["#/kit/format", "nameOf"]];
  const label = t.modelLabel(model);
  const value = (f: FieldIR, expr: string, owner: ModelIR): string => {
    if (f.type.kind === "choice") {
      const words = t.field(owner, f).values ?? {};
      const labels = Object.fromEntries(f.type.values.map((v) => [v, words[v] ?? humanize(v)]));
      return `((${literal(labels)}) as Record<string, string>)[String(${expr})] ?? ""`;
    }
    if (f.type.kind === "relation") {
      if (f.type.model === USER_MODEL)
        return `String((${expr} as { name?: unknown } | null | undefined)?.name ?? "")`;
      const target = modelNamed(ir, f.type.model);
      const ref = `(${expr} as Record<string, unknown> | null | undefined)`;
      if (composed(target)) {
        imports.push([`./${kebab(target.name)}.name`, nameFunction(target)]);
        return `${ref} ? ${nameFunction(target)}(${ref} as Record<string, unknown>) : ""`;
      }
      const title = titleField(target);
      if (title === "id") return `${ref} ? \`#\${${ref}?.id}\` : ""`;
      imports.push(["#/kit/format", "titleOf"]);
      return `titleOf(${ref}?.${title})`;
    }
    const kind = f.type.kind === "scalar" ? f.type.name : "string";
    if (kind === "date" || kind === "datetime") {
      imports.push(["#/kit/format", "shortWhen"], ["./app", "app"]);
      return `shortWhen(${expr}, ${kind === "date"}, app.timeZone)`;
    }
    if (kind === "money" || kind === "int" || kind === "decimal") {
      imports.push(
        ["#/kit/format", "formatValue"],
        ["./app", "app"],
        ["#/kit/model", "type FieldUi"],
      );
      return `${expr} == null ? "" : formatValue({ kind: ${JSON.stringify(kind)} } as FieldUi, ${expr}, app)`;
    }
    imports.push(["#/kit/format", "titleOf"]);
    return `titleOf(${expr})`;
  };
  const parts = (model.nameParts ?? []).map((part: NamePartIR) => {
    if (!part.through) return value(fieldOf(model, part.field), `row.${part.field}`, model);
    const ref = fieldOf(model, part.through);
    const target = targetOf(ir, ref) as ModelIR;
    return value(
      fieldOf(target, part.field),
      `(row.${ref.name} as Record<string, unknown> | null | undefined)?.${part.field}`,
      target,
    );
  });
  const words = (model.nameParts ?? []).map((p) =>
    p.through ? `${p.through}.${p.field}` : p.field,
  );
  const code = `
/** A ${label.toLowerCase()}'s name: ${words.join(" · ")} (smithable.yml's namedBy). */
export function ${nameFunction(model)}(row: Record<string, unknown>): string {
  return nameOf(
    [
      ${parts.join(",\n      ")},
    ],
    \`${label} #\${row.id}\`,
  );
}
`;
  const modules = new Map<string, Set<string>>();
  for (const [module, what] of imports)
    modules.set(module, (modules.get(module) ?? new Set()).add(what));
  const lines = [...modules]
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([module, what]) => {
      const all = [...what].sort();
      const types = all.filter((w) => w.startsWith("type "));
      return types.length === all.length
        ? `import type { ${all.map((w) => w.slice(5)).join(", ")} } from "${module}";`
        : `import { ${all.join(", ")} } from "${module}";`;
    });
  return `${HEADER}${lines.join("\n")}
${code}`;
}
