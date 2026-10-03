# M12 first builds: mistral-medium-latest, the second set (2026-10-03)

The app descriptions, each started with `smithable new --describe` (the closest starter, adapted by the model; errors go back up to twice). Totals: 22 / 22 created, 22 type-check, 231,811 tokens, €0.1277.

| Description | Starter | Created | Type-checks | Tokens | Cost | Time |
|---|---|---|---|---|---|---|
| My clients as a freelance translator: who they are, what I quoted and what they paid. | crm | yes | yes | 7,451 | €0.0038 | 17 s |
| A sales pipeline for our six-person web agency: leads, deals and who follows up when. | crm | yes | yes | 7,838 | €0.0046 | 20 s |
| Online booking for a hair salon: customers pick a stylist and a free time themselves. | booking | yes | yes | 8,152 | €0.0046 | 21 s |
| A piano teacher's lessons: my pupils, their weekly times and what each one practises. | crm | yes | yes | 7,422 | €0.0038 | 19 s |
| Invoices for my photography work: clients, shoots and what is still unpaid. | invoicing | yes | yes | 15,501 | €0.0086 | 24 s |
| Our cleaning company of three sends invoices to households every month; we need one place for them. | booking | yes | yes | 7,657 | €0.0036 | 14 s |
| A town flea market site where anyone can post things to sell, with photos and a price. | marketplace | yes | yes | 7,259 | €0.0040 | 17 s |
| A swap shelf for our office: colleagues offer things they no longer need and others claim them. | invoicing | yes | yes | 7,324 | €0.0036 | 14 s |
| My vinyl record collection: albums, artists, condition and what I paid. | crm | yes | yes | 7,531 | €0.0040 | 15 s |
| Our local museum's collection online, so visitors can browse the objects and their stories. | marketplace | yes | yes | 7,072 | €0.0036 | 14 s |
| An internal status board for our IT systems, so staff see what is down and when it is back. | status | yes | yes | 16,126 | €0.0092 | 25 s |
| Service status for our municipality's online services, for residents to check outages. | status | yes | yes | 23,548 | €0.0124 | 27 s |
| A log of my car's fuel, service visits and costs. | status | yes | yes | 7,503 | €0.0038 | 16 s |
| The guest list and seating plan for our wedding, with who has answered and their meal choices. | invoicing | yes | yes | 7,301 | €0.0036 | 14 s |
| Bird sightings for our birdwatching club: species, place, date and who saw it. | booking | yes | yes | 7,528 | €0.0034 | 13 s |
| Our allotment society: who has which plot, the waiting list and the yearly fee. | booking | yes | yes | 17,695 | €0.0110 | 46 s |
| Bokning för min frisörsalong, kunderna ska kunna boka tid själva på nätet. | records | yes | yes | 7,844 | €0.0053 | 35 s |
| Vi är en liten byggfirma och behöver hålla koll på offerter, kunder och fakturor. | records | yes | yes | 14,901 | €0.0081 | 44 s |
| En sida för vår loppis där folk kan lägga upp saker de vill sälja, med bilder och pris. | records | yes | yes | 6,861 | €0.0033 | 29 s |
| Varausjärjestelmä joogastudiollemme: tunnit, ohjaajat ja varaukset verkossa. | records | yes | yes | 14,842 | €0.0078 | 33 s |
| Pieni autokorjaamo: asiakkaat, autot, huoltotyöt ja laskut yhdessä paikassa. | records | yes | yes | 16,998 | €0.0111 | 38 s |
| Für meinen kleinen Hofladen: Produkte, Vorbestellungen der Kunden und Abholzeiten. | records | yes | yes | 7,457 | €0.0045 | 24 s |

Each created app's four spec files are in [m12-first-builds-mistral-medium-latest-wide/](m12-first-builds-mistral-medium-latest-wide/), one folder per description (app-1 …).

<!-- scorecard -->
## Scorecard (scripts/bench-m12.mjs --score)

| # | Starter | Models kept | Pages kept | Actions kept | Access; roles (default) | Pages with access | Public | Warnings | Starter's texts in the draft | Models with the starter's samples | Visitors / landing | Language | App name in it | Labels in it | Landing texts in it |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | crm | 0 / 2 | 0 / 3 | 0 / 1 | private; admin, member (member) | none | pages none; read none; create none | 0 | none | 0 / 3 | no mention; no landing page | en | | | |
| 2 | crm | 0 / 2 | 1 / 3 | 0 / 1 | shared; admin, sales (sales) | none | pages none; read none; create none | 1 (open-shared-access) | none | 0 / 2 | no mention; no landing page | en | | | |
| 3 | booking | 0 / 6 | 1 / 10 | 0 / 0 | shared; admin (admin) | stylists: admin, services: admin, appointments: admin | pages home; read Stylist, Service; create none | 1 (open-shared-access) | none | 0 / 3 | no mention; landing page | en | | | |
| 4 | crm | 0 / 2 | 0 / 3 | 0 / 1 | private; admin, member (member) | none | pages none; read none; create none | 0 | none | 0 / 3 | no mention; no landing page | en | | | |
| 5 | invoicing | 3 / 4 | 3 / 7 | 0 / 0 | private; admin, member (member) | none | pages none; read none; create none | 0 | none | 3 / 3 | no mention; no landing page | en | | | |
| 6 | booking | 0 / 6 | 0 / 10 | 0 / 0 | shared; admin, member (member) | none | pages none; read none; create none | 1 (open-shared-access) | none | 0 / 1 | no mention; no landing page | en | | | |
| 7 | marketplace | 1 / 1 | 4 / 4 | 0 / 0 | private; admin, member (member) | none | pages home, catalog; read Item; create none | 0 | none | 1 / 1 | mentions visitors; landing page | en | | | |
| 8 | invoicing | 0 / 4 | 0 / 7 | 0 / 0 | shared; admin, member (member) | none | pages none; read none; create none | 1 (open-shared-access) | none | 0 / 1 | no mention; no landing page | en | | | |
| 9 | crm | 0 / 2 | 0 / 3 | 0 / 1 | private; admin, member (member) | none | pages none; read none; create none | 0 | none | 0 / 2 | no mention; no landing page | en | | | |
| 10 | marketplace | 0 / 1 | 1 / 4 | 0 / 0 | shared; admin, member (member) | none | pages home, artifacts; read Artifact; create none | 1 (open-shared-access) | none | 0 / 1 | mentions visitors; landing page | en | | | |
| 11 | status | 4 / 4 | 7 / 8 | 3 / 3 | shared; admin, staff (staff) | incidents: admin/staff, updates: admin/staff, components: admin, maintenance: admin/staff | pages none; read none; create none | 0 | none | 4 / 4 | no mention; landing page | en | | | |
| 12 | status | 4 / 4 | 7 / 8 | 0 / 3 | shared; admin, staff (staff) | incidents: admin/staff, updates: admin/staff, components: admin, maintenance: admin/staff, overview: admin/staff, team: admin | pages home; read Component, Incident, IncidentUpdate, Maintenance; create none | 0 | none | 4 / 4 | no mention; landing page | en | | | |
| 13 | status | 0 / 4 | 0 / 8 | 0 / 3 | private; admin, member (member) | none | pages none; read none; create none | 0 | none | 0 / 3 | no mention; no landing page | en | | | |
| 14 | invoicing | 0 / 4 | 0 / 7 | 0 / 0 | shared; admin, member (member) | none | pages none; read none; create none | 1 (open-shared-access) | none | 0 / 1 | no mention; no landing page | en | | | |
| 15 | booking | 0 / 6 | 0 / 10 | 0 / 0 | shared; admin, member (member) | none | pages none; read none; create none | 1 (open-shared-access) | none | 0 / 1 | no mention; no landing page | en | | | |
| 16 | booking | 0 / 6 | 1 / 10 | 0 / 0 | shared; admin, member (member) | assignments: admin, fees: admin, waiting-list: admin, payments: admin | pages none; read none; create none | 2 (capacity-no-unique, open-shared-access) | none | 0 / 6 | no mention; no landing page | en | | | |
| 17 | records | 0 / 1 | 1 / 2 | 0 / 0 | private; admin (admin) | appointments: admin, services: admin | pages home; read Service; create Appointment | 0 | none | 0 / 2 | no mention; landing page | sv | yes (frisörsalong, bokning) | yes (tid) | yes (boka, tid, en) |
| 18 | records | 0 / 1 | 0 / 2 | 0 / 0 | shared; admin, accountant, worker (worker) | none | pages none; read none; create none | 1 (open-shared-access) | none | 0 / 3 | no mention; no landing page | sv | yes (byggfirma) | none | none |
| 19 | records | 1 / 1 | 2 / 2 | 0 / 0 | private; admin, member (member) | none | pages home, items; read Item; create none | 0 | none | 0 / 1 | no mention; landing page | sv | yes (vår, loppis) | none | no |
| 20 | records | 0 / 1 | 1 / 2 | 0 / 0 | shared; admin, teacher, member (member) | teachers: admin/teacher, bookings: admin/teacher/member | pages home; read Class; create none | 1 (open-shared-access) | none | 0 / 3 | no mention; landing page | fi | no | none | no |
| 21 | records | 0 / 1 | 0 / 2 | 0 / 0 | shared; admin, mechanic, accountant (mechanic) | work-orders: mechanic, invoices: accountant | pages none; read none; create none | 1 (open-shared-access) | none | 0 / 6 | no mention; no landing page | fi | yes (pieni, autokorjaamo) | none | none |
| 22 | records | 0 / 1 | 0 / 2 | 0 / 0 | shared; admin, employee (employee) | none | pages none; read none; create none | 1 (open-shared-access) | none | 0 / 3 | no mention; no landing page | de | yes (hofladen) | none | none |

