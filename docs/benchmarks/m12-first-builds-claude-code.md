# M12 first builds: claude-code (2026-10-29)

The app descriptions, each started with `smithable new --describe … --yes` (the starter the first step picks, adapted by the model; errors go back up to four times). Totals: 12 / 12 created, 12 type-check, 654,623 tokens (621,759 in, 32,864 out), €0.0000 + $1.3691 (as Claude Code reports it); 0 model calls answered from the response cache. *Rounds* counts the model's drafting calls: the first draft and each round of corrections after it.

| Description | Starter | Created | Type-checks | Tokens in | Tokens out | Cost | Cached calls | Rounds | Time |
|---|---|---|---|---|---|---|---|---|---|
| A booking site for a yoga studio, with classes, teachers and online booking. | booking | yes | yes | 52,900 | 3,597 | $0.4951 | 0 | 2 | 62 s |
| A CRM for a small sales team: companies, contacts, deals and follow-ups. | ? | yes | yes | 0 | 0 | €0.0000 | 0 | 0 | 7 s |
| Invoicing for freelancers, with clients, invoices and payments. | invoicing | yes | yes | 105,639 | 5,649 | $0.1831 | 0 | 3 | 87 s |
| A tool library where neighbors lend each other tools. | marketplace | yes | yes | 51,074 | 2,623 | $0.0736 | 0 | 2 | 53 s |
| An inventory app for a small bakery: ingredients, suppliers and stock levels. | records | yes | yes | 50,868 | 1,757 | $0.0546 | 0 | 2 | 40 s |
| A job board for a local union, with job posts and applications. | marketplace | yes | yes | 51,075 | 3,664 | $0.0944 | 0 | 2 | 62 s |
| A football club's site: teams, players, matches and results. | records | yes | yes | 50,857 | 2,255 | $0.0645 | 0 | 2 | 52 s |
| Event registration for a conference: talks, speakers and attendees. | booking | yes | yes | 52,896 | 2,772 | $0.0911 | 0 | 2 | 50 s |
| A help desk for an IT team: tickets, priorities and who handles them. | support | yes | yes | 51,568 | 2,213 | $0.0693 | 0 | 2 | 44 s |
| A recipe collection for a family, with ingredients and shopping lists. | records | yes | yes | 50,864 | 2,051 | $0.0605 | 0 | 2 | 48 s |
| A status page for our API, with incidents and planned maintenance. | status | yes | yes | 52,008 | 3,060 | $0.0898 | 0 | 2 | 54 s |
| A public uptime page for a web shop: which services work, outages and their updates. | status | yes | yes | 52,010 | 3,223 | $0.0931 | 0 | 2 | 51 s |

Each created app's four spec files are in [m12-first-builds-claude-code/](m12-first-builds-claude-code/), one folder per description (app-1 …).

<!-- scorecard -->
## Scorecard (scripts/bench-m12.mjs --score)

0 of 12 drafts end with a warning about what is public (*Public flaws left*: public-personal-data, public-page-closed-records, contact-form-closed, shortcut-closed, mine-public, visitors-read-drafts); since #266 a draft with one goes back to the model once to fix it. *API app*, for the second set's two descriptions of apps for programs and assistants: "yes" when the draft has no landing page, an `api` block, tools when the description names an assistant, and a role other than admin for keys; otherwise what it lacks.

| # | Starter | Questions | Models kept | Pages kept | Actions kept | Access; roles (default) | Pages with access | Public | Warnings | Public flaws left | API app | Starter's texts in the draft | Models with the starter's samples | Visitors / landing |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | booking | 3 | 5 / 6 (has 5) | 9 / 12 (has 9) | 0 / 1 (has 0) | private; admin, member (member) | none | pages home, schedule, privacy; read ClassType, Instructor, Session; create Message | 1 (operator-unknown) | none |  | none | 3 / 5 | mentions visitors; landing page |
| 2 | ? (words: crm) | 0 | 0 / 0 (has 6) | 0 / 0 (has 5) | 0 / 0 (has 1) | shared; admin, sales (sales) | none | pages none; read none; create none | 0 | none |  | none | 0 / 6 | no mention; no landing page |
| 3 | invoicing | 2 | 4 / 4 (has 5) | 5 / 7 (has 7) | 3 / 3 (has 3) | private; admin, member (member) | none | pages home, privacy; read none; create none | 1 (operator-unknown) | none |  | none | 3 / 5 | no mention; landing page |
| 4 | marketplace (words: records) | 3 | 0 / 1 (has 2) | 3 / 5 (has 7) | 0 / 0 (has 1) | private; admin, member (member) | none | pages home, tools; read Tool; create none | 1 (operator-unknown) | none |  | none | 0 / 2 | no mention; landing page |
| 5 | records (words: api) | 3 | 0 / 1 (has 2) | 0 / 2 (has 3) | 0 / 0 (has 0) | shared; admin, member (member) | none | pages none; read none; create none | 0 | none |  | none | 0 / 2 | no mention; no landing page |
| 6 | marketplace | 3 | 0 / 1 (has 2) | 1 / 5 (has 5) | 0 / 0 (has 5) | private; admin, staff, member (member) | none | pages home, jobs, privacy; read Job; create none | 1 (operator-unknown) | none |  | none | 0 / 2 | no mention; landing page |
| 7 | records (words: booking) | 3 | 0 / 1 (has 3) | 1 / 2 (has 5) | 0 / 0 (has 2) | private; admin, member (member) | none | pages home, matches, teams, players, privacy; read Team, Player, Match; create none | 1 (operator-unknown) | none |  | none | 0 / 3 | mentions visitors; landing page |
| 8 | booking (words: records) | 3 | 0 / 6 (has 3) | 4 / 12 (has 7) | 0 / 1 (has 0) | private; admin, member (member) | none | pages home, schedule, speakers, privacy; read Talk, Speaker; create none | 1 (operator-unknown) | none |  | none | 0 / 3 | no mention; landing page |
| 9 | support (words: booking) | 3 | 1 / 2 (has 2) | 1 / 2 (has 2) | 5 / 5 (has 5) | shared; admin, agent (agent) | none | pages none; read none; create none | 0 | none |  | none | 0 / 2 | no mention; no landing page |
| 10 | records | 3 | 0 / 1 (has 4) | 0 / 2 (has 3) | 0 / 0 (has 1) | shared; admin, member (member) | none | pages none; read none; create none | 0 | none |  | none | 0 / 4 | no mention; no landing page |
| 11 | status | 2 | 4 / 4 (has 4) | 7 / 8 (has 8) | 3 / 3 (has 3) | shared; admin, staff (staff) | none | pages home, privacy; read Component, Incident, IncidentUpdate, Maintenance; create none | 1 (operator-unknown) | none |  | none | 4 / 4 | no mention; landing page |
| 12 | status | 3 | 3 / 4 (has 3) | 6 / 8 (has 7) | 3 / 3 (has 3) | shared; admin, staff (staff) | none | pages home, privacy; read Component, Incident, IncidentUpdate; create none | 1 (operator-unknown) | none |  | Payments | 3 / 3 | mentions visitors; landing page |

