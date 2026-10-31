# M12 first builds: claude-code (2026-10-31)

The app descriptions, each started with `smithable new --describe … --yes` (the starter the first step picks, adapted by the model; errors go back up to four times). Totals: 12 / 12 created, 12 type-check, 758,833 tokens (722,800 in, 36,033 out), $1.4995 (as Claude Code reports it); 0 model calls answered from the response cache. *Rounds* counts the model's drafting calls: the first draft and each round of corrections after it.

| Description | Starter | Created | Type-checks | Tokens in | Tokens out | Cost | Cached calls | Rounds | Time |
|---|---|---|---|---|---|---|---|---|---|
| A booking site for a yoga studio, with classes, teachers and online booking. | booking | yes | yes | 56,679 | 3,011 | $0.5136 | 0 | – | 152 s |
| A CRM for a small sales team: companies, contacts, deals and follow-ups. | crm | yes | yes | 55,460 | 2,746 | $0.0816 | 0 | – | 162 s |
| Invoicing for freelancers, with clients, invoices and payments. | invoicing | yes | yes | 113,029 | 5,560 | $0.1815 | 0 | – | 212 s |
| A tool library where neighbors lend each other tools. | marketplace | yes | yes | 54,852 | 2,989 | $0.0816 | 0 | – | 190 s |
| An inventory app for a small bakery: ingredients, suppliers and stock levels. | records | yes | yes | 54,648 | 1,962 | $0.0595 | 0 | – | 157 s |
| A job board for a local union, with job posts and applications. | marketplace | yes | yes | 54,853 | 3,746 | $0.0968 | 0 | – | 156 s |
| A football club's site: teams, players, matches and results. | records | yes | yes | 54,638 | 2,947 | $0.0791 | 0 | – | 161 s |
| Event registration for a conference: talks, speakers and attendees. | booking | yes | yes | 56,676 | 3,021 | $0.0969 | 0 | – | 157 s |
| A help desk for an IT team: tickets, priorities and who handles them. | support | yes | yes | 55,348 | 2,034 | $0.0665 | 0 | – | 114 s |
| A recipe collection for a family, with ingredients and shopping lists. | records | yes | yes | 54,643 | 1,517 | $0.0505 | 0 | – | 106 s |
| A status page for our API, with incidents and planned maintenance. | status | yes | yes | 55,985 | 3,373 | $0.0984 | 0 | – | 108 s |
| A public uptime page for a web shop: which services work, outages and their updates. | status | yes | yes | 55,989 | 3,127 | $0.0935 | 0 | – | 92 s |

Each created app's four spec files are in [m12-first-builds-claude-code/](m12-first-builds-claude-code/), one folder per description (app-1 …).

<!-- scorecard -->
## Scorecard (scripts/bench-m12.mjs --score)

0 of 12 drafts end with a warning about what is public (*Public flaws left*: public-personal-data, public-page-closed-records, contact-form-closed, shortcut-closed, mine-public, visitors-read-drafts); since #266 a draft with one goes back to the model once to fix it. *API app*, for the second set's two descriptions of apps for programs and assistants: "yes" when the draft has no landing page, an `api` block, tools when the description names an assistant, and a role other than admin for keys; otherwise what it lacks.

