# First drafts, files against operations: claude-sonnet-5-5 (2026-10-26)

11 descriptions (the M12 ten and one more), each drafted as whole files adapted from the closest starter and as a batch of operations from an empty app (docs/design/first-build.md, 2.7). Valid means the draft is an app Smithable accepts.

- files: 11 / 11 valid, 312,859 tokens, $0.856, 229 s
- operations: 10 / 11 valid, 471,094 tokens, $0.374, 158 s

| Description | Mode | Valid | Name | Models (fields) | Pages | Ops | Tokens | Time | Problem |
|---|---|---|---|---|---|---|---|---|---|
| A booking site for a yoga studio, with classes, teachers and online booking. | files | yes | Lotus Yoga | ClassType (5), Instructor (4), Session (6), Booking (2) | landing, calendar, crud, crud, crud, crud |  | 26,104 | 22 s |  |
| A booking site for a yoga studio, with classes, teachers and online booking. | operations | yes | Stillpoint Yoga | Teacher (3), Session (7), Booking (1) | crud, landing, legal, crud, crud | 26 | 54,074 | 27 s |  |
| A CRM for a small sales team: companies, contacts, deals and follow-ups. | files | yes | Pipeline CRM | Company (8), Contact (6), Deal (8), FollowUp (7) | crud, crud, crud, crud, users |  | 22,050 | 21 s |  |
| A CRM for a small sales team: companies, contacts, deals and follow-ups. | operations | yes | Pipeline CRM | Company (7), Contact (6), Deal (9), FollowUp (7) | crud, crud, crud, crud, users | 27 | 25,731 | 7 s |  |
| Invoicing for freelancers, with clients, invoices and payments. | files | yes | Invoicely | BusinessProfile (5), Client (5), Invoice (9), Payment (5) | landing, dashboard, crud, crud, crud, settings, onboarding |  | 24,170 | 27 s |  |
| Invoicing for freelancers, with clients, invoices and payments. | operations | **no** |  |  |  |  | 129,382 | 16 s | Expected ',' or ']' after array element in JSON at position 207 (line 1 column 208) |
| A tool library where neighbors lend each other tools. | files | yes | Neighborhood Tool Library | Tool (6), Loan (6) | landing, crud, crud |  | 20,999 | 20 s |  |
| A tool library where neighbors lend each other tools. | operations | yes | Neighbor Tool Library | Loan (5), Tool (5) | crud, landing, legal, crud | 22 | 52,929 | 21 s |  |
| An inventory app for a small bakery: ingredients, suppliers and stock levels. | files | yes | Bakery Stock | Supplier (6), Ingredient (8) | crud, crud |  | 20,260 | 11 s |  |
| An inventory app for a small bakery: ingredients, suppliers and stock levels. | operations | yes | Bakery Stock | Supplier (5), Ingredient (10) | crud, crud, users | 13 | 51,626 | 13 s |  |
| A job board for a local union, with job posts and applications. | files | yes | Union Jobs | JobPost (7), Application (5) | landing, crud, crud, crud |  | 43,345 | 25 s |  |
| A job board for a local union, with job posts and applications. | operations | yes | Local Union Job Board | Job (7), Application (8) | crud, crud, landing, legal | 32 | 27,023 | 18 s |  |
| A football club's site: teams, players, matches and results. | files | yes | Football Club | Team (4), Player (4), Match (7) | landing, crud, crud, crud |  | 43,000 | 24 s |  |
| A football club's site: teams, players, matches and results. | operations | yes | Northside FC | Team (6), Player (5), Match (9) | crud, crud, crud, landing, legal, users | 26 | 26,477 | 14 s |  |
| Event registration for a conference: talks, speakers and attendees. | files | yes | Conference Desk | Speaker (5), Talk (7), Attendee (5), Registration (3) | landing, crud, crud, crud, crud |  | 43,919 | 28 s |  |
| Event registration for a conference: talks, speakers and attendees. | operations | yes | Conference Hub | Speaker (4), Talk (7), Registration (3) | crud, crud, crud, landing, legal | 26 | 26,919 | 17 s |  |
| A help desk for an IT team: tickets, priorities and who handles them. | files | yes | Deskly | Ticket (9) | dashboard, crud, users |  | 23,346 | 20 s |  |
| A help desk for an IT team: tickets, priorities and who handles them. | operations | yes | IT Help Desk | Ticket (10), Message (2) | crud, users | 22 | 25,546 | 6 s |  |
| A recipe collection for a family, with ingredients and shopping lists. | files | yes | Family Recipes | Recipe (9), Ingredient (3), ShoppingItem (5) | crud, crud, crud |  | 21,170 | 16 s |  |
| A recipe collection for a family, with ingredients and shopping lists. | operations | yes | Family Cookbook | Recipe (10), Ingredient (4), ShoppingList (3), ShoppingItem (5) | crud, crud, users | 18 | 25,882 | 11 s |  |
| I want a site where I can show my dogs. Each dog should have a gallery and some information about it. | files | yes | My Dogs | Dog (7) | landing, crud |  | 24,496 | 15 s |  |
| I want a site where I can show my dogs. Each dog should have a gallery and some information about it. | operations | yes | My Dogs | Dog (8) | crud, landing, legal | 12 | 25,505 | 8 s |  |