"Kept" counts the starter's models, pages and actions that the draft still has by name, with how many the draft has in all; "left out" names what the draft dropped because it could not be made valid: an action by its name, anything else (a formula field, a capacity) with its operation. "Starter's texts" lists the starter's app name or sample titles found in the draft's spec or content. "Models with the starter's samples" counts the draft's models that keep some of the starter's sample records after `fitSamples`; the rest get generated rows. "Mentions visitors" means the description says visitors, public or site. "Starter" is the one `new --describe --yes` printed, with the word-match starter (`closestStarter`) beside it when it differs; "Questions" counts what `smithable clarify` would ask (`--yes` asks nothing), with their language for a description not in English.
<!-- /scorecard -->

## Summaries, for review

### 1. A booking site for a yoga studio, with classes, teachers and online booking.

```text
Lotus Room Yoga
  Class schedule, teachers and online booking for a yoga studio.

Pages
  - Home (a landing page: hero, class types, teachers, faq, call to action, contact and footer)
  - Schedule (a calendar of sessions by week or month)
  - My bookings (lists bookings)
  - Sessions (lists sessions; filter by class type, teacher or starts at; sort by starts at or capacity; only for admins)
  - Class types (lists class types; filter by level; only for admins; visitors see class types on the Home page)
  - Teachers (lists teachers; only for admins; visitors see teachers on the Home page)
  - Messages (lists messages; only for admins)
  - Privacy (a privacy page written from the app: who runs it, what it stores and why, cookies, mail, logs, your rights)
  - Admin (every kind of record, to find, open, change and delete; only for admins)

Class types
  Class types have:
  - a name (required)
  - a summary
  - a level (all levels, beginner or advanced, all levels by default)
  - duration minutes (a whole number, required, 60 by default)
  Each class type lists its sessions.

Teachers
  Teachers have:
  - a name (required)
  - a bio (formatted text)
  - a portrait (picture)
  Each teacher lists its sessions.

Sessions
  Sessions have:
  - a class type (a class type, required)
  - a teacher (a teacher, required)
  - starts at (a date and time, required)
  - a capacity (a whole number, required, 12 by default)
  Each session lists its bookings.
  The places left is calculated as the capacity minus the number of its bookings.
  A session is named after its class type and its starts at.

Bookings
  Bookings have:
  - a session (a session, required, unique)
  Each booking can have an attendee (a user).
  The attendee owns the booking.
  At most the session's capacity bookings per session.
  A booking is added until the session's starts at.
  Its owner deletes it until the session's starts at.
  A booking is named after its session.

Messages
  Messages have:
  - a name (required)
  - an email (required)
  - a message (required)

Sign-in and access
  People sign in with a code sent to their email.
  Everyone sees, changes and deletes only their own records.
  Roles:
  - admin: everything
  - member: opens the schedule page and the my bookings page; adds bookings
  New users get the member role.
  Open to anyone without signing in: the home page, the schedule page, the privacy page, reading class types, reading instructors, reading sessions and adding messages.
  Everyone who signs in can ask the app questions; it changes nothing. It answers plainly.

Assumed:
  Who may create an account and book? Anyone can sign up with their email address and book classes (or: Only people the studio invites, Only people with an address on certain email domains)
  What can visitors see without signing in? The home page, the class schedule, the class types and the teachers (or: Only the home page, Everything, including how many places each class has left, after signing in)
  How do visitors get in touch with the studio? A contact form on the home page; only the studio reads the messages (or: No contact form, only an email address in the footer, A separate contact page)
  Should members get emails about their bookings? No emails for now (or: A confirmation when a booking is made, A reminder the day before the class, A mail when the studio moves a class)
Frontier model (claude-opus-5-5) · 4,189 tokens (2,063 in, 2,126 out) · $0.0590
Pictures from the Smithable image library: samples/instructor-1.webp, hero.webp, logo.webp.
Generated 178 files (178 changed, 0 removed).

Created /tmp/smithable-bench-m12-Ey0M6C/app-1. Open it in Studio, to see it and change it:

  cd /tmp/smithable-bench-m12-Ey0M6C/app-1
  smithable studio

or only run the app with smithable run.
/tmp/smithable-bench-m12-Ey0M6C/app-1/smithable.content.yml:11:3  warning  The privacy page "privacy" does not say who runs the app: give the operator's name under pages.privacy.operator (name, address, email, country, hosting).
```

