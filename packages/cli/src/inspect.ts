import { kebab } from "@smithable/adapter-tanstack";
import type { FieldIR, SpecIR } from "@smithable/core";
import { exec, type Io } from "./io.js";
import { type RuleReport, ruleReports, STATUS_TEXT, TEST_RESULTS } from "./rules.js";
import { loadSpec } from "./validate.js";

/** `smithable inspect [concept]`: what a concept is, where it lives, and how its rules stand. */
export function inspect(dir: string, io: Io, concept: string | undefined): number {
  const { ir } = loadSpec(dir, io);
  if (!ir) return 1;
  const reports = ruleReports(dir, ir);
  if (concept === undefined) {
    if (reports.length === 0) io.out("No rules in smithable.yml.\n");
    let current = "";
    for (const report of reports) {
      if (report.concept !== current) {
        current = report.concept;
        io.out(`\n${current}\n`);
      }
      io.out(ruleLine(report));
    }
    return 0;
  }
  const details = describe(ir, concept);
  if (!details) {
    io.err(
      `There is no concept "${concept}". Use e.g. action:mergeCustomers, model:Order or page:orders.\n`,
    );
    return 1;
  }
  io.out(`${details}\n`);
  const own = reports.filter((r) => r.concept === concept);
  if (own.length) io.out(`\nRules\n${own.map(ruleLine).join("")}`);
  return 0;
}

/** `smithable test [dir]`: runs the app's tests and keeps the results for rule status. */
export function test(dir: string): number {
  const reporters = [
    "--reporter",
    "default",
    "--reporter",
    "json",
    "--outputFile.json",
    TEST_RESULTS,
  ];
  return exec("pnpm", ["exec", "vitest", "run", ...reporters], dir);
}

function ruleLine(report: RuleReport): string {
  const where = [...report.implementedIn, ...report.testedIn];
  return `  ${report.id ?? "(no id)"}  ${STATUS_TEXT[report.status]}\n    ${report.text}\n${where.length ? `    in ${where.join(", ")}\n` : ""}`;
}

function describe(ir: SpecIR, concept: string): string | undefined {
  const [kind, name = ""] = concept.split(":");
  const fields = (list: FieldIR[]) =>
    list.map((f) => `  ${f.name}${f.required ? "!" : ""}`).join("\n");
  const text = (t: { description?: string; intent?: string }) =>
    [t.description, t.intent]
      .filter(Boolean)
      .map((line) => `${line}\n`)
      .join("");
  switch (kind) {
    case "action": {
      const action = ir.actions.find((a) => a.name === name);
      if (!action) return undefined;
      return `Action ${action.name} (custom)\n${text(action)}\nInput\n${fields(action.input)}${
        action.output ? `\nOutput\n${fields(action.output)}` : ""
      }\n\nFiles\n  src/generated/actions/${kebab(name)}.ts (generated)\n  src/custom/actions/${kebab(name)}.ts (yours)`;
    }
    case "model": {
      const model = ir.models.find((m) => m.name === name);
      if (!model) return undefined;
      return `Model ${model.name}\n${text(model)}\nFields\n${fields(model.fields)}\n\nFiles\n  src/generated/${kebab(name)}.ts (generated)`;
    }
    case "page": {
      const page = ir.pages.find((p) => p.id === name);
      if (!page) return undefined;
      return `Page ${page.id} (${page.route}), manages ${page.pattern.model}\n${text(page)}`;
    }
    case "app":
      return `App ${ir.app.name}\n${text(ir.app)}`;
    default:
      return undefined;
  }
}
