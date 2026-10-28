# M12 first builds: claude-code (2026-10-28)

The app descriptions, each started with `smithable new --describe … --yes` (the starter the first step picks, adapted by the model; errors go back up to four times). Totals: 12 / 12 created, 12 type-check, 635,604 tokens (605,912 in, 29,692 out), €0.0000 + $1.2879 (as Claude Code reports it); 0 model calls answered from the response cache. *Rounds* counts the model's drafting calls: the first draft and each round of corrections after it.

| Description | Starter | Created | Type-checks | Tokens in | Tokens out | Cost | Cached calls | Rounds | Time |
|---|---|---|---|---|---|---|---|---|---|
| A booking site for a yoga studio, with classes, teachers and online booking. | booking | yes | yes | 51,581 | 3,258 | $0.4778 | 0 | 2 | 590 s |
| A CRM for a small sales team: companies, contacts, deals and follow-ups. | ? | yes | yes | 0 | 0 | €0.0000 | 0 | 0 | 350 s |
| Invoicing for freelancers, with clients, invoices and payments. | invoicing | yes | yes | 102,613 | 4,466 | $0.1551 | 0 | 3 | 470 s |
| A tool library where neighbors lend each other tools. | marketplace | yes | yes | 49,801 | 2,331 | $0.0675 | 0 | 2 | 333 s |
| An inventory app for a small bakery: ingredients, suppliers and stock levels. | records | yes | yes | 49,596 | 1,413 | $0.0475 | 0 | 2 | 381 s |
| A job board for a local union, with job posts and applications. | marketplace | yes | yes | 49,800 | 3,260 | $0.0860 | 0 | 2 | 275 s |
| A football club's site: teams, players, matches and results. | records | yes | yes | 49,585 | 2,420 | $0.0675 | 0 | 2 | 182 s |
| Event registration for a conference: talks, speakers and attendees. | booking | yes | yes | 51,577 | 2,588 | $0.0868 | 0 | 2 | 153 s |
| A help desk for an IT team: tickets, priorities and who handles them. | support | yes | yes | 50,296 | 2,104 | $0.0669 | 0 | 2 | 132 s |
| A recipe collection for a family, with ingredients and shopping lists. | records | yes | yes | 49,591 | 1,547 | $0.0501 | 0 | 2 | 117 s |
| A status page for our API, with incidents and planned maintenance. | status | yes | yes | 50,734 | 3,326 | $0.0948 | 0 | 2 | 109 s |
| A public uptime page for a web shop: which services work, outages and their updates. | status | yes | yes | 50,738 | 2,979 | $0.0879 | 0 | 2 | 97 s |

Each created app's four spec files are in [m12-first-builds-claude-code/](m12-first-builds-claude-code/), one folder per description (app-1 …).

<!-- scorecard -->
## Scorecard (scripts/bench-m12.mjs --score)

0 of 12 drafts end with a warning about what is public (*Public flaws left*: public-personal-data, public-page-closed-records, contact-form-closed, shortcut-closed, mine-public, visitors-read-drafts); since #266 a draft with one goes back to the model once to fix it. *API app*, for the second set's two descriptions of apps for programs and assistants: "yes" when the draft has no landing page, an `api` block, tools when the description names an assistant, and a role other than admin for keys; otherwise what it lacks.