| # | Starter | Questions | Models kept | Pages kept | Actions kept | Access; roles (default) | Pages with access | Public | Warnings | Public flaws left | API app | Starter's texts in the draft | Models with the starter's samples | Visitors / landing |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | booking | 2 | 4 / 6 (has 4) | 7 / 12 (has 7) | 0 / 1 (has 0) | private; admin, member (member) | none | pages home, schedule, privacy; read ClassType, Instructor, Session; create none | 2 (no-timezone, operator-unknown) | none |  | none | 3 / 4 | mentions visitors; landing page |
| 2 | crm | 2 | 1 / 3 (has 4) | 2 / 4 (has 5) | 0 / 2 (has 4) | shared; admin, sales (sales) | none | pages none; read none; create none | 0 | none |  | none | 0 / 4 | no mention; no landing page |
| 3 | invoicing | 2 | 3 / 4 (has 4) | 5 / 7 (has 7) | 3 / 3 (has 3) | private; admin, member (member) | none | pages home; read none; create none | 1 (operator-unknown) | none |  | none | 3 / 4 | no mention; landing page |
| 4 | marketplace (words: records) | 3 | 0 / 1 (has 2) | 4 / 5 (has 7) | 0 / 0 (has 1) | private; admin, member (member) | none | pages home, catalog, privacy; read Tool; create none | 1 (operator-unknown) | none |  | none | 0 / 2 | no mention; landing page |
| 5 | records (words: api) | 3 | 0 / 1 (has 2) | 0 / 2 (has 3) | 0 / 0 (has 0) | shared; admin, member (member) | none | pages none; read none; create none | 0 | none |  | none | 0 / 2 | no mention; no landing page |
| 6 | marketplace | 3 | 0 / 1 (has 2) | 1 / 5 (has 5) | 0 / 0 (has 5) | private; admin, staff, member (member) | none | pages home, jobs, privacy; read Job; create none | 3 (write-without-read, operator-unknown) | none |  | none | 0 / 2 | no mention; landing page |
| 7 | records (words: booking) | 3 | 0 / 1 (has 3) | 1 / 2 (has 5) | 0 / 0 (has 2) | private; admin, member (member) | none | pages home, matches, teams, players, privacy; read Team, Player, Match; create none | 1 (operator-unknown) | none |  | none | 0 / 3 | mentions visitors; landing page |
| 8 | booking (words: records) | 3 | 0 / 6 (has 3) | 4 / 12 (has 7) | 0 / 1 (has 0) | private; admin, member (member) | none | pages home, talks, speakers, schedule, privacy; read Talk, Speaker; create none | 1 (operator-unknown) | none |  | none | 0 / 3 | no mention; landing page |
| 9 | support (words: booking) | 3 | 1 / 2 (has 2) | 1 / 2 (has 2) | 5 / 5 (has 5) | shared; admin, agent (agent) | none | pages none; read none; create none | 0 | none |  | none | 0 / 2 | no mention; no landing page |
| 10 | records | 3 | 0 / 1 (has 4) | 0 / 2 (has 3) | 0 / 0 (has 1) | shared; admin, member (member) | none | pages none; read none; create none | 0 | none |  | none | 0 / 4 | no mention; no landing page |
| 11 | status | 3 | 4 / 4 (has 4) | 7 / 8 (has 8) | 3 / 3 (has 3) | shared; admin, staff (staff) | none | pages home, privacy; read Component, Incident, IncidentUpdate, Maintenance; create none | 1 (operator-unknown) | none |  | none | 4 / 4 | no mention; landing page |
| 12 | status | 2 | 3 / 4 (has 3) | 6 / 8 (has 7) | 3 / 3 (has 3) | shared; admin, staff (staff) | none | pages home, privacy; read Component, Incident, IncidentUpdate; create none | 1 (operator-unknown) | none |  | Payments, Delivery tracking | 3 / 3 | mentions visitors; landing page |

"Kept" counts the starter's models, pages and actions that the draft still has by name, with how many the draft has in all; "left out" names what the draft dropped because it could not be made valid: an action by its name, anything else (a formula field, a capacity) with its operation. "Starter's texts" lists the starter's app name or sample titles found in the draft's spec or content. "Models with the starter's samples" counts the draft's models that keep some of the starter's sample records after `fitSamples`; the rest get generated rows. "Mentions visitors" means the description says visitors, public or site. "Starter" is the one `new --describe --yes` printed, with the word-match starter (`closestStarter`) beside it when it differs; "Questions" counts what `smithable clarify` would ask (`--yes` asks nothing), with their language for a description not in English.
<!-- /scorecard -->

## Summaries, for review

### 1. A booking site for a yoga studio, with classes, teachers and online booking.