### 2. A CRM for a small sales team: companies, contacts, deals and follow-ups.

```text
addModel Company {"name":"string!","notes":"text"}
  addPage companies Company
  addModel Contact {"name":"string!","notes":"text"}
  addPage contacts Contact
  addModel Deal {"name":"string!","notes":"text"}
  addPage deals Deal
  addModel FollowUp {"name":"string!","notes":"text"}
  addPage follow-ups FollowUp
  removePage customers
  removePage orders
Added companies with a name and notes: say what else they hold.
Added contacts with a name and notes: say what else they hold.
Added deals with a name and notes: say what else they hold.
Added follow-ups with a name and notes: say what else they hold.
The starter let only acme.example addresses sign in (a sample domain no one has); that limit is gone.
Generated 151 files (150 changed, 0 removed).

Created /tmp/smithable-bench-m12-Ey0M6C/app-2. Open it in Studio, to see it and change it:

  cd /tmp/smithable-bench-m12-Ey0M6C/app-2
  smithable studio

or only run the app with smithable run.
```

### 3. Invoicing for freelancers, with clients, invoices and payments.

```text
Paidup
  Invoicing for freelancers: keep your clients, send invoices and record the payments that come in.

Pages
  - Home (a landing page: hero, features, faq, call to action and footer)
  - Clients (lists clients; search by name or email)
  - Settings (lists business profiles)
  - Privacy (a privacy page written from the app: who runs it, what it stores and why, cookies, mail, logs, your rights)
  - Overview (a dashboard: outstanding, overdue, received, invoiced and latest)
  - Invoices (lists invoices; filter by client, status or issued on; “Mark sent”; “Mark paid”; “Mark overdue”)
  - Payments (lists payments; filter by invoice, method or paid on)

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

Invoice lines
  Invoice lines have:
  - a description (required)
  - a quantity (a number, required, 1 by default)
  - a unit price (an amount, required)
  - an invoice (an invoice, required)
  The amount is calculated as the quantity times the unit price.

Invoices
  Invoices have:
  - a number (required, unique)
  - a client (a client, required)
  - issued on (a date, required, today by default)
  - due on (a date, required)
  - status (draft, sent, paid or overdue, draft by default)
  - a contract (a document)
  Each invoice lists its invoice lines.
  Each invoice lists its payments.
  The total is calculated as the total amount of its lines.
  The paid is calculated as the total amount of its payments.
  The balance is calculated as the total minus the paid.
  A invoice is named after its number and its client.

Payments
  Payments have:
  - an invoice (an invoice, required)
  - an amount (an amount, required)
  - paid on (a date, required, today by default)
  - a method (bank transfer, card, cash or other, bank transfer by default)
  - a reference

Mark sent
  For an invoice that is draft; sets status to sent.
  The invoice went to the client.

Mark paid
  For an invoice that is sent or overdue; sets status to paid; asks for the payment's amount and the payment's method; adds a payment (paid on today).
  The client paid the invoice; the payment is recorded with it.

Mark overdue
  For an invoice that is sent; sets status to overdue.
  The invoice is late.

Invoice sent
  When “Mark sent” runs on a invoice: mails client's email.

Mark overdue
  7 days after an invoice's due on, where status is sent: runs “Mark overdue”.

Sign-in and access
  People sign in with a code sent to their email.
  Everyone sees, changes and deletes only their own records.
  Roles:
  - admin: everything
  - member: opens every page; adds every kind of record
  New users get the member role.
  Open to anyone without signing in: the home page and the privacy page.
  Everyone who signs in can ask the app questions; it changes nothing. It answers plainly.
Frontier model (claude-opus-5-5) · 5,906 tokens (2,502 in, 3,404 out) · $0.0881
Pictures from the Smithable image library: hero.webp, logo.webp.
Generated 168 files (168 changed, 0 removed).

Created /tmp/smithable-bench-m12-Ey0M6C/app-3. Open it in Studio, to see it and change it:

  cd /tmp/smithable-bench-m12-Ey0M6C/app-3
  smithable studio

or only run the app with smithable run.
/tmp/smithable-bench-m12-Ey0M6C/app-3/smithable.content.yml:3:3  warning  The privacy page "privacy" does not say who runs the app: give the operator's name under pages.privacy.operator (name, address, email, country, hosting).
```

### 4. A tool library where neighbors lend each other tools.

