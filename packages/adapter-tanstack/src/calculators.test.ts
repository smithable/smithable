import {
  type AuthIR,
  emptyContent,
  type SpecIR,
  validateAuth,
  validateContent,
  validateSpec,
} from "@smithable/core";
import { expect, test } from "vitest";
import { generateApp } from "./generate.js";

const ir = validateSpec({
  path: "smithable.yml",
  text: `smithable: 0.1
app: { name: Bank }
pages:
  home:
    route: /
    landing:
      hero:
      estimate: { calculator: { fields: { visits: { type: int, default: 8 }, price: { type: money, default: 15 }, cost: { type: money, formula: visits * price } } } }
      footer:
  mortgage:
    calculator:
      fields:
        price: { type: money, default: 300000 }
        years: { type: int, default: 25 }
        rate: { type: decimal, default: 4.5 }
        monthly: { type: money, formula: "PMT(rate / 100 / 12, years * 12, price)" }
      examples:
        - input: { price: 240000, years: 25, rate: 4.5 }
          expected: { monthly: 1334 }
`,
}).ir as SpecIR;
const auth = validateAuth(
  {
    path: "smithable.auth.yml",
    text: "smithableAuth: 0.1\nsignIn: none\npublic: { pages: [home, mortgage] }\n",
  },
  ir,
).auth as AuthIR;
const content =
  validateContent(
    {
      path: "smithable.content.yml",
      text: "smithableContent: 0.1\npages:\n  mortgage: { results: { title: Your payment }, fields: { rate: { label: Interest rate, help: Yearly } } }\n  home:\n    estimate: { title: What would it cost?, results: Per month, fields: { visits: { label: Visits a month } } }\n",
    },
    ir,
  ).content ?? emptyContent();
const files = generateApp(ir, { smithableVersion: "0.0.0", auth, content });
const file = (path: string) => files.find((f) => f.path === path)?.content ?? "";

test("a calculator page: its ui, formulas and examples' test, the route, and the kit's calculator", () => {
  const ui = file("src/generated/mortgage-calculator.ts");
  expect(ui).toContain("export const mortgageCalculatorUi: ModelUi");
  expect(ui).toContain('label: "Interest rate"');
  expect(ui).toContain('help: "Yearly"');
  expect(ui).toContain("compute: withMortgageCalculatorFormulas");
  expect(file("src/generated/mortgage-calculator.formulas.ts")).toContain("F.PMT(");
  expect(file("src/generated/mortgage-calculator.formulas.test.ts")).toContain(
    "expect(withMortgageCalculatorFormulas({ price: 24000000, years: 25, rate: 4.5 })).toMatchObject({ monthly: 133400 });",
  );
  const route = file("src/routes/mortgage/index.tsx");
  expect(route).toContain(
    '<Calculator ui={mortgageCalculatorUi} app={app} resultsTitle="Your payment" />',
  );
  expect(files.some((f) => f.path === "src/kit/Calculator.tsx")).toBe(true);
});

test("a landing section that is a calculator", () => {
  const home = file("src/routes/index.tsx");
  expect(home).toContain(
    '<Calculator ui={homeEstimateCalculatorUi} app={app} resultsTitle="Per month" />',
  );
  expect(home).toContain('title="What would it cost?"');
  expect(file("src/generated/home-estimate-calculator.ts")).toContain('label: "Visits a month"');
});

test("without a calculator nothing of it is generated", () => {
  const plain = validateSpec({
    path: "smithable.yml",
    text: "smithable: 0.1\napp: { name: A }\nmodels:\n  Item:\n    fields: { name: string! }\npages:\n  items: { crud: Item }\n",
  }).ir as SpecIR;
  const none = validateAuth(
    {
      path: "smithable.auth.yml",
      text: "smithableAuth: 0.1\nsignIn: none\npublic: { pages: [items], read: [Item] }\n",
    },
    plain,
  ).auth as AuthIR;
  const app = generateApp(plain, {
    smithableVersion: "0.0.0",
    auth: none,
    content: emptyContent(),
  });
  expect(app.some((f) => f.path === "src/kit/Calculator.tsx")).toBe(false);
  expect(app.some((f) => f.path.includes("calculator"))).toBe(false);
});
