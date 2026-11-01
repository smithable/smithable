# M12 first builds: claude-code (2026-11-01)

The app descriptions, each started with `smithable new --describe … --yes` (the starter the first step picks, adapted by the model; errors go back up to four times). Totals: 12 / 12 created, 12 type-check, 928,567 tokens (894,703 in, 33,864 out), $1.5640 (as Claude Code reports it); 0 model calls answered from the response cache. *Rounds* counts the model's drafting calls: the first draft and each round of corrections after it.

| Description | Starter | Created | Type-checks | Tokens in | Tokens out | Cost | Cached calls | Rounds | Time |
|---|---|---|---|---|---|---|---|---|---|
| A booking site for a yoga studio, with classes, teachers and online booking. | booking | yes | yes | 181,117 | 4,060 | $0.6343 | 0 | – | 111 s |
| A CRM for a small sales team: companies, contacts, deals and follow-ups. | crm | yes | yes | 59,581 | 2,808 | $0.0849 | 0 | – | 84 s |
| Invoicing for freelancers, with clients, invoices and payments. | invoicing | yes | yes | 120,612 | 4,733 | $0.1637 | 0 | – | 150 s |
| A tool library where neighbors lend each other tools. | marketplace | yes | yes | 58,847 | 1,814 | $0.0591 | 0 | – | 74 s |
| An inventory app for a small bakery: ingredients, suppliers and stock levels. | records | yes | yes | 58,617 | 1,533 | $0.0517 | 0 | – | 75 s |
| A job board for a local union, with job posts and applications. | marketplace | yes | yes | 58,845 | 3,769 | $0.0982 | 0 | – | 119 s |
| A football club's site: teams, players, matches and results. | records | yes | yes | 58,604 | 2,511 | $0.0711 | 0 | – | 80 s |
| Event registration for a conference: talks, speakers and attendees. | booking | yes | yes | 60,643 | 2,810 | $0.0934 | 0 | – | 73 s |
| A help desk for an IT team: tickets, priorities and who handles them. | support | yes | yes | 59,317 | 2,157 | $0.0698 | 0 | – | 61 s |
| A recipe collection for a family, with ingredients and shopping lists. | records | yes | yes | 58,611 | 1,457 | $0.0501 | 0 | – | 56 s |
| A status page for our API, with incidents and planned maintenance. | status | yes | yes | 59,953 | 3,077 | $0.0933 | 0 | – | 61 s |
| A public uptime page for a web shop: which services work, outages and their updates. | status | yes | yes | 59,956 | 3,135 | $0.0944 | 0 | – | 60 s |

Each created app's four spec files are in [m12-first-builds-claude-code/](m12-first-builds-claude-code/), one folder per description (app-1 …).

<!-- scorecard -->
## Scorecard (scripts/bench-m12.mjs --score)

0 of 12 drafts end with a warning about what is public (*Public flaws left*: public-personal-data, public-page-closed-records, contact-form-closed, shortcut-closed, mine-public, visitors-read-drafts); since #266 a draft with one goes back to the model once to fix it. *API app*, for the second set's two descriptions of apps for programs and assistants: "yes" when the draft has no landing page, an `api` block, tools when the description names an assistant, and a role other than admin for keys; otherwise what it lacks.