```text
Open Sky Yoga
  Class schedule, teachers and online booking for a yoga studio.

Pages
  - Home (a landing page: hero, class types, teachers, faq, call to action and footer)
  - Schedule (a calendar of sessions by week or month)
  - My bookings (lists bookings)
  - Sessions (lists sessions; filter by class type, teacher or starts at; sort by starts at or capacity; only for admins)
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
  Its owner deletes it until the session's starts at.
  A booking is named after its session.

Sign-in and access
  People sign in with a code sent to their email.
  Everyone sees, changes and deletes only their own records.
  Roles:
  - admin (Studio staff. Manage the schedule, classes and teachers): everything
  - member (A student who books classes): opens the schedule page and the my bookings page; adds bookings
  New users get the member role.
  Open to anyone without signing in: the home page, the schedule page, the privacy page, reading class types, reading instructors and reading sessions.
  Everyone who signs in can ask the app questions; it changes nothing. It answers plainly.

Assumed:
  Who can create an account to book classes? Anyone can sign up with their email and book (or: Only students the studio invites, Only people with an address on the studio's domain)
  What can visitors see before they sign in? The home page, the class schedule, the class types and the teachers (or: Only the home page, Everything, including how many places are booked per student)
  Should the site also have a blog and a contact form? No, just classes, teachers and booking for now (or: Add a blog for studio news, Add a contact form on the home page, Add both)
  Should students get emails about their bookings? No emails for now (or: A confirmation when a booking is made, A reminder the day before the class, Both)
Frontier model (claude-opus-5-5) · 3,450 tokens (1,923 in, 1,527 out) · $0.0375
Pictures from the Smithable image library: samples/instructor-1.webp, hero.webp, logo.webp.
Generated 155 files (155 changed, 0 removed).

Created /tmp/smithable-bench-m12-OrndPs/app-1. Open it in Studio, to see it and change it:

  cd /tmp/smithable-bench-m12-OrndPs/app-1
  smithable studio

or only run the app with smithable run.
/tmp/smithable-bench-m12-OrndPs/app-1/smithable.yml:44:14  warning  Page "schedule" is a calendar, but the app has no time zone: records are placed in UTC.
    hint: Set "timezone" under "app", e.g. "Europe/Mariehamn".
/tmp/smithable-bench-m12-OrndPs/app-1/smithable.content.yml:11:3  warning  The privacy page "privacy" does not say who runs the app: give the operator's name under pages.privacy.operator (name, address, email, country, hosting).
```

### 2. A CRM for a small sales team: companies, contacts, deals and follow-ups.

```text
Pipeline CRM
  A simple CRM for a small sales team to track companies, contacts, deals and follow-ups.

Pages
  - Companies (lists companies; search by name or industry; filter by account manager; “Merge companies”)
  - Contacts (lists contacts; search by name, email or job title; filter by company)
  - Deals (lists deals; search by title; filter by stage, company or expected close; “Mark won”; “Mark lost”)
  - Follow ups (lists follow ups; search by note; filter by done, due on or company; “Mark done”)
  - Team (who has access: invite people, change roles, remove users; only for admins)

Companies
  Companies have:
  - a name (required, unique)
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
  - a value (an amount)
  - a stage (lead, qualified, proposal, negotiation, won or lost, lead by default)
  - an expected close (a date)
  - closed on (a date, filled by the app)
  - notes
  Deleted deals stay in the trash for thirty days, where they can be restored.

Follow ups
  Follow ups have:
  - a company (a company, required)
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
  Tick off a follow-up once it is handled.

Merge companies
  Merge two or more companies: the others' contacts, deals and follow ups move to the kept one; where they differ, the person chooses; the others go to the trash.
  Combine duplicate companies; their contacts, deals and follow-ups move to the one kept.

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
  Which stages does a deal go through? Lead, qualified, proposal, negotiation, then won or lost (or: Open, won or lost only, Lead, demo, proposal, won or lost)
  What may salespeople change? Every salesperson can see and edit all records; only admins manage the team (or: Each salesperson edits only their own companies and deals, Everyone, including team management, has full access)
  Who is a follow-up for? A follow-up belongs to a company and to the person who created it (or: A follow-up is assigned to a specific salesperson, A follow-up is tied to a deal instead of a company)
Frontier model (claude-opus-5-5) · 5,042 tokens (2,293 in, 2,749 out) · $0.0733
Pictures from the Smithable image library: logo.webp.
Generated 156 files (156 changed, 0 removed).

Created /tmp/smithable-bench-m12-OrndPs/app-2. Open it in Studio, to see it and change it:

  cd /tmp/smithable-bench-m12-OrndPs/app-2
  smithable studio

or only run the app with smithable run.
```

### 3. Invoicing for freelancers, with clients, invoices and payments.

