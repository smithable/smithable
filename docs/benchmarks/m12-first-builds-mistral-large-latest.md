# M12 first builds: mistral-large-latest (2026-09-28)

Ten app descriptions, each started with `smithable new --describe` (the closest starter, adapted by the model; errors go back up to twice). Totals: 5 / 10 created, 5 type-check, 165,801 tokens, €0.0000.

| Description | Starter | Created | Type-checks | Tokens | Cost | Time |
|---|---|---|---|---|---|---|
| A booking site for a yoga studio, with classes, teachers and online booking. | booking | yes | yes | 11,428 | €0.0000 | 34 s |
| A CRM for a small sales team: companies, contacts, deals and follow-ups. | crm | yes | yes | 18,642 | €0.0000 | 44 s |
| Invoicing for freelancers, with clients, invoices and payments. | invoicing | yes | yes | 14,852 | €0.0000 | 47 s |
| A tool library where neighbours lend each other tools. | crm | **no** | **no** | 17,338 | €0.0000 | 28 s |
| An inventory app for a small bakery: ingredients, suppliers and stock levels. | booking | **no** | **no** | 16,750 | €0.0000 | 31 s |
| A job board for a local union, with job posts and applications. | crm | yes | yes | 17,194 | €0.0000 | 38 s |
| A football club's site: teams, players, matches and results. | booking | yes | yes | 16,196 | €0.0000 | 31 s |
| Event registration for a conference: talks, speakers and attendees. | booking | **no** | **no** | 16,721 | €0.0000 | 26 s |
| A help desk for an IT team: tickets, priorities and who handles them. | invoicing | **no** | **no** | 18,344 | €0.0000 | 27 s |
| A recipe collection for a family, with ingredients and shopping lists. | crm | **no** | **no** | 18,336 | €0.0000 | 35 s |

## Summaries, for review

### 1. A booking site for a yoga studio, with classes, teachers and online booking.

```text
Stillwater Yoga
  A booking site for a yoga studio, with classes, teachers, and online booking.

Class types
  Class types have a name (required), a summary, a level (beginner, all levels or advanced, all levels by default) and duration minutes (a whole number, required, 60 by default).
  Only admins can add class types.

Instructors
  Instructors have a name (required) and a bio.
  Only admins can add instructors.

Sessions
  Sessions have a class type (a class type, required), an instructor (an instructor, required), a starts at (a date and time, required), a capacity (a whole number, required, 12 by default) and a booked out (yes or no, false by default).
  Only admins can add sessions.
  Rule: A session cannot have more bookings than its capacity.

Bookings
  Bookings have a session (a session, required), a booked at (a date and time, required, NOW() by default) and status (confirmed or cancelled, confirmed by default).
  Each booking can have a student (a user).
  Only the owner and admins can see bookings.
  Only member users and admins can add bookings.
  Only admins can change bookings.
  Only the owner and admins can delete bookings.
  Rule: A booking can only be cancelled up to 24 hours before the session starts.

Pages
  Home (a landing page: hero, classes, faq and call to action), Class Schedule (lists sessions; search by class type), My Bookings (lists bookings; only for member users and admins), Class types (lists class types; only for admins) and Instructors (lists instructors; only for admins).

Sign-in and access
  People sign in with Google or Facebook.
  Everyone sees and changes only their own records.
  Roles: admin (Studio staff who manage classes, instructors, and bookings); member (Students who book yoga classes). New users get the member role.
  Open to anyone without signing in: the home page, the sessions page, reading class types, reading instructors and reading sessions.
Generated 78 files (78 changed, 0 removed).
No config path provided, using default 'drizzle.config.ts'
Reading config file '/tmp/smithable-bench-m12-GIUfMD/app-1/drizzle.config.ts'
8 tables
account 13 columns 1 indexes 1 fks
bookings 8 columns 0 indexes 3 fks
class_types 8 columns 0 indexes 1 fks
instructors 6 columns 0 indexes 1 fks
session 8 columns 2 indexes 1 fks
sessions 9 columns 0 indexes 3 fks
user 8 columns 1 indexes 0 fks
verification 6 columns 1 indexes 0 fks

[✓] Your SQL migration file ➜ drizzle/0000_broken_synch.sql 🚀

Created /tmp/smithable-bench-m12-GIUfMD/app-1. Start it with:

  cd /tmp/smithable-bench-m12-GIUfMD/app-1
  smithable run
(node:1363131) Warning: Accessing non-existent property 'replaceRouteChunk' of module exports inside circular dependency
(Use `node --trace-warnings ...` to show where the warning was created)
```

