# M12 first builds: sonnet (2026-09-27)

Ten app descriptions, each started with `smithable new --describe` (the closest starter, adapted by the model; errors go back up to twice). Totals: 10 / 10 created, 8 type-check, 181,082 tokens, $0.9419.

| Description | Starter | Created | Type-checks | Tokens | Cost | Time |
|---|---|---|---|---|---|---|
| A booking site for a yoga studio, with classes, teachers and online booking. | booking | yes | yes | 11,760 | $0.0762 | 62 s |
| A CRM for a small sales team: companies, contacts, deals and follow-ups. | crm | yes | yes | 31,015 | $0.1468 | 75 s |
| Invoicing for freelancers, with clients, invoices and payments. | invoicing | yes | yes | 11,279 | $0.0609 | 45 s |
| A tool library where neighbours lend each other tools. | crm | yes | **no** | 30,264 | $0.1441 | 72 s |
| An inventory app for a small bakery: ingredients, suppliers and stock levels. | booking | yes | yes | 10,123 | $0.0549 | 46 s |
| A job board for a local union, with job posts and applications. | crm | yes | **no** | 12,470 | $0.0768 | 67 s |
| A football club's site: teams, players, matches and results. | booking | yes | yes | 20,230 | $0.1017 | 66 s |
| Event registration for a conference: talks, speakers and attendees. | booking | yes | yes | 10,280 | $0.0565 | 49 s |
| A help desk for an IT team: tickets, priorities and who handles them. | invoicing | yes | yes | 21,314 | $0.1043 | 62 s |
| A recipe collection for a family, with ingredients and shopping lists. | crm | yes | yes | 22,347 | $0.1197 | 83 s |

## Summaries, for review

### 1. A booking site for a yoga studio, with classes, teachers and online booking.

```text
Sunroot Yoga
  Class schedule and online booking for a yoga studio, with classes, teachers and bookings.

Class types
  Class types have a name (required), a summary, a level (beginner, all levels or advanced, all levels by default) and duration minutes (a whole number, required, 60 by default).
  Only admins can add class types.

Teachers
  Teachers have a name (required) and a bio.
  Only admins can add teachers.

Sessions
  Sessions have a class type (a class type, required), a teacher (a teacher, required), a starts at (a date and time, required) and a capacity (a whole number, required, 12 by default).
  Only admins can add sessions.
  Rule: A session never has more confirmed bookings than its capacity.

Bookings
  Bookings have a session (a session, required) and status (confirmed or cancelled, confirmed by default).

Pages
  Home (a landing page: hero, classes, faq and call to action), Class schedule (lists sessions), My bookings (lists bookings), Class types (lists class types; only for admins) and Teachers (lists teachers; only for admins).

Sign-in and access
  People sign in with Google.
  Everyone sees and changes only their own records.
  Roles: admin (Studio staff. Manage the schedule, classes and teachers); member (A student who books classes). New users get the member role.
  Open to anyone without signing in: the home page, the sessions page, reading class types, reading teachers and reading sessions.
Generated 71 files (71 changed, 0 removed).
No config path provided, using default 'drizzle.config.ts'
Reading config file '/tmp/smithable-bench-m12-Lm9Rjj/app-1/drizzle.config.ts'
8 tables
account 13 columns 1 indexes 1 fks
bookings 6 columns 0 indexes 2 fks
class_types 8 columns 0 indexes 1 fks
session 8 columns 2 indexes 1 fks
sessions 8 columns 0 indexes 3 fks
teachers 6 columns 0 indexes 1 fks
user 8 columns 1 indexes 0 fks
verification 6 columns 1 indexes 0 fks

[✓] Your SQL migration file ➜ drizzle/0000_green_alice.sql 🚀

Created /tmp/smithable-bench-m12-Lm9Rjj/app-1. Start it with:

  cd /tmp/smithable-bench-m12-Lm9Rjj/app-1
  smithable run
(node:614822) Warning: Accessing non-existent property 'replaceRouteChunk' of module exports inside circular dependency
(Use `node --trace-warnings ...` to show where the warning was created)
$ tsx src/db/seed.ts
```

### 2. A CRM for a small sales team: companies, contacts, deals and follow-ups.

