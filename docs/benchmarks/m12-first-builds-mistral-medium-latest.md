# M12 first builds: mistral-medium-latest (2026-10-03)

The app descriptions, each started with `smithable new --describe … --yes` (the starter the first step picks, adapted by the model; errors go back up to twice). Totals: 12 / 12 created, 12 type-check, 152,092 tokens, €0.0925.

| Description | Starter | Created | Type-checks | Tokens | Cost | Time |
|---|---|---|---|---|---|---|
| A booking site for a yoga studio, with classes, teachers and online booking. | booking | yes | yes | 16,721 | €0.0092 | 70 s |
| A CRM for a small sales team: companies, contacts, deals and follow-ups. | crm | yes | yes | 8,239 | €0.0049 | 45 s |
| Invoicing for freelancers, with clients, invoices and payments. | invoicing | yes | yes | 17,370 | €0.0105 | 57 s |
| A tool library where neighbors lend each other tools. | marketplace | yes | yes | 14,862 | €0.0074 | 44 s |
| An inventory app for a small bakery: ingredients, suppliers and stock levels. | records | yes | yes | 8,029 | €0.0052 | 37 s |
| A job board for a local union, with job posts and applications. | marketplace | yes | yes | 8,091 | €0.0051 | 31 s |
| A football club's site: teams, players, matches and results. | records | yes | yes | 8,763 | €0.0066 | 31 s |
| Event registration for a conference: talks, speakers and attendees. | booking | yes | yes | 16,478 | €0.0088 | 34 s |
| A help desk for an IT team: tickets, priorities and who handles them. | records | yes | yes | 8,058 | €0.0052 | 27 s |
| A recipe collection for a family, with ingredients and shopping lists. | records | yes | yes | 9,141 | €0.0074 | 36 s |
| A status page for our API, with incidents and planned maintenance. | status | yes | yes | 19,769 | €0.0132 | 39 s |
| A public uptime page for a web shop: which services work, outages and their updates. | status | yes | yes | 16,571 | €0.0090 | 30 s |

Each created app's four spec files are in [m12-first-builds-mistral-medium-latest/](m12-first-builds-mistral-medium-latest/), one folder per description (app-1 …).

<!-- scorecard -->
## Against the earlier runs

The first run came from main before #169 (shared drafts invite-only) and #174 (the first step in any language and with `--yes`; labels and texts in the description's language). The second, #176, came after them. This one adds #180, A's fixes for the bugs the second run found.

- **All twelve are created and type-check again.** The first run had 12 of 12 and the second 9 of 12. The second run's three failures (7, 11, 12: a `hero:` left empty after the hero picture was not written) are gone.
- **No open sign-up.** Open-shared-access warnings went from 6 in the first run to 0 in the second, and are still 0.
- **One draft publishes personal data:** 8, the conference, publishes its speakers. The first run had two.
- **Starters by meaning.** As in the second run, four starters differ from the word match: tool library to marketplace, bakery to records, conference to booking, help desk to records.
- **Questions.** The first step would ask questions for 5, 6, 8 and 9.
- **Still wrong: an English description gets Spanish titles.** 7, the football club's site, again has page titles in Spanish (Equipos, Jugadores, Partidos, Resultados), as in the second run. The first run did not, so it comes with #174's language rule.

## Scorecard (scripts/bench-m12.mjs --score)