```text
Billfold
  Invoicing for freelancers: keep your clients, send invoices and track the payments that come in.

Pages
  - Home (a landing page: hero, features, faq, call to action and footer)
  - Overview (a dashboard: received, outstanding, overdue, invoiced and latest)
  - Clients (lists clients; search by name or email)
  - Payments (lists payments; filter by invoice, method or paid on)
  - Invoice lines (lists invoice lines)
  - Privacy (a privacy page written from the app: who runs it, what it stores and why, cookies, mail, logs, your rights)
  - Invoices (lists invoices; filter by client, status or issued on; “Mark sent”; “Mark paid”; “Mark overdue”)

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
  - due on (a date, required)
  - status (draft, sent, paid or overdue, draft by default)
  - a contract (a document)
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

Flag overdue
  A day after an invoice's due on, where status is sent: runs “Mark overdue”.

Sign-in and access
  People sign in with a code sent to their email.
  Everyone sees, changes and deletes only their own records.
  Roles:
  - admin: everything
  - member: opens every page; adds every kind of record
  New users get the member role.
  Open to anyone without signing in: the home page.
  Everyone who signs in can ask the app questions; it changes nothing. It answers plainly.

Assumed:
  Who sees the clients, invoices and payments? Each freelancer sees only their own records (or: A small team shares every record, An accountant sees every freelancer's records)
  How are payments recorded? Each payment is its own record tied to an invoice, so an invoice can be paid in parts and shows its open balance (or: An invoice is simply marked paid, with no separate payments, One payment can cover several invoices)
  What do visitors see before signing in? A landing page about the app, and a privacy page (or: Nothing: the app opens on the sign-in page, A landing page with pricing plans)
  Should the freelancer's own business details (VAT number, bank account) be kept in the app? Not in this first version (or: A settings page with business details printed on invoices, A setup step when someone first signs in)
Frontier model (claude-opus-5-5) · 4,251 tokens (2,271 in, 1,980 out) · $0.0578
Pictures from the Smithable image library: hero.webp, logo.webp.
Generated 164 files (164 changed, 0 removed).

Created /tmp/smithable-bench-m12-OrndPs/app-3. Open it in Studio, to see it and change it:

  cd /tmp/smithable-bench-m12-OrndPs/app-3
  smithable studio

or only run the app with smithable run.
/tmp/smithable-bench-m12-OrndPs/app-3/smithable.content.yml:3:3  warning  The privacy page "privacy" does not say who runs the app: give the operator's name under pages.privacy.operator (name, address, email, country, hosting).
```

### 4. A tool library where neighbors lend each other tools.

```text
Toolshare
  Neighbors share their tools: list what you own, find what you need, and borrow instead of buying.

Pages
  - Tools (lists tools; search by title, description or place; filter by category, condition or available; sort by title or date added; records can be saved as favorites; contact the owner by mail)
  - Home (a landing page: hero, features, tools where available is yes and footer)
  - My tools (lists tools; only the viewer's own records)
  - Saved (lists tools; only the viewer's saved records)
  - Lent out (lists loans; filter by status, tool or due back; “Mark returned”)
  - Review (the pictures and files waiting for review, to approve or reject; only for admins)
  - Privacy (a privacy page written from the app: who runs it, what it stores and why, cookies, mail, logs, your rights)

Tools
  Tools have:
  - a title (required)
  - photos (pictures, required)
  - a description (required)
  - a category (power tools, hand tools, garden, ladders, cleaning, camping or other, power tools by default)
  - a condition (like new, good or worn, like new by default)
  - a place
  - available (yes or no, true by default)
  Photos of tools are reviewed before others see them; a tool waits until its photos are.

Loans
  Loans have:
  - a tool (a tool, required)
  - a borrower (required)
  - a borrower contact
  - lent on (a date, required)
  - a due back (a date)
  - status (out or returned, out by default)
  - returned on (a date)
  - a note
  A loan is named after its tool and its borrower.

Mark returned
  For a loan that is out; sets status to returned and returned on to today.
  Record that a lent tool has come back.

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
  How is a loan arranged and tracked? The borrower messages the owner from the tool's page, and the owner records the loan in their own 'Lent out' list (or: Borrowers send a loan request in the app that the owner approves or declines, No loan records, only messages and an 'available' switch, Loans with fixed borrowing periods and reminders when they're due)
  What can people see without signing in? The welcome page and the tool catalog, but not who owns each tool (or: Nothing; everything needs sign-in, Only the welcome page)
  Who can join? Anyone can sign up with their email and share or borrow tools (or: Only people the administrators invite, Only addresses on a set email domain)
  Are tool photos checked before they show? Yes, an administrator approves the photos before a tool is listed (or: No, tools show as soon as they are added)
Frontier model (claude-opus-5-5) · 4,292 tokens (1,951 in, 2,341 out) · $0.0624
Pictures from the Smithable image library: samples/tool-1.webp, samples/tool-2.webp, samples/tool-3.webp, samples/tool-4.webp, samples/tool-5.webp, samples/tool-6.webp, hero.webp, logo.webp.
Generated 149 files (149 changed, 0 removed).

Created /tmp/smithable-bench-m12-OrndPs/app-4. Open it in Studio, to see it and change it:

  cd /tmp/smithable-bench-m12-OrndPs/app-4
  smithable studio

or only run the app with smithable run.
/tmp/smithable-bench-m12-OrndPs/app-4/smithable.content.yml:3:3  warning  The privacy page "privacy" does not say who runs the app: give the operator's name under pages.privacy.operator (name, address, email, country, hosting).
```

