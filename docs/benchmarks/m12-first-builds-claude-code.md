# M12 first builds: claude-code (2026-10-30)

The app descriptions, each started with `smithable new --describe … --yes` (the starter the first step picks, adapted by the model; errors go back up to four times). Totals: 12 / 12 created, 12 type-check, 813,371 tokens (778,769 in, 34,602 out), $1.5018 (as Claude Code reports it); 0 model calls answered from the response cache. *Rounds* counts the model's drafting calls: the first draft and each round of corrections after it.

| Description | Starter | Created | Type-checks | Tokens in | Tokens out | Cost | Cached calls | Rounds | Time |
|---|---|---|---|---|---|---|---|---|---|
| A booking site for a yoga studio, with classes, teachers and online booking. | booking | yes | yes | 56,678 | 3,128 | $0.5160 | 0 | 2 | 75 s |
| A CRM for a small sales team: companies, contacts, deals and follow-ups. | crm | yes | yes | 111,553 | 3,266 | $0.1238 | 0 | 3 | 89 s |
| Invoicing for freelancers, with clients, invoices and payments. | invoicing | yes | yes | 112,913 | 4,866 | $0.1667 | 0 | 3 | 96 s |
| A tool library where neighbors lend each other tools. | marketplace | yes | yes | 54,853 | 2,525 | $0.0724 | 0 | 2 | 62 s |
| An inventory app for a small bakery: ingredients, suppliers and stock levels. | records | yes | yes | 54,648 | 1,599 | $0.0522 | 0 | 2 | 57 s |
| A job board for a local union, with job posts and applications. | marketplace | yes | yes | 54,852 | 3,395 | $0.0898 | 0 | 2 | 82 s |
| A football club's site: teams, players, matches and results. | records | yes | yes | 54,637 | 2,496 | $0.0701 | 0 | 2 | 79 s |
| Event registration for a conference: talks, speakers and attendees. | booking | yes | yes | 56,674 | 2,749 | $0.0914 | 0 | 2 | 70 s |
| A help desk for an IT team: tickets, priorities and who handles them. | support | yes | yes | 55,347 | 2,222 | $0.0703 | 0 | 2 | 59 s |
| A recipe collection for a family, with ingredients and shopping lists. | records | yes | yes | 54,642 | 1,781 | $0.0558 | 0 | 2 | 56 s |
| A status page for our API, with incidents and planned maintenance. | status | yes | yes | 55,984 | 3,671 | $0.1043 | 0 | 2 | 78 s |
| A public uptime page for a web shop: which services work, outages and their updates. | status | yes | yes | 55,988 | 2,904 | $0.0890 | 0 | 2 | 67 s |

Each created app's four spec files are in [m12-first-builds-claude-code/](m12-first-builds-claude-code/), one folder per description (app-1 …).

<!-- scorecard -->
## Scorecard (scripts/bench-m12.mjs --score)

0 of 12 drafts end with a warning about what is public (*Public flaws left*: public-personal-data, public-page-closed-records, contact-form-closed, shortcut-closed, mine-public, visitors-read-drafts); since #266 a draft with one goes back to the model once to fix it. *API app*, for the second set's two descriptions of apps for programs and assistants: "yes" when the draft has no landing page, an `api` block, tools when the description names an assistant, and a role other than admin for keys; otherwise what it lacks.

