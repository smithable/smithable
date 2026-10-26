# Builder changes that reach a model (2026-10-26)

12 requests as people type them into Builder's Describe box, on fresh copies of the starters, through `smithable ask --yes` ([scripts/bench-changes.mjs](../../scripts/bench-changes.mjs)). The wording rules (tier 0) read none of them (`--rules` run). Each outcome is checked in the spec files the change leaves: *right* is what the request means; *wrong* is a change that is not it; *no change* is a refusal or a question back. 2 requests ask for what the spec cannot express (access by a value); for those, no change is right.

| Model | Right | Wrong | No change | Read by a rule | Tokens | Cost | Time |
|---|---|---|---|---|---|---|---|
| claude-haiku-5-5 | 10 / 12 | 1 | 1 | 0 | 265,270 | $0.0268 | 69 s |
| claude-sonnet-5-5 | 9 / 12 | 1 | 2 | 0 | 262,404 | $0.5073 | 68 s |
| claude-haiku-5-5>claude-sonnet-5-5 | 8 / 12 | 1 | 3 | 0 | 330,271 | $0.1178 | 84 s |
| mistral-small-latest | 7 / 12 | 2 | 3 | 0 | 304,077 | $0.0461 | 96 s |
| mistral-medium-latest | 8 / 12 | 4 | 0 | 0 | 293,360 | $0.4479 | 169 s |

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
| vat-in-list | claude-haiku-5-5 | right | 23,190 | $0.0024 | 4 s | Proposed change:   1. Add field vatNumber (string) to Customer, shown in its list Add field vatNumber (string) to Customer, shown in its list. Undo with: smithable undo |
| first-last-name | claude-haiku-5-5 | **no change** | 19,125 | $0.0020 | 6 s | Customers need a first name and a last name. Should the existing required "name" field stay, or be replaced by the two new ones?   - Add firstName and lastName (both required) and keep name as it is   - Replace name with |
| owner-of-order | claude-haiku-5-5 | **wrong** | 23,423 | $0.0023 | 8 s | Proposed change:   1. Add field salesperson (User) to Order   2. Orders belong to their salesperson Add field salesperson (User) to Order. Undo with: smithable undo |
| orders-first-as-sales | claude-haiku-5-5 | right | 23,404 | $0.0023 | 4 s | Proposed change:   1. Set the main menu to orders, customers, team   2. Change the text pages.orders.title to "Sales" Set the main menu to orders, customers, team. Undo with: smithable undo |
| big-orders-admins-only | claude-haiku-5-5 | right | 23,516 | $0.0024 | 6 s | This app can't hide individual orders by their value, so that only admins see orders over 10 000 €. Access can be set per role and per page, and visitors can be limited by a condition with setPublicWhere, but nothing lim |
| vat-amount | claude-haiku-5-5 | right | 19,177 | $0.0019 | 6 s | Proposed change:   1. Add field vat (money = total * 0.25) to Invoice Add field vat (money = total * 0.25) to Invoice. Undo with: smithable undo |
| client-phone-search | claude-haiku-5-5 | right | 23,230 | $0.0023 | 5 s | Proposed change:   1. Add field phone (phone) to Client   2. Search clients by phone Add field phone (phone) to Client. Undo with: smithable undo |
| no-delete-sent | claude-haiku-5-5 | right | 23,772 | $0.0025 | 7 s | No operation can make deleting a record depend on its status, so I can't stop deletion of sent invoices here. The sent-invoice rule covers editing only. Blocking deletes would need custom code in the app's delete path fo |
| staff-posts | claude-haiku-5-5 | right | 23,417 | $0.0023 | 5 s | Who counts as "our team" for posting incidents?   - Admins only: only administrators may create, change or delete incidents, and everyone else can read them.   - A new role named "team": people with that role may post in |
| home-says-what | claude-haiku-5-5 | right | 20,243 | $0.0020 | 5 s | Proposed change:   1. Change the text pages.home.subtitle to "We keep the Pulse payment API running around the clock." Change the text pages.home.subtitle to "We keep the Pulse payment API running around the clock.". Und |
| room-choice | claude-haiku-5-5 | right | 19,305 | $0.0020 | 5 s | Proposed change:   1. Add field studio (studio1 \| studio2) to Session Add field studio (studio1 \| studio2) to Session. Undo with: smithable undo |
| teachers-not-instructors | claude-haiku-5-5 | right | 23,468 | $0.0024 | 8 s | Proposed change:   1. Rename Instructor to Teacher   2. Rename page instructors to teachers; its address is now /teachers Rename Instructor to Teacher. Undo with: smithable undo |
| vat-in-list | claude-sonnet-5-5 | right | 23,079 | $0.0478 | 3 s | Proposed change:   1. Add field vatNumber (string) to Customer, shown in its list Add field vatNumber (string) to Customer, shown in its list. Undo with: smithable undo |
| first-last-name | claude-sonnet-5-5 | **no change** | 18,821 | $0.0364 | 6 s | Customer has a single required name field today. How should first and last name fit in?   - Keep name for companies and add optional firstName and lastName fields for people   - Add firstName and lastName as required fie |
| owner-of-order | claude-sonnet-5-5 | **wrong** | 23,090 | $0.0435 | 5 s | Proposed change:   1. Add field salesperson (User) to Order   2. Orders belong to their salesperson Add field salesperson (User) to Order. Undo with: smithable undo |
| orders-first-as-sales | claude-sonnet-5-5 | right | 23,440 | $0.0460 | 6 s | Proposed change:   1. Set the main menu to orders, customers, team   2. Change the text pages.orders.title to "Sales" Set the main menu to orders, customers, team. Undo with: smithable undo |
| big-orders-admins-only | claude-sonnet-5-5 | right | 23,131 | $0.0444 | 5 s | Access here can't depend on a record's value, so I can't hide only the orders over 10 000 € from non-admins. The nearest things I can do are make records private so people see only their own orders (setDefaultAccess), or |
| vat-amount | claude-sonnet-5-5 | right | 18,973 | $0.0356 | 11 s | Proposed change:   1. Add field vat (money = total * 0.25) to Invoice Add field vat (money = total * 0.25) to Invoice. Undo with: smithable undo |
| client-phone-search | claude-sonnet-5-5 | **no change** | 23,020 | $0.0430 | 3 s | No model found a change that applies. Unexpected non-whitespace character after JSON at position 177 (line 3 column 1) |
| no-delete-sent | claude-sonnet-5-5 | right | 23,340 | $0.0452 | 5 s | I can't block deleting an invoice based on its status: delete access is set per model or role, not per record state, so it can't depend on an invoice being sent. The nearest options are setTrash on Invoice, so a deleted  |
| staff-posts | claude-sonnet-5-5 | right | 23,177 | $0.0445 | 4 s | Who counts as "our team" when it comes to posting incidents?   - Only administrators post and change incidents; everyone else can only read them   - Add a new role (for example "team") that can create and change incident |
| home-says-what | claude-sonnet-5-5 | right | 20,202 | $0.0401 | 7 s | Proposed change:   1. Change the text pages.home.hero.title to "We keep the Pulse payment API running around the clock." Change the text pages.home.hero.title to "We keep the Pulse payment API running around the clock.". |
| room-choice | claude-sonnet-5-5 | right | 18,921 | $0.0353 | 7 s | Proposed change:   1. Add field studio (studio1 \| studio2) to Session Add field studio (studio1 \| studio2) to Session. Undo with: smithable undo |
| teachers-not-instructors | claude-sonnet-5-5 | right | 23,210 | $0.0455 | 6 s | Proposed change:   1. Call Instructor records "Teacher" and "Teachers"   2. Change the text models.Session.fields.instructor.label to "Teacher" Call Instructor records "Teacher" and "Teachers". Undo with: smithable undo |
| vat-in-list | claude-haiku-5-5>claude-sonnet-5-5 | right | 23,185 | $0.0022 | 6 s | Proposed change:   1. Add field vatNumber (string) to Customer, shown in its list Add field vatNumber (string) to Customer, shown in its list. Undo with: smithable undo |
| first-last-name | claude-haiku-5-5>claude-sonnet-5-5 | **no change** | 18,814 | $0.0018 | 5 s | Should customers get a first name and a last name in place of the current name field, or be added alongside it?   - Replace name with first name and last name (existing names would need to be split and the name field rem |
| owner-of-order | claude-haiku-5-5>claude-sonnet-5-5 | **wrong** | 23,409 | $0.0023 | 6 s | Proposed change:   1. Add field salesperson (User) to Order   2. Orders belong to their salesperson Add field salesperson (User) to Order. Undo with: smithable undo |
| orders-first-as-sales | claude-haiku-5-5>claude-sonnet-5-5 | **no change** | 23,753 | $0.0025 | 5 s | Should Orders be called Sales only in the menu and on the page, or should the records themselves be called Sales everywhere in the app?   - Only the menu entry and the page title: Orders becomes Sales in the menu, and re |
| big-orders-admins-only | claude-haiku-5-5>claude-sonnet-5-5 | right | 46,597 | $0.0469 | 10 s | Access here is set per model or page, not by a record's value, so I can't hide only the orders over 10 000 € from non-admins. The nearest thing is to limit all orders to admins (keep the orders page for admins only and m |
| vat-amount | claude-haiku-5-5>claude-sonnet-5-5 | right | 19,203 | $0.0019 | 6 s | Proposed change:   1. Add field vat (money = total * 0.25) to Invoice Add field vat (money = total * 0.25) to Invoice. Undo with: smithable undo |
| client-phone-search | claude-haiku-5-5>claude-sonnet-5-5 | right | 23,245 | $0.0023 | 8 s | Proposed change:   1. Add field phone (phone) to Client   2. Search clients by phone Add field phone (phone) to Client. Undo with: smithable undo |
| no-delete-sent | claude-haiku-5-5>claude-sonnet-5-5 | right | 47,005 | $0.0476 | 10 s | I can't stop deleting based on an invoice's status here: access rules say who may delete, not when. The nearest options are to keep deleted invoices in a trash for thirty days so they can be restored, or to enforce 'no d |
| staff-posts | claude-haiku-5-5>claude-sonnet-5-5 | right | 23,324 | $0.0023 | 5 s | Who should count as "our team" for posting incidents?   - Admins only: only administrators can create, change and delete incidents; everyone else can read them.   - A new role called "team": I add it with a description,  |
| home-says-what | claude-haiku-5-5>claude-sonnet-5-5 | **no change** | 20,255 | $0.0020 | 5 s | Where on the home page should "we keep the Pulse payment API running around the clock" go?   - Replace the hero's headline (the large title at the top of the home page)   - Replace the hero's subtitle (the line under the |
| room-choice | claude-haiku-5-5>claude-sonnet-5-5 | right | 38,227 | $0.0037 | 9 s | Proposed change:   1. Add field room (studio1 \| studio2) to Session Add field room (studio1 \| studio2) to Session. Undo with: smithable undo |
| teachers-not-instructors | claude-haiku-5-5>claude-sonnet-5-5 | right | 23,254 | $0.0023 | 9 s | Proposed change:   1. Call Instructor records "teacher" and "teachers" Call Instructor records "teacher" and "teachers". Undo with: smithable undo |
| vat-in-list | mistral-small-latest | right | 17,351 | $0.0026 | 3 s | Proposed change:   1. Add field vatNumber (string) to Customer, shown in its list Add field vatNumber (string) to Customer, shown in its list. Undo with: smithable undo |
| first-last-name | mistral-small-latest | **no change** | 70,218 | $0.0107 | 9 s | No model found a change that applies. changeField: Customer.name has no value "" to replace. Values: . |
| owner-of-order | mistral-small-latest | **wrong** | 34,655 | $0.0052 | 6 s | Proposed change:   1. Add field handledBy (User) to Order   2. Orders belong to their handled by Add field handledBy (User) to Order. Undo with: smithable undo |
| orders-first-as-sales | mistral-small-latest | right | 17,371 | $0.0026 | 3 s | Proposed change:   1. Set the main menu to orders, customers, team   2. Change the text pages.orders.title to "Sales" Set the main menu to orders, customers, team. Undo with: smithable undo |
| big-orders-admins-only | mistral-small-latest | right | 52,079 | $0.0079 | 13 s | No model found a change that applies. smithable answered 429: {"object":"error","message":"Rate limit exceeded","type":"rate_limited","param":null,"code":"1300","raw_status_code":429} |
| vat-amount | mistral-small-latest | **no change** | 0 | $0.0000 | 8 s | No model was used No model found a change that applies. smithable answered 429: {"object":"error","message":"Rate limit exceeded","type":"rate_limited","param":null,"code":"1300","raw_status_code":429} |
| client-phone-search | mistral-small-latest | **no change** | 0 | $0.0000 | 8 s | No model was used No model found a change that applies. smithable answered 429: {"object":"error","message":"Rate limit exceeded","type":"rate_limited","param":null,"code":"1300","raw_status_code":429} |
| no-delete-sent | mistral-small-latest | right | 0 | $0.0000 | 8 s | No model was used No model found a change that applies. smithable answered 429: {"object":"error","message":"Rate limit exceeded","type":"rate_limited","param":null,"code":"1300","raw_status_code":429} |
| staff-posts | mistral-small-latest | **wrong** | 52,031 | $0.0079 | 16 s | Proposed change:   1. Everyone sees and changes only their own records   2. Set roles team (new users: team)   3. team may read everyone's incidents |
| home-says-what | mistral-small-latest | right | 14,860 | $0.0023 | 3 s | Proposed change:   1. Change the text pages.home.subtitle to "We keep the Pulse payment API running around the clock." Change the text pages.home.subtitle to "We keep the Pulse payment API running around the clock.". Und |
| room-choice | mistral-small-latest | right | 28,236 | $0.0043 | 11 s | Proposed change:   1. Add field studio (studio1 \| studio2) to Session Add field studio (studio1 \| studio2) to Session. Undo with: smithable undo |
| teachers-not-instructors | mistral-small-latest | right | 17,276 | $0.0026 | 8 s | Proposed change:   1. Rename Instructor to Teacher   2. Rename Session.instructor to teacher   3. Rename page instructors to teachers; its address is now /teachers |
| vat-in-list | mistral-medium-latest | right | 17,351 | $0.0263 | 19 s | Proposed change:   1. Add field vatNumber (string) to Customer, shown in its list Add field vatNumber (string) to Customer, shown in its list. Undo with: smithable undo |
| first-last-name | mistral-medium-latest | right | 28,085 | $0.0433 | 15 s | Proposed change:   1. Change Customer.name to string   2. Add field firstName (string) to Customer   3. Add field lastName (string) to Customer |
| owner-of-order | mistral-medium-latest | **wrong** | 17,306 | $0.0263 | 12 s | Proposed change:   1. Add field salesperson (User) to Order   2. Orders belong to their salesperson   3. Everyone sees and changes only their own records |
| orders-first-as-sales | mistral-medium-latest | **wrong** | 17,350 | $0.0263 | 10 s | Proposed change:   1. Rename page orders to sales; its address is now /sales   2. Set the main menu to sales, customers, team Rename page orders to sales; its address is now /sales. Undo with: smithable undo |
| big-orders-admins-only | mistral-medium-latest | right | 86,856 | $0.1327 | 36 s | No model found a change that applies. setPublicWhere: Order is not public to read; add it with setPublic read first. |
| vat-amount | mistral-medium-latest | right | 14,111 | $0.0215 | 8 s | Proposed change:   1. Add field vat (money = total * 0.25) to Invoice, shown in its list Add field vat (money = total * 0.25) to Invoice, shown in its list. Undo with: smithable undo |
| client-phone-search | mistral-medium-latest | right | 17,296 | $0.0264 | 14 s | Proposed change:   1. Add field phone (phone) to Client   2. Search clients by name, email, phone Add field phone (phone) to Client. Undo with: smithable undo |
| no-delete-sent | mistral-medium-latest | **wrong** | 17,341 | $0.0263 | 9 s | Proposed change:   1. Set Invoice.status's rules: locked when status is sent or paid or overdue Set Invoice.status's rules: locked when status is sent or paid or overdue. Undo with: smithable undo |
| staff-posts | mistral-medium-latest | **wrong** | 17,309 | $0.0267 | 8 s | Proposed change:   1. Everyone signed in sees and changes every record   2. Set roles team (new users: team)   3. team may change everyone's incidents |
| home-says-what | mistral-medium-latest | right | 14,860 | $0.0226 | 8 s | Proposed change:   1. Change the text pages.home.subtitle to "We keep the Pulse payment API running around the clock." Change the text pages.home.subtitle to "We keep the Pulse payment API running around the clock.". Und |
| room-choice | mistral-medium-latest | right | 28,219 | $0.0429 | 18 s | Proposed change:   1. Add field studio (studio1 \| studio2) to Session Add field studio (studio1 \| studio2) to Session. Undo with: smithable undo |
| teachers-not-instructors | mistral-medium-latest | right | 17,276 | $0.0266 | 12 s | Proposed change:   1. Rename Instructor to Teacher   2. Rename Session.instructor to teacher   3. Rename page instructors to teachers; its address is now /teachers |

The apps are in /tmp/smithable-bench-changes-Mxwe4a.