```text
Pipeline CRM
  Lightweight CRM for a small B2B sales team to track companies, contacts, deals and follow-ups.

Companies
  Companies have a name (required), a website (a web address), an industry and notes.
  Each company can have an account manager (a user).
  Each company lists its contacts.
  Each company lists its deals.
  The account manager owns the company.
  Only sales users and admins can change companies.
  Only admins can delete companies.

Contacts
  Contacts have a name (required), a company (a company, required), an email, a phone and a title.
  Only sales users and admins can change contacts.
  Only admins can delete contacts.

Deals
  Deals have a title (required), a company (a company, required), a contact (a contact), a value (an amount), a stage (prospecting, qualified, proposal, won or lost, prospecting by default) and an expected close (a date).
  Each deal can have an owner (a user).
  The owner owns the deal.
  Only sales users and admins can change deals.
  Only admins can delete deals.

Follow ups
  Follow ups have a subject (required), a deal (a deal), a contact (a contact), a due (a date, required), a done (yes or no, false by default) and notes.
  Only sales users and admins can change follow ups.
  Only admins can delete follow ups.

Pages
  Companies (lists companies; search by name or website), Contacts (lists contacts; search by name or email), Deals (lists deals; search by title or company) and Followups (lists follow ups; search by subject).

Sign-in and access
  People sign in with Google.
  Everyone who signs in sees all records, and changes and deletes the ones they own.
  Roles: admin (Sales management. Full access); sales (Manages companies, contacts, deals and follow-ups). New users get the sales role.
Generated 71 files (71 changed, 0 removed).
No config path provided, using default 'drizzle.config.ts'
Reading config file '/tmp/smithable-bench-m12-Lm9Rjj/app-2/drizzle.config.ts'
8 tables
account 13 columns 1 indexes 1 fks
companies 8 columns 0 indexes 1 fks
contacts 9 columns 0 indexes 2 fks
deals 10 columns 0 indexes 3 fks
follow_ups 10 columns 0 indexes 3 fks
session 8 columns 2 indexes 1 fks
user 8 columns 1 indexes 0 fks
verification 6 columns 1 indexes 0 fks

[✓] Your SQL migration file ➜ drizzle/0000_kind_random.sql 🚀

Created /tmp/smithable-bench-m12-Lm9Rjj/app-2. Start it with:

  cd /tmp/smithable-bench-m12-Lm9Rjj/app-2
  smithable run
/tmp/smithable-bench-m12-Lm9Rjj/app-2/smithable.auth.yml:6:16  warning  With shared access and no allowedDomains, anyone with an account at the sign-in provider can sign up and read all records.
    hint: Restrict sign-in with "allowedDomains" under "signIn", or use "defaultAccess: private".
(node:616251) Warning: Accessing non-existent property 'replaceRouteChunk' of module exports inside circular dependency
(Use `node --trace-warnings ...` to show where the warning was created)
$ tsx src/db/seed.ts
```

### 3. Invoicing for freelancers, with clients, invoices and payments.

```text
Invoicely
  Simple invoicing for freelancers. Each freelancer manages their own clients, invoices and payments.

Business profiles
  Business profiles have a business name (required), a vat number, an iban, a days to pay (a whole number, required, 30 by default) and an invoice footer.

Clients
  Clients have a name (required), an email (required), address and a vat number.
  Each client lists its invoices.

Invoices
  Invoices have a number (required, unique), a client (a client, required), an issued on (a date, required, TODAY() by default), a due on (a date, required, DATEADD(issuedOn, 30, "day") by default) and status (draft, sent, paid or overdue, draft by default).
  Each invoice lists its invoice lines.
  Each invoice lists its payments.
  The total is calculated: SUM(lines.amount).
  Rule: Invoice numbers are sequential per user, like 2026-001, 2026-002.
  Rule: A sent or paid invoice can no longer be edited, only credited.
  Rule: When the sum of an invoice's payments reaches its total, the invoice is marked paid.

Invoice lines
  Invoice lines have an invoice (an invoice, required), a description (required), a quantity (a number, required, 1 by default) and an unit price (an amount, required).
  The amount is calculated: quantity * unitPrice.

Payments
  Payments have an invoice (an invoice, required), an amount (an amount, required), a paid on (a date, required, TODAY() by default), a method (bank transfer, card, cash or other, bank transfer by default) and a note.

Pages
  Home (a landing page: hero, features, pricing, faq and call to action), Overview (a dashboard: outstanding, overdue, collected, invoiced and latest), Invoices (lists invoices), Clients (lists clients; search by name or email), Invoice lines (lists invoice lines), Payments (lists payments), Settings (settings: edits your business profile) and Welcome (a first-time setup of your business profile in 2 steps).

Sign-in and access
  People sign in with Google.
  Everyone sees and changes only their own records.
  Roles: admin (Invoicely staff); member (A freelancer using Invoicely). New users get the member role.
  Open to anyone without signing in: the home page.
Generated 83 files (83 changed, 0 removed).
No config path provided, using default 'drizzle.config.ts'
Reading config file '/tmp/smithable-bench-m12-Lm9Rjj/app-3/drizzle.config.ts'
9 tables
account 13 columns 1 indexes 1 fks
business_profiles 9 columns 0 indexes 1 fks
clients 8 columns 0 indexes 1 fks
invoice_lines 9 columns 0 indexes 2 fks
invoices 10 columns 1 indexes 2 fks
payments 9 columns 0 indexes 2 fks
session 8 columns 2 indexes 1 fks
user 8 columns 1 indexes 0 fks
verification 6 columns 1 indexes 0 fks

[✓] Your SQL migration file ➜ drizzle/0000_hesitant_azazel.sql 🚀

Created /tmp/smithable-bench-m12-Lm9Rjj/app-3. Start it with:

  cd /tmp/smithable-bench-m12-Lm9Rjj/app-3
  smithable run
(node:616773) Warning: Accessing non-existent property 'replaceRouteChunk' of module exports inside circular dependency
(Use `node --trace-warnings ...` to show where the warning was created)
$ tsx src/db/seed.ts
```

