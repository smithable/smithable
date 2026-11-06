# M12 first builds: claude-code (2026-11-06)

The app descriptions, each started with `smithable new --describe … --yes` (the starter the first step picks, adapted by the model; errors go back up to four times). Totals: 12 / 12 created, 11 type-check, 888,033 tokens (850,470 in, 37,563 out), $1.6450 (as Claude Code reports it); 0 model calls answered from the response cache. *Rounds* counts the model's drafting calls: the first draft and each round of corrections after it.

| Description | Starter | Created | Type-checks | Tokens in | Tokens out | Cost | Cached calls | Rounds | Time |
|---|---|---|---|---|---|---|---|---|---|
| A booking site for a yoga studio, with classes, teachers and online booking. | booking | yes | yes | 66,724 | 3,547 | $0.6047 | 0 | – | 65 s |
| A CRM for a small sales team: companies, contacts, deals and follow-ups. | crm | yes | yes | 65,429 | 3,030 | $0.0915 | 0 | – | 64 s |
| Invoicing for freelancers, with clients, invoices and payments. | invoicing | yes | yes | 132,617 | 5,863 | $0.1932 | 0 | – | 88 s |
| A tool library where neighbors lend each other tools. | marketplace | yes | yes | 64,628 | 3,419 | $0.0929 | 0 | – | 61 s |
| An inventory app for a small bakery: ingredients, suppliers and stock levels. | records | yes | yes | 64,382 | 1,559 | $0.0537 | 0 | – | 43 s |
| A job board for a local union, with job posts and applications. | marketplace | yes | yes | 64,628 | 3,869 | $0.1019 | 0 | – | 71 s |
| A football club's site: teams, players, matches and results. | records | yes | yes | 64,370 | 2,833 | $0.0791 | 0 | – | 64 s |
| Event registration for a conference: talks, speakers and attendees. | booking | yes | **no** | 66,719 | 3,591 | $0.1131 | 0 | – | 71 s |
| A help desk for an IT team: tickets, priorities and who handles them. | support | yes | yes | 65,108 | 2,315 | $0.0747 | 0 | – | 50 s |
| A recipe collection for a family, with ingredients and shopping lists. | records | yes | yes | 64,376 | 1,873 | $0.0600 | 0 | – | 52 s |
| A status page for our API, with incidents and planned maintenance. | status | yes | yes | 65,743 | 2,946 | $0.0924 | 0 | – | 61 s |
| A public uptime page for a web shop: which services work, outages and their updates. | status | yes | yes | 65,746 | 2,718 | $0.0878 | 0 | – | 54 s |

Each created app's four spec files are in [m12-first-builds-claude-code/](m12-first-builds-claude-code/), one folder per description (app-1 …).

<!-- scorecard -->
## Scorecard (scripts/bench-m12.mjs --score)

0 of 12 drafts end with a warning about what is public (*Public flaws left*: public-personal-data, public-page-closed-records, contact-form-closed, shortcut-closed, mine-public, visitors-read-drafts); since #266 a draft with one goes back to the model once to fix it. *API app*, for the second set's two descriptions of apps for programs and assistants: "yes" when the draft has no landing page, an `api` block, tools when the description names an assistant, and a role other than admin for keys; otherwise what it lacks.

