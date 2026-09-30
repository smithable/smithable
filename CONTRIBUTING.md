# Contributing

Thank you for looking. Smithable is small and opinionated, so please read [docs/VISION.md](docs/VISION.md) (why), [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) (the decisions) and the rules in [CLAUDE.md](CLAUDE.md) before a change; they explain most of the answers a reviewer would otherwise give.

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

## Sign-off

Contributions are accepted under the [Developer Certificate of Origin](https://developercertificate.org/). Add `Signed-off-by: Your Name <you@example.com>` to each commit (`git commit -s`) to say that you wrote the change or have the right to submit it under the repository's licences: Apache-2.0 for Smithable, 0BSD for the app kit and templates ([NOTICE](NOTICE)).

## Conduct

Everyone here follows the [code of conduct](CODE_OF_CONDUCT.md); reports go to conduct@smithable.ai.

## Security

Vulnerabilities go to security@smithable.ai, not to the issue tracker: [SECURITY.md](SECURITY.md).