| # | Starter | Questions | Models kept | Pages kept | Actions kept | Access; roles (default) | Pages with access | Public | Warnings | Public flaws left | API app | Starter's texts in the draft | Models with the starter's samples | Visitors / landing |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | booking | 3 | 5 / 6 (has 5) | 9 / 12 (has 9) | 0 / 1 (has 0) | private; admin, member (member) | none | pages home, schedule, privacy; read Instructor, Session, ClassType; create Message | 2 (no-timezone, operator-unknown) | none |  | none | 3 / 5 | mentions visitors; landing page |
| 2 | crm | 2 | 1 / 3 (has 4) | 3 / 5 (has 6) | 0 / 2 (has 3) | shared; admin, sales (sales) | none | pages none; read none; create none | 0 | none |  | none | 0 / 4 | no mention; no landing page |
| 3 | invoicing | 3 | 3 / 4 (has 4) | 5 / 7 (has 7) | 3 / 3 (has 3) | private; admin, member (member) | none | pages home, privacy; read none; create none | 1 (operator-unknown) | none |  | none | 3 / 4 | no mention; landing page |
| 4 | marketplace (words: records) | 3 | 0 / 1 (has 1) | 4 / 5 (has 6) | 0 / 0 (has 2) | private; admin, member (member) | none | pages home, catalog, privacy; read Tool; create none | 1 (operator-unknown) | none |  | none | 0 / 1 | no mention; landing page |
| 5 | records (words: api) | 3 | 0 / 1 (has 2) | 0 / 2 (has 3) | 0 / 0 (has 0) | shared; admin, member (member) | none | pages none; read none; create none | 0 | none |  | none | 0 / 2 | no mention; no landing page |
| 6 | marketplace | 3 | 0 / 1 (has 2) | 1 / 5 (has 5) | 0 / 0 (has 5) | private; admin, member, staff (member) | none | pages home, jobs, privacy; read Job; create none | 1 (operator-unknown) | none |  | none | 0 / 2 | no mention; landing page |
| 7 | records (words: booking) | 3 | 0 / 1 (has 3) | 1 / 2 (has 5) | 0 / 0 (has 2) | private; admin, member (member) | none | pages home, matches, teams, players, privacy; read Team, Player, Match; create none | 1 (operator-unknown) | none |  | none | 0 / 3 | mentions visitors; landing page |
| 8 | booking (words: records) | 3 | 0 / 6 (has 3) | 4 / 12 (has 7) | 0 / 1 (has 0) | private; admin, member (member) | none | pages home, schedule, privacy; read Talk, Speaker; create none | 2 (no-timezone, operator-unknown) | none |  | none | 0 / 3 | no mention; landing page |
| 9 | support (words: booking) | 3 | 0 / 2 (has 2) | 1 / 2 (has 2) | 4 / 5 (has 5) | shared; admin, agent (agent) | none | pages none; read none; create none | 0 | none |  | none | 0 / 2 | no mention; no landing page |
| 10 | records | 3 | 0 / 1 (has 4) | 0 / 2 (has 3) | 0 / 0 (has 1) | shared; admin, member (member) | none | pages none; read none; create none | 0 | none |  | none | 0 / 4 | no mention; no landing page |
| 11 | status | 3 | 4 / 4 (has 4) | 7 / 8 (has 8) | 3 / 3 (has 3) | shared; admin, staff (staff) | none | pages home, privacy; read Component, Incident, IncidentUpdate, Maintenance; create none | 1 (operator-unknown) | none |  | none | 4 / 4 | no mention; landing page |
| 12 | status | 2 | 3 / 4 (has 3) | 6 / 8 (has 7) | 3 / 3 (has 3) | shared; admin, staff (staff) | none | pages home, privacy; read Component, Incident, IncidentUpdate; create none | 1 (operator-unknown) | none |  | Payments | 3 / 3 | mentions visitors; landing page |

"Kept" counts the starter's models, pages and actions that the draft still has by name, with how many the draft has in all; "left out" names what the draft dropped because it could not be made valid: an action by its name, anything else (a formula field, a capacity) with its operation. "Starter's texts" lists the starter's app name or sample titles found in the draft's spec or content. "Models with the starter's samples" counts the draft's models that keep some of the starter's sample records after `fitSamples`; the rest get generated rows. "Mentions visitors" means the description says visitors, public or site. "Starter" is the one `new --describe --yes` printed, with the word-match starter (`closestStarter`) beside it when it differs; "Questions" counts what `smithable clarify` would ask (`--yes` asks nothing), with their language for a description not in English.
<!-- /scorecard -->

## Summaries, for review

### 1. A booking site for a yoga studio, with classes, teachers and online booking.

