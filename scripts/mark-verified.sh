#!/usr/bin/env bash
# The markers the pre-push hook (.githooks/pre-push) reads: a file named for the tree that lint, build
# and unit tests passed on (verified/), or lint alone (verified/lint/), under the clone's common git
# dir, so every worktree shares them. The hook refuses without a lint marker and warns without the other.
#   scripts/mark-verified.sh --tree           print the tree of the working copy as it is (tracked and
#                                             new files, .gitignore respected), as a commit of it all would have
#   scripts/mark-verified.sh [--lint] [BEFORE] write the marker for that tree; with BEFORE (the --tree of
#                                             the run's start), only when nothing changed during the run
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"
tree() {
  local idx
  idx=$(mktemp)
  # -p keeps the index's mtime: git re-reads a file changed in the second the index was written only
  # when the index is not newer than it (racy git), so a fresh mtime hid same-size edits.
  cp -p "$(git rev-parse --path-format=absolute --git-path index)" "$idx" 2>/dev/null || : > "$idx"
  GIT_INDEX_FILE=$idx git add -A . && GIT_INDEX_FILE=$idx git write-tree
  rm -f "$idx"
}
if [ "${1:-}" = --tree ]; then tree; exit 0; fi
lint=
if [ "${1:-}" = --lint ]; then lint=lint; shift; fi
now=$(tree)
if [ -n "${1:-}" ] && [ "$1" != "$now" ]; then
  echo "mark-verified: the files changed during the run (a generated file, or an edit): no marker. Commit and run again." >&2
  exit 1
fi
dir="$(git rev-parse --path-format=absolute --git-common-dir)/verified"
mkdir -p "$dir/lint"
date -u +%FT%TZ > "$dir/lint/$now"
if [ -n "$lint" ]; then echo "mark-verified: lint passed on tree $now."; exit 0; fi
date -u +%FT%TZ > "$dir/$now"
echo "mark-verified: lint, build and unit tests passed on tree $now."
