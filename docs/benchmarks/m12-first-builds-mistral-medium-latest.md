# M12 first builds: mistral-medium-latest (2026-09-28)

Ten app descriptions, each started with `smithable new --describe` (the closest starter, adapted by the model; errors go back up to twice). Totals: 10 / 10 created, 7 type-check, 120,252 tokens, €0.0000.

| Description | Starter | Created | Type-checks | Tokens | Cost | Time |
|---|---|---|---|---|---|---|
| A booking site for a yoga studio, with classes, teachers and online booking. | booking | yes | yes | 10,607 | €0.0000 | 15 s |
| A CRM for a small sales team: companies, contacts, deals and follow-ups. | crm | yes | **no** | 12,271 | €0.0000 | 18 s |
| Invoicing for freelancers, with clients, invoices and payments. | invoicing | yes | yes | 14,486 | €0.0000 | 23 s |
| A tool library where neighbours lend each other tools. | crm | yes | **no** | 10,777 | €0.0000 | 14 s |
| An inventory app for a small bakery: ingredients, suppliers and stock levels. | booking | yes | yes | 10,143 | €0.0000 | 14 s |
| A job board for a local union, with job posts and applications. | crm | yes | **no** | 11,057 | €0.0000 | 15 s |
| A football club's site: teams, players, matches and results. | booking | yes | yes | 10,733 | €0.0000 | 16 s |
| Event registration for a conference: talks, speakers and attendees. | booking | yes | yes | 17,339 | €0.0000 | 23 s |
| A help desk for an IT team: tickets, priorities and who handles them. | invoicing | yes | yes | 11,669 | €0.0000 | 14 s |
| A recipe collection for a family, with ingredients and shopping lists. | crm | yes | yes | 11,170 | €0.0000 | 16 s |

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
Reading config file '/tmp/smithable-bench-m12-XACanP/app-1/drizzle.config.ts'
7 tables
account 13 columns 1 indexes 1 fks
class_types 8 columns 0 indexes 1 fks
instructors 6 columns 0 indexes 1 fks
session 8 columns 2 indexes 1 fks
sessions 8 columns 0 indexes 3 fks
user 8 columns 1 indexes 0 fks
verification 6 columns 1 indexes 0 fks

[✓] Your SQL migration file ➜ drizzle/0000_perpetual_smasher.sql 🚀

Created /tmp/smithable-bench-m12-XACanP/app-1. Start it with:

  cd /tmp/smithable-bench-m12-XACanP/app-1
  smithable run
(node:1489217) Warning: Accessing non-existent property 'replaceRouteChunk' of module exports inside circular dependency
(Use `node --trace-warnings ...` to show where the warning was created)
```

### 2. A CRM for a small sales team: companies, contacts, deals and follow-ups.

```text
Sales CRM
  Lightweight CRM for a small sales team to manage companies, contacts, deals, and follow-ups.

Companies
  Companies have a name (required), an industry/sector, a website (a web address), a phone, an email, address and notes.
  Each company can have an assigned sales rep (a user).
  The assigned sales rep owns the company.
  Only sales users and admins can change companies.
  Only admins can delete companies.

Contacts
  Contacts have a first name (required), a last name (required), an email, a phone, a position, a company (a company, required) and notes.
  Each contact can have an assigned sales rep (a user).
  The assigned sales rep owns the contact.
  Only sales users and admins can change contacts.
  Only admins can delete contacts.

Deals
  Deals have a name (required), a company (a company, required), a contact (a contact), a value (an amount, required), a stage (lead, qualified, proposal, negotiation, closed won or closed lost, lead by default), a close date and notes.
  Each deal can have an assigned sales rep (a user).
  The assigned sales rep owns the deal.
  Only sales users and admins can change deals.
  Only admins can delete deals.

Follow ups
  Follow ups have a title (required), a deal (a deal), a contact (a contact), a due date (required), status (pending, completed or cancelled, pending by default) and notes.
  Each follow up can have an assigned sales rep (a user).
  The assigned sales rep owns the follow up.
  Only sales users and admins can change follow ups.
  Only admins can delete follow ups.

Pages
  Companies (lists companies; search by name, email or industry/sector), Contacts (lists contacts; search by first name, last name, email or company), Deals (lists deals; search by name, company or stage) and Followups (lists follow ups; search by title or status).

