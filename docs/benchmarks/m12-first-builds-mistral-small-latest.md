# M12 first builds: mistral-small-latest (2026-09-27)

Ten app descriptions, each started with `smithable new --describe` (the closest starter, adapted by the model; errors go back once). Totals: 3 / 10 created, 3 type-check, 163,538 tokens, €0.0224.

| Description | Starter | Created | Type-checks | Tokens | Cost | Time |
|---|---|---|---|---|---|---|
| A booking site for a yoga studio, with classes, teachers and online booking. | booking | yes | yes | 11,249 | €0.0016 | 16 s |
| A CRM for a small sales team: companies, contacts, deals and follow-ups. | crm | **no** | **no** | 19,086 | €0.0027 | 20 s |
| Invoicing for freelancers, with clients, invoices and payments. | invoicing | yes | yes | 13,963 | €0.0021 | 20 s |
| A tool library where neighbours lend each other tools. | crm | **no** | **no** | 17,397 | €0.0024 | 15 s |
| An inventory app for a small bakery: ingredients, suppliers and stock levels. | booking | **no** | **no** | 16,859 | €0.0023 | 15 s |
| A job board for a local union, with job posts and applications. | crm | **no** | **no** | 17,282 | €0.0023 | 15 s |
| A football club's site: teams, players, matches and results. | booking | yes | yes | 16,047 | €0.0021 | 18 s |
| Event registration for a conference: talks, speakers and attendees. | booking | **no** | **no** | 16,228 | €0.0022 | 14 s |
| A help desk for an IT team: tickets, priorities and who handles them. | invoicing | **no** | **no** | 18,744 | €0.0025 | 15 s |
| A recipe collection for a family, with ingredients and shopping lists. | crm | **no** | **no** | 16,683 | €0.0022 | 13 s |

## Summaries, for review

### 1. A booking site for a yoga studio, with classes, teachers and online booking.

```text
Stillwater Yoga
  Class schedule and online booking for a small yoga studio.

Class types
  Class types have a name (required), a summary, a level (beginner, all levels or advanced, all levels by default) and duration minutes (a whole number, required, 60 by default).
  Only admins can add class types.

Instructors
  Instructors have a name (required) and a bio.
  Only admins can add instructors.

Sessions
  Sessions have a class type (a class type, required), an instructor (an instructor, required), a starts at (a date and time, required), a capacity (a whole number, required, 12 by default) and a booked (a whole number, required, 0 by default).
  Only admins can add sessions.
  Rule: A session never has more confirmed bookings than its capacity.

Bookings
  Bookings have a session (a session, required), a member name (required), a member email (required), a booked at (a date and time, required, NOW() by default) and status (pending, confirmed or cancelled, pending by default).
  Only member users and admins can add bookings.
  Only member users and admins can change bookings.

Pages
  Home (a landing page: hero, classes, faq and call to action), Class schedule (lists sessions; search by class type or instructor), Class types (lists class types; only for admins), Instructors (lists instructors; only for admins) and My bookings (lists bookings; search by member name or member email; only for member users and admins).

Sign-in and access
  People sign in with Google or Facebook.
  Everyone sees and changes only their own records.
  Roles: admin (Studio staff. Manage the schedule, classes and teachers); member (A student who books classes). New users get the member role.
  Open to anyone without signing in: the home page, the sessions page, reading class types, reading instructors and reading sessions.
Generated 72 files (72 changed, 0 removed).
No config path provided, using default 'drizzle.config.ts'
Reading config file '/tmp/smithable-bench-m12-XoRdAI/app-1/drizzle.config.ts'
8 tables
account 13 columns 1 indexes 1 fks
bookings 9 columns 0 indexes 2 fks
class_types 8 columns 0 indexes 1 fks
instructors 6 columns 0 indexes 1 fks
session 8 columns 2 indexes 1 fks
sessions 9 columns 0 indexes 3 fks
user 8 columns 1 indexes 0 fks
verification 6 columns 1 indexes 0 fks

[✓] Your SQL migration file ➜ drizzle/0000_fixed_rawhide_kid.sql 🚀

Created /tmp/smithable-bench-m12-XoRdAI/app-1. Start it with:

  cd /tmp/smithable-bench-m12-XoRdAI/app-1
  smithable run
(node:563846) Warning: Accessing non-existent property 'replaceRouteChunk' of module exports inside circular dependency
(Use `node --trace-warnings ...` to show where the warning was created)
$ tsx src/db/seed.ts
```

