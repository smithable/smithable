import { type ConceptRules, conceptsWithRules } from "../concepts.js";
import type { YamlValue } from "../edit.js";
import type { SpecIR } from "../ir.js";
import { type AnyOperation, type Operation, OperationError } from "../operation.js";
import { didYouMean } from "../suggest.js";
import { longForm } from "./model-operations.js";
import { NAME_PATTERN, nameRule } from "./names.js";

const setRuleId: Operation<{ concept: string; number: string; id: string }> = {
  name: "setRuleId",
  summary: "Give a rule a stable id, so code and tests can say they implement it.",
  sets: [
    "smithable.yml:app.rules.*.id",
    "smithable.yml:models.*.rules.*.id",
    "smithable.yml:models.*.fields.*.rules.*.id",
    "smithable.yml:actions.*.rules.*.id",
    "smithable.yml:queries.*.rules.*.id",
    "smithable.yml:pages.*.rules.*.id",
  ],
  schema: {
    type: "object",
    required: ["concept", "number", "id"],
    additionalProperties: false,
    properties: {
      concept: {
        type: "string",
        description: 'e.g. "action:mergeCustomers", "model:Order" or "field:Order.total".',
      },
      number: {
        type: "string",
        pattern: "^[1-9][0-9]*$",
        description: "The rule's position in the list, from 1.",
      },
      id: { type: "string", description: 'A short name, e.g. "move-orders".' },
    },
  },
  positional: ["concept", "number", "id"],
  describe: ({ concept, number, id }) => `Give rule ${number} of ${concept} the id ${id}`,
  destructive: () => false,
  apply({ spec }, { concept, number, id }, ir) {
    const concepts = conceptsWithRules(ir);
    const target = concepts.find((c) => c.concept === concept);
    if (!target) {
      throw new OperationError(
        `There is no concept "${concept}". ${
          didYouMean(
            concept,
            concepts.map((c) => c.concept),
          ) ?? 'Use e.g. "action:mergeCustomers".'
        }`,
      );
    }
    const index = Number(number) - 1;
    const rule = target.rules[index];
    if (!rule)
      throw new OperationError(`${concept} has ${target.rules.length} rule(s), not ${number}.`);
    if (!NAME_PATTERN.test(id)) {
      throw new OperationError(nameRule("rule", id));
    }
    if (target.rules.some((r, i) => r.id === id && i !== index)) {
      throw new OperationError(`${concept} already has a rule with the id "${id}".`);
    }
    spec.setItem([...target.path, "rules"], index, { id, rule: rule.text });
    return [{ kind: "rule-identified", rule: `${target.owner}.${id}`, text: rule.text }];
  },
};

/** The concept named, or a refusal with the nearest name. */
function conceptNamed(ir: SpecIR, concept: string): ConceptRules {
  const concepts = conceptsWithRules(ir);
  const target = concepts.find((c) => c.concept === concept);
  if (target) return target;
  throw new OperationError(
    `There is no concept "${concept}". ${
      didYouMean(
        concept,
        concepts.map((c) => c.concept),
      ) ?? 'Use e.g. "app", "model:Order", "field:Order.total" or "action:mergeCustomers".'
    }`,
  );
}

const CONCEPT_ARG = {
  type: "string",
  description:
    'app, model:<Model>, field:<Model.field>, action:<name>, query:<name> or page:<name>, e.g. "model:Order".',
} as const;

const RULES_KEYS = [
  "smithable.yml:app.rules",
  "smithable.yml:app.rules.*",
  "smithable.yml:app.rules.*.rule",
  "smithable.yml:models.*.rules",
  "smithable.yml:models.*.rules.*",
  "smithable.yml:models.*.rules.*.rule",
  "smithable.yml:models.*.fields.*.rules",
  "smithable.yml:models.*.fields.*.rules.*",
  "smithable.yml:models.*.fields.*.rules.*.rule",
  "smithable.yml:actions.*.rules",
  "smithable.yml:actions.*.rules.*",
  "smithable.yml:actions.*.rules.*.rule",
  "smithable.yml:queries.*.rules",
  "smithable.yml:queries.*.rules.*",
  "smithable.yml:queries.*.rules.*.rule",
  "smithable.yml:pages.*.rules",
  "smithable.yml:pages.*.rules.*",
  "smithable.yml:pages.*.rules.*.rule",
];

