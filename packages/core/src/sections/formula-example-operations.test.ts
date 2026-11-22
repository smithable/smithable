import { expect, test } from "vitest";
import { parse } from "yaml";
import { applyOperation, type ProjectFiles } from "../apply.js";

// Worked examples on a formula field and on a calculator, page or section (T1242 G4).
const spec = `smithable: 0.1
app: { name: Loans }
models:
  Line:
    fields:
      quantity: int
      price: money
      amount: { type: money, formula: quantity * price }
pages:
  lines: { crud: Line }
  mortgage:
    calculator:
      fields:
        price: money = 300000
        monthly: { type: money, formula: price / 12 }
  home:
    landing:
      hero:
      estimate: { calculator: { fields: { guests: int = 4, total: { type: money, formula: guests * 25 } } } }
`;
const files: ProjectFiles = { spec };

function ok(name: string, args: Record<string, unknown>, from: ProjectFiles = files) {
  const result = applyOperation(from, name, args);
  if (!result.ok) throw new Error(result.message);
  return result;
}
const refused = (name: string, args: Record<string, unknown>, from: ProjectFiles = files) => {
  const result = applyOperation(from, name, args);
  return result.ok ? "applied" : result.message;
};

test("addFormulaExample gives a formula field one expected value", () => {
  const added = ok("addFormulaExample", {
    of: "field:Line.amount",
    input: { quantity: 2, price: 5 },
    expected: 10,
  });
  expect(parse(added.files.spec).models.Line.fields.amount.examples).toEqual([
    { input: { quantity: 2, price: 5 }, expected: 10 },
  ]);
  expect(refused("addFormulaExample", { of: "field:Line.price", input: {}, expected: 1 })).toMatch(
    /has no formula/,
  );
  expect(
    refused("addFormulaExample", {
      of: "field:Line.amount",
      input: { quantity: 2 },
      expected: { amount: 1 },
    }),
  ).toMatch(/expects one value/);
});

test("addFormulaExample gives a calculator page and a section's calculator their results, and removeFormulaExample takes one away", () => {
  const page = ok("addFormulaExample", {
    of: "calculator:mortgage",
    input: { price: 1200 },
    expected: { monthly: 100 },
  });
  const twice = ok(
    "addFormulaExample",
    { of: "calculator:mortgage", input: { price: 2400 }, expected: { monthly: 200 } },
    page.files,
  );
  expect(parse(twice.files.spec).pages.mortgage.calculator.examples).toHaveLength(2);
  const one = ok("removeFormulaExample", { of: "calculator:mortgage", number: "1" }, twice.files);
  expect(parse(one.files.spec).pages.mortgage.calculator.examples).toEqual([
    { input: { price: 2400 }, expected: { monthly: 200 } },
  ]);
  const none = ok("removeFormulaExample", { of: "calculator:mortgage", number: "1" }, one.files);
  expect(parse(none.files.spec).pages.mortgage.calculator.examples).toBeUndefined();
  const section = ok("addFormulaExample", {
    of: "calculator:home.estimate",
    input: { guests: 2 },
    expected: { total: 50 },
  });
  expect(parse(section.files.spec).pages.home.landing.estimate.calculator.examples).toEqual([
    { input: { guests: 2 }, expected: { total: 50 } },
  ]);
  // The reader checks the names: a result is not an input, so the spec would be invalid.
  expect(
    refused("addFormulaExample", {
      of: "calculator:mortgage",
      input: { monthly: 1 },
      expected: { monthly: 1 },
    }),
  ).toMatch(/invalid/);
  expect(refused("addFormulaExample", { of: "calculator:lines", input: {}, expected: {} })).toMatch(
    /not a calculator page/,
  );
  expect(refused("removeFormulaExample", { of: "calculator:mortgage", number: "1" })).toMatch(
    /has 0 example/,
  );
});