```text
Toolshed Commons
  Neighbors list the tools they own and lend them to each other.

Pages
  - Tools (lists tools; search by title, description or place; filter by category, condition or available; records can be saved as favorites; contact the owner by mail)
  - My tools (lists tools; only the viewer's own records)
  - Loans (lists loans; filter by status, tool or due on; only the viewer's own records; “Mark returned”)
  - Saved (lists tools; only the viewer's saved records)
  - Review (the pictures and files waiting for review, to approve or reject; only for admins)
  - Home (a landing page: hero, features, faq and footer)
  - Privacy (a privacy page written from the app: who runs it, what it stores and why, cookies, mail, logs, your rights)

Tools
  Tools have:
  - a title (required)
  - photos (pictures, required)
  - a description (required)
  - a category (power, garden, hand, ladders, cleaning or other, power by default)
  - a condition (like new, good or worn, like new by default)
  - a place
  - available (yes or no, true by default)
  Photos of tools are reviewed before others see them; a tool waits until its photos are.

Loans
  Loans have:
  - a tool (a tool, required)
  - a borrower (required)
  - borrowed on (a date, required)
  - due on (a date)
  - status (out or returned, out by default)
  - a note

Mark returned
  For a loan that is out; sets status to returned.
  Record that the borrowed tool has come back.

Sign-in and access
  People sign in with a code sent to their email.
  Everyone sees, changes and deletes only their own records.
  Roles:
  - admin: everything
  - member: opens every page; adds every kind of record
  New users get the member role.
  Open to anyone without signing in: the home page, the tools page and reading tools.
  Everyone who signs in can ask the app questions; it changes nothing. It answers plainly.

Assumed:
  How does a neighbor borrow a tool? They message the owner from the tool's page, and the owner writes the loan down in their own list (or: Borrowers send a loan request that the owner approves in the app, Tools are picked up from a shared shed run by volunteers)
  What can people see without signing in? The welcome page and the tool catalog, but not who owns a tool or any loans (or: Nothing; everything needs sign-in, Only the welcome page)
  Who can join? Anyone who signs in with their email can list and borrow tools; admins check photos (or: Only neighbors who were invited, Only addresses from one email domain)
  What does a tool listing hold? Name, photos, description, category, condition, pickup place and whether it can be borrowed now (or: Also a deposit or rental fee, Also a maximum loan length)
Frontier model (claude-opus-5-5) · 3,775 tokens (1,869 in, 1,906 out) · $0.0531
Pictures from the Smithable image library: samples/tool-1.webp, samples/tool-2.webp, samples/tool-3.webp, samples/tool-4.webp, samples/tool-5.webp, samples/tool-6.webp, hero.webp, logo.webp.
Generated 148 files (148 changed, 0 removed).

Created /tmp/smithable-bench-m12-Ey0M6C/app-4. Open it in Studio, to see it and change it:

  cd /tmp/smithable-bench-m12-Ey0M6C/app-4
  smithable studio

or only run the app with smithable run.
/tmp/smithable-bench-m12-Ey0M6C/app-4/smithable.content.yml:3:3  warning  The privacy page "privacy" does not say who runs the app: give the operator's name under pages.privacy.operator (name, address, email, country, hosting).
```

### 5. An inventory app for a small bakery: ingredients, suppliers and stock levels.

```text
Bakery Stock
  Keeps track of the bakery's ingredients, their suppliers and how much of each is in stock.

Pages
  - Ingredients (lists ingredients; search by name or notes; filter by category or supplier)
  - Suppliers (lists suppliers; search by name, contact name or email)
  - Team (who has access: invite people, change roles, remove users; only for admins)

Suppliers
  Suppliers have:
  - a name (required)
  - a contact name
  - an email
  - a phone
  - a website (a web address)
  - notes
  Each supplier lists its ingredients.

Ingredients
  Ingredients have:
  - a name (required)
  - a category (flour, dairy, sugar, fats, eggs, flavorings, packaging or other, flour by default)
  - a unit (kg, g, l, ml or pieces, kg by default)
  - an in stock (a number, required, 0 by default)
  - reorder at (a number)
  - a cost per unit (an amount)
  - a supplier (a supplier)
  - a last counted (a date, today by default)
  - notes

Sign-in and access
  People sign in with a code sent to their email.
  Everyone who signs in sees all records, and changes and deletes the ones they own.
  Roles:
  - admin: everything
  - member: opens every page; adds every kind of record
  New users get the member role.
  Everyone who signs in can ask the app questions; it changes nothing. It answers plainly.

Assumed:
  Who uses the app? The bakery's staff, invited by an admin, all seeing and updating the same stock (or: Each person keeps their own stock list, Anyone can sign up)
  How are stock levels kept? A current amount on each ingredient, with a reorder level and the date it was last counted (or: A log of deliveries and usage that adds up to the stock, Regular stock counts kept as their own records)
  Which currency are ingredient costs in? Euro (EUR) (or: Swedish krona (SEK), US dollar (USD), Pound sterling (GBP))
  Is any of it public? No, everything needs sign-in (or: A public page listing the bakery's suppliers)
Frontier model (claude-opus-5-5) · 3,715 tokens (1,963 in, 1,752 out) · $0.0507
Pictures from the Smithable image library: logo.webp.
Generated 126 files (126 changed, 0 removed).

Created /tmp/smithable-bench-m12-Ey0M6C/app-5. Open it in Studio, to see it and change it:

  cd /tmp/smithable-bench-m12-Ey0M6C/app-5
  smithable studio

or only run the app with smithable run.
```

### 6. A job board for a local union, with job posts and applications.

