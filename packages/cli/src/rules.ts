import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";
import { implementationIndex } from "@smithable/adapter-tanstack";
import type { AuthIR, SpecIR } from "@smithable/core";
import { buildIndex, hashRule, type ProjectIndex, type RuleStatus } from "@smithable/index";

/** Where the texts of rules are recorded when they get an id; committed with the project. */
const BASELINE = ".smithable/rules.json";
/** The last `smithable test` results; local, like the rest of data/. */
export const TEST_RESULTS = "data/.smithable/test-results.json";

export const STATUS_TEXT: Record<RuleStatus, string> = {
  "not-implemented": "Not implemented",
  untested: "Implemented, untested",
  "not-run": "Implemented and tested, but the tests have not run (smithable test)",
  failing: "Implemented, test failing",
  tested: "Implemented and tested",
  changed: "Changed since it was implemented: review the code",
};

/** Records a rule's text when it gets an id, so later edits show as "changed". */
export function recordRule(dir: string, id: string, text: string): void {
  const baseline = readJson<Record<string, string>>(join(dir, BASELINE)) ?? {};
  baseline[id] = hashRule(text);
  const sorted = Object.fromEntries(Object.entries(baseline).sort(([a], [b]) => (a < b ? -1 : 1)));
  writeFileSync(join(dir, BASELINE), `${JSON.stringify(sorted, null, 2)}\n`);
}

/**
 * The project's implementation index (ARCHITECTURE §7), built from the spec, what the adapter
 * generates, the custom code, the rule baselines and the last test run. Cheap enough to build
 * on every use, so it is never stale.
 */
export function projectIndex(dir: string, ir: SpecIR, auth: AuthIR): ProjectIndex {
  return buildIndex({
    ir,
    generated: implementationIndex(ir, auth),
    custom: sourceFiles(join(dir, "src", "custom")).map((file) => ({
      path: relative(dir, file),
      text: readFileSync(file, "utf8"),
    })),
    ruleBaseline: readJson<Record<string, string>>(join(dir, BASELINE)) ?? {},
    testResults: testResults(dir),
  });
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
  return readdirSync(dir, { withFileTypes: true })
    .sort((a, b) => (a.name < b.name ? -1 : 1))
    .flatMap((entry) => {
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