```text
Lotus Room Yoga
  Class schedule, teachers and online booking for a yoga studio.

Pages
  - Home (a landing page: hero, instructors, faq, call to action, contact, class types and footer)
  - Schedule (a calendar of sessions by week or month; filter by classType or instructor)
  - My bookings (lists bookings)
  - Sessions (lists sessions; filter by class type, instructor or starts at; sort by starts at or capacity; only for admins)
  - Instructors (lists instructors; only for admins; visitors see instructors on the Home page)
  - Messages (lists messages; only for admins)
  - Privacy (a privacy page written from the app: who runs it, what it stores and why, cookies, mail, logs, your rights)
  - Admin (every kind of record, to find, open, change and delete; only for admins)
  - Class types (lists class types; filter by level; only for admins; visitors see class types on the Home page)

Instructors
  Instructors have:
  - a name (required)
  - a bio (formatted text)
  - a portrait (picture)
  Each instructor lists its sessions.

Sessions
  Sessions have:
  - an instructor (an instructor, required)
  - starts at (a date and time, required)
  - a capacity (a whole number, required, 12 by default)
  - a class type (a class type, required)
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

Class types
  Class types have:
  - a name (required)
  - a summary
  - a level (all levels, beginner or advanced, all levels by default)
  - duration minutes (a whole number, required, 60 by default)
  Each class type lists its sessions.

Sign-in and access
  People sign in with a code sent to their email.
  Everyone sees, changes and deletes only their own records.
  Roles:
  - admin: everything
  - member (A student who books classes): opens the my bookings page and the schedule page; adds bookings
  New users get the member role.
  Open to anyone without signing in: the home page, the schedule page, the privacy page, reading instructors, reading sessions, reading class types and adding messages.
  Everyone who signs in can ask the app questions; it changes nothing. It answers plainly.

Assumed:
  Can visitors see the class schedule before signing in? Yes. The schedule, classes and teachers are public, and you sign in only to book. (or: Only signed-in members see the schedule, The schedule is public, but the teachers are not shown)
  Until when can a member cancel a booking? Any time until the class starts (or: Up to 2 hours before the class, Up to 24 hours before the class, Only staff can cancel)
  Does the site need a blog or class prices? No. It has the schedule, classes, teachers, booking and a contact form. (or: Add a blog for studio news, Add class prices and passes)
  Who manages the schedule? Studio staff as admins; everyone else is a member who books (or: A separate teacher role that manages its own sessions, One owner does everything)
Frontier model (claude-opus-5-5) · 4,160 tokens (2,053 in, 2,107 out) · $0.0586
Pictures from the Smithable image library: samples/instructor-1.webp, samples/instructor-2.webp, samples/instructor-3.webp, samples/instructor-4.webp, samples/instructor-5.webp, samples/instructor-6.webp, hero.webp, logo.webp.
Generated 182 files (182 changed, 0 removed).

Created /tmp/smithable-bench-m12-k8cL7l/app-1. Open it in Studio, to see it and change it:

  cd /tmp/smithable-bench-m12-k8cL7l/app-1
  smithable studio

or only run the app with smithable run.
/tmp/smithable-bench-m12-k8cL7l/app-1/smithable.yml:49:14  warning  Page "schedule" is a calendar, but the app has no time zone: records are placed in UTC.
    hint: Set "timezone" under "app", e.g. "Europe/Mariehamn".
/tmp/smithable-bench-m12-k8cL7l/app-1/smithable.content.yml:3:3  warning  The privacy page "privacy" does not say who runs the app: give the operator's name under pages.privacy.operator (name, address, email, country, hosting).
```

### 2. A CRM for a small sales team: companies, contacts, deals and follow-ups.

```text
Pipeline CRM
  A simple CRM for a small sales team to track companies, contacts, deals and follow-ups.

Pages
  - Start (a dashboard: open deals, pipeline value, deals by stage and follow ups due)
  - Companies (lists companies; search by name or industry)
  - Contacts (lists contacts; search by name, email or job title)
  - Deals (lists deals; search by title; filter by stage, company or expected close; “Mark won”; “Mark lost”)
  - Follow ups (lists follow ups; filter by done, due on or company; “Complete follow up”)
  - Team (who has access: invite people, change roles, remove users; only for admins)

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

Contacts
  Contacts have:
  - a name (required)
  - a company (a company)
  - a job title
  - an email
  - a phone
  - notes

Deals
  Deals have:
  - a title (required)
  - a company (a company, required)
  - a contact (a contact)
  - a stage (lead, qualified, proposal, negotiation, won or lost, lead by default)
  - a value (an amount)
  - an expected close (a date)
  - closed on (a date)
  - notes
  Deleted deals stay in the trash for thirty days, where they can be restored.

Follow ups
  Follow ups have:
  - a company (a company, required)
  - a contact (a contact)
  - due on (a date, required, today by default)
  - a note
  - done (yes or no)

Mark won
  For a deal that is lead, qualified, proposal or negotiation; sets stage to won and closed on to today.
  Close a deal as won.

Mark lost
  For a deal that is lead, qualified, proposal or negotiation; sets stage to lost and closed on to today.
  Close a deal as lost.

Complete follow up
  For a follow up that is not done; sets done to yes.
  Mark a follow-up as done.

Sign-in and access
  People sign in with a code sent to their email.
  Everyone who signs in sees all records, and changes and deletes the ones they own.
  Roles:
  - admin: everything
  - sales (Works with companies, contacts, deals and follow-ups): opens the start page, the companies page, the contacts page, the deals page and the follow ups page; adds every kind of record; changes everyone's records
  New users get the sales role.
  Everyone who signs in can ask the app questions; it changes nothing. It answers plainly.

Assumed:
  Which currency are deal values in? EUR (or: USD, GBP, SEK)
  Who can change records? Every salesperson can see and edit all companies, contacts, deals and follow-ups; deleting stays with the record's owner and admins (or: Each salesperson edits only their own records, Everyone may also delete any record)
  What stages does a deal move through? Lead, qualified, proposal, negotiation, then won or lost (or: Open, won, lost, Lead, demo, trial, won, lost)
  Who may sign in? Only colleagues invited from the team page (or: Anyone with an address on the company's email domain)
Frontier model (claude-opus-5-5) · 5,086 tokens (2,323 in, 2,763 out) · $0.0738
Pictures from the Smithable image library: logo.webp.
Generated 158 files (158 changed, 0 removed).

Created /tmp/smithable-bench-m12-k8cL7l/app-2. Open it in Studio, to see it and change it:

  cd /tmp/smithable-bench-m12-k8cL7l/app-2
  smithable studio

or only run the app with smithable run.
```

