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
Generated 174 files (9 changed, 0 removed).
Add field severity (minor | major | critical) to Incident. Undo with: smithable undo
```

A choice field: the incident form has a new select, the incidents list a new column, and a database migration adds the column. Existing incidents get the first value, `minor`, as their severity.

## 2. Show only some records on the front page

The front page's "Going on now" lists the incidents that are not resolved. Make it list only the serious ones:

```console
$ smithable op setSectionWhere home open "status=investigating | identified | monitoring" "severity=major | critical"
Generated 174 files (1 changed, 0 removed).
Show in the open section of home only records where status is investigating or identified or monitoring and severity is major or critical. Undo with: smithable undo
```

`home` is the page, `open` is its section, and each `field=values` pair narrows the list further. Every incident is `minor` after change 1, so "Going on now" is empty until an incident is marked major or critical in its form.

## 3. Let visitors read only some records

The starter lets everyone on the internet read incidents in all four states, the ones the team is still investigating too. Keep those to the team until the cause is known:

```console
$ smithable op setPublicWhere Incident "status=identified | monitoring | resolved"
Generated 174 files (2 changed, 0 removed).
Let visitors read only Incident records where status is identified or monitoring or resolved. Undo with: smithable undo
```

This is an access rule, so it holds everywhere a visitor can reach an incident: the front page, the history page and the incident's own page. Signed-in staff still see them all. In `smithable.auth.yml` the incidents' public read now names three states instead of four.

## 4. Change the look

Give the page the company's color:

```console
$ smithable op setTheme --primary "#0f766e"
Generated 174 files (1 changed, 0 removed).
Set the look: primary color #0f766e. Undo with: smithable undo
```

The color is adjusted until text on it is readable, and the theme's other colors follow it. `--preset`, `--font`, `--background`, `--density` and `--motion` (none, subtle or lively; a visitor's "reduce motion" setting always wins) change the rest of the look; nothing else in the app changes.

## 5. Undo

```console
$ smithable undo
Undid: Set the look: primary color #0f766e. The dev database is back as it was before.
Restart the dev server if it is running.
```

Each change is a Git commit, so `git log` lists them, and `smithable undo` takes back the last one, database included. Run it again to go further back. `smithable undo --change <id>` takes back an earlier change by its id (from `git log`, or the X on a change in Studio) as a new change, as long as no later change depends on it. If one does (say, a page that shows a kind of record the change added), undo names that later change, and you undo it first. `smithable undo --change <id> --check` only tells you whether it is safe.

## In your own words

The same changes can be asked for in a sentence. `smithable ask` shows the operation it would run and applies it with `--yes`; built-in wording rules understand many sentences without a model, and the rest go to the model you set up ([AI setup](../ai.md)). `smithable op` lists every operation, `smithable op <name> --help` explains one, and the [operations reference](operations.md) describes them all, with their arguments and an example.
