// The fix-file rule (fixes/README.md; smithable-cloud docs/design/fixes-reach-apps.md §3): a pull
// request that touches the kit, the templates or the generator adds or edits a fix file, so the
// service can tell which built apps it reaches, unless it carries the label `no-fix-file` (a
// change no built app shows). CI runs it on pull requests: BASE is the base commit, NO_FIX_FILE
// "true" when the event's labels have it; with PR, REPO and GITHUB_TOKEN the labels are also read
// as they are now, so a run started again after the label was added passes (A 243: the event's
// labels are those of when the run began). Exits 1 with the files that need one.
import { execFileSync } from "node:child_process";

const base = process.env.BASE;
if (!base) {
  console.log("Not a pull request: no fix-file rule.");
  process.exit(0);
}
const changed = (filter, ...paths) =>
  execFileSync(
    "git",
    // From where the branch left the base, so the base's own later changes are not counted.
    ["diff", "--name-only", `--diff-filter=${filter}`, `${base}...HEAD`, "--", ...paths],
    {
      encoding: "utf8",
    },
  )
    .split("\n")
    .filter(Boolean);
const engine = changed("ACMRD").filter(
  (path) =>
    (/^packages\/adapter-tanstack\/(templates\/|src\/)/.test(path) ||
      path === "packages/cli/src/generate.ts") &&
    !/(\.test\.ts|\.gen\.ts|\/__snapshots__\/.*)$/.test(path),
);
const fixes = changed("AM", "fixes/*.yml");
if (engine.length === 0) console.log("No kit, template or generator file changed.");
else if (fixes.length) console.log(`Fix files: ${fixes.join(", ")}.`);
else if (process.env.NO_FIX_FILE === "true" || (await labelledNow()))
  console.log("The label no-fix-file says no built app shows this change.");
else {
  console.error(
    `These change what built apps do, and no fix file says which apps it reaches:\n${engine
      .map((p) => `  ${p}\n`)
      .join(
        "",
      )}Add fixes/<id>.yml (fixes/README.md), or the label no-fix-file when no built app shows the change.`,
  );
  process.exit(1);
}

/** The pull request carries no-fix-file now (GitHub's API; false when it cannot be asked). */
async function labelledNow() {
  const { PR, REPO, GITHUB_TOKEN } = process.env;
  if (!PR || !REPO || !GITHUB_TOKEN) return false;
  try {
    const response = await fetch(`https://api.github.com/repos/${REPO}/pulls/${PR}`, {
      headers: { authorization: `Bearer ${GITHUB_TOKEN}`, accept: "application/vnd.github+json" },
    });
    if (!response.ok) return false;
    const pull = await response.json();
    return (pull.labels ?? []).some((l) => l.name === "no-fix-file");
  } catch {
    return false;
  }
}