| # | Starter | Questions | Models kept | Pages kept | Actions kept | Access; roles (default) | Pages with access | Public | Warnings | Public flaws left | API app | Starter's texts in the draft | Models with the starter's samples | Visitors / landing |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | booking | 3 | 4 / 6 (has 4) | 7 / 12 (has 7) | 0 / 1 (has 0) | private; admin, member (member) | none | pages home, schedule, privacy; read ClassType, Instructor, Session; create none | 1 (operator-unknown) | none |  | none | 3 / 4 | mentions visitors; landing page |
| 2 | crm | 3 | 1 / 3 (has 4) | 2 / 4 (has 5) | 0 / 2 (has 4) | shared; admin, sales (sales) | none | pages none; read none; create none | 0 | none |  | none | 0 / 4 | no mention; no landing page |
| 3 | invoicing | 3 | 3 / 4 (has 4) | 4 / 7 (has 6) | 3 / 3 (has 3) | private; admin, member (member) | none | pages home, privacy; read none; create none | 1 (operator-unknown) | none |  | none | 3 / 4 | no mention; landing page |
| 4 | marketplace (words: records) | 3 | 0 / 1 (has 1) | 3 / 5 (has 6) | 0 / 0 (has 0) | private; admin, member (member) | none | pages home, tools, privacy; read Tool; create none | 1 (operator-unknown) | none |  | none | 0 / 1 | no mention; landing page |
| 5 | records (words: api) | 3 | 0 / 1 (has 2) | 0 / 2 (has 3) | 0 / 0 (has 0) | shared; admin, member (member) | none | pages none; read none; create none | 0 | none |  | none | 0 / 2 | no mention; no landing page |
| 6 | marketplace | 3 | 0 / 1 (has 2) | 1 / 5 (has 6) | 0 / 0 (has 5) | private; admin, member, staff (member) | none | pages home, jobs, privacy; read Job; create none | 3 (write-without-read, operator-unknown) | none |  | none | 0 / 2 | no mention; landing page |
| 7 | records (words: booking) | 3 | 0 / 1 (has 3) | 1 / 2 (has 5) | 0 / 0 (has 2) | private; admin, member (member) | none | pages home, matches, teams, players, privacy; read Team, Player, Match; create none | 1 (operator-unknown) | none |  | none | 0 / 3 | mentions visitors; landing page |
| 8 | booking (words: records) | 3 | 0 / 6 (has 3) | 4 / 12 (has 7) | 0 / 1 (has 0) | private; admin, member (member) | none | pages home, schedule, privacy; read Talk, Speaker; create none | 2 (no-timezone, operator-unknown) | none |  | none | 0 / 3 | no mention; landing page |
| 9 | support (words: booking) | 3 | 1 / 2 (has 2) | 1 / 2 (has 2) | 5 / 5 (has 5) | shared; admin, agent (agent) | none | pages none; read none; create none | 0 | none |  | none | 0 / 2 | no mention; no landing page |
| 10 | records | 3 | 0 / 1 (has 4) | 0 / 2 (has 3) | 0 / 0 (has 2) | shared; admin, member (member) | none | pages none; read none; create none | 0 | none |  | none | 0 / 4 | no mention; no landing page |
| 11 | status | 3 | 4 / 4 (has 4) | 7 / 8 (has 8) | 3 / 3 (has 3) | shared; admin, staff (staff) | none | pages home, privacy; read Component, Incident, IncidentUpdate, Maintenance; create none | 1 (operator-unknown) | none |  | none | 4 / 4 | no mention; landing page |
| 12 | status | 2 | 3 / 4 (has 3) | 6 / 8 (has 7) | 3 / 3 (has 3) | shared; admin, staff (staff) | none | pages home; read Component, Incident, IncidentUpdate; create none | 1 (operator-unknown) | none |  | none | 3 / 3 | mentions visitors; landing page |

"Kept" counts the starter's models, pages and actions that the draft still has by name, with how many the draft has in all; "left out" names what the draft dropped because it could not be made valid: an action by its name, anything else (a formula field, a capacity) with its operation. "Starter's texts" lists the starter's app name or sample titles found in the draft's spec or content. "Models with the starter's samples" counts the draft's models that keep some of the starter's sample records after `fitSamples`; the rest get generated rows. "Mentions visitors" means the description says visitors, public or site. "Starter" is the one `new --describe --yes` printed, with the word-match starter (`closestStarter`) beside it when it differs; "Questions" counts what `smithable clarify` would ask (`--yes` asks nothing), with their language for a description not in English.
<!-- /scorecard -->

## Summaries, for review

### 1. A booking site for a yoga studio, with classes, teachers and online booking.

```text
Saltwind Yoga
  Class schedule, teachers and online booking for a yoga studio.

Pages
  - Home (a landing page: hero, class types, teachers, faq, call to action and footer)
  - Schedule (a calendar of sessions by week or month)
  - My bookings (lists bookings)
  - Sessions (lists sessions; filter by class type, teacher or starts at; only for admins)
  - Class types (lists class types; filter by level; only for admins; visitors see class types on the Home page)
  - Teachers (lists teachers; only for admins; visitors see teachers on the Home page)
  - Privacy (a privacy page written from the app: who runs it, what it stores and why, cookies, mail, logs, your rights)

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
  Its owner deletes it until 2 hours before the session's starts at.
  A booking is named after its session.

Sign-in and access
  People sign in with a code sent to their email.
  Everyone sees, changes and deletes only their own records.
  Roles:
  - admin: everything
  - member (A student who books classes): opens the schedule page and the my bookings page; adds bookings
  New users get the member role.
  Open to anyone without signing in: the home page, the schedule page, the privacy page, reading class types, reading instructors and reading sessions.
  Everyone who signs in can ask the app questions; it changes nothing. It answers plainly.

Assumed:
  Who can create an account and book? Anyone can sign up with their email and book classes (or: Only students the studio invites, Only people with a paid membership)
  What can visitors see before signing in? The home page, the class schedule, class types and teachers (or: Only the home page, Everything, including how many have booked each class)
  Until when can a student cancel a booking? Up to two hours before the class starts (or: Until the class starts, Up to 24 hours before the class)
  Should the site include a blog or a contact form? No, just classes, teachers and booking for now (or: Add a blog for studio news, Add a contact form on the home page)
Frontier model (claude-opus-5-5) · 3,516 tokens (1,923 in, 1,593 out) · $0.0472
Pictures from the Smithable image library: samples/instructor-1.webp, hero.webp, logo.webp.
Generated 155 files (155 changed, 0 removed).

Created /tmp/smithable-bench-m12-YSn8ez/app-1. Open it in Studio, to see it and change it:

  cd /tmp/smithable-bench-m12-YSn8ez/app-1
  smithable studio

or only run the app with smithable run.
/tmp/smithable-bench-m12-YSn8ez/app-1/smithable.content.yml:11:3  warning  The privacy page "privacy" does not say who runs the app: give the operator's name under pages.privacy.operator (name, address, email, country, hosting).
```