| # | Starter | Questions | Models kept | Pages kept | Actions kept | Access; roles (default) | Pages with access | Public | Warnings | Starter's texts in the draft | Models with the starter's samples | Visitors / landing |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | booking | 0 | 5 / 6 | 7 / 10 | 0 / 0 | private; admin, member (member) | class-types: admin, instructors: admin, sessions: admin | pages home, schedule; read ClassType, Instructor, Session; create Message | 2 (capacity-no-unique, no-timezone) | none | 3 / 5 | mentions visitors; landing page |
| 2 | crm | 0 | 0 / 2 | 1 / 3 | 0 / 1 | shared; admin, sales (sales) | none | pages none; read none; create none | 0 | none | 0 / 4 | no mention; no landing page |
| 3 | invoicing | 0 | 4 / 4 | 5 / 7 | 0 / 0 | private; admin, member (member) | none | pages home; read none; create none | 0 | none | 3 / 4 | no mention; landing page |
| 4 | marketplace (words: records) | 0 | 0 / 1 | 1 / 4 | 0 / 0 | private; admin, member (member) | none | pages home; read none; create none | 0 | none | 0 / 1 | no mention; landing page |
| 5 | records (words: booking) | 3 | 0 / 1 | 0 / 2 | 0 / 0 | shared; admin, baker (baker) | none | pages none; read none; create none | 0 | none | 0 / 3 | no mention; no landing page |
| 6 | marketplace | 2 | 0 / 1 | 1 / 4 | 0 / 0 | shared; admin, employer, member (member) | applications: employer | pages home, jobs; read Job; create none | 0 | none | 0 / 2 | no mention; landing page |
| 7 | records | 0 | 0 / 1 | 1 / 2 | 0 / 0 | private; admin, member (member) | none | pages home, teams, players, matches, results; read Team, Player, Match, Result; create none | 0 | none | 0 / 4 | mentions visitors; landing page |
| 8 | booking (words: records) | 2 | 0 / 6 | 2 / 10 | 0 / 0 | shared; admin, organizer, attendee (attendee) | talks: organizer, speakers: organizer, attendees: organizer, registrations: organizer/attendee | pages home; read Talk, Speaker; create none | 2 (capacity-no-unique, public-personal-data) | none | 0 / 4 | no mention; landing page |
| 9 | records (words: invoicing) | 3 | 0 / 1 | 0 / 2 | 0 / 0 | shared; admin, itSupport (itSupport) | none | pages none; read none; create none | 0 | none | 0 / 1 | no mention; no landing page |
| 10 | records | 0 | 0 / 1 | 0 / 2 | 0 / 0 | shared; admin, member (member) | none | pages none; read none; create none | 0 | none | 0 / 4 | no mention; no landing page |
| 11 | status | 0 | 4 / 4 | 7 / 8 | 0 / 3 | shared; admin, staff (staff) | components: admin | pages home; read Component, Incident, Maintenance; create none | 0 | none | 4 / 4 | no mention; landing page |
| 12 | status | 0 | 4 / 4 | 6 / 8 | 3 / 3 | shared; admin, staff (staff) | incidents: admin/staff, updates: admin/staff, components: admin, maintenance: admin/staff | pages home; read Component, Incident, IncidentUpdate, Maintenance; create none | 0 | none | 4 / 4 | mentions visitors; landing page |

"Kept" counts the starter's models, pages and actions that the draft still has by name. "Starter's texts" lists the starter's app name or sample titles found in the draft's spec or content. "Models with the starter's samples" counts the draft's models that keep some of the starter's sample records after `fitSamples`; the rest get generated rows. "Mentions visitors" means the description says visitors, public or site. "Starter" is the one `new --describe --yes` printed, with the word-match starter (`closestStarter`) beside it when it differs; "Questions" counts what `smithable clarify` would ask (`--yes` asks nothing), with their language for a description not in English.
<!-- /scorecard -->

## Summaries, for review

### 1. A booking site for a yoga studio, with classes, teachers and online booking.

```text
Yoga Studio
  Class schedule and online booking for a yoga studio.

Pages
  - Home (a landing page: hero, class types, gallery, faq, contact, call to action and footer)
  - Class types (lists class types; only for admins; visitors see class types on the Home page)
  - Instructors (lists instructors; only for admins)
  - Team (who has access: invite people, change roles, remove users)
  - Admin (every kind of record, to find, open, change and delete)
  - Sessions (lists sessions; only for admins)
  - My bookings (lists bookings; only the viewer's own records)
  - Schedule (a calendar of sessions by week or month)

Class types
  Class types have:
  - a name (required)
  - a summary
  - a level (beginner, all levels or advanced, beginner by default)
  - duration minutes (a whole number, required, 60 by default)
  Only admins can add class types.

Instructors
  Instructors have:
  - a name (required)
  - a bio
  - a portrait (picture)
  Only admins can add instructors.

Messages
  Messages have:
  - a name (required)
  - an email (required)
  - a message (required)
  Only admins can see messages.
  Only admins can change messages.
  Only admins can delete messages.

Sessions
  Sessions have:
  - a class type (a class type, required)
  - an instructor (an instructor, required)
  - starts at (a date and time, required)
  - a capacity (a whole number, required, 12 by default)
  Each session lists its bookings.
  Only admins can add sessions.
  Only admins can delete sessions.

Bookings
  Bookings have:
  - a session (a session, required)
  - status (booked, attended or cancelled, booked by default)
  Only member users and admins can add bookings.
  Only member users and admins can delete bookings.
  At most the session's capacity bookings per session (counting those with status booked or attended).

Sign-in and access
  People sign in with Google.
  Everyone sees and changes only their own records.
  Roles:
  - admin (Studio staff. Manage the schedule, classes and teachers)
  - member (A student who books classes)
  New users get the member role.
  Open to anyone without signing in: the home page, the schedule page, reading class types, reading instructors, reading sessions and adding messages.
Pictures from the Smithable image library: samples/1.webp, samples/2.webp, samples/3.webp, samples/4.webp, samples/5.webp, samples/6.webp, hero.webp.
Generated 117 files (117 changed, 0 removed).
No config path provided, using default 'drizzle.config.ts'
Reading config file '/tmp/smithable-bench-m12-ySDwIe/app-1/drizzle.config.ts'
10 tables
account 13 columns 1 indexes 1 fks
bookings 6 columns 0 indexes 2 fks
class_types 8 columns 0 indexes 1 fks
instructors 7 columns 0 indexes 1 fks
invitation 7 columns 2 indexes 1 fks
messages 7 columns 0 indexes 1 fks
session 8 columns 2 indexes 1 fks
sessions 8 columns 0 indexes 3 fks
user 8 columns 1 indexes 0 fks
verification 6 columns 1 indexes 0 fks

[✓] Your SQL migration file ➜ drizzle/0000_calm_microbe.sql 🚀

Created /tmp/smithable-bench-m12-ySDwIe/app-1. Start it with:

  cd /tmp/smithable-bench-m12-ySDwIe/app-1
  smithable run
/tmp/smithable-bench-m12-ySDwIe/app-1/smithable.yml:45:7  warning  Booking has a capacity per session, but "session" is not unique: one person can take several places.
    hint: Write "session: Session! unique" for one booking per person and session (unique per owner with private access).
/tmp/smithable-bench-m12-ySDwIe/app-1/smithable.yml:85:14  warning  Page "schedule" is a calendar, but the app has no time zone: records are placed in UTC.
    hint: Set "timezone" under "app", e.g. "Europe/Mariehamn".
```

