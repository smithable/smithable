# M12 first builds: claude-code (2026-11-07)

The app descriptions, each started with `smithable new --describe … --yes` (the starter the first step picks, adapted by the model; errors go back up to four times). Totals: 12 / 12 created, 12 type-check, 886,391 tokens (850,497 in, 35,894 out), $1.6117 (as Claude Code reports it); 0 model calls answered from the response cache. *Rounds* counts the model's drafting calls: the first draft and each round of corrections after it.

| Description | Starter | Created | Type-checks | Tokens in | Tokens out | Cost | Cached calls | Rounds | Time |
|---|---|---|---|---|---|---|---|---|---|
| A booking site for a yoga studio, with classes, teachers and online booking. | booking | yes | yes | 66,724 | 3,024 | $0.5943 | 0 | – | 164 s |
| A CRM for a small sales team: companies, contacts, deals and follow-ups. | crm | yes | yes | 65,429 | 2,845 | $0.0878 | 0 | – | 186 s |
| Invoicing for freelancers, with clients, invoices and payments. | invoicing | yes | yes | 132,647 | 5,028 | $0.1767 | 0 | – | 188 s |
| A tool library where neighbors lend each other tools. | marketplace | yes | yes | 64,627 | 2,731 | $0.0791 | 0 | – | 139 s |
| An inventory app for a small bakery: ingredients, suppliers and stock levels. | records | yes | yes | 64,381 | 2,130 | $0.0651 | 0 | – | 133 s |
| A job board for a local union, with job posts and applications. | marketplace | yes | yes | 64,627 | 3,604 | $0.0966 | 0 | – | 172 s |
| A football club's site: teams, players, matches and results. | records | yes | yes | 64,370 | 2,541 | $0.0733 | 0 | – | 144 s |
| Event registration for a conference: talks, speakers and attendees. | booking | yes | yes | 66,720 | 3,676 | $0.1148 | 0 | – | 100 s |
| A help desk for an IT team: tickets, priorities and who handles them. | support | yes | yes | 65,108 | 2,215 | $0.0727 | 0 | – | 88 s |
| A recipe collection for a family, with ingredients and shopping lists. | records | yes | yes | 64,376 | 1,887 | $0.0602 | 0 | – | 98 s |
| A status page for our API, with incidents and planned maintenance. | status | yes | yes | 65,742 | 3,191 | $0.0972 | 0 | – | 87 s |
| A public uptime page for a web shop: which services work, outages and their updates. | status | yes | yes | 65,746 | 3,022 | $0.0939 | 0 | – | 90 s |

Each created app's four spec files are in [m12-first-builds-claude-code/](m12-first-builds-claude-code/), one folder per description (app-1 …).

<!-- scorecard -->
## Scorecard (scripts/bench-m12.mjs --score)

0 of 12 drafts end with a warning about what is public (*Public flaws left*: public-personal-data, public-page-closed-records, contact-form-closed, shortcut-closed, mine-public, visitors-read-drafts); since #266 a draft with one goes back to the model once to fix it. *API app*, for the second set's two descriptions of apps for programs and assistants: "yes" when the draft has no landing page, an `api` block, tools when the description names an assistant, and a role other than admin for keys; otherwise what it lacks.