### 2. A CRM for a small sales team: companies, contacts, deals and follow-ups.

```text
Pipeline CRM
  A simple CRM where a small sales team tracks companies, contacts, deals and follow-ups.

Pages
  - Companies (lists companies; search by name or industry; “Merge companies”)
  - Contacts (lists contacts; search by name, email or job title; filter by company)
  - Deals (lists deals; search by title; filter by stage, company or expected close; “Mark won”; “Mark lost”)
  - Team (who has access: invite people, change roles, remove users; only for admins)
  - Follow ups (lists follow ups; search by note; filter by done, due on or assignee; “Complete follow up”)

Companies
  Companies have:
  - a name (required)
  - a website (a web address)
  - a phone
  - an industry
  - notes
  Each company can have an account manager (a user).
  Each company lists its contacts.
  Each company lists its deals.
  Each company lists its follow ups.
  The account manager owns the company.
  Deleted companies stay in the trash for thirty days, where they can be restored.
  Companies can be merged.

Contacts
  Contacts have:
  - a name (required)
  - a company (a company)
  - a job title
  - an email
  - a phone
  - notes
  Deleted contacts stay in the trash for thirty days, where they can be restored.

Deals
  Deals have:
  - a title (required)
  - a company (a company, required)
  - a contact (a contact)
  - a stage (lead, qualified, proposal, negotiation, won or lost, lead by default)
  - a value (an amount)
  - an expected close (a date)
  - closed on (a date, filled by the app)
  - notes
  Deleted deals stay in the trash for thirty days, where they can be restored.

Follow ups
  Follow ups have:
  - a company (a company, required)
  - a deal (a deal)
  - a contact (a contact)
  - due on (a date, required, today by default)
  - done (yes or no)
  - a note
  Each follow up can have an assignee (a user, who makes it, by default).
  Deleted follow ups stay in the trash for thirty days, where they can be restored.

Mark won
  For a deal that is lead, qualified, proposal or negotiation; sets stage to won and closed on to today.

Mark lost
  For a deal that is lead, qualified, proposal or negotiation; sets stage to lost and closed on to today.

Merge companies
  Merge two or more companies: the others' contacts, deals and follow ups move to the kept one; where they differ, the person chooses; the others go to the trash.

Complete follow up
  For a follow up that is not done; sets done to yes.

Sign-in and access
  People sign in with a code sent to their email.
  Everyone who signs in sees all records, and changes and deletes the ones they own.
  Roles:
  - admin: everything
  - sales (Works with companies, contacts, deals and follow-ups): opens the companies page, the contacts page, the deals page and the follow ups page; adds every kind of record; changes everyone's records
  New users get the sales role.
  Everyone who signs in can ask the app questions; it changes nothing. It answers plainly.

Assumed:
  Which currency are deal values in? Euro (EUR) (or: US dollar (USD), British pound (GBP), Swedish krona (SEK))
  What may salespeople change? Everyone can edit any record, but only the person who created it (or an admin) can delete it (or: Everyone can edit and delete anything, Each salesperson can edit only their own companies and deals)
  How do deals move through the pipeline? Stages lead, qualified, proposal, negotiation, then won or lost, with Mark won and Mark lost buttons (or: Only open, won and lost, A probability percentage for each deal)
  Who looks after each company? Each company has an account manager, and that person owns the company (or: Whoever added the company owns it, Companies have no owner)
Frontier model (claude-opus-5-5) · 5,314 tokens (2,366 in, 2,948 out) · $0.0779
Pictures from the Smithable image library: logo.webp.
Generated 156 files (156 changed, 0 removed).

Created /tmp/smithable-bench-m12-YSn8ez/app-2. Open it in Studio, to see it and change it:

  cd /tmp/smithable-bench-m12-YSn8ez/app-2
  smithable studio

or only run the app with smithable run.
```

### 3. Invoicing for freelancers, with clients, invoices and payments.

