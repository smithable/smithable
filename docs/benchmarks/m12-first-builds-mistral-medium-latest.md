# M12 first builds: mistral-medium-latest (2026-09-27)

Ten app descriptions, each started with `smithable new --describe` (the closest starter, adapted by the model; errors go back once). Totals: 7 / 10 created, 6 type-check, 124,125 tokens, €0.0812.

| Description | Starter | Created | Type-checks | Tokens | Cost | Time |
|---|---|---|---|---|---|---|
| A booking site for a yoga studio, with classes, teachers and online booking. | booking | yes | yes | 4,660 | €0.0031 | 9 s |
| A CRM for a small sales team: companies, contacts, deals and follow-ups. | crm | yes | yes | 11,678 | €0.0085 | 17 s |
| Invoicing for freelancers, with clients, invoices and payments. | invoicing | yes | yes | 6,021 | €0.0048 | 13 s |
| A tool library where neighbours lend each other tools. | crm | **no** | **no** | 15,934 | €0.0100 | 13 s |
| An inventory app for a small bakery: ingredients, suppliers and stock levels. | booking | yes | yes | 9,359 | €0.0055 | 12 s |
| A job board for a local union, with job posts and applications. | crm | yes | **no** | 17,080 | €0.0114 | 22 s |
| A football club's site: teams, players, matches and results. | booking | yes | yes | 14,904 | €0.0091 | 16 s |
| Event registration for a conference: talks, speakers and attendees. | booking | **no** | **no** | 16,326 | €0.0111 | 15 s |
| A help desk for an IT team: tickets, priorities and who handles them. | invoicing | **no** | **no** | 17,966 | €0.0114 | 15 s |
| A recipe collection for a family, with ingredients and shopping lists. | crm | yes | yes | 10,197 | €0.0063 | 13 s |

## Summaries, for review

### 1. A booking site for a yoga studio, with classes, teachers and online booking.

```text
Stillwater Yoga
  Class schedule and online booking for a small yoga studio.

Class types
  Class types have a name (required), a summary, a level (beginner, all levels or advanced, beginner by default) and duration minutes (a whole number, required, 60 by default).
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
Generated 66 files (66 changed, 0 removed).
No config path provided, using default 'drizzle.config.ts'
Reading config file '/tmp/smithable-bench-m12-DFg86C/app-1/drizzle.config.ts'
7 tables
account 13 columns 1 indexes 1 fks
class_types 8 columns 0 indexes 1 fks
instructors 6 columns 0 indexes 1 fks
session 8 columns 2 indexes 1 fks
sessions 8 columns 0 indexes 3 fks
user 8 columns 1 indexes 0 fks
verification 6 columns 1 indexes 0 fks

[✓] Your SQL migration file ➜ drizzle/0000_rainy_silvermane.sql 🚀

Created /tmp/smithable-bench-m12-DFg86C/app-1. Start it with:

  cd /tmp/smithable-bench-m12-DFg86C/app-1
  smithable run
(node:565400) Warning: Accessing non-existent property 'replaceRouteChunk' of module exports inside circular dependency
(Use `node --trace-warnings ...` to show where the warning was created)
$ tsx src/db/seed.ts
```

### 2. A CRM for a small sales team: companies, contacts, deals and follow-ups.

