// The fix-file rule (fixes/README.md; smithable-cloud docs/design/fixes-reach-apps.md §3): a pull
// request that touches the kit, the templates or the generator adds or edits a fix file, so the
// service can tell which built apps it reaches, unless it carries the label `no-fix-file` (a
// change no built app shows). CI runs it on pull requests: BASE is the base commit, NO_FIX_FILE
// "true" when the label is on. Exits 1 with the files that need one.
import { execFileSync } from "node:child_process";

const base = process.env.BASE;
if (!base) {
  console.log("Not a pull request: no fix-file rule.");
  process.exit(0);
}
const changed = (filter, ...paths) =>
  execFileSync(
    "git",
    ["diff", "--name-only", `--diff-filter=${filter}`, base, "HEAD", "--", ...paths],
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
else if (process.env.NO_FIX_FILE === "true")
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
