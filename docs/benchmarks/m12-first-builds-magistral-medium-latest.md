# M12 first builds: magistral-medium-latest (2026-09-28)

Ten app descriptions, each started with `smithable new --describe` (the closest starter, adapted by the model; errors go back up to twice). Totals: 6 / 10 created, 5 type-check, 162,841 tokens, €0.0000.

| Description | Starter | Created | Type-checks | Tokens | Cost | Time |
|---|---|---|---|---|---|---|
| A booking site for a yoga studio, with classes, teachers and online booking. | booking | yes | yes | 10,745 | €0.0000 | 15 s |
| A CRM for a small sales team: companies, contacts, deals and follow-ups. | crm | yes | yes | 12,225 | €0.0000 | 19 s |
| Invoicing for freelancers, with clients, invoices and payments. | invoicing | yes | yes | 22,393 | €0.0000 | 32 s |
| A tool library where neighbours lend each other tools. | crm | yes | **no** | 16,724 | €0.0000 | 19 s |
| An inventory app for a small bakery: ingredients, suppliers and stock levels. | booking | **no** | **no** | 15,697 | €0.0000 | 12 s |
| A job board for a local union, with job posts and applications. | crm | **no** | **no** | 17,149 | €0.0000 | 15 s |
| A football club's site: teams, players, matches and results. | booking | yes | yes | 15,847 | €0.0000 | 18 s |
| Event registration for a conference: talks, speakers and attendees. | booking | **no** | **no** | 17,199 | €0.0000 | 15 s |
| A help desk for an IT team: tickets, priorities and who handles them. | invoicing | yes | yes | 18,117 | €0.0000 | 19 s |
| A recipe collection for a family, with ingredients and shopping lists. | crm | **no** | **no** | 16,745 | €0.0000 | 13 s |

## Summaries, for review

### 1. A booking site for a yoga studio, with classes, teachers and online booking.

```text
Stillwater Yoga
  Class schedule and online booking for a small yoga studio.

Class types
  Class types have a name (required), a summary, a level (all levels, beginner or advanced, all levels by default) and duration minutes (a whole number, required, 60 by default).
  Only admins can add class types.

Instructors
  Instructors have a name (required) and a bio.
  Only admins can add instructors.

Sessions
  Sessions have a class type (a class type, required), an instructor (an instructor, required), a starts at (a date and time, required) and a capacity (a whole number, required, 12 by default).
  Only admins can add sessions.
  Rule: A session never has more confirmed bookings than its capacity.

Pages
  Home (a landing page: hero, classes, faq and call to action), Class schedule (lists sessions), Class types (lists class types; only for admins) and Instructors (lists instructors; only for admins).

Sign-in and access
  People sign in with Google or Facebook.
  Everyone sees and changes only their own records.
  Roles: admin (Studio staff. Manage the schedule, classes and teachers); member (A student who books classes). New users get the member role.
  Open to anyone without signing in: the home page, the sessions page, reading class types, reading instructors and reading sessions.
Generated 71 files (71 changed, 0 removed).
No config path provided, using default 'drizzle.config.ts'
Reading config file '/tmp/smithable-bench-m12-sZ9nOh/app-1/drizzle.config.ts'
7 tables
account 13 columns 1 indexes 1 fks
class_types 8 columns 0 indexes 1 fks
instructors 6 columns 0 indexes 1 fks
session 8 columns 2 indexes 1 fks
sessions 8 columns 0 indexes 3 fks
user 8 columns 1 indexes 0 fks
verification 6 columns 1 indexes 0 fks

[✓] Your SQL migration file ➜ drizzle/0000_flat_warpath.sql 🚀

Created /tmp/smithable-bench-m12-sZ9nOh/app-1. Start it with:

  cd /tmp/smithable-bench-m12-sZ9nOh/app-1
  smithable run
(node:1367832) Warning: Accessing non-existent property 'replaceRouteChunk' of module exports inside circular dependency
(Use `node --trace-warnings ...` to show where the warning was created)
```

### 2. A CRM for a small sales team: companies, contacts, deals and follow-ups.

