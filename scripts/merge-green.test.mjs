import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { chmodSync, existsSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

// A stand-in for gh, replaying cloud #587 (2026-11-24): the pull request is behind, the branch
// update gives it a new head, `gh pr checks` lists the old head's green checks once more and then
// none, and the new head's check runs show only from the second time they are asked for. The
// script used to stop waiting on that one listing and refuse on the next ("did not start within
// an hour").
const fakeGh = `#!/usr/bin/env bash
d="$FAKE_GH"; a="$*"
head() { [ -e "$d/updated" ] && echo new || echo old; }
case "$a" in
  *"--json state,isDraft,mergeable"*) echo "OPEN false MERGEABLE" ;;
  *"--json mergeStateStatus"*) [ -e "$d/updated" ] && echo BLOCKED || echo BEHIND ;;
  *"--json headRefOid"*) head ;;
  "pr update-branch"*) touch "$d/updated" ;;
  "api repos/o/r/commits/new/check-runs -q .total_count")
    n=$(cat "$d/asked" 2>/dev/null || echo 0); echo $((n + 1)) > "$d/asked"
    [ "$n" = 0 ] || [ -n "$STATUS_ONLY" ] && echo 0 || echo 1 ;;
  "api repos/o/r/commits/new/status -q .total_count")
    [ -n "$STATUS_ONLY" ] && [ "$(cat "$d/asked")" != 1 ] && echo 1 || echo 0 ;;
  "api repos/o/r/commits/old/"*) echo 1 ;;
  *"--watch"*) ;;
  "pr checks"*)
    [ -e "$d/listed" ] && exit 1
    touch "$d/listed"; printf 'check\\tpass\\t1m\\thttps://example.invalid\\n' ;;
  "run list"*) echo 1 ;;
  *"--json statusCheckRollup"*) printf 'check\\tCOMPLETED\\tSUCCESS\\n' ;;
  *"--json state "*|*"--json state") [ -e "$d/armed" ] && echo MERGED || echo OPEN ;;
  *"--json headRefName,baseRefName"*) echo "false c/x main" ;;
  "pr list"*) ;;
  *"--auto"*) touch "$d/armed" ;;
  *"--disable-auto"*) ;;
  *) echo "fake gh: unexpected: $a" >&2; exit 1 ;;
esac
`;

function mergeGreen(env = {}) {
  const dir = mkdtempSync(join(tmpdir(), "merge-green-"));
  writeFileSync(join(dir, "gh"), fakeGh);
  // The script's sleeps (and the lock's refresher) take no time here.
  writeFileSync(join(dir, "sleep"), "#!/usr/bin/env bash\nexec /bin/sleep 0.01\n");
  for (const f of ["gh", "sleep"]) chmodSync(join(dir, f), 0o755);
  const run = spawnSync("bash", ["scripts/merge-green.sh", "587", "--repo", "o/r"], {
    encoding: "utf8",
    timeout: 60_000,
    env: {
      ...process.env,
      PATH: `${dir}:${process.env.PATH}`,
      FAKE_GH: dir,
      MERGE_LOCK: join(dir, "lock"),
      SESSION: "test",
      ...env,
    },
  });
  return { run, dir };
}

test("merge-green waits for the new head's checks after updating the branch (cloud #587)", () => {
  const { run, dir } = mergeGreen();
  assert.equal(run.status, 0, run.stdout + run.stderr);
  assert.match(run.stdout, /Merged #587\./);
  assert.doesNotMatch(run.stdout, /did not start/);
  assert.equal(readFileSync(join(dir, "asked"), "utf8").trim(), "2");
  assert.ok(!existsSync(join(dir, "lock")));
});

test("a head whose only checks are commit statuses has checks", () => {
  const { run } = mergeGreen({ STATUS_ONLY: "1" });
  assert.equal(run.status, 0, run.stdout + run.stderr);
  assert.match(run.stdout, /Merged #587\./);
});

// merge_generated alone, on a real repository: main changed a generated file, and the branch
// changed it too ("clash"), changed only its own file ("clean"), changed a file main changed too
// ("beyond"), or has a push the origin rejects ("rejected"). #1369 (2026-11-24): a finished rebase
// was taken for unfinished, and a rebase needed a force push.
function mergeMain(mode) {
  const dir = mkdtempSync(join(tmpdir(), "merge-main-"));
  const fn = readFileSync("scripts/merge-green.sh", "utf8").match(
    /^merge_generated\(\) \{[\s\S]*?^\}$/m,
  )[0];
  writeFileSync(join(dir, "gh"), "#!/usr/bin/env bash\necho c/x\n");
  // The build regenerates the embedded file, only from main's side (3).
  writeFileSync(
    join(dir, "pnpm"),
    '#!/usr/bin/env bash\nf=packages/cli/src/starters.gen.ts\n[ "$1" = build ] && grep -qx 3 $f && echo built > $f\nexit 0\n',
  );
  for (const f of ["gh", "pnpm"]) chmodSync(join(dir, f), 0o755);
  const gen = mode === "clash" || mode === "rejected";
  const sh = `set -e
git init -q --bare -b main origin.git
git clone -q origin.git w 2>/dev/null; cd w
git config user.email t@example.invalid; git config user.name t
mkdir -p packages/cli/src
echo 1 > packages/cli/src/starters.gen.ts; echo a > notes.md
git add -A; git commit -q -m base; git push -q origin HEAD:main
git checkout -q -b c/x
${gen ? "echo 2 > packages/cli/src/starters.gen.ts" : ""}
echo branch > ${mode === "beyond" ? "notes.md" : "own.md"}
git add -A; git commit -q -m branch; git push -q origin c/x
git checkout -q main
echo 3 > packages/cli/src/starters.gen.ts; echo main > notes.md
git add -A; git commit -q -m main; git push -q origin main
git checkout -q c/x
${mode === "rejected" ? "printf '#!/bin/sh\\nexit 1\\n' > ../origin.git/hooks/pre-receive; chmod +x ../origin.git/hooks/pre-receive" : ""}
before=$(git rev-parse HEAD)
set +e
pr=1; repo=()
${fn}
merge_generated; echo "status $?"
echo "parents $(git rev-list --parents -n1 HEAD | wc -w)"
echo "back $([ "$(git rev-parse HEAD)" = "$before" ] && echo yes || echo no)"
echo "pushed $([ "$(git rev-parse HEAD)" = "$(git rev-parse origin/c/x)" ] && echo yes || echo no)"
echo "file $(cat packages/cli/src/starters.gen.ts)"
echo "clean $([ -z "$(git status --porcelain)" ] && [ ! -e .git/MERGE_HEAD ] && echo yes || echo no)"
git log -1 --format=%B`;
  return spawnSync("bash", ["-c", sh], {
    cwd: dir,
    encoding: "utf8",
    timeout: 60_000,
    env: { ...process.env, PATH: `${dir}:${process.env.PATH}`, GIT_CONFIG_GLOBAL: "/dev/null" },
  });
}

function expectLines(run, lines) {
  for (const line of lines) {
    assert.match(run.stdout, new RegExp(`^${line}$`, "m"), run.stdout + run.stderr);
  }
}

test("a clash in generated files alone is resolved by merging main in, pushed without force (#1369)", () => {
  const run = mergeMain("clash");
  assert.match(run.stdout, /main merged in and pushed/);
  expectLines(run, ["status 0", "parents 3", "back no", "pushed yes", "file built", "clean yes"]);
  assert.match(run.stdout, /Co-Authored-By: Claude/);
});

test("a branch that merges main cleanly still gets its merge commit and refreshed files", () => {
  expectLines(mergeMain("clean"), [
    "status 0",
    "parents 3",
    "pushed yes",
    "file built",
    "clean yes",
  ]);
});

test("a clash beyond the generated files leaves the branch as it was", () => {
  const run = mergeMain("beyond");
  assert.match(run.stdout, /a conflict beyond the generated files: notes\.md/);
  expectLines(run, ["status 1", "back yes", "pushed yes", "clean yes"]);
});

test("a rejected push puts the branch back where it was", () => {
  const run = mergeMain("rejected");
  assert.match(run.stdout, /the push of the merge failed/);
  expectLines(run, ["status 1", "back yes", "pushed yes", "file 2", "clean yes"]);
});
