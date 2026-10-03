# M12 first builds: mistral-medium-latest (2026-10-03)

The app descriptions, each started with `smithable new --describe` (the closest starter, adapted by the model; errors go back up to twice). Totals: 12 / 12 created, 12 type-check, 143,720 tokens, €0.0769.

| Description | Starter | Created | Type-checks | Tokens | Cost | Time |
|---|---|---|---|---|---|---|
| A booking site for a yoga studio, with classes, teachers and online booking. | booking | yes | yes | 15,589 | €0.0083 | 23 s |
| A CRM for a small sales team: companies, contacts, deals and follow-ups. | crm | yes | yes | 8,008 | €0.0049 | 19 s |
| Invoicing for freelancers, with clients, invoices and payments. | invoicing | yes | yes | 15,583 | €0.0086 | 25 s |
| A tool library where neighbors lend each other tools. | records | yes | yes | 14,421 | €0.0075 | 20 s |
| An inventory app for a small bakery: ingredients, suppliers and stock levels. | booking | yes | yes | 7,682 | €0.0037 | 16 s |
| A job board for a local union, with job posts and applications. | marketplace | yes | yes | 7,449 | €0.0043 | 17 s |
| A football club's site: teams, players, matches and results. | records | yes | yes | 7,293 | €0.0042 | 18 s |
| Event registration for a conference: talks, speakers and attendees. | records | yes | yes | 7,468 | €0.0045 | 19 s |
| A help desk for an IT team: tickets, priorities and who handles them. | invoicing | yes | yes | 7,606 | €0.0042 | 15 s |
| A recipe collection for a family, with ingredients and shopping lists. | records | yes | yes | 7,097 | €0.0038 | 18 s |
| A status page for our API, with incidents and planned maintenance. | status | yes | yes | 23,490 | €0.0123 | 30 s |
| A public uptime page for a web shop: which services work, outages and their updates. | status | yes | yes | 22,034 | €0.0106 | 27 s |

## What changed since the run before (main with #143, #144, #151, #152)

- **Created and type-checks:** 12 / 12 and 12 / 12. The run before was 9 / 12 created, 9 type-check.
  - The three that failed to be created (invoicing, bakery, uptime page) had hit one engine bug: an operation's long text was folded across lines into invalid YAML. #151 fixes that, and texts with line breaks too.
  - The three earlier type-check failures (yoga, football, help desk) were the generator bugs fixed in #144.
- **The two status apps** (from their kept files):

  | | defaultAccess | roles (defaultRole) | pages with `access` | models | actions |
  |---|---|---|---|---|---|
  | 11 API Status | shared | admin, staff (staff) | incidents, updates, maintenance, overview: admin and staff; components and team: admin | Component, Incident, IncidentUpdate, Maintenance | none |
  | 12 Web Shop Status | shared | admin, staff (staff) | components: admin | Component, Incident, IncidentUpdate, Maintenance | none |

  Both are now shared with the starter's staff role. App 12's page access is exactly the starter's. App 11 restricts more pages than the starter, though to its own roles and not to admins only. **Neither keeps the starter's status actions** (identified, monitoring, resolve), which the run before (app 11) had.
- **Reuse of the starter's name or texts:**
  - No app uses its starter's name. Yoga is now "Yoga Studio Booking", where it was "Stillwater Yoga" before.
  - No landing or content text is reused.
  - Only role descriptions from the starter's auth file, which #152 now shows to the model: yoga ("Studio staff. Manage the schedule, classes and teachers.", "A student who books classes.") and both status apps ("Runs the status page and the team.", "Writes incidents and their updates."). They fit those apps.
  - Every other match is structure, as intended: field types, choice lists like `draft | sent | paid | overdue`, `= TODAY()`.

Each created app's four spec files are in [m12-first-builds-mistral-medium-latest/](m12-first-builds-mistral-medium-latest/), one folder per description (app-1 …).

## Summaries, for review

### 1. A booking site for a yoga studio, with classes, teachers and online booking.