```text
Sales CRM
  Lightweight CRM for a small sales team to manage companies, contacts, deals, and follow-ups.

Companies
  Companies have a name (required), an industry/sector, a website (a web address), a phone, an email, address and notes.
  Each company can have an account manager (a user).
  The account manager owns the company.
  Only sales users and admins can change companies.
  Only admins can delete companies.

Contacts
  Contacts have a first name (required), a last name (required), an email, a phone, a position, a company (a company, required) and notes.
  Each contact can have an assigned to (a user).
  The assigned to owns the contact.
  Only sales users and admins can change contacts.
  Only admins can delete contacts.

Deals
  Deals have a name (required), a company (a company, required), a contact (a contact), a value (an amount, required), a stage (lead, qualified, proposal, negotiation, closed won or closed lost, lead by default), a close date and notes.
  Each deal can have an assigned to (a user).
  The assigned to owns the deal.
  Only sales users and admins can change deals.
  Only admins can delete deals.

Follow ups
  Follow ups have a title (required), a deal (a deal), a contact (a contact), a due date (required), status (pending, completed or cancelled, pending by default) and notes.
  Each follow up can have an assigned to (a user).
  The assigned to owns the follow up.
  Only sales users and admins can change follow ups.
  Only admins can delete follow ups.

Pages
  Companies (lists companies; search by name or email), Contacts (lists contacts; search by first name, last name, email or company), Deals (lists deals; search by name, company or stage) and Followups (lists follow ups; search by title or status).

Sign-in and access
  People sign in with Google.
  Everyone who signs in sees all records, and changes and deletes the ones they own.
  Roles: admin (Sales management. Full access); sales (Sales team member. Manages companies, contacts, deals, and follow-ups). New users get the sales role.
Generated 76 files (76 changed, 0 removed).
No config path provided, using default 'drizzle.config.ts'
Reading config file '/tmp/smithable-bench-m12-sZ9nOh/app-2/drizzle.config.ts'
8 tables
account 13 columns 1 indexes 1 fks
companies 11 columns 0 indexes 1 fks
contacts 11 columns 0 indexes 2 fks
deals 11 columns 0 indexes 3 fks
follow_ups 10 columns 0 indexes 3 fks
session 8 columns 2 indexes 1 fks
user 8 columns 1 indexes 0 fks
verification 6 columns 1 indexes 0 fks

[✓] Your SQL migration file ➜ drizzle/0000_safe_doctor_octopus.sql 🚀

Created /tmp/smithable-bench-m12-sZ9nOh/app-2. Start it with:

  cd /tmp/smithable-bench-m12-sZ9nOh/app-2
  smithable run
/tmp/smithable-bench-m12-sZ9nOh/app-2/smithable.auth.yml:6:16  warning  With shared access and no allowedDomains, anyone with an account at the sign-in provider can sign up and read all records.
    hint: Restrict sign-in with "allowedDomains" under "signIn", or use "defaultAccess: private".
(node:1368339) Warning: Accessing non-existent property 'replaceRouteChunk' of module exports inside circular dependency
(Use `node --trace-warnings ...` to show where the warning was created)
```

### 3. Invoicing for freelancers, with clients, invoices and payments.

```text
Invoicely
  Simple invoicing for freelancers. Each user manages their own clients and invoices.

Business profiles
  Business profiles have a business name (required), a vat number, an iban, a days to pay (a whole number, required, 30 by default) and a footer text.

Clients
  Clients have a name (required), an email (required), address and a vat number.
  Each client lists its invoices.

Invoices
  Invoices have an invoice number (required, unique), a client (a client, required), an issued on (a date, required, TODAY() by default), a due on (a date, required, DATEADD(issuedOn, 30, "day") by default) and status (draft, sent, paid or overdue, draft by default).
  Each invoice lists its invoice lines.
  The total is calculated: SUM(lines.amount).
  Rule: Invoice numbers are sequential per user, like 2026-001, 2026-002.
  Rule: A sent or paid invoice can no longer be edited, only credited.

Invoice lines
  Invoice lines have an invoice (an invoice, required), a description (required), a quantity (a number, required, 1 by default) and an unit price (an amount, required).
  The amount is calculated: quantity * unitPrice.

Pages
  Home (a landing page: hero, features, pricing, faq and call to action), Overview (a dashboard: outstanding, overdue, paid, invoiced and latest), Invoices (lists invoices; search by invoice number or client), Clients (lists clients; search by name or email), Settings (settings: edits your business profile) and Welcome (a first-time setup of your business profile in 2 steps).

Sign-in and access
  People sign in with Google.
  Everyone sees and changes only their own records.
  Roles: admin (Invoicely staff); member (A freelancer using Invoicely). New users get the member role.
  Open to anyone without signing in: the home page.
Generated 78 files (78 changed, 0 removed).
No config path provided, using default 'drizzle.config.ts'
Reading config file '/tmp/smithable-bench-m12-sZ9nOh/app-3/drizzle.config.ts'
8 tables
account 13 columns 1 indexes 1 fks
business_profiles 9 columns 0 indexes 1 fks
clients 8 columns 0 indexes 1 fks
invoice_lines 9 columns 0 indexes 2 fks
invoices 10 columns 1 indexes 2 fks
session 8 columns 2 indexes 1 fks
user 8 columns 1 indexes 0 fks
verification 6 columns 1 indexes 0 fks

[✓] Your SQL migration file ➜ drizzle/0000_modern_avengers.sql 🚀

Created /tmp/smithable-bench-m12-sZ9nOh/app-3. Start it with:

  cd /tmp/smithable-bench-m12-sZ9nOh/app-3
  smithable run
(node:1368917) Warning: Accessing non-existent property 'replaceRouteChunk' of module exports inside circular dependency
(Use `node --trace-warnings ...` to show where the warning was created)
```