### 5. An inventory app for a small bakery: ingredients, suppliers and stock levels.

```text
Bakery Stock
  Keeps track of the bakery's ingredients, who supplies them and how much is on the shelf.

Pages
  - Ingredients (lists ingredients; search by name or notes; filter by supplier, storage or unit)
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
  - a name (required, unique)
  - a supplier (a supplier)
  - a unit (kg, g, l, ml or pieces, kg by default)
  - an in stock (a number, required, 0 by default)
  - reorder at (a number)
  - a cost per unit (an amount)
  - a storage (dry, chilled or frozen, dry by default)
  - notes

Sign-in and access
  People sign in with a code sent to their email.
  Everyone who signs in sees all records, and changes and deletes the ones they own.
  Roles:
  - admin: everything
  - member (Works in the bakery: keeps ingredients, stock levels and suppliers up to date): opens every page; adds every kind of record; changes everyone's ingredients and suppliers
  New users get the member role.
  Everyone who signs in can ask the app questions; it changes nothing. It answers plainly.

Assumed:
  Who can see and change the stock? The whole bakery team, invited by an admin, sees and updates every ingredient and supplier (or: Only the owner uses the app, Staff can only view; admins change stock)
  How are stock levels kept? Each ingredient has an amount in stock and a reorder level, updated by hand (or: Log every delivery and use as a stock movement, Weekly stock counts)
  Which currency are ingredient costs in? EUR (or: SEK, GBP, USD)
  Is any part of the app public? No, everything needs sign-in (or: A public page listing the bakery's suppliers)
Frontier model (claude-opus-5-5) · 3,529 tokens (1,888 in, 1,641 out) · $0.0479
Pictures from the Smithable image library: logo.webp.
Generated 125 files (125 changed, 0 removed).

Created /tmp/smithable-bench-m12-OrndPs/app-5. Open it in Studio, to see it and change it:

  cd /tmp/smithable-bench-m12-OrndPs/app-5
  smithable studio

or only run the app with smithable run.
```

### 6. A job board for a local union, with job posts and applications.

```text
Union Jobs
  Job openings for our local union's members, and a simple way to apply.

Pages
  - Home (a landing page: hero, jobs where status is open, features, faq and footer)
  - Jobs (lists jobs; search by title, employer, description or location; filter by type, status or closes on; sort by closes on or date added; “Mark filled”; “Close job”)
  - My applications (lists applications; only the viewer's own records)
  - Applications (lists applications; search by name, email or member number; filter by job or status; only for staff users and admins)
  - Privacy (a privacy page written from the app: who runs it, what it stores and why, cookies, mail, logs, your rights)

Jobs
  Jobs have:
  - a title (required)
  - an employer (required)
  - a description (required)
  - a location
  - a type (full time, part time, temporary or contract, full time by default)
  - a wage
  - closes on (a date)
  - status (open, filled or closed, open by default)
  Each job lists its applications.

Applications
  Applications have:
  - a job (a job, required, unique per owner)
  - a name (required)
  - an email (required)
  - a phone
  - a member number
  - a message (required)
  - a resume (a document)
  - status (submitted, shortlisted, rejected or hired, submitted by default, filled by the app)

Mark filled
  For a job that is open; sets status to filled.
  Mark a job as filled once someone is hired.

Close job
  For a job that is open; sets status to closed.
  Stop taking applications for a job.

Shortlist
  For an application that is submitted; sets status to shortlisted.

Reject
  For an application that is submitted or shortlisted; sets status to rejected.

Hire
  For an application that is shortlisted; sets status to hired.

Sign-in and access
  People sign in with a code sent to their email.
  Everyone sees, changes and deletes only their own records.
  Roles:
  - admin: everything
  - staff (Union job desk: posts jobs and handles applications): opens every page; sees everyone's applications; adds every kind of record; changes everyone's jobs and applications; deletes everyone's jobs
  - member (Union member: browses jobs and applies): opens the home page, the jobs page, the my applications page and the privacy page; adds applications
  New users get the member role.
  Open to anyone without signing in: the home page, the jobs page, the privacy page and reading jobs where status is open.
  Everyone who signs in can ask the app questions; it changes nothing. It answers plainly.

Assumed:
  Who posts the jobs? Union staff post jobs on employers' behalf (or: Employers sign in and post their own jobs, Any member can post a job)
  What can people see without signing in? Open jobs are public; you sign in to apply (or: Everything requires sign-in, Visitors can apply without an account)
  Who can sign up? Anyone can sign up as a member; staff get their role from an admin (or: Only invited union members, Only addresses on the union's email domain)
  What goes into an application? Name, email, phone, member number, a message and an optional resume (or: Just a message, Also certifications and availability)
Frontier model (claude-opus-5-5) · 4,101 tokens (1,904 in, 2,197 out) · $0.0592
Pictures from the Smithable image library: hero.webp, logo.webp.
Generated 146 files (146 changed, 0 removed).

Created /tmp/smithable-bench-m12-OrndPs/app-6. Open it in Studio, to see it and change it:

  cd /tmp/smithable-bench-m12-OrndPs/app-6
  smithable studio

or only run the app with smithable run.
/tmp/smithable-bench-m12-OrndPs/app-6/smithable.auth.yml:12:5  warning  staff may change others' Job it cannot read: with private access a role reads only its own records unless granted "read".
    hint: Grant staff "read" on them too, or drop the "write".
/tmp/smithable-bench-m12-OrndPs/app-6/smithable.auth.yml:13:5  warning  staff may delete others' Job it cannot read: with private access a role reads only its own records unless granted "read".
    hint: Grant staff "read" on them too, or drop the "delete".
/tmp/smithable-bench-m12-OrndPs/app-6/smithable.content.yml:3:3  warning  The privacy page "privacy" does not say who runs the app: give the operator's name under pages.privacy.operator (name, address, email, country, hosting).
```