### 2. A CRM for a small sales team: companies, contacts, deals and follow-ups.

```text
Small Sales Team CRM
  A CRM for a small sales team to manage companies, contacts, deals and follow-ups.

Pages
  - Companies (lists companies; search by name)
  - Contacts (lists contacts; search by first name, last name or email)
  - Deals (lists deals; search by name or company; filter by stage, company or contact)
  - Follow ups (lists follow ups; search by title or deal; filter by completed, due date or deal)
  - Team (who has access: invite people, change roles, remove users)

Companies
  Companies have:
  - a name (required)
  - an industry
  - a website (a web address)
  - notes
  Each company can have an account manager (a user).
  Only admins can delete companies.

Contacts
  Contacts have:
  - a first name (required)
  - a last name (required)
  - an email
  - a phone
  - a position
  - a company (a company, required)
  - notes
  Only admins can delete contacts.

Deals
  Deals have:
  - a name (required)
  - a company (a company, required)
  - a contact (a contact)
  - a value (an amount)
  - a stage (prospect, qualified, proposal, negotiation, closed won or closed lost, prospect by default)
  - a close date
  - notes
  Only admins can delete deals.

Follow ups
  Follow ups have:
  - a title (required)
  - a deal (a deal, required)
  - a due date (required)
  - notes
  - a completed (yes or no, false by default)
  Only admins can delete follow ups.

Sign-in and access
  People sign in with Google.
  Everyone who signs in sees all records, and changes and deletes the ones they own.
  Roles:
  - admin
  - sales (Works with companies, contacts, deals and follow-ups)
  New users get the sales role.
Pictures from the Smithable image library: samples/1.webp, samples/2.webp, samples/3.webp, samples/4.webp, samples/5.webp, samples/6.webp.
Generated 91 files (91 changed, 0 removed).
No config path provided, using default 'drizzle.config.ts'
Reading config file '/tmp/smithable-bench-m12-ySDwIe/app-2/drizzle.config.ts'
9 tables
account 13 columns 1 indexes 1 fks
companies 9 columns 0 indexes 2 fks
contacts 11 columns 0 indexes 2 fks
deals 11 columns 0 indexes 3 fks
follow_ups 9 columns 0 indexes 2 fks
invitation 7 columns 2 indexes 1 fks
session 8 columns 2 indexes 1 fks
user 8 columns 1 indexes 0 fks
verification 6 columns 1 indexes 0 fks

[✓] Your SQL migration file ➜ drizzle/0000_purple_vargas.sql 🚀

Created /tmp/smithable-bench-m12-ySDwIe/app-2. Start it with:

  cd /tmp/smithable-bench-m12-ySDwIe/app-2
  smithable run
```

### 3. Invoicing for freelancers, with clients, invoices and payments.