| # | Starter | Questions | Models kept | Pages kept | Actions kept | Access; roles (default) | Pages with access | Public | Warnings | Public flaws left | API app | Starter's texts in the draft | Models with the starter's samples | Visitors / landing |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | booking | 3 | 4 / 6 (has 4) | 8 / 13 (has 8) | 0 / 1 (has 0) | private; admin, staff, member (member) | none | pages home, schedule, privacy; read ClassType, Instructor, Session; create none | 1 (operator-unknown) | none |  | none | 3 / 4 | mentions visitors; landing page |
| 2 | crm | 2 | 1 / 3 (has 4) | 3 / 5 (has 6) | 0 / 2 (has 3) | shared; admin, sales (sales) | none | pages none; read none; create none | 0 | none |  | none | 0 / 4 | no mention; no landing page |
| 3 | invoicing | 2 | 3 / 4 (has 4) | 5 / 7 (has 6) | 3 / 3 (has 3) | private; admin, member (member) | none | pages home, privacy; read none; create none | 1 (operator-unknown) | none |  | none | 3 / 4 | no mention; landing page |
| 4 | marketplace (words: records) | 3 | 0 / 1 (has 2) | 1 / 5 (has 5) | 0 / 0 (has 1) | private; admin, member (member) | none | pages home, tools, privacy; read Tool; create none | 1 (operator-unknown) | none |  | none | 0 / 2 | no mention; landing page |
| 5 | records (words: api) | 3 | 0 / 1 (has 2) | 0 / 2 (has 3) | 0 / 0 (has 0) | shared; admin, member (member) | none | pages none; read none; create none | 0 | none |  | none | 0 / 2 | no mention; no landing page |
| 6 | marketplace | 3 | 0 / 1 (has 2) | 1 / 5 (has 5) | 0 / 0 (has 5) | private; admin, member (member) | none | pages home, jobs, privacy; read Job; create none | 1 (operator-unknown) | none |  | none | 0 / 2 | no mention; landing page |
| 7 | records (words: booking) | 3 | 0 / 1 (has 3) | 1 / 2 (has 5) | 0 / 0 (has 2) | private; admin, member (member) | none | pages home, matches, teams, players, privacy; read Team, Player, Match; create none | 1 (operator-unknown) | none |  | none | 0 / 3 | mentions visitors; landing page |
| 8 | booking (words: records) | 3 | 0 / 6 (has 3) | 3 / 13 (has 7) | 0 / 1 (has 0) | private; admin, organizer, attendee (attendee) | none | pages home, schedule, speakers, privacy; read Talk, Speaker; create none | 1 (operator-unknown) | none |  | none | 0 / 3 | no mention; landing page |
| 9 | support (words: booking) | 3 | 2 / 2 (has 2) | 1 / 2 (has 2) | 5 / 5 (has 5) | shared; admin, agent (agent) | none | pages none; read none; create none | 0 | none |  | none | 0 / 2 | no mention; no landing page |
| 10 | records | 3 | 0 / 1 (has 4) | 0 / 2 (has 3) | 0 / 0 (has 1) | shared; admin, member (member) | none | pages none; read none; create none | 0 | none |  | none | 0 / 4 | no mention; no landing page |
| 11 | status | 3 | 4 / 4 (has 4) | 7 / 8 (has 8) | 3 / 3 (has 3) | shared; admin, staff (staff) | none | pages home, privacy; read Component, Incident, IncidentUpdate, Maintenance; create none | 2 (operator-unknown, thread-needs-form) | none |  | none | 4 / 4 | no mention; landing page |
| 12 | status | 3 | 3 / 4 (has 3) | 4 / 8 (has 5) | 3 / 3 (has 3) | shared; admin, staff (staff) | none | pages home; read Component, Incident, IncidentUpdate; create none | 1 (operator-unknown) | none |  | none | 3 / 3 | mentions visitors; landing page |

"Kept" counts the starter's models, pages and actions that the draft still has by name, with how many the draft has in all; "left out" names what the draft dropped because it could not be made valid: an action by its name, anything else (a formula field, a capacity) with its operation. "Starter's texts" lists the starter's app name or sample titles found in the draft's spec or content. "Models with the starter's samples" counts the draft's models that keep some of the starter's sample records after `fitSamples`; the rest get generated rows. "Mentions visitors" means the description says visitors, public or site. "Starter" is the one `new --describe --yes` printed, with the word-match starter (`closestStarter`) beside it when it differs; "Questions" counts what `smithable clarify` would ask (`--yes` asks nothing), with their language for a description not in English.
<!-- /scorecard -->

## Summaries, for review

### 1. A booking site for a yoga studio, with classes, teachers and online booking.