"Kept" counts the starter's models, pages and actions that the draft still has by name. "Starter's texts" lists the starter's app name or sample titles found in the draft's spec or content. "Models with the starter's samples" counts the draft's models that keep some of the starter's sample records after `fitSamples`; the rest get generated rows. "Mentions visitors" means the description says visitors, public or site. For a description not in English, the language columns say whether the app's name, its model and field labels, and its landing pages' texts contain words of that language (common words, or the description's own words of four letters or more), with up to three of them.
<!-- /scorecard -->

## What stands out (both sets, Mistral Medium on main bb93877)

The first set came out as the run before, starter for starter and warning for warning, so it stands as the baseline for the coming draft fixes. In this second set:

- **The starter is picked badly off the beaten track.** All 22 drafts were created and type-check, but:
  - Every description not in English got `records`, including a Swedish hair salon booking (17) and a Finnish yoga studio's booking (20), which are booking's own territory.
  - In English the slants mostly kept their starter: freelance translator → crm, hair salon → booking, flea market → marketplace, both status boards → status.
  - The rest did not: piano lessons → crm (4), a cleaning company's invoices → booking (6), an office swap shelf → invoicing (8), a vinyl collection → crm (9), a museum's collection → marketplace (10), a car log → status (13), a wedding guest list → invoicing (14), bird sightings → booking (15) and an allotment society → booking (16). The honest choice for most of these was `records`.
- **Drafts mostly start over rather than adapt.** Away from its own territory a draft keeps none of the starter's models (0 / n in 15 of 22), and only apps 5, 7, 11 and 12 keep their starter's sample records.
- **Starter actions are kept once.** Only app 11 keeps the status starter's three actions (3 / 3). App 12, like both status apps in the first set, keeps none.
- **Open sign-up is common:** `open-shared-access` in 10 of 22 here and 8 of 12 in the first set. There is no `public-personal-data` in this set; the first set has two.
- **Not in English, the app's name follows the description, but the rest does not.** The app is named in the description's language in five of six ("Vår Loppis", "Hofladen", "Autokorjaamo"…; the sixth, "Joogastudio", is Finnish too, but an inflected form the plain word check does not know). But models and fields are English identifiers ("Class", "PreOrder"), and no draft gives labels in the content file, so the pages show English labels derived from the names. Landing texts are in the description's language only in 17 (Swedish).
- **Visitors and public pages:**
  - The museum (10) and the municipality's status page (12) got public pages.
  - The hair salon in Swedish (17) lets visitors create appointments without signing in. The English hair salon (3) does not.
  - The internal IT status board (11) has no public page, as asked.


## Summaries, for review

### 1. My clients as a freelance translator: who they are, what I quoted and what they paid.

```text
Freelance Translator CRM
  Track clients, quotes, and payments for a freelance translator.

Pages
  - Clients (lists clients; search by name or email)
  - Quotes (lists quotes; search by client or status)
  - Payments (lists payments; search by quote or method)

Clients
  Clients have:
  - a name (required)
  - an email (unique)
  - a phone
  - notes

Quotes
  Quotes have:
  - a client (a client, required)
  - an amount (an amount, required)
  - a currency (USD by default)
  - status (sent, accepted, rejected or paid, sent by default)
  - sent at (a date, today by default)
  - notes

Payments
  Payments have:
  - a quote (a quote, required)
  - an amount (an amount, required)
  - a currency (USD by default)
  - received at (a date, today by default)
  - a method (bank, paypal or cash, bank by default)
  - notes

Sign-in and access
  People sign in with Google.
  Everyone sees and changes only their own records.
  Roles:
  - admin
  - member
  New users get the member role.
Pictures from the Smithable image library: samples/1.webp, samples/2.webp, samples/3.webp, samples/4.webp, samples/5.webp, samples/6.webp.
Generated 81 files (81 changed, 0 removed).
No config path provided, using default 'drizzle.config.ts'
Reading config file '/tmp/smithable-bench-m12-LE2aZR/app-1/drizzle.config.ts'
7 tables
account 13 columns 1 indexes 1 fks
clients 8 columns 1 indexes 1 fks
payments 10 columns 0 indexes 2 fks
quotes 10 columns 0 indexes 2 fks
session 8 columns 2 indexes 1 fks
user 8 columns 1 indexes 0 fks
verification 6 columns 1 indexes 0 fks

[✓] Your SQL migration file ➜ drizzle/0000_cultured_toad.sql 🚀

Created /tmp/smithable-bench-m12-LE2aZR/app-1. Start it with:

  cd /tmp/smithable-bench-m12-LE2aZR/app-1
  smithable run
```

### 2. A sales pipeline for our six-person web agency: leads, deals and who follows up when.