| # | Starter | Questions | Models kept | Pages kept | Actions kept | Access; roles (default) | Pages with access | Public | Warnings | Public flaws left | API app | Starter's texts in the draft | Models with the starter's samples | Visitors / landing |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | booking | 3 | 4 / 6 (has 4) | 8 / 13 (has 9) | 0 / 1 (has 0) | private; admin, staff, member (member) | none | pages home, schedule, privacy; read ClassType, Instructor, Session; create none | 1 (operator-unknown) | none |  | none | 3 / 4 | mentions visitors; landing page |
| 2 | crm | 3 | 1 / 3 (has 4) | 3 / 5 (has 6) | 0 / 2 (has 4) | shared; admin, sales (sales) | none | pages none; read none; create none | 0 | none |  | none | 0 / 4 | no mention; no landing page |
| 3 | invoicing | 3 | 3 / 4 (has 4) | 5 / 7 (has 6) | 3 / 3 (has 3) | private; admin, member (member) | none | pages home, privacy; read none; create none | 1 (operator-unknown) | none |  | none | 3 / 4 | no mention; landing page |
| 4 | marketplace (words: records) | 3 | 0 / 1 (has 2) | 1 / 5 (has 6) | 0 / 0 (has 3) | shared; admin, member (member) | none | pages home, tools, privacy; read Tool; create none | 1 (operator-unknown) | none |  | none | 0 / 2 | no mention; landing page |
| 5 | records (words: api) | 3 | 0 / 1 (has 2) | 0 / 2 (has 3) | 0 / 0 (has 0) | shared; admin, member (member) | none | pages none; read none; create none | 0 | none |  | none | 0 / 2 | no mention; no landing page |
| 6 | marketplace | 3 | 0 / 1 (has 2) | 1 / 5 (has 6) | 0 / 0 (has 5) | private; admin, staff, member (member) | none | pages home, jobs, privacy; read Job; create none | 1 (operator-unknown) | none |  | none | 0 / 2 | no mention; landing page |
| 7 | records (words: booking) | 3 | 0 / 1 (has 3) | 1 / 2 (has 5) | 0 / 0 (has 2) | private; admin, member (member) | none | pages home, matches, teams, players, privacy; read Team, Player, Match; create none | 1 (operator-unknown) | none |  | none | 0 / 3 | mentions visitors; landing page |
| 8 | booking (words: records) | 3 | 0 / 6 (has 3) | 3 / 13 (has 7) | 0 / 1 (has 1) | private; admin, organizer, attendee (attendee) | none | pages home, schedule, speakers, privacy; read Talk, Speaker; create none | 1 (operator-unknown) | none |  | none | 0 / 3 | no mention; landing page |
| 9 | support (words: booking) | 3 | 0 / 2 (has 2) | 1 / 2 (has 2) | 5 / 5 (has 5) | shared; admin, agent (agent) | none | pages none; read none; create none | 0 | none |  | none | 0 / 2 | no mention; no landing page |
| 10 | records | 3 | 0 / 1 (has 4) | 0 / 2 (has 3) | 0 / 0 (has 1) | shared; admin, member (member) | none | pages none; read none; create none | 0 | none |  | none | 0 / 4 | no mention; no landing page |
| 11 | status | 3 | 4 / 4 (has 4) | 7 / 8 (has 8) | 3 / 3 (has 3) | shared; admin, staff (staff) | none | pages home, privacy; read Component, Incident, IncidentUpdate, Maintenance; create none | 1 (operator-unknown) | none |  | none | 4 / 4 | no mention; landing page |
| 12 | status | 3 | 3 / 4 (has 3) | 4 / 8 (has 5) | 3 / 3 (has 3) | shared; admin, staff (staff) | none | pages home, privacy; read Component, Incident, IncidentUpdate; create none | 1 (operator-unknown) | none |  | none | 3 / 3 | mentions visitors; landing page |

"Kept" counts the starter's models, pages and actions that the draft still has by name, with how many the draft has in all; "left out" names what the draft dropped because it could not be made valid: an action by its name, anything else (a formula field, a capacity) with its operation. "Starter's texts" lists the starter's app name or sample titles found in the draft's spec or content. "Models with the starter's samples" counts the draft's models that keep some of the starter's sample records after `fitSamples`; the rest get generated rows. "Mentions visitors" means the description says visitors, public or site. "Starter" is the one `new --describe --yes` printed, with the word-match starter (`closestStarter`) beside it when it differs; "Questions" counts what `smithable clarify` would ask (`--yes` asks nothing), with their language for a description not in English.
<!-- /scorecard -->

## Summaries, for review

### 1. A booking site for a yoga studio, with classes, teachers and online booking.

