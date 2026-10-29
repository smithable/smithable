<!-- What the change does and why, in the app's words where possible. Link the issue or the design note (docs/design/) for anything that changes the spec, an operation, a page pattern or the generated code. -->

- [ ] For a change to the engine, the examples or the scripts `check` runs: `pnpm check` passes locally (lint, build, unit tests, every example app, Studio in a browser). While the repository is private, CI runs only lint, build, units and site (unless the pull request has the `full-ci` label), so this local run is the gate.
- [ ] `docs/spec/v0.1.md` updated for a change to the spec grammar; `docs/ARCHITECTURE.md` for an architecture decision; `pnpm schema` run after a schema change
- [ ] Generated apps still depend on no Smithable package, and generation stays byte-identical for the same input
- [ ] Commits are signed off (`git commit -s`, the DCO in .github/CONTRIBUTING.md)
