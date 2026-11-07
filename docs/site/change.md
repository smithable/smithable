# Change an app without writing code

Four changes to a status page and an undo, each one command. Every command here was run on a fresh app, and the output is what it printed. Each change is checked, regenerates the code, migrates the database and commits a checkpoint, so `smithable undo` takes it back.

Start from the status starter:

```sh
smithable new status-page --starter status
cd status-page
smithable studio      # the app and Studio in the browser, to watch the changes land
```

The starter is a status page for a company called Northwind: services with their state, incidents that move from investigating to resolved with a timeline of updates, and planned maintenance, all on a public page.

## 1. Add a field

Incidents get a severity:

```console
$ smithable op addField Incident severity "minor | major | critical"
Generated 182 files (9 changed, 0 removed).
Add field severity (minor | major | critical) to Incident. Undo with: smithable undo
Not checked: type check, tests, browser flow. Run smithable verify --depth tests.
```

A choice field: the incident form has a new select, the incidents list a new column, and a database migration adds the column. Existing incidents get the first value, `minor`, as their severity.

## 2. Show only some records on the front page

The front page's "Going on now" lists the incidents that are not resolved. Make it list only the serious ones:

```console
$ smithable op setSectionWhere home open "status=investigating | identified | monitoring" "severity=major | critical"
Generated 182 files (1 changed, 0 removed).
Show in the open section of home only records where status is investigating or identified or monitoring and severity is major or critical. Undo with: smithable undo
Not checked: type check, tests, browser flow. Run smithable verify --depth tests.
```

`home` is the page, `open` is its section, and each `field=values` pair narrows the list further. Every incident is `minor` after change 1, so "Going on now" is empty until an incident is marked major or critical in its form.

## 3. Let visitors read only some records

The starter lets everyone on the internet read incidents in all four states, the ones the team is still investigating too. Keep those to the team until the cause is known:

```console
$ smithable op setPublicWhere Incident "status=identified | monitoring | resolved"
Generated 182 files (2 changed, 0 removed).
Let visitors read only Incident records where status is identified or monitoring or resolved. Undo with: smithable undo
Not checked: type check, tests, browser flow. Run smithable verify --depth tests.
```

This is an access rule, so it holds everywhere a visitor can reach an incident: the front page, the history page and the incident's own page. Signed-in staff still see them all. In `smithable.auth.yml` the incidents' public read now names three states instead of four.

## 4. Change the look

Give the page the company's color:

```console
$ smithable op setTheme --primary "#0f766e"
Generated 182 files (1 changed, 0 removed).
Set the look: primary color #0f766e. Undo with: smithable undo
Not checked: type check, tests, browser flow. Run smithable verify --depth tests.
```

The color is adjusted until text on it is readable, and the theme's other colors follow it. `--preset`, `--font`, `--background`, `--density` and `--motion` (none, subtle or lively; a visitor's "reduce motion" setting always wins) change the rest of the look; nothing else in the app changes.

## 5. Undo

```console
$ smithable undo
Undid: Set the look: primary color #0f766e. The dev database is back as it was before.
Restart the dev server if it is running.
```

Each change is a Git commit, so `git log` lists them, and `smithable undo` takes back the last one, database included. Run it again to go further back. `smithable undo --change <id>` takes back an earlier change by its id (from `git log`, or the X on a change in Studio) as a new change, as long as no later change depends on it. If one does (say, a page that shows a kind of record the change added), undo names that later change, and you undo it first. `smithable undo --change <id> --check` only tells you whether it is safe.

## 6. What was checked

Every change says what was checked and what was not. A change checks the spec, regenerates the app, migrates the database and counts the values of every column it touches before and after; a value lost that the change did not set out to remove rolls it back. The app's type check and tests are not run by a change unless asked: `smithable verify --depth tests` runs them on the current version (or `--verify tests` on the change itself), the tests that name what changed:

```console
$ smithable verify --depth tests
8cce4c6b6229 (local), depth tests:
  Spec: passed. The spec and its companion files have no errors.
  Generate: passed. The app was regenerated with its tools.
  Migration: passed. No migration was needed: the database's shape did not change.
  Data: passed. No stored values were touched.
  Type check: passed. The app's type check passed.
  Tests: passed. 43 of 43 tests passed.
  Browser flow: not run (Not part of depth tests: run smithable verify --depth browser.)
  Outside the app: not configured. Nothing outside the app is touched.
```

A check is passed only when it ran and found what it looked for: an app without tests says "not configured", tests that do not name what changed say "inconclusive", and nothing a check said about one version carries over to the next. `--json` (on `verify` and on `op`) prints the whole result: the version, what changed, the consequences (records, access, custom code, mail and calls) and each check with its state and reason. The result is kept in `data/.smithable/verified/`, one file per version. With uncommitted edits, `verify` checks nothing and says why. Browser checks are not run yet; a browser test run's report for the version it ran on is taken in with `smithable verify --record <report>`.

## In your own words

The same changes can be asked for in a sentence. `smithable ask` shows the operation it would run and applies it with `--yes`; built-in wording rules understand many sentences without a model, and the rest go to the model you set up ([AI setup](../ai.md)). `smithable op` lists every operation, `smithable op <name> --help` explains one, and the [operations reference](operations.md) describes them all, with their arguments and an example.
