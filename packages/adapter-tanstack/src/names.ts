// Part of the TanStack adapter's generator: a record's name from its parts
// (docs/design/record-names.md). A model named by one stored text field keeps today's title
// column; one named by several parts, a reference, a path or a date is named by a function of
// its own (src/generated/<model>.name.ts), from the columns its parts need, loaded with the record.
// The lines a page shows under a name (the ux file's record: subtitle, detail) are read there too.
import {
  camel,
  type FieldIR,
  kebab,
  type ModelIR,
  type NamePartIR,
  type SpecIR,
  USER_MODEL,
  type UxIR,
} from "@smithable/core";
import {
  composedName as composed,
  HEADER,
  modelNamed,
  names,
  type Texts,
  titleField,
} from "./shared.js";

export { composed };

/** The function that names a composed model's records, in its module. */
export const nameFunction = (model: ModelIR) => `${camel(model.name)}Name`;

/** The function that gives a record's lines under its name, in the same module. */
export const linesFunction = (model: ModelIR) => `${camel(model.name)}Lines`;

const fieldOf = (model: ModelIR, name: string) =>
  model.fields.find((f) => f.name === name) as FieldIR;

const targetOf = (ir: SpecIR, f: FieldIR) =>
  f.type.kind === "relation" && f.type.model !== USER_MODEL
    ? modelNamed(ir, f.type.model)
    : undefined;

/**
 * The lines under a record's name (record-names.md §3): the ux file's `record` on the model's
 * list page, where its records are shown and chosen. None when the page says nothing.
 */
export function recordLines(
  ir: SpecIR,
  ux: UxIR | undefined,
  model: ModelIR,
): { subtitle?: NamePartIR; detail?: NamePartIR[] } | undefined {
  const page = ir.pages.find(
    (p) =>
      p.pattern.kind === "crud" &&
      p.pattern.model === model.name &&
      (ux?.pages[p.id]?.subtitle || ux?.pages[p.id]?.detail?.length),
  );
  const own = page ? ux?.pages[page.id] : undefined;
  return own
    ? {
        ...(own.subtitle ? { subtitle: own.subtitle } : {}),
        ...(own.detail?.length ? { detail: own.detail } : {}),
      }
    : undefined;
}

/** Whether a model has a module of its name: a name of parts, or lines under it. */
export const named = (ir: SpecIR, ux: UxIR | undefined, model: ModelIR) =>
  composed(model) || recordLines(ir, ux, model) !== undefined;

/** The parts of a record's lines, as one list. */
const lineParts = (lines: ReturnType<typeof recordLines>): NamePartIR[] =>
  lines ? [...(lines.subtitle ? [lines.subtitle] : []), ...(lines.detail ?? [])] : [];

/**
 * The columns Drizzle loads for a record to be named: its title column, or what its parts need,
 * with the referenced records' own (one reference at a time, as names compose); `also`, more
 * parts to load (the lines under the name).
 */
export function nameColumns(
  ir: SpecIR,
  model: ModelIR,
  extra = "",
  also: NamePartIR[] = [],
): string {
  const parts = [...(composed(model) ? (model.nameParts ?? []) : []), ...also];
  const columns = new Set<string>(["id"]);
  const title = titleField(model);
  if (!composed(model) && title !== "id") columns.add(title);
  const withs = new Map<string, { columns: Set<string>; named: boolean }>();
  for (const part of parts) {
    const ref = fieldOf(model, part.through ?? part.field);
    if (ref.type.kind !== "relation") {
      columns.add(part.field);
      continue;
    }
    const entry = withs.get(ref.name) ?? { columns: new Set<string>(), named: false };
    if (part.through) entry.columns.add(part.field);
    else entry.named = true;
    withs.set(ref.name, entry);
  }
  const nested = [...withs].map(([key, { columns: cols, named: whole }]) => {
    const ref = fieldOf(model, key);
    const own = [...cols].filter((c) => c !== "id");
    if (ref.type.kind === "relation" && ref.type.model === USER_MODEL)
      return `${key}: { columns: { id: true, name: true${own
        .filter((c) => c !== "name")
        .map((c) => `, ${c}: true`)
        .join("")} } }`;
    const target = targetOf(ir, ref) as ModelIR;
    const paths = own.map((c) => ({ field: c }));
    // With whether it is in the trash: a field of a trashed record shows nothing.
    return `${key}: ${
      whole
        ? nameColumns(ir, target, target.trash ? ", deletedAt: true" : "", paths)
        : `{ columns: { id: true${own.map((c) => `, ${c}: true`).join("")}${target.trash ? ", deletedAt: true" : ""} } }`
    }`;
  });
  const cols = [...columns].map((c) => `${c}: true`).join(", ");
  return `{ columns: { ${cols}${extra} }${nested.length ? `, with: { ${nested.join(", ")} }` : ""} }`;
}

/**
 * A model's name module: its naming function for a name of parts, each part's words with
 * " · " between them, the empty ones left out, and the label and number when all are empty
 * (record-names.md §1); and the lines under the name a page asks for (§3).
 */