| # | Starter | Questions | Models kept | Pages kept | Actions kept | Access; roles (default) | Pages with access | Public | Warnings | Public flaws left | API app | Starter's texts in the draft | Models with the starter's samples | Visitors / landing |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | booking | 3 | 5 / 6 (has 5) | 8 / 12 (has 8) | 0 / 1 (has 0) | private; admin, member (member) | none | pages home, schedule, privacy; read ClassType, Instructor, Session; create Message | 2 (no-timezone, operator-unknown) | none |  | none | 3 / 5 | mentions visitors; landing page |
| 2 | ? (words: crm) | 0 | 0 / 0 (has 6) | 0 / 0 (has 5) | 0 / 0 (has 1) | shared; admin, sales (sales) | none | pages none; read none; create none | 0 | none |  | none | 0 / 6 | no mention; no landing page |
| 3 | invoicing | 2 | 3 / 4 (has 4) | 5 / 7 (has 7) | 3 / 3 (has 3) | private; admin, member (member) | none | pages home, privacy; read none; create none | 1 (operator-unknown) | none |  | none | 3 / 4 | no mention; landing page |
| 4 | marketplace (words: records) | 3 | 0 / 1 (has 1) | 4 / 5 (has 6) | 0 / 0 (has 0) | private; admin, member (member) | none | pages home, catalog, privacy; read Tool; create none | 1 (operator-unknown) | none |  | none | 0 / 1 | no mention; landing page |
| 5 | records (words: api) | 3 | 0 / 1 (has 2) | 0 / 2 (has 3) | 0 / 0 (has 0) | shared; admin, member (member) | none | pages none; read none; create none | 0 | none |  | none | 0 / 2 | no mention; no landing page |
| 6 | marketplace | 3 | 0 / 1 (has 2) | 1 / 5 (has 5) | 0 / 0 (has 5) | private; admin, staff, member (member) | none | pages home, jobs, privacy; read Job; create none | 1 (operator-unknown) | none |  | none | 0 / 2 | no mention; landing page |
| 7 | records (words: booking) | 3 | 0 / 1 (has 3) | 1 / 2 (has 5) | 0 / 0 (has 2) | private; admin, member (member) | none | pages home, matches, teams, players, privacy; read Team, Player, Match; create none | 1 (operator-unknown) | none |  | none | 0 / 3 | mentions visitors; landing page |
| 8 | booking (words: records) | 3 | 0 / 6 (has 3) | 3 / 12 (has 7) | 0 / 1 (has 0) | private; admin, member (member) | none | pages home, program, speakers, privacy; read Talk, Speaker; create none | 1 (operator-unknown) | none |  | none | 0 / 3 | no mention; landing page |
| 9 | support (words: booking) | 3 | 2 / 2 (has 2) | 1 / 2 (has 2) | 5 / 5 (has 5) | shared; admin, agent (agent) | none | pages none; read none; create none | 0 | none |  | none | 0 / 2 | no mention; no landing page |
| 10 | records | 3 | 0 / 1 (has 4) | 0 / 2 (has 3) | 0 / 0 (has 1) | shared; admin, member (member) | none | pages none; read none; create none | 0 | none |  | none | 0 / 4 | no mention; no landing page |
| 11 | status | 2 | 4 / 4 (has 4) | 7 / 8 (has 8) | 3 / 3 (has 3) | shared; admin, staff (staff) | none | pages home; read Component, Incident, IncidentUpdate, Maintenance; create none | 1 (operator-unknown) | none |  | none | 4 / 4 | no mention; landing page |
| 12 | status | 3 | 3 / 4 (has 3) | 6 / 8 (has 7) | 3 / 3 (has 3) | shared; admin, staff (staff) | none | pages home, privacy; read Component, Incident, IncidentUpdate; create none | 1 (operator-unknown) | none |  | none | 3 / 3 | mentions visitors; landing page |

"Kept" counts the starter's models, pages and actions that the draft still has by name, with how many the draft has in all; "left out" names what the draft dropped because it could not be made valid: an action by its name, anything else (a formula field, a capacity) with its operation. "Starter's texts" lists the starter's app name or sample titles found in the draft's spec or content. "Models with the starter's samples" counts the draft's models that keep some of the starter's sample records after `fitSamples`; the rest get generated rows. "Mentions visitors" means the description says visitors, public or site. "Starter" is the one `new --describe --yes` printed, with the word-match starter (`closestStarter`) beside it when it differs; "Questions" counts what `smithable clarify` would ask (`--yes` asks nothing), with their language for a description not in English.
<!-- /scorecard -->

## Summaries, for review

### 1. A booking site for a yoga studio, with classes, teachers and online booking.

