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
# When too many are ahead, it does not wait: it exits 75 and says to let CI run the full check
# instead (the pull request's `full-ci` label; the examples run there as parallel jobs, about six
# minutes, with no queue). "Too many" is more than GATE_AHEAD_MAX gates ahead, the running one
# counted: 1 by default, so with two or more ahead, which is about twenty minutes of waiting.
# Busy alone is not enough (Johan, 2026-10-05). GATE_AHEAD_MAX=99 waits whatever the queue.
#
# A change that touches only Studio's web app (apps/studio, scripts/test-studio.mjs) and plain
# documents skips the example apps: their checks never load it. Everything else is the full
# check. The exit status is the check's. The lock is released when the gate ends, however it ends.
set -u
# Everything below is one block, so bash has read the whole file before it runs any of it: a
# copy that is replaced while gates run from it (it happened, and six gates died of a syntax
# error) cannot change under them. Replace a copy with mv all the same, never by writing over it.
{
# Night hours, 23:30–07:00 in Mariehamn (Johan, 2026-10-12: a quieter machine at night): a gate
# started then runs itself again, once, on at most four cores at the lowest priority (systemd-run,
# else nice). Only while the file $home/night-cap exists (Johan, 2026-10-18: off for now, since a
# capped gate beside any other load ran out of its one-minute waits; `touch` the file to have the
# quiet nights again, remove it to stop). The runner's own service (SESSION=ci) is capped by its
# timer instead (smithable-runner-cap.timer, enabled and disabled with systemctl). GATE_CLOCK
# (HHMM) stands for the time, for a test.
if [ "${1:-}" != "--queue" ] && [ "${SESSION:-}" != "ci" ] && [ -z "${GATE_NIGHT_CAPPED:-}" ] && [ -e "${GATE_HOME:-/var/lib/smithable-gate}/night-cap" ]; then
  now=$((10#${GATE_CLOCK:-$(TZ=Europe/Mariehamn date +%H%M)}))
  if [ "$now" -ge 2330 ] || [ "$now" -lt 700 ]; then
    export GATE_NIGHT_CAPPED=1
    echo "gate.sh: night hours (23:30–07:00 Mariehamn): this gate runs capped, on four cores at low priority."
    if command -v systemd-run >/dev/null 2>&1 && systemd-run --user --scope --quiet true >/dev/null 2>&1; then
      exec systemd-run --user --scope --quiet -p CPUQuota=400% -p CPUWeight=10 nice -n 19 "$0" "$@"
    fi
    exec nice -n 19 "$0" "$@"
  fi
fi
# The queue is shared by every user who runs gates on the machine: the sessions, and the runner,
# which runs as a user of its own (docs/ci.md). /var/lib/smithable-gate when it is there (a group
# both users are in, setgid), else ~/repos as before. Its files are made group-writable, so each
# user may take the lock, write the note of who runs, and drop the other's finished tickets.
home=${GATE_HOME:-/var/lib/smithable-gate}
[ -n "${GATE_HOME:-}" ] || [ -w "$home" ] || home=$HOME/repos
lock=$home/.gate-lock
queue=$home/.gate-queue
turns=$home/.gate-turns   # the sessions served since the queue was last empty, one a line
session=${SESSION:-?}
umask_was=$(umask)
umask 002
mkdir -p "$queue"
touch "$turns" "$lock"

# The waiting gates in the order of their turns: "<ticket> <session> <worktree>" a line. A
# ticket is "<arrival>.<pid>" and holds "session<TAB>worktree"; one whose process is gone is dropped.
waiting() {
  local t pid who where
  for t in "$queue"/*; do
    [ -e "$t" ] || continue
    pid=${t##*.}
    # Another user's gate is alive too: kill -0 is refused for it, but /proc has it.
    kill -0 "$pid" 2>/dev/null || [ -d "/proc/$pid" ] || { rm -f "$t"; continue; }
    IFS=$'\t' read -r who where < "$t" || continue
    printf '%s\t%s\t%s\n' "${t##*/}" "$who" "$where"
  done | sort -n |
    awk -F'\t' -v served="$(tr '\n' '\t' < "$turns")" '
      BEGIN { m = split(served, had, "\t"); for (i = 1; i <= m; i++) if (had[i] != "") n[had[i]]++ }
      { n[$2]++; print n[$2] "\t" $0 }' |
    sort -s -n -k1,1 | cut -f2-
}

# Whether a gate holds the lock now. The note of who runs is not proof: a gate that was stopped
# from outside leaves it behind, and it then counted as one ahead for everyone.
running() {
  if (exec 8>>"$lock"; flock -n 8); then
    rm -f "$lock.who"
    return 1
  fi
}

if [ "${1:-}" = --queue ]; then
  echo "running: $(running && cat "$lock.who" 2>/dev/null || echo nothing)"
  waiting | awk -F'\t' '{ print "waiting " NR ": " $2 " in " $3 }'
  exit 0
fi

ticket="$queue/$(date +%s%N).$$"
printf '%s\t%s\n' "$session" "$(pwd)" > "$ticket"
trap 'rm -f "$ticket"' EXIT

# How many gates are ahead of this one: those whose turn comes first, and the one running.
ahead=$(waiting | awk -F'\t' -v me="${ticket##*/}" '$1 == me { exit } { n++ } END { print n + 0 }')
running && ahead=$((ahead + 1))
if [ "$ahead" -gt "${GATE_AHEAD_MAX:-1}" ]; then
  cat >&2 <<MSG
gate.sh: $ahead gates are ahead (about $((ahead * 9)) minutes), so this one does not wait.
Let CI run the full check instead: run "pnpm lint && pnpm build && pnpm test" here (no lock
needed), commit, push, and open the pull request with the label full-ci
(gh pr create --label full-ci …, or gh pr edit <pr> --add-label full-ci). scripts/merge-green.sh
merges it when that check has passed. To wait here anyway: GATE_AHEAD_MAX=99 scripts/gate.sh
MSG
  exit 75
fi
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
umask "$umask_was"

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
}
