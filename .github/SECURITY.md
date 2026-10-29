# Security

## Reporting a vulnerability

Please report vulnerabilities in Smithable, in the apps it generates, or in the hosted service at smithable.ai by email to **security@smithable.ai**, not in a public issue. Include what you found, how to reproduce it, and what you think it allows. You will get an acknowledgement within three working days and a fix or a plan within thirty; we credit reporters in the release notes unless they prefer not to be named.

Fixed vulnerabilities are published as [GitHub security advisories](https://github.com/smithable/smithable/security/advisories) on this repository, naming the affected versions; owners of apps on the hosted service are told by email as well.

## What is in scope

- The engine, CLI, Studio and MCP server in this repository.
- The code Smithable generates: the app kit, the generated data functions and access rules, the production image and its headers.
- The hosted beta (smithable.ai) and published apps (smithable.app). Please test only against projects you created, and do not run scanners against other people's apps.

## How Smithable keeps generated apps safe

Every generated app checks access in its data functions (never only in the UI), validates every write with a schema derived from the spec, sends security headers and a Content Security Policy with a per-request nonce, runs on a distroless image with pinned dependencies, and carries generated tests for its access rules. `smithable security --level normal|release` runs a dependency audit, a secrets scan, static analysis, a container scan and a dynamic scan against the running image; findings are reported and never suppressed. The details are in [docs/ARCHITECTURE.md §12](../docs/ARCHITECTURE.md#12-verification-security-deployment).

## Supported versions

Until 1.0, only the latest release is supported. Generated apps record the Smithable version and stack profile they were generated with (`smithable.lock`); `smithable update --security` and `smithable upgrade` bring an app forward through the normal change pipeline.