```text
Lotus Room Yoga
  Class schedule, teachers and online booking for a yoga studio.

Pages
  - Home (a landing page: hero, class types, instructors, faq, call to action and footer)
  - Schedule (a calendar of sessions by week or month)
  - My bookings (lists bookings; only the viewer's own records; only for members and admins)
  - Sessions (lists sessions; filter by class type, instructor or starts at; only for staff users and admins)
  - Bookings (lists bookings; filter by session; only for staff users and admins)
  - Class types (lists class types; filter by level; only for staff users and admins; visitors see class types on the Home page)
  - Instructors (lists instructors; only for staff users and admins; visitors see instructors on the Home page)
  - Team (who has access: invite people, change roles, remove users; only for admins)
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

Sign-in and access
  People sign in with a code sent to their email.
  Everyone sees, changes and deletes only their own records.
  Roles:
  - admin: everything
  - staff (Reception and teachers. Run the sessions and see who comes to them): opens the schedule page, the sessions page, the bookings page, the class types page and the instructors page; sees everyone's sessions and bookings; adds sessions and bookings; changes everyone's sessions and bookings; deletes everyone's bookings
  - member (A student who books classes): opens the schedule page and the my bookings page; adds bookings
  New users get the member role.
  Open to anyone without signing in: the home page, the schedule page, the privacy page, reading class types, reading instructors and reading sessions.
  Everyone who signs in can ask the app questions; it changes nothing. It answers plainly.

Assumed:
  Who may sign up to book classes? Anyone can create an account with their email address and book (or: Only people the studio invites, Only existing members of the studio)
  Who runs the studio day to day? Staff (reception and teachers) manage sessions and bookings; the admin also manages the team (or: Only the admin manages everything, Teachers only see their own sessions)
  What can visitors see without signing in? The home page, the class types, the teachers and the schedule with places left (or: Only the home page, Everything, including who has booked)
  How late can a member cancel a booking? Up to two hours before the class starts (or: Up to 24 hours before, Until the class starts, Only the studio can cancel)
Frontier model (claude-opus-5-5) · 3,579 tokens (1,961 in, 1,618 out) · $0.0480
Pictures from the Smithable image library: samples/instructor-1.webp, samples/instructor-2.webp, samples/instructor-3.webp, samples/instructor-4.webp, samples/instructor-5.webp, samples/instructor-6.webp, hero.webp, logo.webp.
Generated 173 files (173 changed, 0 removed).

Created /tmp/smithable-bench-m12-sh9ztg/app-1. Open it in Studio, to see it and change it:

  cd /tmp/smithable-bench-m12-sh9ztg/app-1
  smithable studio

or only run the app with smithable run.
/tmp/smithable-bench-m12-sh9ztg/app-1/smithable.content.yml:3:3  warning  The privacy page "privacy" does not say who runs the app: give the operator's name under pages.privacy.operator (name, address, email, country, hosting).
```

### 2. A CRM for a small sales team: companies, contacts, deals and follow-ups.

```text
Pipeline CRM
  A simple CRM where a small sales team keeps its companies, contacts, deals and follow-ups in one place.

Pages
  - Start (a dashboard: open deals, pipeline value, deals by stage and follow ups due)
  - Companies (lists companies; search by name or industry; sort by name or date added; “Merge companies”)
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
  - notes
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
  For a deal that is lead, qualified, proposal or negotiation; sets stage to won.
  Close a deal as won.

Mark lost
  For a deal that is lead, qualified, proposal or negotiation; sets stage to lost.
  Close a deal as lost.

Mark done
  For a follow up that is not done; sets done to yes.
  Tick off a follow-up once it is handled.

Merge companies
  Merge two or more companies: the others' contacts, deals and follow ups move to the kept one; where they differ, the person chooses; the others go to the trash.
  Combine two entries for the same company; their contacts, deals and follow-ups move to the one kept.

Sign-in and access
  People sign in with a code sent to their email.
  Everyone who signs in sees all records, and changes and deletes the ones they own.
  Roles:
  - admin: everything
  - sales (Works with companies, contacts, deals and follow-ups): opens the start page, the companies page, the contacts page, the deals page and the follow ups page; adds every kind of record; changes everyone's records
  New users get the sales role.
  Everyone who signs in can ask the app questions; it changes nothing. It answers plainly.

Assumed:
  Which currency are deal values in? Euro (EUR) (or: US dollar (USD), British pound (GBP), Swedish krona (SEK))
  Can salespeople edit each other's companies and deals? Yes, everyone on the team can see and edit all records; deleting stays with the record's owner and admins (or: Everyone sees everything but edits only their own, Each salesperson sees only their own records)
  What stages does a deal go through? Lead, qualified, proposal, negotiation, then won or lost (or: Open, won, lost, Lead, proposal, won, lost)
  Who is responsible for a company? Its account manager, a team member chosen on the company (or: Whoever added the company, No one in particular)
Frontier model (claude-opus-5-5) · 5,294 tokens (2,341 in, 2,953 out) · $0.0778
Pictures from the Smithable image library: logo.webp.
Generated 169 files (169 changed, 0 removed).

Created /tmp/smithable-bench-m12-sh9ztg/app-2. Open it in Studio, to see it and change it:

  cd /tmp/smithable-bench-m12-sh9ztg/app-2
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
  - Clients (lists clients; search by name or email; sort by name or date added)
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
  - due on (a date, required)
  - status (draft, sent, paid or overdue, draft by default)
  Each invoice lists its invoice lines.
  Each invoice lists its payments.
  The total is calculated as the total amount of its lines.
  The received is calculated as the total amount of its payments.
  The balance is calculated as the total amount of its lines minus the total amount of its payments.

Mark sent
  For an invoice that is draft; sets status to sent.
  The invoice went to the client.

Mark paid
  For an invoice that is sent or overdue; sets status to paid; asks for the payment's amount and the payment's method; adds a payment (paid on today).
  The client paid the invoice; the payment is recorded with it.

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
  How are payments recorded against invoices? Each payment is its own record on an invoice, so partial payments show the balance left (or: Only mark an invoice as paid, with no separate payments, One payment can cover several invoices)
  Who sees which records? Each freelancer sees only their own clients, invoices and payments (or: A team shares all clients and invoices)
  What can visitors see without signing in? A public landing page and a privacy page only (or: No public pages at all, A public pricing page as well)
  Should invoices print the freelancer's own business details? Left out for now; invoices hold client, lines and payments (or: Add a business profile with name, VAT number and bank account)
Frontier model (claude-opus-5-5) · 5,062 tokens (2,318 in, 2,744 out) · $0.0734
Pictures from the Smithable image library: hero.webp, logo.webp.
Generated 158 files (158 changed, 0 removed).

Created /tmp/smithable-bench-m12-sh9ztg/app-3. Open it in Studio, to see it and change it:

  cd /tmp/smithable-bench-m12-sh9ztg/app-3
  smithable studio

or only run the app with smithable run.
/tmp/smithable-bench-m12-sh9ztg/app-3/smithable.content.yml:3:3  warning  The privacy page "privacy" does not say who runs the app: give the operator's name under pages.privacy.operator (name, address, email, country, hosting).
```

