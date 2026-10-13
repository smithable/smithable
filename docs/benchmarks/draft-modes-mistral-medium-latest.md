# First drafts, files against operations: mistral-medium-latest (2026-09-30)

11 descriptions (the M12 ten and one more), each drafted as whole files adapted from the closest starter and as a batch of operations from an empty app (docs/design/first-build.md, 2.7). Valid means the draft is an app Smithable accepts.

- files: 11 / 11 valid, 118,006 tokens, €0.074, 94 s
- operations: 11 / 11 valid, 58,008 tokens, €0.035, 55 s

| Description | Mode | Valid | Name | Models (fields) | Pages | Ops | Tokens | Time | Problem |
|---|---|---|---|---|---|---|---|---|---|
| A booking site for a yoga studio, with classes, teachers and online booking. | files | yes | Stillwater Yoga | ClassType (4), Instructor (2), Session (4), Message (3) | landing, calendar, crud, crud, crud, crud, data |  | 6,321 | 7 s |  |
| A booking site for a yoga studio, with classes, teachers and online booking. | operations | yes | Stillwater Yoga | Teacher (4), Class (8), Booking (4) | crud, crud, crud, landing | 21 | 4,039 | 5 s |  |
| A CRM for a small sales team: companies, contacts, deals and follow-ups. | files | yes | Sales CRM | Company (8), Contact (8), Deal (8), FollowUp (7) | crud, crud, crud, crud, users |  | 13,037 | 12 s |  |
| A CRM for a small sales team: companies, contacts, deals and follow-ups. | operations | yes | Sales CRM | Company (5), Contact (6), Deal (6), FollowUp (5) | crud, crud, crud, crud | 22 | 4,049 | 5 s |  |
| Invoicing for freelancers, with clients, invoices and payments. | files | yes | Invoicely | BusinessProfile (5), Client (5), Invoice (7), InvoiceLine (5) | landing, dashboard, crud, crud, settings, onboarding |  | 6,694 | 7 s |  |
| Invoicing for freelancers, with clients, invoices and payments. | operations | yes | Freelancer Invoicing | Client (4), Invoice (7), Payment (5) | crud, crud, crud | 16 | 3,835 | 4 s |  |
| A tool library where neighbours lend each other tools. | files | yes | Tool Library | Tool (7), Booking (6) | landing, crud, crud |  | 11,619 | 9 s |  |
| A tool library where neighbours lend each other tools. | operations | yes | Neighbourhood Tool Library | Loan (6), Tool (5) | crud, crud | 15 | 7,903 | 6 s |  |
| An inventory app for a small bakery: ingredients, suppliers and stock levels. | files | yes | Bakery Inventory | Ingredient (3), Supplier (4), Stock (4) | landing, crud, crud, crud |  | 11,796 | 7 s |  |
| An inventory app for a small bakery: ingredients, suppliers and stock levels. | operations | yes | Bakery Inventory | Ingredient (4), Supplier (5), Stock (6) | crud, crud, crud | 13 | 3,702 | 3 s |  |
| A job board for a local union, with job posts and applications. | files | yes | Local Union Job Board | JobPost (7), Application (7) | landing, crud, crud, crud |  | 12,460 | 10 s |  |
| A job board for a local union, with job posts and applications. | operations | yes | Local Union Job Board | JobPost (8), Application (5) | crud, crud, users | 23 | 4,035 | 5 s |  |
| A football club's site: teams, players, matches and results. | files | yes | Football Club | Team (3), Player (4), Match (6) | landing, crud, crud, crud |  | 10,665 | 8 s |  |
| A football club's site: teams, players, matches and results. | operations | yes | Football Club | Team (4), Player (6), Match (7) | crud, crud, crud, landing | 19 | 3,953 | 5 s |  |
| Event registration for a conference: talks, speakers and attendees. | files | yes | Conference Registration | Talk (6), Speaker (4), Attendee (4) | landing, crud, crud, crud, crud |  | 10,825 | 9 s |  |
| Event registration for a conference: talks, speakers and attendees. | operations | yes | Conference Events | Speaker (4), Talk (7), Attendee (3) | crud, crud, crud | 16 | 11,791 | 8 s |  |
| A help desk for an IT team: tickets, priorities and who handles them. | files | yes | IT Help Desk | Ticket (6) | landing, crud, dashboard |  | 20,116 | 16 s |  |
| A help desk for an IT team: tickets, priorities and who handles them. | operations | yes | IT Help Desk | Ticket (6) | crud | 15 | 3,830 | 4 s |  |
| A recipe collection for a family, with ingredients and shopping lists. | files | yes | Family Recipes | Recipe (5), Ingredient (3), ShoppingList (3) | landing, crud, crud, crud |  | 4,861 | 4 s |  |
| A recipe collection for a family, with ingredients and shopping lists. | operations | yes | Family Recipes | Recipe (7), Ingredient (4), ShoppingList (4), ShoppingItem (5) | crud, crud | 15 | 3,784 | 4 s |  |
| I want a site where I can show my dogs. Each dog should have a gallery and some information about it. | files | yes | My Dogs | Dog (3) | landing, crud |  | 9,612 | 5 s |  |
| I want a site where I can show my dogs. Each dog should have a gallery and some information about it. | operations | yes | My Dogs | Dog (4) | landing, crud | 6 | 7,087 | 6 s |  |
