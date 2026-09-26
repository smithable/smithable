# M7, setup C: a prompt-to-code builder (manual protocol)

The same seven tasks as [the automated benchmark](m7.md), done in a prompt-to-code builder such as Lovable. It needs a paid account and a person at the keyboard, so it is run by hand and the results are added to `m7.md`.

## Before starting

- Note the builder, its plan and the date. Use the builder's default model and settings.
- Note the credit balance before each prompt.
- Keep a screen recording, or at least a screenshot after every task.

## Step 0: the starting app

Give the builder this prompt, then fix nothing by hand:

> Build a small CRM for a B2B sales team called Acme CRM, in euros. People sign in with Google. There are two roles: admin (sales management) and sales. Customers have a required name, a unique email, a segment (small business, enterprise or government; default small business) and notes. There is one page, Customers, where signed-in users can list, view, create, edit and delete customers. Add eight example customers.

Record what it produced and anything it could not do (for example Google sign-in without setup). If it cannot reach a comparable starting point, stop and record that.

## Steps 1–7

Give each task as a separate prompt, followed by: "Keep the app working: update whatever is needed (database, forms, tables)."

1. Customers should have a phone number.
2. The customer email should be required.
3. Add orders: each order has a number, belongs to a customer and has a total amount.
4. Add a page for orders, and show it in the menu.
5. Only admins may delete customers.
6. Make it possible to search customers by name on the customers page.
7. Show Orders first in the menu.

## After each task, record

| Measure | How |
|---|---|
| Credits used | The balance difference; convert to money with the plan's price per credit |
| Wall time | From sending the prompt until the preview works |
| Follow-up prompts | Every extra prompt needed to get it right (each is "human intervention") |
| Task done | Check it in the preview, as the automated checks do: the field or page is there; for task 5, sign in as a sales user and try to delete a customer (it must fail), then as an admin (it must work); for task 6, search "Nordic" and see only matching customers |
| Regressions | Re-check every earlier task: does it still work? Are the example customers still there? |
| Files touched | From the builder's code view or its GitHub export, if available |
| Data kept | Were existing customers kept when the database changed? |

## Results

Add a row per task to the per-task table in `m7.md` with "Done by: \<builder\>", and a line to the totals. Note anything the protocol could not measure.
