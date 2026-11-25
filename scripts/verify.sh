#!/usr/bin/env bash
# Lint, build and unit tests, then the marker the pre-push hook asks for (scripts/mark-verified.sh).
# Arguments go to the unit tests (scripts/verify.sh --maxWorkers=4). The tests in
# scripts/slow-tests.txt are left out. A gate that exits 0 marks its tree too.
# vitest is called directly: through "pnpm test --" it reads every option after the -- as nothing.
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
# The slow tests (scripts/slow-tests.txt) are left out and named; CI's units job runs them (T1509).
while IFS= read -r line; do
  [[ -z $line || $line == \#* ]] && continue
  args+=(--exclude "${line%%  *}")
  echo "verify: left out (slow; CI runs it): ${line%%  *} - ${line#*  }"
done < scripts/slow-tests.txt
if ! { pnpm lint && pnpm build && pnpm exec vitest run "${args[@]}"; }; then
  echo "verify: a step failed: no marker written." >&2
  exit 1
fi
scripts/mark-verified.sh "$before"