```text
Open Sky Yoga
  Class schedule, teachers and online booking for a yoga studio.

Pages
  - Home (a landing page: hero, class types, teachers, faq, call to action and footer)
  - Schedule (a calendar of sessions by week or month; filter by classType or instructor)
  - My bookings (lists bookings; only the viewer's own records; only for members and admins)
  - Sessions (lists sessions; filter by class type, teacher or starts at; sort by starts at or capacity; only for staff users and admins)
  - Bookings (lists bookings; only for staff users and admins)
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
  - staff (Reception. Runs the sessions and who comes to them): opens the sessions page and the bookings page; sees everyone's sessions and bookings; adds sessions and bookings; changes everyone's sessions and bookings; deletes everyone's bookings
  - member (A student who books classes): opens the my bookings page; adds bookings
  New users get the member role.
  Open to anyone without signing in: the home page, the schedule page, the privacy page, reading class types, reading instructors and reading sessions.
  Everyone who signs in can ask the app questions; it changes nothing. It answers plainly.

Assumed:
  Who can create an account to book? Anyone can sign up with their email and book classes (or: Only people the studio invites, Only members with a paid pass)
  What can visitors see without signing in? The home page, the weekly schedule, class types and teachers (or: Only the home page, Everything except bookings, including a blog)
  Who runs the studio day to day? Admins plus a staff role that manages sessions and bookings (or: Only admins, Teachers who manage their own sessions)
  What can members cancel, and until when? Their own booking, up to two hours before the class (or: Up to 24 hours before, Until the class starts, Only the studio cancels)
Frontier model (claude-opus-5-5) · 3,445 tokens (1,970 in, 1,475 out) · $0.0453
Pictures from the Smithable image library: samples/instructor-1.webp, hero.webp, logo.webp.
Generated 168 files (168 changed, 0 removed).

Created /tmp/smithable-bench-m12-bBIvqH/app-1. Open it in Studio, to see it and change it:

  cd /tmp/smithable-bench-m12-bBIvqH/app-1
  smithable studio

or only run the app with smithable run.
/tmp/smithable-bench-m12-bBIvqH/app-1/smithable.content.yml:11:3  warning  The privacy page "privacy" does not say who runs the app: give the operator's name under pages.privacy.operator (name, address, email, country, hosting).
```

### 2. A CRM for a small sales team: companies, contacts, deals and follow-ups.

```text
Pipeline CRM
  A CRM for a small sales team to track companies, contacts, deals and follow-ups.

Pages
  - Start (a dashboard: open deals, pipeline value, deals by stage and follow ups due)
  - Companies (lists companies; search by name or industry; sort by name or date added)
  - Contacts (lists contacts; search by name, email or job title; filter by company)
  - Deals (lists deals; search by title; filter by stage, company or expected close; sort by expected close, value or title; “Mark won”; “Mark lost”)
  - Follow ups (lists follow ups; filter by done, company or due on; “Mark done”)
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
  - a company (a company, required)
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
  Each deal lists its follow ups.
  Deleted deals stay in the trash for thirty days, where they can be restored.

Follow ups
  Follow ups have:
  - a company (a company, required)
  - a deal (a deal)
  - due on (a date, required, today by default)
  - done (yes or no)
  - a note
  Deleted follow ups stay in the trash for thirty days, where they can be restored.

Mark won
  For a deal that is lead, qualified, proposal or negotiation; sets stage to won and closed on to today.
  Close a deal as won.

Mark lost
  For a deal that is lead, qualified, proposal or negotiation; sets stage to lost and closed on to today.
  Close a deal as lost.

Mark done
  For a follow up that is not done; sets done to yes.
  Tick off a follow-up once it is done.

Sign-in and access
  People sign in with a code sent to their email.
  Everyone who signs in sees all records, and changes and deletes the ones they own.
  Roles:
  - admin: everything
  - sales (Works with companies, contacts, deals and follow-ups): opens the start page, the companies page, the contacts page, the deals page and the follow ups page; adds every kind of record; changes everyone's records
  New users get the sales role.
  Everyone who signs in can ask the app questions; it changes nothing. It answers plainly.
Frontier model (claude-opus-5-5) · 5,254 tokens (2,376 in, 2,878 out) · $0.0766
Pictures from the Smithable image library: logo.webp.
Generated 166 files (166 changed, 0 removed).

Created /tmp/smithable-bench-m12-bBIvqH/app-2. Open it in Studio, to see it and change it:

  cd /tmp/smithable-bench-m12-bBIvqH/app-2
  smithable studio

or only run the app with smithable run.
```

### 3. Invoicing for freelancers, with clients, invoices and payments.

