import { expect, test } from "vitest";
import { applyOperation } from "./apply.js";
import { validateSpec } from "./spec.js";

const spec = (calculator: string) => `smithable: 0.1
app: { name: Bank }
models:
  Item:
    fields: { name: string! }
pages:
  items: { crud: Item }
  mortgage:
    calculator:
${calculator}
`;
const mortgage = `      fields:
        price: { type: money, min: 0, default: 300000 }
        deposit: { type: money, default: 60000 }
        years: { type: int, min: 5, max: 40, default: 25 }
        rate: { type: decimal, default: 4.5 }
        monthly: { type: money, formula: "PMT(rate / 100 / 12, years * 12, price - deposit)" }
        total: { type: money, formula: monthly * years * 12 }
      examples:
        - input: { price: 300000, deposit: 60000, years: 25, rate: 4.5 }
          expected: { monthly: 1334, total: 400200 }`;
const read = (calculator: string) =>
  validateSpec({ path: "smithable.yml", text: spec(calculator) });
const codes = (calculator: string) =>
  read(calculator).diagnostics.map((d) => `${d.severity} ${d.code}`);

test("a calculator page: fields as a model's, results by formula, examples over several results", () => {
  const { ir, diagnostics } = read(mortgage);
  expect(diagnostics).toEqual([]);
  const page = ir?.pages.find((p) => p.id === "mortgage");
  expect(page?.pattern.kind).toBe("calculator");
  if (page?.pattern.kind !== "calculator") throw new Error("pattern");
  expect(page.pattern.calculator.fields.map((f) => f.name)).toEqual([
    "price",
    "deposit",
    "years",
    "rate",
    "monthly",
    "total",
  ]);
  expect(page.pattern.calculator.fields.filter((f) => f.formula).map((f) => f.name)).toEqual([
    "monthly",
    "total",
  ]);
  expect(page.pattern.calculator.examples).toEqual([
    {
      input: { price: 300000, deposit: 60000, years: 25, rate: 4.5 },
      expected: { monthly: 1334, total: 400200 },
    },
  ]);
});

test("what a calculator's fields cannot be, and what its formulas and examples must fit", () => {
  expect(codes("      fields: { item: Item, x: { type: int, formula: '1' } }")).toEqual([
    "error invalid-field",
  ]);
  expect(codes("      fields: { name: string!, x: { type: int, formula: '1' } }")).toEqual([
    "error invalid-field",
  ]);
  expect(codes("      fields: { code: string unique, x: { type: int, formula: '1' } }")).toEqual([
    "error invalid-field",
  ]);
  expect(codes("      fields: { a: int }")).toEqual(["warning calculator-no-result"]);
  expect(codes('      fields: { a: int, b: { type: int, formula: "a + c" } }')).toEqual([
    "error invalid-formula",
  ]);
  expect(
    codes(
      "      fields: { a: int, b: { type: int, formula: a * 2 } }\n      examples: [{ input: { b: 1 }, expected: { a: 2 } }]",
    ),
  ).toEqual(["error invalid-example", "error invalid-example"]);
  expect(codes("      fields: { a: money, b: { type: money, formula: PMT(a) } }")).toEqual([
    "error invalid-formula",
  ]);
});

test("the field operations work on a calculator, at its place; renames follow into formulas and examples", () => {
  const files = { spec: spec(mortgage) };
  const added = applyOperation(files, "addField", {
    model: "mortgage",
    field: "fee",
    type: "money = 500",
  });
  expect(added.ok && added.files.spec).toContain("        fee: money = 500");
  const renamed = applyOperation(files, "renameField", {
    model: "mortgage",
    from: "rate",
    to: "interest",
  });
  expect(renamed.ok && renamed.files.spec).toContain(
    'formula: "PMT(interest / 100 / 12, years * 12, price - deposit)"',
  );
  expect(renamed.ok && renamed.files.spec).toContain("interest: 4.5 }");
  expect(renamed.ok && renamed.effects).toEqual([]);
  const removed = applyOperation(files, "removeField", { model: "mortgage", field: "deposit" });
  expect(removed).toMatchObject({ ok: false });
  const page = applyOperation(files, "addCalculatorPage", {
    page: "bmi",
    fields: { weight: "decimal = 70", height: "decimal = 175" },
  });
  expect(page.ok && page.files.spec).toContain(
    "  bmi:\n    calculator:\n      fields:\n        weight: decimal = 70\n        height: decimal = 175",
  );
  expect(
    applyOperation(files, "addCalculatorPage", { page: "mortgage", fields: { a: "int" } }),
  ).toMatchObject({ ok: false });
});

test("a landing section may be a calculator", () => {
  const { ir, diagnostics } = validateSpec({
    path: "smithable.yml",
    text: `smithable: 0.1
app: { name: Yoga }
pages:
  home:
    route: /
    landing:
      hero:
      estimate: { calculator: { fields: { visits: { type: int, default: 8 }, price: { type: money, default: 15 }, cost: { type: money, formula: visits * price } } } }
      footer:
`,
  });
  expect(diagnostics).toEqual([]);
  const home = ir?.pages[0];
  if (home?.pattern.kind !== "landing") throw new Error("landing");
  expect(home.pattern.sections.map((s) => s.kind)).toEqual(["hero", "calculator", "footer"]);
  expect(home.pattern.sections[1]?.calculator?.fields.map((f) => f.name)).toEqual([
    "visits",
    "price",
    "cost",
  ]);
});
