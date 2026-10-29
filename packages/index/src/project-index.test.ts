import { type SpecIR, validateSpec } from "@smithable/core";
import { describe, expect, test } from "vitest";
import { buildContext, estimateTokens } from "./context.js";
import {
  buildIndex,
  conceptsAt,
  findImplementation,
  findTests,
  hashRule,
  inspect,
} from "./project-index.js";

const crm = Object.values(
  import.meta.glob("../../../examples/crm/smithable.yml", {
    query: "?raw",
    import: "default",
    eager: true,
  }),
)[0] as string;

function spec(text: string): SpecIR {
  const result = validateSpec({ path: "smithable.yml", text });
  if (!result.ir) throw new Error(JSON.stringify(result.diagnostics));
  return result.ir;
}

// The CRM with a custom merge of its own (the starter's is a merge: Customer since intents.md §3),
// whose rule has an id.
const withRuleId = crm.replace(
  /^ {2}mergeCustomers:\n {4}merge: Customer.*\n/m,
  `  mergeCustomers:
    custom: true
    input: { keep: Customer!, duplicate: Customer! }
    intent: Merge a duplicate customer record into the one we keep.
    rules:
      - { id: move-orders, rule: All orders of the duplicate move to the kept customer. }
`,
);

const generated = {
  "action:mergeCustomers": {
    files: [{ path: "src/generated/actions/merge-customers.ts", symbols: ["MergeCustomersInput"] }],
    routes: ["/customers/actions/merge-customers"],
    tables: [],
    tests: [],
  },
  "model:Order": {
    files: [{ path: "src/db/schema.ts", symbols: ["orders"] }],
    routes: [],
    tables: ["orders"],
    tests: [{ file: "src/generated/access.test.ts", name: "Order" }],
  },
  "model:Customer": {
    files: [{ path: "src/db/schema.ts", symbols: ["customers"] }],
    routes: [],
    tables: ["customers"],
    tests: [],
  },
};

const IMPLEMENTATION = `import { eq } from "drizzle-orm";
import { orders } from "#/db/schema";
import type { MergeCustomersInput } from "#/generated/actions/merge-customers";

// implements rule mergeCustomers.move-orders
export async function mergeCustomers(input: MergeCustomersInput) {}
`;
const TEST = `import { test } from "vitest";
import { mergeCustomers } from "./merge-customers";

test("rule mergeCustomers.move-orders: the duplicate's orders move", () => {});
`;

const custom = [
  { path: "src/custom/actions/merge-customers.ts", text: IMPLEMENTATION },
  { path: "src/custom/actions/merge-customers.test.ts", text: TEST },
];

describe("buildIndex", () => {
  const index = buildIndex({
    ir: spec(withRuleId),
    generated,
    custom,
    ruleBaseline: {
      "mergeCustomers.move-orders": hashRule(
        "All orders of the duplicate move to the kept customer.",
      ),
    },
    testResults: [
      { title: "rule mergeCustomers.move-orders: the duplicate's orders move", passed: true },
    ],
  });

  test("a concept has its meaning, rules with status, files, routes and tests", () => {
    const action = inspect(index, "action:mergeCustomers");
    expect(action?.summary).toBe(
      "Custom action mergeCustomers(keep: Customer!, duplicate: Customer!)",
    );
    expect(action?.intent).toBe("Merge a duplicate customer record into the one we keep.");
    expect(action?.rules[0]).toEqual({
      id: "mergeCustomers.move-orders",
      text: "All orders of the duplicate move to the kept customer.",
      status: "tested",
      implementedIn: ["src/custom/actions/merge-customers.ts"],
      testedIn: ["src/custom/actions/merge-customers.test.ts"],
    });
    expect(action?.files.map((f) => `${f.path} ${f.role} ${f.symbols.join(",")}`)).toEqual([
      "src/generated/actions/merge-customers.ts generated MergeCustomersInput",
      "src/custom/actions/merge-customers.ts implements mergeCustomers",
      "src/custom/actions/merge-customers.test.ts tests ",
    ]);
    expect(findTests(index, "action:mergeCustomers")).toEqual([
      {
        file: "src/custom/actions/merge-customers.test.ts",
        name: "rule mergeCustomers.move-orders: the duplicate's orders move",
      },
    ]);
    expect(action?.related).toEqual(["model:Customer", "page:customers"]);
  });

  test("custom code that imports a model's symbols is listed as using it; unused models are not", () => {
    expect(findImplementation(index, "model:Order").map((f) => `${f.path} ${f.role}`)).toEqual([
      "src/db/schema.ts generated",
      "src/custom/actions/merge-customers.ts uses",
    ]);
    expect(findImplementation(index, "model:Customer").map((f) => f.role)).toEqual(["generated"]);
    expect(conceptsAt(index, "src/custom/actions/merge-customers.ts")).toEqual([
      "model:Order",
      "action:mergeCustomers",
    ]);
  });

  test("fields show their type and formula as written in the spec", () => {
    expect(inspect(index, "field:Order.shippingCost")?.summary).toBe(
      'Field Order.shippingCost: money computed: IF(AND(shippingMethod = "standard", total > 100), 0, IF(shippingMethod = "express", 15, 5))',
    );
    expect(inspect(index, "field:Customer.email")?.summary).toBe(
      "Field Customer.email: email unique",
    );
  });

  test("an edited rule is changed; without test results it has not run", () => {
    const edited = buildIndex({
      ir: spec(withRuleId.replace("move to the kept customer", "move to the customer we keep")),
      generated,
      custom,
      ruleBaseline: {
        "mergeCustomers.move-orders": hashRule(
          "All orders of the duplicate move to the kept customer.",
        ),
      },
    });
    expect(inspect(edited, "action:mergeCustomers")?.rules[0]?.status).toBe("changed");
    const notRun = buildIndex({ ir: spec(withRuleId), generated, custom });
    expect(inspect(notRun, "action:mergeCustomers")?.rules[0]?.status).toBe("not-run");
  });
});

describe("buildContext", () => {
  const index = buildIndex({ ir: spec(withRuleId), generated, custom });

  test("a request about customers' phone numbers starts with Customer and its phone field", () => {
    const slice = buildContext(index, "Customers should have a second phone number");
    expect(slice.concepts.slice(0, 2)).toEqual(["model:Customer", "field:Customer.phone"]);
    expect(slice.concepts.length).toBeLessThanOrEqual(6);
    expect(slice.text).toContain("- addField <model> <field> <type>");
    expect(slice.tokens.implementation).toBe(0);
    expect(slice.tokens.semantic).toBe(estimateTokens(slice.text));
  });

  test("custom code is included only when asked for, and only for the concepts found", () => {
    const slice = buildContext(index, "merge customers should also move invoices", {
      implementation: custom,
    });
    expect(slice.concepts[0]).toBe("action:mergeCustomers");
    expect(slice.text).toContain("--- src/custom/actions/merge-customers.ts");
    expect(slice.tokens.implementation).toBeGreaterThan(0);
    expect(slice.tokens.total).toBe(slice.tokens.semantic + slice.tokens.implementation);
  });
});
