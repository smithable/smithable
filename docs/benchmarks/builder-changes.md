# Builder changes that reach a model (2026-10-04)

12 requests as people type them into Builder's Describe box, on fresh copies of the starters, through `smithable ask --yes` ([scripts/bench-changes.mjs](../../scripts/bench-changes.mjs)). The wording rules (tier 0) read none of them (`--rules` run). Each outcome is checked in the spec files the change leaves: *right* is what the request means; *wrong* is a change that is not it; *no change* is a refusal or a question back. 2 requests ask for what the spec cannot express (access by a value); for those, no change is right.

| Model | Right | Wrong | No change | Read by a rule | Tokens | Cost | Time |
|---|---|---|---|---|---|---|---|
| eu.anthropic.claude-sonnet-4-6 | 10 / 12 | 2 | 0 | 0 | 261,756 | $0.5597 | 56 s |
| eu.anthropic.claude-haiku-4-5-20251001-v1:0 | 6 / 12 | 3 | 3 | 0 | 314,870 | $0.2194 | 130 s |
| mistral-medium-latest | 9 / 12 | 2 | 1 | 0 | 175,203 | $0.2779 | 144 s |
| mistral-small-latest | 5 / 12 | 5 | 2 | 0 | 154,582 | $0.0240 | 56 s |

## What it says (C, 2026-10-04)

- **Sonnet 4.6 (Bedrock, EU) does the most right: 10 of 12**, in 3 to 9 s, $0.047 a change. Its two misses: an order "belonging to the salesperson" got a salesperson field and `write: [owner]` but not `ownedBy: salesperson`, so the owner is still whoever created it; and "only our team posts incidents" (already true: invite-only, public reading) got an unrelated `delete: [admin, staff]`.
- **Mistral Medium: 9 of 12**, $0.023 a change, 5 to 17 s. Same ownership miss, and on the status page it changed the incidents' access *and removed the app's public listing* (Component, Incident, IncidentUpdate, Maintenance): the one change in the run that breaks a working app. It tried a `renameModel` that does not exist for "teachers, not instructors" and stopped.
- **Haiku 4.5: 6 of 12**, $0.018 a change but the slowest (7 to 15 s): half done (first name without last name), over-restricted (all orders admin-only for "orders over 10 000"), asked back once, and twice proposed operations the validator refused.
- **Mistral Small: 5 of 12**, $0.002 a change: right about the simple ones, half done on two-part requests (the field without the list column or the search), and renamed fields where a label was meant.
- Both requests the spec cannot express (access by a value): Sonnet and Medium changed nothing (right); Haiku and Small made all orders admin-only.
- Nothing here was read by a wording rule, so these are what reaches a model in Builder. Cost per change is small for all four; what differs is being right. **For changes in Builder, Sonnet 4.6 is the one to serve**; Medium is the EU-owned fallback but needs a guard against access changes nobody asked for.

The judgement is mechanical (the checks in the script); every "wrong" and "no change" above was read in the spec diff and agrees with it. A run is rescored with `--score <apps dir>` after a check is corrected (this one was: a room field's name pattern also matched `placesLeft`, and the status page's "only our team posts" is already true, so no change is right there).

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
| 9 | status | Only our team posts incidents; everyone else just reads them. | creating incidents for staff (and admins) only; already so (invite-only, public reading), so no change is right too |
| 10 | status | Make the home page say what we do: we keep the Pulse payment API running around the clock. | the landing page's texts mention Pulse |
| 11 | booking | Classes happen in Studio 1 or Studio 2, so each session should say which. | a choice field on Session with both studios |
| 12 | booking | We say teachers, not instructors. | Instructor renamed to Teacher, or labelled Teacher(s) |

## Each answer