```text
Billfold
  Invoicing for freelancers: keep your clients, send invoices and record the payments that come in.

Pages
  - Home (a landing page: hero, features, faq, call to action and footer)
  - Overview (a dashboard: received, outstanding, overdue, invoiced and latest)
  - Clients (lists clients; search by name or email)
  - Payments (lists payments; filter by invoice, method or paid on)
  - Privacy (a privacy page written from the app: who runs it, what it stores and why, cookies, mail, logs, your rights)
  - Invoices (lists invoices; search by number; filter by client or status; sort by issued on, due on or number; “Mark sent”; “Mark paid”; “Mark overdue”)

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

Mark overdue
  When an invoice's due on comes, where status is sent: runs “Mark overdue”.

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
  Who sees which records? Each freelancer sees only their own clients, invoices and payments (or: A small team shares all clients and invoices)
  How are payments recorded? Several payments per invoice, so partial payments leave a balance (or: One payment per invoice, marking it paid, Only a paid status, no payment records)
  Who may sign up? Any freelancer can sign up from the public landing page (or: Only invited people, No landing page, sign-in only)
  Should the freelancer's own business details be stored? Not in this first version (or: A settings page with business name, VAT number and IBAN)
Frontier model (claude-opus-5-5) · 5,117 tokens (2,317 in, 2,800 out) · $0.0745
Pictures from the Smithable image library: hero.webp, logo.webp.
Generated 163 files (163 changed, 0 removed).

Created /tmp/smithable-bench-m12-bBIvqH/app-3. Open it in Studio, to see it and change it:

  cd /tmp/smithable-bench-m12-bBIvqH/app-3
  smithable studio

or only run the app with smithable run.
/tmp/smithable-bench-m12-bBIvqH/app-3/smithable.content.yml:3:3  warning  The privacy page "privacy" does not say who runs the app: give the operator's name under pages.privacy.operator (name, address, email, country, hosting).
```

### 4. A tool library where neighbors lend each other tools.

```text
Toolshed
  Neighbors share their tools: list what you own, find what you need, and keep track of what is lent out.

Pages
  - Tools (lists tools; search by name, description or place; filter by category, condition or available; records can be saved as favorites; contact the owner by mail)
  - My tools (lists tools; only the viewer's own records)
  - Lent out (lists loans; filter by status or tool; “Mark returned”)
  - Home (a landing page: hero, features, faq and footer)
  - Privacy (a privacy page written from the app: who runs it, what it stores and why, cookies, mail, logs, your rights)

Tools
  Tools have:
  - a name (required)
  - photos (pictures)
  - a description
  - a category (power tools, hand tools, garden, ladders, cleaning, camping or other, power tools by default)
  - a condition (like new, good or worn, like new by default)
  - a place
  - available (yes or no, true by default)

Loans
  Loans have:
  - a tool (a tool, required)
  - lent on (a date, required)
  - due on (a date)
  - status (lent or returned, lent by default)
  - a note
  Each loan can have a borrower (a user).

Mark returned
  For a loan that is lent; sets status to returned.
  The lender records that the tool came back.

Sign-in and access
  People sign in with a code sent to their email.
  Everyone sees, changes and deletes only their own records.
  Roles:
  - admin: everything
  - member: opens every page; adds every kind of record
  New users get the member role.
  Open to anyone without signing in: the home page, the tools page, the privacy page and reading tools.
  Everyone who signs in can ask the app questions; it changes nothing. It answers plainly.
Frontier model (claude-opus-5-5) · 2,407 tokens (1,647 in, 760 out) · $0.0284
Pictures from the Smithable image library: samples/tool-1.webp, samples/tool-2.webp, samples/tool-3.webp, samples/tool-4.webp, samples/tool-5.webp, samples/tool-6.webp, hero.webp, logo.webp.
Generated 151 files (151 changed, 0 removed).

Created /tmp/smithable-bench-m12-bBIvqH/app-4. Open it in Studio, to see it and change it:

  cd /tmp/smithable-bench-m12-bBIvqH/app-4
  smithable studio

or only run the app with smithable run.
/tmp/smithable-bench-m12-bBIvqH/app-4/smithable.content.yml:3:3  warning  The privacy page "privacy" does not say who runs the app: give the operator's name under pages.privacy.operator (name, address, email, country, hosting).
```

### 5. An inventory app for a small bakery: ingredients, suppliers and stock levels.

