#!/usr/bin/env bash
# One full gate at a time on this machine, for every session: run `pnpm check` from the current
# worktree, waiting while another session's gate runs. Two gates at once saturate the eight
# cores (smoke tests time out) and push memory until Claude Code stops background work.
#   usage (from a worktree): SESSION=<name> TEST_APPS_PORT=… TEST_STUDIO_PORT=… scripts/gate.sh
# Each session has its own ports (its brief says which); the lock is ~/repos/.gate-lock.
# The exit status is pnpm check's. The lock is released when the gate ends, however it ends.
set -u
lock=~/repos/.gate-lock
exec 9>"$lock"
if ! flock -n 9; then
  echo "gate.sh: another gate is running ($(cat "$lock.who" 2>/dev/null || echo unknown)); waiting…" >&2
  flock 9
fi
echo "${SESSION:-?} in $(pwd) since $(date +%H:%M)" > "$lock.who"
pnpm check "$@"
status=$?
rm -f "$lock.who"
exit $status