```text
Lotus Room Yoga
  Class schedule, teachers and online booking for a yoga studio.

Pages
  - Home (a landing page: hero, class types, instructors, faq, call to action, contact and footer)
  - Schedule (a calendar of sessions by week or month)
  - My bookings (lists bookings)
  - Sessions (lists sessions; filter by class type, instructor or starts at; sort by starts at or capacity; only for admins)
  - Class types (lists class types; filter by level; only for admins; visitors see class types on the Home page)
  - Instructors (lists instructors; only for admins; visitors see instructors on the Home page)
  - Messages (lists messages; only for admins)
  - Privacy (a privacy page written from the app: who runs it, what it stores and why, cookies, mail, logs, your rights)

Class types
  Class types have:
  - a name (required)
  - a summary
  - a level (all levels, beginner or advanced, all levels by default)
  - duration minutes (a whole number, required, 60 by default)
  Each class type lists its sessions.

Instructors
  Instructors have:
  - a name (required)
  - a bio (formatted text)
  - a portrait (picture)
  Each instructor lists its sessions.

Sessions
  Sessions have:
  - a class type (a class type, required)
  - an instructor (an instructor, required)
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
  Its owner deletes it until 2 hours before the session's starts at.
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
  - admin (Studio staff. Manage the schedule, classes and teachers): everything
  - member (A student who books classes): opens the my bookings page; adds bookings
  New users get the member role.
  Open to anyone without signing in: the home page, the schedule page, the privacy page, reading class types, reading instructors, reading sessions and adding messages.
  Everyone who signs in can ask the app questions; it changes nothing. It answers plainly.

Assumed:
  What can visitors see without signing in? The home page, the class schedule, the class types and the teachers; signing in is only needed to book. (or: Everything needs sign-in, Only the home page is public)
  Until when can a member cancel a booking? Up to 2 hours before the class starts. (or: Up to 24 hours before, Until the class starts, Only staff can cancel)
  Should visitors be able to send the studio a question? Yes, through a contact form on the home page that only staff read. (or: No contact form, Show only an email address)
  Should the site also have a blog? No, just classes, teachers and booking for now. (or: Add a blog with news and articles)
Frontier model (claude-opus-5-5) · 4,249 tokens (2,052 in, 2,197 out) · $0.0603
Pictures from the Smithable image library: samples/instructor-1.webp, samples/instructor-2.webp, samples/instructor-3.webp, samples/instructor-4.webp, samples/instructor-5.webp, samples/instructor-6.webp, hero.webp, logo.webp.
Generated 153 files (153 changed, 0 removed).

Created /tmp/smithable-bench-m12-fONTiq/app-1. Open it in Studio, to see it and change it:

  cd /tmp/smithable-bench-m12-fONTiq/app-1
  smithable studio

or only run the app with smithable run.
/tmp/smithable-bench-m12-fONTiq/app-1/smithable.yml:49:14  warning  Page "schedule" is a calendar, but the app has no time zone: records are placed in UTC.
    hint: Set "timezone" under "app", e.g. "Europe/Mariehamn".
/tmp/smithable-bench-m12-fONTiq/app-1/smithable.content.yml:3:3  warning  The privacy page "privacy" does not say who runs the app: give the operator's name under pages.privacy.operator (name, address, email, country, hosting).
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
Generated 142 files (141 changed, 0 removed).

Created /tmp/smithable-bench-m12-fONTiq/app-2. Open it in Studio, to see it and change it:

  cd /tmp/smithable-bench-m12-fONTiq/app-2
  smithable studio

or only run the app with smithable run.
```

### 3. Invoicing for freelancers, with clients, invoices and payments.

```text
Paidup
  Simple invoicing for freelancers: keep your clients, send invoices and record the payments that come in.

Pages
  - Home (a landing page: hero, features, faq, call to action and footer)
  - Overview (a dashboard: received, outstanding, overdue, invoiced and latest)
  - Clients (lists clients)
  - Payments (lists payments; filter by invoice, method or paid on)
  - Invoice lines (lists invoice lines)
  - Privacy (a privacy page written from the app: who runs it, what it stores and why, cookies, mail, logs, your rights)
  - Invoices (lists invoices; filter by client or status; “Mark sent”; “Mark paid”; “Mark overdue”)

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

Payments
  Payments have:
  - an amount (an amount, required)
  - paid on (a date, required, today by default)
  - a method (bank transfer, card, cash or other, bank transfer by default)
  - a reference
  - an invoice (an invoice, required)

Invoices
  Invoices have:
  - a number (required, unique)
  - a client (a client, required)
  - issued on (a date, required, today by default)
  - due on (a date, required, the issued on plus 30 days by default)
  - status (draft, sent, paid or overdue, draft by default)
  Each invoice lists its invoice lines.
  Each invoice lists its payments.
  The total is calculated as the total amount of its lines.
  The paid amount is calculated as the total amount of its payments.
  The balance is calculated as the total minus the paid amount.

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

Flag overdue
  A day after an invoice's due on, where status is sent: runs “Mark overdue”.

Sign-in and access
  People sign in with a code sent to their email.
  Everyone sees, changes and deletes only their own records.
  Roles:
  - admin: everything
  - member: opens every page; adds every kind of record
  New users get the member role.
  Open to anyone without signing in: the home page and the privacy page.
  Everyone who signs in can ask the app questions; it changes nothing. It answers plainly.
Frontier model (claude-opus-5-5) · 4,993 tokens (2,275 in, 2,718 out) · $0.0726
Pictures from the Smithable image library: hero.webp, logo.webp.
Generated 148 files (148 changed, 0 removed).

Created /tmp/smithable-bench-m12-fONTiq/app-3. Open it in Studio, to see it and change it:

  cd /tmp/smithable-bench-m12-fONTiq/app-3
  smithable studio

or only run the app with smithable run.
/tmp/smithable-bench-m12-fONTiq/app-3/smithable.content.yml:3:3  warning  The privacy page "privacy" does not say who runs the app: give the operator's name under pages.privacy.operator (name, address, email, country, hosting).
```

