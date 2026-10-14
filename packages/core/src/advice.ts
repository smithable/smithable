// Advice on a spec that is valid as it is (docs/design/advice.md): notes, each with the
// operation that does what it says. Deterministic, run after the sections when the spec has no
// errors; a note never changes what the app does.
import type { ParseContext } from "./context.js";
import type { FieldIR, ModelIR, SpecIR } from "./ir.js";
import { plural } from "./naming.js";
import { pageModel } from "./patterns.js";

const lower = (name: string) => name.charAt(0).toLowerCase() + name.slice(1);

/** The one reference of `from` to `to`, if there is exactly one and no list back. */
function oneReference(from: ModelIR, to: ModelIR): FieldIR | undefined {
  const refs = from.fields.filter(
    (f) => f.type.kind === "relation" && !f.type.many && f.type.model === to.name,
  );
  const listed = to.fields.some(
    (f) => f.type.kind === "relation" && f.type.many && f.type.model === from.name,
  );
  return refs.length === 1 && !listed ? refs[0] : undefined;
}

export function advise(ctx: ParseContext, ir: SpecIR): void {
  for (const model of ir.models) {
    for (const other of ir.models) {
      if (other === model) continue;
      // A model others refer to, with no list back: its page shows none of them.
      const ref = oneReference(other, model);
      if (ref && other.name !== "User") {
        const field = plural(lower(other.name));
        if (!model.fields.some((f) => f.name === field))
          ctx.note(
            ctx.at(`model:${model.name}`),
            "list-back",
            `${other.name} refers to ${model.name} (${ref.name}), but the ${model.name} page does not list its ${field}.`,
            { op: "addField", args: { model: model.name, field, type: `${other.name}[]` } },
            `Add "${field}: ${other.name}[]" to ${model.name}: the page then lists them, with a button to add one.`,
          );
      }
      // A required reference to a model with a trash, from one without: the parent cannot go.
      const required = other.fields.find(
        (f) =>
          f.type.kind === "relation" && !f.type.many && f.type.model === model.name && f.required,
      );
      if (model.trash && !other.trash && required)
        ctx.note(
          ctx.at(`model:${other.name}`),
          "trash-together",
          `${model.name} has a trash but ${other.name} has none, so a ${lower(model.name)} with ${plural(lower(other.name))} cannot be put in the trash.`,
          { op: "setTrash", args: { model: other.name, trash: true } },
          `Give ${other.name} a trash too: they then go to the trash together and come back together.`,
        );
    }
  }
  // A list of records with a choice to filter by, and no filters on any of the model's lists.
  for (const page of ir.pages) {
    if (page.pattern.kind !== "crud" || page.filters?.length || page.mine || page.favorites)
      continue;
    const model = ir.models.find((m) => m.name === pageModel(page));
    if (!model) continue;
    const elsewhere = ir.pages.some(
      (p) =>
        p !== page && p.pattern.kind === "crud" && pageModel(p) === model.name && p.filters?.length,
    );
    if (elsewhere) continue;
    const choices = model.fields.filter((f) => f.type.kind === "choice").map((f) => f.name);
    if (!choices.length) continue;
    ctx.note(
      ctx.at(`page:${page.id}`),
      "filters-possible",
      `${page.id} lists ${plural(lower(model.name))} with ${choices.join(" and ")}, but offers no filter.`,
      { op: "setFilters", args: { page: page.id, fields: choices } },
      `Add "filters: [${choices.join(", ")}]" to the page: each becomes a row of chips over the list.`,
    );
  }
}