```text
Web Agency CRM
  A sales pipeline for a six-person web agency to track leads, deals, and follow-ups.

Pages
  - Leads (lists leads; search by name, email or company; sort by name, follow up date or date added)
  - Deals (lists deals; search by name or lead; sort by name, value, close date or date added)
  - Team (who has access: invite people, change roles, remove users)

Leads
  Leads have:
  - a name (required)
  - an email
  - a phone
  - a company
  - status (new, contacted, qualified or lost, new by default)
  - a source (referral, website, social or other, referral by default)
  - notes
  - a follow up date
  Each lead can have an assignee (a user).

Deals
  Deals have:
  - a name (required)
  - a lead (a lead, required)
  - a value (an amount)
  - status (proposal, negotiation, won or lost, proposal by default)
  - a close date
  - notes
  Each deal can have an assignee (a user).

Sign-in and access
  People sign in with Google.
  Everyone who signs in sees all records, and changes and deletes the ones they own.
  Roles:
  - admin
  - sales (Manages leads and deals)
  New users get the sales role.
Pictures from the Smithable image library: samples/1.webp, samples/2.webp, samples/3.webp, samples/4.webp, samples/5.webp, samples/6.webp.
Generated 81 files (81 changed, 0 removed).
No config path provided, using default 'drizzle.config.ts'
Reading config file '/tmp/smithable-bench-m12-LE2aZR/app-2/drizzle.config.ts'
7 tables
account 13 columns 1 indexes 1 fks
deals 11 columns 0 indexes 3 fks
invitation 7 columns 2 indexes 1 fks
leads 13 columns 0 indexes 2 fks
session 8 columns 2 indexes 1 fks
user 8 columns 1 indexes 0 fks
verification 6 columns 1 indexes 0 fks

[✓] Your SQL migration file ➜ drizzle/0000_warm_screwball.sql 🚀

Created /tmp/smithable-bench-m12-LE2aZR/app-2. Start it with:

  cd /tmp/smithable-bench-m12-LE2aZR/app-2
  smithable run
/tmp/smithable-bench-m12-LE2aZR/app-2/smithable.auth.yml:4:16  warning  With shared access and no allowedDomains, anyone with an account at the sign-in provider can sign up and read all records.
    hint: Restrict sign-in with "allowedDomains" or "selfSignUp: false" under "signIn", or use "defaultAccess: private".
```

### 3. Online booking for a hair salon: customers pick a stylist and a free time themselves.

```text
Hair Salon Booking
  Online booking for a hair salon where customers pick a stylist and a free time themselves.

Pages
  - Home (a landing page: hero, services, stylists, contact and footer)
  - Stylists (lists stylists; only for admins; visitors see stylists on the Home page)
  - Services (lists services; only for admins; visitors see services on the Home page)
  - Appointments (lists appointments; search by customer name, customer email or customer phone; filter by stylist, service, status or starts at; only for admins)
  - Team (who has access: invite people, change roles, remove users)

Stylists
  Stylists have:
  - a name (required)
  - a bio
  - a portrait (picture)
  Only admins can delete stylists.
  Only admins can add stylists.

Services
  Services have:
  - a name (required)
  - a description
  - duration minutes (a whole number, required, 30 by default)
  - a price (an amount, required)
  Only admins can delete services.
  Only admins can add services.

Appointments
  Appointments have:
  - a service (a service, required)
  - a stylist (a stylist, required)
  - starts at (a date and time, required)
  - a customer name (required)
  - a customer email (required)
  - a customer phone
  - status (pending, confirmed, cancelled or completed, pending by default)
  Only admins can delete appointments.

Sign-in and access
  People sign in with Google.
  Everyone who signs in sees all records, and changes and deletes the ones they own.
  Roles:
  - admin (Manages stylists, services, and appointments)
  New users get the admin role.
  Open to anyone without signing in: the home page, reading stylists and reading services.
Pictures from the Smithable image library: samples/1.webp, samples/2.webp, samples/3.webp, samples/4.webp, samples/5.webp, samples/6.webp, hero.webp.
Generated 93 files (93 changed, 0 removed).
No config path provided, using default 'drizzle.config.ts'
Reading config file '/tmp/smithable-bench-m12-LE2aZR/app-3/drizzle.config.ts'
8 tables
account 13 columns 1 indexes 1 fks
appointments 11 columns 0 indexes 3 fks
invitation 7 columns 2 indexes 1 fks
services 8 columns 0 indexes 1 fks
session 8 columns 2 indexes 1 fks
stylists 7 columns 0 indexes 1 fks
user 8 columns 1 indexes 0 fks
verification 6 columns 1 indexes 0 fks

[✓] Your SQL migration file ➜ drizzle/0000_small_black_tarantula.sql 🚀

Created /tmp/smithable-bench-m12-LE2aZR/app-3. Start it with:

  cd /tmp/smithable-bench-m12-LE2aZR/app-3
  smithable run
/tmp/smithable-bench-m12-LE2aZR/app-3/smithable.auth.yml:4:16  warning  With shared access and no allowedDomains, anyone with an account at the sign-in provider can sign up and read all records.
    hint: Restrict sign-in with "allowedDomains" or "selfSignUp: false" under "signIn", or use "defaultAccess: private".
```

### 4. A piano teacher's lessons: my pupils, their weekly times and what each one practises.

```text
Piano Lessons
  Track pupils, their weekly lesson times and practice notes.

Pages
  - Pupils (lists pupils; search by name or email)
  - Lessons (lists lessons; search by pupil or day of week)
  - Practice (lists practices; search by pupil or piece)

Pupils
  Pupils have:
  - a name (required)
  - an email
  - a phone
  - notes

Lessons
  Lessons have:
  - a pupil (a pupil, required)
  - a day of week (monday, tuesday, wednesday, thursday, friday, saturday or sunday, monday by default)
  - a start time (required)
  - a duration (a whole number, required, 30 by default)
  - notes

Practices
  Practices have:
  - a pupil (a pupil, required)
  - a lesson (a lesson)
  - a date (required)
  - a piece (required)
  - notes

Sign-in and access
  People sign in with Google.
  Everyone sees and changes only their own records.
  Roles:
  - admin
  - member
  New users get the member role.
Pictures from the Smithable image library: samples/1.webp, samples/2.webp, samples/3.webp, samples/4.webp, samples/5.webp, samples/6.webp.
Generated 79 files (79 changed, 0 removed).
No config path provided, using default 'drizzle.config.ts'
Reading config file '/tmp/smithable-bench-m12-LE2aZR/app-4/drizzle.config.ts'
7 tables
account 13 columns 1 indexes 1 fks
lessons 9 columns 0 indexes 2 fks
practices 9 columns 0 indexes 3 fks
pupils 8 columns 0 indexes 1 fks
session 8 columns 2 indexes 1 fks
user 8 columns 1 indexes 0 fks
verification 6 columns 1 indexes 0 fks

[✓] Your SQL migration file ➜ drizzle/0000_steep_layla_miller.sql 🚀

Created /tmp/smithable-bench-m12-LE2aZR/app-4. Start it with:

  cd /tmp/smithable-bench-m12-LE2aZR/app-4
  smithable run
```

### 5. Invoices for my photography work: clients, shoots and what is still unpaid.

```text
Photography Invoicing
  Invoices for photography work: clients, shoots and unpaid amounts.

Pages
  - Clients (lists clients)
  - Invoices (lists invoices; search by number; filter by status or client)
  - Invoice lines (lists invoice lines)

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
  - an amount (an amount)
  - an invoice (an invoice, required)
  Only the owner and admins can delete invoice lines.

Invoices
  Invoices have:
  - a number (required, unique)
  - a client (a client, required)
  - issued on (a date, required, today by default)
  - due on (a date, required, the issued on plus 30 days by default)
  - status (draft, sent, paid or overdue, draft by default)
  - a total (an amount)
  Each invoice lists its invoice lines.
  Only the owner and admins can delete invoices.

Sign-in and access
  People sign in with Google.
  Everyone sees and changes only their own records.
  Roles:
  - admin
  - member (A photographer managing their invoices)
  New users get the member role.
Pictures from the Smithable image library: samples/1.webp, samples/2.webp, samples/3.webp, samples/4.webp, samples/5.webp, samples/6.webp.
Generated 82 files (82 changed, 0 removed).
No config path provided, using default 'drizzle.config.ts'
Reading config file '/tmp/smithable-bench-m12-LE2aZR/app-5/drizzle.config.ts'
7 tables
account 13 columns 1 indexes 1 fks
clients 8 columns 0 indexes 1 fks
invoice_lines 9 columns 0 indexes 2 fks
invoices 10 columns 1 indexes 2 fks
session 8 columns 2 indexes 1 fks
user 8 columns 1 indexes 0 fks
verification 6 columns 1 indexes 0 fks

[✓] Your SQL migration file ➜ drizzle/0000_silly_prodigy.sql 🚀

Created /tmp/smithable-bench-m12-LE2aZR/app-5. Start it with:

  cd /tmp/smithable-bench-m12-LE2aZR/app-5
  smithable run
```