### 4. A tool library where neighbors lend each other tools.

```text
Toolshare
  Neighbors lend each other the tools they have and borrow the ones they need.

Pages
  - Catalog (lists tools; search by name, description or place; filter by category, condition or available; sort by name or date added; records can be saved as favorites; contact the owner by mail)
  - My tools (lists tools; only the viewer's own records)
  - Saved (lists tools; only the viewer's saved records)
  - Review (the pictures and files waiting for review, to approve or reject; only for admins)
  - Home (a landing page: hero, features, faq and footer)
  - Privacy (a privacy page written from the app: who runs it, what it stores and why, cookies, mail, logs, your rights)

Tools
  Tools have:
  - a name (required)
  - photos (pictures, required)
  - a description (required)
  - a category (hand tools, power tools, garden, ladders, cleaning or other, hand tools by default)
  - a condition (like new, good or worn, like new by default)
  - a place
  - available (yes or no, true by default)
  Photos of tools are reviewed before others see them; a tool waits until its photos are.

Sign-in and access
  People sign in with a code sent to their email.
  Everyone sees, changes and deletes only their own records.
  Roles:
  - admin: everything
  - member: opens every page; adds every kind of record
  New users get the member role.
  Open to anyone without signing in: the home page, the catalog page, the privacy page and reading tools.
  Everyone who signs in can ask the app questions; it changes nothing. It answers plainly.

Assumed:
  How does borrowing a tool work? The borrower messages the owner from the tool's page and they arrange it between them (or: Borrowers send a loan request that the owner accepts or declines, Loans are recorded with pick-up and return dates)
  What can visitors see without signing in? The tool catalog, but never who owns each tool (or: Nothing until they sign in, The catalog and each owner's neighborhood)
  Who may join? Anyone may sign up and list tools (or: Only people invited by an administrator, Only addresses on a community's email domain)
  Are tool photos checked before they are listed? Yes, an administrator approves the photos first (or: No, tools are listed right away, Photos are optional and not checked)
Frontier model (claude-opus-5-5) · 2,455 tokens (1,592 in, 863 out) · $0.0300
Pictures from the Smithable image library: samples/tool-1.webp, samples/tool-2.webp, samples/tool-3.webp, samples/tool-4.webp, samples/tool-5.webp, samples/tool-6.webp, hero.webp, logo.webp.
Generated 132 files (132 changed, 0 removed).

Created /tmp/smithable-bench-m12-fONTiq/app-4. Open it in Studio, to see it and change it:

  cd /tmp/smithable-bench-m12-fONTiq/app-4
  smithable studio

or only run the app with smithable run.
/tmp/smithable-bench-m12-fONTiq/app-4/smithable.content.yml:3:3  warning  The privacy page "privacy" does not say who runs the app: give the operator's name under pages.privacy.operator (name, address, email, country, hosting).
```

### 5. An inventory app for a small bakery: ingredients, suppliers and stock levels.

```text
Bakery Stock
  Keeps track of the bakery's ingredients, their suppliers and how much is in stock.

Pages
  - Ingredients (lists ingredients; search by name or notes; filter by category, supplier or storage)
  - Suppliers (lists suppliers; search by name, contact person or email)
  - Team (who has access: invite people, change roles, remove users; only for admins)

Suppliers
  Suppliers have:
  - a name (required)
  - a contact person
  - an email
  - a phone
  - a website (a web address)
  - notes
  Each supplier lists its ingredients.

Ingredients
  Ingredients have:
  - a name (required, unique)
  - a category (flour, sugar, dairy, eggs, fats, yeast, flavorings, fruit and nuts, packaging or other, flour by default)
  - a unit (kg, g, l, ml, pieces or packs, kg by default)
  - an in stock (a number, required, 0 by default)
  - a reorder level (a number, 0 by default)
  - a supplier (a supplier)
  - a price per unit (an amount)
  - a storage (dry, fridge or freezer, dry by default)
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
  How are stock levels kept up to date? Each ingredient holds its current amount, which staff update when they count stock (or: Record every delivery and every use, and work out the stock from them, Do a full stock count on set dates)
  Who uses the app? The bakery's staff, invited by an administrator, all seeing and editing the same stock (or: Only the owner, Staff can view stock, and only managers can change it)
  Is anything visible to the public? No, the inventory is for the team only (or: A public page that lists the products we make)
Frontier model (claude-opus-5-5) · 3,919 tokens (2,054 in, 1,865 out) · $0.0537
Pictures from the Smithable image library: logo.webp.
Generated 118 files (118 changed, 0 removed).

Created /tmp/smithable-bench-m12-fONTiq/app-5. Open it in Studio, to see it and change it:

  cd /tmp/smithable-bench-m12-fONTiq/app-5
  smithable studio

or only run the app with smithable run.
```

