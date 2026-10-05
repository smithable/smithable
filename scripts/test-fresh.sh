#!/usr/bin/env bash
# The README's first steps as a person from somewhere else does them: in a container with only
# Node and Git, nothing configured (no Git name, no pnpm, no caches). Install, build, a new app,
# a change from the command line, a change from Studio, the preview answering. It fails on the
# first step that does not work and says which. Needs Docker and the network; not part of check.
#   scripts/test-fresh.sh [image]     (default node:24; the commit tested is HEAD, or FRESH_REF)
set -euo pipefail
here=$(cd "$(dirname "$0")/.." && pwd)
image=${1:-node:24}
tmp=$(mktemp -d); trap 'rm -rf "$tmp"' EXIT
git -C "$here" archive --format=tar.gz -o "$tmp/smithable.tar.gz" "${FRESH_REF:-HEAD}"
cat > "$tmp/steps.sh" <<'STEPS'
set -euo pipefail
step() { printf '\n== %s\n' "$1"; }
fail() { echo "FAILED: $1"; exit 1; }
t() { local s=$SECONDS; "$@"; echo "   ($((SECONDS - s)) s)" >&2; }
mkdir -p /work/smithable && cd /work/smithable && tar xzf /in/smithable.tar.gz
echo "node $(node -v), git $(git --version | cut -d' ' -f3), git name: '$(git config user.name || true)'"
export COREPACK_ENABLE_DOWNLOAD_PROMPT=0
step "pnpm install"; corepack enable; t pnpm install --silent || fail "pnpm install"
step "pnpm build"; t pnpm build >/tmp/build.log 2>&1 || { tail -20 /tmp/build.log; fail "pnpm build"; }
cli="node /work/smithable/packages/cli/dist/bin.js"
step "a new app, inside the clone as the README says"
t $cli new my-crm >/tmp/new.log 2>&1 || { tail -20 /tmp/new.log; fail "smithable new"; }
cd my-crm
step "a change from the command line, and its undo"
$cli op addField Customer region string 2>&1 | tail -1 | grep -q "Undo with" || fail "the first change"
$cli undo 2>&1 | grep -q "Undid\|back as it was" || fail "undo"
step "Studio, a change through it, and the preview"
($cli studio >/tmp/studio.log 2>&1 &)
for i in $(seq 120); do curl -s -o /dev/null http://localhost:4321/api/project && break; sleep 1; done
curl -s -o /dev/null http://localhost:4321/api/project || { cat /tmp/studio.log; fail "Studio did not answer in 120 s"; }
echo "   Studio answers after about $i s"
answer=$(curl -s -X POST http://localhost:4321/api/op -H "content-type: application/json" -H "x-smithable: 1" \
  -d '{"name":"addField","args":{"model":"Customer","field":"zone","type":"string"}}')
echo "$answer" | grep -q '"ok":true' || { echo "$answer" | cut -c1-600; fail "a change from Studio"; }
for i in $(seq 180); do [ "$(curl -s -o /dev/null -w '%{http_code}' http://localhost:4322/health)" = 200 ] && break; sleep 1; done
[ "$(curl -s -o /dev/null -w '%{http_code}' http://localhost:4322/health)" = 200 ] || { curl -s http://localhost:4321/api/logs | cut -c1-1500; fail "the preview did not answer in 180 s"; }
echo "   the preview answers"
step "the app's own history"
git log --format='%s  (%an)' | head -5
[ "$(git rev-list --count HEAD)" -ge 3 ] || fail "the app's repository does not hold its changes"
printf '\nA first run works on a clean machine.\n'
STEPS
docker run --rm -v "$tmp:/in:ro" "$image" bash /in/steps.sh