Sign-in and access
  People sign in with Google, only with  accounts.
  Everyone who signs in sees all records, and changes and deletes the ones they own.
  Roles: admin (Sales management with full access); sales (Sales team member managing companies, contacts, deals, and follow-ups). New users get the sales role.
Generated 76 files (76 changed, 0 removed).
No config path provided, using default 'drizzle.config.ts'
Reading config file '/tmp/smithable-bench-m12-XACanP/app-2/drizzle.config.ts'
8 tables
account 13 columns 1 indexes 1 fks
companies 11 columns 0 indexes 1 fks
contacts 11 columns 0 indexes 2 fks
deals 11 columns 0 indexes 3 fks
follow_ups 10 columns 0 indexes 3 fks
session 8 columns 2 indexes 1 fks
user 8 columns 1 indexes 0 fks
verification 6 columns 1 indexes 0 fks

[✓] Your SQL migration file ➜ drizzle/0000_free_sabretooth.sql 🚀

Created /tmp/smithable-bench-m12-XACanP/app-2. Start it with:

  cd /tmp/smithable-bench-m12-XACanP/app-2
  smithable run
(node:1489660) Warning: Accessing non-existent property 'replaceRouteChunk' of module exports inside circular dependency
(Use `node --trace-warnings ...` to show where the warning was created)
```

### 3. Invoicing for freelancers, with clients, invoices and payments.

```text
Invoicely
  Simple invoicing for freelancers. Each user manages their own clients and invoices.

Business profiles
  Business profiles have a business name (required), a vat number, an iban, payment term days (a whole number, required, 30 by default) and an invoice footer.

Clients
  Clients have a name (required), an email (required), address and a vat number.
  Each client lists its invoices.

Invoices
  Invoices have a number (required, unique), a client (a client, required), an issued on (a date, required, TODAY() by default), a due on (a date, required, DATEADD(issuedOn, 30, "day") by default) and status (draft, sent, paid or overdue, draft by default).
  Each invoice lists its invoice lines.
  The total is calculated: SUM(lines.amount).
  Rule: Invoice numbers are sequential per user, like 2026-001, 2026-002.
  Rule: A sent or paid invoice can no longer be edited, only credited.

Invoice lines
  Invoice lines have an invoice (an invoice, required), a description (required), a quantity (a number, required, 1 by default) and an unit price (an amount, required).
  The amount is calculated: quantity * unitPrice.

Pages
  Home (a landing page: hero, features, pricing, faq and call to action), Overview (a dashboard: outstanding, overdue, paid, invoiced and latest), Invoices (lists invoices; search by number), Clients (lists clients; search by name or email), Settings (settings: edits your business profile) and Welcome (a first-time setup of your business profile in 2 steps).

Sign-in and access
  People sign in with Google.
  Everyone sees and changes only their own records.
  Roles: admin (Invoicely staff); member (A freelancer using Invoicely). New users get the member role.
  Open to anyone without signing in: the home page.
Generated 78 files (78 changed, 0 removed).
No config path provided, using default 'drizzle.config.ts'
Reading config file '/tmp/smithable-bench-m12-XACanP/app-3/drizzle.config.ts'
8 tables
account 13 columns 1 indexes 1 fks
business_profiles 9 columns 0 indexes 1 fks
clients 8 columns 0 indexes 1 fks
invoice_lines 9 columns 0 indexes 2 fks
invoices 10 columns 1 indexes 2 fks
session 8 columns 2 indexes 1 fks
user 8 columns 1 indexes 0 fks
verification 6 columns 1 indexes 0 fks

[✓] Your SQL migration file ➜ drizzle/0000_young_ricochet.sql 🚀

Created /tmp/smithable-bench-m12-XACanP/app-3. Start it with:

  cd /tmp/smithable-bench-m12-XACanP/app-3
  smithable run
(node:1490183) Warning: Accessing non-existent property 'replaceRouteChunk' of module exports inside circular dependency
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
Reading config file '/tmp/smithable-bench-m12-XACanP/app-4/drizzle.config.ts'
6 tables
account 13 columns 1 indexes 1 fks
bookings 9 columns 0 indexes 2 fks
session 8 columns 2 indexes 1 fks
tools 10 columns 0 indexes 1 fks
user 8 columns 1 indexes 0 fks
verification 6 columns 1 indexes 0 fks

[✓] Your SQL migration file ➜ drizzle/0000_luxuriant_wolf_cub.sql 🚀