### 6. A job board for a local union, with job posts and applications.

```text
Union Jobs
  A job board where the local union posts jobs and members apply for them.

Pages
  - Home (a landing page: hero, features, faq and footer)
  - Jobs (lists jobs; search by title, employer, location or description; filter by trade, job type, status or closes on; “Mark filled”; “Close job”)
  - Applications (lists applications; filter by job or status; “Shortlist”; “Hire”; “Decline”)
  - Team (who has access: invite people, change roles, remove users; only for admins)
  - Privacy (a privacy page written from the app: who runs it, what it stores and why, cookies, mail, logs, your rights)

Jobs
  Jobs have:
  - a title (required)
  - an employer (required)
  - a trade (electrical, carpentry, plumbing, construction, warehouse, transport, healthcare or other, electrical by default)
  - a job type (full time, part time, temporary or apprenticeship, full time by default)
  - a location
  - a pay
  - a description (required)
  - closes on (a date)
  - status (open, filled or closed, open by default)
  Each job lists its applications.

Applications
  Applications have:
  - a job (a job, required)
  - a name (required)
  - an email (required)
  - a phone
  - a message
  - a resume (a document)
  - status (submitted, shortlisted, hired or declined, submitted by default)

Mark filled
  For a job that is open; sets status to filled.
  Mark a job as filled once someone is hired.

Close job
  For a job that is open; sets status to closed.
  Close a job to new applications.

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
  - staff (Union staff who post jobs and handle applications): opens every page; sees everyone's records; adds jobs; changes everyone's jobs and applications; deletes everyone's jobs
  - member (Union members who browse jobs and apply): opens every page; sees everyone's jobs; adds applications
  New users get the member role.
  Open to anyone without signing in: the home page, the jobs page, the privacy page and reading jobs where status is open.
  Everyone who signs in can ask the app questions; it changes nothing. It answers plainly.

Assumed:
  Who posts the jobs? Union staff post jobs and handle applications; members apply (or: Employers sign in and post their own jobs, Any member may post a job they know of)
  Who may sign in to apply? Anyone may sign up and apply (or: Only members the union invites, Only addresses on the union's email domain)
  What can visitors see without signing in? The open jobs; applications always need sign-in (or: Nothing: the whole board needs sign-in, All jobs, filled and closed ones too)
  What does an application hold? Name, email, phone, a message and an optional resume (or: Just a message, as members are already known, A full form with experience and certifications)
Frontier model (claude-opus-5-5) · 4,116 tokens (1,977 in, 2,139 out) · $0.0586
Pictures from the Smithable image library: hero.webp, logo.webp.
Generated 140 files (140 changed, 0 removed).

Created /tmp/smithable-bench-m12-fONTiq/app-6. Open it in Studio, to see it and change it:

  cd /tmp/smithable-bench-m12-fONTiq/app-6
  smithable studio

or only run the app with smithable run.
/tmp/smithable-bench-m12-fONTiq/app-6/smithable.content.yml:3:3  warning  The privacy page "privacy" does not say who runs the app: give the operator's name under pages.privacy.operator (name, address, email, country, hosting).
```

### 7. A football club's site: teams, players, matches and results.

