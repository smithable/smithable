// The names an operation's argument can take in a spec, from its `x-smithable` annotation: one
// answer for Studio's and Builder's forms and the command line's completion.
import { ACCESS_OPERATIONS, type SpecIR } from "./ir.js";
import { humanize } from "./naming.js";
import type { ArgRef } from "./operation.js";
import { pageModel } from "./patterns.js";

/**
 * The names `ref` can take, as [value, label], given the other arguments so far (a field's
 * model, a value's field) and the roles smithable.auth.yml defines.
 */
export function namesFor(
  ref: ArgRef,
  args: Record<string, unknown>,
  ir: SpecIR,
  roles: string[],
): [string, string][] {
  const one = (key: string) => (typeof args[key] === "string" ? (args[key] as string) : undefined);
  const modelOf = (r: { model: string } | { page: string }) => {
    if ("model" in r) return ir.models.find((m) => m.name === one(r.model));
    const page = ir.pages.find((p) => p.id === one(r.page));
    return page && ir.models.find((m) => m.name === pageModel(page));
  };
  switch (ref.ref) {
    case "model":
      return ir.models.map((m) => [m.name, m.name]);
    case "page":
      return ir.pages.map((p) => [p.id, humanize(p.id)]);
    case "menu":
      return [...new Set(["main", ...ir.navigation.map((m) => m.name)])].map((m) => [
        m,
        humanize(m),
      ]);
    case "accessTarget":
      return [
        ...ir.models.flatMap((m) =>
          ACCESS_OPERATIONS.map((op): [string, string] => [
            `model:${m.name}.${op}`,
            `${humanize(op)} ${humanize(m.name).toLowerCase()} records`,
          ]),
        ),
        ...ir.pages.map((p): [string, string] => [
          `page:${p.id}`,
          `Open the ${humanize(p.id).toLowerCase()} page`,
        ]),
        ...ir.actions.map((a): [string, string] => [`action:${a.name}`, humanize(a.name)]),
      ];
    case "role": {
      // A record's owner is a rule for reading, changing and deleting records, not creating them.
      const target = ref.target ? one(ref.target) : undefined;
      const owner = !ref.target || (target?.startsWith("model:") && !target.endsWith(".create"));
      return [...roles, ...(owner ? ["owner"] : [])].map((r) => [
        r,
        r === "owner" ? "the record's owner" : r,
      ]);
    }
    case "field":
      return (modelOf(ref)?.fields ?? []).map((f) => [f.name, humanize(f.name)]);
    case "choiceValue": {
      const field = modelOf(ref)?.fields.find((f) => f.name === one(ref.field));
      return field?.type.kind === "choice" ? field.type.values.map((v) => [v, humanize(v)]) : [];
    }
    case "section": {
      const page = ir.pages.find((p) => p.id === one(ref.page));
      return page?.pattern.kind === "landing"
        ? page.pattern.sections.map((s) => [s.name, humanize(s.name)])
        : [];
    }
  }
}
