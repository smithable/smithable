import { describe, expect, test } from "vitest";
import { checkFormula, FormulaError, formatFormula, parseFormula } from "./formula.js";
import type { ModelIR, SpecIR } from "./ir.js";
import { validateSpec } from "./spec.js";

describe("parseFormula", () => {
  test("precedence: comparison < + - & < * /", () => {
    expect(parseFormula("1 + 2 * 3 > 6")).toEqual({
      kind: "binary",
      op: ">",
      left: {
        kind: "binary",
        op: "+",
        left: { kind: "number", value: 1 },
        right: {
          kind: "binary",
          op: "*",
          left: { kind: "number", value: 2 },
          right: { kind: "number", value: 3 },
        },
      },
      right: { kind: "number", value: 6 },
    });
  });

  test("functions, fields, text and aggregates", () => {
    expect(parseFormula("IF(total > 100, 0, 5)")).toMatchObject({ kind: "call", name: "IF" });
    expect(parseFormula('name & " (" & city & ")"')).toMatchObject({ kind: "binary", op: "&" });
    expect(parseFormula("SUM(lines.amount)")).toEqual({
      kind: "aggregate",
      name: "SUM",
      list: "lines",
      field: "amount",
    });
    expect(parseFormula('COUNTIF(bookings.status, "confirmed")')).toMatchObject({
      kind: "aggregate",
      name: "COUNTIF",
    });
    expect(parseFormula("MAX(a, b)")).toMatchObject({ kind: "call", name: "MAX" });
    expect(parseFormula("MAX(lines.amount)")).toMatchObject({ kind: "aggregate", name: "MAX" });
    expect(parseFormula("round(-x, 2)")).toMatchObject({ kind: "call", name: "ROUND" });
  });

  test.each([
    ["IF(a > 1, 2", 'Expected a closing ")" at the end.'],
    ['"open', "A text value is missing its closing quote."],
    ["a !== b", '"!" cannot be used in a formula.'],
    ["SUMM(lines.amount)", "Unknown function SUMM."],
    ["SUM(total)", "SUM needs a list and a field, like SUM(lines.amount)."],
    ["1 +", "The formula ends too early."],
  ])("%s → %s", (text, message) => {
    expect(() => parseFormula(text)).toThrow(message);
  });
});

describe("checkFormula", () => {
  const spec = validateSpec({
    path: "smithable.yml",
    text: `smithable: 0.1
app: { name: X }
models:
  Invoice:
    fields:
      issuedOn: date!
      total: money!
      status: draft | sent | paid
      paid: bool
      lines: InvoiceLine[]
  InvoiceLine:
    fields:
      invoice: Invoice!
      amount: money!
      kind: product | service
`,
  }).ir as SpecIR;
  const invoice = spec.models[0] as ModelIR;
  const check = (text: string) => checkFormula(parseFormula(text), invoice, spec.models);
  const failure = (text: string) => {
    try {
      check(text);
    } catch (error) {
      if (error instanceof FormulaError) return [error.message, error.hint];
    }
    throw new Error("expected an error");
  };

  test.each([
    ["IF(total > 100, 0, 5)", "number"],
    ['status = "paid"', "bool"],
    ['DATEADD(issuedOn, 30, "day")', "date"],
    ["DAYS(TODAY(), issuedOn)", "number"],
    ["NOW()", "datetime"],
    ['COUNTIF(lines.kind, "service")', "number"],
    ["SUM(lines.amount) - total", "number"],
    ['"Invoice " & total', "text"],
  ])("%s is a %s", (text, type) => {
    expect(check(text)).toBe(type);
  });

  test.each([
    ["totl * 2", ['Invoice has no field "totl".', 'Did you mean "total"?']],
    ['status = "payed"', ['"payed" is not a choice of status.', 'Did you mean "paid"?']],
    ["total + paid", ["+ needs a number, not a bool.", undefined]],
    ["IF(total, 1, 2)", ["The condition of IF needs a bool, not a number.", undefined]],
    [
      "lines.amount",
      [
        '"lines.amount" refers to related records. Use it inside SUM, COUNT, COUNTIF, AVG, MIN, MAX, LAST or FIRST.',
        undefined,
      ],
    ],
    ["SUM(line.amount)", ['Invoice has no list named "line".', 'Did you mean "lines"?']],
    ['COUNTIF(lines.kind, "goods")', ['"goods" is not a choice of InvoiceLine.kind.', undefined]],
    [
      'DATEADD(issuedOn, 1, "week")',
      ['The unit of DATEADD must be "day", "month" or "year".', undefined],
    ],
  ])("%s fails", (text, expected) => {
    expect(failure(text)).toEqual(expected);
  });
});

describe("formatFormula", () => {
  test.each([
    'IF(AND(shippingMethod = "standard", total > 100), 0, IF(shippingMethod = "express", 15, 5))',
    "quantity * unitPrice",
    "(a + b) * c",
    "a - (b - c)",
    "a - b - c",
    "-(a + b)",
    'COUNTIF(bookings.status, "confirmed")',
    "SUM(lines.amount) + COUNT(lines)",
    'DATEADD(issuedOn, 30, "day")',
    "TRUE",
  ])("%s reads back the same", (source) => {
    expect(formatFormula(parseFormula(source))).toBe(source);
  });
});