```text
Club Pitch
  The football club's site with its teams, players, fixtures and results.

Pages
  - Home (a landing page: hero, matches where status is scheduled, matches where status is played, teams, faq and footer)
  - Matches (lists matches; search by opponent or competition; filter by team, status, venue or kickoff; “Record result”; “Postpone”)
  - Teams (lists teams; search by name or coach; filter by category)
  - Players (lists players; search by name; filter by team or position)
  - Privacy (a privacy page written from the app: who runs it, what it stores and why, cookies, mail, logs, your rights)

Teams
  Teams have:
  - a name (required)
  - a category (senior, youth, women or veterans, senior by default)
  - a coach
  - a photo (picture)
  - about
  Each team lists its players.
  Each team lists its matches.

Players
  Players have:
  - a name (required)
  - a team (a team, required)
  - a shirt number (a whole number)
  - a position (goalkeeper, defender, midfielder or forward, goalkeeper by default)
  - a photo (picture)
  - a bio

Matches
  Matches have:
  - a team (a team, required)
  - an opponent (required)
  - a kickoff (a date and time, required)
  - a venue (home or away, home by default)
  - a ground
  - a competition
  - status (scheduled, played, postponed or canceled, scheduled by default)
  - a goals for (a whole number)
  - a goals against (a whole number)
  - a report
  A match is named after its team, its opponent and its kickoff.

Record result
  For a match that is scheduled or postponed; sets status to played; asks for the goals for and the goals against.
  Enter the final score of a match that has been played.

Postpone
  For a match that is scheduled; sets status to postponed.
  Mark a scheduled match as postponed.

Sign-in and access
  People sign in with a code sent to their email.
  Everyone sees, changes and deletes only their own records.
  Roles:
  - admin: everything
  - member: opens every page; adds every kind of record
  New users get the member role.
  Open to anyone without signing in: the home page, the matches page, the teams page, the players page, the privacy page, reading teams, reading players and reading matches.
  Everyone who signs in can ask the app questions; it changes nothing. It answers plainly.
Frontier model (claude-opus-5-5) · 4,209 tokens (2,120 in, 2,089 out) · $0.0587
Pictures from the Smithable image library: samples/team-1.webp, samples/team-2.webp, samples/team-3.webp, samples/player-1.webp, hero.webp, logo.webp.
Generated 137 files (137 changed, 0 removed).

Created /tmp/smithable-bench-m12-fONTiq/app-7. Open it in Studio, to see it and change it:

  cd /tmp/smithable-bench-m12-fONTiq/app-7
  smithable studio

or only run the app with smithable run.
/tmp/smithable-bench-m12-fONTiq/app-7/smithable.content.yml:3:3  warning  The privacy page "privacy" does not say who runs the app: give the operator's name under pages.privacy.operator (name, address, email, country, hosting).
```

### 8. Event registration for a conference: talks, speakers and attendees.

```text
Conference Hub
  The conference program with its talks and speakers, where attendees register for the talks they want to attend.

Pages
  - Home (a landing page: hero, features, speakers, faq, call to action and footer)
  - Program (a calendar of talks by week or month)
  - My registrations (lists registrations)
  - Talks (lists talks; filter by speaker or starts at; only for admins)
  - Speakers (lists speakers)
  - Privacy (a privacy page written from the app: who runs it, what it stores and why, cookies, mail, logs, your rights)
  - Admin (every kind of record, to find, open, change and delete; only for admins)

Speakers
  Speakers have:
  - a name (required)
  - a company
  - a bio (formatted text)
  - a photo (picture)
  Each speaker lists its talks.

Talks
  Talks have:
  - a title (required)
  - a summary
  - a speaker (a speaker, required)
  - a room
  - starts at (a date and time, required)
  - duration minutes (a whole number, required, 45 by default)
  - a capacity (a whole number, required, 50 by default)
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
  - admin (Organizers. Manage the program, talks and speakers): everything
  - member (An attendee who registers for talks): opens the my registrations page, the program page and the speakers page; adds registrations
  New users get the member role.
  Open to anyone without signing in: the home page, the program page, the speakers page, the privacy page, reading talks and reading speakers.
  Everyone who signs in can ask the app questions; it changes nothing. It answers plainly.
Frontier model (claude-opus-5-5) · 3,421 tokens (1,772 in, 1,649 out) · $0.0471
Pictures from the Smithable image library: samples/speaker-1.webp, hero.webp, logo.webp.
Generated 151 files (151 changed, 0 removed).

Created /tmp/smithable-bench-m12-fONTiq/app-8. Open it in Studio, to see it and change it:

  cd /tmp/smithable-bench-m12-fONTiq/app-8
  smithable studio

or only run the app with smithable run.
/tmp/smithable-bench-m12-fONTiq/app-8/smithable.content.yml:3:3  warning  The privacy page "privacy" does not say who runs the app: give the operator's name under pages.privacy.operator (name, address, email, country, hosting).
```

### 9. A help desk for an IT team: tickets, priorities and who handles them.