### 4. A tool library where neighbours lend each other tools.

```text
Tool Share
  A tool library where neighbours lend and borrow tools with each other.

Profiles
  Profiles have a display name (required), a neighbourhood and a phone.

Tools
  Tools have a name (required), a description, a category (garden, power tools, hand tools, kitchen or other, garden by default) and an available to borrow (yes or no, true by default).
  Each tool can have a lender (a user).
  The lender owns the tool.
  Only the owner and admins can change tools.
  Only the owner and admins can delete tools.

Loans
  Loans have a tool (a tool, required), status (requested, approved, returned or cancelled, requested by default), a start date (required, TODAY() by default) and a due back on (a date).
  Each loan can have a borrower (a user).

Pages
  Home (a landing page: hero, features, faq and call to action), Tools (lists tools; search by name), Loans (lists loans) and Settings (settings: edits your profile).

Sign-in and access
  People sign in with Google.
  Everyone who signs in sees all records, and changes and deletes the ones they own.
  Roles: admin (Runs the tool library); member (Lends and borrows tools). New users get the member role.
  Open to anyone without signing in: the home page.
Generated 66 files (66 changed, 0 removed).
No config path provided, using default 'drizzle.config.ts'
Reading config file '/tmp/smithable-bench-m12-Lm9Rjj/app-4/drizzle.config.ts'
7 tables
account 13 columns 1 indexes 1 fks
loans 9 columns 0 indexes 3 fks
profiles 7 columns 0 indexes 1 fks
session 8 columns 2 indexes 1 fks
tools 8 columns 0 indexes 1 fks
user 8 columns 1 indexes 0 fks
verification 6 columns 1 indexes 0 fks

[✓] Your SQL migration file ➜ drizzle/0000_flowery_shaman.sql 🚀

Created /tmp/smithable-bench-m12-Lm9Rjj/app-4. Start it with:

  cd /tmp/smithable-bench-m12-Lm9Rjj/app-4
  smithable run
/tmp/smithable-bench-m12-Lm9Rjj/app-4/smithable.auth.yml:6:16  warning  With shared access and no allowedDomains, anyone with an account at the sign-in provider can sign up and read all records.
    hint: Restrict sign-in with "allowedDomains" under "signIn", or use "defaultAccess: private".
(node:618260) Warning: Accessing non-existent property 'replaceRouteChunk' of module exports inside circular dependency
(Use `node --trace-warnings ...` to show where the warning was created)
$ tsx src/db/seed.ts
```

### 5. An inventory app for a small bakery: ingredients, suppliers and stock levels.