### 4. A tool library where neighbors lend each other tools.

```text
Toolshed Commons
  Neighbors list the tools they own and lend them to each other.

Pages
  - Tools (lists tools; search by name, description or place; filter by category, condition or available; records can be saved as favorites)
  - My tools (lists tools; only the viewer's own records)
  - Loans (lists loans; filter by status, tool or from; “Lend”; “Decline”; “Mark returned”)
  - Home (a landing page: hero, features, faq and footer)
  - Privacy (a privacy page written from the app: who runs it, what it stores and why, cookies, mail, logs, your rights)
  - Team (who has access: invite people, change roles, remove users; only for admins)

Tools
  Tools have:
  - a name (required)
  - photos (pictures)
  - a description
  - a category (power tools, hand tools, garden, ladders, cleaning or other, power tools by default)
  - a condition (good, worn or needs care, good by default)
  - a place
  - available (yes or no, true by default)

Loans
  Loans have:
  - a tool (a tool, required)
  - a date (from, required)
  - a date (until, required)
  - a note
  - status (requested, lent, returned or declined, requested by default)
  Each loan can have a borrower (a user, who makes it, by default, filled by the app).

Lend
  For a loan that is requested; sets status to lent.
  The tool's owner agrees to the request and hands the tool over.

Decline
  For a loan that is requested; sets status to declined.
  The tool's owner turns the request down.

Mark returned
  For a loan that is lent; sets status to returned.
  The tool's owner confirms the tool came back.

Sign-in and access
  People sign in with a code sent to their email.
  Everyone who signs in sees all records, and changes and deletes the ones they own.
  Roles:
  - admin: everything
  - member: opens every page; adds every kind of record
  New users get the member role.
  Open to anyone without signing in: the home page, the tools page, the privacy page and reading tools.
  Everyone who signs in can ask the app questions; it changes nothing. It answers plainly.

Assumed:
  Who sees the loans? Every signed-in neighbor sees all loans; the tool's owner lends, declines and marks a tool returned (or: Each borrower sees only their own loans, Only the tool's owner and the borrower see a loan)
  What can people see before they sign in? The tool catalog is public; loans and people stay private (or: Everything needs sign-in, Visitors also see which tools are lent out)
  Who may join the library? Only neighbors the organizers invite (or: Anyone may sign up, Only addresses on a given email domain)
  What does a loan record? The tool, the borrower, the dates, a note and a status (requested, lent, returned, declined) (or: Also a deposit amount, Also a condition check on return)
Frontier model (claude-opus-5-5) · 3,258 tokens (1,892 in, 1,366 out) · $0.0424
Pictures from the Smithable image library: samples/tool-1.webp, samples/tool-2.webp, samples/tool-3.webp, samples/tool-4.webp, samples/tool-5.webp, samples/tool-6.webp, hero.webp, logo.webp.
Generated 159 files (159 changed, 0 removed).

Created /tmp/smithable-bench-m12-sh9ztg/app-4. Open it in Studio, to see it and change it:

  cd /tmp/smithable-bench-m12-sh9ztg/app-4
  smithable studio

or only run the app with smithable run.
/tmp/smithable-bench-m12-sh9ztg/app-4/smithable.content.yml:3:3  warning  The privacy page "privacy" does not say who runs the app: give the operator's name under pages.privacy.operator (name, address, email, country, hosting).
```

### 5. An inventory app for a small bakery: ingredients, suppliers and stock levels.

