# Fix files

One file per fix that changes what a built app does (smithable-cloud docs/design/fixes-reach-apps.md §3): `fixes/<id>.yml`, added in the pull request that fixes it, so the service can tell which hosted apps are affected and offer them the rebuild. CI fails a pull request that touches the kit, the templates or the generator without one, unless it carries the label `no-fix-file` (a change no built app shows: a comment, a test, a new feature off by default).

```yaml
id: upload-receipts            # the file's name; lowercase words joined by hyphens
title: One plain sentence of what was wrong.
severity: security             # urgent (people's data or access at risk now), security, or fix
exposure: What could have happened, in the owner's notice's words, or "none".
introduced: unknown            # the engine commit that brought it, or unknown
affects:                       # any one holding makes an app affected
  kit: [src/kit/Upload.tsx]    # kit files, as the app's paths
  features: [field:file]       # any, page:<kind>, field:<type>, auth:<provider>, section:<name>, theme:<preset>
  stack: [better-auth]         # pinned packages
migration: none                # none, additive (new tables, or columns nullable or with a default), destructive
```

`smithable affected <id> --json` says whether a project is affected (yes, no or unknown, with a reason), from its spec files and package.json alone. `smithable fixes --json` lists the fixes this engine carries. The `CHANGELOG.md` entry names the fix's id.
