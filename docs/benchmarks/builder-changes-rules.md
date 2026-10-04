# Builder changes that reach a model (2026-10-04)

12 requests as people type them into Builder's Describe box, on fresh copies of the starters, through `smithable ask --yes` ([scripts/bench-changes.mjs](../../scripts/bench-changes.mjs)). The wording rules (tier 0) read none of them (`--rules` run). Each outcome is checked in the spec files the change leaves: *right* is what the request means; *wrong* is a change that is not it; *no change* is a refusal or a question back. 2 requests ask for what the spec cannot express (access by a value); for those, no change is right.

| Model | Right | Wrong | No change | Read by a rule | Tokens | Cost | Time |
|---|---|---|---|---|---|---|---|
| rules | 2 / 12 | 0 | 10 | 0 | 0 | $0.0000 | 7 s |

## The requests

| # | Starter | Request | Right means |
|---|---|---|---|
| 1 | crm | Customers should also have a VAT number, and I want to see it in the list. | a VAT field on Customer, among the customers list's columns |
| 2 | crm | We sell to people too, not only companies, so customers need a first name and a last name. | first and last name fields on Customer |
| 3 | crm | Every order should belong to the salesperson who handles it, and only that person may change it. | a User field on Order that owns it, and write: [owner] |
| 4 | crm | Orders are what we look at most: put them first in the menu and call them Sales. | orders first in the navigation, labelled Sales in the content file |
| 5 | crm | Only admins should see orders over 10 000 €. | no change: access cannot depend on a value |
| 6 | invoicing | Our invoices should show the VAT too, which is 25 % of the total. | a computed field on Invoice from the total and 25 % |
| 7 | invoicing | Clients need a phone number, it's optional, and I want to find clients by it. | an optional phone field on Client, in the clients page's search |
| 8 | invoicing | Nobody should be able to delete an invoice once it has been sent. | no change: deleting cannot depend on the status |
| 9 | status | Only our team posts incidents; everyone else just reads them. | creating incidents for staff (and admins) only |
| 10 | status | Make the home page say what we do: we keep the Pulse payment API running around the clock. | the landing page's texts mention Pulse |
| 11 | booking | Classes happen in Studio 1 or Studio 2, so each session should say which. | a choice field on Session with both studios |
| 12 | booking | We say teachers, not instructors. | Instructor renamed to Teacher, or labelled Teacher(s) |

## Each answer

| Request | Model | Outcome | Tokens | Cost | Time | What it said (first lines) |
|---|---|---|---|---|---|---|
| vat-in-list | rules | **no change** | 0 | $0.0000 | 0 s | No model was used No model is available under the AI policy. Set up a local model or the Smithable model, or change the policy. |
| first-last-name | rules | **no change** | 0 | $0.0000 | 1 s | No model was used No model is available under the AI policy. Set up a local model or the Smithable model, or change the policy. |
| owner-of-order | rules | **no change** | 0 | $0.0000 | 1 s | No model was used No model is available under the AI policy. Set up a local model or the Smithable model, or change the policy. |
| orders-first-as-sales | rules | **no change** | 0 | $0.0000 | 1 s | No model was used No model is available under the AI policy. Set up a local model or the Smithable model, or change the policy. |
| big-orders-admins-only | rules | right | 0 | $0.0000 | 1 s | No model was used No model is available under the AI policy. Set up a local model or the Smithable model, or change the policy. |
| vat-amount | rules | **no change** | 0 | $0.0000 | 1 s | No model was used No model is available under the AI policy. Set up a local model or the Smithable model, or change the policy. |
| client-phone-search | rules | **no change** | 0 | $0.0000 | 1 s | No model was used No model is available under the AI policy. Set up a local model or the Smithable model, or change the policy. |
| no-delete-sent | rules | right | 0 | $0.0000 | 0 s | No model was used No model is available under the AI policy. Set up a local model or the Smithable model, or change the policy. |
| staff-posts | rules | **no change** | 0 | $0.0000 | 0 s | No model was used No model is available under the AI policy. Set up a local model or the Smithable model, or change the policy. |
| home-says-what | rules | **no change** | 0 | $0.0000 | 1 s | No model was used No model is available under the AI policy. Set up a local model or the Smithable model, or change the policy. |
| room-choice | rules | **no change** | 0 | $0.0000 | 0 s | No model was used No model is available under the AI policy. Set up a local model or the Smithable model, or change the policy. |
| teachers-not-instructors | rules | **no change** | 0 | $0.0000 | 0 s | No model was used No model is available under the AI policy. Set up a local model or the Smithable model, or change the policy. |

The apps are in /tmp/smithable-bench-changes-IxvG40.
