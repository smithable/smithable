#!/usr/bin/env bash
# Only expected coverage may satisfy the required check; skipped jobs are not successes.
set -euo pipefail
[ "${SCOPE_RESULT:-}" = success ] || { echo 'Scope did not succeed.'; exit 1; }
if [ "${BASICS_REQUIRED:-}" = true ]; then
  [ "${BASICS_RESULT:-}" = success ] || { echo 'Required basic checks did not succeed.'; exit 1; }
fi
if [ "${FULL_REQUIRED:-}" = true ]; then
  if [ "${IS_FORK:-}" = true ]; then result=${FORK_FULL_RESULT:-}; else result=${FULL_RESULT:-}; fi
  [ "$result" = success ] || { echo "Required full coverage did not succeed ($result)."; exit 1; }
fi
echo 'Required coverage passed.'