### 3. Invoicing for freelancers, with clients, invoices and payments.

```text
Billfold
  Invoicing for freelancers: keep your clients, send invoices and track the payments that come in.

Pages
  - Home (a landing page: hero, features, faq, call to action and footer)
  - Overview (a dashboard: received, outstanding, overdue and latest)
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
  For an invoice that is sent or overdue; sets status to paid.
  The client paid the invoice in full.

Mark overdue
  For an invoice that is sent; sets status to overdue.
  The invoice is late.

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

Assumed:
  Who sees the clients, invoices and payments? Each freelancer sees only their own records (or: A small team shares all records, An accountant can see every freelancer's records)
  How are payments recorded? Payments are separate records on an invoice, so partial payments show a remaining balance (or: Just a paid button on the invoice, A payment can cover several invoices)
  What can visitors see without signing in? Only a landing page and the privacy page (or: Nothing; the app opens straight to sign-in, A landing page with pricing)
  Should clients get an email when an invoice is sent? No email for now; the freelancer marks an invoice as sent (or: Email the client when the invoice is marked sent, Also email a reminder when it becomes overdue)
Frontier model (claude-opus-5-5) · 5,218 tokens (2,289 in, 2,929 out) · $0.0769
Pictures from the Smithable image library: hero.webp, logo.webp.
Generated 155 files (155 changed, 0 removed).

Created /tmp/smithable-bench-m12-k8cL7l/app-3. Open it in Studio, to see it and change it:

  cd /tmp/smithable-bench-m12-k8cL7l/app-3
  smithable studio

or only run the app with smithable run.
/tmp/smithable-bench-m12-k8cL7l/app-3/smithable.content.yml:3:3  warning  The privacy page "privacy" does not say who runs the app: give the operator's name under pages.privacy.operator (name, address, email, country, hosting).
```

### 4. A tool library where neighbors lend each other tools.

```text
Shed Share
  Neighbors list the tools they own and lend them to each other.

Pages
  - Catalog (lists tools; search by title, description or place; filter by category, condition or available; sort by title or date added; records can be saved as favorites; contact the owner by mail)
  - My tools (lists tools; only the viewer's own records)
  - Saved (lists tools; only the viewer's saved records)
  - Review (the pictures and files waiting for review, to approve or reject; only for admins)
  - Home (a landing page: hero, features and footer)
  - Privacy (a privacy page written from the app: who runs it, what it stores and why, cookies, mail, logs, your rights)

Tools
  Tools have:
  - a title (required)
  - photos (pictures, required)
  - a description (required)
  - a category (power tools, hand tools, garden, ladders, cleaning or other, power tools by default)
  - a condition (like new, good or worn, like new by default)
  - a place
  - available (yes or no, true by default)
  Photos of tools are reviewed before others see them; a tool waits until its photos are.

Mark lent
  For a tool that is available; sets available to no.
  The owner marks a tool as lent out, so neighbors see it is away.

Mark returned
  For a tool that is not available; sets available to yes.
  The owner marks a tool as back and ready to borrow again.

Sign-in and access
  People sign in with a code sent to their email.
  Everyone sees, changes and deletes only their own records.
  Roles:
  - admin: everything
  - member: opens every page; adds every kind of record
  New users get the member role.
  Open to anyone without signing in: the home page, the catalog page, the privacy page and reading tools.
  Everyone who signs in can ask the app questions; it changes nothing. It answers plainly.
Frontier model (claude-opus-5-5) · 2,506 tokens (1,587 in, 919 out) · $0.0311
Pictures from the Smithable image library: samples/tool-1.webp, samples/tool-2.webp, samples/tool-3.webp, samples/tool-4.webp, samples/tool-5.webp, samples/tool-6.webp, hero.webp, logo.webp.
Generated 148 files (148 changed, 0 removed).

Created /tmp/smithable-bench-m12-k8cL7l/app-4. Open it in Studio, to see it and change it:

  cd /tmp/smithable-bench-m12-k8cL7l/app-4
  smithable studio

or only run the app with smithable run.
/tmp/smithable-bench-m12-k8cL7l/app-4/smithable.content.yml:3:3  warning  The privacy page "privacy" does not say who runs the app: give the operator's name under pages.privacy.operator (name, address, email, country, hosting).
```

