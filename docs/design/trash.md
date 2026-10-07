# Trash with restore

Design, 2026-10-06 (Fable; Johan's go the same day: "Ok, do this"). Status: core built (`trash: true`, `setTrash`); the adapter part is A's (§5).

## 1. What it is

Today a delete is a delete, and only Studio's undo brings a record back, which does not help the person using the published app. With `trash: true` on a model, deleting a record moves it to a trash for thirty days, where whoever may delete it can restore it or remove it for good. To the rest of the app the record is gone at once.

```yaml
models:
  Customer:
    trash: true
    fields: …
```

## 2. How it works

- **Storage:** two hidden columns on the model's table, `deleted_at` and `deleted_by`. Deleting sets them; restoring clears them. Every reader skips rows with `deleted_at` set: lists and record pages, counts and dashboards, the calendar, the blog, the sitemap, the API, the tools, the outgoing mail's "who to tell". Partial indexes (`WHERE deleted_at IS NULL`) on the live rows keep every query over live records as fast as without a trash; a unique value is unique among the live records only (a partial unique index).
- **Who:** restoring and removing for good follow the model's delete rule, so in a private app a person sees only their own trash. The activity log gets three lines: trashed, restored, removed.
- **Emptying:** a daily job removes what has been trashed for thirty days, uploads included; Empty trash does it at once for the records shown.
- **Uniqueness:** a unique value holds among the live records only, so a value a trashed record has can be used again (an email after its customer was deleted; the same session booked again after a cancellation). Restore is refused when a live record has taken the value since, with the words a new record gets ("Another customer already has this email."); the trash row says so. (Changed 2026-10-06, from C's review of #414: a trashed record kept its values before.)
- **References:** a record that other records point to with a restricting reference cannot be trashed, as it cannot be deleted today. One with a nullable reference can: the referrers show a dash while it is in the trash, and the reference is cleared only when the trash is emptied.
- **Outgoing:** the `deleted` event fires when a record is trashed, since that is when it leaves the app; emptying the trash mails nobody.
- **Turning it off** (`setTrash Customer false`) removes what is in the trash for good and asks first, saying how many.

## 3. In the app

- The Delete button reads "Move to trash"; the notice says "Moved to trash" with Undo, a restore on the spot.
- A list page gets a Trash view for people with the delete right, beside the table and cards views: the trashed records with when and by whom, Restore per row, Restore and Delete permanently in the selection bar, and Empty trash with a confirmation that names the count.
- A trashed record opened by its link is read-only with a banner: in the trash since Tuesday, by Anna, removed on 5 November, with Restore.

## 4. REST and the tools

- `DELETE /api/v1/<models>/{id}` moves to the trash (204, as today). `GET …/{id}` of a trashed record answers 410 Gone with when, by whom and the restore address. `GET /api/v1/<models>?trashed=true` lists the trash for a key whose role may delete. `POST …/{id}/restore` restores and answers the record. `DELETE …/{id}?permanent=true` removes it for good. The OpenAPI description carries all of it.
- The tools: find takes `trashed: true`; remove trashes; restore is a built-in action on trashed records through the run tool. Seven tools stay seven.

## 5. Steps

1. Core (done 2026-10-06): `trash` on a model, `setTrash` (destructive when turned off), the summary line, the schema, the spec reference; the generator refuses a trashed model until step 2, and drafts do not propose it.
2. Adapter (A): the columns and partial indexes in the schema and migration; the readers' filter in the data module (one place: `list`, `get`, counts) and the API, tools, sitemap and articles that go through it; the Trash view, the notice's Undo, the banner; the routes; the daily job and the uploads; the three audit lines; words in en and sv; the CRM starter's Customer and Order with `trash: true`; test-apps: delete, trash view, restore, the 410, permanent removal, the refused restore; the API page. Then remove the generator's refusal and `setTrash` from NOT_FOR_DRAFTS.
3. Later, when asked: a trash across models on the data page; a longer retention as a setting.

## 6. The five questions (ARCHITECTURE §2.4)

1. Common: the most common "oh no" in a business app.
2. Deterministic: a flag, two columns, one filter.
3. Less ambiguity: "soft delete" by hand is where access rules leak (a trashed record still found by a search).
4. Technology-neutral: a model key; the adapter decides the columns.
5. Better than custom code: every reader has to agree, which only the generator can guarantee.
