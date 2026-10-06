# CI: what runs where

Two kinds of run, by cost. GitHub's runners are billed by the minute . The self-hosted runner is Johan's dev machine, which already runs these checks for every engine change through `scripts/gate.sh`; its minutes are free.

| Run | Where | What |
|---|---|---|
| Every pull request (not plain documents) | GitHub, `ubuntu-latest` | `lint-build-units`: secrets scan, lint, build, units, site. About two minutes. |
| The full check: engine pull requests with the `full-ci` label (every engine pull request once `FULL_CI` is on), main twice a day, Run workflow | the self-hosted runner, labels `self-hosted, smithable` | `full`: one job running `scripts/gate.sh` (`pnpm check`: lint, build, units, site, every example in parallel, Studio in a real browser) with `SESSION=ci`, so it takes its turn in the machine's gate queue like a session's gate. |
| Pull requests from forks | never on the self-hosted runner | the `full` job's condition; relevant after the public flip |

## The runner on the machine

One runner per repository (a runner serves one repository; an organization runner would need an organization-admin token). The engine's is registered as `smithable-engine` with the labels `self-hosted, linux, x64, smithable`; the cloud repository gets its own the same way when B moves the release workflow (docs/design/provider-layer.md's neighbour, `images.yml`, which today bills eleven minutes a merge waiting on CodeBuild and the deploy).

Install (Johan, once; the runner is a long-running service, which a session may not install itself):

```sh
mkdir -p ~/repos/.actions-runner/engine && cd ~/repos/.actions-runner/engine
ver=$(gh api repos/actions/runner/releases/latest --jq .tag_name | sed 's/^v//')
curl -sL "https://github.com/actions/runner/releases/download/v$ver/actions-runner-linux-x64-$ver.tar.gz" | tar xz
./config.sh --unattended --url https://github.com/smithable/smithable \
  --token "$(gh api -X POST repos/smithable/smithable/actions/runners/registration-token --jq .token)" \
  --name smithable-engine --labels smithable --work _work --replace
# A user service (systemd --user; linger is on for this user, so it starts at boot):
mkdir -p ~/.config/systemd/user && cat > ~/.config/systemd/user/actions-runner-engine.service <<'UNIT'
[Unit]
Description=GitHub Actions runner (smithable engine)
After=network-online.target
[Service]
WorkingDirectory=%h/repos/.actions-runner/engine
ExecStart=%h/repos/.actions-runner/engine/run.sh
Restart=always
RestartSec=10
KillMode=process
KillSignal=SIGTERM
TimeoutStopSec=5min
[Install]
WantedBy=default.target
UNIT
systemctl --user daemon-reload && systemctl --user enable --now actions-runner-engine
systemctl --user status actions-runner-engine --no-pager | head -5
```

The job finds Node through fnm's default alias (`~/.local/share/fnm/aliases/default/bin`, put on the job's PATH by the workflow), installs the dependencies into the runner's own checkout (`_work/smithable/smithable`, with the machine's pnpm store), and runs the gate on ports 8600 and 8610, which no session uses. The generated apps' commits are made as `CI <ci@smithable.invalid>` through the job's environment; the machine's global Git identity is left alone.

## When the machine is off

A queued job waits for the runner for up to 24 hours, then fails as "no runner". The scheduled check of main simply runs when the machine is back; a labelled pull request's check waits with it. `~/repos/stop` stops sessions, not the runner: a gate it holds finishes; the runner's queue drains when the machine is on.

## Removing the runner

```sh
systemctl --user disable --now actions-runner-engine
cd ~/repos/.actions-runner/engine && ./config.sh remove --token "$(gh api -X POST repos/smithable/smithable/actions/runners/remove-token --jq .token)"
```