### 7. A football club's site: teams, players, matches and results.

```text
Club Pitch
  The club's public site with its teams, players, fixtures and results.

Pages
  - Home (a landing page: hero, matches where status is scheduled, matches where status is played, teams and footer)
  - Matches (lists matches; search by opponent, competition or ground; filter by team, status, venue or kickoff; “Enter result”; “Postpone”)
  - Teams (lists teams; search by name or coach; filter by age group or gender)
  - Players (lists players; search by name; filter by team or position)
  - Privacy (a privacy page written from the app: who runs it, what it stores and why, cookies, mail, logs, your rights)

Teams
  Teams have:
  - a name (required)
  - an age group (senior, youth or junior, senior by default)
  - a gender (men, women or mixed, men by default)
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
  - status (scheduled, played, postponed or cancelled, scheduled by default)
  - a goals for (a whole number)
  - a goals against (a whole number)
  - a report
  A match is named after its team, its opponent and its kickoff.

Enter result
  For a match that is scheduled or postponed; sets status to played; asks for the goals for and the goals against.
  Record the final score of a match that has been played.

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

Assumed:
  Who adds and updates teams, players and matches? Only the club's administrators; everyone else just looks. (or: Each team's coach manages their own team's players and matches, Any signed-in club member may add results)
  What can visitors see about players? Name, team, shirt number, position, photo and a short bio, with no contact details. (or: Only names and numbers, Players visible to signed-in members only)
  How is a result recorded? An 'Enter result' button on a match asks for the goals scored and conceded and marks it played. (or: Edit the score in the match form, Goal-by-goal records with scorers)
Frontier model (claude-opus-5-5) · 4,238 tokens (2,158 in, 2,080 out) · $0.0589
Pictures from the Smithable image library: samples/team-1.webp, samples/team-2.webp, samples/team-3.webp, samples/player-1.webp, hero.webp, logo.webp.
Generated 145 files (145 changed, 0 removed).

Created /tmp/smithable-bench-m12-OrndPs/app-7. Open it in Studio, to see it and change it:

  cd /tmp/smithable-bench-m12-OrndPs/app-7
  smithable studio

or only run the app with smithable run.
/tmp/smithable-bench-m12-OrndPs/app-7/smithable.content.yml:3:3  warning  The privacy page "privacy" does not say who runs the app: give the operator's name under pages.privacy.operator (name, address, email, country, hosting).
```

### 8. Event registration for a conference: talks, speakers and attendees.