Created /tmp/smithable-bench-m12-XACanP/app-4. Start it with:

  cd /tmp/smithable-bench-m12-XACanP/app-4
  smithable run
/tmp/smithable-bench-m12-XACanP/app-4/smithable.auth.yml:6:16  warning  With shared access and no allowedDomains, anyone with an account at the sign-in provider can sign up and read all records.
    hint: Restrict sign-in with "allowedDomains" under "signIn", or use "defaultAccess: private".
(node:1490681) Warning: Accessing non-existent property 'replaceRouteChunk' of module exports inside circular dependency
(Use `node --trace-warnings ...` to show where the warning was created)
```

### 5. An inventory app for a small bakery: ingredients, suppliers and stock levels.

```text
Bakery Inventory
  Track ingredients, suppliers, and stock levels for a small bakery.

Ingredients
  Ingredients have a name (required), an unit (required, grams by default) and a category.

Suppliers
  Suppliers have a name (required), a contact, an email and a phone.

Stocks
  Stocks have an ingredient (an ingredient, required), a quantity (a number, required), a supplier (a supplier) and a last updated (required, TODAY() by default).
  Rule: Stock quantity must be non-negative.

Pages
  Home (a landing page: hero and call to action), Ingredients (lists ingredients; search by name or category), Suppliers (lists suppliers; search by name) and Stock (lists stocks; search by ingredient or supplier).

Sign-in and access
  People sign in with Google.
  Everyone sees and changes only their own records.
  Roles: admin (Bakery owner or manager. Manages inventory and suppliers); staff (Bakery staff. Views and updates stock levels). New users get the staff role.
  Open to anyone without signing in: the home page.
Generated 72 files (72 changed, 0 removed).
No config path provided, using default 'drizzle.config.ts'
Reading config file '/tmp/smithable-bench-m12-XACanP/app-5/drizzle.config.ts'
7 tables
account 13 columns 1 indexes 1 fks
ingredients 7 columns 0 indexes 1 fks
session 8 columns 2 indexes 1 fks
stocks 8 columns 0 indexes 3 fks
suppliers 8 columns 0 indexes 1 fks
user 8 columns 1 indexes 0 fks
verification 6 columns 1 indexes 0 fks

[✓] Your SQL migration file ➜ drizzle/0000_jittery_timeslip.sql 🚀

Created /tmp/smithable-bench-m12-XACanP/app-5. Start it with:

  cd /tmp/smithable-bench-m12-XACanP/app-5
  smithable run
(node:1491119) Warning: Accessing non-existent property 'replaceRouteChunk' of module exports inside circular dependency
(Use `node --trace-warnings ...` to show where the warning was created)
```

### 6. A job board for a local union, with job posts and applications.

```text
Union Job Board
  A job board for a local union to post jobs and manage applications.

Job posts
  Job posts have a title (required), a description (required), a company (required), a location, a salary, a posted at (a date and time, NOW() by default), status (open, filled or expired, open by default) and a deadline (a date).
  Each job post can have a posted by (a user).

Applications
  Applications have a job post (a job post, required), a cover letter, a resume (a web address), a submitted at (a date and time, NOW() by default) and status (pending, reviewed, accepted or rejected, pending by default).
  Each application can have an applicant (a user).

Pages
  Home (a landing page: hero and call to action), Job posts (lists job posts; search by title, company or location; only for employer users and admins) and Applications (lists applications; search by job post, applicant or status; only for employer users, member users and admins).

Sign-in and access
  People sign in with Google.
  Everyone sees and changes only their own records.
  Roles: admin (Manages the job board and all users); employer (Posts job listings and reviews applications); member (Applies to job postings). New users get the member role.
  Open to anyone without signing in: the home page and the job posts page.
Generated 69 files (69 changed, 0 removed).
No config path provided, using default 'drizzle.config.ts'
Reading config file '/tmp/smithable-bench-m12-XACanP/app-6/drizzle.config.ts'
6 tables
account 13 columns 1 indexes 1 fks
applications 10 columns 0 indexes 3 fks
job_posts 13 columns 0 indexes 2 fks
session 8 columns 2 indexes 1 fks
user 8 columns 1 indexes 0 fks
verification 6 columns 1 indexes 0 fks

[✓] Your SQL migration file ➜ drizzle/0000_heavy_colossus.sql 🚀