```text
Invoicing for Freelancers
  Invoicing app for freelancers to manage clients, invoices, and payments.

Pages
  - Invoicing for Freelancers (a landing page: hero, features, pricing, faq, call to action and footer)
  - Overview (lists invoices)
  - Invoices (lists invoices)
  - Clients (lists clients)
  - Settings (lists business profiles)
  - Dashboard (lists invoices)

Business Profiles
  Business Profiles have:
  - a business name (required)
  - a VAT number
  - an IBAN
  - payment term days (a whole number, required, 30 by default)
  - an invoice footer

Clients
  Clients have:
  - a name (required)
  - an email (required)
  - address
  - a VAT number
  Each client lists its invoices.

Invoices
  Invoices have:
  - a number (required, unique)
  - a client (a client, required)
  - issued on (a date, required, today by default)
  - due on (a date, required)
  - status (draft, sent, paid or overdue, draft by default)
  - a total (an amount)
  Each invoice lists its invoice lines.

Invoice Lines
  Invoice Lines have:
  - an invoice (an invoice, required)
  - a description (required)
  - a quantity (a number, required, 1 by default)
  - a unit price (an amount, required)
  - an amount (an amount)

Sign-in and access
  People sign in with Google.
  Everyone sees and changes only their own records.
  Roles:
  - admin
  - member (A freelancer using the app)
  New users get the member role.
  Open to anyone without signing in: the home page.
Pictures from the Smithable image library: samples/1.webp, samples/2.webp, samples/3.webp, samples/4.webp, samples/5.webp, samples/6.webp, hero.webp.
Generated 90 files (90 changed, 0 removed).
No config path provided, using default 'drizzle.config.ts'
Reading config file '/tmp/smithable-bench-m12-ySDwIe/app-3/drizzle.config.ts'
8 tables
account 13 columns 1 indexes 1 fks
business_profiles 9 columns 0 indexes 1 fks
clients 8 columns 0 indexes 1 fks
invoice_lines 9 columns 0 indexes 2 fks
invoices 10 columns 1 indexes 2 fks
session 8 columns 2 indexes 1 fks
user 8 columns 1 indexes 0 fks
verification 6 columns 1 indexes 0 fks

[✓] Your SQL migration file ➜ drizzle/0000_sturdy_purifiers.sql 🚀

Created /tmp/smithable-bench-m12-ySDwIe/app-3. Start it with:

  cd /tmp/smithable-bench-m12-ySDwIe/app-3
  smithable run
```

### 4. A tool library where neighbors lend each other tools.

```text
Tool Library
  A tool library where neighbors lend each other tools.

Pages
  - Tools (lists tools; search by name or description; filter by category, condition or available; sort by name or date added; records can be saved as favorites; contact the owner by mail)
  - Home (a landing page: hero, tools where available is yes and footer)
  - My tools (lists tools; only the viewer's own records)

Tools
  Tools have:
  - a name (required)
  - a description (required)
  - a category (garden, power, hand, measuring or other, garden by default)
  - a condition (like new, good or worn, like new by default)
  - an available (yes or no, true by default)

Sign-in and access
  People sign in with Google.
  Everyone sees and changes only their own records.
  Roles:
  - admin (Keeps the tool library organized)
  - member (Lends and borrows tools)
  New users get the member role.
  Open to anyone without signing in: the home page.
Pictures from the Smithable image library: samples/1.webp, samples/2.webp, samples/3.webp, samples/4.webp, samples/5.webp, samples/6.webp, hero.webp.
Generated 77 files (77 changed, 0 removed).
No config path provided, using default 'drizzle.config.ts'
Reading config file '/tmp/smithable-bench-m12-ySDwIe/app-4/drizzle.config.ts'
6 tables
account 13 columns 1 indexes 1 fks
session 8 columns 2 indexes 1 fks
tools 9 columns 0 indexes 1 fks
tools_favorites 4 columns 1 indexes 2 fks
user 8 columns 1 indexes 0 fks
verification 6 columns 1 indexes 0 fks

[✓] Your SQL migration file ➜ drizzle/0000_numerous_exodus.sql 🚀

Created /tmp/smithable-bench-m12-ySDwIe/app-4. Start it with:

  cd /tmp/smithable-bench-m12-ySDwIe/app-4
  smithable run
```

### 5. An inventory app for a small bakery: ingredients, suppliers and stock levels.

```text
Bakery Inventory
  An inventory app for a small bakery to manage ingredients, suppliers and stock levels.

Pages
  - Ingredients (lists ingredients; search by name or description)
  - Suppliers (lists suppliers; search by name, contact person or email)
  - Stock (lists stock levels; search by ingredient; filter by ingredient or supplier)
  - Team (who has access: invite people, change roles, remove users)

Ingredients
  Ingredients have:
  - a name (required)
  - a description
  - a category (dry, wet or frozen, dry by default)
  - a unit (required)
  - a minimum stock level (a whole number, 0 by default)
  Only baker users and admins can delete ingredients.

Suppliers
  Suppliers have:
  - a name (required)
  - a contact person
  - an email
  - a phone
  - address
  Only baker users and admins can delete suppliers.

Stock Levels
  Stock Levels have:
  - an ingredient (an ingredient, required)
  - a supplier (a supplier)
  - a quantity (a number, required)
  - a last restocked (a date)
  - an expiry date
  Only baker users and admins can delete stock levels.

Sign-in and access
  People sign in with Google.
  Everyone who signs in sees all records, and changes and deletes the ones they own.
  Roles:
  - admin
  - baker (Manages ingredients and stock levels)
  New users get the baker role.
Pictures from the Smithable image library: samples/1.webp, samples/2.webp, samples/3.webp, samples/4.webp, samples/5.webp, samples/6.webp.
Generated 85 files (85 changed, 0 removed).
No config path provided, using default 'drizzle.config.ts'
Reading config file '/tmp/smithable-bench-m12-ySDwIe/app-5/drizzle.config.ts'
8 tables
account 13 columns 1 indexes 1 fks
ingredients 9 columns 0 indexes 1 fks
invitation 7 columns 2 indexes 1 fks
session 8 columns 2 indexes 1 fks
stocks 9 columns 0 indexes 3 fks
suppliers 9 columns 0 indexes 1 fks
user 8 columns 1 indexes 0 fks
verification 6 columns 1 indexes 0 fks

[✓] Your SQL migration file ➜ drizzle/0000_magenta_thunderbolt.sql 🚀

Created /tmp/smithable-bench-m12-ySDwIe/app-5. Start it with:

  cd /tmp/smithable-bench-m12-ySDwIe/app-5
  smithable run
```

