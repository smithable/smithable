#!/usr/bin/env bash
# Merges a pull request only when every check has passed. It arms GitHub's auto-merge, so the
# merge happens the moment the checks pass. It refuses a red check, conflicts, or no checks at
# all (disarming auto-merge). Where a repository's branch protection asks for a pull request to
# be up to date with main (this one's no longer does: main's twice-daily full check is where two
# changes that only clash together show), it brings one that is behind up to date first, and
# goes round again when another merge put it behind while it waited. Branch protection requires the
# `check` job, but an administrator's merge passes it by, so this script is the gate for Claude
# sessions, which are allowed to run it and nothing else that merges.
# A pull request of plain documents alone has no check: the CI workflow starts no run for the
# paths it lists between its "plain docs" markers (design notes, benchmark reports, the Markdown
# at the root), since no job reads them. The script takes that list from main, never from the
# pull request, and when every changed file is on it, none that a page of the site links to is
# removed, and the commits hold no secret (Gitleaks, as CI runs it; needs Docker), it merges the
# pull request itself, as the administrator. Anything else waits for its check as before.
# Conflicts only in generated files (the embedded templates *.gen.ts, Vitest snapshots) it
# resolves itself when it runs in the pull request's own worktree, clean: those are build outputs,
# and two branches that touch the kit clash in them every time (#448 was rebased three times in a
# day for them, 2026-10-08). It rebases on main taking the branch's side of each, runs the build
# (which regenerates the embedded files) and the snapshot's tests with -u, commits "Rebased on
# main: generated files refreshed" and pushes, then waits for the new head's checks like any
# other; CI's units catch a stale snapshot. Any other conflict is refused: rebase it by hand.
# The lock ~/repos/.merge-lock (or $MERGE_LOCK), shared with every session and smithable-cloud's
# merge-green, is held only while this script changes something: the plain documents' scan and
# merge, the rebase of generated files and its push, bringing a pull request up to date. Waiting
# for checks holds nothing (a full check queued on the one runner held it for an hour,
# 2026-10-11); GitHub's auto-merge merges when they pass. The lock names the pull request,
# repository, session and time; one untouched for 60 minutes is taken as stale. SESSION names
# the caller.
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
  if [ "$(cat "$lock" 2>/dev/null)" = "$me" ]; then rm -f "$lock"; fi
  if [ -n "$refresher" ]; then { pkill -P "$refresher"; kill "$refresher"; wait "$refresher"; } 2>/dev/null || true; fi
}
trap release EXIT
# Stopped by a signal, the script still releases the lock (bash runs the EXIT trap only on exit).
trap 'exit 130' INT TERM HUP
take_lock() {
waited=0
until (set -o noclobber; echo "$me" > "$lock") 2>/dev/null; do
  # A holder refreshes the lock every minute, so one untouched for an hour was left behind; and
  # one whose process on this machine is gone is stale at once.
  holder=$(sed -n 's/.* pid \([0-9]*\)@\(.*\)$/\1 \2/p' "$lock" 2>/dev/null)
  if [ -n "$(find "$lock" -mmin +60 2>/dev/null)" ] \
    || { [ "${holder#* }" = "$(hostname)" ] && ! kill -0 "${holder%% *}" 2>/dev/null; }; then
    echo "Taking over a stale lock: $(cat "$lock" 2>/dev/null)"
    rm -f "$lock"
    continue
  fi
  [ $((waited % 60)) = 0 ] && echo "Waiting for the merge lock, held by $(cat "$lock" 2>/dev/null)"
  sleep 10
  waited=$((waited + 10))
done
# Its sleep, stopped at the release, would otherwise print "Terminated" after the outcome.
( while sleep 60; do touch "$lock"; done ) 2>/dev/null &
refresher=$!
}
drop_lock() {
  release
  refresher=""
}
# Whether the head has checks listed. gh exits non-zero while any is pending (8) or has failed
# (1), so its output, not its status, says whether there are any (pipefail would hide them).
has_checks() { [ -n "$(gh pr checks "$pr" "${repo[@]}" 2>/dev/null || true)" ]; }
head_sha() { gh pr view "$pr" "${repo[@]}" --json headRefOid -q .headRefOid; }
merged() { [ "$(gh pr view "$pr" "${repo[@]}" --json state -q .state)" = MERGED ]; }
refuse() {
  gh pr merge "$pr" "${repo[@]}" --disable-auto >/dev/null 2>&1 || true
  echo "Not merging #$pr: $1"
  exit 1
}
# Plain documents alone (see the top): 0 when they are, with $base and $head for the scan; 1 when
# the pull request waits for its check like any other. A removed document the site links to is
# refused: the link has to change with it, in a pull request that then runs the site's check.
plain_docs() {
  [ ${#repo[@]} -eq 0 ] || return 1
  head=$(head_sha)
  git fetch -q origin main "$head" 2>/dev/null || return 1
  base=$(git merge-base origin/main "$head") || return 1
  local globs=() excludes=() glob gone
  mapfile -t globs < <(git show origin/main:.github/workflows/ci.yml 2>/dev/null \
    | sed -n '/# plain docs: begin/,/# plain docs: end/s/^ *- "\(.*\)"$/\1/p')
  [ ${#globs[@]} -gt 0 ] || return 1
  for glob in "${globs[@]}"; do excludes+=(":(glob,exclude)$glob"); done
  [ -n "$(git diff --name-only "$base" "$head")" ] || return 1
  [ -z "$(git diff --name-only "$base" "$head" -- . "${excludes[@]}")" ] || return 1
  local name
  while read -r gone; do
    [ -n "$gone" ] || continue
    # A page of the site links to another page by its name, and to any other file by its path
    # (a link to GitHub): the bare name of a file elsewhere, such as smithable.auth.yml, is in every page.
    case "$gone" in docs/site/*) name=$(basename "$gone") ;; *) name=${gone#docs/} ;; esac
    if git grep -qF "$name" "$head" -- docs/site docs/spec docs/ai.md; then
      refuse "it removes $gone, which a page of the site may link to: change the link in the same pull request."
    fi
  done < <(git diff --no-renames --diff-filter=D --name-only "$base" "$head")
  return 0
}
if plain_docs; then
  take_lock
  [ "$(gh pr view "$pr" --json mergeable -q .mergeable)" = CONFLICTING ] && refuse "it has conflicts: rebase it."
  docker info >/dev/null 2>&1 || refuse "plain documents merge after a scan for secrets, which needs Docker running."
  rules=$(mktemp)
  git show origin/main:.gitleaks.toml > "$rules"
  # The repository's objects are in the main checkout's .git, whichever worktree this runs in.
  if ! docker run --rm -v "$(dirname "$(git rev-parse --path-format=absolute --git-common-dir)"):/repo:ro" \
    -v "$rules:/cfg.toml:ro" ghcr.io/gitleaks/gitleaks:v8.30.1@sha256:c00b6bd0aeb3071cbcb79009cb16a60dd9e0a7c60e2be9ab65d25e6bc8abbb7f git /repo --no-banner --config /cfg.toml \
    --log-opts="$base..$head"; then
    rm -f "$rules"
    refuse "the scan found a secret in its commits (above), or could not run."
  fi
  rm -f "$rules"
  # The head that was read is the head that is merged.
  gh pr merge "$pr" --admin --merge --delete-branch --match-head-commit "$head" >/dev/null
  merged || refuse "GitHub did not merge it."
  echo "Merged #$pr (plain documents: no check to wait for)."
  exit 0
fi
# Conflicts in generated files alone (see the top): 0 when they were resolved and pushed, 1 when
# the pull request is refused as before. During a rebase "theirs" is the branch's commit.
rebase_generated() {
  [ ${#repo[@]} -eq 0 ] || return 1
  local branch f files=() tests=() t
  branch=$(gh pr view "$pr" --json headRefName -q .headRefName)
  [ "$(git rev-parse --abbrev-ref HEAD)" = "$branch" ] || return 1
  [ -z "$(git status --porcelain)" ] || return 1
  git fetch -q origin main "$branch"
  [ "$(git rev-parse HEAD)" = "$(git rev-parse FETCH_HEAD)" ] || return 1
  echo "#$pr has conflicts: rebasing on main, where only generated files may clash."
  if ! git rebase -q origin/main >/dev/null 2>&1; then
    while :; do
      mapfile -t files < <(git diff --name-only --diff-filter=U)
      [ ${#files[@]} -gt 0 ] || break
      for f in "${files[@]}"; do
        case "$f" in
          *.gen.ts) ;;
          */__snapshots__/*.snap) tests+=("$(dirname "$(dirname "$f")")/$(basename "$f" .snap)") ;;
          *) git rebase --abort; echo "#$pr: a conflict beyond the generated files: $f"; return 1 ;;
        esac
      done
      git checkout -q --theirs -- "${files[@]}"
      git add -- "${files[@]}"
      GIT_EDITOR=true git rebase --continue >/dev/null 2>&1 || true
    done
    [ -z "$(git rev-parse -q --verify REBASE_HEAD 2>/dev/null)" ] || { git rebase --abort; echo "#$pr: the rebase did not finish."; return 1; }
  fi
  pnpm build >/dev/null 2>&1 || { git reset -q --hard FETCH_HEAD; echo "#$pr: the build failed after the rebase."; return 1; }
  for t in $(printf '%s\n' ${tests[@]+"${tests[@]}"} | sort -u); do
    pnpm exec vitest run -u "$t" >/dev/null 2>&1 || { git reset -q --hard FETCH_HEAD; echo "#$pr: $t failed after the rebase."; return 1; }
  done
  if [ -n "$(git status --porcelain)" ]; then
    git add -A
    git commit -q -s -m "Rebased on main: generated files refreshed"
  fi
  git push -q --force-with-lease origin "$branch"
  echo "#$pr rebased and pushed ($(git rev-parse --short HEAD))."
}
for attempt in 1 2 3 4 5 6 7 8; do
  # GitHub says UNKNOWN for a few seconds after a push: wait for a real answer (up to a minute).
  merge_state=UNKNOWN
  for _ in $(seq 12); do
    merge_state=$(gh pr view "$pr" "${repo[@]}" --json mergeStateStatus -q .mergeStateStatus)
    [ "$merge_state" != UNKNOWN ] && break
    sleep 5
  done
  if [ "$merge_state" = DIRTY ]; then
    take_lock
    rebase_generated || refuse "it has conflicts: rebase it."
    drop_lock
    continue
  fi
  if [ "$merge_state" = BEHIND ]; then
    echo "#$pr is behind main: updating it."
    take_lock
    before=$(head_sha)
    gh pr update-branch "$pr" "${repo[@]}"
    # Until GitHub has the new head, the checks it shows are the old head's, green and finished.
    for _ in $(seq 24); do
      [ "$(head_sha)" != "$before" ] && break
      sleep 5
    done
    drop_lock
  fi
  # A head's checks are listed only once a runner takes its job, which can take a long while when
  # other sessions' runs fill the runners; a workflow run for the head means they are coming.
  # No run for the head after fifteen minutes is not green; a queued one is waited for, an hour.
  for i in $(seq 360); do
    has_checks && break
    if [ "$i" -ge 90 ] && [ -z "$(gh run list "${repo[@]}" --commit "$(head_sha)" --json databaseId -q '.[].databaseId' 2>/dev/null)" ]; then
      refuse "no checks have run."
    fi
    [ $((i % 30)) = 0 ] && echo "#$pr: waiting for its checks to start (runners busy?)"
    sleep 10
  done
  has_checks || refuse "its checks did not start within an hour."
  # GitHub merges by itself the moment the checks pass. It refuses to arm auto-merge on a pull
  # request that is already mergeable ("clean status": its checks finished before this line,
  # cloud #201 on 2026-10-14); that one is merged below by the script itself, once the required
  # check is confirmed green, which is what branch protection asks.
  armed=1
  gh pr merge "$pr" "${repo[@]}" --auto --merge --delete-branch >/dev/null 2>&1 || armed=0
  # The checks branch protection requires, as GitHub's own merge goes by (here `check`, which
  # reports on every job of its run). Others are not asked: a run that a newer one cancelled
  # (a pull request opened with the full-ci label starts two) leaves jobs that read as failed.
  # A required check that reports on other jobs is listed only when those are done: until then
  # gh lists none (in more than one wording), which is not a failure. A listed check is a line
  # with tabs. An hour, as for the checks to start.
  for i in $(seq 360); do
    # gh's own exit status is not asked here: it is 1 for a failed check and 8 for a pending
    # one, and with pipefail that made a failed required check look like one not yet listed,
    # so the script waited its hour (then with the merge lock held) instead of refusing.
    # The head's checks, one line each: name, status, conclusion. The required check is "check",
    # made when a run's other jobs end; a run GitHub cancelled (a newer run for the same head, or
    # no runner) leaves one that `gh pr checks` lists as failed yet exits 0 on, so a PR opened
    # with the full-ci label read as green while its full job still ran (C, 2026-10-09). Only a
    # finished "check" ends the wait; while any job of the head still runs, the wait goes on.
    rollup=$(gh pr view "$pr" "${repo[@]}" --json statusCheckRollup --jq '.statusCheckRollup[] | "\(.name // .context)\t\(.status // "COMPLETED")\t\(.conclusion // .state // "")"' 2>/dev/null || true)
    case "$rollup" in
      *"$(printf 'check\tCOMPLETED\tSUCCESS')"*|*"$(printf 'check\tCOMPLETED\tFAILURE')"*) break ;;
    esac
    merged && { echo "Merged #$pr."; exit 0; }
    if [ -n "$rollup" ] && [ "$(printf '%s\n' "$rollup" | grep -c -v "$(printf '\tCOMPLETED\t')")" != 0 ]; then
      [ $((i % 30)) = 0 ] && echo "#$pr: its checks are still running"
      sleep 10
      continue
    fi
    # A run GitHub itself cancelled (its runners were not to be had, 2026-10-05) leaves the
    # required check cancelled and nothing pending: it is never reported, and waiting on it held
    # the merge lock for an hour (when waiting still held it). A check cancelled by a newer run still has that run's pending.
    if [ "$(gh pr view "$pr" "${repo[@]}" --json statusCheckRollup --jq '[.statusCheckRollup[]|select(.name=="check")] | (length > 0 and all(.conclusion=="CANCELLED"))' 2>/dev/null)" = true ]; then
      gh pr checks "$pr" "${repo[@]}" || true
      refuse "its run was cancelled by GitHub. Run it again (gh run rerun <run id>, from gh run list --branch <branch>) and merge again."
    fi
    [ $((i % 30)) = 0 ] && echo "#$pr: waiting for its required check to be reported"
    sleep 10
  done
  if ! gh pr checks "$pr" "${repo[@]}" --required --watch --fail-fast >/dev/null; then
    merged && { echo "Merged #$pr."; exit 0; }
    gh pr checks "$pr" "${repo[@]}" || true
    refuse "a check failed."
  fi
  # Green: the merge follows within moments, unless another merge put it behind meanwhile; with
  # auto-merge not armed, the script merges it now.
  [ "$armed" = 0 ] && gh pr merge "$pr" "${repo[@]}" --merge --delete-branch >/dev/null 2>&1 || true
  for _ in $(seq 24); do
    merged && { echo "Merged #$pr."; exit 0; }
    sleep 5
  done
  echo "#$pr is green but not merged (behind main again?): going round again."
done
refuse "still not merged after eight rounds."