### 2. A CRM for a small sales team: companies, contacts, deals and follow-ups.

Failed:

```text
Starting from the crm starter.
Smithable model (mistral-small-latest) · 19,086 tokens · €0.0027
No model drafted a valid project.
smithable.yml:101:26  error  "completed" cannot be searched: only stored text, email, phone, web address and choice fields, and references to records with a name, can.
smithable.auth.yml:11:47  error  Unknown key "contacts" in role "sales".
smithable.auth.yml:11:57  error  Unknown key "deals and follow-ups." in role "sales".
Without a model, start from a starter: smithable new /tmp/smithable-bench-m12-XoRdAI/app-2 --starter crm

```

### 3. Invoicing for freelancers, with clients, invoices and payments.

```text
Invoicely
  Simple invoicing for freelancers. Each user manages their own clients, invoices and payments.

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
  Invoice lines have an invoice (an invoice, required), a description (required), a quantity (a number, required, 1 by default) and an unit price (an amount, required).
  The amount is calculated: quantity * unitPrice.

Pages
  Home (a landing page: hero, features, pricing, faq and call to action), Overview (a dashboard: outstanding, overdue, paid, invoiced and latest), Invoices (lists invoices), Clients (lists clients), Settings (settings: edits your business profile) and Welcome (a first-time setup of your business profile in 2 steps).

Sign-in and access
  People sign in with Google.
  Everyone sees and changes only their own records.
  Roles: admin (Invoicely staff); member (A freelancer using Invoicely). New users get the member role.
  Open to anyone without signing in: the home page.
Generated 74 files (74 changed, 0 removed).
No config path provided, using default 'drizzle.config.ts'
Reading config file '/tmp/smithable-bench-m12-XoRdAI/app-3/drizzle.config.ts'
8 tables
account 13 columns 1 indexes 1 fks
business_profiles 9 columns 0 indexes 1 fks
clients 8 columns 0 indexes 1 fks
invoice_lines 9 columns 0 indexes 2 fks
invoices 10 columns 1 indexes 2 fks
session 8 columns 2 indexes 1 fks
user 8 columns 1 indexes 0 fks
verification 6 columns 1 indexes 0 fks

[✓] Your SQL migration file ➜ drizzle/0000_misty_johnny_blaze.sql 🚀

Created /tmp/smithable-bench-m12-XoRdAI/app-3. Start it with:

  cd /tmp/smithable-bench-m12-XoRdAI/app-3
  smithable run
(node:564354) Warning: Accessing non-existent property 'replaceRouteChunk' of module exports inside circular dependency
(Use `node --trace-warnings ...` to show where the warning was created)
$ tsx src/db/seed.ts
```

### 4. A tool library where neighbours lend each other tools.

Failed:

```text
Starting from the crm starter.
Smithable model (mistral-small-latest) · 17,397 tokens · €0.0024
No model drafted a valid project.
smithable.auth.yml:11:3  error  "owner" is not a role: it means the owner of a record.
smithable.ux.yml:30:3  error  Tool.available is not a choice field.
Without a model, start from a starter: smithable new /tmp/smithable-bench-m12-XoRdAI/app-4 --starter crm

```

### 5. An inventory app for a small bakery: ingredients, suppliers and stock levels.

Failed:

```text
Starting from the booking starter.
Smithable model (mistral-small-latest) · 16,859 tokens · €0.0023
No model drafted a valid project.
smithable.yml:56:61  error  "where" compares choice fields with one of their values, and yes/no fields with true or false.
Without a model, start from a starter: smithable new /tmp/smithable-bench-m12-XoRdAI/app-5 --starter booking

```

### 6. A job board for a local union, with job posts and applications.

Failed:

```text
Starting from the crm starter.
Smithable model (mistral-small-latest) · 17,282 tokens · €0.0023
No model drafted a valid project.
smithable.yml:46:9  error  section "features" of page "home" must be a mapping of keys to values.
smithable.yml:53:9  error  section "faq" of page "home" must be a mapping of keys to values.
Without a model, start from a starter: smithable new /tmp/smithable-bench-m12-XoRdAI/app-6 --starter crm

```

