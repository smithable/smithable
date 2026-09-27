# M12 first builds: mistral-medium-latest (2026-09-27)

Ten app descriptions, each started with `smithable new --describe` (the closest starter, adapted by the model; errors go back once). Totals: 4 / 10 created, 4 type-check, 150,315 tokens, €0.0995.

| Description | Starter | Created | Type-checks | Tokens | Cost | Time |
|---|---|---|---|---|---|---|
| A booking site for a yoga studio, with classes, teachers and online booking. | booking | yes | yes | 4,660 | €0.0031 | 10 s |
| A CRM for a small sales team: companies, contacts, deals and follow-ups. | crm | **no** | **no** | 18,275 | €0.0130 | 18 s |
| Invoicing for freelancers, with clients, invoices and payments. | invoicing | yes | yes | 13,676 | €0.0105 | 21 s |
| A tool library where neighbours lend each other tools. | crm | **no** | **no** | 16,114 | €0.0102 | 14 s |
| An inventory app for a small bakery: ingredients, suppliers and stock levels. | booking | **no** | **no** | 14,498 | €0.0085 | 10 s |
| A job board for a local union, with job posts and applications. | crm | **no** | **no** | 17,325 | €0.0118 | 16 s |
| A football club's site: teams, players, matches and results. | booking | yes | yes | 14,951 | €0.0091 | 17 s |
| Event registration for a conference: talks, speakers and attendees. | booking | **no** | **no** | 16,360 | €0.0111 | 15 s |
| A help desk for an IT team: tickets, priorities and who handles them. | invoicing | **no** | **no** | 17,959 | €0.0114 | 15 s |
| A recipe collection for a family, with ingredients and shopping lists. | crm | yes | yes | 16,497 | €0.0108 | 21 s |

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
Reading config file '/tmp/smithable-bench-m12-22Yx4W/app-1/drizzle.config.ts'
7 tables
account 13 columns 1 indexes 1 fks
class_types 8 columns 0 indexes 1 fks
instructors 6 columns 0 indexes 1 fks
session 8 columns 2 indexes 1 fks
sessions 8 columns 0 indexes 3 fks
user 8 columns 1 indexes 0 fks
verification 6 columns 1 indexes 0 fks

[✓] Your SQL migration file ➜ drizzle/0000_clean_lord_tyger.sql 🚀

Created /tmp/smithable-bench-m12-22Yx4W/app-1. Start it with:

  cd /tmp/smithable-bench-m12-22Yx4W/app-1
  smithable run
(node:430619) Warning: Accessing non-existent property 'replaceRouteChunk' of module exports inside circular dependency
(Use `node --trace-warnings ...` to show where the warning was created)
$ tsx src/db/seed.ts
```

### 2. A CRM for a small sales team: companies, contacts, deals and follow-ups.

Failed:

```text
Starting from the crm starter.
Smithable model (mistral-medium-latest) · 18,275 tokens · €0.0130
No model drafted a valid project.
smithable.auth.yml:10:63  error  Unknown key "contacts" in role "sales".
smithable.auth.yml:10:73  error  Unknown key "deals and follow-ups." in role "sales".
smithable.ux.yml:31:3  error  FollowUp.completed is not a choice field.
Without a model, start from a starter: smithable new /tmp/smithable-bench-m12-22Yx4W/app-2 --starter crm

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
  Invoices have an invoice number (required, unique), a client (a client, required), an issued on (a date, required, TODAY() by default), a due on (a date, required, DATEADD(issuedOn, 30, "day") by default) and status (draft, sent, paid or overdue, draft by default).
  Each invoice lists its invoice lines.
  The total is calculated: SUM(lines.amount).
  Rule: Invoice numbers are sequential per user, like 2026-001, 2026-002.
  Rule: A sent or paid invoice can no longer be edited, only credited.

Invoice lines
  Invoice lines have an invoice (an invoice, required), a description (required), a qty (a number, required, 1 by default) and an unit price (an amount, required).
  The amount is calculated: quantity * unitPrice.