```text
Union Jobs
  The local union's job board: staff post openings and members apply.

Pages
  - Home (a landing page: hero, jobs where status is open, features, faq and footer)
  - Jobs (lists jobs; search by title, employer, description or location; filter by trade, type, status or closes; “Mark filled”; “Close job”)
  - Applications (lists applications; filter by job or status; “Shortlist”; “Hire”; “Decline”)
  - Privacy (a privacy page written from the app: who runs it, what it stores and why, cookies, mail, logs, your rights)
  - Team (who has access: invite people, change roles, remove users; only for admins)

Jobs
  Jobs have:
  - a title (required)
  - an employer (required)
  - a description (required)
  - a location
  - a trade (electrical, plumbing, carpentry, construction, general or other, electrical by default)
  - a type (full time, part time, temporary or apprenticeship, full time by default)
  - a pay
  - closes (a date)
  - status (open, filled or closed, open by default)
  Each job lists its applications.

Applications
  Applications have:
  - a job (a job, required, unique)
  - a phone
  - a cover letter
  - a resume (a document)
  - status (submitted, shortlisted, hired or declined, submitted by default, filled by the app)

Mark filled
  For a job that is open; sets status to filled.

Close job
  For a job that is open; sets status to closed.

Shortlist
  For an application that is submitted; sets status to shortlisted.

Hire
  For an application that is submitted or shortlisted; sets status to hired.

Decline
  For an application that is submitted or shortlisted; sets status to declined.

Sign-in and access
  People sign in with a code sent to their email.
  Everyone sees, changes and deletes only their own records.
  Roles:
  - admin: everything
  - staff (Union staff who post jobs and review applications): opens every page; sees everyone's records; adds jobs; changes everyone's records; deletes everyone's jobs
  - member (Union members who browse jobs and apply): opens the jobs page and the applications page; sees everyone's jobs; adds applications
  New users get the member role.
  Open to anyone without signing in: the home page, the jobs page, the privacy page and reading jobs where status is open.
  Everyone who signs in can ask the app questions; it changes nothing. It answers plainly.

Assumed:
  Who posts jobs? Union staff post and manage jobs; members only apply (or: Employers sign in and post their own jobs, Any member may post a job)
  What can people see without signing in? Open jobs are public; applying needs sign-in (or: Everything needs sign-in, members only, Visitors can apply without an account)
  Who may sign in to apply? Anyone may sign up as a member (or: Only members invited by union staff, Only addresses on the union's email domain)
  What does an application hold? The job, a phone number, a cover letter and a resume file, with a status staff move along (or: Just a short message, Also union card number and trade certifications)
Frontier model (claude-opus-5-5) · 4,016 tokens (1,909 in, 2,107 out) · $0.0574
Pictures from the Smithable image library: hero.webp, logo.webp.
Generated 148 files (148 changed, 0 removed).

Created /tmp/smithable-bench-m12-Ey0M6C/app-6. Open it in Studio, to see it and change it:

  cd /tmp/smithable-bench-m12-Ey0M6C/app-6
  smithable studio

or only run the app with smithable run.
/tmp/smithable-bench-m12-Ey0M6C/app-6/smithable.content.yml:3:3  warning  The privacy page "privacy" does not say who runs the app: give the operator's name under pages.privacy.operator (name, address, email, country, hosting).
```

### 7. A football club's site: teams, players, matches and results.

```text
Club Football
  The club's public site with its teams, players, fixtures and results.

Pages
  - Home (a landing page: hero, matches where status is scheduled, matches where status is played, teams and footer)
  - Matches (lists matches; search by opponent or competition; filter by team, status, venue or kickoff; “Record result”; “Postpone”)
  - Teams (lists teams)
  - Players (lists players; search by name; filter by team or position)
  - Privacy (a privacy page written from the app: who runs it, what it stores and why, cookies, mail, logs, your rights)

Teams
  Teams have:
  - a name (required)
  - an age group
  - a coach
  - about
  - a photo (picture)
  Each team lists its players.
  Each team lists its matches.

Players
  Players have:
  - a name (required)
  - a team (a team, required)
  - a position (goalkeeper, defender, midfielder or forward, goalkeeper by default)
  - a shirt number (a whole number)
  - a photo (picture)
  - a bio

Matches
  Matches have:
  - a team (a team, required)
  - an opponent (required)
  - a kickoff (a date and time, required)
  - a venue (home, away or neutral, home by default)
  - a location
  - a competition
  - status (scheduled, played, postponed or cancelled, scheduled by default)
  - a goals for (a whole number)
  - a goals against (a whole number)
  - a report
  A match is named after its team, its opponent and its kickoff.

Record result
  For a match that is scheduled or postponed; sets status to played; asks for the goals for and the goals against.
  Enter the final score of a match and mark it played.

Postpone
  For a match that is scheduled; sets status to postponed.
  Mark a match as postponed.

Sign-in and access
  People sign in with a code sent to their email.
  Everyone sees, changes and deletes only their own records.
  Roles:
  - admin: everything
  - member: opens every page; adds every kind of record
  New users get the member role.
  Open to anyone without signing in: the home page, the matches page, the teams page, the players page, the privacy page, reading teams, reading players and reading matches.
  Everyone who signs in can ask the app questions; it changes nothing. It answers plainly.
Frontier model (claude-opus-5-5) · 4,263 tokens (2,104 in, 2,159 out) · $0.0600
Pictures from the Smithable image library: samples/team-1.webp, samples/team-2.webp, samples/team-3.webp, samples/player-1.webp, hero.webp, logo.webp.
Generated 145 files (145 changed, 0 removed).

Created /tmp/smithable-bench-m12-Ey0M6C/app-7. Open it in Studio, to see it and change it:

  cd /tmp/smithable-bench-m12-Ey0M6C/app-7
  smithable studio

or only run the app with smithable run.
/tmp/smithable-bench-m12-Ey0M6C/app-7/smithable.content.yml:3:3  warning  The privacy page "privacy" does not say who runs the app: give the operator's name under pages.privacy.operator (name, address, email, country, hosting).
```