```text
Ledgerly
  Invoicing for freelancers: keep your clients, send invoices and record the payments that come in.

Pages
  - Home (a landing page: hero, features, faq, call to action and footer)
  - Overview (a dashboard: received, outstanding, overdue and latest)
  - Clients (lists clients; search by name or email)
  - Payments (lists payments; filter by invoice, paid on or method)
  - Privacy (a privacy page written from the app: who runs it, what it stores and why, cookies, mail, logs, your rights)
  - Invoices (lists invoices; search by number; filter by client, status or due on; “Mark sent”; “Mark paid”; “Mark overdue”)

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
  - paid on (a date, required, today by default)
  - an amount (an amount, required)
  - a method (bank transfer, card, cash or other, bank transfer by default)
  - a note
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
  The paid is calculated as the total amount of its payments.
  The balance is calculated as the total minus the paid.

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
Frontier model (claude-opus-5-5) · 4,841 tokens (2,273 in, 2,568 out) · $0.0695
Pictures from the Smithable image library: hero.webp, logo.webp.
Generated 153 files (153 changed, 0 removed).

Created /tmp/smithable-bench-m12-YSn8ez/app-3. Open it in Studio, to see it and change it:

  cd /tmp/smithable-bench-m12-YSn8ez/app-3
  smithable studio

or only run the app with smithable run.
/tmp/smithable-bench-m12-YSn8ez/app-3/smithable.content.yml:3:3  warning  The privacy page "privacy" does not say who runs the app: give the operator's name under pages.privacy.operator (name, address, email, country, hosting).
```

### 4. A tool library where neighbors lend each other tools.

```text
Tool Shed
  Neighbors lend each other the tools they own instead of everyone buying their own.

Pages
  - Tools (lists tools; search by title, description or place; filter by category, condition or available; sort by title or date added; records can be saved as favorites; contact the owner by mail)
  - My tools (lists tools; only the viewer's own records)
  - Saved (lists tools; only the viewer's saved records)
  - Review (the pictures and files waiting for review, to approve or reject; only for admins)
  - Home (a landing page: hero, tools, features, faq and footer)
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

Sign-in and access
  People sign in with a code sent to their email.
  Everyone sees, changes and deletes only their own records.
  Roles:
  - admin: everything
  - member: opens every page; adds every kind of record
  New users get the member role.
  Open to anyone without signing in: the home page, the tools page, the privacy page and reading tools.
  Everyone who signs in can ask the app questions; it changes nothing. It answers plainly.

Assumed:
  How is a loan arranged? The borrower messages the tool's owner from its page, and the owner marks the tool as not available while it's lent out (or: Borrowers send loan requests that the owner approves or declines, Loans are recorded with dates and a return button)
  What can people see before they sign in? The welcome page and the tool catalog, without owners' details (or: Nothing; everything needs sign-in, Only the welcome page)
  Who can join? Anyone can sign up with their email (or: Only invited neighbors, Only addresses on one email domain)
  Are tool photos checked before they show up? Yes, an admin approves the photos first (or: No, tools show up right away)
Frontier model (claude-opus-5-5) · 2,441 tokens (1,586 in, 855 out) · $0.0298
Pictures from the Smithable image library: samples/tool-1.webp, samples/tool-2.webp, samples/tool-3.webp, samples/tool-4.webp, samples/tool-5.webp, samples/tool-6.webp, hero.webp, logo.webp.
Generated 140 files (140 changed, 0 removed).

Created /tmp/smithable-bench-m12-YSn8ez/app-4. Open it in Studio, to see it and change it:

  cd /tmp/smithable-bench-m12-YSn8ez/app-4
  smithable studio

or only run the app with smithable run.
/tmp/smithable-bench-m12-YSn8ez/app-4/smithable.content.yml:3:3  warning  The privacy page "privacy" does not say who runs the app: give the operator's name under pages.privacy.operator (name, address, email, country, hosting).
```

### 5. An inventory app for a small bakery: ingredients, suppliers and stock levels.

```text
Bakery Stock
  Keeps track of a small bakery's ingredients, their suppliers and how much is in stock.

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
  - a category (flour, sugar, dairy, eggs, fats, yeast, flavorings, nuts and fruit, packaging or other, flour by default)
  - a supplier (a supplier)
  - a unit (kg, g, l, ml or pieces, kg by default)
  - an in stock (a number, required, 0 by default)
  - a reorder level (a number, 0 by default)
  - a unit price (an amount)
  - a storage (dry, fridge or freezer, dry by default)
  - a last counted (a date, today by default)
  - notes
  The stock value is calculated as the in stock times the unit price.

Sign-in and access
  People sign in with a code sent to their email.
  Everyone who signs in sees all records, and changes and deletes the ones they own.
  Roles:
  - admin: everything
  - member (Works in the bakery and keeps the stock up to date): opens every page; adds every kind of record; changes everyone's records
  New users get the member role.
  Everyone who signs in can ask the app questions; it changes nothing. It answers plainly.

Assumed:
  How are stock levels kept? Each ingredient holds its current amount in stock and a reorder level, updated by hand after a count (or: A log of deliveries and usage that adds up to the stock, Separate stock counts on set dates)
  Who sees and edits the stock? The whole bakery team shares the same records and anyone on it can change them (or: Only administrators change records; others only look, Each person sees only what they added)
  Is anything public? Nothing; it is an internal tool for invited staff (or: A public page listing the bakery's suppliers)
Frontier model (claude-opus-5-5) · 3,864 tokens (2,043 in, 1,821 out) · $0.0528
Pictures from the Smithable image library: logo.webp.
Generated 126 files (126 changed, 0 removed).

Created /tmp/smithable-bench-m12-YSn8ez/app-5. Open it in Studio, to see it and change it:

  cd /tmp/smithable-bench-m12-YSn8ez/app-5
  smithable studio

or only run the app with smithable run.
```

