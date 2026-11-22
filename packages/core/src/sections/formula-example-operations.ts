import type { YamlValue } from "../edit.js";
import type { CalculatorIR, SpecIR } from "../ir.js";
import { type AnyOperation, type Operation, OperationError } from "../operation.js";
import { fieldPath } from "./model-operations.js";

type Value = string | number | boolean;

/**
 * What an example belongs to: a model's formula field ("field:Order.total"), whose example expects
 * one value, or a calculator ("calculator:mortgage", a section's "calculator:home.estimate"), whose
 * example expects some of its results.
 */
function exampleTarget(
  ir: SpecIR,
  of: string,
): { path: string[]; examples: number; calculator?: CalculatorIR } {
  const [kind, name = ""] = of.split(/:(.*)/);
  if (kind === "field") {
    const [model = "", field = ""] = name.split(".");
    const m = ir.models.find((x) => x.name === model);
    const f = m?.fields.find((x) => x.name === field);
    if (!m || !f) throw new OperationError(`There is no field ${name}: say field:Model.field.`);
    if (!f.formula)
      throw new OperationError(`${name} has no formula, so an example has nothing to check.`);
    return {
      path: [...fieldPath(model, field, ir), "examples"],
      examples: f.examples?.length ?? 0,
    };
  }
  if (kind === "calculator") {
    const [page = "", section] = name.split(".");
    const p = ir.pages.find((x) => x.id === page);
    if (!p) throw new OperationError(`There is no page named "${page}".`);
    if (section === undefined) {
      if (p.pattern.kind !== "calculator")
        throw new OperationError(
          `${page} is not a calculator page: say calculator:${page}.<section> for a section's.`,
        );
      const calculator = p.pattern.calculator;
      return {
        path: ["pages", page, "calculator", "examples"],
        examples: calculator.examples.length,
        calculator,
      };
    }
    const s = p.sections.find((x) => x.name === section);
    if (!s?.calculator)
      throw new OperationError(`${page} has no section "${section}" with a calculator.`);
    const where = p.pattern.kind === "landing" ? "landing" : "sections";
    return {
      path: ["pages", page, where, section, "calculator", "examples"],
      examples: s.calculator.examples.length,
      calculator: s.calculator,
    };
  }
  throw new OperationError(
    `"${of}" says no field or calculator: say field:Model.field, calculator:<page> or calculator:<page>.<section>.`,
  );
}

const SETS = [
  "smithable.yml:models.*.fields.*.examples",
  "smithable.yml:models.*.fields.*.examples.*",
  "smithable.yml:models.*.fields.*.examples.*.expected",
  "smithable.yml:models.*.fields.*.examples.*.input",
  "smithable.yml:pages.*.calculator.examples",
  "smithable.yml:pages.*.calculator.examples.*",
  "smithable.yml:pages.*.calculator.examples.*.expected",
  "smithable.yml:pages.*.calculator.examples.*.input",
  "smithable.yml:pages.*.landing.*.calculator.examples",
  "smithable.yml:pages.*.landing.*.calculator.examples.*",
  "smithable.yml:pages.*.landing.*.calculator.examples.*.expected",
  "smithable.yml:pages.*.landing.*.calculator.examples.*.input",
  "smithable.yml:pages.*.sections.*.calculator.examples",
  "smithable.yml:pages.*.sections.*.calculator.examples.*",
  "smithable.yml:pages.*.sections.*.calculator.examples.*.expected",
  "smithable.yml:pages.*.sections.*.calculator.examples.*.input",
];

const OF_ARG = {
  type: "string",
  description:
    'A formula field as field:Model.field, a calculator page as calculator:<page>, or a section\'s calculator as calculator:<page>.<section>, e.g. "calculator:mortgage".',
} as const;
const VALUE = { type: ["string", "number", "boolean"] } as const;

const addFormulaExample: Operation<{
  of: string;
  input: Record<string, Value>;
  expected: Value | Record<string, Value>;
}> = {
  name: "addFormulaExample",
  summary:
    "Add a worked example to a formula field or a calculator: the inputs, and what the formula gives for them. The app's tests check each example.",
  sets: SETS,
  schema: {
    type: "object",
    required: ["of", "input", "expected"],
    additionalProperties: false,
    properties: {
      of: OF_ARG,
      input: {
        type: "object",
        additionalProperties: VALUE,
        description: 'The inputs by field name, e.g. { "price": 300000, "years": 25 }.',
      },
      expected: {
        type: ["string", "number", "boolean", "object"],
        additionalProperties: VALUE,
        description:
          'A field\'s value for them, e.g. 1250; for a calculator, results by name, e.g. { "monthly": 1250 }.',
      },
    },
  },
  positional: ["of"],
  describe: ({ of }) => `Add an example to ${of.split(/:(.*)/)[1] ?? of}`,
  destructive: () => false,
  apply({ spec }, { of, input, expected }, ir) {
    const target = exampleTarget(ir, of);
    const map = typeof expected === "object" && expected !== null;
    if (target.calculator && !map)
      throw new OperationError(
        'A calculator\'s example expects its results by name, e.g. { "monthly": 1250 }.',
      );
    if (!target.calculator && map)
      throw new OperationError("A field's example expects one value: the formula's result.");
    const item: YamlValue = { input, expected } as YamlValue;
    // The list is written whole: a block item cannot go into a list inside { … }.
    if (target.examples) spec.set(target.path, [...(spec.get(target.path) as YamlValue[]), item]);
    else spec.add(target.path.slice(0, -1), "examples", [item]);
    return [];
  },
};

const removeFormulaExample: Operation<{ of: string; number: string }> = {
  name: "removeFormulaExample",
  summary:
    "Take a worked example away from a formula field or a calculator, by its place (from 1).",
  sets: SETS,
  schema: {
    type: "object",
    required: ["of", "number"],
    additionalProperties: false,
    properties: {
      of: OF_ARG,
      number: {
        type: "string",
        pattern: "^[1-9][0-9]*$",
        description: "The example's position in the list, from 1.",
      },
    },
  },
  positional: ["of", "number"],
  describe: ({ of, number }) => `Remove example ${number} of ${of.split(/:(.*)/)[1] ?? of}`,
  destructive: () => false,
  apply({ spec }, { of, number }, ir) {
    const target = exampleTarget(ir, of);
    const index = Number(number) - 1;
    if (index >= target.examples)
      throw new OperationError(`${of} has ${target.examples} example(s), not ${number}.`);
    if (target.examples === 1) spec.remove(target.path);
    else spec.removeItem(target.path, index);
    return [];
  },
};

export const formulaExampleOperations: AnyOperation[] = [addFormulaExample, removeFormulaExample];