### 5. An inventory app for a small bakery: ingredients, suppliers and stock levels.

```text
Bakery Stock
  Keep track of the bakery's ingredients, their suppliers and how much is in stock.

Pages
  - Ingredients (lists ingredients; search by name or notes; filter by category, supplier or storage)
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
  - a category (flour, sugar, dairy, eggs, fats, yeast, flavorings, fruit and nuts, packaging or other, flour by default)
  - a unit (kg, g, l, ml, pieces or packs, kg by default)
  - an in stock (a number, required, 0 by default)
  - a reorder level (a number)
  - a unit cost (an amount)
  - a supplier (a supplier)
  - a storage (dry, fridge or freezer, dry by default)
  - a last counted (a date, today by default)
  - notes

Sign-in and access
  People sign in with a code sent to their email.
  Everyone who signs in sees all records, and changes and deletes the ones they own.
  Roles:
  - admin: everything
  - member (Works in the bakery: counts stock and keeps ingredients and suppliers up to date): opens every page; adds every kind of record; changes everyone's ingredients and suppliers
  New users get the member role.
  Everyone who signs in can ask the app questions; it changes nothing. It answers plainly.

Assumed:
  How are stock levels kept? Each ingredient has a current amount in stock that staff update when they count it, plus a reorder level. (or: A log of every delivery and use that adds up to the stock, Stock counted per storage location)
  Who uses the app? Invited bakery staff, all able to update every ingredient and supplier; admins invite people. (or: Only the owner uses it, Staff only update stock; admins manage suppliers)
  Is anything public? Nothing: it is the bakery's internal tool. (or: A public page listing the bakery's products)
Frontier model (claude-opus-5-5) · 3,920 tokens (2,040 in, 1,880 out) · $0.0539
Pictures from the Smithable image library: logo.webp.
Generated 130 files (130 changed, 0 removed).

Created /tmp/smithable-bench-m12-k8cL7l/app-5. Open it in Studio, to see it and change it:

  cd /tmp/smithable-bench-m12-k8cL7l/app-5
  smithable studio

or only run the app with smithable run.
```

### 6. A job board for a local union, with job posts and applications.

```text
Union Job Board
  Job posts for union members, and the applications they send.

Pages
  - Jobs (lists jobs; search by title, employer, location or description; filter by trade, type, status or closes on; “Mark filled”; “Close job”)
  - Applications (lists applications; filter by job or status; “Shortlist”; “Hire”; “Decline”)
  - Home (a landing page: hero, features, faq and footer)
  - Privacy (a privacy page written from the app: who runs it, what it stores and why, cookies, mail, logs, your rights)
  - Team (who has access: invite people, change roles, remove users; only for admins)

Jobs
  Jobs have:
  - a title (required)
  - an employer (required)
  - a trade (construction, electrical, plumbing, transport, healthcare, education, hospitality, manufacturing or other, construction by default)
  - a type (full time, part time, temporary or apprenticeship, full time by default)
  - a location
  - a pay
  - a description (formatted text, required)
  - closes on (a date)
  - status (open, filled or closed, open by default)
  Each job lists its applications.

Applications
  Applications have:
  - a job (a job, required, unique)
  - a name (required)
  - a phone
  - a message (required)
  - a resume (a document)
  - status (submitted, shortlisted, hired or declined, submitted by default)

Mark filled
  For a job that is open; sets status to filled.
  Mark a job as filled once someone has been hired.

Close job
  For a job that is open; sets status to closed.
  Close a job to new applications without filling it.

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
  - member (A union member who browses jobs and applies): opens the jobs page and the applications page; adds applications
  - staff (Union staff who post jobs and handle applications): opens every page; sees everyone's jobs and applications; adds every kind of record; changes everyone's jobs and applications; deletes everyone's jobs
  New users get the member role.
  Open to anyone without signing in: the home page, the jobs page, the privacy page and reading jobs where status is open.
  Everyone who signs in can ask the app questions; it changes nothing. It answers plainly.

Assumed:
  Who posts the jobs? Union staff post and manage all jobs (or: Employers sign in and post their own jobs, Any member may post a job)
  Who may create an account? Anyone may sign up to apply (or: Only people the union invites, Only addresses on the union's email domain)
  What can visitors see without signing in? Open job posts, but not applications (or: Nothing; everything needs sign-in, Filled and closed jobs too)
  Should anyone be emailed about applications? No emails for now (or: Email staff when an application arrives, Email the applicant when their status changes)
Frontier model (claude-opus-5-5) · 4,160 tokens (1,963 in, 2,197 out) · $0.0596
Pictures from the Smithable image library: hero.webp, logo.webp.
Generated 154 files (154 changed, 0 removed).

Created /tmp/smithable-bench-m12-k8cL7l/app-6. Open it in Studio, to see it and change it:

  cd /tmp/smithable-bench-m12-k8cL7l/app-6
  smithable studio

or only run the app with smithable run.
/tmp/smithable-bench-m12-k8cL7l/app-6/smithable.content.yml:3:3  warning  The privacy page "privacy" does not say who runs the app: give the operator's name under pages.privacy.operator (name, address, email, country, hosting).
```

