# M12 first builds: mistral-small-latest (2026-09-27)

Ten app descriptions, each started with `smithable new --describe` (the closest starter, adapted by the model; errors go back once). Totals: 2 / 10 created, 2 type-check, 171,863 tokens, €0.0238.

| Description | Starter | Created | Type-checks | Tokens | Cost | Time |
|---|---|---|---|---|---|---|
| A booking site for a yoga studio, with classes, teachers and online booking. | booking | **no** | **no** | 17,691 | €0.0025 | 16 s |
| A CRM for a small sales team: companies, contacts, deals and follow-ups. | crm | **no** | **no** | 18,460 | €0.0026 | 17 s |
| Invoicing for freelancers, with clients, invoices and payments. | invoicing | yes | yes | 13,977 | €0.0021 | 20 s |
| A tool library where neighbours lend each other tools. | crm | **no** | **no** | 16,553 | €0.0022 | 13 s |
| An inventory app for a small bakery: ingredients, suppliers and stock levels. | booking | **no** | **no** | 17,173 | €0.0024 | 16 s |
| A job board for a local union, with job posts and applications. | crm | **no** | **no** | 17,094 | €0.0023 | 14 s |
| A football club's site: teams, players, matches and results. | booking | yes | yes | 16,090 | €0.0021 | 18 s |
| Event registration for a conference: talks, speakers and attendees. | booking | **no** | **no** | 17,075 | €0.0024 | 16 s |
| A help desk for an IT team: tickets, priorities and who handles them. | invoicing | **no** | **no** | 18,794 | €0.0025 | 15 s |
| A recipe collection for a family, with ingredients and shopping lists. | crm | **no** | **no** | 18,956 | €0.0027 | 19 s |

## Summaries, for review

### 1. A booking site for a yoga studio, with classes, teachers and online booking.

Failed:

```text
Starting from the booking starter.
Smithable model (mistral-small-latest) · 17,691 tokens · €0.0025
No model drafted a valid project.
smithable.yml:60:14  error  Session has no field named "name" to search page "sessions" by.
Without a model, start from a starter: smithable new /tmp/smithable-bench-m12-bdSpdg/app-1 --starter booking

```

### 2. A CRM for a small sales team: companies, contacts, deals and follow-ups.

Failed:

```text
Starting from the crm starter.
Smithable model (mistral-small-latest) · 18,460 tokens · €0.0026
No model drafted a valid project.
smithable.yml:88:20  error  "due" cannot be searched: only stored text, email, phone, web address and choice fields can.
smithable.auth.yml:11:47  error  Unknown key "contacts" in role "sales".
smithable.auth.yml:11:57  error  Unknown key "deals and follow-ups." in role "sales".
Without a model, start from a starter: smithable new /tmp/smithable-bench-m12-bdSpdg/app-2 --starter crm

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
Reading config file '/tmp/smithable-bench-m12-bdSpdg/app-3/drizzle.config.ts'
8 tables
account 13 columns 1 indexes 1 fks
business_profiles 9 columns 0 indexes 1 fks
clients 8 columns 0 indexes 1 fks
invoice_lines 9 columns 0 indexes 2 fks
invoices 10 columns 1 indexes 2 fks
session 8 columns 2 indexes 1 fks
user 8 columns 1 indexes 0 fks
verification 6 columns 1 indexes 0 fks

[✓] Your SQL migration file ➜ drizzle/0000_safe_mordo.sql 🚀

Created /tmp/smithable-bench-m12-bdSpdg/app-3. Start it with:

  cd /tmp/smithable-bench-m12-bdSpdg/app-3
  smithable run
(node:429534) Warning: Accessing non-existent property 'replaceRouteChunk' of module exports inside circular dependency
(Use `node --trace-warnings ...` to show where the warning was created)
$ tsx src/db/seed.ts
```

### 4. A tool library where neighbours lend each other tools.

Failed:

```text
Starting from the crm starter.
Smithable model (mistral-small-latest) · 16,553 tokens · €0.0022
No model drafted a valid project.
smithable.yml:47:22  error  "requestedAt" cannot be searched: only stored text, email, phone, web address and choice fields can.
Without a model, start from a starter: smithable new /tmp/smithable-bench-m12-bdSpdg/app-4 --starter crm

```

### 5. An inventory app for a small bakery: ingredients, suppliers and stock levels.

Failed:

