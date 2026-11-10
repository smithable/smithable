// The fix-file rule (fixes/README.md; smithable-cloud docs/design/fixes-reach-apps.md §3), as CI
// runs it on pull requests: BASE is the base commit; NO_FIX_FILE "true" when the event's labels
// have the label; PR_BODY the pull request's text when the run began. With PR, REPO and
// GITHUB_TOKEN the labels and the text are also read as they are now, so a run started again
// after either changed sees it (A 243). The rule itself, and which part of it passed the change,
// is packages/cli/src/fix-file-rule.ts. Exits 1 with what the change needs.
import { execFileSync } from "node:child_process";
import { inRange, readAdvisories } from "../packages/cli/src/advisories.ts";
import { fixFileRule } from "../packages/cli/src/fix-file-rule.ts";

const base = process.env.BASE;
if (!base) {
  console.log("Not a pull request: no fix-file rule.");
  process.exit(0);
}
// From where the branch left the base, so the base's own later changes are not counted.
const git = (...args) => execFileSync("git", args, { encoding: "utf8" });
// Where the branch left the base: the files as they were then.
const from = git("merge-base", base, "HEAD").trim();
/** A file at a commit, or undefined where it is not there. */
const show = (spec) => {
  try {
    return execFileSync("git", ["show", spec], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    });
  } catch {
    return undefined;
  }
};
const changed = (filter, ...paths) =>
  git("diff", "--name-only", `--diff-filter=${filter}`, `${base}...HEAD`, "--", ...paths)
    .split("\n")
    .filter(Boolean);
const engine = changed("ACMRD").filter(
  (path) =>
    (/^packages\/adapter-tanstack\/(templates\/|src\/)/.test(path) ||
      path === "packages/cli/src/generate.ts") &&
    !/(\.test\.ts|\.gen\.ts|\/__snapshots__\/.*)$/.test(path),
);
const now = await pullNow();
const { ok, why } = await fixFileRule({
  engine,
  fixes: changed("AM", "fixes/*.yml"),
  diffOf: (path) => git("diff", "--unified=0", `${base}...HEAD`, "--", path),
  filesOf: (path) => ({ before: show(`${from}:${path}`), after: show(`HEAD:${path}`) }),
  labelled: process.env.NO_FIX_FILE === "true" || Boolean(now?.labelled),
  // The text as it is now when it could be asked (an emptied text is empty), else the event's.
  body: now ? now.body : process.env.PR_BODY,
  advisories: async (pins) => {
    const read = await readAdvisories(pins, { token: process.env.GITHUB_TOKEN });
    return read.unread.length ? undefined : read.advisories;
  },
  inRange,
});
(ok ? console.log : console.error)(why);
if (!ok) process.exit(1);

/** The pull request's labels and text as they are now (GitHub's API; undefined when it cannot be asked). */
async function pullNow() {
  const { PR, REPO, GITHUB_TOKEN } = process.env;
  if (!PR || !REPO || !GITHUB_TOKEN) return undefined;
  try {
    const response = await fetch(`https://api.github.com/repos/${REPO}/pulls/${PR}`, {
      headers: { authorization: `Bearer ${GITHUB_TOKEN}`, accept: "application/vnd.github+json" },
    });
    if (!response.ok) return undefined;
    const pull = await response.json();
    return {
      labelled: (pull.labels ?? []).some((l) => l.name === "no-fix-file"),
      body: typeof pull.body === "string" ? pull.body : "",
    };
  } catch {
    return undefined;
  }
}