```text
Bakery Stock
  Keeps track of the bakery's ingredients, who supplies them and how much is in stock.

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
  - notes
  Each supplier lists its ingredients.

Ingredients
  Ingredients have:
  - a name (required, unique)
  - a category (flour, sugar, dairy, eggs, fats, yeast, flavorings or other, flour by default)
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
  - member (Works in the bakery and keeps ingredients, suppliers and stock up to date): opens every page; adds every kind of record; changes everyone's ingredients and suppliers
  New users get the member role.
  Everyone who signs in can ask the app questions; it changes nothing. It answers plainly.

Assumed:
  How is the stock level kept? A quantity on each ingredient that staff update, with a level at which to reorder (or: A log of deliveries and usage that adds up the stock, Stock counts taken on set days)
  Who uses the app? Invited bakery staff who all see and update the same ingredients and suppliers (or: Only the owner, Staff only update stock and the owner manages suppliers)
  What does the app keep about each ingredient? Category, supplier, unit, stock, reorder level, cost per unit and storage (or: Also allergens, Also best-before dates per batch)
Frontier model (claude-opus-5-5) · 3,639 tokens (2,004 in, 1,635 out) · $0.0487
Pictures from the Smithable image library: logo.webp.
Generated 135 files (135 changed, 0 removed).

Created /tmp/smithable-bench-m12-sh9ztg/app-5. Open it in Studio, to see it and change it:

  cd /tmp/smithable-bench-m12-sh9ztg/app-5
  smithable studio

or only run the app with smithable run.
```

### 6. A job board for a local union, with job posts and applications.

```text
Union Jobs
  The local union's job board, where members find open jobs and apply.

Pages
  - Home (a landing page: hero, features, faq and footer)
  - Jobs (lists jobs; search by title, employer, location or description; filter by job type, status or closes on; “Mark filled”; “Close job”)
  - My applications (lists applications; only the viewer's own records)
  - Applications (lists applications; filter by job or status; only for staff users and admins)
  - Privacy (a privacy page written from the app: who runs it, what it stores and why, cookies, mail, logs, your rights)
  - Team (who has access: invite people, change roles, remove users; only for admins)

Jobs
  Jobs have:
  - a title (required)
  - an employer (required)
  - a location
  - a job type (full time, part time, temporary or apprenticeship, full time by default)
  - a wage
  - a description (required)
  - closes on (a date)
  - status (open, filled or closed, open by default)
  Each job lists its applications.

Applications
  Applications have:
  - a job (a job, required, unique)
  - a name (required)
  - a phone
  - a cover letter (required)
  - a resume (a document)
  - status (submitted, shortlisted, rejected or hired, submitted by default, filled by the app)
  A application is named after its job and its name.

Shortlist
  For an application that is submitted; sets status to shortlisted.

Reject
  For an application that is submitted or shortlisted; sets status to rejected.

Hire
  For an application that is shortlisted; sets status to hired.

Mark filled
  For a job that is open; sets status to filled.

Close job
  For a job that is open; sets status to closed.

Sign-in and access
  People sign in with a code sent to their email.
  Everyone sees, changes and deletes only their own records.
  Roles:
  - admin: everything
  - staff (Union staff who post jobs and handle applications): opens every page; sees everyone's records; adds jobs; changes everyone's jobs and applications; deletes everyone's jobs
  - member (Browses jobs and applies to them): opens the home page, the jobs page, the my applications page and the privacy page; sees everyone's jobs; adds applications
  New users get the member role.
  Open to anyone without signing in: the home page, the jobs page, the privacy page and reading jobs where status is open.
  Everyone who signs in can ask the app questions; it changes nothing. It answers plainly.

Assumed:
  Who posts the jobs? Union staff post jobs and handle the applications (or: Employers sign in and post their own jobs, Only the administrators post jobs)
  What can visitors see without signing in? Open jobs are public; signing in is needed to apply (or: Everything requires sign-in, Visitors can also see filled and closed jobs)
  Who can sign up to apply? Anyone can sign up and apply (or: Only members invited by the union, Only addresses on the union's email domain)
  What goes into an application? Name, phone, cover letter and an optional resume, one per job (or: Also the applicant's membership number, Only a short message)
Frontier model (claude-opus-5-5) · 4,013 tokens (1,931 in, 2,082 out) · $0.0571
Pictures from the Smithable image library: hero.webp, logo.webp.
Generated 162 files (162 changed, 0 removed).

Created /tmp/smithable-bench-m12-sh9ztg/app-6. Open it in Studio, to see it and change it:

  cd /tmp/smithable-bench-m12-sh9ztg/app-6
  smithable studio

or only run the app with smithable run.
/tmp/smithable-bench-m12-sh9ztg/app-6/smithable.content.yml:3:3  warning  The privacy page "privacy" does not say who runs the app: give the operator's name under pages.privacy.operator (name, address, email, country, hosting).
```

