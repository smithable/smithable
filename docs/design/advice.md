# Advice in Studio: notes with the operation that does them (design)

Status: 2026-10-14, Fable, on Johan's question after his support portal build: "would it be
possible to get that kind of feedback in the Studio?" The feedback was: a model others refer to
with no list back, so its page shows none of them; a choice without a default; one field that
replaces another. Two of the three are rules; the third is judgment. This note is the rules,
built with it; the judgment is §4, later.

## 1. What people get

- **In Studio,** under the spec editor and in What it does, a third kind of line beside errors
  and warnings: a note, "SupportCase: Message refers to it, but the SupportCase page does not
  list its messages", with **Apply**. One click runs the operation the note carries, as any
  change: checked, migrated, a checkpoint, undo.
- **From the command line,** `smithable validate` prints the verdict, then the notes under
  "n notes, advice the app is fine without", each with the command that does it.
- **Nowhere else.** A note never fails validation, never stops a change, and is not printed by
  the other commands that load the spec. A spec with notes is a valid spec.

## 2. The rules

Each is deterministic, read on the whole spec once the sections parse without errors
(`packages/core/src/advice.ts`), and names the operation it proposes:

| Code | When | Does |
|---|---|---|
| `list-back` | a model refers to another exactly once and the other has no list back | `addField <Model> <plural> <Other>[]` |
| `filters-possible` | a crud page of a model with a choice field has no `filters`, and no other list of that model has them (a `mine` or favorites page is passed over) | `setFilters <page> <choices>` |
| `trash-together` | a model with a trash is required by one without, so the first cannot go to the trash | `setTrash <Other> true` |

Candidates for the next round, when a tester's app shows the need: a model with personal data
read by a role that need not; a page the kit cannot show well on a phone; a required field a
visitor's form asks for that a `by: app` default would fill (record-rules.md §1); a model with
no short text to be named by (titled by its first long text since 2026-10-14, so a note only
when that reads badly).

## 3. The shape

- `Severity` gains `note`; a `Diagnostic` may carry `fix: { op, args }`. `ParseContext.note(at,
  code, message, fix, hint?)`. The model and page key nodes are marked (`model:<Name>`,
  `page:<id>`) so a note sits on the thing it is about.
- The rules run in `validateSpec` after the sections, only when there are no errors: an invalid
  spec gets no advice, since the advice would be about a spec that is not there.
- Studio lists notes under the problems as "Worth considering", in their own colour (sky), and the editor marks them as information, never as a
  warning; Apply runs the fix through the same path as any operation (A).
- The starters carry notes today (filters on the CRM's orders and customers, lists back on the
  booking app's class types and instructors, on the status app's components). Whether a starter
  takes the advice is the starter's choice (A, backlog), and the test of the starters ignores
  notes.

## 4. Later: "What would you improve?"

The judgment half: a question on a model or the whole app through the assistant's question path
(rules, else the model with the spec, the summary and the conventions), answered as a few
suggestions, each a proposal with Apply. Cents per review with the hosted model. The notes come
first and set the floor; the question comes when the first testers ask it.

## 5. ARCHITECTURE §2.4

A note is not a DSL construct: nothing new can be written in a spec. It is the validator saying
what it already knows, with the operation that already exists.