export function nameModule(ir: SpecIR, model: ModelIR, t: Texts, ux?: UxIR): string {
  const imports: [string, string][] = [];
  const label = t.modelLabel(model);
  const value = (f: FieldIR, expr: string, owner: ModelIR): string => {
    if (f.type.kind === "choice") {
      // Its label as the model's description has it: a label is written once (words-once.md).
      const ui = names(owner, t).ui;
      imports.push([`./${kebab(owner.name)}`, ui]);
      return `${ui}.fields.find((f) => f.name === ${JSON.stringify(f.name)})?.choices?.find((c) => c.value === ${expr})?.label ?? ""`;
    }
    if (f.type.kind === "relation") {
      if (f.type.model === USER_MODEL)
        return `String((${expr} as { name?: unknown } | null | undefined)?.name ?? "")`;
      const target = modelNamed(ir, f.type.model);
      const ref = `(${expr} as Record<string, unknown> | null | undefined)`;
      // One in the trash names nothing (docs/design/trash.md).
      const live = target.trash ? `${ref} && !${ref}?.deletedAt` : ref;
      if (composed(target)) {
        if (target !== model) imports.push([`./${kebab(target.name)}.name`, nameFunction(target)]);
        // As the data functions showed it, when they did: its parts hidden as for the viewer.
        return `${live} ? String((${ref} as Record<string, unknown>).$name ?? ${nameFunction(target)}(${ref} as Record<string, unknown>)) : ""`;
      }
      const title = titleField(target);
      if (title === "id") return `${live} ? \`#\${${ref}?.id}\` : ""`;
      imports.push(["#/kit/format", "titleOf"]);
      return `${live} ? titleOf(${ref}?.${title}) : ""`;
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
  const partCode = (part: NamePartIR) => {
    if (!part.through) return value(fieldOf(model, part.field), `row.${part.field}`, model);
    const ref = fieldOf(model, part.through);
    const target = targetOf(ir, ref);
    const via = `(row.${ref.name} as Record<string, unknown> | null | undefined)`;
    // A user's own field (a person's name), as text.
    if (!target) {
      imports.push(["#/kit/format", "titleOf"]);
      return `titleOf(${via}?.${part.field})`;
    }
    // A field of a record in the trash shows nothing.
    return value(
      fieldOf(target, part.field),
      target.trash
        ? `(${via}?.deletedAt ? undefined : ${via}?.${part.field})`
        : `${via}?.${part.field}`,
      target,
    );
  };
  const words = (parts: NamePartIR[]) =>
    parts.map((p) => (p.through ? `${p.through}.${p.field}` : p.field)).join(" · ");
  let code = "";
  if (composed(model)) {
    imports.push(["#/kit/format", "nameOf"]);
    const parts = model.nameParts ?? [];
    code += `
/**
 * A ${label.toLowerCase()}'s name: ${words(parts)} (smithable.yml's namedBy). \`leave\`: parts a
 * page already shows another way (a calendar's start), left out.
 */
export function ${nameFunction(model)}(row: Record<string, unknown>, leave: readonly string[] = []): string {
  const parts: [string, string][] = [
    ${parts.map((p) => `[${JSON.stringify(p.through ? `${p.through}.${p.field}` : p.field)}, ${partCode(p)}]`).join(",\n    ")},
  ];
  return nameOf(
    parts.filter(([part]) => !leave.includes(part)).map(([, words]) => words),
    \`${label} #\${row.id}\`,
  );
}
`;
  }
  const lines = recordLines(ir, ux, model);
  // A part's code may be a ternary (a reference), so it is bracketed before `|| undefined`.
  if (lines) {
    imports.push(["#/kit/format", "nameOf"]);
    code += `
/** What a ${label.toLowerCase()} shows under its name where there is room (smithable.ux.yml's record). */
export function ${linesFunction(model)}(row: Record<string, unknown>): { subtitle?: string; detail?: string } {
  return {${lines.subtitle ? `\n    subtitle: (${partCode(lines.subtitle)}) || undefined,` : ""}${lines.detail?.length ? `\n    detail: nameOf([${lines.detail.map(partCode).join(", ")}], "") || undefined,` : ""}
  };
}
`;
  }
  const modules = new Map<string, Set<string>>();
  for (const [module, what] of imports)
    modules.set(module, (modules.get(module) ?? new Set()).add(what));
  const header = [...modules]
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([module, what]) => {
      const all = [...what].sort();
      const types = all.filter((w) => w.startsWith("type "));
      return types.length === all.length
        ? `import type { ${all.map((w) => w.slice(5)).join(", ")} } from "${module}";`
        : `import { ${all.join(", ")} } from "${module}";`;
    });
  return `${HEADER}${header.join("\n")}
${code}`;
}

/** The lines' parts, for loading the columns they need with a model's records. */
export const linesParts = (ir: SpecIR, ux: UxIR | undefined, model: ModelIR) =>
  lineParts(recordLines(ir, ux, model));