### 6. Our cleaning company of three sends invoices to households every month; we need one place for them.

```text
Cleaning Company
  A place for our cleaning company to manage monthly invoices for households.

Pages
  - Invoices (lists invoices; search by household; filter by status or month)

Invoices
  Invoices have:
  - a household (required)
  - an amount (an amount, required)
  - a month (a date, required)
  - status (draft, sent or paid, draft by default)

Sign-in and access
  People sign in with Google.
  Everyone who signs in sees all records, and changes and deletes the ones they own.
  Roles:
  - admin
  - member
  New users get the member role.
Pictures from the Smithable image library: samples/1.webp, samples/2.webp, samples/3.webp, samples/4.webp, samples/5.webp, samples/6.webp.
Generated 71 files (71 changed, 0 removed).
No config path provided, using default 'drizzle.config.ts'
Reading config file '/tmp/smithable-bench-m12-LE2aZR/app-6/drizzle.config.ts'
5 tables
account 13 columns 1 indexes 1 fks
invoices 8 columns 0 indexes 1 fks
session 8 columns 2 indexes 1 fks
user 8 columns 1 indexes 0 fks
verification 6 columns 1 indexes 0 fks

[✓] Your SQL migration file ➜ drizzle/0000_early_imperial_guard.sql 🚀

Created /tmp/smithable-bench-m12-LE2aZR/app-6. Start it with:

  cd /tmp/smithable-bench-m12-LE2aZR/app-6
  smithable run
/tmp/smithable-bench-m12-LE2aZR/app-6/smithable.auth.yml:4:16  warning  With shared access and no allowedDomains, anyone with an account at the sign-in provider can sign up and read all records.
    hint: Restrict sign-in with "allowedDomains" or "selfSignUp: false" under "signIn", or use "defaultAccess: private".
```

### 7. A town flea market site where anyone can post things to sell, with photos and a price.

```text
Town Flea Market
  A local marketplace where anyone can post items for sale with photos and prices.

Pages
  - Home (a landing page: hero and footer)
  - Catalog (lists items; search by title, description or place; filter by category, price, condition or available; sort by price or date added; records can be saved as favorites; contact the owner by mail)
  - My items (lists items; only the viewer's own records)
  - Saved (lists items; only the viewer's saved records)

Items
  Items have:
  - a title (required)
  - photos (pictures)
  - a description (required)
  - a price (an amount)
  - a category (furniture, bikes, electronics, sports, kids or other, furniture by default)
  - a condition (like new, good or worn, like new by default)
  - a place
  - an available (yes or no, true by default)

Sign-in and access
  People sign in with Google.
  Everyone sees and changes only their own records.
  Roles:
  - admin (Keeps the marketplace tidy)
  - member (Sells and saves items)
  New users get the member role.
  Open to anyone without signing in: the home page, the catalog page and reading items.
Pictures from the Smithable image library: samples/1.webp, samples/2.webp, samples/3.webp, samples/4.webp, samples/5.webp, samples/6.webp, hero.webp.
Generated 86 files (86 changed, 0 removed).
No config path provided, using default 'drizzle.config.ts'
Reading config file '/tmp/smithable-bench-m12-LE2aZR/app-7/drizzle.config.ts'
6 tables
account 13 columns 1 indexes 1 fks
items 12 columns 0 indexes 1 fks
items_favorites 4 columns 1 indexes 2 fks
session 8 columns 2 indexes 1 fks
user 8 columns 1 indexes 0 fks
verification 6 columns 1 indexes 0 fks

[✓] Your SQL migration file ➜ drizzle/0000_noisy_blackheart.sql 🚀

Created /tmp/smithable-bench-m12-LE2aZR/app-7. Start it with:

  cd /tmp/smithable-bench-m12-LE2aZR/app-7
  smithable run
```

### 8. A swap shelf for our office: colleagues offer things they no longer need and others claim them.

```text
Swap Shelf
  A place for colleagues to offer and claim items they no longer need.

Pages
  - Items (lists items; search by name or description; filter by status)

Items
  Items have:
  - a name (required)
  - a description
  - status (available, claimed or taken, available by default)
  - an image (a web address)
  Each item can have an offered by (a user).
  Each item can have a claimed by (a user).
  Only the owner and admins can delete items.

Sign-in and access
  People sign in with Google.
  Everyone who signs in sees all records, and changes and deletes the ones they own.
  Roles:
  - admin
  - member
  New users get the member role.
Pictures from the Smithable image library: samples/1.webp, samples/2.webp, samples/3.webp, samples/4.webp, samples/5.webp, samples/6.webp.
Generated 72 files (72 changed, 0 removed).
No config path provided, using default 'drizzle.config.ts'
Reading config file '/tmp/smithable-bench-m12-LE2aZR/app-8/drizzle.config.ts'
5 tables
account 13 columns 1 indexes 1 fks
items 10 columns 0 indexes 3 fks
session 8 columns 2 indexes 1 fks
user 8 columns 1 indexes 0 fks
verification 6 columns 1 indexes 0 fks

[✓] Your SQL migration file ➜ drizzle/0000_fuzzy_gwen_stacy.sql 🚀

Created /tmp/smithable-bench-m12-LE2aZR/app-8. Start it with:

  cd /tmp/smithable-bench-m12-LE2aZR/app-8
  smithable run
/tmp/smithable-bench-m12-LE2aZR/app-8/smithable.auth.yml:4:16  warning  With shared access and no allowedDomains, anyone with an account at the sign-in provider can sign up and read all records.
    hint: Restrict sign-in with "allowedDomains" or "selfSignUp: false" under "signIn", or use "defaultAccess: private".
```

### 9. My vinyl record collection: albums, artists, condition and what I paid.

```text
Vinyl Collection
  Track my vinyl record collection with albums, artists, condition and purchase price.

Pages
  - Artists (lists artists)
  - Albums (lists albums; search by title, artist or catalog number; filter by artist or condition)

Artists
  Artists have:
  - a name (required, unique)

Albums
  Albums have:
  - a title (required)
  - an artist (an artist, required)
  - a year (a whole number)
  - a condition (mint, near mint, very good, good, fair or poor, mint by default)
  - a price paid (an amount)
  - a catalog number
  - notes

Sign-in and access
  People sign in with Google.
  Everyone sees and changes only their own records.
  Roles:
  - admin
  - member
  New users get the member role.
Pictures from the Smithable image library: samples/1.webp, samples/2.webp, samples/3.webp, samples/4.webp, samples/5.webp, samples/6.webp.
Generated 76 files (76 changed, 0 removed).
No config path provided, using default 'drizzle.config.ts'
Reading config file '/tmp/smithable-bench-m12-LE2aZR/app-9/drizzle.config.ts'
6 tables
account 13 columns 1 indexes 1 fks
albums 11 columns 0 indexes 2 fks
artists 5 columns 1 indexes 1 fks
session 8 columns 2 indexes 1 fks
user 8 columns 1 indexes 0 fks
verification 6 columns 1 indexes 0 fks

[✓] Your SQL migration file ➜ drizzle/0000_spotty_shaman.sql 🚀

Created /tmp/smithable-bench-m12-LE2aZR/app-9. Start it with:

  cd /tmp/smithable-bench-m12-LE2aZR/app-9
  smithable run
```

