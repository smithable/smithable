#!/usr/bin/env bash
# Lint, build and unit tests, then the marker the pre-push hook asks for (scripts/mark-verified.sh).
# Arguments go to the unit tests (scripts/verify.sh --maxWorkers=4). A gate that exits 0 marks its
# tree too.
set -uo pipefail
cd "$(git rev-parse --show-toplevel)" || exit 1
before=$(scripts/mark-verified.sh --tree) || exit 1
# Beside a running or waiting gate, the units take two workers whatever was asked (T1522): a full
# suite beside a gate's browser phase slows both.
args=("$@")
if ! scripts/gate.sh --idle; then
  args=()
  for a in "$@"; do [[ $a == --maxWorkers* ]] || args+=("$a"); done
  args+=(--maxWorkers=2)
  echo "verify: a gate runs or waits: the unit tests take two workers."
fi
if ! { pnpm lint && pnpm build && pnpm test -- "${args[@]}"; }; then
  echo "verify: a step failed: no marker written." >&2
  exit 1
fi
scripts/mark-verified.sh "$before"
