import {
  type AuthIR,
  type SpecIR,
  validateAuth,
  validateContent,
  validateSpec,
} from "@smithable/core";
import { expect, test } from "vitest";
import { generateApp } from "./generate.js";
import { customPageFromEdit, customPageSource } from "./pages/custom.js";

test("a page and a section of your own: a generated route around a component created once", () => {
  const ir = validateSpec({
    path: "smithable.yml",
    text: "smithable: 0.1\napp: { name: Loans }\npages:\n  home:\n    route: /\n    landing:\n      hero:\n      repayment: { custom: RepaymentChart }\n  planner: { custom: Planner }\n",
  }).ir as SpecIR;
  const auth = validateAuth(
    {
      path: "smithable.auth.yml",
      text: "smithableAuth: 0.1\nsignIn: none\npublic: { pages: [home, planner] }\n",
    },
    ir,
  ).auth as AuthIR;
  const content = validateContent(
    {
      path: "smithable.content.yml",
      text: "smithableContent: 0.1\npages:\n  planner: { title: Plan your week }\n  home:\n    repayment: { title: Your repayments }\n",
    },
    ir,
  ).content;
  const files = generateApp(ir, { smithableVersion: "0.0.0", auth, content });
  const file = (path: string) => files.find((f) => f.path === path);
  expect(file("src/routes/planner/index.tsx")?.content).toContain(
    '<Planner page="planner" title={pageUi["planner"].title} />',
  );
  expect(file("src/generated/pages.ts")?.content).toContain('planner: { title: "Plan your week" }');
  expect(file("src/routes/index.tsx")?.content).toContain(
    '<RepaymentChart\n          name="repayment"\n          texts="pages.home.repayment"\n          title="Your repayments"',
  );
  // The components are the project's: written once, never again (zone "custom").
  expect(file("src/custom/pages/Planner.tsx")?.zone).toBe("custom");
  expect(file("src/custom/sections/RepaymentChart.tsx")?.content).toContain(
    "export function RepaymentChart({ name, texts, title, text }: CustomSectionProps)",
  );
  expect(file("src/generated/custom.ts")?.zone).toBe("generated");
});

test("a dashboard page can be customized from the generated source or a hand-edited route", () => {
  const ir = validateSpec({
    path: "smithable.yml",
    text: "smithable: 0.1\napp: { name: Shop }\nmodels:\n  Order:\n    fields: { total: money! }\npages:\n  orders: { crud: Order }\n  overview:\n    route: /\n    dashboard:\n      orders: { count: Order }\n",
  }).ir as SpecIR;
  const auth = validateAuth(
    {
      path: "smithable.auth.yml",
      text: "smithableAuth: 0.1\nsignIn: { providers: [email] }\ndefaultAccess: shared\nroles: { admin: all }\n",
    },
    ir,
  ).auth as AuthIR;
  const options = { smithableVersion: "0.0.0", auth };
  const source = customPageSource(ir, "overview", options);
  expect(source).toContain('const route = getRouteApi("/");');
  expect(source).toContain('import { pageUi } from "#/generated/pages";');
  expect(source).toContain("export function OverviewPage()");
  expect(source).toContain("route.useLoaderData()");

  const generated =
    generateApp(ir, options).find((f) => f.path === "src/routes/index.tsx")?.content ?? "";
  const edited = generated.replace("<PageHeader", '<div className="banner" /><PageHeader');
  const moved = customPageFromEdit(ir, "overview", options, edited);
  expect(moved.ok).toBe(true);
  if (moved.ok) {
    expect(moved.source).toContain('const route = getRouteApi("/");');
    expect(moved.source).toContain('import { pageUi } from "#/generated/pages";');
    expect(moved.source).toContain("export function OverviewPage()");
    expect(moved.source).toContain('<div className="banner" />');
  }
});