### 10. Our local museum's collection online, so visitors can browse the objects and their stories.

```text
Local Museum Collection
  Browse the museum's objects and their stories online.

Pages
  - Artifacts (lists artifacts; search by name, description, era, origin or story; sort by name, era or date added)
  - Home (a landing page: hero and footer)

Artifacts
  Artifacts have:
  - a name (required)
  - a description (required)
  - a category (paintings, sculptures, ceramics, textiles, jewelry or other, paintings by default)
  - an era
  - an origin
  - photos (pictures)
  - a story

Sign-in and access
  People sign in with Google.
  Everyone who signs in sees all records, and changes and deletes the ones they own.
  Roles:
  - admin
  - member
  New users get the member role.
  Open to anyone without signing in: the home page, the artifacts page and reading artifacts.
Pictures from the Smithable image library: samples/1.webp, samples/2.webp, samples/3.webp, samples/4.webp, samples/5.webp, samples/6.webp, hero.webp.
Generated 79 files (79 changed, 0 removed).
No config path provided, using default 'drizzle.config.ts'
Reading config file '/tmp/smithable-bench-m12-LE2aZR/app-10/drizzle.config.ts'
5 tables
account 13 columns 1 indexes 1 fks
artifacts 11 columns 0 indexes 1 fks
session 8 columns 2 indexes 1 fks
user 8 columns 1 indexes 0 fks
verification 6 columns 1 indexes 0 fks

[✓] Your SQL migration file ➜ drizzle/0000_melted_madrox.sql 🚀

Created /tmp/smithable-bench-m12-LE2aZR/app-10. Start it with:

  cd /tmp/smithable-bench-m12-LE2aZR/app-10
  smithable run
/tmp/smithable-bench-m12-LE2aZR/app-10/smithable.auth.yml:4:16  warning  With shared access and no allowedDomains, anyone with an account at the sign-in provider can sign up and read all records.
    hint: Restrict sign-in with "allowedDomains" or "selfSignUp: false" under "signIn", or use "defaultAccess: private".
```

### 11. An internal status board for our IT systems, so staff see what is down and when it is back.

```text
IT Status Board
  Internal status board for IT systems showing what is down and when it will be back.

Pages
  - Home (a landing page: hero, components, incidents where status is investigating or identified or monitoring, incidents where status is resolved, maintenances and footer)
  - Incidents (lists incidents; only for staff users and admins)
  - Updates (lists incident updates; only for staff users and admins)
  - Components (lists components; only for admins)
  - Maintenance (lists maintenances; only for staff users and admins)
  - Team (who has access: invite people, change roles, remove users)
  - Overview (a dashboard: open, per month and latest)

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
  - a summary
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
  The cause is found; the incident moves to identified.
  Only staff users and admins can use it.

Monitoring
  A fix is out; the incident is watched before it is closed.
  Only staff users and admins can use it.

Resolve
  The incident is over.
  Only staff users and admins can use it.

Sign-in and access
  People sign in with Google.
  Everyone who signs in sees all records, and changes and deletes the ones they own.
  Roles:
  - admin (Runs the status board and the team)
  - staff (Writes incidents and their updates)
  New users get the staff role.
Pictures from the Smithable image library: samples/1.webp, samples/2.webp, samples/3.webp, samples/4.webp, samples/5.webp, samples/6.webp, hero.webp.
Generated 99 files (99 changed, 0 removed).
No config path provided, using default 'drizzle.config.ts'
Reading config file '/tmp/smithable-bench-m12-LE2aZR/app-11/drizzle.config.ts'
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

[✓] Your SQL migration file ➜ drizzle/0000_illegal_sharon_carter.sql 🚀

Created /tmp/smithable-bench-m12-LE2aZR/app-11. Start it with:

  cd /tmp/smithable-bench-m12-LE2aZR/app-11
  smithable run
```

### 12. Service status for our municipality's online services, for residents to check outages.

```text
Municipal Service Status
  Check the current status and outages of our municipality's online services.

Pages
  - Home (a landing page: hero, components, incidents where status is investigating or identified or monitoring, incidents where status is resolved, maintenances and footer)
  - Incidents (lists incidents; only for staff users and admins; visitors see incidents on the Home page)
  - Updates (lists incident updates; only for staff users and admins)
  - Components (lists components; only for admins; visitors see components on the Home page)
  - Maintenance (lists maintenances; only for staff users and admins; visitors see maintenances on the Home page)
  - Overview (lists incidents; only for staff users and admins; visitors see incidents on the Home page)
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
Generated 95 files (95 changed, 0 removed).
No config path provided, using default 'drizzle.config.ts'
Reading config file '/tmp/smithable-bench-m12-LE2aZR/app-12/drizzle.config.ts'
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

[✓] Your SQL migration file ➜ drizzle/0000_regular_invisible_woman.sql 🚀

Created /tmp/smithable-bench-m12-LE2aZR/app-12. Start it with:

  cd /tmp/smithable-bench-m12-LE2aZR/app-12
  smithable run
```

### 13. A log of my car's fuel, service visits and costs.

```text
Car Log
  A log of my car's fuel, service visits and costs.

Pages
  - Fuel (lists fuels)
  - Services (lists services)
  - Costs (lists costs)

Fuels
  Fuels have:
  - a date (required)
  - an odometer (a whole number, required)
  - liters (a number, required)
  - a price per liter (an amount, required)
  - a total cost (an amount)
  - notes

Services
  Services have:
  - a date (required)
  - an odometer (a whole number, required)
  - a type (required)
  - a description
  - a cost (an amount, required)
  - notes

Costs
  Costs have:
  - a date (required)
  - a category (required)
  - an amount (an amount, required)
  - a description
  - notes

Sign-in and access
  People sign in with Google.
  Everyone sees and changes only their own records.
  Roles:
  - admin
  - member
  New users get the member role.
Pictures from the Smithable image library: samples/1.webp, samples/2.webp, samples/3.webp, samples/4.webp, samples/5.webp, samples/6.webp.
Generated 79 files (79 changed, 0 removed).
No config path provided, using default 'drizzle.config.ts'
Reading config file '/tmp/smithable-bench-m12-LE2aZR/app-13/drizzle.config.ts'
7 tables
account 13 columns 1 indexes 1 fks
costs 9 columns 0 indexes 1 fks
fuels 10 columns 0 indexes 1 fks
services 10 columns 0 indexes 1 fks
session 8 columns 2 indexes 1 fks
user 8 columns 1 indexes 0 fks
verification 6 columns 1 indexes 0 fks

[✓] Your SQL migration file ➜ drizzle/0000_true_menace.sql 🚀

Created /tmp/smithable-bench-m12-LE2aZR/app-13. Start it with:

  cd /tmp/smithable-bench-m12-LE2aZR/app-13
  smithable run
```

### 14. The guest list and seating plan for our wedding, with who has answered and their meal choices.