### 2. A CRM for a small sales team: companies, contacts, deals and follow-ups.

```text
Sales CRM
  A lightweight CRM for a small sales team to manage companies, contacts, deals, and follow-ups.

Companies
  Companies have a company name (required), an industry, a company size, a website url, a phone number and address.
  Each company can have an account manager (a user).
  Each company lists its contacts.
  Each company lists its deals.
  The account manager owns the company.
  Only sales users and admins can change companies.
  Only admins can delete companies.

Contacts
  Contacts have a first name (required), a last name (required), email address, a phone number, a job title, a company (a company, required), notes, a last contacted on (a date) and a next follow-up on (a date).
  Only sales users and admins can change contacts.
  Only admins can delete contacts.

Deals
  Deals have a name (required), a company (a company, required), a contact (a contact), a stage (prospect, contact made, proposal sent, in negotiation, closed won or closed lost, prospect by default), an amount (an amount), a probability (%) (a whole number, required, 50 by default), an expected close date and notes.
  Only sales users and admins can change deals.
  Only admins can delete deals.

Pages
  Companies (lists companies; search by company name or industry), Contacts (lists contacts; search by first name, last name, email address or company) and Deals (lists deals; search by name, company or stage).

Sign-in and access
  People sign in with Google, only with salescompany.com accounts.
  Everyone who signs in sees all records, and changes and deletes the ones they own.
  Roles: admin (Manages the CRM and team); sales (Manages companies, contacts, and deals). New users get the sales role.
Generated 71 files (71 changed, 0 removed).
No config path provided, using default 'drizzle.config.ts'
Reading config file '/tmp/smithable-bench-m12-GIUfMD/app-2/drizzle.config.ts'
7 tables
account 13 columns 1 indexes 1 fks
companies 10 columns 0 indexes 1 fks
contacts 13 columns 0 indexes 2 fks
deals 12 columns 0 indexes 3 fks
session 8 columns 2 indexes 1 fks
user 8 columns 1 indexes 0 fks
verification 6 columns 1 indexes 0 fks

[✓] Your SQL migration file ➜ drizzle/0000_quiet_stark_industries.sql 🚀

Created /tmp/smithable-bench-m12-GIUfMD/app-2. Start it with:

  cd /tmp/smithable-bench-m12-GIUfMD/app-2
  smithable run
(node:1363992) Warning: Accessing non-existent property 'replaceRouteChunk' of module exports inside circular dependency
(Use `node --trace-warnings ...` to show where the warning was created)
```

### 3. Invoicing for freelancers, with clients, invoices and payments.

```text
Invoicely
  Simple invoicing for freelancers. Each user manages their own clients, invoices, and payments.

Business profiles
  Business profiles have a business name (required), a vat number, an iban, a payment terms (days) (a whole number, required, 30 by default) and an invoice footer.

Clients
  Clients have a client name (required), an email (required), address and a vat number.
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

Payments
  Payments have an invoice (an invoice, required), an amount (an amount, required), a received on (a date, required, TODAY() by default) and a payment method (cash, bank transfer, credit card or paypal, cash by default).

Pages
  Home (a landing page: hero, features, pricing, faq and call to action), Overview (a dashboard: outstanding, overdue, paid, invoiced and latest), Invoices (lists invoices; search by invoice number or client), Clients (lists clients; search by client name or email), Payments (lists payments), Settings (settings: edits your business profile) and Welcome (a first-time setup of your business profile in 2 steps).

Sign-in and access
  People sign in with Google.
  Everyone sees and changes only their own records.
  Roles: admin (Invoicely staff); member (A freelancer using Invoicely). New users get the member role.
  Open to anyone without signing in: the home page.
Generated 85 files (85 changed, 0 removed).
No config path provided, using default 'drizzle.config.ts'
Reading config file '/tmp/smithable-bench-m12-GIUfMD/app-3/drizzle.config.ts'
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

[✓] Your SQL migration file ➜ drizzle/0000_certain_krista_starr.sql 🚀

Created /tmp/smithable-bench-m12-GIUfMD/app-3. Start it with:

  cd /tmp/smithable-bench-m12-GIUfMD/app-3
  smithable run
(node:1364638) Warning: Accessing non-existent property 'replaceRouteChunk' of module exports inside circular dependency
(Use `node --trace-warnings ...` to show where the warning was created)
```

