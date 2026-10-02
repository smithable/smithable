#!/usr/bin/env bash
# Merges a pull request only when every check has passed: waits for pending checks, refuses on a
# failure, then merges with a merge commit and deletes the branch. The repository has no branch
# protection yet (a private repository on GitHub's free plan cannot), so GitHub itself would merge
# anything; this script is the gate for Claude sessions, which are allowed to run it and nothing
# else that merges. Usage: scripts/merge-green.sh <pr-number> [--repo owner/name]
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
gh pr merge "$pr" "${repo[@]}" --merge --delete-branch
echo "Merged #$pr."