### 7. A football club's site: teams, players, matches and results.

```text
Riverside FC
  The club's site with its teams, players, fixtures and results.

Pages
  - Home (a landing page: hero, matches where status is scheduled, matches where status is played, teams and footer)
  - Fixtures & results (lists matches; search by opponent or competition; filter by team, status, venue or kickoff; “Record result”; “Postpone”)
  - Teams (lists teams)
  - Players (lists players; search by name; filter by team or position)
  - Privacy (a privacy page written from the app: who runs it, what it stores and why, cookies, mail, logs, your rights)

Teams
  Teams have:
  - a name (required)
  - an age group
  - a division
  - a coach
  - a picture
  - about
  Each team lists its players.
  Each team lists its matches.

Players
  Players have:
  - a name (required)
  - a team (a team, required)
  - a position (goalkeeper, defender, midfielder or forward, goalkeeper by default)
  - a number (a whole number)
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
  - our goals (a whole number)
  - their goals (a whole number)
  - a report
  A match is named after its team and its opponent.

Record result
  For a match that is scheduled or postponed; sets status to played; asks for the our goals and the their goals.
  Enter the final score once a match has been played.

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
Frontier model (claude-opus-5-5) · 4,436 tokens (2,121 in, 2,315 out) · $0.0633
Pictures from the Smithable image library: samples/team-1.webp, samples/team-2.webp, samples/team-3.webp, samples/player-1.webp, hero.webp, logo.webp.
Generated 150 files (150 changed, 0 removed).

Created /tmp/smithable-bench-m12-k8cL7l/app-7. Open it in Studio, to see it and change it:

  cd /tmp/smithable-bench-m12-k8cL7l/app-7
  smithable studio

or only run the app with smithable run.
/tmp/smithable-bench-m12-k8cL7l/app-7/smithable.content.yml:3:3  warning  The privacy page "privacy" does not say who runs the app: give the operator's name under pages.privacy.operator (name, address, email, country, hosting).
```

### 8. Event registration for a conference: talks, speakers and attendees.

```text
Conference Hub
  Talks, speakers and attendee registration for a conference.

Pages
  - Home (a landing page: hero, features, speakers, faq, call to action and footer)
  - Schedule (a calendar of talks by week or month)
  - Talks (lists talks; filter by speaker or starts at; only for admins)
  - Speakers (lists speakers; only for admins; visitors see speakers on the Home page)
  - My registrations (lists registrations)
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
  - a summary
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
  What does an attendee register for? Each talk on its own, with a limited number of seats per talk (or: One registration for the whole conference, A ticket for the conference plus seats in chosen talks)
  What can visitors see without signing in? The schedule of talks and the speakers (or: Only the landing page, Nothing: everything needs sign-in)
  Who may sign up as an attendee? Anyone with an email address (or: Only invited attendees, Only addresses from certain domains)
  Can people cancel a registration? Yes, until the talk starts (or: Up to a day before the talk, Never; only organisers can cancel)
Frontier model (claude-opus-5-5) · 3,371 tokens (1,761 in, 1,610 out) · $0.0463
Pictures from the Smithable image library: samples/speaker-1.webp, hero.webp, logo.webp.
Generated 163 files (163 changed, 0 removed).

Created /tmp/smithable-bench-m12-k8cL7l/app-8. Open it in Studio, to see it and change it:

  cd /tmp/smithable-bench-m12-k8cL7l/app-8
  smithable studio

or only run the app with smithable run.
/tmp/smithable-bench-m12-k8cL7l/app-8/smithable.yml:40:14  warning  Page "schedule" is a calendar, but the app has no time zone: records are placed in UTC.
    hint: Set "timezone" under "app", e.g. "Europe/Mariehamn".
/tmp/smithable-bench-m12-k8cL7l/app-8/smithable.content.yml:3:3  warning  The privacy page "privacy" does not say who runs the app: give the operator's name under pages.privacy.operator (name, address, email, country, hosting).
```