### 8. Event registration for a conference: talks, speakers and attendees.

```text
Confhub
  Programme and registration for a conference: browse the talks and speakers, and sign up for the talks you want to attend.

Pages
  - Home (a landing page: hero, talks, speakers, faq, call to action and footer)
  - Schedule (a calendar of talks by week or month)
  - My registrations (lists registrations)
  - Talks (lists talks; filter by speaker, track or starts at; only for admins; visitors see talks on the Home page)
  - Speakers (lists speakers)
  - Privacy (a privacy page written from the app: who runs it, what it stores and why, cookies, mail, logs, your rights)
  - Admin (every kind of record, to find, open, change and delete; only for admins)

Speakers
  Speakers have:
  - a name (required)
  - a title
  - a company
  - a bio (formatted text)
  - a portrait (picture)
  Each speaker lists its talks.

Talks
  Talks have:
  - a title (required)
  - an abstract
  - a speaker (a speaker, required)
  - starts at (a date and time, required)
  - duration minutes (a whole number, required, 45 by default)
  - a room
  - a track (keynote, technical, business or workshop, keynote by default)
  - a capacity (a whole number, required, 100 by default)
  Each talk lists its registrations.
  The places left is calculated as the capacity minus the number of its registrations.

Registrations
  Registrations have:
  - a talk (a talk, required, unique)
  Each registration can have an attendee (a user).
  The attendee owns the registration.
  At most the talk's capacity registrations per talk.
  A registration is added until the talk's starts at.
  Its owner deletes it until the talk's starts at.
  A registration is named after its talk.

Sign-in and access
  People sign in with a code sent to their email.
  Everyone sees, changes and deletes only their own records.
  Roles:
  - admin: everything
  - member (An attendee who registers for talks): opens the my registrations page, the schedule page and the speakers page; adds registrations
  New users get the member role.
  Open to anyone without signing in: the home page, the schedule page, the speakers page, the privacy page, reading talks and reading speakers.
  Everyone who signs in can ask the app questions; it changes nothing. It answers plainly.

Assumed:
  What does an attendee register for? Each talk separately, with a limited number of places per talk (or: One registration for the whole conference, A ticket type (day pass, full pass) for the conference)
  What can visitors see without signing in? The programme, the schedule and the speakers (or: Only the landing page, Nothing; everything needs sign-in)
  Who manages talks and speakers? The organizers, as administrators; attendees only register (or: A separate organizer role besides admins, Speakers manage their own talks)
  Are attendees told about their registrations by mail? No mails in the first version (or: A confirmation when they register, A reminder the day before the talk)
Frontier model (claude-opus-5-5) · 3,617 tokens (1,843 in, 1,774 out) · $0.0502
Pictures from the Smithable image library: samples/speaker-1.webp, hero.webp, logo.webp.
Generated 160 files (160 changed, 0 removed).

Created /tmp/smithable-bench-m12-Ey0M6C/app-8. Open it in Studio, to see it and change it:

  cd /tmp/smithable-bench-m12-Ey0M6C/app-8
  smithable studio

or only run the app with smithable run.
/tmp/smithable-bench-m12-Ey0M6C/app-8/smithable.content.yml:3:3  warning  The privacy page "privacy" does not say who runs the app: give the operator's name under pages.privacy.operator (name, address, email, country, hosting).
```

### 9. A help desk for an IT team: tickets, priorities and who handles them.

```text
IT Help Desk
  The IT team's tickets: what is wrong, how urgent it is and who is handling it.

Pages
  - Tickets (lists tickets; search by subject or requester email; filter by status, priority or assignee; sort by priority or date added; “Assign to me”; “Assign to”; “Start work”; “Close”; “Reopen”)
  - Team (who has access: invite people, change roles, remove users; only for admins)

Tickets
  Tickets have:
  - a subject (required)
  - a requester email (required)
  - status (open, in progress, closed or reopened, open by default)
  - a priority (a whole number, required, 3 by default)
  - a body
  - attachments (documents)
  Each ticket can have an assignee (a user, required when status is in progress or closed).
  Each ticket lists its messages.

Messages
  Messages have:
  - a content (required)
  - attachments (documents)
  - a ticket (a ticket, required)
  Each message can have an agent (a user, who makes it, by default, filled by the app).

Assign to me
  Sets assignee to whoever presses it.
  Take the ticket: you become its assignee.

Assign to
  Asks for the assignee.
  Give the ticket to someone on the team.

Start work
  For a ticket that is open or reopened; sets status to in progress.
  Someone is working on the ticket now; it needs an assignee.

Close
  For a ticket that is open, in progress or reopened; sets status to closed.
  The problem is solved.

Reopen
  For a ticket that is closed; sets status to reopened.
  The ticket needs more work after all.

Sign-in and access
  People sign in with a code sent to their email.
  Everyone who signs in sees all records, and changes and deletes the ones they own.
  Roles:
  - admin: everything
  - agent (Works the tickets: takes them, passes them on and closes them): opens the tickets page; adds every kind of record; changes everyone's records; runs every custom action
  New users get the agent role.
  Everyone who signs in can ask the app questions; it changes nothing. It answers plainly.

Assumed:
  Who uses the app? Only the IT team signs in; they log tickets for colleagues and record the requester's email. (or: Colleagues sign in and file their own tickets, Tickets come in by mail to a support address)
  How is a ticket's priority expressed? A number from 1 to 5, 3 by default. (or: Low, normal, high, urgent, Priority worked out from impact and urgency)
  Where does the team keep notes on a ticket? A conversation of notes under each ticket, written by the team. (or: A single notes field on the ticket, No notes)
  What may team members do? Every agent sees, changes, assigns and closes any ticket; admins also manage the team. (or: Agents change only tickets assigned to them, A team lead role that assigns tickets)
Frontier model (claude-opus-5-5) · 3,208 tokens (1,717 in, 1,491 out) · $0.0435
Pictures from the Smithable image library: logo.webp.
Generated 142 files (142 changed, 0 removed).

Created /tmp/smithable-bench-m12-Ey0M6C/app-9. Open it in Studio, to see it and change it:

  cd /tmp/smithable-bench-m12-Ey0M6C/app-9
  smithable studio

or only run the app with smithable run.
```

