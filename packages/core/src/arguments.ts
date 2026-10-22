// The names an operation's argument can take in a spec, from its `x-smithable` annotation: one
// answer for Studio's and Builder's forms and the command line's completion.
import type { SpecIR } from "./ir.js";
import { humanize } from "./naming.js";
import type { ArgRef } from "./operation.js";
import { pageModel, partSections } from "./patterns.js";

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
    case "role":
      return roles.map((r) => [r, r]);
    case "grantNames": {
      const what = one(ref.what);
      if (what === "pages") return ir.pages.map((p): [string, string] => [p.id, humanize(p.id)]);
      if (what === "actions")
        return ir.actions
          .filter((a) => a.custom)
          .map((a): [string, string] => [a.name, humanize(a.name)]);
      return ["read", "create", "write", "delete"].includes(what ?? "")
        ? ir.models.map((m): [string, string] => [m.name, humanize(m.name)])
        : [];
    }
    case "field":
      return (modelOf(ref)?.fields ?? []).map((f) => [f.name, humanize(f.name)]);
    case "choiceValue": {
      const field = modelOf(ref)?.fields.find((f) => f.name === one(ref.field));
      return field?.type.kind === "choice" ? field.type.values.map((v) => [v, humanize(v)]) : [];
    }
    case "outgoing":
      return ir.outgoing.map((o) => [o.name, humanize(o.name)]);
    case "incoming":
      return ir.incoming.map((i) => [i.name, humanize(i.name)]);
    case "section": {
      const page = ir.pages.find((p) => p.id === one(ref.page));
      return page ? partSections(page).map((s) => [s.name, humanize(s.name)]) : [];
    }
  }
}
