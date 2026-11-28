// The fix-file rule (fixes/README.md; smithable-cloud docs/design/fixes-reach-apps.md §3), as CI
// runs it on pull requests: BASE is the base commit at the event; PR_HEAD the pull request's head;
// NO_FIX_FILE "true" when the event's labels have the label; PR_BODY the pull request's text when the run began. With PR, REPO and
// GITHUB_TOKEN the labels and the text are also read as they are now, so a run started again
// after either changed sees it (A 243). The rule itself, and which part of it passed the change,
// is packages/cli/src/fix-file-rule.ts. Exits 1 with what the change needs.
// With --local (pnpm lint, T1485) the base is origin/main and the branch's commit messages stand
// for the pull request's text, so a kit change without its declaration fails before the push; it
// says nothing when the change passes (or when there is no origin/main or no common history), takes
// NO_FIX_FILE=true for the label, leaves CI (CI set) to the step above, and lets CI judge a
// bump whose advisories it could not read.
import { execFileSync } from "node:child_process";
import { inRange, readAdvisories } from "../packages/cli/src/advisories.ts";
import { fixFileRule } from "../packages/cli/src/fix-file-rule.ts";

const local = process.argv.includes("--local");
// From where the branch left the base, so the base's own later changes are not counted.
const git = (...args) => execFileSync("git", args, { encoding: "utf8" });
if (local && process.env.CI) process.exit(0);
/** A git answer, or undefined where git refuses (no origin/main, no common history in a shallow clone). */
const quietly = (...args) => {
  try {
    return execFileSync("git", args, {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch {
    return undefined;
  }
};
// CI checks out the pull request merged into main as it is then, which can hold commits after
// BASE: that merge's first parent is the base, so only the pull request counts. A checkout that
// is not the merge of PR_HEAD is refused rather than compared with the wrong commit.
const merged = !local && Boolean(process.env.PR_HEAD);
if (merged && quietly("rev-parse", "--verify", "-q", "HEAD^2") !== process.env.PR_HEAD) {
  console.error(
    `fix-file rule: the checkout is not ${process.env.PR_HEAD} merged into main; push again for a new run.`,
  );
  process.exit(1);
}
const base = local
  ? quietly("rev-parse", "--verify", "-q", "origin/main^{commit}")
  : merged
    ? quietly("rev-parse", "HEAD^1")
    : process.env.BASE;
if (!base) {
  if (!local) console.log("Not a pull request: no fix-file rule.");
  process.exit(0);
}
// Where the branch left the base: the files as they were then.
const from = local ? quietly("merge-base", base, "HEAD") : git("merge-base", base, "HEAD").trim();
if (!from) process.exit(0);
/** A file at a commit, or undefined where it is not there. */
function show(spec) {
  try {
    return execFileSync("git", ["show", spec], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    });
  } catch {
    return undefined;
  }
}
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
const now = local ? undefined : await pullNow();
let unread = false;
const { ok, why } = await fixFileRule({
  engine,
  fixes: changed("AM", "fixes/*.yml"),
  diffOf: (path) => git("diff", "--unified=0", `${base}...HEAD`, "--", path),
  filesOf: (path) => ({ before: show(`${from}:${path}`), after: show(`HEAD:${path}`) }),
  labelled: process.env.NO_FIX_FILE === "true" || Boolean(now?.labelled),
  // The text as it is now when it could be asked (an emptied text is empty), else the event's.
  body: local ? git("log", "--format=%B", `${from}..HEAD`) : now ? now.body : process.env.PR_BODY,
  advisories: async (pins) => {
    const read = await readAdvisories(pins, { token: process.env.GITHUB_TOKEN });
    unread = read.unread.length > 0;
    return unread ? undefined : read.advisories;
  },
  inRange,
});
if (local) {
  if (ok) process.exit(0);
  if (unread) {
    console.log(`fix-file rule: advisories not read here; CI decides.\n${why}`);
    process.exit(0);
  }
  console.error(
    `fix-file rule (against origin/main):\n${why}\nHere the branch's commit messages stand for the pull request's text: put the line in both.`,
  );
  process.exit(1);
}
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
