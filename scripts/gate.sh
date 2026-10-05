#!/usr/bin/env bash
# One gate at a time on this machine, for every session: runs `pnpm check` from the current
# worktree when its turn comes. Two gates at once saturate the eight cores (smoke tests time
# out) and push memory until Claude Code stops background work.
#   usage (from a worktree): SESSION=<name> TEST_APPS_PORT=… TEST_STUDIO_PORT=… scripts/gate.sh
#          scripts/gate.sh --queue     who is running and who waits, in order
# Each session has its own ports (its brief says which).
#
# Turns go round the sessions: the session that has had the fewest turns since the queue was
# last empty goes first, then by arrival. So queueing five gates does not hold the others up,
# and does not get a session through sooner either: a gate tests the worktree as it is when its
# turn comes, so several small changes in one worktree cost one gate, not one each.
#
# A change that touches only Studio's web app (apps/studio, scripts/test-studio.mjs) and plain
# documents skips the example apps: their checks never load it. Everything else is the full
# check. The exit status is the check's. The lock is released when the gate ends, however it ends.
set -u
home=${GATE_HOME:-$HOME/repos}
lock=$home/.gate-lock
queue=$home/.gate-queue
turns=$home/.gate-turns   # the sessions served since the queue was last empty, one a line
session=${SESSION:-?}
mkdir -p "$queue"
touch "$turns"

# The waiting gates in the order of their turns: "<ticket> <session> <worktree>" a line. A
# ticket is "<arrival>.<pid>" and holds "session<TAB>worktree"; one whose process is gone is dropped.
waiting() {
  local t pid who where
  for t in "$queue"/*; do
    [ -e "$t" ] || continue
    pid=${t##*.}
    kill -0 "$pid" 2>/dev/null || { rm -f "$t"; continue; }
    IFS=$'\t' read -r who where < "$t" || continue
    printf '%s\t%s\t%s\n' "${t##*/}" "$who" "$where"
  done | sort -n |
    awk -F'\t' -v served="$(tr '\n' '\t' < "$turns")" '
      BEGIN { m = split(served, had, "\t"); for (i = 1; i <= m; i++) if (had[i] != "") n[had[i]]++ }
      { n[$2]++; print n[$2] "\t" $0 }' |
    sort -s -n -k1,1 | cut -f2-
}

if [ "${1:-}" = --queue ]; then
  echo "running: $(cat "$lock.who" 2>/dev/null || echo nothing)"
  waiting | awk -F'\t' '{ print "waiting " NR ": " $2 " in " $3 }'
  exit 0
fi

ticket="$queue/$(date +%s%N).$$"
printf '%s\t%s\n' "$session" "$(pwd)" > "$ticket"
trap 'rm -f "$ticket"' EXIT
exec 9>"$lock"
said=
until [ "$(waiting | head -1 | cut -f1)" = "${ticket##*/}" ] && flock -n 9; do
  if [ -z "$said" ]; then
    echo "gate.sh: waiting for a turn (running: $(cat "$lock.who" 2>/dev/null || echo another gate); $(waiting | wc -l) waiting, this one included)." >&2
    said=1
  fi
  sleep 2
done
rm -f "$ticket"
# Nobody was running or waiting: the count of turns starts again.
[ -n "$said" ] || : > "$turns"
echo "$session" >> "$turns"
echo "$session in $(pwd) since $(date +%H:%M)" > "$lock.who"

# What the change touches, against main: committed on the branch, uncommitted, and new files.
base=$(git merge-base HEAD origin/main 2>/dev/null || true)
changed=$({ [ -n "$base" ] && git diff --name-only "$base"; git ls-files --others --exclude-standard; } 2>/dev/null | sort -u)
if [ $# -eq 0 ] && [ -n "$base" ] && echo "$changed" | grep -q '^apps/studio/' &&
  ! echo "$changed" | grep -qvE '^(apps/studio/|scripts/test-studio\.mjs$|docs/|[^/]*\.md$)'; then
  echo "gate.sh: only Studio's web app changed, so the example apps are skipped (their checks never load it)."
  pnpm lint && pnpm build && pnpm test && pnpm site && pnpm test:studio
else
  pnpm check "$@"
fi
status=$?
rm -f "$lock.who"
exit $status