```text
Yoga Studio Booking
  Online booking system for yoga classes with teachers and schedules.

Pages
  - Home (a landing page: hero, footer, classes and call to action)
  - Class types (lists class types; only for admins)
  - Instructors (lists instructors; only for admins)
  - Sessions (lists sessions; only for admins)
  - My bookings (lists bookings)
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
  - a bio (formatted text)
  - a portrait (picture)
  Only admins can add instructors.

Sessions
  Sessions have:
  - a class type (a class type, required)
  - an instructor (an instructor, required)
  - starts at (a date and time, required)
  - a capacity (a whole number, required, 12 by default)
  - a places left (a whole number, the capacity minus the number of its bookings by default)
  Each session lists its bookings.
  Only admins can add sessions.

Bookings
  Bookings have:
  - a session (a session, required)
  Each booking can have a member (a user).
  At most the session's capacity bookings per session.

Sign-in and access
  People sign in with Google.
  Everyone sees and changes only their own records.
  Roles:
  - admin (Studio staff. Manage the schedule, classes and teachers)
  - member (A student who books classes)
  New users get the member role.
  Open to anyone without signing in: the home page, the schedule page, reading class types, reading instructors and reading sessions.
Pictures from the Smithable image library: samples/1.webp, samples/2.webp, samples/3.webp, samples/4.webp, samples/5.webp, samples/6.webp, hero.webp.
Generated 99 files (99 changed, 0 removed).
No config path provided, using default 'drizzle.config.ts'
Reading config file '/tmp/smithable-bench-m12-iyPPE4/app-1/drizzle.config.ts'
8 tables
account 13 columns 1 indexes 1 fks
bookings 6 columns 0 indexes 3 fks
class_types 8 columns 0 indexes 1 fks
instructors 7 columns 0 indexes 1 fks
session 8 columns 2 indexes 1 fks
sessions 9 columns 0 indexes 3 fks
user 8 columns 1 indexes 0 fks
verification 6 columns 1 indexes 0 fks

[✓] Your SQL migration file ➜ drizzle/0000_fuzzy_colonel_america.sql 🚀

Created /tmp/smithable-bench-m12-iyPPE4/app-1. Start it with:

  cd /tmp/smithable-bench-m12-iyPPE4/app-1
  smithable run
/tmp/smithable-bench-m12-iyPPE4/app-1/smithable.yml:36:7  warning  Booking has a capacity per session, but "session" is not unique: one person can take several places.
    hint: Write "session: Session! unique" for one booking per person and session (unique per owner with private access).
/tmp/smithable-bench-m12-iyPPE4/app-1/smithable.yml:61:14  warning  Page "schedule" is a calendar, but the app has no time zone: records are placed in UTC.
    hint: Set "timezone" under "app", e.g. "Europe/Mariehamn".
```

### 2. A CRM for a small sales team: companies, contacts, deals and follow-ups.

