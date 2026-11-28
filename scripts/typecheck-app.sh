#!/usr/bin/env bash
# Makes examples' apps and type-checks them (T1790, T1791): a type error in a kit template or in
# generated code shows in no other step of a pull request's CI. Run after "pnpm build".
#   scripts/typecheck-app.sh [example…]   booking, kiosk and invoicing when none is named: between
#                                         them the most kit files for the time
set -euo pipefail
repo=$(cd "$(dirname "$0")/.." && pwd)
dir=$(mktemp -d)
trap 'rm -rf "$dir"' EXIT
export GIT_AUTHOR_NAME=CI GIT_AUTHOR_EMAIL=ci@smithable.invalid
export GIT_COMMITTER_NAME=CI GIT_COMMITTER_EMAIL=ci@smithable.invalid
export npm_config_frozen_lockfile=false pnpm_config_frozen_lockfile=false
[ $# -gt 0 ] || set -- booking kiosk invoicing
for example; do
  echo "typecheck-app: $example"
  node "$repo/packages/cli/dist/bin.js" new "$dir/$example" --starter "$example" --admin owner@acme.dev
  (cd "$dir/$example" && pnpm typecheck)
done
