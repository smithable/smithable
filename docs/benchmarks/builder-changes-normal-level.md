# Builder changes that reach a model (2026-11-04)

12 requests as people type them into Builder's Describe box, on fresh copies of the starters, through `smithable ask --yes` ([scripts/bench-changes.mjs](../../scripts/bench-changes.mjs)). The wording rules (tier 0) read none of them (`--rules` run). Each outcome is checked in the spec files the change leaves: *right* is what the request means; *wrong* is a change that is not it; *no change* is a refusal or a question back. 2 requests ask for what the spec cannot express (access by a value); for those, no change is right.

| Model | Right | Wrong | No change | Read by a rule | Tokens | Cost | Time |
|---|---|---|---|---|---|---|---|
| eu.anthropic.claude-sonnet-4-6 | 9 / 12 | 2 | 1 | 0 | 769,547 | $1.6218 | 57 s |
| mistral-medium-latest | 7 / 12 | 5 | 0 | 0 | 388,234 | $0.5903 | 217 s |

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
| vat-in-list | eu.anthropic.claude-sonnet-4-6 | right | 48,897 | $0.1840 | 4 s | Proposed change:   1. Add field vatNumber (string) to Customer, shown in its list Add field vatNumber (string) to Customer, shown in its list. Undo with: smithable undo |
| first-last-name | eu.anthropic.claude-sonnet-4-6 | right | 73,121 | $0.2053 | 6 s | Proposed change:   1. Rename Customer.name to firstName   2. Add field lastName (string) to Customer Rename Customer.name to firstName. Undo with: smithable undo |
| owner-of-order | eu.anthropic.claude-sonnet-4-6 | **wrong** | 48,939 | $0.0855 | 4 s | Proposed change:   1. Add field salesperson (User) to Order   2. Orders belong to their salesperson Add field salesperson (User) to Order. Undo with: smithable undo |
| orders-first-as-sales | eu.anthropic.claude-sonnet-4-6 | right | 48,905 | $0.0851 | 4 s | Proposed change:   1. Set the main menu to orders, start, customers, followUps, team   2. Change the text pages.orders.title to "Sales" Set the main menu to orders, start, customers, followUps, team. Undo with: smithable |
| big-orders-admins-only | eu.anthropic.claude-sonnet-4-6 | right | 48,933 | $0.0860 | 5 s | Smithable's access rules work at the model level — a role either reads all Order records or none — so there's no built-in way to restrict visibility to only records where `total > 10 000`. Row-level filtering by a comput |
| vat-amount | eu.anthropic.claude-sonnet-4-6 | right | 36,588 | $0.0665 | 4 s | Proposed change:   1. Add field vat (money = total * 0.25) to Invoice Add field vat (money = total * 0.25) to Invoice. Undo with: smithable undo |
| client-phone-search | eu.anthropic.claude-sonnet-4-6 | right | 48,868 | $0.0848 | 4 s | Proposed change:   1. Add field phone (phone) to Client   2. Search clients by name, email, phone Add field phone (phone) to Client. Undo with: smithable undo |
| no-delete-sent | eu.anthropic.claude-sonnet-4-6 | **wrong** | 48,902 | $0.0845 | 3 s | Proposed change:   1. Set Invoice.status's rules: locked when status is sent or paid Set Invoice.status's rules: locked when status is sent or paid. Undo with: smithable undo |
| staff-posts | eu.anthropic.claude-sonnet-4-6 | right | 48,884 | $0.0853 | 3 s | What role does "our team" have? I need to know the role name to grant it the right to create, edit, and delete incidents — while everyone else can only read them.   - There's a role like "staff" or "team" already set up  |
| home-says-what | eu.anthropic.claude-sonnet-4-6 | right | 85,292 | $0.2353 | 6 s | Proposed change:   1. Change the text pages.home.hero.subtitle to "We keep the Pulse payment API running around the clock." Change the text pages.home.hero.subtitle to "We keep the Pulse payment API running around the cl |
| room-choice | eu.anthropic.claude-sonnet-4-6 | **no change** | 183,446 | $0.3355 | 11 s | No model found a change that applies. addField: Choice value "Studio 1" must start with a lowercase letter and use only letters and digits, like "inProgress". |
| teachers-not-instructors | eu.anthropic.claude-sonnet-4-6 | right | 48,772 | $0.0840 | 3 s | Proposed change:   1. Call Instructor records "Teacher" and "Teachers" Call Instructor records "Teacher" and "Teachers". Undo with: smithable undo |
| vat-in-list | mistral-medium-latest | right | 22,935 | $0.0347 | 13 s | Proposed change:   1. Add field vatNumber (string) to Customer, shown in its list Add field vatNumber (string) to Customer, shown in its list. Undo with: smithable undo |
| first-last-name | mistral-medium-latest | right | 36,802 | $0.0564 | 19 s | Proposed change:   1. Change Customer.name to string   2. Add field firstName (string) to Customer   3. Add field lastName (string) to Customer |
| owner-of-order | mistral-medium-latest | **wrong** | 46,018 | $0.0699 | 26 s | Proposed change:   1. Add field salesperson (User) to Order   2. Orders belong to their salesperson   3. Everyone sees and changes only their own records |
| orders-first-as-sales | mistral-medium-latest | **wrong** | 22,939 | $0.0348 | 15 s | Proposed change:   1. Rename page orders to sales; its address is now /sales   2. Set the main menu to start, sales, customers, followUps, team Rename page orders to sales; its address is now /sales. Undo with: smithable |
| big-orders-admins-only | mistral-medium-latest | **wrong** | 45,921 | $0.0695 | 24 s | Proposed change:   1. Set Order.total's rules: filled by the app, locked when status is placed or shipped Set Order.total's rules: filled by the app, locked when status is placed or shipped. Undo with: smithable undo /tm |
| vat-amount | mistral-medium-latest | right | 18,466 | $0.0281 | 10 s | Proposed change:   1. Add field vat (money = total * 0.25) to Invoice   2. Add field totalWithVat (money = total + vat) to Invoice Add field vat (money = total * 0.25) to Invoice. Undo with: smithable undo |
| client-phone-search | mistral-medium-latest | right | 22,898 | $0.0347 | 13 s | Proposed change:   1. Add field phone (phone) to Client   2. Search clients by name, email, phone Add field phone (phone) to Client. Undo with: smithable undo |
| no-delete-sent | mistral-medium-latest | **wrong** | 45,950 | $0.0695 | 24 s | Proposed change:   1. Set Invoice.status's rules: locked when status is sent or paid Set Invoice.status's rules: locked when status is sent or paid. Undo with: smithable undo |
| staff-posts | mistral-medium-latest | **wrong** | 46,106 | $0.0711 | 27 s | Proposed change:   1. Everyone signed in sees and changes every record   2. Set roles team, staff (new users: team)   3. team may open the incidents page, the updates page, the maintenance page, the components page, the  |
| home-says-what | mistral-medium-latest | right | 20,425 | $0.0309 | 12 s | Proposed change:   1. Change the text pages.home.subtitle to "We keep the Pulse payment API running around the clock." Change the text pages.home.subtitle to "We keep the Pulse payment API running around the clock.". Und |
| room-choice | mistral-medium-latest | right | 36,901 | $0.0558 | 20 s | Proposed change:   1. Add field studio (studio1 \| studio2) to Session Add field studio (studio1 \| studio2) to Session. Undo with: smithable undo |
| teachers-not-instructors | mistral-medium-latest | right | 22,873 | $0.0349 | 14 s | Proposed change:   1. Rename Instructor to Teacher   2. Rename page instructors to teachers; its address is now /teachers   3. Set the studioSetup menu to class-types, teachers |

The apps are in /tmp/smithable-bench-changes-Urhx5f.
