# The result of a change: what it will do, and what was verified (design)

Status: proposed 2026-11-07, Fable, on Johan's decision from the builder-inspiration review ("What
a change verified, and what it will do: one result for every change"; backlog Fable 100, with
Fable 27; the stale plan is A 232); build after Johan reads it: core and CLI first (§7). A second
reviewer's points taken the same day (failures before not-run in the line, per-environment
results, recounting at Apply, structured targets for sampleusers).

## 1. Today

- An operation answers `OperationResult` (packages/core/src/apply.ts): `ok`, the files,
  `description`, `destructive`, `effects` (`Effect[]`: renames, removed fields, changed choices,
  removed pages and actions, imports); or `ok: false` with `diagnostics`.
- The host (`runOperation`, packages/cli/src/op.ts) validates, writes, regenerates with the
  app's tools, snapshots and migrates the development database, and commits a checkpoint; a
  failure at any step rolls back. Undo goes through the same pipeline. It prints one line.
- ARCHITECTURE §8 draws "typecheck → tests (fast level)", but an operation runs neither. Tests
  run on `smithable test` only (`data/.smithable/test-results.json`); no browser runs.
- A destructive change stops once with what it loses (`dataImpact`, counted in the database).
  MCP adds a line when custom code uses a changed field (`customUsers`), and tells the agent not
  to verify anything. `smithable validate --json` prints `{ valid, diagnostics }`.
- `pnpm check` and `scripts/gate.sh` verify the engine, not the person's app.

So "applied" says the pipeline did not fail. It does not say which checks ran, so nobody can
tell "tested" from "not looked at", and a green word from an earlier change reads as true now.

## 2. The rule