### 7. A football club's site: teams, players, matches and results.

```text
Club Football
  The club's site with its teams, players, fixtures and results.

Pages
  - Home (a landing page: hero, matches where status is scheduled, matches where status is played, teams and footer)
  - Matches (lists matches; search by opponent or ground; filter by team, status, venue, competition or kickoff; “Record result”; “Postpone”)
  - Teams (lists teams)
  - Players (lists players; search by name; filter by team or position)
  - Privacy (a privacy page written from the app: who runs it, what it stores and why, cookies, mail, logs, your rights)

Teams
  Teams have:
  - a name (required)
  - an age group (senior, youth or junior, senior by default)
  - a league
  - a coach
  - a photo (picture)
  - about
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
  - a ground
  - a competition (league, cup or friendly, league by default)
  - status (scheduled, played, postponed or cancelled, scheduled by default)
  - a goals for (a whole number, required when status is played)
  - a goals against (a whole number, required when status is played)
  - a report
  A match is named after its team, its opponent and its kickoff.

Record result
  For a match that is scheduled or postponed; sets status to played; asks for the goals for and the goals against.
  Enter the final score of a match once it has been played.

Postpone
  For a match that is scheduled; sets status to postponed.
  Mark a match as postponed.

Sign-in and access
  People sign in with a code sent to their email.
  Everyone sees, changes and deletes only their own records.
  Roles:
  - admin: everything
  - member (Follows the club; only administrators add and change teams, players and matches): opens every page
  New users get the member role.
  Open to anyone without signing in: the home page, the matches page, the teams page, the players page, the privacy page, reading teams, reading players and reading matches.
  Everyone who signs in can ask the app questions; it changes nothing. It answers plainly.

Assumed:
  What can visitors see without signing in? Teams, players, fixtures and results are all public (or: Only fixtures and results are public, Everything needs sign-in)
  Who keeps the site up to date? Only administrators add and edit teams, players and matches (or: Each team's coach edits their own team, Any signed-in member can add results)
  What does a player's profile hold? Name, team, position, shirt number, photo and a short bio; no contact details (or: Also date of birth and nationality, Also goals and appearances)
  How is a result recorded? A Record result button on a scheduled match asks for the score (or: Edit the score in the match form, Score each goal as its own record)
Frontier model (claude-opus-5-5) · 4,781 tokens (2,221 in, 2,560 out) · $0.0690
Pictures from the Smithable image library: samples/team-1.webp, samples/team-2.webp, samples/team-3.webp, samples/player-1.webp, hero.webp, logo.webp.
Generated 155 files (155 changed, 0 removed).

Created /tmp/smithable-bench-m12-sh9ztg/app-7. Open it in Studio, to see it and change it:

  cd /tmp/smithable-bench-m12-sh9ztg/app-7
  smithable studio

or only run the app with smithable run.
/tmp/smithable-bench-m12-sh9ztg/app-7/smithable.content.yml:3:3  warning  The privacy page "privacy" does not say who runs the app: give the operator's name under pages.privacy.operator (name, address, email, country, hosting).
```

### 8. Event registration for a conference: talks, speakers and attendees.

