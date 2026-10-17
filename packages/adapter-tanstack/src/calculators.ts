// Part of the TanStack adapter's generator: calculators (docs/design/calculator.md), on a page
// of their own or as a landing section. A calculator is a model to the formula module and the
// form (its fields, computed as you type), with no table, data functions or route of a record.
import {
  type CalculatorIR,
  camel,
  kebab,
  type ModelIR,
  type PageIR,
  pascal,
  type SpecIR,
  type UxIR,
} from "@smithable/core";
import { fieldUi } from "./data.js";
import { formulasModuleSource, withFormulasName } from "./formulas.js";
import { attr, code, guard, HEADER, importList, indexPath, literal, type Texts } from "./shared.js";

/** A calculator as the formula module and the form see it: a model named after its place. */
export function calculatorModel(name: string, calculator: CalculatorIR): ModelIR {
  return { name: `${pascal(name.replace(/\./g, "-"))}Calculator`, fields: calculator.fields };
}

/** The generated files of a calculator: its ui module, formulas and the examples' test. */
export function calculatorFiles(
  name: string,
  calculator: CalculatorIR,
  page: string,
  ir: SpecIR,
  t: Texts,
  ux: UxIR,
  /** The landing section it is, when not a page of its own. */
  section?: string,
): Record<string, string> {
  const model = calculatorModel(name, calculator);
  const base = `src/generated/${kebab(model.name)}`;
  const test = calculatorTestSource(model, calculator);
  return {
    [`${base}.ts`]: calculatorModule(model, page, section, ir, t, ux),
    [`${base}.formulas.ts`]: formulasModuleSource(model, ir),
    ...(test ? { [`${base}.formulas.test.ts`]: test } : {}),
  };
}

/** The calculator's fields as the kit's form reads them, with its formulas to compute. */
function calculatorModule(
  model: ModelIR,
  page: string,
  section: string | undefined,
  ir: SpecIR,
  t: Texts,
  ux: UxIR,
): string {
  const ui = {
    label: model.name,
    pluralLabel: model.name,
    titleField: model.fields[0]?.name ?? "",
    columns: [],
    fields: model.fields.map((field) => {
      const own = t.calculatorField(page, field.name, section);
      return {
        ...fieldUi(model, field, t, ir, ux),
        ...(own.label ? { label: own.label } : {}),
        ...(own.help ? { help: own.help } : {}),
      };
    }),
    compute: code(withFormulasName(model)),
  };
  return `${HEADER}import type { ModelUi } from "#/kit/model";
import { ${withFormulasName(model)} } from "./${kebab(model.name)}.formulas";

/** The ${camel(model.name)}'s inputs and results, as the kit's calculator reads them. */
export const ${camel(model.name)}Ui: ModelUi = ${literal(ui)};
`;
}

/** A Vitest test per example: the inputs must give every expected result. */
function calculatorTestSource(model: ModelIR, calculator: CalculatorIR): string | undefined {
  if (!calculator.examples.length) return undefined;
  const isMoney = (name: string) => {
    const f = model.fields.find((x) => x.name === name);
    return f?.type.kind === "scalar" && f.type.name === "money";
  };
  const inCents = (name: string, value: unknown) =>
    isMoney(name) && typeof value === "number" ? Math.round(value * 100) : value;
  const tests = calculator.examples.map((example) => {
    const input = Object.entries(example.input).map(
      ([k, v]) => `${k}: ${JSON.stringify(inCents(k, v))}`,
    );
    const expected = Object.entries(example.expected).map(
      ([k, v]) => `${k}: ${JSON.stringify(inCents(k, v))}`,
    );
    const title = Object.entries(example.input)
      .map(([k, v]) => `${k} ${v}`)
      .join(", ");
    return `  test(${JSON.stringify(
      `${title} gives ${Object.entries(example.expected)
        .map(([k, v]) => `${k} ${v}`)
        .join(", ")}`,
    )}, () => {
    expect(${withFormulasName(model)}({ ${input.join(", ")} })).toMatchObject({ ${expected.join(", ")} });
  });`;
  });
  return `${HEADER}// The examples given for the ${camel(model.name)}: each must give the expected results.
import { describe, expect, test } from "vitest";
import { ${withFormulasName(model)} } from "./${kebab(model.name)}.formulas";

describe(${JSON.stringify(model.name)}, () => {
${tests.join("\n\n")}
});
`;
}

/** A calculator page's route: the kit's calculator with the page's texts. */
export function calculatorRoute(
  page: PageIR & { pattern: { kind: "calculator"; calculator: CalculatorIR } },
  t: Texts,
  ux: UxIR,
): string {
  const model = calculatorModel(page.id, page.pattern.calculator);
  const component = `${pascal(page.id)}Page`;
  const ui = `${camel(model.name)}Ui`;
  const imports = importList()
    .add("@tanstack/react-router", "createFileRoute")
    .add("#/generated/app", "app")
    .add("#/generated/pages", "pageAccess")
    .add(`#/generated/${kebab(model.name)}`, ui)
    .add("#/kit/access", "guardPage")
    .add("#/kit/AppShell", "PageHeader")
    .add("#/kit/Calculator", "Calculator");
  const results = t.section(page.id, "results").title;
  return `${HEADER}${imports.render()}

export const Route = createFileRoute(${JSON.stringify(indexPath(page.route))})({
${guard(`pageAccess[${JSON.stringify(page.id)}]`)}${t.head(page)}  component: ${component},
});

function ${component}() {
  return (
    <>
      <PageHeader page=${attr(page.id)} ${t.pageHeader(page.id)} />
      <Calculator ui={${ui}} app={app}${results ? ` resultsTitle=${attr(results)}` : ""}${ux.pages[page.id]?.results === "below" ? ' layout="below"' : ""} />
    </>
  );
}
`;
}