### 6. A job board for a local union, with job posts and applications.

```text
Union Job Board
  A job board for a local union to post jobs and receive applications.

Pages
  - Jobs (lists jobs; search by title, description, company or location; sort by posted at or salary)
  - Applications (lists applications; search by name or email; filter by job or status; only for employer users and admins)
  - Home (a landing page: hero, jobs where status is open and footer)
  - Team (who has access: invite people, change roles, remove users)

Jobs
  Jobs have:
  - a title (required)
  - a description (required)
  - a company (required)
  - a location
  - a salary (an amount)
  - a type (full time, part time, contract or temporary, full time by default)
  - status (open, filled or expired, open by default)
  - posted at (a date, required)
  Only employer users and admins can add jobs.
  Only employer users, the owner and admins can delete jobs.

Applications
  Applications have:
  - a job (a job, required)
  - a name (required)
  - an email (required)
  - a phone
  - a resume
  - a cover letter
  - status (submitted, reviewed, interviewed, hired or rejected, submitted by default)
  Only member users and admins can add applications.
  Only employer users, the owner and admins can see applications.

Sign-in and access
  People sign in with Google.
  Everyone who signs in sees all records, and changes and deletes the ones they own.
  Roles:
  - admin
  - employer (Posts job openings)
  - member (Applies to jobs)
  New users get the member role.
  Open to anyone without signing in: the home page, the jobs page and reading jobs where status is open.
Pictures from the Smithable image library: samples/1.webp, samples/2.webp, samples/3.webp, samples/4.webp, samples/5.webp, samples/6.webp, hero.webp.
Generated 82 files (82 changed, 0 removed).
No config path provided, using default 'drizzle.config.ts'
Reading config file '/tmp/smithable-bench-m12-ySDwIe/app-6/drizzle.config.ts'
7 tables
account 13 columns 1 indexes 1 fks
applications 11 columns 0 indexes 2 fks
invitation 7 columns 2 indexes 1 fks
jobs 12 columns 0 indexes 1 fks
session 8 columns 2 indexes 1 fks
user 8 columns 1 indexes 0 fks
verification 6 columns 1 indexes 0 fks

[✓] Your SQL migration file ➜ drizzle/0000_magenta_sumo.sql 🚀

Created /tmp/smithable-bench-m12-ySDwIe/app-6. Start it with:

  cd /tmp/smithable-bench-m12-ySDwIe/app-6
  smithable run
```

### 7. A football club's site: teams, players, matches and results.

```text
Football Club
  A football club's site with teams, players, matches and results.

Pages
  - Home (a landing page: hero, equipos and footer)
  - Equipos (lists equipos)
  - Jugadores (lists jugadores)
  - Partidos (lists partidos)
  - Resultados (lists resultados)

Equipos
  Equipos have:
  - a nombre (required)
  - a descripción
  - a deporte (fútbol, fútbol sala or fútbol playa, fútbol by default)
  - a fundado (a date)

Jugadores
  Jugadores have:
  - a nombre (required)
  - a posición (portero, defensa, centrocampista or delantero, portero by default)
  - an equipo (an equipo, required)
  - a número (a whole number)
  - a fecha de nacimiento (a date)

Partidos
  Partidos have:
  - an equipo local (an equipo, required)
  - an equipo visitante (an equipo, required)
  - a fecha y hora (a date and time, required)
  - an ubicación
  - an estado (programado, jugado or cancelado, programado by default)

Resultados
  Resultados have:
  - a partido (a partido, required)
  - a goles local (a whole number, required)
  - a goles visitante (a whole number, required)
  - goleadores

Sign-in and access
  People sign in with Google.
  Everyone sees and changes only their own records.
  Roles:
  - admin
  - member
  New users get the member role.
  Open to anyone without signing in: the home page, the teams page, the players page, the matches page, the results page, reading teams, reading players, reading matches and reading results.
Pictures from the Smithable image library: samples/1.webp, samples/2.webp, samples/3.webp, samples/4.webp, samples/5.webp, samples/6.webp, hero.webp.
Generated 86 files (86 changed, 0 removed).
No config path provided, using default 'drizzle.config.ts'
Reading config file '/tmp/smithable-bench-m12-ySDwIe/app-7/drizzle.config.ts'
8 tables
account 13 columns 1 indexes 1 fks
matches 9 columns 0 indexes 3 fks
players 9 columns 0 indexes 2 fks
results 8 columns 0 indexes 2 fks
session 8 columns 2 indexes 1 fks
teams 8 columns 0 indexes 1 fks
user 8 columns 1 indexes 0 fks
verification 6 columns 1 indexes 0 fks

[✓] Your SQL migration file ➜ drizzle/0000_uneven_maximus.sql 🚀

Created /tmp/smithable-bench-m12-ySDwIe/app-7. Start it with:

  cd /tmp/smithable-bench-m12-ySDwIe/app-7
  smithable run
```

