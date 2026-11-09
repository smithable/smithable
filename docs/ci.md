# CI: what runs where

Two kinds of run, by cost. GitHub's runners are billed by the minute. The self-hosted runner is Johan's dev machine, which already runs these checks for every engine change through `scripts/gate.sh`; its minutes are free.

| Run | Where | What |
|---|---|---|
| Every pull request (not plain documents) | GitHub, `ubuntu-latest` | `lint-build-units`: secrets scan, lint, build, units, site. About two minutes. |
| The full check: all trusted engine pull requests, main twice a day, Run workflow | the self-hosted runner, labels `self-hosted, smithable` | `full`: one job running `scripts/gate.sh` (`pnpm check`: lint, build, units, site, every example in parallel, Studio in a real browser) with `SESSION=ci`, so it takes its turn in the machine's gate queue like a session's gate. Its five-hour limit covers the wait behind several gates on a loaded machine; a run it cancels is rerun from the workflow's page. |
| A green scheduled full check on main | GitHub, `ubuntu-latest` | `release`: asks smithable-cloud's Release images to release that commit (`if_new`: only when either repository moved since the last release), so the beta gets at most two releases a day. Needs the secret `CLOUD_RELEASE_TOKEN` (smithable-cloud only, Actions read and write); without it, or when it has lapsed, the job is yellow and the cloud's own daily schedule releases. |
| Pull requests from forks | never on the self-hosted runner | the `full` job's condition; and outside contributors' runs wait for a maintainer's approval (the repository's Actions setting) |
| A fork's pull request that changes the engine | `check` stays red with the reason | lint, build, units and site run, but the full check never does here, so a green status would say more than was checked; a maintainer runs `scripts/gate.sh` on the branch and merges as the administrator |
| The weekly long run of the random tests: Sunday 21:00 UTC, or Run workflow with a scale and a seed | the self-hosted runner, in a turn of the gate queue (`GATE_RUN`) | `weekly.yml`: every fast-check property with `FC_SCALE` times its cases (100, about half an hour) and this week's date as the seed. A failure writes the seed and the case into that week's issue ("Weekly properties: a failure in <week>", one per week, a comment for each further failure), written from a GitHub runner, since the machine's runner holds no token for issues. Run a case again with `FC_SEED=<seed> FC_SCALE=<scale> pnpm exec vitest run properties`. After the properties, `scripts/random-typecheck.mjs --seed <seed>` makes eight starter apps, applies a random sequence of changes to each through the command line and type-checks the app: a change the operation layer took must leave an app that type-checks. |
| A docs publish (smithable-cloud's Docs workflow) | GitHub, `ubuntu-latest` | builds `pnpm site` and uploads `site/vad/<version>/` first, on its own: the voice detector's runtime, model and worker that Studio fetches with integrity hashes (`scripts/vad-assets.mjs`), cached a year as immutable (the version is in the path), `application/wasm` for the WebAssembly; older versions stay, since nothing there is deleted. The docs CDN answers every path with `Access-Control-Allow-Origin: *`, which a cross-origin fetch with an integrity check needs. Then the rest of the site. |

## The runner on the machine

One runner per repository (a runner serves one repository; an organization runner would need an organization-admin token). The engine's is registered as `smithable-ci` with the labels `self-hosted, linux, x64, smithable`. It runs as a system user of its own, `smithable-ci` (home /var/lib/smithable-ci, no login shell), which holds no credentials and cannot read the developers' home folders: a pull request's code runs in the job, so the job gets nothing it would not be safe for that code to have. The machine's gates and the runner's share one queue in /var/lib/smithable-gate, a setgid directory of the group `smithable-gate` that both users are in (`scripts/gate.sh` uses it when it is there and ~/repos otherwise).

Install (the machine's owner, once, with sudo; a long-running service is not something a session installs itself):

```sh
# The user, and the gate queue it shares with the machine's developer ($USER)
sudo useradd --system --create-home --home-dir /var/lib/smithable-ci --shell /usr/sbin/nologin smithable-ci
sudo groupadd smithable-gate
sudo usermod -aG smithable-gate smithable-ci
sudo usermod -aG smithable-gate "$USER"   # applies at the next login (on WSL: wsl --shutdown)
sudo install -d -o "$USER" -g smithable-gate -m 2775 /var/lib/smithable-gate

# Node and pnpm for that user, where the job looks for them (fnm's default alias)
sudo -u smithable-ci -H bash -c 'curl -fsSL https://fnm.vercel.app/install | bash -s -- --skip-shell &&
  ~/.local/share/fnm/fnm install --lts && ~/.local/share/fnm/fnm default lts-latest &&
  PATH=$HOME/.local/share/fnm/aliases/default/bin:$PATH corepack enable'

# The runner
ver=$(gh api repos/actions/runner/releases/latest --jq .tag_name | sed 's/^v//')
token=$(gh api -X POST repos/smithable/smithable/actions/runners/registration-token --jq .token)
sudo -u smithable-ci -H bash -c "mkdir -p ~/runner && cd ~/runner &&
  curl -fsSL https://github.com/actions/runner/releases/download/v$ver/actions-runner-linux-x64-$ver.tar.gz | tar xz &&
  ./config.sh --unattended --url https://github.com/smithable/smithable --token '$token' \
    --name smithable-ci --labels self-hosted,linux,x64,smithable --work _work --replace &&
  cp bin/runsvc.sh ."
# The service starts runsvc.sh, as the runner's own svc.sh install does: it turns systemd's SIGTERM into
# SIGINT, on which the runner stops its own listener. Started as run.sh, each stop or restart left
# that listener running (KillMode=process ends only run.sh), and two listeners on one folder fail
# each other's checkouts (2026-10-08).
sudo tee /etc/systemd/system/actions-runner-smithable.service >/dev/null <<'UNIT'
[Unit]
Description=GitHub Actions runner (smithable engine)
After=network-online.target
[Service]
User=smithable-ci
Group=smithable-ci
SupplementaryGroups=smithable-gate
UMask=0002
WorkingDirectory=/var/lib/smithable-ci/runner
ExecStart=/var/lib/smithable-ci/runner/runsvc.sh
Restart=always
RestartSec=10
# The default soft open-files limit is 1024; seven dev servers and a browser need far more, and ran
# into it as pages that never opened. A shell has 1048576.
LimitNOFILE=1048576
KillMode=process
KillSignal=SIGTERM
TimeoutStopSec=5min
[Install]
WantedBy=multi-user.target
UNIT
sudo systemctl daemon-reload && sudo systemctl enable --now actions-runner-smithable
systemctl status actions-runner-smithable --no-pager | head -5
```

The first three runs each lost a browser step to a page that never opened: the service's soft limit on open files was 1024 (a shell's is 1048576), which seven dev servers and Chromium exhaust; `LimitNOFILE` in the unit fixes it. The job runs three examples at a time (`TEST_APPS_CONCURRENCY=3`; a session's gate runs all seven), since the runner shares the machine with the sessions' builds and tests: the first two runs each lost one browser step to a hydration wait under that load. The job finds Node through fnm's default alias (`~/.local/share/fnm/aliases/default/bin` of the runner's user, put on the job's PATH by the workflow), installs Playwright's Chromium into that user's cache when it is missing, installs the dependencies into the runner's own checkout (`_work/smithable/smithable`), and runs the gate on ports 8600 and 8610, which no session uses. The generated apps' commits are made as `CI <ci@smithable.invalid>` through the job's environment.

## Ports the runner uses

The `full` job's gate takes `TEST_APPS_PORT=8600` and `TEST_STUDIO_PORT=8610`. Each example gets ten ports from the base and uses its port P, P+100, P+200 (the smoke tests) and P+300 (the no-secret check), so the runner owns **8600 to 8999**. Nothing else on the machine may listen there: a session's own dev server or Studio in that range answers the runner's checks instead of the example under test (2026-10-07: a stranger-walk server on 8640 failed the marketplace checks of two runs). A session's gate takes a base whose whole span stays clear of it (A: 7000, so 7000–7399; Fable: 9600, so 9600–9999), and anything run by hand (a walk, a dev server, `test:apps:one`) goes on its own hundred outside every gate's span (A: 9100–9299; Fable: 9500–9599).

## When the machine is off

A pull request that touches the kit, the templates or the generator needs a fix file (`fixes/README.md`) or the label `no-fix-file`. Label it first, then run the failed check again: the rule reads the pull request's labels as they are when it runs (A 243), so the rerun passes.

A queued job waits for the runner for up to 24 hours, then fails as "no runner". The scheduled check of main simply runs when the machine is back; a labelled pull request's check waits with it. `~/repos/stop` stops sessions, not the runner: a gate it holds finishes; the runner's queue drains when the machine is on.

## Removing the runner

```sh
sudo systemctl disable --now actions-runner-smithable
token=$(gh api -X POST repos/smithable/smithable/actions/runners/remove-token --jq .token)
sudo -u smithable-ci -H bash -c "cd ~/runner && ./config.sh remove --token '$token'"
```

## Further checks, run by hand

These scripts came with the 2026-11 remediation. Apart from `test:release-review`, they are not part of `pnpm check` or the gate: run them when working on what they cover. `test:booking` stays by hand for now (a candidate for main's scheduled full run later, not for every gate).

`pnpm test:booking`: an independent published booking fixture with ordinary synthetic email-code login, direct browser/API/MCP authorization and file checks, final-place contention, cancellation/rebooking, complete versus scoped export, revoked keys and mobile navigation. The same oracle runs on clean generated code and three narrow fault-injected fixture builds (permission, count, persistence); a defect must fail its intended check. Fixture code lives in disposable directories, with no external mail or model calls. Only JSON evidence under `test-results/booking-*.json` is intended for sharing; retained failed fixture directories can contain synthetic credentials and raw browser diagnostics. It also runs the disposable incoming-attachment HTTP fixture: it typechecks a fresh support app, creates mail and a threaded reply, and checks literal persisted fields and attachment bytes. Stream overflow/deadline/cancellation and concurrent failed-mail cleanup have focused runtime regressions in the CLI units.

`pnpm test:ci-result`: `scripts/ci-result.sh`, an aggregate for a workflow's required check that rejects missing, skipped, cancelled and failed required jobs, and its test. The workflow does not use it yet.

`pnpm test:release-review` (in the gate's Studio phase, after `test:studio`; about forty seconds): a disposable project and real browser verify Studio's release review in its unknown, synthetic passed, stale and unavailable check states, access widening and potential data loss. Its positive evidence is explicitly seeded test metadata, not a real security scan or deployment. Unit fixtures separately verify source binding and missing recovery evidence. Local release evidence is not hosted operational evidence. It also exercises the generated development clock over authenticated HTTP. Versioned scenario/reset/clock/maintenance tests run with the CLI units.

`node --test scripts/staged-upgrade.test.mjs`: the staged-upgrade check (`scripts/upgrade-flow.mjs`) in isolation, when working on maintenance.

Local performance measurements: `node scripts/benchmark-expensive-paths.mjs --lifecycle` generates an owned temporary booking app, measures synthetic 1k/10k/100k datasets and small-file scans, and records environment, timings and failures under ignored `test-results/`. `--selection-only` separately checks numeric relation titles and explicit-list browser selection; `--out <file>` chooses its report. `--keep` retains the private disposable fixture for diagnosis. A cold rescan refers to the app's count cache, not cold operating-system caches. Build/preview timings describe this machine and do not establish hosted latency.