```text
IT Help Desk
  The IT team's tickets, their priorities and who handles each one.

Pages
  - Tickets (lists tickets; search by subject or requester email; filter by status, priority or assignee; sort by priority or date added; “Assign to me”; “Assign to”; “Start work”; “Close”; “Reopen”)
  - Team (who has access: invite people, change roles, remove users; only for admins)

Tickets
  Tickets have:
  - a subject (required)
  - a requester email (required, fixed once made)
  - status (open, in progress, closed or reopened, open by default)
  - a priority (a whole number, required, 3 by default)
  - a body
  - attachments (documents)
  Each ticket can have an assignee (a user, required when status is in progress or closed).
  Each ticket lists its notes.

Notes
  Notes have:
  - a content (required)
  - attachments (documents)
  - a ticket (a ticket, required)
  Each note can have an agent (a user, who makes it, by default, filled by the app).

Assign to me
  For a ticket that is not me(); sets assignee to whoever presses it.
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
Frontier model (claude-opus-5-5) · 3,298 tokens (1,724 in, 1,574 out) · $0.0453
Pictures from the Smithable image library: logo.webp.
Generated 134 files (134 changed, 0 removed).

Created /tmp/smithable-bench-m12-fONTiq/app-9. Open it in Studio, to see it and change it:

  cd /tmp/smithable-bench-m12-fONTiq/app-9
  smithable studio

or only run the app with smithable run.
```

### 10. A recipe collection for a family, with ingredients and shopping lists.

```text
Family Kitchen
  A family's shared recipe collection, with each recipe's ingredients and the shopping lists for the week.

Pages
  - Recipes (lists recipes; search by name or summary; filter by category or favorite)
  - Shopping lists (lists shopping lists; filter by status; “Mark done”)
  - Family (who has access: invite people, change roles, remove users; only for admins)

Recipes
  Recipes have:
  - a name (required)
  - a summary
  - a category (main, starter, dessert, baking, breakfast or side, main by default)
  - servings (a whole number, 4 by default)
  - minutes (a whole number)
  - a picture
  - instructions (formatted text)
  - favorite (yes or no)
  Each recipe lists its ingredients.

Ingredients
  Ingredients have:
  - a recipe (a recipe, required)
  - a name (required)
  - an amount

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

Mark done
  For a shopping list that is open; sets status to done.
  Mark a shopping list as done once the shopping is finished.

Sign-in and access
  People sign in with a code sent to their email.
  Everyone who signs in sees all records, and changes and deletes the ones they own.
  Roles:
  - admin: everything
  - member: opens every page; adds every kind of record
  New users get the member role.
  Everyone who signs in can ask the app questions; it changes nothing. It answers plainly.

Assumed:
  Who sees the recipes and shopping lists? Everyone in the family who is invited sees and edits all of them (or: Each person sees only their own recipes and lists, Recipes are also public for anyone to read)
  How are ingredients written on a recipe? One line per ingredient with a name and a free-text amount (e.g. 200 g) (or: A single text box listing all ingredients, Separate amount and unit fields)
  How do items get onto a shopping list? Typed in by hand on the list, each with a 'bought' tick (or: Copied automatically from a recipe's ingredients, A shared list of usual groceries to pick from)
Frontier model (claude-opus-5-5) · 4,288 tokens (2,163 in, 2,125 out) · $0.0598
Pictures from the Smithable image library: samples/recipe-1.webp, samples/recipe-2.webp, logo.webp.
Generated 135 files (135 changed, 0 removed).

Created /tmp/smithable-bench-m12-fONTiq/app-10. Open it in Studio, to see it and change it:

  cd /tmp/smithable-bench-m12-fONTiq/app-10
  smithable studio

or only run the app with smithable run.
```

### 11. A status page for our API, with incidents and planned maintenance.