```text
Talkfront
  Programme and registration for a conference: browse the talks and speakers, and reserve a seat in the talks you want to attend.

Pages
  - Home (a landing page: hero, features, speakers, faq, call to action and footer)
  - Talks (lists talks; filter by track, speaker or starts at)
  - Speakers (lists speakers)
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
  - an abstract (formatted text)
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
  - member: opens the my registrations page, the talks page, the speakers page and the schedule page; adds registrations
  New users get the member role.
  Open to anyone without signing in: the home page, the talks page, the speakers page, the schedule page, the privacy page, reading talks and reading speakers.
  Everyone who signs in can ask the app questions; it changes nothing. It answers plainly.

Assumed:
  What do attendees register for? A seat in each talk they want to attend, limited by the talk's capacity (or: One registration for the whole conference, A conference ticket plus seats in workshops only)
  What can people see without signing in? The landing page, the talks, the schedule and the speakers (or: Only the landing page, Nothing; everything needs sign-in)
  Who can sign up as an attendee? Anyone can sign up and register for talks; organisers are the admins (or: Only invited attendees, Only addresses from certain domains)
  Are speakers people who sign in? No, organisers keep the speaker profiles; speakers don't need an account (or: Speakers sign in and edit their own profile and talks)
Frontier model (claude-opus-5-5) · 3,517 tokens (1,833 in, 1,684 out) · $0.0483
Pictures from the Smithable image library: samples/speaker-1.webp, hero.webp, logo.webp.
Generated 159 files (159 changed, 0 removed).

Created /tmp/smithable-bench-m12-OrndPs/app-8. Open it in Studio, to see it and change it:

  cd /tmp/smithable-bench-m12-OrndPs/app-8
  smithable studio

or only run the app with smithable run.
/tmp/smithable-bench-m12-OrndPs/app-8/smithable.content.yml:3:3  warning  The privacy page "privacy" does not say who runs the app: give the operator's name under pages.privacy.operator (name, address, email, country, hosting).
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
  - a requester email (required, fixed once made)
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
  - agent (Works on the tickets, takes them and passes them on): opens the tickets page; adds every kind of record; changes everyone's records; runs every custom action
  New users get the agent role.
  Everyone who signs in can ask the app questions; it changes nothing. It answers plainly.

Assumed:
  Who uses the help desk? Only the IT team signs in; they log tickets for the people who report problems. (or: Employees also sign in to report their own tickets, Employees send tickets by mail to a support address)
  How is a ticket's priority set? A number from 1 to 5, 3 by default. (or: Low, normal, high or urgent, Worked out from impact and urgency)
  Are the people who reported a problem told about progress? No mail for now; the team keeps notes on the ticket. (or: Mail the requester when the ticket is closed, Mail the requester on every reply)
Frontier model (claude-opus-5-5) · 3,195 tokens (1,716 in, 1,479 out) · $0.0433
Pictures from the Smithable image library: logo.webp.
Generated 142 files (142 changed, 0 removed).

Created /tmp/smithable-bench-m12-OrndPs/app-9. Open it in Studio, to see it and change it:

  cd /tmp/smithable-bench-m12-OrndPs/app-9
  smithable studio

or only run the app with smithable run.
```

### 10. A recipe collection for a family, with ingredients and shopping lists.

```text
Family Cookbook
  A shared place for the family to keep its recipes and plan shopping lists.

Pages
  - Recipes (lists recipes; search by name or summary; filter by category or favorite)
  - Shopping lists (lists shopping lists; filter by status; “Mark done”)
  - Team (who has access: invite people, change roles, remove users; only for admins)

Recipes
  Recipes have:
  - a name (required)
  - a summary
  - a category (main, starter, dessert, baking, breakfast or drink, main by default)
  - servings (a whole number, 4 by default)
  - minutes (a whole number)
  - instructions (formatted text)
  - a picture
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
  - a quantity
  - a recipe (a recipe)
  - bought (yes or no)

Mark done
  For a shopping list that is open; sets status to done.
  Close a shopping list once the shopping is done.

Sign-in and access
  People sign in with a code sent to their email.
  Everyone who signs in sees all records, and changes and deletes the ones they own.
  Roles:
  - admin: everything
  - member: opens every page; adds every kind of record
  New users get the member role.
  Everyone who signs in can ask the app questions; it changes nothing. It answers plainly.

Assumed:
  Should the recipes be visible to anyone on the internet? No, only invited family members can see the recipes and lists (or: Recipes are public, shopping lists stay private, Everything is public to read)
  Who may add and change recipes? Every family member can add and change all recipes and shopping lists (or: Only admins add recipes, others just view, Each person sees only their own recipes)
  How do items get onto a shopping list? Typed in by hand, each item optionally linked to the recipe it is for (or: Copied automatically from a recipe's ingredients, A weekly meal plan builds the list)
Frontier model (claude-opus-5-5) · 4,830 tokens (2,201 in, 2,629 out) · $0.0702
Pictures from the Smithable image library: logo.webp.
Generated 143 files (143 changed, 0 removed).

Created /tmp/smithable-bench-m12-OrndPs/app-10. Open it in Studio, to see it and change it:

  cd /tmp/smithable-bench-m12-OrndPs/app-10
  smithable studio

or only run the app with smithable run.
```

