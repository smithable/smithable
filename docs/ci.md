# CI: what runs where

Two kinds of run, by cost. GitHub's runners are billed by the minute. The self-hosted runner is Johan's dev machine, which already runs these checks for every engine change through `scripts/gate.sh`; its minutes are free.

| Run | Where | What |
|---|---|---|
| Every pull request (not plain documents) | GitHub, `ubuntu-latest` | `lint-build-units`: secrets scan, lint, build, units, site. About two minutes. |
| The full check: engine pull requests with the `full-ci` label (every engine pull request once `FULL_CI` is on), main twice a day, Run workflow | the self-hosted runner, labels `self-hosted, smithable` | `full`: one job running `scripts/gate.sh` (`pnpm check`: lint, build, units, site, every example in parallel, Studio in a real browser) with `SESSION=ci`, so it takes its turn in the machine's gate queue like a session's gate. |
| A green scheduled full check on main | GitHub, `ubuntu-latest` | `release`: asks smithable-cloud's Release images to release that commit (`if_new`: only when either repository moved since the last release), so the beta gets at most two releases a day. Needs the secret `CLOUD_RELEASE_TOKEN` (smithable-cloud only, Actions read and write); without it, or when it has lapsed, the job is yellow and the cloud's own daily schedule releases. |
| Pull requests from forks | never on the self-hosted runner | the `full` job's condition; and outside contributors' runs wait for a maintainer's approval (the repository's Actions setting) |

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

A queued job waits for the runner for up to 24 hours, then fails as "no runner". The scheduled check of main simply runs when the machine is back; a labelled pull request's check waits with it. `~/repos/stop` stops sessions, not the runner: a gate it holds finishes; the runner's queue drains when the machine is on.

## Removing the runner

```sh
systemctl --user disable --now actions-runner-engine
cd ~/repos/.actions-runner/engine && ./config.sh remove --token "$(gh api -X POST repos/smithable/smithable/actions/runners/remove-token --jq .token)"
```