```text
Sales CRM
  A lightweight CRM for a small sales team to manage companies, contacts, deals, and follow-ups.

Pages
  - Companies (lists companies; search by name or email)
  - Contacts (lists contacts; search by first name, last name or email)
  - Deals (lists deals; search by name or company; filter by stage, company or contact; sort by value, close date or stage)
  - Follow ups (lists follow ups; search by title, company or contact; filter by status, due date, company, contact or deal; sort by due date or status)
  - Team (who has access: invite people, change roles, remove users)

Companies
  Companies have:
  - a name (required)
  - an email
  - a phone
  - an industry
  - notes
  Each company can have an account manager (a user).
  Only admins can delete companies.

Contacts
  Contacts have:
  - a first name (required)
  - a last name (required)
  - an email
  - a phone
  - a company (a company, required)
  - a role (decision maker, influencer or user, decision maker by default)
  - notes
  Only admins can delete contacts.

Deals
  Deals have:
  - a name (required)
  - a company (a company, required)
  - a contact (a contact)
  - a value (an amount, required)
  - a stage (prospecting, qualified, proposal, negotiation, closed won or closed lost, prospecting by default)
  - a close date
  - notes
  Only admins can delete deals.

Follow ups
  Follow ups have:
  - a title (required)
  - a company (a company, required)
  - a contact (a contact)
  - a deal (a deal)
  - a due date (required)
  - status (pending, completed or canceled, pending by default)
  - notes
  Only admins can delete follow ups.

Sign-in and access
  People sign in with Google.
  Everyone who signs in sees all records, and changes and deletes the ones they own.
  Roles:
  - admin
  - sales (Works with companies, contacts, deals, and follow-ups)
  New users get the sales role.
Pictures from the Smithable image library: samples/1.webp, samples/2.webp, samples/3.webp, samples/4.webp, samples/5.webp, samples/6.webp.
Generated 91 files (91 changed, 0 removed).
No config path provided, using default 'drizzle.config.ts'
Reading config file '/tmp/smithable-bench-m12-iyPPE4/app-2/drizzle.config.ts'
9 tables
account 13 columns 1 indexes 1 fks
companies 10 columns 0 indexes 2 fks
contacts 11 columns 0 indexes 2 fks
deals 11 columns 0 indexes 3 fks
follow_ups 11 columns 0 indexes 4 fks
invitation 7 columns 2 indexes 1 fks
session 8 columns 2 indexes 1 fks
user 8 columns 1 indexes 0 fks
verification 6 columns 1 indexes 0 fks

[✓] Your SQL migration file ➜ drizzle/0000_unique_dorian_gray.sql 🚀

Created /tmp/smithable-bench-m12-iyPPE4/app-2. Start it with:

  cd /tmp/smithable-bench-m12-iyPPE4/app-2
  smithable run
/tmp/smithable-bench-m12-iyPPE4/app-2/smithable.auth.yml:4:16  warning  With shared access and no allowedDomains, anyone with an account at the sign-in provider can sign up and read all records.
    hint: Restrict sign-in with "allowedDomains" or "selfSignUp: false" under "signIn", or use "defaultAccess: private".
```

### 3. Invoicing for freelancers, with clients, invoices and payments.

```text
Freelance Invoicing
  Invoicing for freelancers, with clients, invoices and payments.

Pages
  - Home (a landing page: hero, footer, features and call to action)
  - Overview (lists invoices)
  - Invoices (lists invoices; search by number; filter by status or client)
  - Clients (lists clients; search by name or email)
  - Settings (lists business profiles)
  - Payments (lists payments; filter by invoice or method)

Business profiles
  Business profiles have:
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

Invoice lines
  Invoice lines have:
  - an invoice (an invoice, required)
  - a description (required)
  - a quantity (a number, required, 1 by default)
  - a unit price (an amount, required)
  - an amount (an amount)

Payments
  Payments have:
  - an invoice (an invoice, required)
  - an amount (an amount, required)
  - paid on (a date, required, today by default)
  - a method (bank transfer, credit card or cash, bank transfer by default)

Sign-in and access
  People sign in with Google.
  Everyone sees and changes only their own records.
  Roles:
  - admin
  - member (A freelancer using the app)
  New users get the member role.
  Open to anyone without signing in: the home page.
Pictures from the Smithable image library: samples/1.webp, samples/2.webp, samples/3.webp, samples/4.webp, samples/5.webp, samples/6.webp, hero.webp.
Generated 95 files (95 changed, 0 removed).
No config path provided, using default 'drizzle.config.ts'
Reading config file '/tmp/smithable-bench-m12-iyPPE4/app-3/drizzle.config.ts'
9 tables
account 13 columns 1 indexes 1 fks
business_profiles 9 columns 0 indexes 1 fks
clients 8 columns 0 indexes 1 fks
invoice_lines 9 columns 0 indexes 2 fks
invoices 10 columns 1 indexes 2 fks
payments 8 columns 0 indexes 2 fks
session 8 columns 2 indexes 1 fks
user 8 columns 1 indexes 0 fks
verification 6 columns 1 indexes 0 fks

[✓] Your SQL migration file ➜ drizzle/0000_lyrical_king_cobra.sql 🚀

Created /tmp/smithable-bench-m12-iyPPE4/app-3. Start it with:

  cd /tmp/smithable-bench-m12-iyPPE4/app-3
  smithable run
```