| Request | Model | Outcome | Tokens | Cost | Time | What it said (first lines) |
|---|---|---|---|---|---|---|
| vat-in-list | eu.anthropic.claude-sonnet-4-6 | right | 17,647 | $0.0683 | 4 s | Proposed change:   1. Add field vatNumber (string) to Customer   2. Show name, email, phone, vatNumber, segment, creditLimit, accountManager in the customers table Add field vatNumber (string) to Customer. Undo with: smi |
| first-last-name | eu.anthropic.claude-sonnet-4-6 | right | 24,066 | $0.0702 | 6 s | Proposed change:   1. Rename Customer.name to firstName   2. Change Customer.firstName to string!   3. Add field lastName (string) to Customer |
| owner-of-order | eu.anthropic.claude-sonnet-4-6 | **wrong** | 17,494 | $0.0311 | 4 s | Proposed change:   1. Add field salesperson (User) to Order   2. Only the owner may write orders   3. Only admin may delete orders |
| orders-first-as-sales | eu.anthropic.claude-sonnet-4-6 | right | 17,478 | $0.0308 | 3 s | Proposed change:   1. Set the main menu to orders, customers, team   2. Change the text pages.orders.title to "Sales" Set the main menu to orders, customers, team. Undo with: smithable undo |
| big-orders-admins-only | eu.anthropic.claude-sonnet-4-6 | right | 17,467 | $0.0307 | 4 s | No operation can do this: No operation can do this. Access rules in Smithable are set by role on a whole model or action — there is no way to restrict visibility to records matching a condition (e.g. total > 10 000). Fil |
| vat-amount | eu.anthropic.claude-sonnet-4-6 | right | 12,081 | $0.0228 | 3 s | Proposed change:   1. Add field vat (money = total * 0.25) to Invoice Add field vat (money = total * 0.25) to Invoice. Undo with: smithable undo |
| client-phone-search | eu.anthropic.claude-sonnet-4-6 | right | 17,469 | $0.0307 | 4 s | Proposed change:   1. Add field phone (phone) to Client   2. Search clients by phone Add field phone (phone) to Client. Undo with: smithable undo |
| no-delete-sent | eu.anthropic.claude-sonnet-4-6 | right | 17,516 | $0.0304 | 3 s | Proposed change:   1. Let the default access decide who may delete invoices Let the default access decide who may delete invoices. Undo with: smithable undo |
| staff-posts | eu.anthropic.claude-sonnet-4-6 | **wrong** | 35,151 | $0.0631 | 6 s | Proposed change:   1. Only admin and staff may write incidents   2. Only admin and staff may delete incidents Only admin and staff may write incidents. Undo with: smithable undo |
| home-says-what | eu.anthropic.claude-sonnet-4-6 | right | 15,400 | $0.0588 | 3 s | Proposed change:   1. Change the text pages.home.hero.subtitle to "We keep the Pulse payment API running around the clock." Change the text pages.home.hero.subtitle to "We keep the Pulse payment API running around the cl |
| room-choice | eu.anthropic.claude-sonnet-4-6 | right | 35,030 | $0.0609 | 7 s |  |
| teachers-not-instructors | eu.anthropic.claude-sonnet-4-6 | right | 34,957 | $0.0619 | 9 s | Proposed change:   1. Change the text models.Instructor.label to "Teacher"   2. Change the text pages.instructors.title to "Teachers" Change the text models.Instructor.label to "Teacher". Undo with: smithable undo |
| vat-in-list | eu.anthropic.claude-haiku-4-5-20251001-v1:0 | right | 17,642 | $0.0227 | 14 s | Proposed change:   1. Add field vatNumber (string) to Customer   2. Show name, vatNumber, email, phone, segment in the customers table Add field vatNumber (string) to Customer. Undo with: smithable undo |
| first-last-name | eu.anthropic.claude-haiku-4-5-20251001-v1:0 | **wrong** | 23,991 | $0.0231 | 15 s | Proposed change:   1. Add field firstName (string) to Customer   2. Change Customer.name to string Add field firstName (string) to Customer. Undo with: smithable undo |
| owner-of-order | eu.anthropic.claude-haiku-4-5-20251001-v1:0 | **no change** | 17,543 | $0.0106 | 7 s | To make each order belong to a specific salesperson who alone may change it, I need to clarify: should the salesperson be stored as a field on the Order model (like a "salesperson" or "assignedTo" reference to User), or |
| orders-first-as-sales | eu.anthropic.claude-haiku-4-5-20251001-v1:0 | right | 35,058 | $0.0207 | 11 s | Proposed change:   1. Set the main menu to orders, customers, team   2. Change the text pages.orders.title to "Sales" Set the main menu to orders, customers, team. Undo with: smithable undo |
| big-orders-admins-only | eu.anthropic.claude-haiku-4-5-20251001-v1:0 | **wrong** | 17,440 | $0.0101 | 7 s | Proposed change:   1. Only admin may see orders Only admin may see orders. Undo with: smithable undo |
| vat-amount | eu.anthropic.claude-haiku-4-5-20251001-v1:0 | right | 12,089 | $0.0077 | 11 s | Proposed change:   1. Add field vat (money = total * 0.25) to Invoice Add field vat (money = total * 0.25) to Invoice. Undo with: smithable undo |
| client-phone-search | eu.anthropic.claude-haiku-4-5-20251001-v1:0 | right | 17,510 | $0.0104 | 13 s | Proposed change:   1. Add field phone (phone) to Client   2. Search clients by name, email, phone Add field phone (phone) to Client. Undo with: smithable undo |
| no-delete-sent | eu.anthropic.claude-haiku-4-5-20251001-v1:0 | right | 17,523 | $0.0101 | 7 s | Proposed change:   1. Let the default access decide who may delete invoices Let the default access decide who may delete invoices. Undo with: smithable undo |
| staff-posts | eu.anthropic.claude-haiku-4-5-20251001-v1:0 | **wrong** | 35,150 | $0.0211 | 12 s | Proposed change:   1. Only admin and staff may write incidents   2. Only admin and staff may delete incidents Only admin and staff may write incidents. Undo with: smithable undo |
| home-says-what | eu.anthropic.claude-haiku-4-5-20251001-v1:0 | right | 15,409 | $0.0196 | 9 s | Proposed change:   1. Change the text pages.home.hero.title to "We keep the Pulse payment API running around the clock." Change the text pages.home.hero.title to "We keep the Pulse payment API running around the clock.". |
| room-choice | eu.anthropic.claude-haiku-4-5-20251001-v1:0 | **no change** | 52,620 | $0.0306 | 10 s | No model found a change that applies. addField: A choice field's default is its first value, so "=" is not used here. Put the default first, or use the long form with "default:". |
| teachers-not-instructors | eu.anthropic.claude-haiku-4-5-20251001-v1:0 | **no change** | 52,895 | $0.0327 | 14 s | No model found a change that applies. renameField: Instructor already has a field named "name". |
| vat-in-list | mistral-medium-latest | right | 7,594 | $0.0119 | 12 s | Proposed change:   1. Add field vatNumber (string) to Customer   2. Show name, email, phone, vatNumber, segment, creditLimit, accountManager in the customers table Add field vatNumber (string) to Customer. Undo with: smi |
| first-last-name | mistral-medium-latest | right | 11,096 | $0.0177 | 14 s | Proposed change:   1. Change Customer.name to string   2. Add field firstName (string) to Customer   3. Add field lastName (string) to Customer |
| owner-of-order | mistral-medium-latest | **wrong** | 22,674 | $0.0355 | 16 s | Proposed change:   1. Add field salesperson (User) to Order   2. Only the owner may write orders   3. Only the owner may delete orders |
| orders-first-as-sales | mistral-medium-latest | right | 7,471 | $0.0116 | 7 s | Proposed change:   1. Set the main menu to orders, customers, team   2. Change the text pages.orders.title to "Sales" Set the main menu to orders, customers, team. Undo with: smithable undo |
| big-orders-admins-only | mistral-medium-latest | right | 22,656 | $0.0355 | 12 s | No model found a change that applies. setPublicWhere: setPublicWhere would make smithable.auth.yml invalid. "where" of Order: "total" must be a choice field of Order with one of its values (or a list of them), or a yes/n |
| vat-amount | mistral-medium-latest | right | 5,613 | $0.0087 | 11 s | Proposed change:   1. Add field vat (money = total * 0.25) to Invoice Add field vat (money = total * 0.25) to Invoice. Undo with: smithable undo |
| client-phone-search | mistral-medium-latest | right | 7,473 | $0.0116 | 12 s | Proposed change:   1. Add field phone (phone) to Client   2. Search clients by name, email, phone Add field phone (phone) to Client. Undo with: smithable undo |
| no-delete-sent | mistral-medium-latest | right | 22,780 | $0.0353 | 12 s | No model found a change that applies. setAccess: setAccess: Unknown argument "when". |
| staff-posts | mistral-medium-latest | **wrong** | 23,260 | $0.0388 | 17 s | Proposed change:   1. Only admin and staff may write incidents   2. Only admin and staff may delete incidents   3. Only admin and staff may write incident updates |
| home-says-what | mistral-medium-latest | right | 6,699 | $0.0103 | 5 s | Proposed change:   1. Change the text pages.home.subtitle to "We keep the Pulse payment API running around the clock." Change the text pages.home.subtitle to "We keep the Pulse payment API running around the clock.". Und |
| room-choice | mistral-medium-latest | right | 14,986 | $0.0230 | 12 s |  |
| teachers-not-instructors | mistral-medium-latest | **no change** | 22,901 | $0.0380 | 14 s | No model found a change that applies. renameModel: Unknown operation "renameModel". Available: setRuleId, setAccess, editSpec, addTheme, setTheme, setSectionLook, setColumns, setFieldOrder, setTone, setIcon, setBelow, se |
| vat-in-list | mistral-small-latest | **wrong** | 7,548 | $0.0012 | 7 s | Proposed change:   1. Add field vatNumber (string) to Customer Add field vatNumber (string) to Customer. Undo with: smithable undo |
| first-last-name | mistral-small-latest | right | 11,123 | $0.0018 | 7 s | Proposed change:   1. Change Customer.name to string   2. Add field firstName (string) to Customer   3. Add field lastName (string) to Customer |
| owner-of-order | mistral-small-latest | **wrong** | 15,026 | $0.0023 | 6 s | Proposed change:   1. Add field salesperson (User) to Order   2. Only the owner may write orders Add field salesperson (User) to Order. Undo with: smithable undo |
| orders-first-as-sales | mistral-small-latest | right | 7,471 | $0.0012 | 4 s | Proposed change:   1. Set the main menu to orders, customers, team   2. Change the text pages.orders.title to "Sales" Set the main menu to orders, customers, team. Undo with: smithable undo |
| big-orders-admins-only | mistral-small-latest | **wrong** | 22,596 | $0.0035 | 5 s | Proposed change:   1. Only admin may see orders Only admin may see orders. Undo with: smithable undo |
| vat-amount | mistral-small-latest | **no change** | 17,158 | $0.0027 | 4 s | No model found a change that applies. addField: Unknown word "computed:" in a field definition. After the type, only "unique" and "= <default>" may follow. |
| client-phone-search | mistral-small-latest | **wrong** | 7,442 | $0.0011 | 4 s | Proposed change:   1. Add field phone (phone) to Client Add field phone (phone) to Client. Undo with: smithable undo |
| no-delete-sent | mistral-small-latest | right | 7,504 | $0.0011 | 2 s | Proposed change:   1. Let the default access decide who may delete invoices Let the default access decide who may delete invoices. Undo with: smithable undo |
| staff-posts | mistral-small-latest | right | 15,246 | $0.0024 | 6 s | Proposed change:   1. Only admin and staff may create incidents   2. Only admin and staff may write incidents   3. Only admin and staff may delete incidents |
| home-says-what | mistral-small-latest | right | 13,487 | $0.0021 | 4 s | Proposed change:   1. Change the text pages.home.hero.title to "We keep the Pulse payment API running around the clock." Change the text pages.home.hero.title to "We keep the Pulse payment API running around the clock.". |
| room-choice | mistral-small-latest | **no change** | 22,582 | $0.0035 | 3 s | No model found a change that applies. changeField: Model "Session" has no field named "studio". |
| teachers-not-instructors | mistral-small-latest | **wrong** | 7,399 | $0.0011 | 4 s | Proposed change:   1. Rename Instructor.name to teacherName   2. Rename Session.instructor to teacher Rename Instructor.name to teacherName. Undo with: smithable undo |

The apps are in /tmp/smithable-bench-changes-ysLD8k/.
