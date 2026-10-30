# Contributing

Thank you for looking. Smithable is small and opinionated, so please read [docs/VISION.md](../docs/VISION.md) (why), [docs/ARCHITECTURE.md](../docs/ARCHITECTURE.md) (the decisions) and the rules in [CLAUDE.md](../CLAUDE.md) before a change; they explain most of the answers a reviewer would otherwise give.

## Before you start

- **Bugs and small fixes:** open a pull request; a failing test that shows the bug is the best first commit.
- **Anything that changes the spec, an operation, a page pattern or the generated code:** open an issue or a short design note first (`docs/design/` has examples). The DSL grows only through the five questions in ARCHITECTURE §2.4, and a new construct is often better as a project plugin.
- **Generated apps must never depend on Smithable**, and generation must stay byte-identical for the same input. Changes that break either are not merged.

## Working on it

Node 24 (`.node-version`) and pnpm (the version pinned in `package.json`):

```sh
pnpm install
pnpm check      # lint, build, unit tests, every example app generated and tested, Studio in a browser
```

`pnpm check` is the gate before every commit. Tests live next to the code (`src/**/*.test.ts`); templates in `packages/adapter-tanstack/templates/` are real files that `pnpm build` embeds, and `*.gen.ts` files are never edited by hand. A change to a section's schema needs `pnpm schema`; a change to the spec grammar updates `docs/spec/v0.1.md` in the same pull request, and an architecture change updates `docs/ARCHITECTURE.md`.

### Changing Studio and Builder

Studio and Builder are one React app in `apps/studio`. To see an edit the moment it is saved, run Studio on an app and the development server beside it:

```sh
node packages/cli/dist/bin.js new my-crm                    # an app to work on; it gets a Git repository of its own
cd my-crm && node ../packages/cli/dist/bin.js studio        # Studio's server, on http://localhost:4321
cd apps/studio && pnpm dev                                  # in a second terminal: http://localhost:5173 reloads on every edit
```

Open http://localhost:5173. It is the same Studio on the same app: changes you make there go through `smithable studio` as always. What `smithable studio` itself serves on 4321 is the last `pnpm build`.

## Compatibility

Smithable has three contracts. Each has its own version, and they are kept separate:

- **The spec** (`smithable.yml` and its companions) is versioned by the file's `smithable:` line. A breaking change to it ships with a migration in core's `migrateSpec`, and the version line changes only together with that migration.
- **The engine** (operations, CLI flags and the MCP tools) follows the packages' semver. An operation, an argument or a CLI flag that goes away is still accepted for one minor release, with a message that names its replacement.
- **A generated app's API** (`/api/v1`) moves to `v2` only when the generator changes the API's shape incompatibly.

During 0.x, every breaking change gets a line under **Breaking** in [CHANGELOG.md](../CHANGELOG.md) that names which contract it hits. Nothing breaks a generated app that is not upgraded: an app is its owner's, and `smithable upgrade` is the only way forward. It is checked like any change, and it can be undone. Hosted apps are offered engine upgrades, never forced to take them ([ARCHITECTURE §14.3](../docs/ARCHITECTURE.md)); security updates to the app kit and the platform are the exception: Smithable applies them and tells the owner, as [SECURITY.md](SECURITY.md) says.

## Sign-off

Contributions are accepted under the [Developer Certificate of Origin](https://developercertificate.org/). Add `Signed-off-by: Your Name <you@example.com>` to each commit (`git commit -s`) to say that you wrote the change or have the right to submit it under the repository's licences: Apache-2.0 for Smithable, 0BSD for the app kit and templates ([NOTICE](../NOTICE)).

## Conduct

Everyone here follows the [code of conduct](CODE_OF_CONDUCT.md); reports go to conduct@smithable.ai.

## Security

Vulnerabilities go to security@smithable.ai, not to the issue tracker: [SECURITY.md](SECURITY.md).