### 4. A tool library where neighbors lend each other tools.

```text
Tool Library
  A place where neighbors lend each other tools.

Pages
  - Home (a landing page: hero, footer and tools)
  - Tools (lists tools; search by name, description or category; sort by name, category or condition)

Tools
  Tools have:
  - a name (required)
  - a description
  - a category
  - a condition (new, good or worn, new by default)
  - an available (yes or no, true by default)

Sign-in and access
  People sign in with Google.
  Everyone who signs in sees all records, and changes and deletes the ones they own.
  Roles:
  - admin
  - member (Can borrow and lend tools)
  New users get the member role.
  Open to anyone without signing in: the home page and reading tools where available is yes.
Pictures from the Smithable image library: samples/1.webp, samples/2.webp, samples/3.webp, samples/4.webp, samples/5.webp, samples/6.webp, hero.webp.
Generated 73 files (73 changed, 0 removed).
No config path provided, using default 'drizzle.config.ts'
Reading config file '/tmp/smithable-bench-m12-iyPPE4/app-4/drizzle.config.ts'
5 tables
account 13 columns 1 indexes 1 fks
session 8 columns 2 indexes 1 fks
tools 9 columns 0 indexes 1 fks
user 8 columns 1 indexes 0 fks
verification 6 columns 1 indexes 0 fks

[✓] Your SQL migration file ➜ drizzle/0000_small_chimera.sql 🚀

Created /tmp/smithable-bench-m12-iyPPE4/app-4. Start it with:

  cd /tmp/smithable-bench-m12-iyPPE4/app-4
  smithable run
/tmp/smithable-bench-m12-iyPPE4/app-4/smithable.auth.yml:4:16  warning  With shared access and no allowedDomains, anyone with an account at the sign-in provider can sign up and read all records.
    hint: Restrict sign-in with "allowedDomains" or "selfSignUp: false" under "signIn", or use "defaultAccess: private".
```

### 5. An inventory app for a small bakery: ingredients, suppliers and stock levels.

```text
Bakery Inventory
  Track ingredients, suppliers and stock levels for a small bakery.

Pages
  - Ingredients (lists ingredients)
  - Suppliers (lists suppliers)
  - Stock (lists stocks; search by ingredient; filter by ingredient or supplier)

Ingredients
  Ingredients have:
  - a name (required)
  - a description
  - a category (dry, wet, frozen or fresh, dry by default)
  - a unit (required, grams by default)
  - a min stock level (a whole number, 0 by default)

Suppliers
  Suppliers have:
  - a name (required)
  - a contact name
  - an email
  - a phone
  - address

Stocks
  Stocks have:
  - an ingredient (an ingredient, required)
  - a supplier (a supplier)
  - a quantity (a number, required)
  - a last restocked (a date)
  - an expiry date

Sign-in and access
  People sign in with Google.
  Everyone who signs in sees all records, and changes and deletes the ones they own.
  Roles:
  - admin
  - member
  New users get the member role.
Pictures from the Smithable image library: samples/1.webp, samples/2.webp, samples/3.webp, samples/4.webp, samples/5.webp, samples/6.webp.
Generated 81 files (81 changed, 0 removed).
No config path provided, using default 'drizzle.config.ts'
Reading config file '/tmp/smithable-bench-m12-iyPPE4/app-5/drizzle.config.ts'
7 tables
account 13 columns 1 indexes 1 fks
ingredients 9 columns 0 indexes 1 fks
session 8 columns 2 indexes 1 fks
stocks 9 columns 0 indexes 3 fks
suppliers 9 columns 0 indexes 1 fks
user 8 columns 1 indexes 0 fks
verification 6 columns 1 indexes 0 fks

[✓] Your SQL migration file ➜ drizzle/0000_famous_shocker.sql 🚀

Created /tmp/smithable-bench-m12-iyPPE4/app-5. Start it with:

  cd /tmp/smithable-bench-m12-iyPPE4/app-5
  smithable run
/tmp/smithable-bench-m12-iyPPE4/app-5/smithable.auth.yml:4:16  warning  With shared access and no allowedDomains, anyone with an account at the sign-in provider can sign up and read all records.
    hint: Restrict sign-in with "allowedDomains" or "selfSignUp: false" under "signIn", or use "defaultAccess: private".
```