```text
Flour & Co Inventory
  Inventory tracking for a small bakery, covering ingredients, suppliers and stock levels.

Suppliers
  Suppliers have a name (required), a contact email and a phone.
  Only admins can add suppliers.
  Only admins can delete suppliers.

Ingredients
  Ingredients have a name (required), an unit (grams, kilograms, liters or units, grams by default), a supplier (a supplier, required), a quantity in stock (a number, required, 0 by default) and a reorder level (a number, required, 0 by default).

Pages
  Ingredients (lists ingredients; search by name) and Suppliers (lists suppliers; only for admins).

Sign-in and access
  People sign in with Google.
  Everyone who signs in sees all records, and changes and deletes the ones they own.
  Roles: admin (Runs the bakery. Manages suppliers); staff (Tracks ingredients and updates stock levels). New users get the staff role.
Generated 59 files (59 changed, 0 removed).
No config path provided, using default 'drizzle.config.ts'
Reading config file '/tmp/smithable-bench-m12-Lm9Rjj/app-5/drizzle.config.ts'
6 tables
account 13 columns 1 indexes 1 fks
ingredients 9 columns 0 indexes 2 fks
session 8 columns 2 indexes 1 fks
suppliers 7 columns 0 indexes 1 fks
user 8 columns 1 indexes 0 fks
verification 6 columns 1 indexes 0 fks

[✓] Your SQL migration file ➜ drizzle/0000_chilly_captain_flint.sql 🚀

Created /tmp/smithable-bench-m12-Lm9Rjj/app-5. Start it with:

  cd /tmp/smithable-bench-m12-Lm9Rjj/app-5
  smithable run
/tmp/smithable-bench-m12-Lm9Rjj/app-5/smithable.auth.yml:6:16  warning  With shared access and no allowedDomains, anyone with an account at the sign-in provider can sign up and read all records.
    hint: Restrict sign-in with "allowedDomains" under "signIn", or use "defaultAccess: private".
(node:618907) Warning: Accessing non-existent property 'replaceRouteChunk' of module exports inside circular dependency
(Use `node --trace-warnings ...` to show where the warning was created)
$ tsx src/db/seed.ts
```

### 6. A job board for a local union, with job posts and applications.

```text
Union Job Board
  Job board for a local union to post job openings and manage member applications.

Job posts
  Job posts have a title (required), an employer (required), a location (required), an employment type (full-time, part-time or temporary, full-time by default), a pay (an amount), a description, status (open or closed, open by default) and a posted on (a date, required, TODAY() by default).
  Each job post can have a posted by (a user).
  The posted by owns the job post.
  Only admins can change job posts.
  Only admins can delete job posts.

Applications
  Applications have a job (a job post, required), a cover note, status (submitted, under review, accepted or rejected, submitted by default) and an applied on (a date and time, NOW() by default).
  Each application can have an applicant (a user).
  The applicant owns the application.
  Only the owner and admins can see applications.
  Only the owner and admins can change applications.
  Only admins can delete applications.

Pages
  Home (a landing page: hero, features, faq and call to action), Jobs (lists job posts; search by title, employer or location) and Applications (lists applications; search by status).

Sign-in and access
  People sign in with Google.
  Everyone who signs in sees all records, and changes and deletes the ones they own.
  Roles: admin (Union staff who post jobs and review applications); member (Union member who applies to jobs). New users get the member role.
  Open to anyone without signing in: the home page and the jobs page.
Generated 64 files (64 changed, 0 removed).
No config path provided, using default 'drizzle.config.ts'
Reading config file '/tmp/smithable-bench-m12-Lm9Rjj/app-6/drizzle.config.ts'
6 tables
account 13 columns 1 indexes 1 fks
applications 8 columns 0 indexes 2 fks
job_posts 12 columns 0 indexes 1 fks
session 8 columns 2 indexes 1 fks
user 8 columns 1 indexes 0 fks
verification 6 columns 1 indexes 0 fks

[✓] Your SQL migration file ➜ drizzle/0000_uneven_ultron.sql 🚀

Created /tmp/smithable-bench-m12-Lm9Rjj/app-6. Start it with:

  cd /tmp/smithable-bench-m12-Lm9Rjj/app-6
  smithable run
/tmp/smithable-bench-m12-Lm9Rjj/app-6/smithable.auth.yml:6:16  warning  With shared access and no allowedDomains, anyone with an account at the sign-in provider can sign up and read all records.
    hint: Restrict sign-in with "allowedDomains" under "signIn", or use "defaultAccess: private".
(node:619406) Warning: Accessing non-existent property 'replaceRouteChunk' of module exports inside circular dependency
(Use `node --trace-warnings ...` to show where the warning was created)
$ tsx src/db/seed.ts
```

### 7. A football club's site: teams, players, matches and results.