### 4. A tool library where neighbours lend each other tools.

Failed:

```text
Starting from the crm starter.
Smithable model (mistral-large-latest) · 17,338 tokens · €0.0000
No model drafted a valid project.
smithable.yml:15:7  error  "owner" is added to every model automatically, so it cannot be declared.
    hint: Every record already has an owner: whoever created it. To make someone else the owner, add a user field (like "lender: User") and "ownedBy: lender".
smithable.yml:19:14  error  "ownedBy" of "Tool" must name one of its User fields.
Without a model, start from a starter: smithable new /tmp/smithable-bench-m12-GIUfMD/app-4 --starter crm

```

### 5. An inventory app for a small bakery: ingredients, suppliers and stock levels.

Failed:

```text
Starting from the booking starter.
Smithable model (mistral-large-latest) · 16,750 tokens · €0.0000
No model drafted a valid project.
smithable.yml:10:13  error  Field "Ingredient.unit": Choice value "pieces!" must start with a lowercase letter and use only letters and digits.
    hint: Choice fields always have a value (the first one by default), so "!" is not needed.
Without a model, start from a starter: smithable new /tmp/smithable-bench-m12-GIUfMD/app-5 --starter booking

```

### 6. A job board for a local union, with job posts and applications.

```text
Local Union Jobs
  A job board for a local union, with job posts and applications.

Job posts
  Job posts have a title (required), a description (required), an employer (required), a location (required), a wage (an amount), a posted on (a date, required, TODAY() by default), a deadline (a date) and status (open for applications or closed, open for applications by default).
  Each job post lists its applications.
  Only unionStaff users and admins can change job posts.
  Only admins can delete job posts.

Applications
  Applications have a job post (a job post, required), a member name (required), a member email (required), a member phone, a resume, an applied on (a date, required, TODAY() by default) and status (pending review, reviewed or rejected, pending review by default).
  Only unionStaff users and admins can change applications.
  Only admins can delete applications.

Pages
  Home (a landing page: hero, features and call to action), Job Posts (lists job posts; search by title, employer or location) and Applications (lists applications; search by member name, member email or job post).

Sign-in and access
  People sign in with Google.
  Everyone sees and changes only their own records.
  Roles: admin (Runs the app. Full access); unionStaff (Manages job posts and applications). New users get the unionStaff role.
  Open to anyone without signing in: the home page.
Generated 68 files (68 changed, 0 removed).
No config path provided, using default 'drizzle.config.ts'
Reading config file '/tmp/smithable-bench-m12-GIUfMD/app-6/drizzle.config.ts'
6 tables
account 13 columns 1 indexes 1 fks
applications 11 columns 0 indexes 2 fks
job_posts 12 columns 0 indexes 1 fks
session 8 columns 2 indexes 1 fks
user 8 columns 1 indexes 0 fks
verification 6 columns 1 indexes 0 fks

[✓] Your SQL migration file ➜ drizzle/0000_good_winter_soldier.sql 🚀

Created /tmp/smithable-bench-m12-GIUfMD/app-6. Start it with:

  cd /tmp/smithable-bench-m12-GIUfMD/app-6
  smithable run
(node:1365971) Warning: Accessing non-existent property 'replaceRouteChunk' of module exports inside circular dependency
(Use `node --trace-warnings ...` to show where the warning was created)
```