### 4. A tool library where neighbours lend each other tools.

```text
Tool Library
  A tool library where neighbours lend each other tools.

Tools
  Tools have a name (required), a description, a category, a condition (new, good, fair or poor, new by default), an available (yes or no, required, true by default) and an image (a web address).
  Each tool can have a lender (a user).
  The lender owns the tool.

Bookings
  Bookings have a tool (a tool, required), a start date (required), an end date (required), status (pending, approved, active, returned or cancelled, pending by default) and notes.
  Each booking can have a borrower (a user).
  The borrower owns the booking.

Pages
  Home (a landing page: hero and call to action), Tools (lists tools; search by name, category or condition) and Bookings (lists bookings; search by tool, borrower or status).

Sign-in and access
  People sign in with Google.
  Everyone who signs in sees all records, and changes and deletes the ones they own.
  Roles: admin (Manages the tool library and all bookings); member (Can lend and borrow tools). New users get the member role.
  Open to anyone without signing in: the home page.
Generated 67 files (67 changed, 0 removed).
No config path provided, using default 'drizzle.config.ts'
Reading config file '/tmp/smithable-bench-m12-sZ9nOh/app-4/drizzle.config.ts'
6 tables
account 13 columns 1 indexes 1 fks
bookings 9 columns 0 indexes 2 fks
session 8 columns 2 indexes 1 fks
tools 10 columns 0 indexes 1 fks
user 8 columns 1 indexes 0 fks
verification 6 columns 1 indexes 0 fks

[✓] Your SQL migration file ➜ drizzle/0000_lovely_punisher.sql 🚀

Created /tmp/smithable-bench-m12-sZ9nOh/app-4. Start it with:

  cd /tmp/smithable-bench-m12-sZ9nOh/app-4
  smithable run
/tmp/smithable-bench-m12-sZ9nOh/app-4/smithable.auth.yml:6:16  warning  With shared access and no allowedDomains, anyone with an account at the sign-in provider can sign up and read all records.
    hint: Restrict sign-in with "allowedDomains" under "signIn", or use "defaultAccess: private".
(node:1369409) Warning: Accessing non-existent property 'replaceRouteChunk' of module exports inside circular dependency
(Use `node --trace-warnings ...` to show where the warning was created)
```

### 5. An inventory app for a small bakery: ingredients, suppliers and stock levels.

Failed:

```text
Starting from the booking starter.
Smithable model (magistral-medium-latest) · 15,697 tokens · €0.0000
No model drafted a valid project.
smithable.content.yml:6:15  error  Field "Ingredient.unit" is not a choice field, so it has no values.
Without a model, start from a starter: smithable new /tmp/smithable-bench-m12-sZ9nOh/app-5 --starter booking

```

### 6. A job board for a local union, with job posts and applications.

Failed:

```text
Starting from the crm starter.
Smithable model (magistral-medium-latest) · 17,149 tokens · €0.0000
No model drafted a valid project.
smithable.content.yml:22:7  error  Unknown key "subtitle" in "callToAction" of page "home".
Without a model, start from a starter: smithable new /tmp/smithable-bench-m12-sZ9nOh/app-6 --starter crm

```

### 7. A football club's site: teams, players, matches and results.

