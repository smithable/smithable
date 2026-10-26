# First drafts, files against operations: claude-haiku-5-5 (2026-10-26)

11 descriptions (the M12 ten and one more), each drafted as whole files adapted from the closest starter and as a batch of operations from an empty app (docs/design/first-build.md, 2.7). Valid means the draft is an app Smithable accepts.

- files: 11 / 11 valid, 362,022 tokens, €0.058, 235 s
- operations: 11 / 11 valid, 465,532 tokens, €0.029, 211 s

| Description | Mode | Valid | Name | Models (fields) | Pages | Ops | Tokens | Time | Problem |
|---|---|---|---|---|---|---|---|---|---|
| A booking site for a yoga studio, with classes, teachers and online booking. | files | yes | Calm Yoga Studio | ClassType (5), Instructor (3), Session (6), Booking (2) | landing, calendar, crud, crud, crud, crud |  | 30,441 | 30 s |  |
| A booking site for a yoga studio, with classes, teachers and online booking. | operations | yes | Stillwater Yoga | Teacher (3), Booking (2), YogaClass (6) | landing, crud, crud, legal, users, crud | 30 | 113,093 | 50 s |  |
| A CRM for a small sales team: companies, contacts, deals and follow-ups. | files | yes | Sales CRM | Company (4), Contact (4), Deal (5), FollowUp (5) | dashboard, crud, crud, crud, crud, users |  | 45,447 | 24 s |  |
| A CRM for a small sales team: companies, contacts, deals and follow-ups. | operations | yes | Pipeline | Company (4), Contact (5), Deal (6), FollowUp (4) | crud, crud, crud, crud, users | 20 | 27,072 | 13 s |  |
| Invoicing for freelancers, with clients, invoices and payments. | files | yes | Invoicely | BusinessProfile (5), Client (5), Invoice (8), InvoiceLine (5), Payment (4) | landing, dashboard, crud, crud, crud, crud, settings, onboarding |  | 53,964 | 35 s |  |
| Invoicing for freelancers, with clients, invoices and payments. | operations | yes | Freelance Invoices | Client (4), Invoice (8), Payment (4) | crud, crud, crud | 21 | 27,068 | 11 s |  |
| A tool library where neighbors lend each other tools. | files | yes | Tool Library | Tool (5), Loan (5) | crud, crud |  | 42,904 | 19 s |  |
| A tool library where neighbors lend each other tools. | operations | yes | Tool Library | Loan (6), Tool (5) | landing, crud, users, legal, crud | 25 | 54,737 | 23 s |  |
| An inventory app for a small bakery: ingredients, suppliers and stock levels. | files | yes | Bakery Stock | Supplier (4), Ingredient (5) | crud, crud, users |  | 21,962 | 14 s |  |
| An inventory app for a small bakery: ingredients, suppliers and stock levels. | operations | yes | Bakery Stock | Supplier (4), Ingredient (5) | crud, crud, users | 15 | 26,271 | 9 s |  |
| A job board for a local union, with job posts and applications. | files | yes | Union Jobs | Job (8), Application (5) | landing, crud, crud, crud |  | 24,057 | 22 s |  |
| A job board for a local union, with job posts and applications. | operations | yes | Union Job Board | JobPost (6), Application (5) | landing, crud, crud, legal | 14 | 28,018 | 18 s |  |
| A football club's site: teams, players, matches and results. | files | yes | Club | Team (3), Player (4), Match (7) | landing, crud, crud, crud |  | 24,349 | 23 s |  |
| A football club's site: teams, players, matches and results. | operations | yes | Northfield FC | Team (3), Player (5), Match (8) | landing, crud, crud, crud, users | 19 | 27,045 | 13 s |  |
| Event registration for a conference: talks, speakers and attendees. | files | yes | Conference | Speaker (3), Talk (5), Attendee (3), Registration (3) | landing, crud, crud, crud, crud |  | 23,141 | 17 s |  |
| Event registration for a conference: talks, speakers and attendees. | operations | yes | Riverside Conference | Speaker (3), Talk (6), Attendee (4) | landing, crud, crud, crud, users, legal | 22 | 28,481 | 19 s |  |
| A help desk for an IT team: tickets, priorities and who handles them. | files | yes | HelpDesk | Ticket (8) | dashboard, crud |  | 48,811 | 26 s |  |
| A help desk for an IT team: tickets, priorities and who handles them. | operations | yes | Helpdesk | Ticket (6), Message (2) | crud, users | 16 | 81,201 | 37 s |  |
| A recipe collection for a family, with ingredients and shopping lists. | files | yes | Family Recipes | Recipe (5), ShoppingItem (3) | crud, crud |  | 21,710 | 12 s |  |
| A recipe collection for a family, with ingredients and shopping lists. | operations | yes | Family Recipes | Recipe (6), Ingredient (3), ShoppingList (2), ShoppingItem (3) | crud, crud, users | 17 | 26,395 | 9 s |  |
| I want a site where I can show my dogs. Each dog should have a gallery and some information about it. | files | yes | Our Dogs | Dog (5) | landing, crud |  | 25,236 | 13 s |  |
| I want a site where I can show my dogs. Each dog should have a gallery and some information about it. | operations | yes | My Dogs | Dog (6) | landing, crud | 7 | 26,151 | 9 s |  |