### 9. A help desk for an IT team: tickets, priorities and who handles them.

```text
IT Help Desk
  The IT team's tickets: what is wrong, how urgent it is and who is handling it.

Pages
  - Tickets (lists tickets; search by title or requester email; filter by status, priority, category or assignee; sort by priority or date added; “Assign to me”; “Assign to”; “Start work”; “Resolve”; “Reopen”)
  - Team (who has access: invite people, change roles, remove users; only for admins)

Tickets
  Tickets have:
  - a title (required)
  - a requester email (required, fixed once made)
  - a category (hardware, software, network, access or other, hardware by default)
  - status (open, in progress, resolved or reopened, open by default)
  - a priority (a whole number, required, 3 by default)
  - a description
  - attachments (documents)
  - resolved at (a date and time, filled by the app)
  Each ticket can have an assignee (a user, required when status is in progress or resolved).
  Each ticket lists its comments.

Comments
  Comments have:
  - a content (required)
  - attachments (documents)
  - a ticket (a ticket, required)
  Each comment can have an author (a user, who makes it, by default, filled by the app).

Assign to me
  Sets assignee to whoever presses it.
  Take the ticket: you become the one handling it.

Assign to
  Asks for the assignee.
  Give the ticket to someone on the IT team.

Start work
  For a ticket that is open or reopened; sets status to in progress.
  Someone is working on the ticket now; it needs an assignee.

Resolve
  For a ticket that is open, in progress or reopened; sets status to resolved and resolved at to now.
  The problem is fixed.

Reopen
  For a ticket that is resolved; sets status to reopened.
  The problem came back or was not fully fixed.

Sign-in and access
  People sign in with a code sent to their email.
  Everyone who signs in sees all records, and changes and deletes the ones they own.
  Roles:
  - admin: everything
  - agent (Works the tickets: takes them, passes them on and resolves them): opens the tickets page; adds every kind of record; changes everyone's records; runs every custom action
  New users get the agent role.
  Everyone who signs in can ask the app questions; it changes nothing. It answers plainly.
Frontier model (claude-opus-5-5) · 3,253 tokens (1,814 in, 1,439 out) · $0.0433
Pictures from the Smithable image library: logo.webp.
Generated 146 files (146 changed, 0 removed).

Created /tmp/smithable-bench-m12-k8cL7l/app-9. Open it in Studio, to see it and change it:

  cd /tmp/smithable-bench-m12-k8cL7l/app-9
  smithable studio

or only run the app with smithable run.
```

### 10. A recipe collection for a family, with ingredients and shopping lists.

```text
Family Cookbook
  A family's shared recipe collection, with each recipe's ingredients and the shopping lists for the week.

Pages
  - Recipes (lists recipes; search by name or summary; filter by category or favorite)
  - Shopping lists (lists shopping lists; filter by status or for date; “Mark done”)
  - Family (who has access: invite people, change roles, remove users; only for admins)

Recipes
  Recipes have:
  - a name (required)
  - a summary
  - a category (main, starter, dessert, baking, breakfast, side or drink, main by default)
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
  - a for date
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
  Close a shopping list once everything on it is bought.

Sign-in and access
  People sign in with a code sent to their email.
  Everyone who signs in sees all records, and changes and deletes the ones they own.
  Roles:
  - admin: everything
  - member: opens every page; adds every kind of record
  New users get the member role.
  Everyone who signs in can ask the app questions; it changes nothing. It answers plainly.

Assumed:
  Should the recipes be visible to anyone on the internet? No, only invited family members sign in and see everything (or: Recipes are public, shopping lists private, Anyone may sign up and keep their own recipes)
  Who may add and change recipes and shopping lists? Every family member sees and edits the same recipes and lists (or: Only parents add recipes, everyone uses the lists, Each person keeps their own recipes)
  How are shopping list items added? Typed into the list by hand, with a tick for bought (or: Picked from a recipe's ingredients, Grouped by shop or aisle)
Frontier model (claude-opus-5-5) · 4,615 tokens (2,172 in, 2,443 out) · $0.0662
Pictures from the Smithable image library: logo.webp.
Generated 147 files (147 changed, 0 removed).

Created /tmp/smithable-bench-m12-k8cL7l/app-10. Open it in Studio, to see it and change it:

  cd /tmp/smithable-bench-m12-k8cL7l/app-10
  smithable studio

or only run the app with smithable run.
```