```text
Football Club
  A football club's site for managing teams, players, matches, and results.

Teams
  Teams have a name (required), a coach and a division.

Players
  Players have a name (required), a position, a team (a team, required) and a jersey number (a whole number).

Matches
  Matches have a home team (a team, required), an away team (a team, required), a match date (required), a location, a home score (a whole number), an away score (a whole number) and status (scheduled, played or canceled, scheduled by default).

Pages
  Home (a landing page: hero, features and call to action), Teams (lists teams), Players (lists players; search by name, position or team) and Matches (lists matches; search by home team, away team or status).

Sign-in and access
  People sign in with Google.
  Everyone sees and changes only their own records.
  Roles: admin (Club administrator. Manages teams, players, and matches); coach (Team coach. Manages players and matches for their team); player (A player in the club). New users get the player role.
  Open to anyone without signing in: the home page, reading teams, reading players and reading matches.
Generated 71 files (71 changed, 0 removed).
No config path provided, using default 'drizzle.config.ts'
Reading config file '/tmp/smithable-bench-m12-sZ9nOh/app-7/drizzle.config.ts'
7 tables
account 13 columns 1 indexes 1 fks
matches 11 columns 0 indexes 3 fks
players 8 columns 0 indexes 2 fks
session 8 columns 2 indexes 1 fks
teams 7 columns 0 indexes 1 fks
user 8 columns 1 indexes 0 fks
verification 6 columns 1 indexes 0 fks

[✓] Your SQL migration file ➜ drizzle/0000_secret_black_crow.sql 🚀

Created /tmp/smithable-bench-m12-sZ9nOh/app-7. Start it with:

  cd /tmp/smithable-bench-m12-sZ9nOh/app-7
  smithable run
(node:1370067) Warning: Accessing non-existent property 'replaceRouteChunk' of module exports inside circular dependency
(Use `node --trace-warnings ...` to show where the warning was created)
```

### 8. Event registration for a conference: talks, speakers and attendees.

Failed:

```text
Starting from the booking starter.
Smithable model (magistral-medium-latest) · 17,199 tokens · €0.0000
No model drafted a valid project.
smithable.content.yml:6:15  error  Field "Talk.room" is not a choice field, so it has no values.
smithable.ux.yml:4:11  error  There is no theme preset "professional".
    hint: Available: modern, minimal, playful, corporate.
smithable.ux.yml:15:39  error  Attendee has no field named "talks" to show.
Without a model, start from a starter: smithable new /tmp/smithable-bench-m12-sZ9nOh/app-8 --starter booking

```

### 9. A help desk for an IT team: tickets, priorities and who handles them.

```text
IT Help Desk
  A help desk for an IT team to manage tickets, priorities, and assignments.

Tickets
  Tickets have a title (required), a description, status (open, in progress, resolved or closed, open by default), a priority (low, medium or high, low by default), an assigned to and a created on (a date, required, TODAY() by default).

Pages
  Home (a landing page: hero, features, faq and call to action) and Tickets (lists tickets; search by title, assigned to or priority; only for agent users and admins).

Sign-in and access
  People sign in with Google.
  Everyone sees and changes only their own records.
  Roles: admin (Manages the help desk and all tickets); agent (Handles and resolves tickets). New users get the agent role.
  Open to anyone without signing in: the home page.
Generated 62 files (62 changed, 0 removed).
No config path provided, using default 'drizzle.config.ts'
Reading config file '/tmp/smithable-bench-m12-sZ9nOh/app-9/drizzle.config.ts'
5 tables
account 13 columns 1 indexes 1 fks
session 8 columns 2 indexes 1 fks
tickets 10 columns 0 indexes 1 fks
user 8 columns 1 indexes 0 fks
verification 6 columns 1 indexes 0 fks

[✓] Your SQL migration file ➜ drizzle/0000_perpetual_sleeper.sql 🚀

Created /tmp/smithable-bench-m12-sZ9nOh/app-9. Start it with:

  cd /tmp/smithable-bench-m12-sZ9nOh/app-9
  smithable run
(node:1370647) Warning: Accessing non-existent property 'replaceRouteChunk' of module exports inside circular dependency
(Use `node --trace-warnings ...` to show where the warning was created)
```

### 10. A recipe collection for a family, with ingredients and shopping lists.

Failed:

```text
Starting from the crm starter.
Smithable model (magistral-medium-latest) · 16,745 tokens · €0.0000
No model drafted a valid project.
smithable.content.yml:21:7  error  Unknown key "subtitle" in "callToAction" of page "home".
smithable.ux.yml:20:3  error  ShoppingItem.purchased is not a choice field.
Without a model, start from a starter: smithable new /tmp/smithable-bench-m12-sZ9nOh/app-10 --starter crm

```