Every change, whoever makes it (CLI, Studio, MCP, a model's proposal, an undo, a batch), has one
result with two sides: **before**, what it will do (§4); **after**, what was checked (§3).

1. A check is **passed**, **failed**, **not run**, **inconclusive** or **not configured**.
   Passed only when it ran and found what it looked for.
2. Nothing is passed by default. No tests in the app: not configured. Tests, none naming what
   changed: inconclusive. Skipped: not run. A lost browser, a timeout, a target's own model
   failing: inconclusive. A check that fails makes every later check not run, with it as reason.
3. A result belongs to one revision (the checkpoint's commit) and one environment. A later
   change starts with no check passed; nothing is inherited.
4. Each check has a kind: **deterministic** (the engine or the compiler read or wrote; none of
   the app's code ran), **unit** (the app's tests), **end-to-end** (a browser drove the app). An
   operation is never called an end-to-end test.
5. Depth is chosen, and each depth includes the one before (§3.3). The result names the depth
   that ran and why.

## 3. The result's shape

No second schema: `OperationResult` gains one optional field, `verification`, on both branches.
Core fills what it can (pure, in the browser too); the host fills the rest.

```ts
type CheckState = "passed" | "failed" | "not-run" | "inconclusive" | "not-configured";
interface Check {
  id: "spec" | "generate" | "migrate" | "data" | "typecheck" | "tests" | "browser" | "outside";
  kind: "deterministic" | "unit" | "end-to-end";
  state: CheckState;
  says: string;          // one plain sentence: "12 of 12 customers kept a phone"
  reason?: string;       // why not run, inconclusive or failed: "blocked by typecheck"
  at?: string;           // when it ran
  evidence?: { ran?: number; failed?: number; log?: string };
}
interface Verification {
  revision: string;      // the checkpoint's commit; "" before the change and on a failure
  base: string;          // the revision the change was made against (always the host's)
  environment: { where: "local" | "studio" | "hosted"; engine: string };
  depth: "change" | "tests" | "browser";
  changed: { models: string[]; fields: string[]; pages: string[]; actions: string[] };
  consequences: Consequence[];   // §4
  checks: Check[];
}
```

On `ok: false` the top-level `diagnostics` stay the authority; the failed check points at them.

### 3.1 The checks

| Check | Kind | Source today | Passed when |
|---|---|---|---|
| spec | deterministic | `validateSpec`, as `validate --json` | no error |
| generate | deterministic | `generate` with the app's tools | exit 0 |
| migrate | deterministic | the migration on the development database | applied, or none needed (said) |
| data | deterministic | non-empty values per touched column, counted before and after | equal, apart from what the change set out to remove |
| typecheck | deterministic | the app's `tsc` | exit 0 |
| tests | unit | `smithable test`, the tests `findTests` names for `changed` | ran > 0, failed = 0 |
| browser | end-to-end | a sampleusers report for this revision (§5) | the report passed |
| outside | deterministic | effects on mail, timers, integrations (§4) | never: not configured when nothing outside is touched, else not run, naming what would fire |

"Data preserved" means the counts held, and the check says so; it does not compare values. A
table with no rows passes with "no records to keep".

### 3.2 Revision, environment, failure

The host fills `base` before the change (`projectRevision`, as theme Apply's
`expectedRevision`) and `revision` after the commit. A result is kept per revision and place,
`data/.smithable/verified/<commit>-<where>.json`, local like the rest of `data/`; a deeper run
on the same revision replaces those checks with their new `at`. A result for another revision
is shown as "for an earlier version" and nothing of it carries over.

The checks up to the commit (spec, generate, migrate, data, and typecheck when asked) roll the
change back when they fail, as today; such a result has `revision: ""`, is returned and not
kept. Tests and browser run on the committed revision and never roll back: a failure is kept,
and undo is one step. No change (an Apply that writes nothing) makes no revision and no result.
Edits outside the operations (custom code in an editor) get a result from `smithable verify`
on the current revision; with uncommitted edits it verifies nothing and says why.

### 3.3 Depth

- `change` (the default everywhere): spec, generate, migrate, data, outside. Today's cost,
  plus the counts on the columns the effects name.
- `tests`: adds typecheck and the tests for `changed`. `smithable op … --verify tests`, or
  `smithable verify --depth tests` on the current revision.
- `browser`: adds a sampleusers run for the changed pages. No scenarios, or no sampleusers
  installed: the browser check is not configured.

The gate's plan (`scripts/gate.sh --plan`: phases from what changed, skipped ones named) is the
model; the gate itself stays the engine's.

## 4. Before a change: its consequences

The same `Verification`, made before Apply with `revision: ""` and every check not run, so the
before side and the after side are one object read twice. `consequences` is a list:

```ts
interface Consequence {
  about: "records" | "access" | "custom-code" | "outside";
  says: string;               // "4 of 31 orders lose their discount code"
  undo: "full" | "data-snapshot" | "none";
}
```

- **records**, from the effects: a removed field's values, a default filled into existing
  records, a choice value moved, a rename (no values lost), a required field over empty values
  (`requiredButEmpty`, still refused). The host counts with the queries `dataImpact` runs.
- **access**: who gains or loses what, from the access rules before and after (the reading
  `explain-access.md` and `answerQuestion` use): "Members can no longer see invoices".
- **custom-code**: the files in `src/custom/**` that use what changes (`customUsers`, widened
  from three operations to every effect through the index's `findImplementation`).
- **outside**: what undo cannot take back: mail or calls that start or stop firing, a timer
  newly due, an integration's settings; always `undo: none`.

Core makes records (without counts), access and custom code from the files and effects; the
host adds counts and outside. A destructive change still asks once, now with this list.

### 4.1 A plan is tied to its base

A proposal (Studio's preview, `smithable ask`, the wizard's batch) carries `base` and a hash of
its operation list. When either moves (another change landed, the person edited a step), the
consequences are made again and the preview says "The app changed since this plan was made;
this is what it will do now." Apply sends both; the host refuses when the project moved, as
theme Apply does, and the person confirms the refreshed plan with one click. The counts are
made again at Apply in any case (records change without a commit); when a destructive count
grew, the confirmation is asked again. This is A 232.

## 5. Where it shows

1. **CLI.** `smithable op … --json` prints the result. Without it: the description, then a line
   per check that is not passed ("Tests not run: smithable verify --depth tests").
2. **Studio.** One line under the preview, in a fixed order: applied or not; data; then a failed
   or inconclusive check if any, else the deepest check not run, leaving `outside` out unless
   something would fire: "Change applied. Data preserved. Browser flow not tested." The line
   opens the details (each check with state, reason and evidence; the consequences). The
   proposal preview shows the consequences above Apply, and a stale plan as §4.1. "Test it"
   runs the next depth on the same revision.
3. **MCP.** The same object as the tool result's structured content, the text beside it as now,
   and `smithable_verify`. The instructions: "The result says what was verified. Never treat a
   check that was not run as passed."
4. **sampleusers.** Reads the result (`--json` or the kept file) for the revision, `changed`
   and what is already checked; it keeps its own assertions. Its report is handed back through
   `smithable verify --record <report>`, which refuses a report for another revision and maps
   it: passed is passed, failed is failed, blocked is not run with the blocking step as reason,
   and budget exhausted, cancelled, inconclusive or any other state are inconclusive.

## 6. What it never does

- Adds nothing to the spec: a result, not a construct, so ARCHITECTURE §2.4's five questions do
  not arise.
- Calls a check passed without evidence, or carries a state across revisions or environments.
- Runs the deep checks by default, or slows an ordinary operation beyond the counts.
- Holds record values: counts and names, never a customer's data.
- Replaces `pnpm check`: the gate tests Smithable; this tells a person about their app.

## 7. Build order

1. **Core and CLI (Fable).** The types; records, access and custom-code consequences in core;
   the checks, counts and outside in `runOperation` and undo; `--json` and `--verify` on `op`;
   `smithable verify` with `--record`; the kept file; ARCHITECTURE §8 says what runs.
2. **Studio (A).** The line and its details; the consequences on the proposal preview; the
   stale plan (A 232); "Test it".
3. **MCP (Fable).** Structured content, `smithable_verify`, the instructions.
4. **sampleusers (C).** Reading the result and `changed`; handing its report back.

## 8. Open questions

1. Studio's depth after a model's change: `change` like every other, or `tests` when the app
   has tests? Recommended: `change`, with "Test it" one click away.
2. When `custom-code` lists files, should the change run `tests` by itself (the result saying
   why)? Recommended: yes, since the operation cannot see inside the code it may break.
3. On the hosted service, do browser checks run on request only, or after each deploy?
   Undecided.
