# Where a value is unique

Status: decided 2026-10-21 (Phase 1 of the spec plan); built in core and the adapter; Studio's forms follow (A).

## 1. The problem

`unique` on a field meant two things, decided by the auth file: unique among one owner's records when the model's records are read by their owners only, else unique in the whole app (`uniquePerOwner` in core's access.ts). The word in `smithable.yml` did not say which, and a change of roles or public pages moved a database index without anyone writing a change to the model. Two fields could not be unique together at all (a customer's invoice numbers), and a number counting up had no index.

## 2. The shape

- A field's `unique` is `true | false | owner | app`. `true` keeps today's meaning, read from the access; `owner` and `app` say it outright. The short form `email unique` stays.
- A model's `unique` lists fields unique together: `[[customer, number]]`, or `{ fields: [customer, number], scope: app }` to say where. Two or more stored fields (no computed fields, pictures, files or lists), none unique by itself.
- A number counting up (`sequence: true`) is unique by its nature, in its `unique` scope or the access's; its counter has the same scope (orders.md §4).
- `owner` without sign-in is an error (`unique-owner-no-sign-in`): there is no owner to be unique per.
- The IR keeps the word as written (`FieldIR.unique`, `ModelIR.unique[].scope`); one function, `uniqueScope(unique, model, auth)`, resolves it for the adapter's indexes and the sequence counters. The adapter writes a column constraint for an app-wide value, an index over the owner and the field(s) for a per-owner one, and with a trash an index over the live records (trash.md §2).

## 3. Written out once

`smithable upgrade` writes the short form out as `unique: owner` or `unique: app` (and a scope into every rule without one), as the access reads it at that moment (`writeUniqueScopes` in core). After that the spec says what the database does, and a later change of roles changes no index. New specs may keep the short form; a starter's `email unique` is fine until its app is upgraded. This follows Johan's rule of 2026-10-21: a default may be inferred from the spec's shape and is then an implicit setting, but everything is explicitly sayable, and where a change of the inference's input would move data or access, the inferred word is frozen.

## 4. Operations and Studio

`setFieldRules <model> <field> --unique true|false|owner|app` (the shorthand's `unique` moves into the key when a scope is written, and back when it is `true` alone); `setUnique <model> <field…> [--scope owner|app]`, `--remove`. The summary says "unique per owner", "unique in the whole app", and "No two invoices have the same customer and number". Studio: the field form's Unique box becomes a choice, and a model form adds rules (backlog A 128).

## 5. Not done, on purpose

- **Duplicates on a scope change.** Narrowing nothing, widening a scope (owner → app) or adding a rule can find existing duplicates; today the next `smithable generate` runs the index migration and the database refuses it with its own message. A check that reads the records before the change and names the duplicates belongs with the other data-aware refusals (changeField's values) when the operation layer can read records; until then the spec reference says to check first.
- A per-role scope or a conditional uniqueness: no app has asked.
- The form's "taken" message names one field; for fields unique together it is the last of them (the kit reads the database's constraint message), which is right often enough until a form shows the pair.
- `smithable upgrade` rewrites a model's whole `unique` list when any rule lacks a scope, so a comment inside that list does not survive it; comments on the fields do.
- An index's name is the table's and the fields' names joined; two rules whose joined names collide (a field `customer_number` beside the pair `[customer, number]`, with a trash) would clash in SQLite, which the migration reports.

## 6. ARCHITECTURE §2.4

1. **Common:** every app with numbers, codes or names that must not repeat; every multi-tenant one has per-owner uniqueness.
2. **Deterministic:** a word and an index; no model.
3. **Less AI and ambiguity:** "unique" that depends on the auth file is exactly what a model or a person guesses wrong.
4. **Technology-neutral:** two words on a field, a list on a model.
5. **Better than free text and custom code:** the index, the form's "taken" message, the sequence's counter and the summary read one word.