```text
Confhub
  Programme, speakers and attendee registration for a conference.

Pages
  - Home (a landing page: hero, features, speakers, faq, call to action and footer)
  - Schedule (a calendar of talks by week or month; filter by speaker or track)
  - My registration (lists registrations; only the viewer's own records)
  - Talks (lists talks; filter by speaker, track, level or starts at; only for organizers and admins)
  - Speakers (lists speakers)
  - Registrations (lists registrations; search by full name, email or company; filter by ticket or status; only for organizers and admins)
  - Privacy (a privacy page written from the app: who runs it, what it stores and why, cookies, mail, logs, your rights)

Speakers
  Speakers have:
  - a name (required)
  - a job title
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
  - a track (keynote, technical, business or workshop, keynote by default)
  - a level (beginner, intermediate or advanced, beginner by default)

Registrations
  Registrations have:
  - a full name (required)
  - an email (required)
  - a company
  - a job title
  - a ticket (standard, student or vip, standard by default)
  - dietary needs
  - status (confirmed or cancelled, confirmed by default)
  Each registration can have an attendee (a user).
  The attendee owns the registration.
  A registration is named after its full name.

Cancel registration
  For a registration that is confirmed; sets status to cancelled.
  The attendee no longer comes to the conference.

Sign-in and access
  People sign in with a code sent to their email.
  Everyone sees, changes and deletes only their own records.
  Roles:
  - admin: everything
  - organizer (Runs the conference: the programme, the speakers and the attendee list): opens the talks page, the speakers page, the registrations page, the schedule page and the my registration page; sees everyone's talks, speakers and registrations; adds talks, speakers and registrations; changes everyone's talks, speakers and registrations; deletes everyone's talks, speakers and registrations
  - attendee (Registers to attend the conference): opens the my registration page; adds registrations
  New users get the attendee role.
  Open to anyone without signing in: the home page, the schedule page, the speakers page, the privacy page, reading talks and reading speakers.
  Everyone who signs in can ask the app questions; it changes nothing. It answers plainly.

Assumed:
  What do attendees register for? The conference as a whole: one registration per attendee with a ticket type (or: A seat in each talk, limited by room capacity, Both a conference ticket and seats in workshops)
  What can people see without signing in? The landing page, the programme and the speakers; registering needs sign-in (or: Everything requires sign-in, Visitors can register without an account)
  Who runs the app? Organizers manage talks, speakers and registrations; attendees manage their own registration (or: Speakers also sign in to edit their own talks, Only admins manage everything)
  Can anyone sign up? Yes, anyone can sign up and register (or: Only invited people, Only addresses on certain domains)
Frontier model (claude-opus-5-5) · 4,612 tokens (2,182 in, 2,430 out) · $0.0660
Pictures from the Smithable image library: samples/speaker-1.webp, hero.webp, logo.webp.
Generated 160 files (160 changed, 0 removed).

Created /tmp/smithable-bench-m12-sh9ztg/app-8. Open it in Studio, to see it and change it:

  cd /tmp/smithable-bench-m12-sh9ztg/app-8
  smithable studio

or only run the app with smithable run.
/tmp/smithable-bench-m12-sh9ztg/app-8/smithable.content.yml:3:3  warning  The privacy page "privacy" does not say who runs the app: give the operator's name under pages.privacy.operator (name, address, email, country, hosting).
```

### 9. A help desk for an IT team: tickets, priorities and who handles them.

```text
Fixdesk
  The IT team's help desk: tickets, their priority and who handles them.

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
  Each ticket lists its notes.

Notes
  Notes have:
  - a content (required)
  - attachments (documents)
  - a ticket (a ticket, required)
  Each note can have an author (a user, who makes it, by default, filled by the app).

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
  - agent (Works the tickets: takes them, passes them on and closes them): opens the tickets page; adds every kind of record; changes everyone's records; runs every custom action
  New users get the agent role.
  Everyone who signs in can ask the app questions; it changes nothing. It answers plainly.

Assumed:
  Who signs in to the help desk? Only the IT team, invited from the team page; the person with the problem is noted by email on the ticket (or: Employees also sign in to open and follow their own tickets, Anyone at the company's email domain may sign in)
  How are priorities set? Low, normal, high or urgent, chosen on each ticket (or: A number from 1 to 5, Worked out from impact and urgency)
  How do tickets come in? The team enters them in the app (or: Mail to a support address becomes a ticket, Employees submit them through a form)
  What goes under a ticket? Internal notes from the team, shown as a thread (or: Replies mailed to the requester, Nothing beyond the ticket's description)
Frontier model (claude-opus-5-5) · 3,310 tokens (1,777 in, 1,533 out) · $0.0449
Pictures from the Smithable image library: logo.webp.
Generated 152 files (152 changed, 0 removed).

Created /tmp/smithable-bench-m12-sh9ztg/app-9. Open it in Studio, to see it and change it:

  cd /tmp/smithable-bench-m12-sh9ztg/app-9
  smithable studio

or only run the app with smithable run.
```

### 10. A recipe collection for a family, with ingredients and shopping lists.

