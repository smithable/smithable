#!/usr/bin/env bash
# Merges a pull request only when every check has passed. It brings the pull request up to date
# with main when it is behind, then arms GitHub's auto-merge, so the merge happens the moment the
# checks pass and no other merge can slip in between (with several sessions merging, a pull
# request that waited 18 minutes for its checks was otherwise often behind again). It refuses a
# red check, conflicts, or no checks at all (disarming auto-merge), and goes round again when
# another merge put the pull request behind while it waited. Branch protection requires the
# `check` job, but an administrator's merge passes it by, so this script is the gate for Claude
# sessions, which are allowed to run it and nothing else that merges.
# One pull request at a time across both repositories and every session on this machine: the
# lock ~/repos/.merge-lock (or $MERGE_LOCK) names the pull request, repository, session and time;
# others wait for it, and one older than 60 minutes is taken as stale. SESSION names the caller.
# Usage: scripts/merge-green.sh <pr-number> [--repo owner/name]
set -euo pipefail
pr="${1:?usage: merge-green.sh <pr-number> [--repo owner/name]}"
shift
repo=()
[ "${1:-}" = "--repo" ] && repo=(--repo "$2")
state=$(gh pr view "$pr" "${repo[@]}" --json state,isDraft,mergeable -q '"\(.state) \(.isDraft) \(.mergeable)"')
case "$state" in
  "OPEN false "*) ;;
  *) echo "Not merging #$pr: state, draft, mergeable = $state"; exit 1 ;;
esac
lock="${MERGE_LOCK:-$HOME/repos/.merge-lock}"
me="#$pr ${repo[1]:-$(gh repo view --json nameWithOwner -q .nameWithOwner)} ${SESSION:-session $PPID} $(date -u +%FT%TZ) pid $$@$(hostname)"
refresher=""
release() {
  [ -n "$refresher" ] && { pkill -P "$refresher" 2>/dev/null; kill "$refresher" 2>/dev/null; }
  [ "$(cat "$lock" 2>/dev/null)" = "$me" ] && rm -f "$lock"
  return 0
}
trap release EXIT
waited=0
until (set -o noclobber; echo "$me" > "$lock") 2>/dev/null; do
  # A holder refreshes the lock every minute, so one untouched for an hour was left behind.
  if [ -n "$(find "$lock" -mmin +60 2>/dev/null)" ]; then
    echo "Taking over a stale lock: $(cat "$lock" 2>/dev/null)"
    rm -f "$lock"
    continue
  fi
  [ $((waited % 60)) = 0 ] && echo "Waiting for the merge lock, held by $(cat "$lock" 2>/dev/null)"
  sleep 10
  waited=$((waited + 10))
done
( while sleep 60; do touch "$lock"; done ) &
refresher=$!
head_sha() { gh pr view "$pr" "${repo[@]}" --json headRefOid -q .headRefOid; }
merged() { [ "$(gh pr view "$pr" "${repo[@]}" --json state -q .state)" = MERGED ]; }
refuse() {
  gh pr merge "$pr" "${repo[@]}" --disable-auto >/dev/null 2>&1 || true
  echo "Not merging #$pr: $1"
  exit 1
}
for attempt in 1 2 3 4 5 6 7 8; do
  # GitHub says UNKNOWN for a few seconds after a push: wait for a real answer (up to a minute).
  merge_state=UNKNOWN
  for _ in $(seq 12); do
    merge_state=$(gh pr view "$pr" "${repo[@]}" --json mergeStateStatus -q .mergeStateStatus)
    [ "$merge_state" != UNKNOWN ] && break
    sleep 5
  done
  [ "$merge_state" = DIRTY ] && refuse "it has conflicts: rebase it."
  if [ "$merge_state" = BEHIND ]; then
    echo "#$pr is behind main: updating it."
    before=$(head_sha)
    gh pr update-branch "$pr" "${repo[@]}"
    # Until GitHub has the new head, the checks it shows are the old head's, green and finished.
    for _ in $(seq 24); do
      [ "$(head_sha)" != "$before" ] && break
      sleep 5
    done
  fi
  # A head's checks are listed only once a runner takes its job, which can take a long while when
  # other sessions' runs fill the runners; a workflow run for the head means they are coming.
  # No run for the head after fifteen minutes is not green; a queued one is waited for, an hour.
  for i in $(seq 360); do
    gh pr checks "$pr" "${repo[@]}" 2>/dev/null | grep -q . && break
    if [ "$i" -ge 90 ] && [ -z "$(gh run list "${repo[@]}" --commit "$(head_sha)" --json databaseId -q '.[].databaseId' 2>/dev/null)" ]; then
      refuse "no checks have run."
    fi
    [ $((i % 30)) = 0 ] && echo "#$pr: waiting for its checks to start (runners busy?)"
    sleep 10
  done
  gh pr checks "$pr" "${repo[@]}" 2>/dev/null | grep -q . || refuse "its checks did not start within an hour."
  # GitHub merges by itself the moment the checks pass (at once when they already have).
  gh pr merge "$pr" "${repo[@]}" --auto --merge --delete-branch >/dev/null
  if ! gh pr checks "$pr" "${repo[@]}" --watch --fail-fast >/dev/null; then
    merged && { echo "Merged #$pr."; exit 0; }
    gh pr checks "$pr" "${repo[@]}" || true
    refuse "a check failed."
  fi
  # Green: the merge follows within moments, unless another merge put it behind meanwhile.
  for _ in $(seq 24); do
    merged && { echo "Merged #$pr."; exit 0; }
    sleep 5
  done
  echo "#$pr is green but not merged (behind main again?): going round again."
done
refuse "still not merged after eight rounds."
