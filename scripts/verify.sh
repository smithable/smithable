#!/usr/bin/env bash
# Lint, build and unit tests, then the markers the pre-push hook reads (scripts/mark-verified.sh): the
# lint marker as soon as lint passes (the hook refuses without it), the test marker at the end (the
# hook warns without it). scripts/verify.sh --lint runs lint alone and writes its marker. Other
# arguments go to the unit tests (scripts/verify.sh --maxWorkers=4). The tests in
# scripts/slow-tests.txt are left out. A gate that exits 0 marks its tree too.
# vitest is called directly: through "pnpm test --" it reads every option after the -- as nothing.
set -uo pipefail
cd "$(git rev-parse --show-toplevel)" || exit 1
before=$(scripts/mark-verified.sh --tree) || exit 1
# A committed generated file that no longer matches its sources gets no marker: the push guard then
# refuses, and the build's own rewrite cannot hide it. The full run goes on past it, so that the
# build rewrites the file, and ends without markers (the tree changed).
current() { node scripts/embed.mjs --check; }
if [ "${1:-}" = --lint ]; then pnpm lint && current && exec scripts/mark-verified.sh --lint "$before"; exit 1; fi
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
if ! { pnpm lint && { ! current || scripts/mark-verified.sh --lint "$before" || :; } && pnpm build && pnpm exec vitest run "${args[@]}"; }; then
  echo "verify: a step failed: no marker written." >&2
  exit 1
fi
scripts/mark-verified.sh "$before"