Created /tmp/smithable-bench-m12-XACanP/app-6. Start it with:

  cd /tmp/smithable-bench-m12-XACanP/app-6
  smithable run
(node:1491567) Warning: Accessing non-existent property 'replaceRouteChunk' of module exports inside circular dependency
(Use `node --trace-warnings ...` to show where the warning was created)
```

### 7. A football club's site: teams, players, matches and results.

```text
Football Club
  A football club's site for managing teams, players, matches, and results.

Teams
  Teams have a name (required), a division and a coach.
  Only admins can add teams.
  Only admins can delete teams.

Players
  Players have a name (required), a position, a team (a team, required) and a jersey number (a whole number).
  Only admins can add players.
  Only admins can delete players.

Matches
  Matches have a home team (a team, required), an away team (a team, required), a match date (required), a location, a home score (a whole number) and an away score (a whole number).
  Only admins can add matches.
  Only admins can delete matches.

Pages
  Home (a landing page: hero, features, faq and call to action), Teams (lists teams; search by name or division), Players (lists players; search by name, position or team) and Matches (lists matches; search by home team, away team or location).

Sign-in and access
  People sign in with Google.
  Everyone who signs in sees all records, and changes and deletes the ones they own.
  Roles: admin (Manages teams, players, and matches); member (A club member who can view information). New users get the member role.
  Open to anyone without signing in: the home page, the matches page, reading teams, reading players and reading matches.
Generated 71 files (71 changed, 0 removed).
No config path provided, using default 'drizzle.config.ts'
Reading config file '/tmp/smithable-bench-m12-XACanP/app-7/drizzle.config.ts'
7 tables
account 13 columns 1 indexes 1 fks
matches 10 columns 0 indexes 3 fks
players 8 columns 0 indexes 2 fks
session 8 columns 2 indexes 1 fks
teams 7 columns 0 indexes 1 fks
user 8 columns 1 indexes 0 fks
verification 6 columns 1 indexes 0 fks

[✓] Your SQL migration file ➜ drizzle/0000_light_whistler.sql 🚀

Created /tmp/smithable-bench-m12-XACanP/app-7. Start it with:

  cd /tmp/smithable-bench-m12-XACanP/app-7
  smithable run
/tmp/smithable-bench-m12-XACanP/app-7/smithable.auth.yml:6:16  warning  With shared access and no allowedDomains, anyone with an account at the sign-in provider can sign up and read all records.
    hint: Restrict sign-in with "allowedDomains" under "signIn", or use "defaultAccess: private".
(node:1492084) Warning: Accessing non-existent property 'replaceRouteChunk' of module exports inside circular dependency
(Use `node --trace-warnings ...` to show where the warning was created)
```

### 8. Event registration for a conference: talks, speakers and attendees.

```text
Conference Registration
  Event registration system for a conference with talks, speakers, and attendees.

Talks
  Talks have a title (required), a description, a start time (a date and time, required), an end time (a date and time, required), a speaker (a speaker, required), a room and a capacity (a whole number, required, 50 by default).
  Each talk lists its talk attendees.
  Only organizer users and admins can add talks.
  Only organizer users and admins can delete talks.
  Rule: A talk cannot have more registered attendees than its capacity.

Speakers
  Speakers have a name (required), a bio, an email (required) and a company.
  Only organizer users and admins can add speakers.
  Only organizer users and admins can delete speakers.

Attendees
  Attendees have a name (required), an email (required) and a company.
  Each attendee lists its talk attendees.
  Only organizer users, attendee users and admins can add attendees.
  Only organizer users, attendee users, speaker users and admins can see attendees.

Talk attendees
  Talk attendees have a talk (a talk, required) and an attendee (an attendee, required).

Pages
  Home (a landing page: hero, features, faq and call to action), Conference Talks (lists talks; search by title or speaker; only for organizer users, speaker users, attendee users and admins), Our Speakers (lists speakers; only for organizer users and admins) and Register as Attendee (lists attendees; only for organizer users, attendee users and admins).

Sign-in and access
  People sign in with Google.
  Everyone sees and changes only their own records.
  Roles: admin (Conference administrator with full access); organizer (Manages talks, speakers, and attendee registrations); speaker (Presents talks at the conference); attendee (Registered conference participant). New users get the attendee role.
  Open to anyone without signing in: the home page, reading talks and reading speakers.