```text
Sales CRM
  Lightweight CRM for a small sales team to manage companies, contacts, deals, and follow-ups.

Companies
  Companies have a name (required), an industry/sector, a website (a web address), a phone, an email, address and notes.
  Each company can have an assigned salesperson (a user).
  The assigned salesperson owns the company.
  Only sales users and admins can change companies.
  Only admins can delete companies.

Contacts
  Contacts have a first name (required), a last name (required), an email (required), a phone, a position, a company (a company, required) and notes.
  Each contact can have an assigned salesperson (a user).
  The assigned salesperson owns the contact.
  Only sales users and admins can change contacts.
  Only admins can delete contacts.

Deals
  Deals have a name (required), a company (a company, required), a contact (a contact), a deal value (an amount, required), a stage (prospecting, qualified, proposal, negotiation, closed (won) or closed (lost), prospecting by default), an expected close date and notes.
  Each deal can have an assigned salesperson (a user).
  The assigned salesperson owns the deal.
  Only sales users and admins can change deals.
  Only admins can delete deals.

Follow ups
  Follow ups have a title (required), a deal (a deal, required), a contact (a contact), a due date (required), status (pending, completed or cancelled, pending by default) and notes.
  Each follow up can have an assigned salesperson (a user).
  The assigned salesperson owns the follow up.
  Only sales users and admins can change follow ups.
  Only admins can delete follow ups.

Pages
  Companies (lists companies; search by name or email), Contacts (lists contacts; search by first name, last name, email or company), Deals (lists deals; search by name, company or stage) and Followups (lists follow ups; search by title, deal or status).

Sign-in and access
  People sign in with Google.
  Everyone who signs in sees all records, and changes and deletes the ones they own.
  Roles: admin (Manages the CRM and team settings); sales (Sales team member). New users get the sales role.
Generated 71 files (71 changed, 0 removed).
No config path provided, using default 'drizzle.config.ts'
Reading config file '/tmp/smithable-bench-m12-DFg86C/app-2/drizzle.config.ts'
8 tables
account 13 columns 1 indexes 1 fks
companies 11 columns 0 indexes 1 fks
contacts 11 columns 0 indexes 2 fks
deals 11 columns 0 indexes 3 fks
follow_ups 10 columns 0 indexes 3 fks
session 8 columns 2 indexes 1 fks
user 8 columns 1 indexes 0 fks
verification 6 columns 1 indexes 0 fks

[✓] Your SQL migration file ➜ drizzle/0000_cloudy_silver_fox.sql 🚀

Created /tmp/smithable-bench-m12-DFg86C/app-2. Start it with:

  cd /tmp/smithable-bench-m12-DFg86C/app-2
  smithable run
/tmp/smithable-bench-m12-DFg86C/app-2/smithable.auth.yml:6:16  warning  With shared access and no allowedDomains, anyone with an account at the sign-in provider can sign up and read all records.
    hint: Restrict sign-in with "allowedDomains" under "signIn", or use "defaultAccess: private".
(node:565907) Warning: Accessing non-existent property 'replaceRouteChunk' of module exports inside circular dependency
(Use `node --trace-warnings ...` to show where the warning was created)
$ tsx src/db/seed.ts
```

### 3. Invoicing for freelancers, with clients, invoices and payments.

```text
Invoicely
  Simple invoicing for freelancers. Each user manages their own clients and invoices.

Business profiles
  Business profiles have a business name (required), a vat number, an iban, a days to pay (a whole number, required, 30 by default) and an invoice footer.

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
  Home (a landing page: hero, features, pricing, faq and call to action), Overview (a dashboard: outstanding, overdue, paid, invoiced and latest), Invoices (lists invoices; search by number or client), Clients (lists clients; search by name or email), Settings (settings: edits your business profile) and Welcome (a first-time setup of your business profile in 2 steps).

Sign-in and access
  People sign in with Google.
  Everyone sees and changes only their own records.
  Roles: admin (Invoicely staff); member (A freelancer using Invoicely). New users get the member role.
  Open to anyone without signing in: the home page.
Generated 73 files (73 changed, 0 removed).
No config path provided, using default 'drizzle.config.ts'
Reading config file '/tmp/smithable-bench-m12-DFg86C/app-3/drizzle.config.ts'
8 tables
account 13 columns 1 indexes 1 fks
business_profiles 9 columns 0 indexes 1 fks
clients 8 columns 0 indexes 1 fks
invoice_lines 9 columns 0 indexes 2 fks
invoices 10 columns 1 indexes 2 fks
session 8 columns 2 indexes 1 fks
user 8 columns 1 indexes 0 fks
verification 6 columns 1 indexes 0 fks

[✓] Your SQL migration file ➜ drizzle/0000_safe_silver_surfer.sql 🚀

Created /tmp/smithable-bench-m12-DFg86C/app-3. Start it with:

  cd /tmp/smithable-bench-m12-DFg86C/app-3
  smithable run
(node:566393) Warning: Accessing non-existent property 'replaceRouteChunk' of module exports inside circular dependency
(Use `node --trace-warnings ...` to show where the warning was created)
$ tsx src/db/seed.ts
```

### 4. A tool library where neighbours lend each other tools.

Failed:

```text
Starting from the crm starter.
Smithable model (mistral-medium-latest) · 15,934 tokens · €0.0100
No model drafted a valid project.
smithable.yml:15:7  error  "owner" is added to every model automatically, so it cannot be declared.
smithable.yml:18:14  error  "ownedBy" of "Tool" must name one of its User fields.
Without a model, start from a starter: smithable new /tmp/smithable-bench-m12-DFg86C/app-4 --starter crm

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

Pages
  Home (a landing page: hero and call to action), Ingredients (lists ingredients; search by name or category), Suppliers (lists suppliers; search by name) and Stock (lists stocks; search by ingredient or supplier).

Sign-in and access
  People sign in with Google.
  Everyone sees and changes only their own records.
  Roles: admin (Bakery manager. Manages ingredients, suppliers, and stock); staff (Bakery staff. Views and updates stock levels). New users get the staff role.
  Open to anyone without signing in: the home page.
Generated 67 files (67 changed, 0 removed).
No config path provided, using default 'drizzle.config.ts'
Reading config file '/tmp/smithable-bench-m12-DFg86C/app-5/drizzle.config.ts'
7 tables
account 13 columns 1 indexes 1 fks
ingredients 7 columns 0 indexes 1 fks
session 8 columns 2 indexes 1 fks
stocks 8 columns 0 indexes 3 fks
suppliers 8 columns 0 indexes 1 fks
user 8 columns 1 indexes 0 fks
verification 6 columns 1 indexes 0 fks

[✓] Your SQL migration file ➜ drizzle/0000_melted_impossible_man.sql 🚀

Created /tmp/smithable-bench-m12-DFg86C/app-5. Start it with:

  cd /tmp/smithable-bench-m12-DFg86C/app-5
  smithable run
(node:566900) Warning: Accessing non-existent property 'replaceRouteChunk' of module exports inside circular dependency
(Use `node --trace-warnings ...` to show where the warning was created)
$ tsx src/db/seed.ts
```

### 6. A job board for a local union, with job posts and applications.

```text
Union Job Board
  A job board for a local union to post jobs and manage applications.

Job posts
  Job posts have a job title (required), a job description (required), a company name (required), a job location, a salary range, a posted at (a date and time, NOW() by default), status (open, filled or expired, open by default) and an application deadline (a date).
  Each job post can have a posted by (a user).
  The posted by owns the job post.
  Only employer users and admins can change job posts.
  Only the owner and admins can delete job posts.

Applications
  Applications have a job applied for (a job post, required), a cover letter, a resume link (a web address), a submitted at (a date and time, NOW() by default) and status (submitted, reviewed, shortlisted, rejected or hired, submitted by default).
  Each application can have an applicant name (a user).
  The applicant name owns the application.
  Only employer users, the owner and admins can see applications.
  Only the owner and admins can change applications.
  Only the owner and admins can delete applications.

Pages
  Home (a landing page: hero and call to action), Job posts (lists job posts; search by job title, company name or job location) and Applications (lists applications; search by job applied for, applicant name or status).

Sign-in and access
  People sign in with Google.
  Everyone who signs in sees all records, and changes and deletes the ones they own.
  Roles: admin (Manages the job board and all users); employer (Posts job listings and reviews applications); member (Union member who can apply to jobs). New users get the member role.
  Open to anyone without signing in: the home page and the job posts page.
Generated 64 files (64 changed, 0 removed).
No config path provided, using default 'drizzle.config.ts'
Reading config file '/tmp/smithable-bench-m12-DFg86C/app-6/drizzle.config.ts'
6 tables
account 13 columns 1 indexes 1 fks
applications 9 columns 0 indexes 2 fks
job_posts 12 columns 0 indexes 1 fks
session 8 columns 2 indexes 1 fks
user 8 columns 1 indexes 0 fks
verification 6 columns 1 indexes 0 fks

[✓] Your SQL migration file ➜ drizzle/0000_ambiguous_medusa.sql 🚀

Created /tmp/smithable-bench-m12-DFg86C/app-6. Start it with:

  cd /tmp/smithable-bench-m12-DFg86C/app-6
  smithable run
/tmp/smithable-bench-m12-DFg86C/app-6/smithable.auth.yml:6:16  warning  With shared access and no allowedDomains, anyone with an account at the sign-in provider can sign up and read all records.
    hint: Restrict sign-in with "allowedDomains" under "signIn", or use "defaultAccess: private".
(node:567398) Warning: Accessing non-existent property 'replaceRouteChunk' of module exports inside circular dependency
(Use `node --trace-warnings ...` to show where the warning was created)
$ tsx src/db/seed.ts
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
  Matches have a home team (a team, required), an away team (a team, required), a match date (a date and time, required), a location, a home score (a whole number), an away score (a whole number) and status (scheduled, in progress or completed, scheduled by default).

Pages
  Home (a landing page: hero, features, faq and call to action), Teams (lists teams), Players (lists players) and Matches (lists matches; search by home team or away team).

Sign-in and access
  People sign in with Google.
  Everyone sees and changes only their own records.
  Roles: admin (Club administrator. Manages teams, players, and matches); coach (Team coach. Manages players and matches for their team); player (A player in the club). New users get the player role.
  Open to anyone without signing in: the home page, the matches page, reading teams, reading players and reading matches.
Generated 66 files (66 changed, 0 removed).
No config path provided, using default 'drizzle.config.ts'
Reading config file '/tmp/smithable-bench-m12-DFg86C/app-7/drizzle.config.ts'
7 tables
account 13 columns 1 indexes 1 fks
matches 11 columns 0 indexes 3 fks
players 8 columns 0 indexes 2 fks
session 8 columns 2 indexes 1 fks
teams 7 columns 0 indexes 1 fks
user 8 columns 1 indexes 0 fks
verification 6 columns 1 indexes 0 fks

[✓] Your SQL migration file ➜ drizzle/0000_optimal_warbird.sql 🚀

Created /tmp/smithable-bench-m12-DFg86C/app-7. Start it with:

  cd /tmp/smithable-bench-m12-DFg86C/app-7
  smithable run
(node:567894) Warning: Accessing non-existent property 'replaceRouteChunk' of module exports inside circular dependency
(Use `node --trace-warnings ...` to show where the warning was created)
$ tsx src/db/seed.ts
```