### 10. A recipe collection for a family, with ingredients and shopping lists.

```text
Family Cookbook
  The family's recipes with their ingredients, and the shopping lists for cooking them.

Pages
  - Recipes (lists recipes; search by name or summary; filter by category or favorite)
  - Shopping lists (lists shopping lists; filter by status or shop on; “Finish shopping”)
  - Family (who has access: invite people, change roles, remove users)

Recipes
  Recipes have:
  - a name (required)
  - a summary
  - a category (main, starter, side, dessert, baking, breakfast or drink, main by default)
  - servings (a whole number, 4 by default)
  - minutes (a whole number)
  - a picture
  - instructions (formatted text)
  - a source (a web address)
  - favorite (yes or no)
  Each recipe lists its ingredients.

Ingredients
  Ingredients have:
  - a recipe (a recipe, required)
  - a name (required)
  - an amount
  - a note

Shopping lists
  Shopping lists have:
  - a name (required)
  - shop on (a date)
  - status (open or done, open by default)
  Each shopping list lists its shopping items.

Shopping items
  Shopping items have:
  - a list (a shopping list, required)
  - a name (required)
  - an amount
  - bought (yes or no)

Finish shopping
  For a shopping list that is open; sets status to done.
  Mark a shopping list as done once everything is bought.

Sign-in and access
  People sign in with a code sent to their email.
  Everyone who signs in sees all records, and changes and deletes the ones they own.
  Roles:
  - admin: everything
  - member: everything
  New users get the member role.
  Everyone who signs in can ask the app questions; it changes nothing. It answers plainly.

Assumed:
  Who can see and change the recipes? The whole invited family shares every recipe and shopping list, and anyone in it can change them (or: Each person keeps their own recipes, Only one person edits; the rest only look)
  Should the recipes be visible to people outside the family? No, everything is private to the signed-in family (or: Recipes are public on a small website, Only favourite recipes are public)
  How do shopping lists relate to recipes? Shopping lists are separate lists of items to buy, written by hand (or: Ingredients are added to a list from a recipe, One shopping list per week's meal plan)
  How are ingredient amounts written? As free text, like "200 g" or "2 cups" (or: A number and a separate unit, No amounts, names only)
Frontier model (claude-opus-5-5) · 4,673 tokens (2,195 in, 2,478 out) · $0.0671
Pictures from the Smithable image library: logo.webp.
Generated 143 files (143 changed, 0 removed).

Created /tmp/smithable-bench-m12-Ey0M6C/app-10. Open it in Studio, to see it and change it:

  cd /tmp/smithable-bench-m12-Ey0M6C/app-10
  smithable studio

or only run the app with smithable run.
```

### 11. A status page for our API, with incidents and planned maintenance.