```text
Bakery Pantry
  Keeps track of the bakery's ingredients, their suppliers and how much of each is in stock.

Pages
  - Ingredients (lists ingredients; search by name or notes)
  - Suppliers (lists suppliers; search by name, contact name or email)
  - Team (who has access: invite people, change roles, remove users; only for admins)

Suppliers
  Suppliers have:
  - a name (required, unique)
  - a contact name
  - an email
  - a phone
  - a website (a web address)
  - notes
  Each supplier lists its ingredients.

Ingredients
  Ingredients have:
  - a name (required, unique)
  - a category (other, flour, sugar, dairy, eggs, fats, yeast, spices, fruit and nuts or chocolate, other by default)
  - a unit (kg, g, l, ml or pieces, kg by default)
  - an in stock (a number, required, 0 by default)
  - a reorder level (a number)
  - a unit cost (an amount)
  - a supplier (a supplier)
  - notes
  The low stock is calculated as the in stock is at most the reorder level.

Sign-in and access
  People sign in with a code sent to their email.
  Everyone who signs in sees all records, and changes and deletes the ones they own.
  Roles:
  - admin: everything
  - member (Works in the bakery and keeps the stock up to date): opens every page; adds every kind of record; changes everyone's ingredients and suppliers
  New users get the member role.
  Everyone who signs in can ask the app questions; it changes nothing. It answers plainly.

Assumed:
  Who can see and change the stock? Everyone invited to the bakery's team sees all records and can update any ingredient or supplier (or: Only administrators change records, others only look, Each person sees only the records they added)
  How are stock levels kept? Each ingredient holds its current amount and a reorder level, and is marked low when it falls to that level (or: Record every delivery and use as a stock movement, Regular stock counts with a date)
  Which currency are ingredient costs in? Euro (EUR) (or: Swedish krona (SEK), US dollar (USD), British pound (GBP))
  Is anything shown to the public? No, the app is only for the bakery's own team (or: A public page listing the bakery's products, A contact form for suppliers)
Frontier model (claude-opus-5-5) · 3,638 tokens (2,002 in, 1,636 out) · $0.0487
Pictures from the Smithable image library: logo.webp.
Generated 134 files (134 changed, 0 removed).

Created /tmp/smithable-bench-m12-bBIvqH/app-5. Open it in Studio, to see it and change it:

  cd /tmp/smithable-bench-m12-bBIvqH/app-5
  smithable studio

or only run the app with smithable run.
```

### 6. A job board for a local union, with job posts and applications.

```text
Local Union Job Board
  Job openings shared with union members, who apply online and follow their applications.

Pages
  - Home (a landing page: hero, jobs where status is open, features, faq and footer)
  - Jobs (lists jobs; search by title, employer, location or description; filter by trade, job type, status or closes on; records can be saved as favorites; “Mark filled”; “Close job”)
  - My applications (lists applications; only the viewer's own records)
  - Applications (lists applications; filter by job or status; only for admins)
  - Privacy (a privacy page written from the app: who runs it, what it stores and why, cookies, mail, logs, your rights)

Jobs
  Jobs have:
  - a title (required)
  - an employer (required)
  - a trade (construction, electrical, plumbing, manufacturing, transport, healthcare, office or other, construction by default)
  - a job type (full time, part time, temporary or apprenticeship, full time by default)
  - a location
  - a pay
  - a description (required)
  - starts on (a date)
  - closes on (a date)
  - status (open, filled or closed, open by default)
  Each job lists its applications.

Applications
  Applications have:
  - a job (a job, required, unique)
  - a name (required)
  - an email (required)
  - a phone
  - a message
  - a resume (a document)
  - status (submitted, reviewing, accepted or declined, submitted by default)

Mark filled
  For a job that is open; sets status to filled.

Close job
  For a job that is open; sets status to closed.

Start review
  For an application that is submitted; sets status to reviewing.

Accept
  For an application that is submitted or reviewing; sets status to accepted.

Decline
  For an application that is submitted or reviewing; sets status to declined.

Application received
  When a application is added: mails every admin.

Application answered
  When a application changes so that status is accepted or declined: mails email.

Sign-in and access
  People sign in with a code sent to their email.
  Everyone sees, changes and deletes only their own records.
  Roles:
  - admin: everything
  - member (Union member who browses job posts and applies for them): opens the jobs page and the my applications page; sees everyone's jobs; adds applications
  New users get the member role.
  Open to anyone without signing in: the home page, the jobs page, the privacy page and reading jobs where status is open.
  Everyone who signs in can ask the app questions; it changes nothing. It answers plainly.

Assumed:
  Who posts jobs and handles applications? Union staff (admins) post jobs and review all applications; members only apply. (or: A separate staff role besides the admins, Employers sign in and post their own jobs)
  Who may create an account and apply? Anyone may sign up; staff check membership when they review applications. (or: Only members the union invites, Only addresses on the union's email domain)
  What can people see without signing in? The open jobs and the landing page; applications are never public. (or: Nothing; everything requires sign-in, All jobs, including filled and closed ones)
  Can a member apply to the same job more than once? No, one application per member per job. (or: Yes, as many times as they like)
Frontier model (claude-opus-5-5) · 4,412 tokens (2,064 in, 2,348 out) · $0.0635
Pictures from the Smithable image library: hero.webp, logo.webp.
Generated 161 files (161 changed, 0 removed).

Created /tmp/smithable-bench-m12-bBIvqH/app-6. Open it in Studio, to see it and change it:

  cd /tmp/smithable-bench-m12-bBIvqH/app-6
  smithable studio

or only run the app with smithable run.
/tmp/smithable-bench-m12-bBIvqH/app-6/smithable.content.yml:3:3  warning  The privacy page "privacy" does not say who runs the app: give the operator's name under pages.privacy.operator (name, address, email, country, hosting).
```

