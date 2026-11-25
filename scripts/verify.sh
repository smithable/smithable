#!/usr/bin/env bash
# Lint, build and unit tests, then the marker the pre-push hook asks for (scripts/mark-verified.sh).
# Arguments go to the unit tests (scripts/verify.sh --maxWorkers=4). A gate that exits 0 marks its
# tree too.
set -uo pipefail
cd "$(git rev-parse --show-toplevel)" || exit 1
before=$(scripts/mark-verified.sh --tree) || exit 1
if ! { pnpm lint && pnpm build && pnpm test -- "$@"; }; then
  echo "verify: a step failed: no marker written." >&2
  exit 1
fi
scripts/mark-verified.sh "$before"