### 8. Event registration for a conference: talks, speakers and attendees.

```text
Conference Registration
  Event registration system for conference talks, speakers and attendees.

Pages
  - Home (a landing page: hero, talks, speakers, contact and footer)
  - Talks (lists talks; only for organizer users and admins; visitors see talks on the Home page)
  - Speakers (lists speakers; only for organizer users and admins; visitors see speakers on the Home page)
  - Attendees (lists attendees; only for organizer users and admins)
  - Team (who has access: invite people, change roles, remove users)
  - Admin (every kind of record, to find, open, change and delete)
  - Registrations (lists registrations; only the viewer's own records; only for organizer users, attendee users and admins)

Talks
  Talks have:
  - a title (required)
  - a description
  - starts at (a date and time, required)
  - ends at (a date and time, required)
  - a room
  - a capacity (a whole number, required, 100 by default)
  - a speaker (a speaker, required)
  Each talk lists its registrations.
  Only organizer users and admins can add talks.
  Only organizer users and admins can delete talks.

Speakers
  Speakers have:
  - a name (required)
  - a bio
  - an email (required)
  - a photo (picture)
  Only organizer users and admins can add speakers.
  Only organizer users and admins can delete speakers.

Attendees
  Attendees have:
  - a name (required)
  - an email (required, unique)
  - a company
  - dietary restrictions
  Only organizer users, attendee users and admins can add attendees.
  Only organizer users and admins can delete attendees.

Registrations
  Registrations have:
  - a talk (a talk, required)
  - an attendee (an attendee, required)
  - registered at (a date and time, required)
  Only organizer users, attendee users and admins can add registrations.
  Only organizer users, the owner and admins can delete registrations.
  At most the talk's capacity registrations per talk.

Sign-in and access
  People sign in with Google.
  Everyone who signs in sees all records, and changes and deletes the ones they own.
  Roles:
  - admin
  - organizer (Manages conference talks, speakers, and registrations)
  - attendee (A conference participant who registers for talks)
  New users get the attendee role.
  Open to anyone without signing in: the home page, reading talks and reading speakers.
Pictures from the Smithable image library: samples/1.webp, samples/2.webp, samples/3.webp, samples/4.webp, samples/5.webp, samples/6.webp, hero.webp.
Generated 110 files (110 changed, 0 removed).
No config path provided, using default 'drizzle.config.ts'
Reading config file '/tmp/smithable-bench-m12-ySDwIe/app-8/drizzle.config.ts'
9 tables
account 13 columns 1 indexes 1 fks
attendees 8 columns 1 indexes 1 fks
invitation 7 columns 2 indexes 1 fks
registrations 7 columns 0 indexes 3 fks
session 8 columns 2 indexes 1 fks
speakers 8 columns 0 indexes 1 fks
talks 11 columns 0 indexes 2 fks
user 8 columns 1 indexes 0 fks
verification 6 columns 1 indexes 0 fks

[✓] Your SQL migration file ➜ drizzle/0000_magical_deathbird.sql 🚀

Created /tmp/smithable-bench-m12-ySDwIe/app-8. Start it with:

  cd /tmp/smithable-bench-m12-ySDwIe/app-8
  smithable run
/tmp/smithable-bench-m12-ySDwIe/app-8/smithable.yml:43:7  warning  Registration has a capacity per talk, but "talk" is not unique: one person can take several places.
    hint: Write "talk: Talk! unique" for one registration per person and talk (unique per owner with private access).
/tmp/smithable-bench-m12-ySDwIe/app-8/smithable.auth.yml:14:16  warning  Anyone on the internet can read Speaker, including personal data in email.
```

### 9. A help desk for an IT team: tickets, priorities and who handles them.

