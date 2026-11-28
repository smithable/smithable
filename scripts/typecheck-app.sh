#!/usr/bin/env bash
# Makes one example's app and type-checks it (T1790): a type error in a kit template or in generated
# code shows in no other step of a pull request's CI. Run after "pnpm build".
#   scripts/typecheck-app.sh [example]     booking when none is named, the one with the most kit files
set -euo pipefail
repo=$(cd "$(dirname "$0")/.." && pwd)
dir=$(mktemp -d)
trap 'rm -rf "$dir"' EXIT
export GIT_AUTHOR_NAME=CI GIT_AUTHOR_EMAIL=ci@smithable.invalid
export GIT_COMMITTER_NAME=CI GIT_COMMITTER_EMAIL=ci@smithable.invalid
export npm_config_frozen_lockfile=false pnpm_config_frozen_lockfile=false
node "$repo/packages/cli/dist/bin.js" new "$dir/app" --starter "${1:-booking}" --admin owner@acme.dev
cd "$dir/app"
pnpm typecheck
