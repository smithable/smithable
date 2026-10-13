# First drafts, files against operations: mistral-small-latest (2026-09-30)

11 descriptions (the M12 ten and one more), each drafted as whole files adapted from the closest starter and as a batch of operations from an empty app (docs/design/first-build.md, 2.7). Valid means the draft is an app Smithable accepts.

- files: 5 / 11 valid, 194,678 tokens, €0.027, 177 s
- operations: 10 / 11 valid, 90,802 tokens, €0.011, 58 s

| Description | Mode | Valid | Name | Models (fields) | Pages | Ops | Tokens | Time | Problem |
|---|---|---|---|---|---|---|---|---|---|
| A booking site for a yoga studio, with classes, teachers and online booking. | files | yes | Stillwater Yoga | ClassType (4), Instructor (2), Session (5), Booking (5), Message (3) | landing, calendar, crud, crud, crud, crud, crud, data |  | 14,518 | 14 s |  |
| A booking site for a yoga studio, with classes, teachers and online booking. | operations | yes | Yoga Studio Bookings | Teacher (5), Class (8), Booking (6) | crud, landing, crud, crud | 15 | 8,252 | 6 s |  |
| A CRM for a small sales team: companies, contacts, deals and follow-ups. | files | **no** |  |  |  |  | 21,289 | 21 s | smithable.yml:90:50  error  Deal.status has no value "prospecting \| qualified \| proposal \| negotiati |
| A CRM for a small sales team: companies, contacts, deals and follow-ups. | operations | yes | Sales CRM | Company (6), Contact (7), Deal (7), FollowUp (4) | crud, crud, crud, crud | 26 | 4,274 | 6 s |  |
| Invoicing for freelancers, with clients, invoices and payments. | files | yes | Invoicely | BusinessProfile (5), Client (5), Invoice (7), InvoiceLine (5) | landing, dashboard, crud, crud, settings, onboarding |  | 14,706 | 14 s |  |
| Invoicing for freelancers, with clients, invoices and payments. | operations | yes | Freelance Invoicing | Client (6), Invoice (7), Payment (6) | crud, crud, crud | 19 | 3,994 | 4 s |  |
| A tool library where neighbours lend each other tools. | files | yes | Tool Library | Tool (9), BorrowRequest (6) | landing, crud, crud, crud |  | 18,743 | 16 s |  |
| A tool library where neighbours lend each other tools. | operations | yes | Tool Library | Category (2), Borrowing (6), Tool (7) | crud, landing, crud, crud | 14 | 11,886 | 6 s |  |
| An inventory app for a small bakery: ingredients, suppliers and stock levels. | files | **no** |  |  |  |  | 21,799 | 20 s | smithable.yml:59:61  error  "where" compares choice fields with one of their values, and yes/no fiel |
| An inventory app for a small bakery: ingredients, suppliers and stock levels. | operations | yes | Bakery Inventory | Supplier (5), Ingredient (6), StockMovement (5) | crud, landing, crud, crud | 20 | 8,428 | 7 s |  |
| A job board for a local union, with job posts and applications. | files | **no** |  |  |  |  | 23,443 | 24 s | smithable.yml:33:15  error  Nested mappings are not allowed in compact mappings |
| A job board for a local union, with job posts and applications. | operations | yes | Union Job Board | Job (7), Application (4) | landing | 11 | 11,664 | 5 s |  |
| A football club's site: teams, players, matches and results. | files | yes | Football Club | Team (5), Player (9), Match (9), Result (8) | landing, crud, crud, crud, crud |  | 12,811 | 14 s |  |
| A football club's site: teams, players, matches and results. | operations | yes | Football Club | Team (5), Player (8), Fixture (6), Match (9) | crud, landing, crud, crud, crud | 14 | 12,062 | 8 s |  |
| Event registration for a conference: talks, speakers and attendees. | files | **no** |  |  |  |  | 18,153 | 17 s | smithable.yml:19:18  error  Attendee has no reference to Talk, so "Talk.attendees" cannot list anyth |
| Event registration for a conference: talks, speakers and attendees. | operations | yes | Conference Registration | Talk (7), Speaker (3), Attendee (5) | crud, crud, crud | 11 | 3,623 | 2 s |  |
| A help desk for an IT team: tickets, priorities and who handles them. | files | **no** |  |  |  |  | 20,810 | 15 s | smithable.yml:13:15  error  Field "Ticket.status": Choice value "in_progress" must start with a lowe |
| A help desk for an IT team: tickets, priorities and who handles them. | operations | **no** |  |  |  |  | 15,109 | 5 s | setApp: Edit produced invalid YAML: Implicit keys need to be on a single line at line 5, column 1: |
| A recipe collection for a family, with ingredients and shopping lists. | files | **no** |  |  |  |  | 18,575 | 16 s | smithable.yml:54:16  error  Section "records" of page "favourites" takes options or nothing. |
| A recipe collection for a family, with ingredients and shopping lists. | operations | yes | Family Recipes | Recipe (8), Ingredient (4), ShoppingList (3), ShoppingListItem (4) | crud, crud, crud | 21 | 3,997 | 5 s |  |
| I want a site where I can show my dogs. Each dog should have a gallery and some information about it. | files | yes | My Dogs | Dog (6) | landing, crud |  | 9,831 | 6 s |  |
| I want a site where I can show my dogs. Each dog should have a gallery and some information about it. | operations | yes | Dog Showcase | Dog (5) | landing, crud | 10 | 7,513 | 4 s |  |