```text
Riverside FC
  Public site for a football club's teams, players, matches and results.

Teams
  Teams have a name (required), a division and a coach.
  Only admins can add teams.

Players
  Players have a name (required), a team (a team, required), a position (goalkeeper, defender, midfielder or forward, goalkeeper by default) and a shirt number (a whole number).
  Only admins can add players.

Matches
  Matches have a team (a team, required), an opponent (required), a played at (a date and time, required), a home away (home or away, home by default), status (upcoming or full time, upcoming by default), a goals for (a whole number) and a goals against (a whole number).
  Only admins can add matches.

Pages
  Home (a landing page: hero, teams, results, faq and call to action), Teams (lists teams), Players (lists players; search by name) and Matches & results (lists matches; search by opponent).

Sign-in and access
  People sign in with Google.
  Everyone who signs in sees all records, and changes and deletes the ones they own.
  Roles: admin (Club staff. Manage teams, players, matches and results). New users get the admin role.
  Open to anyone without signing in: the home page, the teams page, the players page, the matches page, reading teams, reading players and reading matches.
Generated 66 files (66 changed, 0 removed).
No config path provided, using default 'drizzle.config.ts'
Reading config file '/tmp/smithable-bench-m12-Lm9Rjj/app-7/drizzle.config.ts'
7 tables
account 13 columns 1 indexes 1 fks
matches 11 columns 0 indexes 2 fks
players 8 columns 0 indexes 2 fks
session 8 columns 2 indexes 1 fks
teams 7 columns 0 indexes 1 fks
user 8 columns 1 indexes 0 fks
verification 6 columns 1 indexes 0 fks

[✓] Your SQL migration file ➜ drizzle/0000_outstanding_charles_xavier.sql 🚀

Created /tmp/smithable-bench-m12-Lm9Rjj/app-7. Start it with:

  cd /tmp/smithable-bench-m12-Lm9Rjj/app-7
  smithable run
/tmp/smithable-bench-m12-Lm9Rjj/app-7/smithable.auth.yml:6:16  warning  With shared access and no allowedDomains, anyone with an account at the sign-in provider can sign up and read all records.
    hint: Restrict sign-in with "allowedDomains" under "signIn", or use "defaultAccess: private".
(node:620721) Warning: Accessing non-existent property 'replaceRouteChunk' of module exports inside circular dependency
(Use `node --trace-warnings ...` to show where the warning was created)
$ tsx src/db/seed.ts
```

### 8. Event registration for a conference: talks, speakers and attendees.

```text
ConfReg
  Event registration for a conference, its talks, speakers and attendees.

Speakers
  Speakers have a name (required), a bio and a company.
  Only admins can add speakers.

Talks
  Talks have a title (required), a description, a speaker (a speaker, required), a starts at (a date and time, required), a room and a track (keynote, technical, workshop or panel, keynote by default).
  Only admins can add talks.

Attendees
  Attendees have a name (required), a company and a ticket type (standard, vip or student, standard by default).

Pages
  Home (a landing page: hero, speakers, faq and call to action), Schedule (lists talks; search by title), Speakers (lists speakers; only for admins) and Register for the conference (a first-time setup of your attendee in 2 steps).

Sign-in and access
  People sign in with Google.
  Everyone sees and changes only their own records.
  Roles: admin (Organizes the conference. Manages talks, speakers and attendees); attendee (Registers for the conference and browses the schedule). New users get the attendee role.
  Open to anyone without signing in: the home page, the talks page, the speakers page, reading talks and reading speakers.
Generated 65 files (65 changed, 0 removed).
No config path provided, using default 'drizzle.config.ts'
Reading config file '/tmp/smithable-bench-m12-Lm9Rjj/app-8/drizzle.config.ts'
7 tables
account 13 columns 1 indexes 1 fks
attendees 7 columns 0 indexes 1 fks
session 8 columns 2 indexes 1 fks
speakers 7 columns 0 indexes 1 fks
talks 10 columns 0 indexes 2 fks
user 8 columns 1 indexes 0 fks
verification 6 columns 1 indexes 0 fks

[✓] Your SQL migration file ➜ drizzle/0000_great_madelyne_pryor.sql 🚀

Created /tmp/smithable-bench-m12-Lm9Rjj/app-8. Start it with:

  cd /tmp/smithable-bench-m12-Lm9Rjj/app-8
  smithable run
(node:621200) Warning: Accessing non-existent property 'replaceRouteChunk' of module exports inside circular dependency
(Use `node --trace-warnings ...` to show where the warning was created)
$ tsx src/db/seed.ts
```

### 9. A help desk for an IT team: tickets, priorities and who handles them.