```text
Wedding Guest List
  Manage wedding guests, RSVPs, and seating arrangements with meal choices.

Pages
  - Guests (lists guests; search by name, email or phone)

Guests
  Guests have:
  - a name (required)
  - an email
  - a phone
  - rsvp status (not responded, attending or not attending, not responded by default)
  - a meal choice (vegetarian, standard or gluten free, vegetarian by default)
  - a table number
  - notes

Sign-in and access
  People sign in with Google.
  Everyone who signs in sees all records, and changes and deletes the ones they own.
  Roles:
  - admin
  - member
  New users get the member role.
Pictures from the Smithable image library: samples/1.webp, samples/2.webp, samples/3.webp, samples/4.webp, samples/5.webp, samples/6.webp.
Generated 69 files (69 changed, 0 removed).
No config path provided, using default 'drizzle.config.ts'
Reading config file '/tmp/smithable-bench-m12-LE2aZR/app-14/drizzle.config.ts'
5 tables
account 13 columns 1 indexes 1 fks
guests 11 columns 0 indexes 1 fks
session 8 columns 2 indexes 1 fks
user 8 columns 1 indexes 0 fks
verification 6 columns 1 indexes 0 fks

[✓] Your SQL migration file ➜ drizzle/0000_marvelous_cable.sql 🚀

Created /tmp/smithable-bench-m12-LE2aZR/app-14. Start it with:

  cd /tmp/smithable-bench-m12-LE2aZR/app-14
  smithable run
/tmp/smithable-bench-m12-LE2aZR/app-14/smithable.auth.yml:4:16  warning  With shared access and no allowedDomains, anyone with an account at the sign-in provider can sign up and read all records.
    hint: Restrict sign-in with "allowedDomains" or "selfSignUp: false" under "signIn", or use "defaultAccess: private".
```

### 15. Bird sightings for our birdwatching club: species, place, date and who saw it.

```text
Birdwatching Club
  Track bird sightings for our birdwatching club.

Pages
  - Sightings (lists sightings; search by species or place)

Sightings
  Sightings have:
  - species (required)
  - a place (required)
  - a date (required)
  Each sighting can have an observer (a user).

Sign-in and access
  People sign in with Google.
  Everyone who signs in sees all records, and changes and deletes the ones they own.
  Roles:
  - admin
  - member
  New users get the member role.
Pictures from the Smithable image library: samples/1.webp, samples/2.webp, samples/3.webp, samples/4.webp, samples/5.webp, samples/6.webp.
Generated 70 files (70 changed, 0 removed).
No config path provided, using default 'drizzle.config.ts'
Reading config file '/tmp/smithable-bench-m12-LE2aZR/app-15/drizzle.config.ts'
5 tables
account 13 columns 1 indexes 1 fks
session 8 columns 2 indexes 1 fks
sightings 8 columns 0 indexes 2 fks
user 8 columns 1 indexes 0 fks
verification 6 columns 1 indexes 0 fks

[✓] Your SQL migration file ➜ drizzle/0000_lonely_joystick.sql 🚀

Created /tmp/smithable-bench-m12-LE2aZR/app-15. Start it with:

  cd /tmp/smithable-bench-m12-LE2aZR/app-15
  smithable run
/tmp/smithable-bench-m12-LE2aZR/app-15/smithable.auth.yml:4:16  warning  With shared access and no allowedDomains, anyone with an account at the sign-in provider can sign up and read all records.
    hint: Restrict sign-in with "allowedDomains" or "selfSignUp: false" under "signIn", or use "defaultAccess: private".
```

### 16. Our allotment society: who has which plot, the waiting list and the yearly fee.

```text
Allotment Society
  Manage plots, waiting list and yearly fees for an allotment society.

Pages
  - Plots (lists plots; search by number or notes; filter by status)
  - Members (lists members; search by name, email, phone or address; filter by status)
  - Assignments (lists assignments; filter by plot, member or status; only for admins)
  - Fees (lists fees; filter by year or status; only for admins)
  - Team (who has access: invite people, change roles, remove users)
  - Admin (every kind of record, to find, open, change and delete)
  - Waiting list (lists waiting lists; filter by plot or member; only for admins)
  - Payments (lists payments; filter by member, fee, method or paid on; only for admins)

Plots
  Plots have:
  - a number (required, unique)
  - a size (a whole number)
  - status (free, assigned or reserved, free by default)
  - notes
  Only admins can delete plots.
  Only admins can change plots.

Members
  Members have:
  - a name (required)
  - an email (required, unique)
  - a phone
  - address
  - joined on (a date)
  - status (active or inactive, active by default)
  Only admins can delete members.
  Only admins can change members.

Assignments
  Assignments have:
  - a plot (a plot, required)
  - a member (a member, required)
  - a start date (required)
  - an end date
  - status (active or ended, active by default)
  Only admins can delete assignments.
  Only admins can change assignments.
  At most 1 assignments per plot.

Fees
  Fees have:
  - a year (a whole number, required, unique)
  - an amount (an amount, required)
  - a due date (required)
  - status (open, paid or overdue, open by default)
  Only admins can delete fees.
  Only admins can change fees.

Waiting lists
  Waiting lists have:
  - a member (a member, required)
  - a plot (a plot)
  - requested on (a date, required)
  - notes
  Only admins can delete waiting lists.
  Only admins can change waiting lists.

Payments
  Payments have:
  - a member (a member, required)
  - a fee (a fee, required)
  - an amount (an amount, required)
  - paid on (a date, required)
  - a method (cash, bank or online, cash by default)
  Only admins can delete payments.
  Only admins can change payments.

Sign-in and access
  People sign in with Google.
  Everyone who signs in sees all records, and changes and deletes the ones they own.
  Roles:
  - admin (Society administrator. Manages plots, members, and fees)
  - member (Allotment member. Can view their own assignments and payments)
  New users get the member role.
Pictures from the Smithable image library: samples/1.webp, samples/2.webp, samples/3.webp, samples/4.webp, samples/5.webp, samples/6.webp.
Generated 120 files (120 changed, 0 removed).
No config path provided, using default 'drizzle.config.ts'
Reading config file '/tmp/smithable-bench-m12-LE2aZR/app-16/drizzle.config.ts'
11 tables
account 13 columns 1 indexes 1 fks
assignments 9 columns 0 indexes 3 fks
fees 8 columns 1 indexes 1 fks
invitation 7 columns 2 indexes 1 fks
members 10 columns 1 indexes 1 fks
payments 9 columns 0 indexes 3 fks
plots 8 columns 1 indexes 1 fks
session 8 columns 2 indexes 1 fks
user 8 columns 1 indexes 0 fks
verification 6 columns 1 indexes 0 fks
waiting_lists 8 columns 0 indexes 3 fks

[✓] Your SQL migration file ➜ drizzle/0000_colossal_rhino.sql 🚀

Created /tmp/smithable-bench-m12-LE2aZR/app-16. Start it with:

  cd /tmp/smithable-bench-m12-LE2aZR/app-16
  smithable run
/tmp/smithable-bench-m12-LE2aZR/app-16/smithable.yml:37:7  warning  Assignment has a capacity per plot, but "plot" is not unique: one person can take several places.
    hint: Write "plot: Plot! unique" for one assignment per person and plot (unique per owner with private access).
/tmp/smithable-bench-m12-LE2aZR/app-16/smithable.auth.yml:4:16  warning  With shared access and no allowedDomains, anyone with an account at the sign-in provider can sign up and read all records.
    hint: Restrict sign-in with "allowedDomains" or "selfSignUp: false" under "signIn", or use "defaultAccess: private".
```

### 17. Bokning för min frisörsalong, kunderna ska kunna boka tid själva på nätet.