### 7. A football club's site: teams, players, matches and results.

```text
Stillwater FC
  Teams, players, matches and results for a football club.

Teams
  Teams have a name (required), an age group and a coach.
  Only admins can add teams.

Players
  Players have a name (required), a team (a team, required), a position (goalkeeper, defender, midfielder or forward, goalkeeper by default) and a number (a whole number).
  Only admins can add players.

Matches
  Matches have a team (a team, required), an opponent (required), a date (required), a time, a venue (home or away, home by default), a result and a score.
  Only admins can add matches.
  Rule: A match's result and score are only set after the match is played.

Pages
  Home (a landing page: hero, teams and call to action), Matches (lists matches; search by opponent), Teams (lists teams; only for admins) and Players (lists players; search by name or team; only for admins).

Sign-in and access
  People sign in with Google.
  Everyone who signs in sees all records, and changes and deletes the ones they own.
  Roles: admin (Club staff. Manage teams, players and matches); supporter (A fan who follows the club's matches and results). New users get the supporter role.
  Open to anyone without signing in: the home page, the matches page, reading teams, reading players and reading matches.
Generated 71 files (71 changed, 0 removed).
No config path provided, using default 'drizzle.config.ts'
Reading config file '/tmp/smithable-bench-m12-GIUfMD/app-7/drizzle.config.ts'
7 tables
account 13 columns 1 indexes 1 fks
matches 11 columns 0 indexes 2 fks
players 8 columns 0 indexes 2 fks
session 8 columns 2 indexes 1 fks
teams 7 columns 0 indexes 1 fks
user 8 columns 1 indexes 0 fks
verification 6 columns 1 indexes 0 fks

[✓] Your SQL migration file ➜ drizzle/0000_moaning_captain_stacy.sql 🚀

Created /tmp/smithable-bench-m12-GIUfMD/app-7. Start it with:

  cd /tmp/smithable-bench-m12-GIUfMD/app-7
  smithable run
/tmp/smithable-bench-m12-GIUfMD/app-7/smithable.auth.yml:5:16  warning  With shared access and no allowedDomains, anyone with an account at the sign-in provider can sign up and read all records.
    hint: Restrict sign-in with "allowedDomains" under "signIn", or use "defaultAccess: private".
(node:1366625) Warning: Accessing non-existent property 'replaceRouteChunk' of module exports inside circular dependency
(Use `node --trace-warnings ...` to show where the warning was created)
```

### 8. Event registration for a conference: talks, speakers and attendees.

Failed:

```text
Starting from the booking starter.
Smithable model (mistral-large-latest) · 16,721 tokens · €0.0000
No model drafted a valid project.
smithable.ux.yml:4:11  error  There is no theme preset "professional".
    hint: Available: modern, minimal, playful, corporate.
smithable.ux.yml:18:7  error  Unknown key "fields" in the form of page "register".
Without a model, start from a starter: smithable new /tmp/smithable-bench-m12-GIUfMD/app-8 --starter booking

```

### 9. A help desk for an IT team: tickets, priorities and who handles them.

Failed:

```text
Starting from the invoicing starter.
Smithable model (mistral-large-latest) · 18,344 tokens · €0.0000
No model drafted a valid project.
smithable.ux.yml:6:66  error  "info" is not a tone.
    hint: Available: neutral, success, warning, danger.
Without a model, start from a starter: smithable new /tmp/smithable-bench-m12-GIUfMD/app-9 --starter invoicing

```

### 10. A recipe collection for a family, with ingredients and shopping lists.

Failed:

```text
Starting from the crm starter.
Smithable model (mistral-large-latest) · 18,336 tokens · €0.0000
No model drafted a valid project.
smithable.content.yml:22:5  error  Page "home" has no title, subtitle, section or tile named "landing".
Without a model, start from a starter: smithable new /tmp/smithable-bench-m12-GIUfMD/app-10 --starter crm

```