```text
HelpDesk
  A help desk for an IT team to track tickets, priorities and who handles them.

Tickets
  Tickets have a title (required), a description, status (open, inprogress, resolved or closed, open by default), a priority (low, medium, high or urgent, low by default), a requester (an email address) and an opened on (a date, required, TODAY() by default).
  Each ticket can have an assigned to (a user).

Pages
  Overview (a dashboard: open, urgent, by month and latest) and Tickets (lists tickets; search by title or requester).

Sign-in and access
  People sign in with Google.
  Everyone who signs in sees all records, and changes and deletes the ones they own.
  Roles: admin (Runs the help desk and manages agents); agent (Handles and resolves tickets). New users get the agent role.
Generated 60 files (60 changed, 0 removed).
No config path provided, using default 'drizzle.config.ts'
Reading config file '/tmp/smithable-bench-m12-Lm9Rjj/app-9/drizzle.config.ts'
5 tables
account 13 columns 1 indexes 1 fks
session 8 columns 2 indexes 1 fks
tickets 11 columns 0 indexes 2 fks
user 8 columns 1 indexes 0 fks
verification 6 columns 1 indexes 0 fks

[✓] Your SQL migration file ➜ drizzle/0000_dry_madelyne_pryor.sql 🚀

Created /tmp/smithable-bench-m12-Lm9Rjj/app-9. Start it with:

  cd /tmp/smithable-bench-m12-Lm9Rjj/app-9
  smithable run
/tmp/smithable-bench-m12-Lm9Rjj/app-9/smithable.auth.yml:6:16  warning  With shared access and no allowedDomains, anyone with an account at the sign-in provider can sign up and read all records.
    hint: Restrict sign-in with "allowedDomains" under "signIn", or use "defaultAccess: private".
(node:622614) Warning: Accessing non-existent property 'replaceRouteChunk' of module exports inside circular dependency
(Use `node --trace-warnings ...` to show where the warning was created)
$ tsx src/db/seed.ts
```

### 10. A recipe collection for a family, with ingredients and shopping lists.

```text
Family Recipes
  A family's shared collection of recipes, ingredients, and shopping lists.

Recipes
  Recipes have a title (required), a category (breakfast, lunch, dinner, dessert or snack, breakfast by default), servings (a whole number, required, 4 by default), a prep time (minutes) (a whole number), a cook time (minutes) (a whole number) and instructions.
  Each recipe can have an added by (a user).
  Each recipe lists its ingredients.
  The added by owns the recipe.

Ingredients
  Ingredients have a recipe (a recipe, required), a name (required), a quantity (a number) and an unit.

Shopping list items
  Shopping list items have a name (required), a quantity (a number), an unit, a bought (yes or no) and a recipe (a recipe).
  Each shopping list item can have an added by (a user).
  The added by owns the shopping list item.

Pages
  Recipes (lists recipes; search by title), Ingredients (lists ingredients; search by name) and Shopping list (lists shopping list items; search by name).

Sign-in and access
  People sign in with Google.
  Everyone who signs in sees all records, and changes and deletes the ones they own.
  Roles: admin (Manages the family's recipe collection); member (A family member who cooks and shops). New users get the member role.
Generated 66 files (66 changed, 0 removed).
No config path provided, using default 'drizzle.config.ts'
Reading config file '/tmp/smithable-bench-m12-Lm9Rjj/app-10/drizzle.config.ts'
7 tables
account 13 columns 1 indexes 1 fks
ingredients 8 columns 0 indexes 2 fks
recipes 10 columns 0 indexes 1 fks
session 8 columns 2 indexes 1 fks
shopping_list_items 9 columns 0 indexes 2 fks
user 8 columns 1 indexes 0 fks
verification 6 columns 1 indexes 0 fks

[✓] Your SQL migration file ➜ drizzle/0000_little_fat_cobra.sql 🚀

Created /tmp/smithable-bench-m12-Lm9Rjj/app-10. Start it with:

  cd /tmp/smithable-bench-m12-Lm9Rjj/app-10
  smithable run
/tmp/smithable-bench-m12-Lm9Rjj/app-10/smithable.auth.yml:6:16  warning  With shared access and no allowedDomains, anyone with an account at the sign-in provider can sign up and read all records.
    hint: Restrict sign-in with "allowedDomains" under "signIn", or use "defaultAccess: private".
(node:623215) Warning: Accessing non-existent property 'replaceRouteChunk' of module exports inside circular dependency
(Use `node --trace-warnings ...` to show where the warning was created)
$ tsx src/db/seed.ts
```