### 6. A job board for a local union, with job posts and applications.

```text
Union Jobs
  A job board where the union posts openings and members apply for them.

Pages
  - Jobs (lists jobs; search by title, employer, description, location or trade; filter by job type, status or closes on; sort by closes on or date added; records can be saved as favorites; “Mark filled”; “Close job”)
  - My applications (lists applications; only the viewer's own records)
  - Applications (lists applications; search by name, email or member number; filter by job or status; only for staff users and admins)
  - Home (a landing page: hero, features, jobs where status is open and footer)
  - Privacy (a privacy page written from the app: who runs it, what it stores and why, cookies, mail, logs, your rights)
  - Team (who has access: invite people, change roles, remove users; only for admins)

Jobs
  Jobs have:
  - a title (required)
  - an employer (required)
  - a description (required)
  - a location
  - a trade
  - a job type (full time, part time, temporary or apprenticeship, full time by default)
  - a pay
  - closes on (a date)
  - status (open, filled or closed, open by default)
  Each job lists its applications.

Applications
  Applications have:
  - a job (a job, required, unique)
  - a name (required)
  - an email (required)
  - a phone
  - a member number
  - a message
  - a resume (a document)
  - status (submitted, shortlisted, rejected or hired, submitted by default)
  A application is named after its name and its job.

Shortlist
  For an application that is submitted; sets status to shortlisted.

Reject
  For an application that is submitted or shortlisted; sets status to rejected.

Hire
  For an application that is submitted or shortlisted; sets status to hired.

Mark filled
  For a job that is open; sets status to filled.

Close job
  For a job that is open; sets status to closed.

Sign-in and access
  People sign in with a code sent to their email.
  Everyone sees, changes and deletes only their own records.
  Roles:
  - admin: everything
  - member (A union member who browses jobs and applies for them): opens the home page, the jobs page, the my applications page and the privacy page; adds applications
  - staff (Union office staff who post jobs and handle applications): opens every page; sees everyone's applications; adds jobs; changes everyone's jobs and applications; deletes everyone's jobs
  New users get the member role.
  Open to anyone without signing in: the home page, the jobs page, the privacy page and reading jobs where status is open.
  Everyone who signs in can ask the app questions; it changes nothing. It answers plainly.

Assumed:
  Who posts jobs and handles the applications? Union office staff post jobs and review applications; members only apply (or: Employers sign in and post their own jobs, Any member may post a job)
  Can people see the jobs without signing in? Open jobs are public; signing in is needed to apply (or: Everything needs sign-in, members only, Visitors can also apply without an account)
  Can applicants see each other's applications? No, each member sees only their own applications; staff see all (or: Members see who else applied)
  What does an application hold? Name, email, phone, member number, a message and a CV file (or: Just a message, A full profile kept between applications)
Frontier model (claude-opus-5-5) · 4,246 tokens (1,927 in, 2,319 out) · $0.0618
Pictures from the Smithable image library: hero.webp, logo.webp.
Generated 153 files (153 changed, 0 removed).

Created /tmp/smithable-bench-m12-YSn8ez/app-6. Open it in Studio, to see it and change it:

  cd /tmp/smithable-bench-m12-YSn8ez/app-6
  smithable studio

or only run the app with smithable run.
/tmp/smithable-bench-m12-YSn8ez/app-6/smithable.auth.yml:16:5  warning  staff may change others' Job it cannot read: with private access a role reads only its own records unless granted "read".
    hint: Grant staff "read" on them too, or drop the "write".
/tmp/smithable-bench-m12-YSn8ez/app-6/smithable.auth.yml:17:5  warning  staff may delete others' Job it cannot read: with private access a role reads only its own records unless granted "read".
    hint: Grant staff "read" on them too, or drop the "delete".
/tmp/smithable-bench-m12-YSn8ez/app-6/smithable.content.yml:3:3  warning  The privacy page "privacy" does not say who runs the app: give the operator's name under pages.privacy.operator (name, address, email, country, hosting).
```

### 7. A football club's site: teams, players, matches and results.