Pages
  Home (a landing page: hero, features, pricing, faq and call to action), Overview (a dashboard: outstanding, overdue, paid, invoiced and latest), Invoices (lists invoices; search by invoice number), Clients (lists clients; search by name or email), Settings (settings: edits your business profile) and Welcome (a first-time setup of your business profile in 2 steps).

Sign-in and access
  People sign in with Google.
  Everyone sees and changes only their own records.
  Roles: admin (Invoicely staff); member (A freelancer using Invoicely). New users get the member role.
  Open to anyone without signing in: the home page.
Generated 73 files (73 changed, 0 removed).
No config path provided, using default 'drizzle.config.ts'
Reading config file '/tmp/smithable-bench-m12-22Yx4W/app-3/drizzle.config.ts'
8 tables
account 13 columns 1 indexes 1 fks
business_profiles 9 columns 0 indexes 1 fks
clients 8 columns 0 indexes 1 fks
invoice_lines 9 columns 0 indexes 2 fks
invoices 10 columns 1 indexes 2 fks
session 8 columns 2 indexes 1 fks
user 8 columns 1 indexes 0 fks
verification 6 columns 1 indexes 0 fks

[✓] Your SQL migration file ➜ drizzle/0000_wonderful_morg.sql 🚀

Created /tmp/smithable-bench-m12-22Yx4W/app-3. Start it with:

  cd /tmp/smithable-bench-m12-22Yx4W/app-3
  smithable run
(node:431141) Warning: Accessing non-existent property 'replaceRouteChunk' of module exports inside circular dependency
(Use `node --trace-warnings ...` to show where the warning was created)
$ tsx src/db/seed.ts
```

### 4. A tool library where neighbours lend each other tools.

Failed:

```text
Starting from the crm starter.
Smithable model (mistral-medium-latest) · 16,114 tokens · €0.0102
No model drafted a valid project.
smithable.yml:15:7  error  "owner" is added to every model automatically, so it cannot be declared.
smithable.yml:18:14  error  "ownedBy" of "Tool" must name one of its User fields.
Without a model, start from a starter: smithable new /tmp/smithable-bench-m12-22Yx4W/app-4 --starter crm

```

### 5. An inventory app for a small bakery: ingredients, suppliers and stock levels.

Failed:

```text
Starting from the booking starter.
Smithable model (mistral-medium-latest) · 14,498 tokens · €0.0085
No model drafted a valid project.
smithable.yml:45:14  error  "ingredient" cannot be searched: only stored text, email, phone, web address and choice fields can.
smithable.yml:45:26  error  "supplier" cannot be searched: only stored text, email, phone, web address and choice fields can.
Without a model, start from a starter: smithable new /tmp/smithable-bench-m12-22Yx4W/app-5 --starter booking

```

### 6. A job board for a local union, with job posts and applications.

Failed:

```text
Starting from the crm starter.
Smithable model (mistral-medium-latest) · 17,325 tokens · €0.0118
No model drafted a valid project.
smithable.yml:52:14  error  "jobPost" cannot be searched: only stored text, email, phone, web address and choice fields can.
Without a model, start from a starter: smithable new /tmp/smithable-bench-m12-22Yx4W/app-6 --starter crm

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
  Home (a landing page: hero, features, faq and call to action), Teams (lists teams), Players (lists players) and Matches (lists matches; search by location).

Sign-in and access
  People sign in with Google.
  Everyone sees and changes only their own records.
  Roles: admin (Club administrator. Manages teams, players, and matches); coach (Team coach. Manages players and matches for their team); player (A player in the club). New users get the player role.
  Open to anyone without signing in: the home page, the matches page, reading teams, reading players and reading matches.
Generated 66 files (66 changed, 0 removed).
No config path provided, using default 'drizzle.config.ts'
Reading config file '/tmp/smithable-bench-m12-22Yx4W/app-7/drizzle.config.ts'
7 tables
account 13 columns 1 indexes 1 fks
matches 11 columns 0 indexes 3 fks
players 8 columns 0 indexes 2 fks
session 8 columns 2 indexes 1 fks
teams 7 columns 0 indexes 1 fks
user 8 columns 1 indexes 0 fks
verification 6 columns 1 indexes 0 fks

[✓] Your SQL migration file ➜ drizzle/0000_watery_molecule_man.sql 🚀