```text
API Status
  The live state of our API: what works, what is being fixed and what maintenance is planned.

Pages
  - Home (a landing page: hero, components, incidents where status is investigating or identified or monitoring, incidents where status is resolved, maintenances and footer)
  - Overview (a dashboard: open, per month and latest)
  - Incidents (lists incidents; filter by status; “Identified”; “Monitoring”; “Resolve”)
  - Updates (lists incident updates)
  - Maintenance (lists maintenances)
  - Components (lists components; only for admins; visitors see components on the Home page)
  - Privacy (a privacy page written from the app: who runs it, what it stores and why, cookies, mail, logs, your rights; only for admins)
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
  For an incident that is investigating or identified; sets status to monitoring; adds an incident update (at now, status monitoring, message A fix has been deployed and we are watching the results.).
  A fix is out; the incident is watched before it is closed, with an update saying so.

Resolve
  For an incident that is investigating, identified or monitoring; sets status to resolved and resolved at to now; adds an incident update (at now, status resolved, message This incident has been resolved.).
  The incident is over, with an update saying so.

Sign-in and access
  People sign in with a code sent to their email.
  Everyone who signs in sees all records, and changes and deletes the ones they own.
  Roles:
  - admin: everything
  - staff (Writes incidents, their updates and planned maintenance): opens the overview page, the incidents page, the updates page and the maintenance page; adds every kind of record; changes everyone's records
  New users get the staff role.
  Open to anyone without signing in: the home page, reading components, reading incidents where status is investigating or identified or monitoring or resolved, reading incident updates and reading maintenances.
  Other programs can read and change components and incidents with a key, and run resolve. AI assistants can use it too.
  Everyone who signs in can ask the app questions; it changes nothing. It answers plainly.

Assumed:
  Who writes the incidents and maintenance notices? Only invited team members; staff write incidents and maintenance, admins manage components and the team (or: Every team member can do everything, Anyone may sign up and report incidents)
  What can visitors see without signing in? The status page with components, open and recent incidents with their updates, planned maintenance, and the incident history (or: Only the current status of the components, Nothing: the status page needs sign-in)
  Which time zone are times shown in? UTC (or: The team's local time zone, Europe/Stockholm)
  Can other programs report incidents automatically? Yes, with an API key for components and incidents, and AI assistants as tools (or: No API, API for every model)
Frontier model (claude-opus-5-5) · 4,796 tokens (2,324 in, 2,472 out) · $0.0680
Pictures from the Smithable image library: hero.webp, logo.webp.
Generated 161 files (161 changed, 0 removed).

Created /tmp/smithable-bench-m12-fONTiq/app-11. Open it in Studio, to see it and change it:

  cd /tmp/smithable-bench-m12-fONTiq/app-11
  smithable studio

or only run the app with smithable run.
/tmp/smithable-bench-m12-fONTiq/app-11/smithable.content.yml:3:3  warning  The privacy page "privacy" does not say who runs the app: give the operator's name under pages.privacy.operator (name, address, email, country, hosting).
```

### 12. A public uptime page for a web shop: which services work, outages and their updates.

```text
Shop Status
  Is the shop working? The state of our web shop's services, outages and their updates, live.

Pages
  - Home (a landing page: hero, components, incidents where status is investigating or identified or monitoring, incidents where status is resolved and footer)
  - Incidents (lists incidents; filter by status or component; “Identified”; “Monitoring”; “Resolve”)
  - Updates (lists incident updates)
  - Components (lists components; only for admins; visitors see components on the Home page)
  - Privacy (a privacy page written from the app: who runs it, what it stores and why, cookies, mail, logs, your rights)
  - Overview (a dashboard: open, per month and latest)
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
  - a date and time (at, required)
  - status (investigating, identified, monitoring or resolved, investigating by default)
  - a message (required)

Identified
  For an incident that is investigating; sets status to identified; adds an incident update (at now, status identified, message We have found the cause and are working on a fix.).
  The cause is found; the incident moves to identified, with an update saying so.

Monitoring
  For an incident that is investigating or identified; sets status to monitoring; adds an incident update (at now, status monitoring, message A fix is in place. We are keeping an eye on it before closing this.).
  A fix is out; the incident is watched before it is closed, with an update saying so.

Resolve
  For an incident that is investigating, identified or monitoring; sets status to resolved and resolved at to now; adds an incident update (at now, status resolved, message This outage is over. Everything is working again.).
  The incident is over, with an update saying so.

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
  Who writes the outages and their updates? An invited team: staff write outages and updates, admins also manage the services and the team (or: Only the administrators, Anyone on the team, including managing the services)
  Should the page also announce planned maintenance? No, only services, outages and their updates (or: Yes, with a planned maintenance list on the status page)
  What can visitors see without signing in? Every service's state, ongoing and resolved outages, their updates and the outage history (or: Only ongoing outages and the services' state, Services' state only)
Frontier model (claude-opus-5-5) · 3,761 tokens (2,066 in, 1,695 out) · $0.0504
Pictures from the Smithable image library: hero.webp, logo.webp.
Generated 155 files (155 changed, 0 removed).

Created /tmp/smithable-bench-m12-fONTiq/app-12. Open it in Studio, to see it and change it:

  cd /tmp/smithable-bench-m12-fONTiq/app-12
  smithable studio

or only run the app with smithable run.
/tmp/smithable-bench-m12-fONTiq/app-12/smithable.content.yml:3:3  warning  The privacy page "privacy" does not say who runs the app: give the operator's name under pages.privacy.operator (name, address, email, country, hosting).
```