### 8. Event registration for a conference: talks, speakers and attendees.

Failed:

```text
Starting from the booking starter.
Smithable model (mistral-medium-latest) · 16,326 tokens · €0.0111
No model drafted a valid project.
smithable.yml:18:18  error  Attendee has no reference to Talk, so "Talk.attendees" cannot list anything.
    hint: Add a field like "talk: Talk!" to Attendee.
smithable.yml:36:14  error  Talk has no reference to Attendee, so "Attendee.talks" cannot list anything.
    hint: Add a field like "attendee: Attendee!" to Talk.
Without a model, start from a starter: smithable new /tmp/smithable-bench-m12-DFg86C/app-8 --starter booking

```

### 9. A help desk for an IT team: tickets, priorities and who handles them.

Failed:

```text
Starting from the invoicing starter.
Smithable model (mistral-medium-latest) · 17,966 tokens · €0.0114
No model drafted a valid project.
smithable.yml:34:40  error  "by" needs a date field: the chart has a bar per month.
Without a model, start from a starter: smithable new /tmp/smithable-bench-m12-DFg86C/app-9 --starter invoicing

```

### 10. A recipe collection for a family, with ingredients and shopping lists.

```text
Family Recipe Collection
  A shared space for family recipes, ingredients, and shopping lists.

Recipes
  Recipes have a recipe name (required), a description, instructions (required), number of servings (a whole number, required, 4 by default), a preparation time (minutes) (a whole number), a cooking time (minutes) (a whole number) and tags.
  Each recipe lists its ingredients.

Ingredients
  Ingredients have a name (required), a quantity (a number), an unit of measurement and a recipe (a recipe, required).

Shopping lists
  Shopping lists have a shopping list name (required) and a date (required, TODAY() by default).
  Each shopping list lists its shopping items.

Shopping items
  Shopping items have an ingredient (an ingredient, required), a quantity (a number), an unit, a purchased? (yes or no, false by default) and a shopping list (a shopping list, required).

Pages
  Recipes (lists recipes; search by recipe name or tags) and Shopping lists (lists shopping lists; search by shopping list name).

Sign-in and access
  People sign in with Google.
  Everyone who signs in sees all records, and changes and deletes the ones they own.
  Roles: admin (Manages the family recipe collection); member (Family member with full access). New users get the member role.
Generated 65 files (65 changed, 0 removed).
No config path provided, using default 'drizzle.config.ts'
Reading config file '/tmp/smithable-bench-m12-DFg86C/app-10/drizzle.config.ts'
8 tables
account 13 columns 1 indexes 1 fks
ingredients 8 columns 0 indexes 2 fks
recipes 11 columns 0 indexes 1 fks
session 8 columns 2 indexes 1 fks
shopping_items 9 columns 0 indexes 3 fks
shopping_lists 6 columns 0 indexes 1 fks
user 8 columns 1 indexes 0 fks
verification 6 columns 1 indexes 0 fks

[✓] Your SQL migration file ➜ drizzle/0000_overjoyed_thunderbolt.sql 🚀

Created /tmp/smithable-bench-m12-DFg86C/app-10. Start it with:

  cd /tmp/smithable-bench-m12-DFg86C/app-10
  smithable run
/tmp/smithable-bench-m12-DFg86C/app-10/smithable.auth.yml:6:16  warning  With shared access and no allowedDomains, anyone with an account at the sign-in provider can sign up and read all records.
    hint: Restrict sign-in with "allowedDomains" under "signIn", or use "defaultAccess: private".
(node:568408) Warning: Accessing non-existent property 'replaceRouteChunk' of module exports inside circular dependency
(Use `node --trace-warnings ...` to show where the warning was created)
$ tsx src/db/seed.ts
```
