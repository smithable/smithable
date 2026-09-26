import { conceptsWithRules } from "../concepts.js";
import { type AnyOperation, type Operation, OperationError } from "../operation.js";
import { didYouMean } from "../suggest.js";
import { NAME_PATTERN } from "./names.js";

const setRuleId: Operation<{ concept: string; number: string; id: string }> = {
  name: "setRuleId",
  summary: "Give a rule a stable id, so code and tests can say they implement it.",
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
      throw new OperationError(
        `Rule id "${id}" must start with a lowercase letter and use only letters, digits and dashes.`,
      );
    }
    if (target.rules.some((r, i) => r.id === id && i !== index)) {
      throw new OperationError(`${concept} already has a rule with the id "${id}".`);
    }
    spec.setItem([...target.path, "rules"], index, { id, rule: rule.text });
    return [{ kind: "rule-identified", rule: `${target.owner}.${id}`, text: rule.text }];
  },
};

export const ruleOperations: AnyOperation[] = [setRuleId];