### 6. A job board for a local union, with job posts and applications.

```text
Local Union Job Board
  A job board for local union members to post and apply for jobs.

Pages
  - Jobs (lists job posts; search by title, description, company or location; filter by type, status or salary; sort by salary or createdAt; records can be saved as favorites; contact the owner by mail)
  - My jobs (lists job posts; only the viewer's own records; only for member users and admins)
  - Applications (lists applications; only the viewer's own records; only for member users and admins)
  - Home (a landing page: hero and footer)

Job posts
  Job posts have:
  - a title (required)
  - a description (required)
  - a company (required)
  - a location
  - a salary (an amount)
  - a type (full time, part time, contract or temporary, full time by default)
  - status (open, filled or expired, open by default)
  Each job post can have a posted by (a user).
  Only the owner and admins can delete job posts.

Applications
  Applications have:
  - a job post (a job post, required)
  - a resume (required)
  - a cover letter
  - status (submitted, reviewed, interviewed, hired or rejected, submitted by default)
  Each application can have an applicant (a user).
  Only the owner and admins can delete applications.

Sign-in and access
  People sign in with Google.
  Everyone who signs in sees all records, and changes and deletes the ones they own.
  Roles:
  - admin (Manages the job board)
  - member (Posts jobs and applies for them)
  New users get the member role.
  Open to anyone without signing in: the home page, the jobs page and reading job posts where status is open.
Pictures from the Smithable image library: samples/1.webp, samples/2.webp, samples/3.webp, samples/4.webp, samples/5.webp, samples/6.webp, hero.webp.
Generated 83 files (83 changed, 0 removed).
No config path provided, using default 'drizzle.config.ts'
Reading config file '/tmp/smithable-bench-m12-iyPPE4/app-6/drizzle.config.ts'
7 tables
account 13 columns 1 indexes 1 fks
applications 9 columns 0 indexes 3 fks
job_posts 12 columns 0 indexes 2 fks
job_posts_favorites 4 columns 1 indexes 2 fks
session 8 columns 2 indexes 1 fks
user 8 columns 1 indexes 0 fks
verification 6 columns 1 indexes 0 fks

[✓] Your SQL migration file ➜ drizzle/0000_huge_squirrel_girl.sql 🚀

Created /tmp/smithable-bench-m12-iyPPE4/app-6. Start it with:

  cd /tmp/smithable-bench-m12-iyPPE4/app-6
  smithable run
/tmp/smithable-bench-m12-iyPPE4/app-6/smithable.auth.yml:4:16  warning  With shared access and no allowedDomains, anyone with an account at the sign-in provider can sign up and read all records.
    hint: Restrict sign-in with "allowedDomains" or "selfSignUp: false" under "signIn", or use "defaultAccess: private".
/tmp/smithable-bench-m12-iyPPE4/app-6/smithable.auth.yml:13:12  warning  Anyone on the internet can read JobPost, including personal data in postedBy.
```

### 7. A football club's site: teams, players, matches and results.