```text
oking starter.
Smithable model (mistral-small-latest) · 17,173 tokens · €0.0024
No model drafted a valid project.
smithable.yml:51:20  error  "supplier" cannot be searched: only stored text, email, phone, web address and choice fields can.
smithable.yml:57:61  error  "where" compares choice fields with one of their values, and yes/no fields with true or false.
smithable.yml:62:14  error  "ingredient" cannot be searched: only stored text, email, phone, web address and choice fields can.
Without a model, start from a starter: smithable new /tmp/smithable-bench-m12-bdSpdg/app-5 --starter booking

```

### 6. A job board for a local union, with job posts and applications.

Failed:

```text
Starting from the crm starter.
Smithable model (mistral-small-latest) · 17,094 tokens · €0.0023
No model drafted a valid project.
smithable.yml:47:9  error  section "features" of page "jobs" must be a mapping of keys to values.
smithable.yml:50:9  error  section "faq" of page "jobs" must be a mapping of keys to values.
Without a model, start from a starter: smithable new /tmp/smithable-bench-m12-bdSpdg/app-6 --starter crm

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
  Home (a landing page: hero, features, faq and call to action), Teams (lists teams), Players (lists players; search by name or position) and Matches (lists matches; search by location, season or competition).

Sign-in and access
  People sign in with Google.
  Everyone sees and changes only their own records.
  Roles: admin (Club staff. Manage teams, players, matches and results); fan (A supporter who views club information). New users get the fan role.
  Open to anyone without signing in: the home page, reading teams, reading players and reading matches.
Generated 66 files (66 changed, 0 removed).
No config path provided, using default 'drizzle.config.ts'
Reading config file '/tmp/smithable-bench-m12-bdSpdg/app-7/drizzle.config.ts'
7 tables
account 13 columns 1 indexes 1 fks
matches 12 columns 0 indexes 3 fks
players 10 columns 0 indexes 2 fks
session 8 columns 2 indexes 1 fks
teams 8 columns 0 indexes 1 fks
user 8 columns 1 indexes 0 fks
verification 6 columns 1 indexes 0 fks

[✓] Your SQL migration file ➜ drizzle/0000_lowly_scrambler.sql 🚀

Created /tmp/smithable-bench-m12-bdSpdg/app-7. Start it with:

  cd /tmp/smithable-bench-m12-bdSpdg/app-7
  smithable run
(node:430064) Warning: Accessing non-existent property 'replaceRouteChunk' of module exports inside circular dependency
(Use `node --trace-warnings ...` to show where the warning was created)
$ tsx src/db/seed.ts
```

### 8. Event registration for a conference: talks, speakers and attendees.

Failed:

```text
Starting from the booking starter.
Smithable model (mistral-small-latest) · 17,075 tokens · €0.0024
No model drafted a valid project.
smithable.yml:18:28  error  Attendee has no reference to Talk, so "Talk.registeredAttendees" cannot list anything.
    hint: Add a field like "talk: Talk!" to Attendee.
smithable.yml:37:23  error  Talk has no reference to Attendee, so "Attendee.attendingTalks" cannot list anything.
    hint: Add a field like "attendee: Attendee!" to Talk.
Without a model, start from a starter: smithable new /tmp/smithable-bench-m12-bdSpdg/app-8 --starter booking

```

### 9. A help desk for an IT team: tickets, priorities and who handles them.

Failed:

```text
Starting from the invoicing starter.
Smithable model (mistral-small-latest) · 18,794 tokens · €0.0025
No model drafted a valid project.
smithable.yml:13:17  error  Field "Ticket.priority": A choice field's default is its first value, so "=" is not used here.
    hint: Put the default first, or use the long form with "default:".
Without a model, start from a starter: smithable new /tmp/smithable-bench-m12-bdSpdg/app-9 --starter invoicing

```

### 10. A recipe collection for a family, with ingredients and shopping lists.

Failed:

```text
:62:9  error  section "features" of page "home" must be a mapping of keys to values.
smithable.yml:66:9  error  section "faq" of page "home" must be a mapping of keys to values.
smithable.auth.yml:11:35  error  Unknown key "edit" in role "family".
smithable.auth.yml:11:41  error  Unknown key "and delete recipes" in role "family".
smithable.auth.yml:11:61  error  Unknown key "ingredients" in role "family".
smithable.auth.yml:11:74  error  Unknown key "and shopping lists." in role "family".
Without a model, start from a starter: smithable new /tmp/smithable-bench-m12-bdSpdg/app-10 --starter crm

```
