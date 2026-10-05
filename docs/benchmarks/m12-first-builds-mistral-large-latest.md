# M12 first builds: mistral-large-latest (2026-10-05)

The app descriptions, each started with `smithable new --describe … --yes` (the starter the first step picks, adapted by the model; errors go back up to twice). Totals: 11 / 12 created, 10 type-check, 324,703 tokens (291,817 in, 32,886 out), $0.1952 (Mistral's list price); 0 model calls answered from the response cache. *Rounds* counts the model's drafting calls: the first draft and each round of corrections after it.

| Description | Starter | Created | Type-checks | Tokens in | Tokens out | Cost | Cached calls | Rounds | Time |
|---|---|---|---|---|---|---|---|---|---|
| A booking site for a yoga studio, with classes, teachers and online booking. | booking | yes | yes | 10,068 | 4,008 | $0.0110 | 0 | 1 | 44 s |
| A CRM for a small sales team: companies, contacts, deals and follow-ups. | crm | yes | yes | 39,984 | 2,576 | $0.0239 | 0 | 4 | 35 s |
| Invoicing for freelancers, with clients, invoices and payments. | invoicing | **no** | **no** | 39,899 | 3,644 | $0.0254 | 0 | 4 | 37 s |
| A tool library where neighbors lend each other tools. | marketplace | yes | yes | 41,009 | 2,973 | $0.0250 | 0 | 4 | 38 s |
| An inventory app for a small bakery: ingredients, suppliers and stock levels. | records | yes | yes | 9,284 | 856 | $0.0059 | 0 | 1 | 16 s |
| A job board for a local union, with job posts and applications. | marketplace | yes | **no** | 32,093 | 4,946 | $0.0235 | 0 | 3 | 52 s |
| A football club's site: teams, players, matches and results. | records | yes | yes | 20,060 | 3,062 | $0.0146 | 0 | 2 | 40 s |
| Event registration for a conference: talks, speakers and attendees. | records | yes | yes | 39,449 | 2,168 | $0.0230 | 0 | 4 | 33 s |
| A help desk for an IT team: tickets, priorities and who handles them. | records | yes | yes | 9,284 | 1,216 | $0.0065 | 0 | 1 | 18 s |
| A recipe collection for a family, with ingredients and shopping lists. | records | yes | yes | 9,281 | 2,187 | $0.0079 | 0 | 1 | 27 s |
| A status page for our API, with incidents and planned maintenance. | status | yes | yes | 20,235 | 2,280 | $0.0135 | 0 | 2 | 30 s |
| A public uptime page for a web shop: which services work, outages and their updates. | status | yes | yes | 21,171 | 2,970 | $0.0150 | 0 | 2 | 34 s |

Each created app's four spec files are in [m12-first-builds-mistral-large-latest/](m12-first-builds-mistral-large-latest/), one folder per description (app-1 …).

<!-- scorecard -->
## Scorecard (scripts/bench-m12.mjs --score)

2 of 11 drafts end with a warning about what is public (*Public flaws left*: public-personal-data, public-page-closed-records, contact-form-closed, shortcut-closed, mine-public, visitors-read-drafts); since #266 a draft with one goes back to the model once to fix it. *API app*, for the second set's two descriptions of apps for programs and assistants: "yes" when the draft has no landing page, an `api` block, tools when the description names an assistant, and a role other than admin for keys; otherwise what it lacks.

| # | Starter | Questions | Models kept | Pages kept | Actions kept | Access; roles (default) | Pages with access | Public | Warnings | Public flaws left | API app | Starter's texts in the draft | Models with the starter's samples | Visitors / landing |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | booking | 0 | 6 / 6 (has 6) | 8 / 10 (has 8) | 0 / 0 (has 0) | private; admin, member (member) | sessions: admin, class-types: admin, instructors: admin, posts: admin | pages home, schedule, blog; read ClassType, Instructor, Session, Post; create Message | 0 | none |  | none | 4 / 6 | mentions visitors; landing page |
| 2 | crm | 2 | 0 / 2 (has 4) | 1 / 3 (has 4) | 0 / 1 (has 2); left out: advanceDealStage | shared; admin, sales (sales) | none | pages none; read none; create none | 0 | none |  | none | 0 / 4 | no mention; no landing page |
| 4 | marketplace (words: records) | 2 | 0 / 1 (has 2) | 1 / 4 (has 3) | 0 / 0 (has 1); left out: return | private; admin, member (member) | none | pages home, tools; read Tool; create none | 0 | none |  | none | 0 / 2 | no mention; landing page |
| 5 | records (words: api) | 3 | 0 / 1 (has 2) | 0 / 2 (has 3) | 0 / 0 (has 0) | shared; admin, baker, manager (baker) | none | pages none; read none; create none | 0 | none |  | none | 0 / 2 | no mention; no landing page |
| 6 | marketplace | 3 | 0 / 1 (has 2) | 1 / 4 (has 3) | 0 / 0 (has 2) | private; admin, member (member) | none | pages home, jobs; read JobPost; create none | 1 (public-personal-data) | **public-personal-data** |  | none | 0 / 2 | no mention; landing page |
| 7 | records | 2 | 0 / 1 (has 3) | 1 / 2 (has 4) | 0 / 0 (has 0) | private; admin, member (member) | none | pages home, teams, players, matches; read Team, Player, Match; create none | 1 (public-personal-data) | **public-personal-data** |  | none | 0 / 3 | mentions visitors; landing page |
| 8 | records | 3 | 0 / 1 (has 5) | 1 / 2 (has 4) | 0 / 0 (has 1); left out: cancelRegistration, setCapacity Registration | private; admin, member (member) | none | pages home, talks, speakers; read Talk, Speaker; create none | 0 | none |  | none | 0 / 5 | no mention; landing page |
| 9 | records (words: invoicing) | 2 | 0 / 1 (has 1) | 0 / 2 (has 3) | 0 / 0 (has 4) | shared; admin, itStaff (itStaff) | none | pages none; read none; create none | 0 | none |  | none | 0 / 1 | no mention; no landing page |
| 10 | records | 2 | 0 / 1 (has 3) | 1 / 2 (has 3) | 0 / 0 (has 0) | private; admin, member (member) | none | pages home, recipes; read Recipe; create none | 0 | none |  | none | 0 / 3 | no mention; landing page |
| 11 | status | 0 | 4 / 4 (has 4) | 6 / 8 (has 7) | 3 / 3 (has 3) | shared; admin, staff (staff) | components: admin | pages home; read Component, Incident, IncidentUpdate, Maintenance; create none | 0 | none |  | none | 4 / 4 | no mention; landing page |
| 12 | status | 0 | 4 / 4 (has 4) | 7 / 8 (has 7) | 3 / 3 (has 3) | shared; admin, staff (staff) | none | pages home; read Component, Incident, IncidentUpdate, Maintenance; create none | 0 | none |  | none | 4 / 4 | mentions visitors; landing page |

"Kept" counts the starter's models, pages and actions that the draft still has by name, with how many the draft has in all; "left out" names what the draft dropped because it could not be made valid: an action by its name, anything else (a formula field, a capacity) with its operation. "Starter's texts" lists the starter's app name or sample titles found in the draft's spec or content. "Models with the starter's samples" counts the draft's models that keep some of the starter's sample records after `fitSamples`; the rest get generated rows. "Mentions visitors" means the description says visitors, public or site. "Starter" is the one `new --describe --yes` printed, with the word-match starter (`closestStarter`) beside it when it differs; "Questions" counts what `smithable clarify` would ask (`--yes` asks nothing), with their language for a description not in English.
<!-- /scorecard -->

## Summaries, for review

### 1. A booking site for a yoga studio, with classes, teachers and online booking.

```text
Harmony Yoga Studio
  Class schedule and online booking for a yoga studio in the city center.

Pages
  - Find your balance at Harmony Yoga Studio (a landing page: hero, class types, estimate, gallery, faq, call to action, posts where status is published, contact and footer)
  - Schedule (lists sessions)
  - Sessions (lists sessions; only for admins)
  - Class types (lists class types; only for admins; visitors see class types on the Find your balance at Harmony Yoga Studio page)
  - Instructors (lists instructors; only for admins)
  - Blog (lists posts)
  - Posts (lists posts; only for admins; visitors see posts on the Find your balance at Harmony Yoga Studio page)
  - My bookings (lists bookings)

Class types
  Class types have:
  - a name (required)
  - a summary
  - a level (beginner, all levels, advanced or prenatal, all levels by default)
  - a duration (minutes) (a whole number, required, 75 by default)
  Only admins can add class types.

Instructors
  Instructors have:
  - a name (required)
  - a biography (formatted text)
  - a portrait (picture)
  Only admins can add instructors.

Sessions
  Sessions have:
  - a class type (a class type, required)
  - an instructor (an instructor, required)
  - starts at (a date and time, required)
  - a capacity (a whole number, required, 15 by default)
  Each session lists its bookings.
  The places left is calculated as the capacity minus the number of its bookings.
  Only admins can add sessions.

Bookings
  Bookings have:
  - a session (a session, required, unique)
  At most the session's capacity bookings per session.

Posts
  Posts have:
  - a title (required)
  - address (unique)
  - a summary
  - a cover (picture)
  - a body (formatted text, required)
  - published on (a date)
  - status (draft or published, draft by default)
  Only admins can add posts.
  Only admins can change posts.
  Only admins can delete posts.

Messages
  Messages have:
  - a name (required)
  - an email (required)
  - a message (required)
  Only admins can see messages.
  Only admins can change messages.
  Only admins can delete messages.

Sign-in and access
  People sign in with a code sent to their email.
  Everyone sees and changes only their own records.
  Roles:
  - admin (Studio staff. Manage the schedule, classes and teachers)
  - member (A student who books classes)
  New users get the member role.
  Open to anyone without signing in: the home page, the schedule page, the blog page, reading class types, reading instructors, reading sessions, reading posts where status is published and adding messages.
Pictures from the Smithable image library: samples/1.webp, samples/2.webp, samples/3.webp, samples/4.webp, samples/5.webp, samples/6.webp, hero.webp.
Generated 119 files (119 changed, 0 removed).
No config path provided, using default 'drizzle.config.ts'
Reading config file '/tmp/smithable-bench-m12-xlFgtd/app-1/drizzle.config.ts'
11 tables
account 13 columns 1 indexes 1 fks
audit_log 13 columns 2 indexes 0 fks
bookings 5 columns 1 indexes 2 fks
class_types 8 columns 0 indexes 1 fks
instructors 7 columns 0 indexes 1 fks
messages 7 columns 0 indexes 1 fks
posts 11 columns 1 indexes 1 fks
session 8 columns 2 indexes 1 fks
sessions 9 columns 0 indexes 3 fks
user 8 columns 1 indexes 0 fks
verification 6 columns 1 indexes 0 fks

[✓] Your SQL migration file ➜ drizzle/0000_spicy_pepper_potts.sql 🚀

Created /tmp/smithable-bench-m12-xlFgtd/app-1. Start it with:

  cd /tmp/smithable-bench-m12-xlFgtd/app-1
  smithable run
```

### 2. A CRM for a small sales team: companies, contacts, deals and follow-ups.

```text
Left out, since it could not be made valid:
  addAction advanceDealStage: addAction would make smithable.yml invalid. "set" of action "advanceDealStage", stage: "'" cannot be used in a formula. Write text in double quotes, like "standard".

Sales Team CRM
  A lightweight CRM for managing companies, contacts, deals, and follow-ups.

Pages
  - Companies (lists companies; search by name or email)
  - Contacts (lists contacts; search by first name, last name or email)
  - Team (who has access: invite people, change roles, remove users)
  - Deals (lists deals; search by name or company; filter by stage or company; sort by name, amount or expected close date; “Lose deal”)

Companies
  Companies have:
  - a name (required)
  - an email (unique)
  - a phone
  - a segment (smb, enterprise or government, smb by default)
  - a website (a web address)
  - notes
  Each company can have an account manager (a user).
  Each company lists its contacts.
  The account manager owns the company.
  Only admins can delete companies.

Contacts
  Contacts have:
  - a first name (required)
  - a last name (required)
  - an email (required)
  - a phone
  - a position
  - a company (a company, required)
  - notes
  Only admins can delete contacts.

Follow ups
  Follow ups have:
  - a due date (required)
  - notes
  - a completed (yes or no, false by default)
  - completed at (a date and time)
  - a deal (a deal, required)
  Only admins can delete follow ups.
  Only sales users and admins can change follow ups.

Deals
  Deals have:
  - a name (required)
  - a company (a company, required)
  - a contact (a contact)
  - an amount (an amount)
  - a stage (lead, prospect, proposal, negotiation, closed won or closed lost, lead by default)
  - an expected close date
  - a probability (a whole number, 50 by default)
  - notes
  Only sales users and admins can change deals.
  Only admins can delete deals.

Mark follow up complete
  For a follow up that is not completed; sets completed to yes and completed at to now.
  Mark a follow-up as completed.

Lose deal
  For a deal that is lead, prospect, proposal or negotiation; sets stage to closed lost.
  Mark a deal as lost.

Sign-in and access
  People sign in with a code sent to their email.
  Everyone who signs in sees all records, and changes and deletes the ones they own.
  Roles:
  - admin (Sales management. Full access)
  - sales (Works with companies, contacts, and deals)
  New users get the sales role.
No pictures: none of the library's files could be fetched.
Generated 101 files (101 changed, 0 removed).
No config path provided, using default 'drizzle.config.ts'
Reading config file '/tmp/smithable-bench-m12-xlFgtd/app-2/drizzle.config.ts'
10 tables
account 13 columns 1 indexes 1 fks
audit_log 13 columns 2 indexes 0 fks
companies 10 columns 1 indexes 1 fks
contacts 11 columns 0 indexes 2 fks
deals 12 columns 0 indexes 3 fks
follow_ups 9 columns 0 indexes 2 fks
invitation 7 columns 2 indexes 1 fks
session 8 columns 2 indexes 1 fks
user 8 columns 1 indexes 0 fks
verification 6 columns 1 indexes 0 fks

[✓] Your SQL migration file ➜ drizzle/0000_flaky_agent_zero.sql 🚀

Created /tmp/smithable-bench-m12-xlFgtd/app-2. Start it with:

  cd /tmp/smithable-bench-m12-xlFgtd/app-2
  smithable run
```

### 3. Invoicing for freelancers, with clients, invoices and payments.

Failed:

```text
Starting from the invoicing starter.
Smithable model (mistral-large-latest) · 43,543 tokens (39,899 in, 3,644 out) · $0.0254
No model drafted a valid project.
addModel: addModel would make smithable.yml invalid. Field "Invoice.dueOn": "'" cannot be used in a formula. Write text in double quotes, like "standard".
addField: addField would make smithable.yml invalid. There is no model named "Invoice".
addPage: There is no model named "Invoice".
Without a model, start from a starter: smithable new /tmp/smithable-bench-m12-xlFgtd/app-3 --starter invoicing

```

### 4. A tool library where neighbors lend each other tools.

```text
Left out, since it could not be made valid:
  addAction return: addAction would make smithable.yml invalid. "returnedAt" in "when" of action "return": compares a choice field with one of its values (or a list of them), and a yes/no field with true or false. "add" of action "return": Tool must refer to Borrowing exactly once to be added to it (it does not).

NeighborTools
  A tool library where neighbors lend each other tools.

Pages
  - Home (a landing page: hero, tools where available is yes and footer)
  - Tools (lists tools; search by name, description or location; filter by category, condition or available; sort by name or date added; records can be saved as favorites; contact the owner by mail; “Borrow”)
  - My borrowings (lists borrowings; only the viewer's own records)

Tools
  Tools have:
  - a name (required)
  - a photo (picture)
  - a description
  - a category (gardening, woodworking, cleaning, power tools, hand tools or other, gardening by default)
  - a condition (new, good, worn or broken, new by default)
  - a location
  - an available (yes or no, true by default)
  Only the owner and admins can delete tools.

Borrowings
  Borrowings have:
  - a tool (a tool, required)
  - borrowed at (a date and time, now by default)
  - due at (a date and time)
  - returned at (a date and time)
  Each borrowing can have a borrower (a user).
  Only member users and admins can add borrowings.
  Only the owner and admins can delete borrowings.

Borrow
  For a tool that is available; sets available to no; asks for the borrowing's due at; adds a borrowing (borrower whoever pressed it).
  Borrow a tool for a set period.

Sign-in and access
  People sign in with a code sent to their email.
  Everyone sees and changes only their own records.
  Roles:
  - admin
  - member (Lends and borrows tools)
  New users get the member role.
  Open to anyone without signing in: the home page, the tools page and reading tools.
Pictures from the Smithable image library: samples/1.webp, samples/2.webp, samples/3.webp, samples/4.webp, samples/5.webp, samples/6.webp.
Generated 98 files (98 changed, 0 removed).
No config path provided, using default 'drizzle.config.ts'
Reading config file '/tmp/smithable-bench-m12-xlFgtd/app-4/drizzle.config.ts'
8 tables
account 13 columns 1 indexes 1 fks
audit_log 13 columns 2 indexes 0 fks
borrowings 9 columns 0 indexes 3 fks
session 8 columns 2 indexes 1 fks
tools 11 columns 0 indexes 1 fks
tools_favorites 4 columns 1 indexes 2 fks
user 8 columns 1 indexes 0 fks
verification 6 columns 1 indexes 0 fks

[✓] Your SQL migration file ➜ drizzle/0000_illegal_slyde.sql 🚀

Created /tmp/smithable-bench-m12-xlFgtd/app-4. Start it with:

  cd /tmp/smithable-bench-m12-xlFgtd/app-4
  smithable run
```

### 5. An inventory app for a small bakery: ingredients, suppliers and stock levels.

```text
Bakery Inventory
  Track ingredients, suppliers and stock levels for a small bakery.

Pages
  - Ingredients (lists ingredients; search by name or description; filter by supplier; sort by name, stock or cost per unit)
  - Suppliers (lists suppliers)
  - Team (who has access: invite people, change roles, remove users)

Suppliers
  Suppliers have:
  - a name (required)
  - a contact
  - an email
  - a phone
  - address
  Only manager users and admins can add suppliers.
  Only manager users and admins can change suppliers.
  Only manager users and admins can delete suppliers.

Ingredients
  Ingredients have:
  - a name (required)
  - a description
  - a supplier (a supplier)
  - a unit (required, kg by default)
  - a stock (a number, required)
  - a minimum stock (a number, 5 by default)
  - a cost per unit (an amount)

Sign-in and access
  People sign in with a code sent to their email.
  Everyone who signs in sees all records, and changes and deletes the ones they own.
  Roles:
  - admin
  - baker (Manages ingredients and stock levels)
  - manager (Oversees suppliers and inventory)
  New users get the baker role.
No pictures: none of the library's files could be fetched.
Generated 89 files (89 changed, 0 removed).
No config path provided, using default 'drizzle.config.ts'
Reading config file '/tmp/smithable-bench-m12-xlFgtd/app-5/drizzle.config.ts'
8 tables
account 13 columns 1 indexes 1 fks
audit_log 13 columns 2 indexes 0 fks
ingredients 11 columns 0 indexes 2 fks
invitation 7 columns 2 indexes 1 fks
session 8 columns 2 indexes 1 fks
suppliers 9 columns 0 indexes 1 fks
user 8 columns 1 indexes 0 fks
verification 6 columns 1 indexes 0 fks

[✓] Your SQL migration file ➜ drizzle/0000_lethal_red_shift.sql 🚀

Created /tmp/smithable-bench-m12-xlFgtd/app-5. Start it with:

  cd /tmp/smithable-bench-m12-xlFgtd/app-5
  smithable run
```

### 6. A job board for a local union, with job posts and applications.

```text
Union Jobs
  Job posts and applications for union members and local employers.

Pages
  - Find your next job with Union Jobs (a landing page: hero, job posts where status is open and footer)
  - Jobs (lists job posts; search by job title, description or location)
  - My jobs (lists job posts; only the viewer's own records)

Job Posts
  Job Posts have:
  - a job title (required)
  - a description (required)
  - a category (construction, healthcare, education, transportation, hospitality or other, construction by default)
  - a location (required)
  - a wage (an amount)
  - hours (full-time, part-time, temporary or seasonal, full-time by default)
  - a contact email (required)
  - a contact phone
  - status (open or closed, open by default)
  Each job post can have a posted by (a user).
  Each job post lists its applications.
  The posted by owns the job post.

Applications
  Applications have:
  - a job (a job post, required)
  - a name (required)
  - an email (required)
  - a phone
  - a message
  - a resume (picture)
  - status (submitted, reviewed, interviewed, rejected or hired, submitted by default)
  Only member users and admins can add applications.

Close job
  For a job post that is open; sets status to closed.
  Close a job post when it is no longer open.

Reopen job
  For a job post that is closed; sets status to open.
  Reopen a job post when it is available again.

Sign-in and access
  People sign in with a code sent to their email.
  Everyone sees and changes only their own records.
  Roles:
  - admin (Union staff managing the job board)
  - member (Union member or local employer posting jobs)
  New users get the member role.
  Open to anyone without signing in: the home page, the jobs page and reading job posts.
Pictures from the Smithable image library: samples/1.webp, samples/2.webp, samples/3.webp, samples/4.webp, samples/5.webp, hero.webp.
Generated 96 files (96 changed, 0 removed).
No config path provided, using default 'drizzle.config.ts'
Reading config file '/tmp/smithable-bench-m12-xlFgtd/app-6/drizzle.config.ts'
7 tables
account 13 columns 1 indexes 1 fks
audit_log 13 columns 2 indexes 0 fks
job_applications 11 columns 0 indexes 2 fks
job_posts 13 columns 0 indexes 1 fks
session 8 columns 2 indexes 1 fks
user 8 columns 1 indexes 0 fks
verification 6 columns 1 indexes 0 fks

[✓] Your SQL migration file ➜ drizzle/0000_slow_salo.sql 🚀

Created /tmp/smithable-bench-m12-xlFgtd/app-6. Start it with:

  cd /tmp/smithable-bench-m12-xlFgtd/app-6
  smithable run
/tmp/smithable-bench-m12-xlFgtd/app-6/smithable.auth.yml:7:10  warning  Anyone on the internet can read JobPost, including personal data in contactEmail, contactPhone, postedBy.
```

### 7. A football club's site: teams, players, matches and results.

```text
Greenfield FC
  The teams, players, matches and results of Greenfield Football Club.

Pages
  - Welcome to Greenfield FC (a landing page: hero, matches where result is upcoming, matches where result is win or draw or loss and footer)
  - Teams (lists teams)
  - Players (lists players)
  - Matches (lists matches)

Teams
  Teams have:
  - a team name (required)
  - an age group (under 7s, under 9s, under 11s, under 13s, under 15s, under 18s, senior or veterans, under 7s by default)
  Each team can have a coach (a user).
  Each team lists its players.

Players
  Players have:
  - a first name (required)
  - a last name (required)
  - a date of birth (required)
  - a position (goalkeeper, defender, midfielder or forward, goalkeeper by default)
  - a team (a team)
  - a squad number (a whole number)
  - joined on (a date, required, today by default)

Matches
  Matches have:
  - a date and time (a date and time, required)
  - an opponent (required)
  - a home match (yes or no, required, true by default)
  - a venue
  - a team (a team, required)
  - a result (win, draw, loss or upcoming, win by default)
  - a score
  - a match report

Sign-in and access
  People sign in with a code sent to their email.
  Everyone sees and changes only their own records.
  Roles:
  - admin
  - member
  New users get the member role.
  Open to anyone without signing in: the home page, the teams page, the players page, the matches page, reading teams, reading players and reading matches.
Pictures from the Smithable image library: hero.webp.
Generated 92 files (92 changed, 0 removed).
No config path provided, using default 'drizzle.config.ts'
Reading config file '/tmp/smithable-bench-m12-xlFgtd/app-7/drizzle.config.ts'
8 tables
account 13 columns 1 indexes 1 fks
audit_log 13 columns 2 indexes 0 fks
matches 12 columns 0 indexes 2 fks
players 11 columns 0 indexes 2 fks
session 8 columns 2 indexes 1 fks
teams 7 columns 0 indexes 2 fks
user 8 columns 1 indexes 0 fks
verification 6 columns 1 indexes 0 fks

[✓] Your SQL migration file ➜ drizzle/0000_clumsy_stick.sql 🚀

Created /tmp/smithable-bench-m12-xlFgtd/app-7. Start it with:

  cd /tmp/smithable-bench-m12-xlFgtd/app-7
  smithable run
/tmp/smithable-bench-m12-xlFgtd/app-7/smithable.auth.yml:7:10  warning  Anyone on the internet can read Team, including personal data in coach.
```

### 8. Event registration for a conference: talks, speakers and attendees.

```text
Left out, since it could not be made valid:
  addAction cancelRegistration: addAction would make smithable.yml invalid. "set" of action "cancelRegistration": UserRegistration has no field named "talk.status". "owner" does not apply to "allow" of action "cancelRegistration": no single record is involved.
  setCapacity Registration: setCapacity would make smithable.yml invalid. "where" in the capacity of "Registration": "talk.status" must be a choice field of Registration with one of its values (or a list of them), or a yes/no field with true or false.

Conference Central
  Register for talks, meet the speakers and see who's coming.

Pages
  - Join us for the conference (a landing page: hero, talks where status is scheduled, speakers and footer)
  - Talks (lists talks; “Register”)
  - Speakers (lists speakers)
  - Team (who has access: invite people, change roles, remove users)

Speakers
  Speakers have:
  - a name (required)
  - a bio
  - a photo (a web address)
  - a website (a web address)
  Only admins can change speakers.
  Only admins can delete speakers.

Talks
  Talks have:
  - a title (required)
  - a description
  - a speaker (a speaker, required)
  - starts at (a date and time, required)
  - ends at (a date and time, required)
  - a room
  - a capacity (a whole number)
  - status (draft, scheduled or canceled, draft by default)
  Only admins can change talks.
  Only admins can delete talks.

Attendees
  Attendees have:
  - a name (required)
  - an email (required, unique)
  - a company
  Only the owner and admins can change attendees.
  Only the owner and admins can delete attendees.

Registrations
  Registrations have:
  - an attendee (an attendee, required)
  - a talk (a talk, required)

User registrations
  User registrations have:
  - a talk (a talk, required)
  Each user registration can have a user (a user).

Register
  For a talk that is scheduled; adds a user registration (user whoever pressed it).
  Register the signed-in person for this talk.

Sign-in and access
  People sign in with a code sent to their email.
  Everyone sees and changes only their own records.
  Roles:
  - admin
  - member
  New users get the member role.
  Open to anyone without signing in: the home page, the talks page, the speakers page, reading talks and reading speakers.
Pictures from the Smithable image library: hero.webp.
Generated 98 files (98 changed, 0 removed).
No config path provided, using default 'drizzle.config.ts'
Reading config file '/tmp/smithable-bench-m12-xlFgtd/app-8/drizzle.config.ts'
11 tables
account 13 columns 1 indexes 1 fks
attendees 7 columns 1 indexes 1 fks
audit_log 13 columns 2 indexes 0 fks
invitation 7 columns 2 indexes 1 fks
registrations 6 columns 0 indexes 3 fks
session 8 columns 2 indexes 1 fks
speakers 8 columns 0 indexes 1 fks
talks 12 columns 0 indexes 2 fks
user 8 columns 1 indexes 0 fks
user_registrations 6 columns 0 indexes 3 fks
verification 6 columns 1 indexes 0 fks

[✓] Your SQL migration file ➜ drizzle/0000_cheerful_chamber.sql 🚀

Created /tmp/smithable-bench-m12-xlFgtd/app-8. Start it with:

  cd /tmp/smithable-bench-m12-xlFgtd/app-8
  smithable run
```

### 9. A help desk for an IT team: tickets, priorities and who handles them.

```text
IT Help Desk
  A place for the IT team to track and resolve support tickets.

Pages
  - Tickets (lists tickets; search by title or description; “Assign”; “Start progress”; “Resolve”; “Close”)
  - Admin (every kind of record, to find, open, change and delete)
  - Team (who has access: invite people, change roles, remove users)

Tickets
  Tickets have:
  - a title (required)
  - a description (required)
  - a priority (low, normal, high or critical, low by default)
  - status (new, assigned, in progress, resolved or closed, new by default)
  - resolved at (a date and time)
  Each ticket can have an assignee (a user).
  Each ticket can have a created by (a user).
  The assignee owns the ticket.
  Only itStaff users and admins can add tickets.
  Only the owner and admins can change tickets.
  Only itStaff users and admins can delete tickets.

Assign
  For a ticket that is new or assigned; sets status to assigned and assignee to whoever presses it.
  Assign the ticket to yourself.

Start progress
  For a ticket that is assigned or in progress; sets status to in progress.
  Mark the ticket as in progress.

Resolve
  For a ticket that is in progress; sets status to resolved and resolved at to now.
  Mark the ticket as resolved.

Close
  For a ticket that is resolved; sets status to closed.
  Close the ticket.

Sign-in and access
  People sign in with a code sent to their email.
  Everyone who signs in sees all records, and changes and deletes the ones they own.
  Roles:
  - admin
  - itStaff (Handles and resolves IT support tickets)
  New users get the itStaff role.
No pictures: none of the library's files could be fetched.
Generated 96 files (96 changed, 0 removed).
No config path provided, using default 'drizzle.config.ts'
Reading config file '/tmp/smithable-bench-m12-xlFgtd/app-9/drizzle.config.ts'
7 tables
account 13 columns 1 indexes 1 fks
audit_log 13 columns 2 indexes 0 fks
invitation 7 columns 2 indexes 1 fks
session 8 columns 2 indexes 1 fks
tickets 10 columns 0 indexes 2 fks
user 8 columns 1 indexes 0 fks
verification 6 columns 1 indexes 0 fks

[✓] Your SQL migration file ➜ drizzle/0000_parched_timeslip.sql 🚀

Created /tmp/smithable-bench-m12-xlFgtd/app-9. Start it with:

  cd /tmp/smithable-bench-m12-xlFgtd/app-9
  smithable run
```

### 10. A recipe collection for a family, with ingredients and shopping lists.

```text
Family Recipes
  A place to keep our family's recipes and shopping lists.

Pages
  - Family Recipes (a landing page: hero, recipes where is favorite is yes and footer)
  - Recipes (lists recipes; search by recipe name, description or ingredients; filter by category or difficulty; sort by recipe name, added on, preparation time (minutes) or cooking time (minutes); records can be saved as favorites)
  - Shopping Lists (lists shopping lists)

Recipes
  Recipes have:
  - a recipe name (required)
  - a description
  - servings (a whole number, 4 by default)
  - a preparation time (minutes) (a whole number)
  - a cooking time (minutes) (a whole number)
  - a difficulty (easy, medium or hard, easy by default)
  - a category (breakfast, lunch, dinner, dessert, snack or drink, breakfast by default)
  - ingredients (required)
  - instructions (required)
  - notes
  - added on (a date, required, today by default)
  - a favorite (yes or no, false by default)
  - an image URL (a web address)

Shopping lists
  Shopping lists have:
  - a name (required, Weekly Shopping by default)
  - items (required)
  - a completed (yes or no, false by default)

Ingredients
  Ingredients have:
  - a name (required)
  - a quantity (a number)
  - a unit
  - a recipe (a recipe, required)
  - an is purchased (yes or no, false by default)

Sign-in and access
  People sign in with a code sent to their email.
  Everyone sees and changes only their own records.
  Roles:
  - admin
  - member
  New users get the member role.
  Open to anyone without signing in: the home page, the recipes page and reading recipes.
Pictures from the Smithable image library: hero.webp.
Generated 90 files (90 changed, 0 removed).
No config path provided, using default 'drizzle.config.ts'
Reading config file '/tmp/smithable-bench-m12-xlFgtd/app-10/drizzle.config.ts'
9 tables
account 13 columns 1 indexes 1 fks
audit_log 13 columns 2 indexes 0 fks
ingredients 9 columns 0 indexes 2 fks
recipes 17 columns 0 indexes 1 fks
recipes_favorites 4 columns 1 indexes 2 fks
session 8 columns 2 indexes 1 fks
shopping_lists 7 columns 0 indexes 1 fks
user 8 columns 1 indexes 0 fks
verification 6 columns 1 indexes 0 fks

[✓] Your SQL migration file ➜ drizzle/0000_condemned_peter_quill.sql 🚀

Created /tmp/smithable-bench-m12-xlFgtd/app-10. Start it with:

  cd /tmp/smithable-bench-m12-xlFgtd/app-10
  smithable run
```

### 11. A status page for our API, with incidents and planned maintenance.

```text
API Status
  The current status of our API and any ongoing incidents or maintenance.

Pages
  - Home (a landing page: hero, components, incidents where status is investigating or identified or monitoring, incidents where status is resolved, maintenances and footer)
  - Incidents (lists incidents; “Identified”; “Monitoring”; “Resolve”)
  - Updates (lists incident updates)
  - Components (lists components; only for admins; visitors see components on the Home page)
  - Maintenance (lists maintenances)
  - Admin (every kind of record, to find, open, change and delete)
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
  Only admins can change incidents.

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
  For an incident that is investigating; sets status to identified; adds an incident update (at now, status identified, message The cause is found and a fix is being worked on.).
  The cause is found; the incident moves to identified, with an update saying so.
  Only admins can use it.

Monitoring
  For an incident that is investigating or identified; sets status to monitoring; adds an incident update (at now, status monitoring, message A fix is out. We are watching before we close this.).
  A fix is out; the incident is watched before it is closed, with an update saying so.
  Only admins can use it.

Resolve
  For an incident that is investigating, identified or monitoring; sets status to resolved and resolved at to now; adds an incident update (at now, status resolved, message This incident is resolved.).
  The incident is over, with an update saying so. The component's state stays what the team sets.
  Only admins can use it.

Sign-in and access
  People sign in with a code sent to their email.
  Everyone who signs in sees all records, and changes and deletes the ones they own.
  Roles:
  - admin (Runs the status page and the team)
  - staff (Writes incidents and their updates)
  New users get the staff role.
  Open to anyone without signing in: the home page, reading components, reading incidents where status is investigating or identified or monitoring or resolved, reading incident updates and reading maintenances.
  Other programs can read and change components and incidents with a key, and run resolve. AI assistants can use it too.
Pictures from the Smithable image library: hero.webp.
Generated 140 files (140 changed, 0 removed).
No config path provided, using default 'drizzle.config.ts'
Reading config file '/tmp/smithable-bench-m12-xlFgtd/app-11/drizzle.config.ts'
11 tables
account 13 columns 1 indexes 1 fks
api_key 10 columns 1 indexes 0 fks
audit_log 13 columns 2 indexes 0 fks
components 7 columns 0 indexes 1 fks
incident_updates 8 columns 0 indexes 2 fks
incidents 10 columns 0 indexes 2 fks
invitation 7 columns 2 indexes 1 fks
maintenances 9 columns 0 indexes 2 fks
session 8 columns 2 indexes 1 fks
user 8 columns 1 indexes 0 fks
verification 6 columns 1 indexes 0 fks

[✓] Your SQL migration file ➜ drizzle/0000_chunky_zuras.sql 🚀

Created /tmp/smithable-bench-m12-xlFgtd/app-11. Start it with:

  cd /tmp/smithable-bench-m12-xlFgtd/app-11
  smithable run
```

### 12. A public uptime page for a web shop: which services work, outages and their updates.

```text
Shop Status
  The state of our web shop's services, live.

Pages
  - Is our web shop working? (a landing page: hero, services, incidents where status is investigating or identified or monitoring, incidents where status is resolved, maintenances and footer)
  - Incidents (lists incidents; “Identified”; “Monitoring”; “Resolve”)
  - Updates (lists incident updates)
  - Components (lists services)
  - Maintenance (lists maintenances)
  - Team (who has access: invite people, change roles, remove users)
  - Incident history (a page of your own (IncidentHistory), written in code)

Services
  Services have:
  - a name (required)
  - status (operational, degraded, down or maintenance, operational by default)
  - a description
  Each service lists its incidents.

Incidents
  Incidents have:
  - a title (required)
  - status (investigating, identified, monitoring or resolved, investigating by default)
  - a service (a service)
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
  - a component (a service)
  - starts at (a date and time, required)
  - ends at (a date and time, required)
  - a description

Identified
  For an incident that is investigating; sets status to identified; adds an incident update (at now, status identified, message The cause is found and a fix is being worked on.).
  The cause is found; the incident moves to identified, with an update saying so.
  Only staff users and admins can use it.

Monitoring
  For an incident that is investigating or identified; sets status to monitoring; adds an incident update (at now, status monitoring, message A fix is out. We are watching before we close this.).
  A fix is out; the incident is watched before it is closed, with an update saying so.
  Only staff users and admins can use it.

Resolve
  For an incident that is investigating, identified or monitoring; sets status to resolved and resolved at to now; adds an incident update (at now, status resolved, message This incident is resolved.).
  The incident is over, with an update saying so. The component's state stays what the team sets.
  Only staff users and admins can use it.

Sign-in and access
  People sign in with a code sent to their email.
  Everyone who signs in sees all records, and changes and deletes the ones they own.
  Roles:
  - admin (Runs the status page and the team)
  - staff (Writes incidents and their updates)
  New users get the staff role.
  Open to anyone without signing in: the home page, reading components, reading incidents where status is investigating or identified or monitoring or resolved, reading incident updates and reading maintenances.
No pictures: none of the library's files could be fetched.
Generated 109 files (109 changed, 0 removed).
No config path provided, using default 'drizzle.config.ts'
Reading config file '/tmp/smithable-bench-m12-xlFgtd/app-12/drizzle.config.ts'
10 tables
account 13 columns 1 indexes 1 fks
audit_log 13 columns 2 indexes 0 fks
components 7 columns 0 indexes 1 fks
incident_updates 8 columns 0 indexes 2 fks
incidents 10 columns 0 indexes 2 fks
invitation 7 columns 2 indexes 1 fks
maintenances 9 columns 0 indexes 2 fks
session 8 columns 2 indexes 1 fks
user 8 columns 1 indexes 0 fks
verification 6 columns 1 indexes 0 fks

[✓] Your SQL migration file ➜ drizzle/0000_thin_the_spike.sql 🚀

Created /tmp/smithable-bench-m12-xlFgtd/app-12. Start it with:

  cd /tmp/smithable-bench-m12-xlFgtd/app-12
  smithable run
```