### 11. A status page for our API, with incidents and planned maintenance.

```text
API Status
  The live state of our API: what works, what is being fixed, and what maintenance is planned.

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
  For an incident that is investigating or identified; sets status to monitoring; adds an incident update (at now, status monitoring, message A fix has been deployed. We are monitoring the results.).
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
  Open to anyone without signing in: the home page, the privacy page, reading components, reading incidents where status is investigating or identified or monitoring or resolved, reading incident updates and reading maintenances.
  Other programs can read and change components and incidents with a key, and run resolve.
  Everyone who signs in can ask the app questions; it changes nothing. It answers plainly.

Assumed:
  Who writes incidents and maintenance notices? An invited team; staff write incidents, admins also manage components and the team (or: Everyone on the team does everything, Only administrators)
  What do visitors see without signing in? The status page, the incident history with its updates, and planned maintenance (or: Only current status and ongoing incidents, Everything only after sign-in)
  What are the parts of the API whose status is shown? Components the team lists, each with its own status (e.g. REST API, webhooks, authentication) (or: One overall status for the whole API, Components grouped by region)
  May other programs report incidents? Yes, through an API key that can create and resolve incidents (e.g. from a monitoring tool) (or: No, incidents are only written by hand, Also from a chat slash command)
Frontier model (claude-opus-5-5) · 5,076 tokens (2,326 in, 2,750 out) · $0.0628
Pictures from the Smithable image library: hero.webp, logo.webp.
Generated 166 files (166 changed, 0 removed).

Created /tmp/smithable-bench-m12-OrndPs/app-11. Open it in Studio, to see it and change it:

  cd /tmp/smithable-bench-m12-OrndPs/app-11
  smithable studio

or only run the app with smithable run.
/tmp/smithable-bench-m12-OrndPs/app-11/smithable.content.yml:3:3  warning  The privacy page "privacy" does not say who runs the app: give the operator's name under pages.privacy.operator (name, address, email, country, hosting).
```

### 12. A public uptime page for a web shop: which services work, outages and their updates.

```text
Shop Status
  Is the shop working? The live state of our web shop's services, outages and their updates.

Pages
  - Home (a landing page: hero, components, incidents where status is investigating or identified or monitoring, incidents where status is resolved and footer)
  - Overview (a dashboard: open, per month and latest)
  - Incidents (lists incidents; filter by status or component; “Identified”; “Monitoring”; “Resolve”)
  - Updates (lists incident updates)
  - Components (lists components; only for admins; visitors see components on the Home page)
  - Privacy (a privacy page written from the app: who runs it, what it stores and why, cookies, mail, logs, your rights)
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
  Should the page also announce planned maintenance? No: only services, outages and their updates (or: Yes, with a list of planned maintenance windows)
  Who writes the incidents and updates? An invited team of staff; admins also manage the services and the team (or: Admins only, Anyone with a shop email address)
  What may visitors see without signing in? Every service's state, ongoing and past incidents with their updates (or: Only ongoing outages, Service states only)
  Is there a history of past outages? Yes, a public history page listing every incident (or: Only the last few on the home page)
Frontier model (claude-opus-5-5) · 3,840 tokens (2,066 in, 1,774 out) · $0.0384
Pictures from the Smithable image library: hero.webp, logo.webp.
Generated 147 files (147 changed, 0 removed).

Created /tmp/smithable-bench-m12-OrndPs/app-12. Open it in Studio, to see it and change it:

  cd /tmp/smithable-bench-m12-OrndPs/app-12
  smithable studio

or only run the app with smithable run.
/tmp/smithable-bench-m12-OrndPs/app-12/smithable.content.yml:3:3  warning  The privacy page "privacy" does not say who runs the app: give the operator's name under pages.privacy.operator (name, address, email, country, hosting).
```