### 7. A football club's site: teams, players, matches and results.

```text
Clubhouse FC
  The football club's site: our teams, their players, the fixtures and the results.

Pages
  - Home (a landing page: hero, matches where status is scheduled, matches where status is played, teams and footer)
  - Matches (lists matches; search by opponent or ground; filter by team, status, competition, venue or kickoff; “Record result”; “Postpone”)
  - Teams (lists teams)
  - Players (lists players; search by name; filter by team or position)
  - Privacy (a privacy page written from the app: who runs it, what it stores and why, cookies, mail, logs, your rights)

Teams
  Teams have:
  - a name (required)
  - an age group (senior, youth, junior or veterans, senior by default)
  - a coach
  - a picture
  - about
  Each team lists its players.
  Each team lists its matches.

Players
  Players have:
  - a name (required)
  - a team (a team, required)
  - a number (a whole number)
  - a position (goalkeeper, defender, midfielder or forward, goalkeeper by default)
  - a picture
  - a bio

Matches
  Matches have:
  - a team (a team, required)
  - an opponent (required)
  - a kickoff (a date and time, required)
  - a venue (home or away, home by default)
  - a ground
  - a competition (league, cup or friendly, league by default)
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
  Who keeps the teams, players and results up to date? Only the club's administrators (or: Each team's coach updates their own team, Any signed-in club member)
  What can visitors see without signing in? Teams, players, fixtures and results (or: Only fixtures and results, Everything except player details)
  What does a player's page hold? Name, team, shirt number, position, photo and a short bio (or: Also date of birth and nationality, Also season stats like goals and appearances)
  What does the home page show? Upcoming fixtures, latest results and the teams (or: Also club news articles, Also a league table)
Frontier model (claude-opus-5-5) · 4,149 tokens (2,199 in, 1,950 out) · $0.0566
Pictures from the Smithable image library: samples/team-1.webp, samples/team-2.webp, samples/team-3.webp, samples/player-1.webp, hero.webp, logo.webp.
Generated 154 files (154 changed, 0 removed).

Created /tmp/smithable-bench-m12-bBIvqH/app-7. Open it in Studio, to see it and change it:

  cd /tmp/smithable-bench-m12-bBIvqH/app-7
  smithable studio

or only run the app with smithable run.
/tmp/smithable-bench-m12-bBIvqH/app-7/smithable.content.yml:3:3  warning  The privacy page "privacy" does not say who runs the app: give the operator's name under pages.privacy.operator (name, address, email, country, hosting).
```

### 8. Event registration for a conference: talks, speakers and attendees.

```text
Talkline Conference
  Programme, speakers and talk registration for a conference.

Pages
  - Home (a landing page: hero, features, speakers, faq, call to action and footer)
  - Schedule (a calendar of talks by week or month; filter by format or speaker)
  - Talks (lists talks; filter by format, speaker or starts at; only for organizers and admins)
  - Speakers (lists speakers)
  - My registrations (lists registrations)
  - Registrations (lists registrations; filter by talk; only for organizers and admins)
  - Privacy (a privacy page written from the app: who runs it, what it stores and why, cookies, mail, logs, your rights)

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
  - a format (talk, keynote, workshop or panel, talk by default)
  - a room
  - starts at (a date and time, required)
  - duration minutes (a whole number, required, 45 by default)
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
  - organizer (Runs the programme: talks, speakers and who attends): opens the talks page, the speakers page, the registrations page and the my registrations page; sees everyone's talks, speakers and registrations; adds talks, speakers and registrations; changes everyone's talks, speakers and registrations; deletes everyone's talks, speakers and registrations
  - attendee (Comes to the conference and registers for talks): opens the my registrations page; adds registrations
  New users get the attendee role.
  Open to anyone without signing in: the home page, the schedule page, the speakers page, the privacy page, reading talks and reading speakers.
  Everyone who signs in can ask the app questions; it changes nothing. It answers plainly.

Assumed:
  What do attendees register for? Individual talks, each with a limited number of seats (or: The conference as a whole, with a ticket type, Both the conference and individual talks)
  Who may create an account? Anyone can sign up as an attendee (or: Only invited people, Only addresses from certain domains)
  Who manages the programme? Organizers manage talks, speakers and registrations; attendees only their own registrations (or: Only administrators manage everything, Speakers also edit their own talks)
  What can visitors see without signing in? The schedule of talks and the speakers (or: Only the landing page, Everything, including who attends)
Frontier model (claude-opus-5-5) · 3,314 tokens (1,860 in, 1,454 out) · $0.0440
Pictures from the Smithable image library: samples/speaker-1.webp, hero.webp, logo.webp.
Generated 161 files (161 changed, 0 removed).

Created /tmp/smithable-bench-m12-bBIvqH/app-8. Open it in Studio, to see it and change it:

  cd /tmp/smithable-bench-m12-bBIvqH/app-8
  smithable studio

or only run the app with smithable run.
/tmp/smithable-bench-m12-bBIvqH/app-8/smithable.content.yml:3:3  warning  The privacy page "privacy" does not say who runs the app: give the operator's name under pages.privacy.operator (name, address, email, country, hosting).
```