const addRule: Operation<{ concept: string; rule: string; id?: string }> = {
  name: "addRule",
  summary:
    "Write a domain rule as a sentence on the app, a model, a field, an action, a query or a page. A rule does nothing by itself until something implements it; an id lets code and tests say they do.",
  sets: RULES_KEYS,
  schema: {
    type: "object",
    required: ["concept", "rule"],
    additionalProperties: false,
    properties: {
      concept: CONCEPT_ARG,
      rule: {
        type: "string",
        minLength: 1,
        description: 'The sentence, e.g. "An order over 1000 EUR needs a manager\'s approval".',
      },
      id: { type: "string", description: 'A short name, e.g. "big-orders".' },
    },
  },
  positional: ["concept", "rule"],
  describe: ({ concept }) => `Add a rule to ${concept}`,
  destructive: () => false,
  apply({ spec }, { concept, rule, id }, ir) {
    const target = conceptNamed(ir, concept);
    const text = rule.trim();
    if (!text) throw new OperationError("A rule is a sentence: say it.");
    if (id !== undefined) {
      if (!NAME_PATTERN.test(id)) throw new OperationError(nameRule("rule", id));
      if (target.rules.some((r) => r.id === id))
        throw new OperationError(`${concept} already has a rule with the id "${id}".`);
    }
    if (target.rules.some((r) => r.text === text))
      throw new OperationError(`${concept} has that rule already.`);
    const item: YamlValue = id === undefined ? text : { id, rule: text };
    // A field written as shorthand gets its long form, its type as its own key.
    const written = spec.get(target.path);
    if (typeof written === "string") {
      spec.set(target.path, { ...longForm(written), rules: [item] });
      return [];
    }
    // The list is written whole: a block item cannot go into a list inside { … }.
    const list = spec.get([...target.path, "rules"]);
    if (Array.isArray(list)) spec.set([...target.path, "rules"], [...(list as YamlValue[]), item]);
    else spec.add(target.path, "rules", [item]);
    return [];
  },
};

const removeRule: Operation<{ concept: string; number: string }> = {
  name: "removeRule",
  summary:
    "Take a rule away from the app, a model, a field, an action, a query or a page, by its position in the list (from 1).",
  sets: RULES_KEYS,
  schema: {
    type: "object",
    required: ["concept", "number"],
    additionalProperties: false,
    properties: {
      concept: CONCEPT_ARG,
      number: {
        type: "string",
        pattern: "^[1-9][0-9]*$",
        description: "The rule's position in the list, from 1.",
      },
    },
  },
  positional: ["concept", "number"],
  describe: ({ concept, number }) => `Remove rule ${number} of ${concept}`,
  // A rule with an id may be one code or tests say they implement.
  destructive: ({ concept, number }, ir) => {
    const target = conceptsWithRules(ir).find((c) => c.concept === concept);
    return target?.rules[Number(number) - 1]?.id !== undefined;
  },
  apply({ spec }, { concept, number }, ir) {
    const target = conceptNamed(ir, concept);
    const index = Number(number) - 1;
    if (!target.rules[index])
      throw new OperationError(`${concept} has ${target.rules.length} rule(s), not ${number}.`);
    const at = [...target.path, "rules"];
    if (target.rules.length === 1) spec.remove(at);
    else spec.removeItem(at, index);
    // A field left with its type (and default) alone goes back to its shorthand.
    if (concept.startsWith("field:")) {
      const long = spec.get(target.path) as Record<string, YamlValue>;
      const keys = Object.keys(long).filter((k) => k !== "type" && k !== "default");
      // A choice keeps its default as its own key: "=" on a choice is refused.
      const [model, field] = concept.slice(6).split(".");
      const choice =
        ir.models.find((m) => m.name === model)?.fields.find((x) => x.name === field)?.type.kind ===
        "choice";
      if (!keys.length && typeof long.type === "string" && !(choice && long.default !== undefined))
        spec.set(
          target.path,
          long.default === undefined ? long.type : `${long.type} = ${String(long.default)}`,
        );
    }
    return [];
  },
};

export const ruleOperations: AnyOperation[] = [setRuleId, addRule, removeRule];