Created /tmp/smithable-bench-m12-22Yx4W/app-7. Start it with:

  cd /tmp/smithable-bench-m12-22Yx4W/app-7
  smithable run
(node:431697) Warning: Accessing non-existent property 'replaceRouteChunk' of module exports inside circular dependency
(Use `node --trace-warnings ...` to show where the warning was created)
$ tsx src/db/seed.ts
```

### 8. Event registration for a conference: talks, speakers and attendees.

Failed:

```text
Starting from the booking starter.
Smithable model (mistral-medium-latest) · 16,360 tokens · €0.0111
No model drafted a valid project.
smithable.yml:18:18  error  Attendee has no reference to Talk, so "Talk.attendees" cannot list anything.
    hint: Add a field like "talk: Talk!" to Attendee.
smithable.yml:36:14  error  Talk has no reference to Attendee, so "Attendee.talks" cannot list anything.
    hint: Add a field like "attendee: Attendee!" to Talk.
Without a model, start from a starter: smithable new /tmp/smithable-bench-m12-22Yx4W/app-8 --starter booking

```

### 9. A help desk for an IT team: tickets, priorities and who handles them.

Failed:

```text
Starting from the invoicing starter.
Smithable model (mistral-medium-latest) · 17,959 tokens · €0.0114
No model drafted a valid project.
smithable.yml:34:40  error  "by" needs a date field: the chart has a bar per month.
Without a model, start from a starter: smithable new /tmp/smithable-bench-m12-22Yx4W/app-9 --starter invoicing

```

### 10. A recipe collection for a family, with ingredients and shopping lists.

```text
Family Recipe Collection
  A shared space for family recipes, ingredients, and shopping lists.

Recipes
  Recipes have a recipe name (required), a description, instructions (required), servings (a whole number, required, 4 by default), a prep time (minutes) (a whole number), a cook time (minutes) (a whole number) and tags.
  Each recipe lists its ingredients.

Ingredients
  Ingredients have an ingredient (required), a quantity (required) and a recipe (a recipe, required).

Shopping lists
  Shopping lists have a shopping list name (required).
  Each shopping list lists its shopping items.

Shopping items
  Shopping items have an item (required), a quantity, a purchased (yes or no, false by default) and a shopping list (a shopping list, required).

Pages
  Home (a landing page: hero and call to action), Recipes (lists recipes; search by recipe name or tags) and Shopping lists (lists shopping lists; search by shopping list name).

Sign-in and access
  People sign in with Google.
  Everyone who signs in sees all records, and changes and deletes the ones they own.
  Roles: admin (Manages the family recipe collection); member (Family member with full access). New users get the member role.
  Open to anyone without signing in: the home page.
Generated 65 files (65 changed, 0 removed).
No config path provided, using default 'drizzle.config.ts'
Reading config file '/tmp/smithable-bench-m12-22Yx4W/app-10/drizzle.config.ts'
8 tables
account 13 columns 1 indexes 1 fks
ingredients 7 columns 0 indexes 2 fks
recipes 11 columns 0 indexes 1 fks
session 8 columns 2 indexes 1 fks
shopping_items 8 columns 0 indexes 2 fks
shopping_lists 5 columns 0 indexes 1 fks
user 8 columns 1 indexes 0 fks
verification 6 columns 1 indexes 0 fks

[✓] Your SQL migration file ➜ drizzle/0000_silly_wonder_man.sql 🚀

Created /tmp/smithable-bench-m12-22Yx4W/app-10. Start it with:

  cd /tmp/smithable-bench-m12-22Yx4W/app-10
  smithable run
/tmp/smithable-bench-m12-22Yx4W/app-10/smithable.auth.yml:6:16  warning  With shared access and no allowedDomains, anyone with an account at the sign-in provider can sign up and read all records.
    hint: Restrict sign-in with "allowedDomains" under "signIn", or use "defaultAccess: private".
(node:432214) Warning: Accessing non-existent property 'replaceRouteChunk' of module exports inside circular dependency
(Use `node --trace-warnings ...` to show where the warning was created)
$ tsx src/db/seed.ts
```