### 7. A football club's site: teams, players, matches and results.

```text
Football Club
  A site for a football club to showcase teams, players, matches and results.

Teams
  Teams have a name (required), a description, a manager and a founded year (a whole number).
  Only admins can add teams.

Players
  Players have a name (required), a position (goalkeeper, defender, midfielder or forward, goalkeeper by default), a team (a team, required), a number (a whole number), a bio and an image (a web address).
  Only admins can add players.

Matches
  Matches have a home team (a team, required), an away team (a team, required), a home score (a whole number, required, 0 by default), an away score (a whole number, required, 0 by default), a date (required), a location, a season and a competition (league or cup, league by default).
  Only admins can add matches.

Pages
  Home (a landing page: hero, features, faq and call to action), Teams (lists teams), Players (lists players; search by name or position) and Matches (lists matches; search by home team, away team, location, season or competition).

Sign-in and access
  People sign in with Google.
  Everyone sees and changes only their own records.
  Roles: admin (Club staff. Manage teams, players, matches and results); fan (A supporter who views club information). New users get the fan role.
  Open to anyone without signing in: the home page, reading teams, reading players and reading matches.
Generated 66 files (66 changed, 0 removed).
No config path provided, using default 'drizzle.config.ts'
Reading config file '/tmp/smithable-bench-m12-XoRdAI/app-7/drizzle.config.ts'
7 tables
account 13 columns 1 indexes 1 fks
matches 12 columns 0 indexes 3 fks
players 10 columns 0 indexes 2 fks
session 8 columns 2 indexes 1 fks
teams 8 columns 0 indexes 1 fks
user 8 columns 1 indexes 0 fks
verification 6 columns 1 indexes 0 fks

[✓] Your SQL migration file ➜ drizzle/0000_dark_odin.sql 🚀

Created /tmp/smithable-bench-m12-XoRdAI/app-7. Start it with:

  cd /tmp/smithable-bench-m12-XoRdAI/app-7
  smithable run
(node:564846) Warning: Accessing non-existent property 'replaceRouteChunk' of module exports inside circular dependency
(Use `node --trace-warnings ...` to show where the warning was created)
$ tsx src/db/seed.ts
```

### 8. Event registration for a conference: talks, speakers and attendees.

Failed:

```text
Starting from the booking starter.
Smithable model (mistral-small-latest) · 16,228 tokens · €0.0022
No model drafted a valid project.
smithable.yml:18:17  error  Attendee has no reference to Talk, so "Talk.attendee" cannot list anything.
    hint: Add a field like "talk: Talk!" to Attendee.
smithable.yml:37:14  error  Talk has no reference to Attendee, so "Attendee.talks" cannot list anything.
    hint: Add a field like "attendee: Attendee!" to Talk.
Without a model, start from a starter: smithable new /tmp/smithable-bench-m12-XoRdAI/app-8 --starter booking

```

### 9. A help desk for an IT team: tickets, priorities and who handles them.

Failed:

```text
Starting from the invoicing starter.
Smithable model (mistral-small-latest) · 18,744 tokens · €0.0025
No model drafted a valid project.
smithable.yml:13:17  error  Field "Ticket.priority": A choice field's default is its first value, so "=" is not used here.
    hint: Put the default first, or use the long form with "default:".
smithable.yml:38:15  error  There is no model named "Profile".
Without a model, start from a starter: smithable new /tmp/smithable-bench-m12-XoRdAI/app-9 --starter invoicing

```

### 10. A recipe collection for a family, with ingredients and shopping lists.

Failed:

```text
Starting from the crm starter.
Smithable model (mistral-small-latest) · 16,683 tokens · €0.0022
No model drafted a valid project.
smithable.yml:41:9  error  section "features" of page "home" must be a mapping of keys to values.
smithable.yml:48:9  error  section "faq" of page "home" must be a mapping of keys to values.
Without a model, start from a starter: smithable new /tmp/smithable-bench-m12-XoRdAI/app-10 --starter crm

```