```text
Club Pitch
  The club's public site with its teams, players, fixtures and results.

Pages
  - Home (a landing page: hero, matches where status is scheduled, matches where status is played, teams and footer)
  - Matches (lists matches; search by opponent or competition; filter by team, status, venue or kickoff; “Record result”; “Postpone”)
  - Teams (lists teams; filter by category)
  - Players (lists players; search by name; filter by team or position)
  - Privacy (a privacy page written from the app: who runs it, what it stores and why, cookies, mail, logs, your rights)

Teams
  Teams have:
  - a name (required)
  - a category (senior, youth, women or veterans, senior by default)
  - a coach
  - about
  - a photo (picture)
  Each team lists its players.
  Each team lists its matches.

Players
  Players have:
  - a name (required)
  - a team (a team, required)
  - a number (a whole number)
  - a position (goalkeeper, defender, midfielder or forward, goalkeeper by default)
  - a photo (picture)
  - a bio

Matches
  Matches have:
  - a team (a team, required)
  - an opponent (required)
  - a kickoff (a date and time, required)
  - a venue (home or away, home by default)
  - a location
  - a competition
  - status (scheduled, played, postponed or canceled, scheduled by default)
  - a goals for (a whole number)
  - a goals against (a whole number)
  - a report
  A match is named after its team, its opponent and its kickoff.

Record result
  For a match that is scheduled or postponed; sets status to played; asks for the goals for and the goals against.
  Enter the final score of a match once it has been played.

Postpone
  For a match that is scheduled; sets status to postponed.

Sign-in and access
  People sign in with a code sent to their email.
  Everyone sees, changes and deletes only their own records.
  Roles:
  - admin: everything
  - member: opens every page; adds every kind of record
  New users get the member role.
  Open to anyone without signing in: the home page, the matches page, the teams page, the players page, the privacy page, reading teams, reading players and reading matches.
  Everyone who signs in can ask the app questions; it changes nothing. It answers plainly.

Assumed:
  Who adds and updates teams, players and matches? Only the club's administrators; everyone else just views the site. (or: Each team's coach manages their own team, Any signed-in club member)
  What can visitors see without signing in? Teams, players, fixtures and results are all public. (or: Only fixtures and results, Player profiles only for signed-in members)
  What does a match record hold? Team, opponent, kickoff, home or away, competition, status, score and a short report. (or: Also goal scorers and line-ups, Only date, opponent and score)
  Do fans or members sign up to the site? No open sign-up; only invited people sign in. (or: Anyone may sign up as a fan, Members sign up to follow a team)
Frontier model (claude-opus-5-5) · 4,220 tokens (2,108 in, 2,112 out) · $0.0591
Pictures from the Smithable image library: samples/team-1.webp, samples/team-2.webp, samples/team-3.webp, samples/player-1.webp, hero.webp, logo.webp.
Generated 145 files (145 changed, 0 removed).

Created /tmp/smithable-bench-m12-YSn8ez/app-7. Open it in Studio, to see it and change it:

  cd /tmp/smithable-bench-m12-YSn8ez/app-7
  smithable studio

or only run the app with smithable run.
/tmp/smithable-bench-m12-YSn8ez/app-7/smithable.content.yml:3:3  warning  The privacy page "privacy" does not say who runs the app: give the operator's name under pages.privacy.operator (name, address, email, country, hosting).
```

### 8. Event registration for a conference: talks, speakers and attendees.

```text
Northlight Conference
  Talks, speakers and registration for a conference, where attendees reserve their seat in the talks they want to hear.

Pages
  - Home (a landing page: hero, talks, speakers, faq, call to action and footer)
  - Talks (lists talks; filter by speaker or starts at; only for admins; visitors see talks on the Home page)
  - Speakers (lists speakers; only for admins; visitors see speakers on the Home page)
  - My registrations (lists registrations)
  - Schedule (a calendar of talks by week or month)
  - Privacy (a privacy page written from the app: who runs it, what it stores and why, cookies, mail, logs, your rights)
  - Admin (every kind of record, to find, open, change and delete; only for admins)

Speakers
  Speakers have:
  - a name (required)
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
  - member (An attendee who registers for talks): opens the my registrations page; adds registrations
  New users get the member role.
  Open to anyone without signing in: the home page, the schedule page, the privacy page, reading talks and reading speakers.
  Everyone who signs in can ask the app questions; it changes nothing. It answers plainly.

Assumed:
  What does an attendee register for? A seat in each talk they want to hear, limited by the talk's capacity (or: One registration for the whole conference, A ticket type (day pass, full pass) for the conference)
  What can visitors see without signing in? The home page, the talk schedule and the speakers (or: Nothing; everything needs sign-in, The schedule only, with no speaker details)
  Who can sign up? Anyone can sign up as an attendee; organizers are admins (or: Only invited attendees, Separate roles for speakers and organizers)
  Where does a talk take place? The room is written as plain text on the talk (or: Rooms as their own records, each with its own capacity, No room information)
Frontier model (claude-opus-5-5) · 3,431 tokens (1,782 in, 1,649 out) · $0.0472
Pictures from the Smithable image library: samples/speaker-1.webp, hero.webp, logo.webp.
Generated 159 files (159 changed, 0 removed).

Created /tmp/smithable-bench-m12-YSn8ez/app-8. Open it in Studio, to see it and change it:

  cd /tmp/smithable-bench-m12-YSn8ez/app-8
  smithable studio

or only run the app with smithable run.
/tmp/smithable-bench-m12-YSn8ez/app-8/smithable.yml:49:14  warning  Page "schedule" is a calendar, but the app has no time zone: records are placed in UTC.
    hint: Set "timezone" under "app", e.g. "Europe/Mariehamn".
/tmp/smithable-bench-m12-YSn8ez/app-8/smithable.content.yml:3:3  warning  The privacy page "privacy" does not say who runs the app: give the operator's name under pages.privacy.operator (name, address, email, country, hosting).
```