```text
Football Club
  A football club's site with teams, players, matches and results.

Pages
  - Home (a landing page: hero, footer, teams and matches)
  - Teams (lists teams; only for coach users, member users and admins)
  - Players (lists players; only for coach users, member users and admins)
  - Matches (lists matches; only for coach users, member users and admins)
  - Results (lists results; only for coach users, member users and admins)

Teams
  Teams have:
  - a name (required)
  - a description
  - a sport (football, futsal or beach, football by default)
  Only admins can delete teams.

Players
  Players have:
  - a name (required)
  - a position (goalkeeper, defender, midfielder or forward, goalkeeper by default)
  - a team (a team, required)
  - a number (a whole number)
  - a birth date
  Only coach users and admins can delete players.

Matches
  Matches have:
  - a home team (a team, required)
  - an away team (a team, required)
  - a date (a date and time, required)
  - a location
  - status (scheduled, played or cancelled, scheduled by default)
  Only coach users and admins can delete matches.

Results
  Results have:
  - a match (a match, required)
  - a home score (a whole number, required)
  - an away score (a whole number, required)
  - scorers
  Only coach users and admins can delete results.

Sign-in and access
  People sign in with Google.
  Everyone who signs in sees all records, and changes and deletes the ones they own.
  Roles:
  - admin (Manages the club's site)
  - coach (Manages teams and players)
  - member (Views club information)
  New users get the member role.
  Open to anyone without signing in: the home page, the teams page, the players page, the matches page, the results page, reading teams, reading players, reading matches and reading results.
Pictures from the Smithable image library: samples/1.webp, samples/2.webp, samples/3.webp, samples/4.webp, samples/5.webp, samples/6.webp, hero.webp.
Generated 86 files (86 changed, 0 removed).
No config path provided, using default 'drizzle.config.ts'
Reading config file '/tmp/smithable-bench-m12-iyPPE4/app-7/drizzle.config.ts'
8 tables
account 13 columns 1 indexes 1 fks
matches 9 columns 0 indexes 3 fks
players 9 columns 0 indexes 2 fks
results 8 columns 0 indexes 2 fks
session 8 columns 2 indexes 1 fks
teams 7 columns 0 indexes 1 fks
user 8 columns 1 indexes 0 fks
verification 6 columns 1 indexes 0 fks

[✓] Your SQL migration file ➜ drizzle/0000_thick_scarlet_spider.sql 🚀

Created /tmp/smithable-bench-m12-iyPPE4/app-7. Start it with:

  cd /tmp/smithable-bench-m12-iyPPE4/app-7
  smithable run
/tmp/smithable-bench-m12-iyPPE4/app-7/smithable.auth.yml:4:16  warning  With shared access and no allowedDomains, anyone with an account at the sign-in provider can sign up and read all records.
    hint: Restrict sign-in with "allowedDomains" or "selfSignUp: false" under "signIn", or use "defaultAccess: private".
```

### 8. Event registration for a conference: talks, speakers and attendees.

```text
Conference
  Event registration for a conference with talks, speakers and attendees.

Pages
  - Home (a landing page: hero, footer, talks and speakers)
  - Talks (lists talks; search by title or description; only for organizer users and admins)
  - Speakers (lists speakers; search by name or bio; only for organizer users and admins)
  - Attendees (lists attendees; search by name, email or company; filter by ticket type; only for organizer users and admins)

Talks
  Talks have:
  - a title (required)
  - a description
  - a start time (a date and time, required)
  - an end time (a date and time, required)
  - a room
  - status (draft, published or cancelled, draft by default)
  Only organizer users and admins can delete talks.

Speakers
  Speakers have:
  - a name (required)
  - a bio
  - an email (required)
  - a photo (a web address)
  Only organizer users and admins can delete speakers.

Attendees
  Attendees have:
  - a name (required)
  - an email (required, unique)
  - a company
  - a ticket type (standard, vip or speaker, standard by default)
  Only organizer users and admins can delete attendees.

Sign-in and access
  People sign in with Google.
  Everyone who signs in sees all records, and changes and deletes the ones they own.
  Roles:
  - admin
  - organizer (Manages the conference)
  New users get the organizer role.
  Open to anyone without signing in: the home page, reading talks and reading speakers.
Pictures from the Smithable image library: samples/1.webp, samples/2.webp, samples/3.webp, samples/4.webp, samples/5.webp, samples/6.webp, hero.webp.
Generated 83 files (83 changed, 0 removed).
No config path provided, using default 'drizzle.config.ts'
Reading config file '/tmp/smithable-bench-m12-iyPPE4/app-8/drizzle.config.ts'
7 tables
account 13 columns 1 indexes 1 fks
attendees 8 columns 1 indexes 1 fks
session 8 columns 2 indexes 1 fks
speakers 8 columns 0 indexes 1 fks
talks 10 columns 0 indexes 1 fks
user 8 columns 1 indexes 0 fks
verification 6 columns 1 indexes 0 fks

[✓] Your SQL migration file ➜ drizzle/0000_deep_psylocke.sql 🚀

Created /tmp/smithable-bench-m12-iyPPE4/app-8. Start it with:

  cd /tmp/smithable-bench-m12-iyPPE4/app-8
  smithable run
/tmp/smithable-bench-m12-iyPPE4/app-8/smithable.auth.yml:4:16  warning  With shared access and no allowedDomains, anyone with an account at the sign-in provider can sign up and read all records.
    hint: Restrict sign-in with "allowedDomains" or "selfSignUp: false" under "signIn", or use "defaultAccess: private".
/tmp/smithable-bench-m12-iyPPE4/app-8/smithable.auth.yml:7:16  warning  Anyone on the internet can read Speaker, including personal data in email.
```