### 9. A help desk for an IT team: tickets, priorities and who handles them.

```text
Fixdesk
  The IT team's help desk: tickets, their priorities and who handles them.

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

Assumed:
  Who signs in to the help desk? Only the IT team, invited from the team page; they log tickets on behalf of colleagues (or: Every employee signs in and raises their own tickets, Employees send tickets by email to a support address)
  What goes under a ticket? Internal notes from the team, shown as a thread (or: Replies emailed to the person who asked, No notes, only the ticket's fields)
  What may an IT team member do? Everyone on the team can see, change, assign and close every ticket (or: Team members change only tickets assigned to them, A lead assigns tickets; others only work their own)
Frontier model (claude-opus-5-5) · 3,392 tokens (1,773 in, 1,619 out) · $0.0466
Pictures from the Smithable image library: logo.webp.
Generated 152 files (152 changed, 0 removed).

Created /tmp/smithable-bench-m12-bBIvqH/app-9. Open it in Studio, to see it and change it:

  cd /tmp/smithable-bench-m12-bBIvqH/app-9
  smithable studio

or only run the app with smithable run.
```

### 10. A recipe collection for a family, with ingredients and shopping lists.

```text
Family Cookbook
  Our family's recipes with their ingredients, and the shopping lists we cook from.

Pages
  - Recipes (lists recipes; search by name or summary; filter by category or favorite)
  - Shopping lists (lists shopping lists; filter by status or shop on; “Mark done”)
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
  - a source (a web address)
  - favorite (yes or no)
  Each recipe lists its ingredients.

Ingredients
  Ingredients have:
  - a recipe (a recipe, required)
  - a name (required)
  - a quantity
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
  - a quantity
  - a for recipe (a recipe)
  - bought (yes or no)

Mark done
  For a shopping list that is open; sets status to done.
  Close a shopping list once the shopping is done.

Sign-in and access
  People sign in with a code sent to their email.
  Everyone who signs in sees all records, and changes and deletes the ones they own.
  Roles:
  - admin: everything
  - member (A family member who adds recipes and shopping lists): opens every page; adds every kind of record
  New users get the member role.
  Everyone who signs in can ask the app questions; it changes nothing. It answers plainly.

Assumed:
  Should the recipes be visible to anyone on the internet? No, only invited family members can see the recipes and lists (or: Recipes are public, shopping lists stay private, Everything is public to read)
  Who in the family sees which recipes and lists? Everyone who's invited sees and edits all recipes and shopping lists (or: Each person sees only their own lists, but recipes are shared, Only admins add recipes, and others just read them)
  How do ingredients get onto a shopping list? Items are typed into a list by hand, and each one can be linked to a recipe (or: A button copies a recipe's ingredients onto a list (needs custom code), Lists hold whole recipes, not single items)
  What does a recipe hold? Name, summary, category, servings, time, picture, instructions, source link and a favourite mark (or: Also a rating and notes from each cook, Just a name, ingredients and instructions)
Frontier model (claude-opus-5-5) · 5,367 tokens (2,286 in, 3,081 out) · $0.0799
Pictures from the Smithable image library: logo.webp.
Generated 153 files (153 changed, 0 removed).

Created /tmp/smithable-bench-m12-bBIvqH/app-10. Open it in Studio, to see it and change it:

  cd /tmp/smithable-bench-m12-bBIvqH/app-10
  smithable studio

or only run the app with smithable run.
```

