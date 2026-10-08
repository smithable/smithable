# Deleting a record that others point to

Design, 2026-10-08 (Fable, from Johan's test of the same day: "Arctic Outdoor Co is still in use, so nothing was deleted. It doesn't say in which way it is being used."). Status: proposed; builds on [trash.md](trash.md).

## 1. What it is

Today a record that other records point to with a required reference (`customer: Customer!`) cannot be deleted or trashed: the app says it is still in use and nothing else. The person does not learn what uses it, how much, or what to do. With this, deleting such a record asks once, with the facts, and offers to move it to the trash together with what cannot exist without it:

> Move Arctic Outdoor Co to the trash? 3 orders and 12 order lines go with it; they are restored together. 5 notes will show no customer.
> [Move all to the trash] [Cancel]

No new grammar: everything follows from `trash: true` and the references the spec already has. A model without a trash keeps today's refusal, now with the same facts, and a hint to turn the trash on.

## 2. Rules

- **Required references go together.** A record that points to the deleted one with a required reference cannot exist without it, so it goes to the trash with it, and so on down (an order's lines with the order). The dialog counts them by model, two levels deep by name and the rest as "and what belongs to them".
- **Optional references stay.** A record with an optional reference (`customer: Customer`) is not trashed: it shows a dash while the target is in the trash, as today, and the dialog says how many will ("5 notes will show no customer").
- **A group restores together.** The records trashed with one are marked as its group (`deleted_with`: the root's model and id). Restoring the root restores the group; the trash shows the group as one row, "Arctic Outdoor Co and 15 records", with the members listed under it. A member cannot be restored alone while its root is in the trash ("Restore the customer first"); one trashed on its own before is not in the group and is unaffected.
- **Removed for good together.** Emptying the trash or removing the root for good removes the group; thirty days count from the root's deletion for all of it.
- **Only into a trash.** The offer to take the referrers along exists only when the root and every model in the group have `trash: true`; a cascade that cannot be undone is never offered. Otherwise the delete is refused with the same facts: "Arctic Outdoor Co is used by 3 orders and 12 order lines, so it cannot be deleted. Turn the trash on for customers, orders and order lines to delete them together."
- **Bulk deletes** add the counts up over the selected records; one dialog.
- **Rights:** the person must have the delete right on every model in the group, else the refusal names the model they cannot delete.
- **Events and the log:** `deleted` fires for every record in the group; the activity log says "trashed with Arctic Outdoor Co" on the members, and "restored with …" on restore.

## 3. REST and the tools

- `DELETE /api/v1/<models>/{id}` of a record others point to answers 409 with the counts by model and the two options; `DELETE …/{id}?together=true` trashes the group and answers 204. `POST …/{id}/restore` on a root restores the group; on a member while the root is in the trash, 409 naming the root.
- The remove tool answers the same facts and takes `together: true`; the assistant is told to ask the person before passing it.

## 4. Steps

1. Core: the IR already lists each model's referrers and whether each reference is required; a small helper gives the group's models for a root (the transitive required referrers), used by the generator and tested.
2. Adapter and kit: the `deleted_with` column beside `deleted_at`; the counts query (one per referring relation, over live records) behind the delete dialog and the 409; the trash of the group in one transaction; the group row in the Trash view and the restore rule; the words in en and sv; the CRM starter exercises it (a customer with orders); test-apps: the dialog's counts, the group in the trash, restore together, the refused lone restore, the refusal without a trash, the API's 409 and `together`.
3. Spec reference and the trash note: one paragraph each.

Fable builds it (A has Johan's six kit items of the same day); about a day.