### 9. A help desk for an IT team: tickets, priorities and who handles them.

```text
IT Help Desk
  A help desk for an IT team to manage tickets, priorities and assignments.

Pages
  - Tickets (lists tickets; search by title or description; sort by priority, status or createdAt)

Tickets
  Tickets have:
  - a title (required)
  - a description
  - a priority (low, medium, high or critical, low by default)
  - status (open, in progress, resolved or closed, open by default)
  Each ticket can have an assignee (a user).
  Each ticket can have a requester (a user).
  Only itSupport users and admins can delete tickets.

Sign-in and access
  People sign in with Google.
  Everyone who signs in sees all records, and changes and deletes the ones they own.
  Roles:
  - admin
  - itSupport (Handles and resolves IT tickets)
  New users get the itSupport role.
Pictures from the Smithable image library: samples/1.webp, samples/2.webp, samples/3.webp, samples/4.webp, samples/5.webp, samples/6.webp.
Generated 72 files (72 changed, 0 removed).
No config path provided, using default 'drizzle.config.ts'
Reading config file '/tmp/smithable-bench-m12-iyPPE4/app-9/drizzle.config.ts'
5 tables
account 13 columns 1 indexes 1 fks
session 8 columns 2 indexes 1 fks
tickets 10 columns 0 indexes 3 fks
user 8 columns 1 indexes 0 fks
verification 6 columns 1 indexes 0 fks

[✓] Your SQL migration file ➜ drizzle/0000_jazzy_warlock.sql 🚀

Created /tmp/smithable-bench-m12-iyPPE4/app-9. Start it with:

  cd /tmp/smithable-bench-m12-iyPPE4/app-9
  smithable run
/tmp/smithable-bench-m12-iyPPE4/app-9/smithable.auth.yml:4:16  warning  With shared access and no allowedDomains, anyone with an account at the sign-in provider can sign up and read all records.
    hint: Restrict sign-in with "allowedDomains" or "selfSignUp: false" under "signIn", or use "defaultAccess: private".
```

### 10. A recipe collection for a family, with ingredients and shopping lists.