```text
Frisörsalong Bokning
  Ett system för kunder att boka tid hos frisören på nätet.

Pages
  - Boka tid hos oss (a landing page: hero, services, contact and footer)
  - Appointments (lists appointments; search by namn, e-post or tjänst; only for admins)
  - Services (lists services; only for admins; visitors see services on the Boka tid hos oss page)

Appointments
  Appointments have:
  - a namn (required)
  - an e-post (an email address, required)
  - a telefon (a phone number)
  - a tjänst (required)
  - a datum (a date, required)
  - a tid (required)
  - status (booked, confirmed, cancelled or completed, booked by default)
  - notes

Services
  Services have:
  - a namn (required)
  - a beskrivning
  - a varaktighet (minuter) (a whole number, required)
  - pris (an amount, required)

Sign-in and access
  People sign in with Google.
  Everyone sees and changes only their own records.
  Roles:
  - admin (Administratör som hanterar bokningar och tjänster)
  New users get the admin role.
  Open to anyone without signing in: the home page, reading services and adding appointments.
Pictures from the Smithable image library: samples/1.webp, samples/2.webp, samples/3.webp, samples/4.webp, samples/5.webp, samples/6.webp, hero.webp.
Generated 76 files (76 changed, 0 removed).
No config path provided, using default 'drizzle.config.ts'
Reading config file '/tmp/smithable-bench-m12-LE2aZR/app-17/drizzle.config.ts'
6 tables
account 13 columns 1 indexes 1 fks
appointments 12 columns 0 indexes 1 fks
services 8 columns 0 indexes 1 fks
session 8 columns 2 indexes 1 fks
user 8 columns 1 indexes 0 fks
verification 6 columns 1 indexes 0 fks

[✓] Your SQL migration file ➜ drizzle/0000_safe_killmonger.sql 🚀

Created /tmp/smithable-bench-m12-LE2aZR/app-17. Start it with:

  cd /tmp/smithable-bench-m12-LE2aZR/app-17
  smithable run
```

### 18. Vi är en liten byggfirma och behöver hålla koll på offerter, kunder och fakturor.

```text
Byggfirma
  Håller koll på offerter, kunder och fakturor för en liten byggfirma.

Pages
  - Customers (lists customers; search by name, email or phone)
  - Invoices (lists invoices; search by title or customer; filter by status or customer; sort by invoice date, due date or amount)
  - Quotes (lists quotes; search by title, description or customer; filter by status or customer; sort by date added, amount or valid until)

Customers
  Customers have:
  - a name (required)
  - an email
  - a phone
  - address
  Only admins can delete customers.

Invoices
  Invoices have:
  - a customer (a customer, required)
  - a title (required)
  - an amount (an amount, required)
  - status (draft, sent or paid, draft by default)
  - a due date
  - an invoice date (required, today by default)
  - a quote (a quote)
  Only admins can delete invoices.

Quotes
  Quotes have:
  - a customer (a customer, required)
  - a title (required)
  - a description
  - an amount (an amount, required)
  - status (draft, sent, accepted or rejected, draft by default)
  - a valid until (a date)
  Only admins can delete quotes.

Sign-in and access
  People sign in with Google.
  Everyone who signs in sees all records, and changes and deletes the ones they own.
  Roles:
  - admin (Administratör med full tillgång)
  - accountant (Hanerar fakturor och offerter)
  - worker (Arbetare som ser sina uppgifter)
  New users get the worker role.
Pictures from the Smithable image library: samples/1.webp, samples/2.webp, samples/3.webp, samples/4.webp, samples/5.webp, samples/6.webp.
Generated 82 files (82 changed, 0 removed).
No config path provided, using default 'drizzle.config.ts'
Reading config file '/tmp/smithable-bench-m12-LE2aZR/app-18/drizzle.config.ts'
7 tables
account 13 columns 1 indexes 1 fks
customers 8 columns 0 indexes 1 fks
invoices 11 columns 0 indexes 3 fks
quotes 10 columns 0 indexes 2 fks
session 8 columns 2 indexes 1 fks
user 8 columns 1 indexes 0 fks
verification 6 columns 1 indexes 0 fks

[✓] Your SQL migration file ➜ drizzle/0000_petite_nicolaos.sql 🚀

Created /tmp/smithable-bench-m12-LE2aZR/app-18. Start it with:

  cd /tmp/smithable-bench-m12-LE2aZR/app-18
  smithable run
/tmp/smithable-bench-m12-LE2aZR/app-18/smithable.auth.yml:4:16  warning  With shared access and no allowedDomains, anyone with an account at the sign-in provider can sign up and read all records.
    hint: Restrict sign-in with "allowedDomains" or "selfSignUp: false" under "signIn", or use "defaultAccess: private".
```

### 19. En sida för vår loppis där folk kan lägga upp saker de vill sälja, med bilder och pris.

```text
Vår Loppis
  En sida för att lägga upp saker att sälja med bilder och pris.

Pages
  - Home (a landing page: hero, items where status is available and footer)
  - Items (lists items; search by name or description; filter by status; sort by name, price or date added)

Items
  Items have:
  - a name (required)
  - a description
  - a price (an amount, required)
  - an image (a web address)
  - status (available or sold, available by default)

Sign-in and access
  People sign in with Google.
  Everyone sees and changes only their own records.
  Roles:
  - admin
  - member
  New users get the member role.
  Open to anyone without signing in: the home page, the items page and reading items.
Pictures from the Smithable image library: samples/1.webp, samples/2.webp, samples/3.webp, samples/4.webp, samples/5.webp, samples/6.webp, hero.webp.
Generated 73 files (73 changed, 0 removed).
No config path provided, using default 'drizzle.config.ts'
Reading config file '/tmp/smithable-bench-m12-LE2aZR/app-19/drizzle.config.ts'
5 tables
account 13 columns 1 indexes 1 fks
items 9 columns 0 indexes 1 fks
session 8 columns 2 indexes 1 fks
user 8 columns 1 indexes 0 fks
verification 6 columns 1 indexes 0 fks

[✓] Your SQL migration file ➜ drizzle/0000_silky_vivisector.sql 🚀

Created /tmp/smithable-bench-m12-LE2aZR/app-19. Start it with:

  cd /tmp/smithable-bench-m12-LE2aZR/app-19
  smithable run
```

### 20. Varausjärjestelmä joogastudiollemme: tunnit, ohjaajat ja varaukset verkossa.

```text
Joogastudio
  Varausjärjestelmä joogastudiolle tunnit, ohjaajat ja varaukset verkossa.

Pages
  - Home (a landing page: hero, classes, teachers and footer)
  - Classes (lists classes; search by name, schedule or level; filter by level)
  - Teachers (lists teachers; only for teacher users and admins)
  - Bookings (lists bookings; only for teacher users, member users and admins)

Classes
  Classes have:
  - a name (required)
  - a description
  - a duration (a whole number, required, 60 by default)
  - a level (beginner, intermediate or advanced, beginner by default)
  - max participants (a whole number, required, 15 by default)
  - a price (an amount, required)
  - a schedule (required)
  - a teacher (a teacher, required)
  Only admins can delete classes.

Teachers
  Teachers have:
  - a name (required)
  - an email (required, unique)
  - a phone
  - a bio
  Only admins can delete teachers.

Bookings
  Bookings have:
  - class (a class, required)
  - status (booked, confirmed or cancelled, booked by default)
  - notes
  Each booking can have a user (a user).
  Only the owner and admins can delete bookings.

Sign-in and access
  People sign in with Google.
  Everyone who signs in sees all records, and changes and deletes the ones they own.
  Roles:
  - admin (Hallinnoi studioa ja varauksia)
  - teacher (Ohjaa tunteja ja näkee omat varaukset)
  - member (Varaa tunteja)
  New users get the member role.
  Open to anyone without signing in: the home page and reading classes.
Pictures from the Smithable image library: samples/1.webp, samples/2.webp, samples/3.webp, samples/4.webp, samples/5.webp, samples/6.webp, hero.webp.
Generated 84 files (84 changed, 0 removed).
No config path provided, using default 'drizzle.config.ts'
Reading config file '/tmp/smithable-bench-m12-LE2aZR/app-20/drizzle.config.ts'
7 tables
account 13 columns 1 indexes 1 fks
bookings 8 columns 0 indexes 3 fks
classes 12 columns 0 indexes 2 fks
session 8 columns 2 indexes 1 fks
teachers 8 columns 1 indexes 1 fks
user 8 columns 1 indexes 0 fks
verification 6 columns 1 indexes 0 fks

[✓] Your SQL migration file ➜ drizzle/0000_abandoned_sister_grimm.sql 🚀

Created /tmp/smithable-bench-m12-LE2aZR/app-20. Start it with:

  cd /tmp/smithable-bench-m12-LE2aZR/app-20
  smithable run
/tmp/smithable-bench-m12-LE2aZR/app-20/smithable.auth.yml:4:16  warning  With shared access and no allowedDomains, anyone with an account at the sign-in provider can sign up and read all records.
    hint: Restrict sign-in with "allowedDomains" or "selfSignUp: false" under "signIn", or use "defaultAccess: private".
```