```text
API Status
  Is the API working? Live status of our API, its incidents and planned maintenance.

Pages
  - Home (a landing page: hero, components, incidents where status is investigating or identified or monitoring, maintenances, incidents where status is resolved and footer)
  - Overview (a dashboard: open, per month and latest)
  - Incidents (lists incidents; filter by status)
  - Updates (lists incident updates)
  - Maintenance (lists maintenances)
  - Components (lists components; only for admins; visitors see components on the Home page)
  - Privacy (a privacy page written from the app: who runs it, what it stores and why, cookies, mail, logs, your rights)
  - Team (who has access: invite people, change roles, remove users; only for admins)

Components
  Components have:
  - a name (required)
  - status (operational, degraded, down or maintenance, operational by default)
  - a description
  Each component lists its incidents.
  Each component lists its maintenances.

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
  For an incident that is investigating; sets status to identified; adds an incident update (at now, status identified, message We have found the cause and are working on a fix.).
  The cause is found; the incident moves to identified, with an update saying so.

Monitoring
  For an incident that is investigating or identified; sets status to monitoring; adds an incident update (at now, status monitoring, message A fix has been deployed. We are watching the results before closing this incident.).
  A fix is out; the incident is watched before it is closed, with an update saying so.

Resolve
  For an incident that is investigating, identified or monitoring; sets status to resolved and resolved at to now; adds an incident update (at now, status resolved, message This incident has been resolved.).
  The incident is over, with an update saying so. The component's state stays what the team sets.

Sign-in and access
  People sign in with a code sent to their email.
  Everyone who signs in sees all records, and changes and deletes the ones they own.
  Roles:
  - admin: everything
  - staff (Writes incidents, their updates and planned maintenance): opens the overview page, the incidents page, the updates page and the maintenance page; adds every kind of record; changes everyone's records
  New users get the staff role.
  Open to anyone without signing in: the home page, the privacy page, reading components, reading incidents where status is investigating or identified or monitoring or resolved, reading incident updates and reading maintenances.
  Other programs can read and change components and incidents with a key, and run resolve. AI assistants can use it too.
  Everyone who signs in can ask the app questions; it changes nothing. It answers plainly.

Assumed:
  Which time zone should incident and maintenance times be shown in? UTC (or: Europe/Stockholm, America/New_York, The visitor's own time zone)
  Who writes incidents and maintenance notices? An invited team (staff), with administrators also managing components and the team (or: Administrators only, Anyone on the team can do everything)
  What can visitors see without signing in? The status page, component states, every incident with its updates, and planned maintenance (or: Only ongoing incidents and planned maintenance, The current component states only)
  Should visitors be able to subscribe to updates by email? No, not in the first version (or: Yes, email subscribers get told about new incidents, Yes, also about planned maintenance)
Frontier model (claude-opus-5-5) · 4,711 tokens (2,322 in, 2,389 out) · $0.0663
Pictures from the Smithable image library: hero.webp, logo.webp.
Generated 169 files (169 changed, 0 removed).

Created /tmp/smithable-bench-m12-Ey0M6C/app-11. Open it in Studio, to see it and change it:

  cd /tmp/smithable-bench-m12-Ey0M6C/app-11
  smithable studio

or only run the app with smithable run.
/tmp/smithable-bench-m12-Ey0M6C/app-11/smithable.content.yml:3:3  warning  The privacy page "privacy" does not say who runs the app: give the operator's name under pages.privacy.operator (name, address, email, country, hosting).
```

### 12. A public uptime page for a web shop: which services work, outages and their updates.

```text
Shop Status
  Is the shop working? The state of our checkout, payments and delivery services, live.

Pages
  - Home (a landing page: hero, components, incidents where status is investigating or identified or monitoring, incidents where status is resolved and footer)
  - Overview (a dashboard: open, per month and latest)
  - Incidents (lists incidents; filter by status or component)
  - Updates (lists incident updates)
  - Components (lists components; only for admins; visitors see components on the Home page)
  - Team (who has access: invite people, change roles, remove users; only for admins)
  - Privacy (a privacy page written from the app: who runs it, what it stores and why, cookies, mail, logs, your rights)

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

Identified
  For an incident that is investigating; sets status to identified; adds an incident update (at now, status identified, message We have found the cause and are working on a fix.).
  The cause is found; the incident moves to identified, with an update saying so.

Monitoring
  For an incident that is investigating or identified; sets status to monitoring; adds an incident update (at now, status monitoring, message A fix is live. We are keeping an eye on it before closing this.).
  A fix is out; the incident is watched before it is closed, with an update saying so.

Resolve
  For an incident that is investigating, identified or monitoring; sets status to resolved and resolved at to now; adds an incident update (at now, status resolved, message This outage is over and everything works again.).
  The incident is over, with an update saying so. The component's state stays what the team sets.

Sign-in and access
  People sign in with a code sent to their email.
  Everyone who signs in sees all records, and changes and deletes the ones they own.
  Roles:
  - admin: everything
  - staff (Writes outages and their updates): opens the overview page, the incidents page and the updates page; adds every kind of record; changes everyone's records
  New users get the staff role.
  Open to anyone without signing in: the home page, the privacy page, reading components, reading incidents where status is investigating or identified or monitoring or resolved and reading incident updates.
  Other programs can read and change components and incidents with a key, and run resolve. AI assistants can use it too.
  Everyone who signs in can ask the app questions; it changes nothing. It answers plainly.

Assumed:
  Should the status page also announce planned maintenance? No, only services, outages and their updates for now (or: Yes, with a list of planned maintenance windows, Yes, as a maintenance status on a service only)
  Who writes the outages and updates? An invited team of staff; administrators manage the services and the team (or: Only the administrators, Every invited member manages everything)
  What can visitors see without signing in? The services' status, ongoing and recent outages with their updates, and the outage history (or: Only the current status of the services, Everything, including a way to report a problem)
  What should the team see first after signing in? An overview with open outages, outages per month and the latest ones (or: The list of outages, The list of services)
Frontier model (claude-opus-5-5) · 3,906 tokens (2,065 in, 1,841 out) · $0.0533
Pictures from the Smithable image library: hero.webp, logo.webp.
Generated 163 files (163 changed, 0 removed).

Created /tmp/smithable-bench-m12-Ey0M6C/app-12. Open it in Studio, to see it and change it:

  cd /tmp/smithable-bench-m12-Ey0M6C/app-12
  smithable studio

or only run the app with smithable run.
/tmp/smithable-bench-m12-Ey0M6C/app-12/smithable.content.yml:3:3  warning  The privacy page "privacy" does not say who runs the app: give the operator's name under pages.privacy.operator (name, address, email, country, hosting).
```
