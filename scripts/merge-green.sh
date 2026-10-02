#!/usr/bin/env bash
# Merges a pull request only when every check has passed: brings it up to date with main when it
# is behind, waits for pending checks, refuses on a failure, then merges with a merge commit and
# deletes the branch. Branch protection requires the `check` job, but an administrator's merge
# passes it by, so this script is the gate for Claude sessions, which are allowed to run it and
# nothing else that merges. Usage: scripts/merge-green.sh <pr-number> [--repo owner/name]
set -euo pipefail
pr="${1:?usage: merge-green.sh <pr-number> [--repo owner/name]}"
shift
repo=()
[ "${1:-}" = "--repo" ] && repo=(--repo "$2")
state=$(gh pr view "$pr" "${repo[@]}" --json state,isDraft,mergeable -q '"\(.state) \(.isDraft) \(.mergeable)"')
case "$state" in
  "OPEN false "*) ;;
  *) echo "Not merging #$pr: state, draft, mergeable = $state"; exit 1 ;;
esac
# A pull request behind main is brought up to date and checked again first, so what merges is
# what CI checked (branch protection's up-to-date rule does not hold an administrator's merge).
for attempt in 1 2 3 4 5; do
  # The checks of a just-updated head take a moment to appear.
  for _ in $(seq 30); do
    gh pr checks "$pr" "${repo[@]}" 2>/dev/null | grep -q . && break
    sleep 10
  done
  # Wait for every check; --fail-fast returns non-zero on the first failure.
  if ! gh pr checks "$pr" "${repo[@]}" --watch --fail-fast >/dev/null; then
    echo "Not merging #$pr: a check failed."
    gh pr checks "$pr" "${repo[@]}" || true
    exit 1
  fi
  # A check list that is empty (no CI ran) is not green.
  if ! gh pr checks "$pr" "${repo[@]}" | grep -q .; then
    echo "Not merging #$pr: no checks have run."
    exit 1
  fi
  if [ "$(gh pr view "$pr" "${repo[@]}" --json mergeStateStatus -q .mergeStateStatus)" = BEHIND ]; then
    echo "#$pr is behind main: updating it and checking again."
    gh pr update-branch "$pr" "${repo[@]}"
    sleep 15
    continue
  fi
  gh pr merge "$pr" "${repo[@]}" --merge --delete-branch
  echo "Merged #$pr."
  exit 0
done
echo "Not merging #$pr: still behind main after five updates."
exit 1