```text
Family Recipes
  A private collection of family recipes with ingredients and shopping lists.

Pages
  - Recipes (lists recipes; search by name, description or category; filter by category or difficulty)
  - Ingredients (lists ingredients)
  - Shopping lists (lists shopping lists)

Recipes
  Recipes have:
  - a name (required)
  - a description
  - servings (a whole number, 4 by default)
  - a prep time (a whole number)
  - a cook time (a whole number)
  - a category (breakfast, lunch, dinner, dessert or snack, breakfast by default)
  - a difficulty (easy, medium or hard, easy by default)
  - instructions (required)
  Only the owner and admins can delete recipes.

Ingredients
  Ingredients have:
  - a name (required)
  - a quantity
  - a unit
  - a recipe (a recipe, required)
  Only the owner and admins can delete ingredients.

Shopping lists
  Shopping lists have:
  - a name (required)
  - a date (required, today by default)
  - status (pending or completed, pending by default)
  - a recipe (a recipe)
  Only the owner and admins can delete shopping lists.

Sign-in and access
  People sign in with Google.
  Everyone sees and changes only their own records.
  Roles:
  - admin
  - member (Family member who can view and add recipes)
  New users get the member role.
Pictures from the Smithable image library: samples/1.webp, samples/2.webp, samples/3.webp, samples/4.webp, samples/5.webp, samples/6.webp.
Generated 82 files (82 changed, 0 removed).
No config path provided, using default 'drizzle.config.ts'
Reading config file '/tmp/smithable-bench-m12-iyPPE4/app-10/drizzle.config.ts'
7 tables
account 13 columns 1 indexes 1 fks
ingredients 8 columns 0 indexes 2 fks
recipes 12 columns 0 indexes 1 fks
session 8 columns 2 indexes 1 fks
shopping_lists 8 columns 0 indexes 2 fks
user 8 columns 1 indexes 0 fks
verification 6 columns 1 indexes 0 fks

[✓] Your SQL migration file ➜ drizzle/0000_fixed_dragon_man.sql 🚀

Created /tmp/smithable-bench-m12-iyPPE4/app-10. Start it with:

  cd /tmp/smithable-bench-m12-iyPPE4/app-10
  smithable run
```

### 11. A status page for our API, with incidents and planned maintenance.

```text
API Status
  Live status of our API services, incidents, and planned maintenance.

Pages
  - Home (a landing page: hero, footer, services, open, recent and planned)
  - Incidents (lists incidents; only for staff users and admins)
  - Updates (lists incident updates; only for staff users and admins)
  - Components (lists components; only for admins)
  - Maintenance (lists maintenances; only for staff users and admins)
  - Overview (lists incidents; only for staff users and admins)
  - Team (who has access: invite people, change roles, remove users; only for admins)

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
  - an at (a date and time, required)
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
  Open to anyone without signing in: the home page, reading components, reading incidents, reading incident updates and reading maintenances.
Pictures from the Smithable image library: samples/1.webp, samples/2.webp, samples/3.webp, samples/4.webp, samples/5.webp, samples/6.webp, hero.webp.
Generated 95 files (95 changed, 0 removed).
No config path provided, using default 'drizzle.config.ts'
Reading config file '/tmp/smithable-bench-m12-iyPPE4/app-11/drizzle.config.ts'
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

[✓] Your SQL migration file ➜ drizzle/0000_stale_nova.sql 🚀

Created /tmp/smithable-bench-m12-iyPPE4/app-11. Start it with:

  cd /tmp/smithable-bench-m12-iyPPE4/app-11
  smithable run
```

### 12. A public uptime page for a web shop: which services work, outages and their updates.

```text
Web Shop Status
  A public uptime page showing which services work and current outages with updates.

Pages
  - Home (a landing page: hero, footer, services and open)
  - Incidents (lists incidents)
  - Updates (lists incident updates)
  - Components (lists components; only for admins)
  - Maintenance (lists maintenances)
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
  - an at (a date and time, required)
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
  Open to anyone without signing in: the home page, reading components, reading incidents where status is investigating or identified or monitoring or resolved, reading incident updates and reading maintenances.
Pictures from the Smithable image library: samples/1.webp, samples/2.webp, samples/3.webp, samples/4.webp, samples/5.webp, samples/6.webp, hero.webp.
Generated 105 files (105 changed, 0 removed).
No config path provided, using default 'drizzle.config.ts'
Reading config file '/tmp/smithable-bench-m12-iyPPE4/app-12/drizzle.config.ts'
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

[✓] Your SQL migration file ➜ drizzle/0000_clear_pride.sql 🚀

Created /tmp/smithable-bench-m12-iyPPE4/app-12. Start it with:

  cd /tmp/smithable-bench-m12-iyPPE4/app-12
  smithable run
```