```text
IT Help Desk
  A help desk for an IT team to manage support tickets, priorities and assignments.

Pages
  - Tickets (lists tickets; search by title or description; sort by priority, status or date added)
  - Team (who has access: invite people, change roles, remove users)

Tickets
  Tickets have:
  - a title (required)
  - a description
  - a priority (low, medium, high or critical, low by default)
  - status (open, in progress, resolved or closed, open by default)
  Each ticket can have an assignee (a user).
  Only admins can delete tickets.

Sign-in and access
  People sign in with Google.
  Everyone who signs in sees all records, and changes and deletes the ones they own.
  Roles:
  - admin
  - itSupport (Handles IT support tickets)
  New users get the itSupport role.
Pictures from the Smithable image library: samples/1.webp, samples/2.webp, samples/3.webp, samples/4.webp, samples/5.webp, samples/6.webp.
Generated 76 files (76 changed, 0 removed).
No config path provided, using default 'drizzle.config.ts'
Reading config file '/tmp/smithable-bench-m12-ySDwIe/app-9/drizzle.config.ts'
6 tables
account 13 columns 1 indexes 1 fks
invitation 7 columns 2 indexes 1 fks
session 8 columns 2 indexes 1 fks
tickets 9 columns 0 indexes 2 fks
user 8 columns 1 indexes 0 fks
verification 6 columns 1 indexes 0 fks

[✓] Your SQL migration file ➜ drizzle/0000_motionless_odin.sql 🚀

Created /tmp/smithable-bench-m12-ySDwIe/app-9. Start it with:

  cd /tmp/smithable-bench-m12-ySDwIe/app-9
  smithable run
```

### 10. A recipe collection for a family, with ingredients and shopping lists.

```text
Family Recipes
  A recipe collection for a family, with ingredients and shopping lists.

Pages
  - Recepten (lists recepten; search by naam, beschrijving or categorie; filter by categorie or moeilijkheidsgraad)
  - Boodschappenlijsten (lists boodschappenlijsten; search by naam; filter by status or datum)
  - Team (who has access: invite people, change roles, remove users)

Recepten
  Recepten have:
  - a naam (required)
  - a beschrijving
  - porties (a whole number, 4 by default)
  - a voorbereidingstijd (min) (a whole number)
  - a kooktijd (min) (a whole number)
  - instructies (required)
  - a categorie (ontbijt, lunch, diner, toetje or tussendoortje, ontbijt by default)
  - a moeilijkheidsgraad (makkelijk, gemiddeld or moeilijk, makkelijk by default)
  - an afbeelding (a web address)
  Only admins can delete recepten.

Ingrediënten
  Ingrediënten have:
  - a naam (required)
  - a hoeveelheid
  - an eenheid
  - a recipe (a recept, required)

Boodschappenlijsten
  Boodschappenlijsten have:
  - a naam (required)
  - a datum (a date, required, today by default)
  - status (in afwachting or voltooid, in afwachting by default)
  Each boodschappenlijst lists its boodschappenitems.
  Only admins can delete boodschappenlijsten.

Boodschappenitems
  Boodschappenitems have:
  - a naam (required)
  - a hoeveelheid
  - an eenheid
  - an aangekocht (yes or no, false by default)
  - a shopping list (a boodschappenlijst, required)
  Only admins can delete boodschappenitems.

Sign-in and access
  People sign in with Google.
  Everyone who signs in sees all records, and changes and deletes the ones they own.
  Roles:
  - admin
  - member (Family member who can view and add recipes)
  New users get the member role.
Pictures from the Smithable image library: samples/1.webp, samples/2.webp, samples/3.webp, samples/4.webp, samples/5.webp, samples/6.webp.
Generated 85 files (85 changed, 0 removed).
No config path provided, using default 'drizzle.config.ts'
Reading config file '/tmp/smithable-bench-m12-ySDwIe/app-10/drizzle.config.ts'
9 tables
account 13 columns 1 indexes 1 fks
ingredients 8 columns 0 indexes 2 fks
invitation 7 columns 2 indexes 1 fks
recipes 13 columns 0 indexes 1 fks
session 8 columns 2 indexes 1 fks
shopping_items 9 columns 0 indexes 2 fks
shopping_lists 7 columns 0 indexes 1 fks
user 8 columns 1 indexes 0 fks
verification 6 columns 1 indexes 0 fks

[✓] Your SQL migration file ➜ drizzle/0000_greedy_jimmy_woo.sql 🚀

Created /tmp/smithable-bench-m12-ySDwIe/app-10. Start it with:

  cd /tmp/smithable-bench-m12-ySDwIe/app-10
  smithable run
```

### 11. A status page for our API, with incidents and planned maintenance.