### 9. A help desk for an IT team: tickets, priorities and who handles them.

```text
IT Help Desk
  The IT team's tickets: what needs fixing, how urgent it is and who handles it.

Pages
  - Tickets (lists tickets; search by subject or requester email; filter by status, priority or assignee; sort by priority or date added; “Assign to me”; “Assign to”; “Start work”; “Close”; “Reopen”)
  - Team (who has access: invite people, change roles, remove users; only for admins)

Tickets
  Tickets have:
  - a subject (required)
  - a requester email (required, fixed once made)
  - status (open, in progress, closed or reopened, open by default)
  - a priority (normal, low, high or urgent, normal by default)
  - a description
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
  For a ticket that is not me(); sets assignee to whoever presses it.
  Take the ticket: you become the one who handles it.

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
  - agent (Works the tickets: takes them, handles them and passes them on): opens the tickets page; adds every kind of record; changes everyone's records; runs every custom action
  New users get the agent role.
  Everyone who signs in can ask the app questions; it changes nothing. It answers plainly.

Assumed:
  Who signs in to the help desk? Only the IT team, invited from the team page; the person who reported the problem is kept as an email address on the ticket (or: Employees also sign in to file and follow their own tickets, Anyone at the company's email domain may sign in)
  How is a ticket's priority given? Low, normal, high or urgent (or: A number from 1 to 5, Priority worked out from impact and urgency)
  Do tickets come in by mail? No, the team enters tickets in the app (or: Mail to a support address becomes a ticket, Employees fill in a form)
  What goes under a ticket? Notes from the team, shown as a conversation (or: Nothing but the description, Replies mailed to the requester)
Frontier model (claude-opus-5-5) · 3,241 tokens (1,739 in, 1,502 out) · $0.0439
Pictures from the Smithable image library: logo.webp.
Generated 142 files (142 changed, 0 removed).

Created /tmp/smithable-bench-m12-YSn8ez/app-9. Open it in Studio, to see it and change it:

  cd /tmp/smithable-bench-m12-YSn8ez/app-9
  smithable studio

or only run the app with smithable run.
```

### 10. A recipe collection for a family, with ingredients and shopping lists.

```text
Family Kitchen
  A family's shared recipe collection with ingredients and shopping lists.

Pages
  - Recipes (lists recipes; search by name, summary or category; filter by category or favorite)
  - Shopping lists (lists shopping lists; filter by status or shop on; “Mark done”)
  - Team (who has access: invite people, change roles, remove users; only for admins)

Recipes
  Recipes have:
  - a name (required)
  - a summary
  - a category (main, starter, dessert, baking, breakfast or drink, main by default)
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
  - a quantity

Shopping lists
  Shopping lists have:
  - a name (required)
  - shop on (a date, today by default)
  - status (open or done, open by default)
  Each shopping list lists its shopping items.

Shopping items
  Shopping items have:
  - a list (a shopping list, required)
  - a name (required)
  - a quantity
  - bought (yes or no)

Mark done
  For a shopping list that is open; sets status to done.
  Close a shopping list once the shopping is done.

Mark bought
  For a shopping item that is not bought; sets bought to yes.
  Tick off an item once it is in the basket.

Sign-in and access
  People sign in with a code sent to their email.
  Everyone who signs in sees all records, and changes and deletes the ones they own.
  Roles:
  - admin: everything
  - member (A family member who adds recipes and shops from the lists): opens every page; adds every kind of record; changes everyone's shopping lists and shopping items; deletes everyone's shopping items
  New users get the member role.
  Everyone who signs in can ask the app questions; it changes nothing. It answers plainly.
Frontier model (claude-opus-5-5) · 4,197 tokens (2,159 in, 2,038 out) · $0.0580
Pictures from the Smithable image library: samples/recipe-1.webp, samples/recipe-2.webp, logo.webp.
Generated 146 files (146 changed, 0 removed).

Created /tmp/smithable-bench-m12-YSn8ez/app-10. Open it in Studio, to see it and change it:

  cd /tmp/smithable-bench-m12-YSn8ez/app-10
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
  - Incidents (lists incidents; filter by status or component; “Identified”; “Monitoring”; “Resolve”)
  - Updates (lists incident updates)
  - Maintenance (lists maintenances)
  - Components (lists components; only for admins; visitors see components on the Home page)
  - Team (who has access: invite people, change roles, remove users; only for admins)
  - Privacy (a privacy page written from the app: who runs it, what it stores and why, cookies, mail, logs, your rights)

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
  For an incident that is investigating; sets status to identified; adds an incident update (at now, status identified, message The cause is found and a fix is being worked on.).
  The cause is found; the incident moves to identified, with an update saying so.

Monitoring
  For an incident that is investigating or identified; sets status to monitoring; adds an incident update (at now, status monitoring, message A fix is out. We are watching before we close this.).
  A fix is out; the incident is watched before it is closed, with an update saying so.

Resolve
  For an incident that is investigating, identified or monitoring; sets status to resolved and resolved at to now; adds an incident update (at now, status resolved, message This incident is resolved.).
  The incident is over, with an update saying so.

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
  What can people see without signing in? The status page, the service states, incidents with their updates, and planned maintenance (or: Only the current service states, Everything, including the internal dashboard)
  Who writes incidents and maintenance? An invited team (staff); admins also manage components and the team (or: Admins only, Anyone who signs up)
  How are incidents moved along? Buttons for identified, monitoring and resolved, each adding a public update (or: Edit the status by hand, Only a resolve button)
  Which time zone are the times shown in? UTC (or: Europe/Stockholm, America/New_York)
Frontier model (claude-opus-5-5) · 4,796 tokens (2,324 in, 2,472 out) · $0.0680
Pictures from the Smithable image library: hero.webp, logo.webp.
Generated 169 files (169 changed, 0 removed).

Created /tmp/smithable-bench-m12-YSn8ez/app-11. Open it in Studio, to see it and change it:

  cd /tmp/smithable-bench-m12-YSn8ez/app-11
  smithable studio

or only run the app with smithable run.
/tmp/smithable-bench-m12-YSn8ez/app-11/smithable.content.yml:3:3  warning  The privacy page "privacy" does not say who runs the app: give the operator's name under pages.privacy.operator (name, address, email, country, hosting).
```

