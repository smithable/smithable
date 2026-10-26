# Builder changes that reach a model (2026-10-26)

12 requests as people type them into Builder's Describe box, on fresh copies of the starters, through `smithable ask --yes` ([scripts/bench-changes.mjs](../../scripts/bench-changes.mjs)). The wording rules (tier 0) read none of them (`--rules` run). Each outcome is checked in the spec files the change leaves: *right* is what the request means; *wrong* is a change that is not it; *no change* is a refusal or a question back. 2 requests ask for what the spec cannot express (access by a value); for those, no change is right.

| Model | Right | Wrong | No change | Read by a rule | Tokens | Cost | Time |
|---|---|---|---|---|---|---|---|
| claude-haiku-5-5 | 6 / 12 | 1 | 5 | 0 | 284,283 | $0.0282 | 65 s |
| claude-sonnet-5-5 | 11 / 12 | 1 | 0 | 0 | 262,475 | $0.5080 | 81 s |
| claude-haiku-5-5>claude-sonnet-5-5 | 10 / 12 | 1 | 1 | 0 | 335,281 | $0.1192 | 104 s |
| mistral-medium-latest | 8 / 12 | 4 | 0 | 0 | 293,357 | $0.4480 | 160 s |
| mistral-small-latest | 10 / 12 | 1 | 1 | 0 | 273,109 | $0.0416 | 96 s |

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
| vat-in-list | claude-haiku-5-5 | right | 23,258 | $0.0022 | 4 s | Proposed change:   1. Add field vatNumber (string) to Customer, shown in its list Add field vatNumber (string) to Customer, shown in its list. Undo with: smithable undo |
| first-last-name | claude-haiku-5-5 | **no change** | 18,739 | $0.0018 | 4 s | Should customers keep the existing company name field, or be split into first and last name?   - Keep "name" for companies and add optional "firstName" and "lastName" fields for people.   - Replace "name" with required " |
| owner-of-order | claude-haiku-5-5 | **wrong** | 23,436 | $0.0023 | 6 s | Proposed change:   1. Add field salesperson (User) to Order   2. Orders belong to their salesperson Add field salesperson (User) to Order. Undo with: smithable undo |
| orders-first-as-sales | claude-haiku-5-5 | **no change** | 23,647 | $0.0024 | 5 s | I can put Orders first in the main menu. For the name 'Sales', do you mean the page's title and menu label only, or should the records themselves be called Sales everywhere in the app?   - Only the page and its menu labe |
| big-orders-admins-only | claude-haiku-5-5 | right | 23,508 | $0.0024 | 6 s | Nothing here can limit who sees orders by their amount: access is set per record owner (setDefaultAccess) or by page and model for a role (grant), and setPublicWhere only limits what visitors who are not signed in can re |
| vat-amount | claude-haiku-5-5 | right | 19,269 | $0.0019 | 7 s | Proposed change:   1. Add field vat (money = total * 0.25) to Invoice, shown in its list Add field vat (money = total * 0.25) to Invoice, shown in its list. Undo with: smithable undo |
| client-phone-search | claude-haiku-5-5 | right | 23,326 | $0.0023 | 5 s | Proposed change:   1. Add field phone (phone) to Client   2. Search clients by phone Add field phone (phone) to Client. Undo with: smithable undo |
| no-delete-sent | claude-haiku-5-5 | right | 23,741 | $0.0025 | 7 s | The app has no setting that blocks deleting a record by its status: deleting follows the record rule, so an invoice's owner can still delete it after it is sent. Locking the invoice against edits once it is sent can be s |
| staff-posts | claude-haiku-5-5 | right | 23,329 | $0.0023 | 5 s | Who is 'our team'? The app has no roles set up yet, so I need to know which access you want.   - Admins only: only administrators can post incidents, and everyone else can read them.   - A new 'team' role: create it for  |
| home-says-what | claude-haiku-5-5 | **no change** | 20,285 | $0.0020 | 4 s | Where on the home page should "we keep the Pulse payment API running around the clock" go?   - As the hero's headline, replacing the current one   - As the hero's subtitle, under the current headline   - As the app's des |
| room-choice | claude-haiku-5-5 | **no change** | 38,435 | $0.0038 | 7 s | No model found a change that applies. Unexpected token '`', "```json {""... is not valid JSON |
| teachers-not-instructors | claude-haiku-5-5 | **no change** | 23,310 | $0.0023 | 5 s | Do you want the word changed only where people read it, or the model itself renamed too?   - Only the words: show "Teacher" and "Teachers" in the app, keeping the Instructor model and its /instructors page as they are.   |
| vat-in-list | claude-sonnet-5-5 | right | 23,079 | $0.0478 | 3 s | Proposed change:   1. Add field vatNumber (string) to Customer, shown in its list Add field vatNumber (string) to Customer, shown in its list. Undo with: smithable undo |
| first-last-name | claude-sonnet-5-5 | right | 18,840 | $0.0366 | 7 s | Proposed change:   1. Add field firstName (string) to Customer   2. Add field lastName (string) to Customer Add field firstName (string) to Customer. Undo with: smithable undo |
| owner-of-order | claude-sonnet-5-5 | **wrong** | 23,081 | $0.0434 | 18 s | Proposed change:   1. Add field salesperson (User) to Order   2. Orders belong to their salesperson Add field salesperson (User) to Order. Undo with: smithable undo |
| orders-first-as-sales | claude-sonnet-5-5 | right | 23,399 | $0.0456 | 5 s | Proposed change:   1. Set the main menu to orders, customers, team   2. Call Order records "Sale" and "Sales" Set the main menu to orders, customers, team. Undo with: smithable undo |
| big-orders-admins-only | claude-sonnet-5-5 | right | 23,139 | $0.0445 | 5 s | I can't hide orders by their amount: access rules here apply to a whole model or to whose record it is, not to a value like total over 10 000 €. The nearest things are to limit who sees Orders at all, with the record rul |
| vat-amount | claude-sonnet-5-5 | right | 19,017 | $0.0360 | 6 s | Proposed change:   1. Add field vat (money = total * 0.25) to Invoice Add field vat (money = total * 0.25) to Invoice. Undo with: smithable undo |
| client-phone-search | claude-sonnet-5-5 | right | 22,950 | $0.0423 | 3 s | Proposed change:   1. Add field phone (phone) to Client   2. Search clients by phone Add field phone (phone) to Client. Undo with: smithable undo |
| no-delete-sent | claude-sonnet-5-5 | right | 23,366 | $0.0455 | 6 s | No setting here lets deletion depend on an invoice's status. Delete is allowed for the person who owns the record and for any role granted delete, whatever the status is. Enforcing 'no delete once sent' needs custom code |
| staff-posts | claude-sonnet-5-5 | right | 23,274 | $0.0454 | 5 s | Who counts as "our team" for posting incidents?   - Only administrators post incidents; everyone else only reads them   - A role for the team (I'll set it up and grant it posting incidents); everyone else only reads them |
| home-says-what | claude-sonnet-5-5 | right | 20,114 | $0.0392 | 6 s | Proposed change:   1. Change the text pages.home.hero.title to "We keep the Pulse payment API running around the clock." Change the text pages.home.hero.title to "We keep the Pulse payment API running around the clock.". |
| room-choice | claude-sonnet-5-5 | right | 18,916 | $0.0353 | 5 s | Proposed change:   1. Add field studio (studio1 \| studio2) to Session Add field studio (studio1 \| studio2) to Session. Undo with: smithable undo |
| teachers-not-instructors | claude-sonnet-5-5 | right | 23,300 | $0.0464 | 12 s | Proposed change:   1. Call Instructor records "Teacher" and "Teachers"   2. Change the text models.Session.fields.instructor.label to "Teacher" Call Instructor records "Teacher" and "Teachers". Undo with: smithable undo |
| vat-in-list | claude-haiku-5-5>claude-sonnet-5-5 | right | 23,238 | $0.0022 | 12 s | Proposed change:   1. Add field vatNumber (string) to Customer, shown in its list Add field vatNumber (string) to Customer, shown in its list. Undo with: smithable undo |
| first-last-name | claude-haiku-5-5>claude-sonnet-5-5 | **no change** | 18,866 | $0.0018 | 5 s | Should the first and last name replace the existing company name, or sit alongside it?   - Add firstName and lastName next to name: name stays for companies, and the two new fields are optional   - Replace name with firs |
| owner-of-order | claude-haiku-5-5>claude-sonnet-5-5 | **wrong** | 47,099 | $0.0048 | 18 s | Proposed change:   1. Add field salesperson (User) to Order   2. Orders belong to their salesperson Add field salesperson (User) to Order. Undo with: smithable undo |
| orders-first-as-sales | claude-haiku-5-5>claude-sonnet-5-5 | right | 23,585 | $0.0024 | 6 s | Proposed change:   1. Set the main menu to orders, customers, team   2. Change the text pages.orders.title to "Sales" Set the main menu to orders, customers, team. Undo with: smithable undo |
| big-orders-admins-only | claude-haiku-5-5>claude-sonnet-5-5 | right | 46,582 | $0.0468 | 10 s | Access here can't depend on a record's value, so there is no way to hide only the orders over 10 000 €. The nearest things are limiting who can open the orders page to admins (by granting the other roles only the pages t |
| vat-amount | claude-haiku-5-5>claude-sonnet-5-5 | right | 19,274 | $0.0019 | 5 s | Proposed change:   1. Add field vat (money = total * 0.25) to Invoice Add field vat (money = total * 0.25) to Invoice. Undo with: smithable undo |
| client-phone-search | claude-haiku-5-5>claude-sonnet-5-5 | right | 23,582 | $0.0024 | 8 s | Proposed change:   1. Add field phone (phone) to Client   2. Search clients by phone Add field phone (phone) to Client. Undo with: smithable undo |
| no-delete-sent | claude-haiku-5-5>claude-sonnet-5-5 | right | 47,217 | $0.0484 | 15 s | I can't block deleting an invoice based on its status. Delete permission is set per model for a role, not per record, so it can't depend on an invoice being sent. The nearest thing here is turning on the trash for Invoic |
| staff-posts | claude-haiku-5-5>claude-sonnet-5-5 | right | 23,284 | $0.0023 | 7 s | Which people should be able to post incidents? I can give that to an existing role, or set up a new one for your team.   - Only admins post incidents: everyone else gets read-only access to incidents.   - Create a new ro |
| home-says-what | claude-haiku-5-5>claude-sonnet-5-5 | right | 20,254 | $0.0020 | 6 s | Proposed change:   1. Change 1 texts Change 1 texts. Undo with: smithable undo |
| room-choice | claude-haiku-5-5>claude-sonnet-5-5 | right | 19,099 | $0.0019 | 6 s | Proposed change:   1. Add field studio (studio1 \| studio2) to Session Add field studio (studio1 \| studio2) to Session. Undo with: smithable undo |
| teachers-not-instructors | claude-haiku-5-5>claude-sonnet-5-5 | right | 23,201 | $0.0023 | 6 s | Proposed change:   1. Rename Instructor to Teacher Rename Instructor to Teacher. Undo with: smithable undo |
| vat-in-list | mistral-medium-latest | right | 17,351 | $0.0263 | 9 s | Proposed change:   1. Add field vatNumber (string) to Customer, shown in its list Add field vatNumber (string) to Customer, shown in its list. Undo with: smithable undo |
| first-last-name | mistral-medium-latest | right | 28,085 | $0.0433 | 15 s | Proposed change:   1. Change Customer.name to string   2. Add field firstName (string) to Customer   3. Add field lastName (string) to Customer |
| owner-of-order | mistral-medium-latest | **wrong** | 17,327 | $0.0265 | 13 s | Proposed change:   1. Add field salesperson (User) to Order   2. Orders belong to their salesperson   3. Everyone sees and changes only their own records |
| orders-first-as-sales | mistral-medium-latest | **wrong** | 17,350 | $0.0263 | 12 s | Proposed change:   1. Rename page orders to sales; its address is now /sales   2. Set the main menu to sales, customers, team Rename page orders to sales; its address is now /sales. Undo with: smithable undo |
| big-orders-admins-only | mistral-medium-latest | right | 86,841 | $0.1327 | 43 s | No model found a change that applies. setPublicWhere: setPublicWhere would make smithable.auth.yml invalid. "where" of Order: "total" must be a choice field of Order with one of its values (or a list of them), or a yes/n |
| vat-amount | mistral-medium-latest | right | 14,111 | $0.0215 | 7 s | Proposed change:   1. Add field vat (money = total * 0.25) to Invoice, shown in its list Add field vat (money = total * 0.25) to Invoice, shown in its list. Undo with: smithable undo |
| client-phone-search | mistral-medium-latest | right | 17,296 | $0.0264 | 10 s | Proposed change:   1. Add field phone (phone) to Client   2. Search clients by name, email, phone Add field phone (phone) to Client. Undo with: smithable undo |
| no-delete-sent | mistral-medium-latest | **wrong** | 17,341 | $0.0263 | 9 s | Proposed change:   1. Set Invoice.status's rules: locked when status is sent or paid or overdue Set Invoice.status's rules: locked when status is sent or paid or overdue. Undo with: smithable undo |
| staff-posts | mistral-medium-latest | **wrong** | 17,309 | $0.0267 | 11 s | Proposed change:   1. Everyone signed in sees and changes every record   2. Set roles team (new users: team)   3. team may change everyone's incidents |
| home-says-what | mistral-medium-latest | right | 14,851 | $0.0225 | 8 s | Proposed change:   1. Change the text pages.home.subtitle to "We keep the Pulse payment API running around the clock." Change the text pages.home.subtitle to "We keep the Pulse payment API running around the clock.". Und |
| room-choice | mistral-medium-latest | right | 28,219 | $0.0429 | 13 s | Proposed change:   1. Add field studio (studio1 \| studio2) to Session Add field studio (studio1 \| studio2) to Session. Undo with: smithable undo |
| teachers-not-instructors | mistral-medium-latest | right | 17,276 | $0.0266 | 10 s | Proposed change:   1. Rename Instructor to Teacher   2. Rename Session.instructor to teacher   3. Rename page instructors to teachers; its address is now /teachers |
| vat-in-list | mistral-small-latest | right | 17,351 | $0.0026 | 4 s | Proposed change:   1. Add field vatNumber (string) to Customer, shown in its list Add field vatNumber (string) to Customer, shown in its list. Undo with: smithable undo |
| first-last-name | mistral-small-latest | right | 42,168 | $0.0065 | 9 s | Proposed change:   1. Change Customer.name to string   2. Add field firstName (string) to Customer   3. Add field lastName (string) to Customer |
| owner-of-order | mistral-small-latest | **wrong** | 34,657 | $0.0052 | 5 s | Proposed change:   1. Add field handledBy (User) to Order   2. Orders belong to their handled by Add field handledBy (User) to Order. Undo with: smithable undo |
| orders-first-as-sales | mistral-small-latest | right | 17,371 | $0.0026 | 4 s | Proposed change:   1. Set the main menu to orders, customers, team   2. Change the text pages.orders.title to "Sales" Set the main menu to orders, customers, team. Undo with: smithable undo |
| big-orders-admins-only | mistral-small-latest | right | 87,044 | $0.0133 | 10 s | No model found a change that applies. setRuleId: model:Order has 0 rule(s), not 1. |
| vat-amount | mistral-small-latest | right | 14,146 | $0.0022 | 7 s | Proposed change:   1. Add field vat (money = total * 0.25) to Invoice   2. Change the text models.Invoice.fields.vat.label to "VAT (25%)" Add field vat (money = total * 0.25) to Invoice. Undo with: smithable undo |
| client-phone-search | mistral-small-latest | **no change** | 0 | $0.0000 | 8 s | No model was used No model found a change that applies. smithable answered 429: {"object":"error","message":"Rate limit exceeded","type":"rate_limited","param":null,"code":"1300","raw_status_code":429} |
| no-delete-sent | mistral-small-latest | right | 0 | $0.0000 | 8 s | No model was used No model found a change that applies. smithable answered 429: {"object":"error","message":"Rate limit exceeded","type":"rate_limited","param":null,"code":"1300","raw_status_code":429} |
| staff-posts | mistral-small-latest | right | 0 | $0.0000 | 8 s | No model was used No model found a change that applies. smithable answered 429: {"object":"error","message":"Rate limit exceeded","type":"rate_limited","param":null,"code":"1300","raw_status_code":429} |
| home-says-what | mistral-small-latest | right | 14,860 | $0.0023 | 3 s | Proposed change:   1. Change the text pages.home.subtitle to "We keep the Pulse payment API running around the clock." Change the text pages.home.subtitle to "We keep the Pulse payment API running around the clock.". Und |
| room-choice | mistral-small-latest | right | 28,236 | $0.0043 | 18 s | Proposed change:   1. Add field studio (studio1 \| studio2) to Session Add field studio (studio1 \| studio2) to Session. Undo with: smithable undo |
| teachers-not-instructors | mistral-small-latest | right | 17,276 | $0.0026 | 12 s | Proposed change:   1. Rename Instructor to Teacher   2. Rename Session.instructor to teacher   3. Rename page instructors to teachers; its address is now /teachers |

The apps are in /tmp/smithable-bench-changes-pXhwAu.
