// What a change verified, in Studio's words (docs/design/change-verified.md §5.2, A 236): one
// short line in a fixed order (applied or not; data; then a failed or inconclusive check if any,
// else the deepest check not run, leaving the outside out unless something would fire), and the
// checks behind it. Never a check that was not run said as passed.
import type { Check, CheckId, Verification } from "@smithable/core";

export const LABEL: Record<CheckId, string> = {
  spec: "Spec",
  generate: "Generate",
  migrate: "Migration",
  data: "Data",
  typecheck: "Type check",
  tests: "Tests",
  browser: "Browser flow",
  outside: "Outside the app",
};

const STATE: Record<Check["state"], string> = {
  passed: "passed",
  failed: "failed",
  "not-run": "not run",
  inconclusive: "inconclusive",
  "not-configured": "not configured",
};

/** A check that is not run, said as such: "Browser flow not tested." */
const notRun = (id: CheckId) =>
  id === "browser" ? "Browser flow not tested." : `${LABEL[id]} not run.`;

/** The one line: "Change applied. Data preserved. Browser flow not tested." */
export function verifiedLine(v: Verification): string {
  const check = (id: CheckId) => v.checks.find((c) => c.id === id);
  const applied = v.revision !== "";
  const parts = [applied ? "Change applied." : "Change not applied."];
  const data = check("data");
  if (data?.state === "passed") parts.push("Data preserved.");
  else if (data?.state === "failed") parts.push(`Data not preserved: ${data.says}`);
  else if (data?.state === "inconclusive") parts.push("Data inconclusive.");
  else if (applied) parts.push("Data not checked.");
  const bad = v.checks.find(
    (c) => c.id !== "data" && (c.state === "failed" || c.state === "inconclusive"),
  );
  if (bad) parts.push(`${LABEL[bad.id]} ${STATE[bad.state]}: ${bad.says}`);
  // After a failure the deeper checks are not the next thing to say.
  else if (data?.state !== "failed" && data?.state !== "inconclusive") {
    // The deepest check not run, the outside only when something would fire.
    const deepest = [...v.checks]
      .reverse()
      .find(
        (c) =>
          c.state === "not-run" &&
          c.id !== "data" &&
          (c.id !== "outside" || v.consequences.some((x) => x.about === "outside")),
      );
    if (deepest) parts.push(notRun(deepest.id));
  }
  return parts.map((p) => (/[.!?:]$/.test(p) ? p : `${p}.`)).join(" ");
}

/** Each check in its order, with its state, what it says and why. */
export function checkLines(
  v: Verification,
): { id: CheckId; text: string; state: Check["state"] }[] {
  return v.checks.map((c) => ({
    id: c.id,
    state: c.state,
    text: `${LABEL[c.id]}: ${STATE[c.state]}${c.state === "not-run" ? "" : `. ${c.says}`}${
      c.reason && c.state !== "passed" ? ` (${c.reason})` : ""
    }${c.evidence?.ran !== undefined ? ` ${c.evidence.ran} ran${c.evidence.failed ? `, ${c.evidence.failed} failed` : ""}.` : ""}`,
  }));
}

/** The depth "Test it" runs next, or none when the deepest has run. */
export function nextDepth(v: Verification): "tests" | "browser" | undefined {
  return v.depth === "change" ? "tests" : v.depth === "tests" ? "browser" : undefined;
}
