# Deleting a record that others point to

Design, 2026-10-08 (Fable, from Johan's test of the same day: "Arctic Outdoor Co is still in use, so nothing was deleted. It doesn't say in which way it is being used."). Status: built the same day (§2–§4 say how); builds on [trash.md](trash.md).

## 1. What it is

Today a record that other records point to with a required reference (`customer: Customer!`) cannot be deleted or trashed: the app says it is still in use and nothing else. The person does not learn what uses it, how much, or what to do. With this, deleting such a record asks once, with the facts, and offers to move it to the trash together with what cannot exist without it:

> Move Arctic Outdoor Co to the trash? 3 orders and 12 order lines go with it; they are restored together. 5 notes will show no customer.
> [Move all to the trash] [Cancel]

No new grammar: everything follows from `trash: true` and the references the spec already has. A model without a trash keeps today's refusal, now with the same facts, and a hint to turn the trash on.

## 2. Rules

- **Required references go together.** A record that points to the deleted one with a required reference cannot exist without it, so it goes to the trash with it, and so on down (an order's lines with the order). Core's `trashGroup(ir, model)` gives the group's models as edges (model, field, from, depth), each edge once, so a cycle ends; `looseReferrers` gives the optional ones. The dialog counts the live records by model: those that point to the root directly, and those one join away; deeper models are named as "and what belongs to them".
- **Optional references stay.** A record with an optional reference (`customer: Customer`) is not trashed: it shows a dash while the target is in the trash, as today, and the dialog says how many will ("5 notes will show no customer").
- **A group restores together.** The records trashed with one are marked as its group: `deleted_with` holds the root's model and id ("Customer:12"), and they get the root's `deleted_at` and `deleted_by`. Restoring the root restores the group. The trash shows a root with members as "and 15 records" and a member as "with Arctic Outdoor Co", without Restore of its own. A member cannot be restored alone while its root is in the trash ("Restore the customer “Arctic Outdoor Co” first"); one trashed on its own before is not in the group and is unaffected.
- **Removed for good together.** Removing the root for good removes what is in the trash pointing to it first, deepest first; thirty days count from the root's deletion for all of it, and the daily emptying goes through the models in the order they point to each other.
- **Only into a trash.** The offer to take the referrers along exists only when the root and every model in the group have `trash: true`; a cascade that cannot be undone is never offered. Otherwise the delete is refused with the same facts: "Arctic Outdoor Co is used by 3 orders and 12 order lines, so it cannot be deleted. Turn the trash on for customers, orders and order lines to delete them together."
- **Bulk deletes:** the first record refused gives its facts; the one dialog then offers to move the whole selection to the trash with what points to it.
- **Rights:** the person must have the delete right on every record in the group, else the refusal names the model they cannot delete and nothing is moved.
- **Events and the log:** `deleted` fires for every record in the group; the activity log's "trashed" and "restored" lines on the members carry the root (`with: "Customer:12"`).
- **The refusal** is one code the kit and the API read: `in-use:` followed by the facts as JSON (`id`, `title`, `model`, `label`, `with`, `loose`, `together`, `missing`); a member restored alone answers `restore-root-first:<label>:<title>`, a missing right `no-right:<label>`.

## 3. REST and the tools

- `DELETE /api/v1/<models>/{id}` of a record others point to answers 409 with the facts in the body (`with`, `loose`, `together`, `missing`, the record's title as `record`) and a title that says what to do; `DELETE …/{id}?together=true` trashes the group and answers 204. `POST …/{id}/restore` on a root restores the group; on a member while the root is in the trash, 409 naming the root. `?permanent=true` on a root removes the group. The OpenAPI description says so under DELETE.
- The delete tool answers the same facts in words and takes `together: true`; its description tells the assistant to ask the person before passing it.

## 4. Steps

1. Core: `trashGroup` and `looseReferrers` (`packages/core/src/trash-group.ts`), tested.
2. Adapter and kit: the `deleted_with` column beside `deleted_at`; `usedBy` in a root's data module (the counts, over live records) behind the delete dialog and the 409; the group trashed in the root's transaction through each member's `trashWith`, restored through `restoreWith`, erased through the members' `erase`, deepest first; the daily emptying in one generated `trash.server.ts`; `Together.tsx` (the facts and the dialog) used by the form and the selection bar; the Trash view's group column; the words in en and sv; the CRM starter exercises it (a customer with orders); test-apps: the dialog, the group in the trash, the refused lone restore, restore together, and through the API (the api example, with Task, Project and Note in a trash) the 409 with the facts, `together`, the lone restore and the removal for good.
3. Spec reference and the trash note: one sentence each.

Fable builds it (A has Johan's six kit items of the same day); about a day.