### 11. A status page for our API, with incidents and planned maintenance.

```text
API Status
  Is our API working? Live state of its services, incidents and planned maintenance.

Pages
  - Home (a landing page: hero, components, incidents where status is investigating or identified or monitoring, maintenances, incidents where status is resolved and footer)
  - Overview (a dashboard: open, per month and latest)
  - Incidents (lists incidents; filter by status or component; “Identified”; “Monitoring”; “Resolve”)
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
  What can visitors see without signing in? The status page, the incident history with its updates, and planned maintenance (or: Only the current status of each service, Everything, including past maintenance)
  Who writes incidents and maintenance? Invited team members (staff); admins also manage the services and the team (or: Only admins, Anyone on the team, including managing the services)
  Which time zone are times shown in? UTC (or: Europe/Stockholm, America/New_York)
Frontier model (claude-opus-5-5) · 4,710 tokens (2,369 in, 2,341 out) · $0.0658
Pictures from the Smithable image library: hero.webp, logo.webp.
Generated 164 files (164 changed, 0 removed).

Created /tmp/smithable-bench-m12-bBIvqH/app-11. Open it in Studio, to see it and change it:

  cd /tmp/smithable-bench-m12-bBIvqH/app-11
  smithable studio

or only run the app with smithable run.
/tmp/smithable-bench-m12-bBIvqH/app-11/smithable.content.yml:3:3  warning  The privacy page "privacy" does not say who runs the app: give the operator's name under pages.privacy.operator (name, address, email, country, hosting).
/tmp/smithable-bench-m12-bBIvqH/app-11/smithable.ux.yml:6:18  warning  IncidentUpdate.at is required and the reply box does not ask for it: give it a default, or `by: app`, or the thread shows Add incident update instead.
```

### 12. A public uptime page for a web shop: which services work, outages and their updates.

```text
Shop Status
  Is the shop working? The live state of our web shop's services, outages and their updates.

Pages
  - Home (a landing page: hero, components, incidents where status is investigating or identified or monitoring, incidents where status is resolved and footer)
  - Incidents (lists incidents; filter by status or component; “Identified”; “Monitoring”; “Resolve”)
  - Components (lists components; only for admins; visitors see components on the Home page)
  - Privacy (a privacy page written from the app: who runs it, what it stores and why, cookies, mail, logs, your rights; only for admins)
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
  For an incident that is investigating, identified or monitoring; sets status to resolved and resolved at to now; adds an incident update (at now, status resolved, message This incident is resolved.).
  The outage is over, with an update saying so.

Sign-in and access
  People sign in with a code sent to their email.
  Everyone who signs in sees all records, and changes and deletes the ones they own.
  Roles:
  - admin: everything
  - staff (Reports outages and posts their updates): opens the incidents page; adds incidents and incident updates; changes everyone's incidents and incident updates
  New users get the staff role.
  Open to anyone without signing in: the home page, reading components, reading incidents where status is investigating or identified or monitoring or resolved and reading incident updates.
  Everyone who signs in can ask the app questions; it changes nothing. It answers plainly.

Assumed:
  Who writes outages and updates? An invited team: staff post outages and updates; admins also keep the list of services (or: Every team member also edits the services, Only admins write everything)
  Which time zone are outage times shown in? Europe/Stockholm (or: UTC, Europe/London, America/New_York)
  Should planned maintenance be listed too? No, only services, outages and their updates (or: Add a planned maintenance list on the status page)
  What do visitors see? The services' state, ongoing and recent outages with their updates, and the full incident history (or: Only the services' state and ongoing outages)
Frontier model (claude-opus-5-5) · 3,833 tokens (2,112 in, 1,721 out) · $0.0513
Pictures from the Smithable image library: hero.webp, logo.webp.
Generated 151 files (151 changed, 0 removed).

Created /tmp/smithable-bench-m12-bBIvqH/app-12. Open it in Studio, to see it and change it:

  cd /tmp/smithable-bench-m12-bBIvqH/app-12
  smithable studio

or only run the app with smithable run.
/tmp/smithable-bench-m12-bBIvqH/app-12/smithable.content.yml:3:3  warning  The privacy page "privacy" does not say who runs the app: give the operator's name under pages.privacy.operator (name, address, email, country, hosting).
```