### 11. A status page for our API, with incidents and planned maintenance.

```text
API Status
  The live state of our API: open incidents, their updates and planned maintenance.

Pages
  - Home (a landing page: hero, components, incidents where status is investigating or identified or monitoring, maintenances, incidents where status is resolved and footer)
  - Incidents (lists incidents; filter by status or component; “Identified”; “Monitoring”; “Resolve”)
  - Updates (lists incident updates)
  - Maintenance (lists maintenances)
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
  Everyone who signs in can ask the app questions; it changes nothing. It answers plainly.

Assumed:
  What can visitors see without signing in? The status page with components, open incidents, planned maintenance and the incident history (or: Only the current component statuses, Everything, including the internal summaries)
  Who writes incidents and maintenance? Invited team members (staff); admins also manage the components and the team (or: Only administrators, Anyone on the team may manage components too)
  What should the status page be called? API Status (or: Your company name + Status, Service Health)
  Should outside tools be able to open incidents automatically? No, the team enters incidents by hand for now (or: An API key for a monitoring tool, A chat slash command that opens an incident)
Frontier model (claude-opus-5-5) · 4,775 tokens (2,321 in, 2,454 out) · $0.0676
Pictures from the Smithable image library: hero.webp, logo.webp.
Generated 157 files (157 changed, 0 removed).

Created /tmp/smithable-bench-m12-k8cL7l/app-11. Open it in Studio, to see it and change it:

  cd /tmp/smithable-bench-m12-k8cL7l/app-11
  smithable studio

or only run the app with smithable run.
/tmp/smithable-bench-m12-k8cL7l/app-11/smithable.content.yml:3:3  warning  The privacy page "privacy" does not say who runs the app: give the operator's name under pages.privacy.operator (name, address, email, country, hosting).
```

### 12. A public uptime page for a web shop: which services work, outages and their updates.

```text
Shop Status
  Is the shop working? The state of our services, outages and their updates, live.

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
  For an incident that is investigating; sets status to identified; adds an incident update (at now, status identified, message The cause is found and a fix is being worked on.).
  The cause is found; the incident moves to identified, with an update saying so.

Monitoring
  For an incident that is investigating or identified; sets status to monitoring; adds an incident update (at now, status monitoring, message A fix is out. We are watching before we close this.).
  A fix is out; the incident is watched before it is closed, with an update saying so.

Resolve
  For an incident that is investigating, identified or monitoring; sets status to resolved and resolved at to now; adds an incident update (at now, status resolved, message This incident is resolved.).
  The outage is over, with an update saying so.

Sign-in and access
  People sign in with a code sent to their email.
  Everyone who signs in sees all records, and changes and deletes the ones they own.
  Roles:
  - admin: everything
  - staff (Writes incidents and their updates): opens the overview page, the incidents page and the updates page; adds every kind of record; changes everyone's records
  New users get the staff role.
  Open to anyone without signing in: the home page, the privacy page, reading components, reading incidents where status is investigating or identified or monitoring or resolved and reading incident updates.
  Everyone who signs in can ask the app questions; it changes nothing. It answers plainly.

Assumed:
  Should the page also announce planned maintenance? No, only services, outages and their updates for now (or: Yes, add planned maintenance windows per service)
  Who writes the incidents and updates? An invited team (staff); admins also manage the services and the team (or: Only the administrators, Anyone in the team manages services too)
  What do visitors see on the public page? Each service's state, ongoing incidents, recently resolved ones and a full incident history (or: Only the services' current state, Also an uptime chart per service (needs custom code))
Frontier model (claude-opus-5-5) · 3,774 tokens (2,062 in, 1,712 out) · $0.0507
Pictures from the Smithable image library: hero.webp, logo.webp.
Generated 151 files (151 changed, 0 removed).

Created /tmp/smithable-bench-m12-k8cL7l/app-12. Open it in Studio, to see it and change it:

  cd /tmp/smithable-bench-m12-k8cL7l/app-12
  smithable studio

or only run the app with smithable run.
/tmp/smithable-bench-m12-k8cL7l/app-12/smithable.content.yml:3:3  warning  The privacy page "privacy" does not say who runs the app: give the operator's name under pages.privacy.operator (name, address, email, country, hosting).
```
