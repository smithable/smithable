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
