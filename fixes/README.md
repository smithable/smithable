# Fix files

One file per fix that changes what a built app does (smithable-cloud docs/design/fixes-reach-apps.md §3): `fixes/<id>.yml`, added in the pull request that fixes it, so the service can tell which hosted apps are affected and offer them the rebuild. CI fails a pull request that touches the kit, the templates or the generator without one (`scripts/fix-file-rule.mjs`, the rule in `packages/cli/src/fix-file-rule.ts`), except:

- **By itself**, with no model, and the check's log says which part passed it:
  - the change only bumps pins of the stack profile (`packages/adapter-tanstack/src/stack.ts`) by patch, or by minor from 1.0 on, and GitHub's advisory lists show no published advisory the bump leaves behind. If one does, the bump is a security fix and needs a fix file; if the lists cannot be read, the bump is not passed by itself;
  - or the change touches only comments in the kit's, templates' or generator's files, and documents (tests, snapshots and generated `*.gen.ts` files never count).
- **Declared** in the pull request's text, on a line of its own: `Fix file: none, because <reason>` (a reason of ten characters or more), for a change no built app shows: a new feature off by default, a refactor with the same output. The second reviewers are asked to check the reason against the diff. A security fix cannot be declared away.
- The label `no-fix-file`, for people, as before.

```yaml
id: upload-receipts            # the file's name; lowercase words joined by hyphens
title: One plain sentence of what was wrong.
severity: security             # urgent (people's data or access at risk now), security, or fix
exposure: What could have happened, in the owner's notice's words, or "none".
owner_action: Rotate the app's API keys.  # optional: what the owner must do themselves, one sentence; left out when the rebuild is all
introduced: unknown            # the engine commit that brought it, or unknown
affects:                       # any one holding makes an app affected
  kit: [src/kit/Upload.tsx]    # kit files, as the app's paths
  features: [field:file]       # any, page:<kind>, field:<type>, auth:<provider>, section:<name>, theme:<preset>
  stack: [better-auth]         # pinned packages
migration: none                # none, additive (new tables, or columns nullable or with a default), destructive
```

`smithable affected <id> --json` says whether a project is affected (yes, no or unknown, with a reason), from its spec files and package.json alone. `smithable fixes --json` lists the fixes this engine carries. The `CHANGELOG.md` entry names the fix's id.