```text
Family Kitchen
  The family's recipes with their ingredients, and the shopping lists we take to the store.

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
  - shop on (a date, today by default)
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

Sign-in and access
  People sign in with a code sent to their email.
  Everyone who signs in sees all records, and changes and deletes the ones they own.
  Roles:
  - admin: everything
  - member (A family member who cooks, adds recipes and shops): opens every page; adds every kind of record; changes everyone's recipes, ingredients, shopping lists and shopping items
  New users get the member role.
  Everyone who signs in can ask the app questions; it changes nothing. It answers plainly.

Assumed:
  Should the recipes be visible to anyone on the internet? No, only invited family members sign in and see everything (or: Recipes are public, shopping lists private, A public page showing a few chosen recipes)
  Who may edit recipes and shopping lists? Every family member may add and change all recipes and lists (or: Each person changes only what they added, Only parents edit; children look)
  How do ingredients get onto a shopping list? Items are typed into the list by hand (or: Add a recipe's ingredients to a list with one button, Lists built from a weekly meal plan)
  What does a recipe hold? Name, summary, category, servings, time, picture, instructions, source link, favorite, and its ingredients (or: Also ratings and comments from the family, Also nutrition values)
Frontier model (claude-opus-5-5) · 4,699 tokens (2,238 in, 2,461 out) · $0.0671
Pictures from the Smithable image library: samples/recipe-1.webp, samples/recipe-2.webp, logo.webp.
Generated 154 files (154 changed, 0 removed).

Created /tmp/smithable-bench-m12-sh9ztg/app-10. Open it in Studio, to see it and change it:

  cd /tmp/smithable-bench-m12-sh9ztg/app-10
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
  - Overview (a dashboard: open, per month and latest)
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
  Everyone who signs in can ask the app questions; it changes nothing. It answers plainly.

Assumed:
  What can visitors see without signing in? The status page, each component's state, incidents with their updates, and planned maintenance (or: Only the components' current state, Everything except resolved incidents)
  Who writes incidents and maintenance? An invited team (staff) writes them; admins also manage the components and the team (or: Admins only, Anyone on the team, components included)
  Which time zone are times shown in? UTC (or: The team's local time zone)
Frontier model (claude-opus-5-5) · 4,845 tokens (2,373 in, 2,472 out) · $0.0684
Pictures from the Smithable image library: hero.webp, logo.webp.
Generated 163 files (163 changed, 0 removed).

Created /tmp/smithable-bench-m12-sh9ztg/app-11. Open it in Studio, to see it and change it:

  cd /tmp/smithable-bench-m12-sh9ztg/app-11
  smithable studio

or only run the app with smithable run.
/tmp/smithable-bench-m12-sh9ztg/app-11/smithable.content.yml:3:3  warning  The privacy page "privacy" does not say who runs the app: give the operator's name under pages.privacy.operator (name, address, email, country, hosting).
```

### 12. A public uptime page for a web shop: which services work, outages and their updates.

```text
Shop Status
  Is the shop working? The state of our web shop's services, its outages and their updates.

Pages
  - Home (a landing page: hero, components, incidents where status is investigating or identified or monitoring, incidents where status is resolved and footer)
  - Incidents (lists incidents; filter by status or component; “Identified”; “Monitoring”; “Resolve”)
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
  For an incident that is investigating; sets status to identified; adds an incident update (at now, status identified, message We have found the cause and are working on a fix.).
  The cause is found; the incident moves to identified, with an update saying so.

Monitoring
  For an incident that is investigating or identified; sets status to monitoring; adds an incident update (at now, status monitoring, message A fix is in place. We are watching before we close this.).
  A fix is out; the incident is watched before it is closed.

Resolve
  For an incident that is investigating, identified or monitoring; sets status to resolved and resolved at to now; adds an incident update (at now, status resolved, message This incident is resolved.).
  The outage is over, with an update saying so.

Sign-in and access
  People sign in with a code sent to their email.
  Everyone who signs in sees all records, and changes and deletes the ones they own.
  Roles:
  - admin: everything
  - staff (Writes incidents and their updates): opens the incidents page; adds every kind of record; changes everyone's records
  New users get the staff role.
  Open to anyone without signing in: the home page, the privacy page, reading components, reading incidents where status is investigating or identified or monitoring or resolved and reading incident updates.
  Everyone who signs in can ask the app questions; it changes nothing. It answers plainly.

Assumed:
  Should the page also announce planned maintenance? No, only services, outages and their updates (or: Yes, with a planned maintenance list)
  Who writes the incidents? An invited team: admins keep the services list, staff write incidents and updates (or: Admins only, Anyone who signs up)
  What can visitors see? Service states, current and past outages with their updates (or: Only current outages, Service states only)
  Where do incident updates live? As a timeline on each incident, with no page of their own (or: Their own list page too)
Frontier model (claude-opus-5-5) · 3,800 tokens (2,112 in, 1,688 out) · $0.0506
Pictures from the Smithable image library: hero.webp, logo.webp.
Generated 151 files (151 changed, 0 removed).

Created /tmp/smithable-bench-m12-sh9ztg/app-12. Open it in Studio, to see it and change it:

  cd /tmp/smithable-bench-m12-sh9ztg/app-12
  smithable studio

or only run the app with smithable run.
/tmp/smithable-bench-m12-sh9ztg/app-12/smithable.content.yml:3:3  warning  The privacy page "privacy" does not say who runs the app: give the operator's name under pages.privacy.operator (name, address, email, country, hosting).
```