Generated 73 files (73 changed, 0 removed).
No config path provided, using default 'drizzle.config.ts'
Reading config file '/tmp/smithable-bench-m12-XACanP/app-8/drizzle.config.ts'
8 tables
account 13 columns 1 indexes 1 fks
attendees 7 columns 0 indexes 1 fks
session 8 columns 2 indexes 1 fks
speakers 8 columns 0 indexes 1 fks
talk_attendees 6 columns 0 indexes 3 fks
talks 11 columns 0 indexes 2 fks
user 8 columns 1 indexes 0 fks
verification 6 columns 1 indexes 0 fks

[✓] Your SQL migration file ➜ drizzle/0000_swift_jane_foster.sql 🚀

Created /tmp/smithable-bench-m12-XACanP/app-8. Start it with:

  cd /tmp/smithable-bench-m12-XACanP/app-8
  smithable run
/tmp/smithable-bench-m12-XACanP/app-8/smithable.auth.yml:22:16  warning  Anyone on the internet can read Speaker, including personal data in email.
(node:1492627) Warning: Accessing non-existent property 'replaceRouteChunk' of module exports inside circular dependency
(Use `node --trace-warnings ...` to show where the warning was created)
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
Reading config file '/tmp/smithable-bench-m12-XACanP/app-9/drizzle.config.ts'
5 tables
account 13 columns 1 indexes 1 fks
session 8 columns 2 indexes 1 fks
tickets 10 columns 0 indexes 1 fks
user 8 columns 1 indexes 0 fks
verification 6 columns 1 indexes 0 fks

[✓] Your SQL migration file ➜ drizzle/0000_cuddly_captain_midlands.sql 🚀

Created /tmp/smithable-bench-m12-XACanP/app-9. Start it with:

  cd /tmp/smithable-bench-m12-XACanP/app-9
  smithable run
(node:1493040) Warning: Accessing non-existent property 'replaceRouteChunk' of module exports inside circular dependency
(Use `node --trace-warnings ...` to show where the warning was created)
```

### 10. A recipe collection for a family, with ingredients and shopping lists.

```text
Family Recipe Collection
  A shared space for a family to store, organize, and shop for recipes.

Recipes
  Recipes have a name (required), a description, instructions (required), servings (a whole number, required, 4 by default), a category and tags.
  Each recipe lists its ingredients.

Ingredients
  Ingredients have a name (required), a quantity (a number), an unit and a recipe (a recipe, required).

Shopping lists
  Shopping lists have a name (required).
  Each shopping list lists its shopping items.

Shopping items
  Shopping items have a name (required), a quantity (a number), an unit, a purchased (yes or no, false by default) and a shopping list (a shopping list, required).

Pages
  Home (a landing page: hero and call to action), Recipes (lists recipes; search by name or category) and Shopping lists (lists shopping lists; search by name).

Sign-in and access
  People sign in with Google.
  Everyone who signs in sees all records, and changes and deletes the ones they own.
  Roles: admin (Manages the family recipe collection); member (Family member with full access). New users get the member role.
  Open to anyone without signing in: the home page.
Generated 71 files (71 changed, 0 removed).
No config path provided, using default 'drizzle.config.ts'
Reading config file '/tmp/smithable-bench-m12-XACanP/app-10/drizzle.config.ts'
8 tables
account 13 columns 1 indexes 1 fks
ingredients 8 columns 0 indexes 2 fks
recipes 10 columns 0 indexes 1 fks
session 8 columns 2 indexes 1 fks
shopping_items 9 columns 0 indexes 2 fks
shopping_lists 5 columns 0 indexes 1 fks
user 8 columns 1 indexes 0 fks
verification 6 columns 1 indexes 0 fks

[✓] Your SQL migration file ➜ drizzle/0000_faulty_robbie_robertson.sql 🚀

Created /tmp/smithable-bench-m12-XACanP/app-10. Start it with:

  cd /tmp/smithable-bench-m12-XACanP/app-10
  smithable run
/tmp/smithable-bench-m12-XACanP/app-10/smithable.auth.yml:6:16  warning  With shared access and no allowedDomains, anyone with an account at the sign-in provider can sign up and read all records.
    hint: Restrict sign-in with "allowedDomains" under "signIn", or use "defaultAccess: private".
(node:1493467) Warning: Accessing non-existent property 'replaceRouteChunk' of module exports inside circular dependency
(Use `node --trace-warnings ...` to show where the warning was created)
```