```text
API Status
  Live status of our API services, incidents, and planned maintenance.

Pages
  - API Status (a landing page: hero, components, incidents where status is investigating or identified or monitoring, incidents where status is resolved, maintenances and footer)
  - Incidents (lists incidents)
  - Updates (lists incident updates)
  - Components (lists components; only for admins; visitors see components on the API Status page)
  - Maintenance (lists maintenances)
  - Overview (a dashboard: open, per month and latest)
  - Team (who has access: invite people, change roles, remove users)

Components
  Components have:
  - a name (required)
  - status (operational, degraded, down or maintenance, operational by default)
  - a description
  Each component lists its incidents.

Incidents
  Incidents have:
  - a title (required)
  - status (investigating, identified, monitoring or resolved, investigating by default)
  - a component (a component)
  - detected at (a date and time, required)
  - resolved at (a date and time)
  - a summary (formatted text)
  Each incident lists its incident updates.

Incident Updates
  Incident Updates have:
  - an incident (an incident, required)
  - a date and time (at, required)
  - status (investigating, identified, monitoring or resolved, investigating by default)
  - a message (required)

Maintenances
  Maintenances have:
  - a title (required)
  - a component (a component)
  - starts at (a date and time, required)
  - ends at (a date and time, required)
  - a description

Sign-in and access
  People sign in with Google.
  Everyone who signs in sees all records, and changes and deletes the ones they own.
  Roles:
  - admin (Runs the status page and the team)
  - staff (Writes incidents and their updates)
  New users get the staff role.
  Open to anyone without signing in: the home page, reading components, reading incidents where status is investigating or identified or monitoring or resolved and reading maintenances.
Pictures from the Smithable image library: samples/1.webp, samples/2.webp, samples/3.webp, samples/4.webp, samples/5.webp, samples/6.webp, hero.webp.
Generated 95 files (95 changed, 0 removed).
No config path provided, using default 'drizzle.config.ts'
Reading config file '/tmp/smithable-bench-m12-ySDwIe/app-11/drizzle.config.ts'
9 tables
account 13 columns 1 indexes 1 fks
components 7 columns 0 indexes 1 fks
incident_updates 8 columns 0 indexes 2 fks
incidents 10 columns 0 indexes 2 fks
invitation 7 columns 2 indexes 1 fks
maintenances 9 columns 0 indexes 2 fks
session 8 columns 2 indexes 1 fks
user 8 columns 1 indexes 0 fks
verification 6 columns 1 indexes 0 fks

[✓] Your SQL migration file ➜ drizzle/0000_safe_nighthawk.sql 🚀

Created /tmp/smithable-bench-m12-ySDwIe/app-11. Start it with:

  cd /tmp/smithable-bench-m12-ySDwIe/app-11
  smithable run
```

### 12. A public uptime page for a web shop: which services work, outages and their updates.

```text
Web Shop Status
  A public uptime page showing which services work, outages and their updates.

Pages
  - Home (a landing page: hero, components, incidents where status is investigating or identified or monitoring and footer)
  - Incidents (lists incidents; only for staff users and admins; visitors see incidents on the Home page)
  - Updates (lists incident updates; only for staff users and admins)
  - Components (lists components; only for admins; visitors see components on the Home page)
  - Maintenance (lists maintenances; only for staff users and admins)
  - Team (who has access: invite people, change roles, remove users)
  - Admin (every kind of record, to find, open, change and delete)

Components
  Components have:
  - a name (required)
  - status (operational, degraded, down or maintenance, operational by default)
  - a description
  Each component lists its incidents.

Incidents
  Incidents have:
  - a title (required)
  - status (investigating, identified, monitoring or resolved, investigating by default)
  - a component (a component)
  - detected at (a date and time, required)
  - resolved at (a date and time)
  - a summary (formatted text)
  Each incident lists its incident updates.

Incident updates
  Incident updates have:
  - an incident (an incident, required)
  - a date and time (at, required)
  - status (investigating, identified, monitoring or resolved, investigating by default)
  - a message (required)

Maintenances
  Maintenances have:
  - a title (required)
  - a component (a component)
  - starts at (a date and time, required)
  - ends at (a date and time, required)
  - a description

Identified
  The cause is found; the incident moves to identified.
  Only staff users and admins can use it.

Monitoring
  A fix is out; the incident is watched before it is closed.
  Only staff users and admins can use it.

Resolve
  The incident is over.
  Only staff users and admins can use it.

Sign-in and access
  People sign in with Google.
  Everyone who signs in sees all records, and changes and deletes the ones they own.
  Roles:
  - admin (Runs the status page and the team)
  - staff (Writes incidents and their updates)
  New users get the staff role.
  Open to anyone without signing in: the home page, reading components, reading incidents where status is investigating or identified or monitoring or resolved, reading incident updates and reading maintenances.
Pictures from the Smithable image library: samples/1.webp, samples/2.webp, samples/3.webp, samples/4.webp, samples/5.webp, samples/6.webp, hero.webp.
Generated 111 files (111 changed, 0 removed).
No config path provided, using default 'drizzle.config.ts'
Reading config file '/tmp/smithable-bench-m12-ySDwIe/app-12/drizzle.config.ts'
9 tables
account 13 columns 1 indexes 1 fks
components 7 columns 0 indexes 1 fks
incident_updates 8 columns 0 indexes 2 fks
incidents 10 columns 0 indexes 2 fks
invitation 7 columns 2 indexes 1 fks
maintenances 9 columns 0 indexes 2 fks
session 8 columns 2 indexes 1 fks
user 8 columns 1 indexes 0 fks
verification 6 columns 1 indexes 0 fks

[✓] Your SQL migration file ➜ drizzle/0000_warm_psylocke.sql 🚀

Created /tmp/smithable-bench-m12-ySDwIe/app-12. Start it with:

  cd /tmp/smithable-bench-m12-ySDwIe/app-12
  smithable run
```