### 12. A public uptime page for a web shop: which services work, outages and their updates.

```text
Shop Status
  Is the shop working? The live state of our web shop's services, outages and their updates.

Pages
  - Home (a landing page: hero, components, incidents where status is investigating or identified or monitoring, incidents where status is resolved and footer)
  - Incidents (lists incidents; filter by status or component; “Identified”; “Monitoring”; “Resolve”)
  - Updates (lists incident updates)
  - Components (lists components; only for admins; visitors see components on the Home page)
  - Privacy (a privacy page written from the app: who runs it, what it stores and why, cookies, mail, logs, your rights; only for admins)
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
  For an incident that is investigating or identified; sets status to monitoring; adds an incident update (at now, status monitoring, message A fix is in place. We are watching closely before closing this.).
  A fix is out; the incident is watched before it is closed, with an update saying so.

Resolve
  For an incident that is investigating, identified or monitoring; sets status to resolved and resolved at to now; adds an incident update (at now, status resolved, message This outage is over and everything works again.).
  The outage is over, with an update saying so; the service's state stays what the team sets.

Sign-in and access
  People sign in with a code sent to their email.
  Everyone who signs in sees all records, and changes and deletes the ones they own.
  Roles:
  - admin: everything
  - staff (Reports outages and posts their updates): opens the overview page, the incidents page and the updates page; adds incidents and incident updates; changes everyone's incidents and incident updates
  New users get the staff role.
  Open to anyone without signing in: the home page, reading components, reading incidents and reading incident updates.
  Everyone who signs in can ask the app questions; it changes nothing. It answers plainly.

Assumed:
  What can shoppers see without signing in? The state of each service, ongoing and recently resolved outages with their updates, and the full outage history (or: Only the state of each service, Only ongoing outages)
  Who writes outages and their updates? Invited staff report outages and post updates; only administrators manage the list of services and the team (or: Staff also manage the services, Only administrators write anything)
  Should planned maintenance be announced too? No, only outages for now (or: Add a page for planned maintenance windows)
  Who can change a service's state (working, slow, down)? Administrators set it by hand on the services page (or: Staff can change it too, Set it automatically from open outages)
Frontier model (claude-opus-5-5) · 3,782 tokens (2,065 in, 1,717 out) · $0.0509
Pictures from the Smithable image library: hero.webp, logo.webp.
Generated 147 files (147 changed, 0 removed).

Created /tmp/smithable-bench-m12-YSn8ez/app-12. Open it in Studio, to see it and change it:

  cd /tmp/smithable-bench-m12-YSn8ez/app-12
  smithable studio

or only run the app with smithable run.
/tmp/smithable-bench-m12-YSn8ez/app-12/smithable.content.yml:3:3  warning  The privacy page "privacy" does not say who runs the app: give the operator's name under pages.privacy.operator (name, address, email, country, hosting).
```
