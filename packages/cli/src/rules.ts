import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";
import { conceptsWithRules, ruleId, type SpecIR } from "@smithable/core";

/** Where the texts of rules are recorded when they get an id; committed with the project. */
const BASELINE = ".smithable/rules.json";
/** The last `smithable test` results; local, like the rest of data/. */
export const TEST_RESULTS = "data/.smithable/test-results.json";

export type RuleStatus =
  | "not-implemented"
  | "untested"
  | "not-run"
  | "failing"
  | "tested"
  | "changed";

export const STATUS_TEXT: Record<RuleStatus, string> = {
  "not-implemented": "Not implemented",
  untested: "Implemented, untested",
  "not-run": "Implemented and tested, but the tests have not run (smithable test)",
  failing: "Implemented, test failing",
  tested: "Implemented and tested",
  changed: "Changed since it was implemented: review the code",
};

export interface RuleReport {
  concept: string;
  id?: string;
  text: string;
  status: RuleStatus;
  implementedIn: string[];
  testedIn: string[];
}

export function hashRule(text: string): string {
  return createHash("sha256").update(text.trim()).digest("hex").slice(0, 16);
}

/** Records a rule's text when it gets an id, so later edits show as "changed". */
export function recordRule(dir: string, id: string, text: string): void {
  const baseline = readJson<Record<string, string>>(join(dir, BASELINE)) ?? {};
  baseline[id] = hashRule(text);
  const sorted = Object.fromEntries(Object.entries(baseline).sort(([a], [b]) => (a < b ? -1 : 1)));
  writeFileSync(join(dir, BASELINE), `${JSON.stringify(sorted, null, 2)}\n`);
}

/**
 * The status of every rule, computed from the project's files (ARCHITECTURE §2.3):
 * `// implements rule <id>` in src/custom marks code, `test("rule <id>: …")` marks tests,
 * and the last `smithable test` run says whether they pass.
 */
export function ruleReports(dir: string, ir: SpecIR): RuleReport[] {
  const implemented = new Map<string, string[]>();
  const tested = new Map<string, string[]>();
  for (const file of sourceFiles(join(dir, "src", "custom"))) {
    const text = readFileSync(file, "utf8");
    const path = relative(dir, file);
    const isTest = /\.test\.tsx?$/.test(file);
    const pattern = isTest
      ? /\b(?:test|it)\(\s*["'`]rule ([\w.-]+):/g
      : /implements rule ([\w.-]+)/g;
    for (const match of text.matchAll(pattern)) {
      const id = match[1] as string;
      const map = isTest ? tested : implemented;
      map.set(id, [...(map.get(id) ?? []), path]);
    }
  }
  const baseline = readJson<Record<string, string>>(join(dir, BASELINE)) ?? {};
  const results = testResults(dir);
  return conceptsWithRules(ir).flatMap((concept) =>
    concept.rules.map((rule) => {
      const id = ruleId(concept, rule);
      const report = { concept: concept.concept, text: rule.text, ...(id ? { id } : {}) };
      const implementedIn = id ? (implemented.get(id) ?? []) : [];
      const testedIn = id ? (tested.get(id) ?? []) : [];
      const status: RuleStatus = (() => {
        if (!id || implementedIn.length === 0) return "not-implemented";
        if (baseline[id] && baseline[id] !== hashRule(rule.text)) return "changed";
        if (testedIn.length === 0) return "untested";
        const outcomes = results.filter((r) => r.title.startsWith(`rule ${id}:`));
        if (outcomes.length === 0) return "not-run";
        return outcomes.every((r) => r.passed) ? "tested" : "failing";
      })();
      return { ...report, status, implementedIn, testedIn };
    }),
  );
}

function testResults(dir: string): { title: string; passed: boolean }[] {
  const json = readJson<{
    testResults?: { assertionResults?: { title: string; status: string }[] }[];
  }>(join(dir, TEST_RESULTS));
  return (json?.testResults ?? []).flatMap((file) =>
    (file.assertionResults ?? []).map((a) => ({ title: a.title, passed: a.status === "passed" })),
  );
}

function sourceFiles(dir: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    return /\.tsx?$/.test(entry.name) ? [path] : [];
  });
}

function readJson<T>(path: string): T | undefined {
  try {
    return JSON.parse(readFileSync(path, "utf8")) as T;
  } catch {
    return undefined;
  }
}
