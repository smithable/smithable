import { expect, test } from "vitest";
import { applyOperation } from "./apply.js";
import { validateSpec } from "./spec.js";

const spec = `smithable: 0.1
app: { name: Loans }
pages:
  home:
    route: /
    landing:
      hero:
      repayment: { custom: RepaymentChart }
  planner: { custom: Planner }
`;
const read = (text: string) => validateSpec({ path: "smithable.yml", text });

test("a page and a landing section of your own name their components", () => {
  const { ir, diagnostics } = read(spec);
  expect(diagnostics).toEqual([]);
  expect(ir?.pages.find((p) => p.id === "planner")?.pattern).toEqual({
    kind: "custom",
    component: "Planner",
  });
  const home = ir?.pages.find((p) => p.id === "home")?.pattern;
  expect(home?.kind === "landing" && home.sections[1]).toEqual({
    name: "repayment",
    kind: "custom",
    component: "RepaymentChart",
  });
  const bad = read(spec.replace("custom: Planner", "custom: planner-page")).diagnostics;
  expect(bad.map((d) => d.message).join()).toContain("names a component, like Planner");
  // A calculator or custom section is known by its options, not by its name.
  const named = read(spec.replace("hero:", "custom:")).diagnostics;
  expect(named.map((d) => d.message).join()).toContain('There is no section kind "custom"');
});

test("addCustomPage and addSection --custom write them, and refuse a bad component name", () => {
  const page = applyOperation({ spec }, "addCustomPage", { page: "map", component: "SiteMap" });
  if (!page.ok) throw new Error(page.message);
  expect(page.files.spec).toContain("map:\n    custom: SiteMap");
  const section = applyOperation(page.files, "addSection", {
    page: "home",
    section: "video",
    custom: "Intro",
  });
  if (!section.ok) throw new Error(section.message);
  expect(section.files.spec).toMatch(/video:\s*\n?\s*custom: Intro/);
  const refused = applyOperation({ spec }, "addCustomPage", { page: "map", component: "map" });
  expect(refused.ok).toBe(false);
  expect(!refused.ok && refused.message).toContain("named like Planner");
});