### 21. Pieni autokorjaamo: asiakkaat, autot, huoltotyöt ja laskut yhdessä paikassa.

```text
Pieni Autokorjaamo
  Asiakkaat, autot, huoltotyöt ja laskut yhdessä paikassa.

Pages
  - Customers (lists customers; search by name, email or phone)
  - Cars (lists cars; search by license plate, make or model)
  - Services (lists services)
  - Work orders (lists work orders; filter by status, start date, end date or car; only for mechanic users and admins)
  - Invoices (lists invoices; filter by status, issue date or due date; only for accountant users and admins)

Customers
  Customers have:
  - a name (required)
  - an email
  - a phone
  - address

Cars
  Cars have:
  - a license plate (required, unique)
  - a make (required)
  - a model (required)
  - a year (a whole number)
  - a customer (a customer, required)

Services
  Services have:
  - a name (required)
  - a description
  - a price (an amount)
  - a duration (a whole number, 60 by default)

Work items
  Work items have:
  - a service (a service, required)
  - notes
  - a quantity (a whole number, required, 1 by default)
  - a work order (a work order, required)

Work orders
  Work orders have:
  - a car (a car, required)
  - a description
  - status (pending, in progress, completed or cancelled, pending by default)
  - a start date
  - an end date
  - a total cost (an amount, 0 by default)
  Each work order lists its work items.
  Only mechanic users and admins can delete work orders.
  Only mechanic users and admins can change work orders.

Invoices
  Invoices have:
  - a work order (a work order, required)
  - an invoice number (required, unique)
  - an issue date (required, today by default)
  - a due date
  - status (draft, sent, paid or overdue, draft by default)
  - a total amount (an amount, required)
  Only accountant users and admins can delete invoices.
  Only accountant users and admins can change invoices.

Sign-in and access
  People sign in with Google.
  Everyone who signs in sees all records, and changes and deletes the ones they own.
  Roles:
  - admin
  - mechanic (Suorittaa huoltotöitä)
  - accountant (Hoitaa laskutusta)
  New users get the mechanic role.
Pictures from the Smithable image library: samples/1.webp, samples/2.webp, samples/3.webp, samples/4.webp, samples/5.webp, samples/6.webp.
Generated 94 files (94 changed, 0 removed).
No config path provided, using default 'drizzle.config.ts'
Reading config file '/tmp/smithable-bench-m12-LE2aZR/app-21/drizzle.config.ts'
10 tables
account 13 columns 1 indexes 1 fks
cars 9 columns 1 indexes 2 fks
customers 8 columns 0 indexes 1 fks
invoices 10 columns 1 indexes 2 fks
services 8 columns 0 indexes 1 fks
session 8 columns 2 indexes 1 fks
user 8 columns 1 indexes 0 fks
verification 6 columns 1 indexes 0 fks
work_items 8 columns 0 indexes 3 fks
work_orders 10 columns 0 indexes 2 fks

[✓] Your SQL migration file ➜ drizzle/0000_gorgeous_forge.sql 🚀

Created /tmp/smithable-bench-m12-LE2aZR/app-21. Start it with:

  cd /tmp/smithable-bench-m12-LE2aZR/app-21
  smithable run
/tmp/smithable-bench-m12-LE2aZR/app-21/smithable.auth.yml:4:16  warning  With shared access and no allowedDomains, anyone with an account at the sign-in provider can sign up and read all records.
    hint: Restrict sign-in with "allowedDomains" or "selfSignUp: false" under "signIn", or use "defaultAccess: private".
```

### 22. Für meinen kleinen Hofladen: Produkte, Vorbestellungen der Kunden und Abholzeiten.

```text
Hofladen
  Verwaltung von Produkten, Vorbestellungen und Abholzeiten für einen kleinen Hofladen.

Pages
  - Products (lists products; search by name, description or category)
  - Pre orders (lists pre orders; search by customer name, customer email or customer phone; filter by status or product)
  - Pickup times (lists pickup times; filter by date)

Products
  Products have:
  - a name (required)
  - a description
  - a price (an amount, required)
  - a category
  - an available (yes or no, true by default)
  - a stock (a whole number, 0 by default)
  Only admins can delete products.

Pre orders
  Pre orders have:
  - a customer name (required)
  - a customer email
  - a customer phone
  - a product (a product, required)
  - a quantity (a whole number, required, 1 by default)
  - an order date (required, today by default)
  - status (pending, confirmed, cancelled or completed, pending by default)

Pickup times
  Pickup times have:
  - a date (required)
  - a start time (required)
  - an end time (required)
  - max slots (a whole number, required, 10 by default)
  - notes
  Only admins can delete pickup times.
  Only admins can change pickup times.

Sign-in and access
  People sign in with Google.
  Everyone who signs in sees all records, and changes and deletes the ones they own.
  Roles:
  - admin (Verwaltet den Hofladen)
  - employee (Bearbeitet Bestellungen und Abholzeiten)
  New users get the employee role.
Pictures from the Smithable image library: samples/1.webp, samples/2.webp, samples/3.webp, samples/4.webp, samples/5.webp, samples/6.webp.
Generated 82 files (82 changed, 0 removed).
No config path provided, using default 'drizzle.config.ts'
Reading config file '/tmp/smithable-bench-m12-LE2aZR/app-22/drizzle.config.ts'
7 tables
account 13 columns 1 indexes 1 fks
pickup_times 9 columns 0 indexes 1 fks
pre_orders 11 columns 0 indexes 2 fks
products 10 columns 0 indexes 1 fks
session 8 columns 2 indexes 1 fks
user 8 columns 1 indexes 0 fks
verification 6 columns 1 indexes 0 fks

[✓] Your SQL migration file ➜ drizzle/0000_sticky_eddie_brock.sql 🚀

Created /tmp/smithable-bench-m12-LE2aZR/app-22. Start it with:

  cd /tmp/smithable-bench-m12-LE2aZR/app-22
  smithable run
/tmp/smithable-bench-m12-LE2aZR/app-22/smithable.auth.yml:4:16  warning  With shared access and no allowedDomains, anyone with an account at the sign-in provider can sign up and read all records.
    hint: Restrict sign-in with "allowedDomains" or "selfSignUp: false" under "signIn", or use "defaultAccess: private".
```
