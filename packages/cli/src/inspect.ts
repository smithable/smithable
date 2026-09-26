import type { ConceptInfo, RuleInfo } from "@smithable/index";
import { exec, type Io } from "./io.js";
import { projectIndex, STATUS_TEXT, TEST_RESULTS } from "./rules.js";
import { loadSpec } from "./validate.js";

/**
 * `smithable inspect [concept] [--json]`: every rule and its status, or one concept: what it
 * means, its rules, and the files, symbols, routes, tables and tests that implement it.
 */
export function inspect(dir: string, io: Io, concept: string | undefined, json = false): number {
  const { ir, auth } = loadSpec(dir, io);
  if (!ir || !auth) return 1;
  const index = projectIndex(dir, ir, auth);
  if (concept === undefined) {
    if (json) {
      io.out(
        `${JSON.stringify(
          index.concepts.map((c) => ({ concept: c.concept, summary: c.summary })),
          null,
          2,
        )}\n`,
      );
      return 0;
    }
    const withRules = index.concepts.filter((c) => c.rules.length);
    if (withRules.length === 0) io.out("No rules in smithable.yml.\n");
    for (const c of withRules) io.out(`\n${c.concept}\n${c.rules.map(ruleLine).join("")}`);
    return 0;
  }
  const info = index.concepts.find((c) => c.concept === concept);
  if (!info) {
    io.err(
      `There is no concept "${concept}". Use e.g. action:mergeCustomers, model:Order, field:Order.total or page:orders.\n`,
    );
    return 1;
  }
  io.out(json ? `${JSON.stringify(info, null, 2)}\n` : describe(info));
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

function ruleLine(rule: RuleInfo): string {
  const where = [...rule.implementedIn, ...rule.testedIn];
  return `  ${rule.id ?? "(no id)"}  ${STATUS_TEXT[rule.status]}\n    ${rule.text}\n${where.length ? `    in ${where.join(", ")}\n` : ""}`;
}

const ROLE_TEXT = {
  generated: "generated",
  implements: "yours, implements it",
  uses: "yours, uses it",
  tests: "yours, tests it",
};

/** A concept as plain text, for people and agents alike. */
export function describe(info: ConceptInfo): string {
  const section = (title: string, lines: string[]) =>
    lines.length ? `\n${title}\n${lines.map((l) => `  ${l}\n`).join("")}` : "";
  return [
    `${info.summary}\n`,
    info.description ? `${info.description}\n` : "",
    info.intent ? `Intent: ${info.intent}\n` : "",
    info.rules.length ? `\nRules\n${info.rules.map(ruleLine).join("")}` : "",
    section("Related", [info.related.join(", ")].filter(Boolean)),
    section(
      "Files",
      info.files.map(
        (f) =>
          `${f.path} (${ROLE_TEXT[f.role]})${f.symbols.length ? `: ${f.symbols.join(", ")}` : ""}`,
      ),
    ),
    section("Routes", info.routes),
    section("Tables", info.tables),
    section(
      "Tests",
      info.tests.map((t) => `${t.file}: ${t.name}`),
    ),
  ].join("");
}
