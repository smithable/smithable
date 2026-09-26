import type { Rule, SemanticText, SpecIR } from "./ir.js";

/** A concept of the spec that can carry rules, e.g. "action:mergeCustomers". */
export interface ConceptRules {
  concept: string;
  /** Qualifies rule ids: rule "move-orders" of action mergeCustomers is "mergeCustomers.move-orders". */
  owner: string;
  /** Where the concept is in smithable.yml. */
  path: string[];
  rules: Rule[];
}

/** Every concept of the spec with its rules, in spec order. */
export function conceptsWithRules(ir: SpecIR): ConceptRules[] {
  const entry = (concept: string, owner: string, path: string[], text: SemanticText) => ({
    concept,
    owner,
    path,
    rules: text.rules ?? [],
  });
  return [
    entry("app", "app", ["app"], ir.app),
    ...ir.models.flatMap((m) => [
      entry(`model:${m.name}`, m.name, ["models", m.name], m),
      ...m.fields.map((f) =>
        entry(
          `field:${m.name}.${f.name}`,
          `${m.name}.${f.name}`,
          ["models", m.name, "fields", f.name],
          f,
        ),
      ),
    ]),
    ...ir.actions.map((a) => entry(`action:${a.name}`, a.name, ["actions", a.name], a)),
    ...ir.pages.map((p) => entry(`page:${p.id}`, p.id, ["pages", p.id], p)),
  ];
}

/** The qualified id of a rule, e.g. "mergeCustomers.move-orders", or undefined without an id. */
export function ruleId(concept: ConceptRules, rule: Rule): string | undefined {
  return rule.id === undefined ? undefined : `${concept.owner}.${rule.id}`;
}
