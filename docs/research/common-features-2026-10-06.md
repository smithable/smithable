# What business web apps and sites usually have, and what Smithable is missing

Research note, 2026-10-06 (Fable), asked by Johan: "the most common features of web apps and sites in general, especially for businesses, and see what we are missing". Sources: the usual checklists for small-business sites and internal tools ([Upwork](https://www.upwork.com/resources/must-have-website-features/), [Hapy's internal app checklist](https://hapy.co/journal/internal-app-feature-checklist/), [Jet Admin on internal tool builders](https://www.jetadmin.io/blog/best-internal-tool-builder-platforms-in-2026-how-to-choose-the-right-one/amp/), [B12's 2026 checklist](https://www.b12.io/resource-center/website-design/checklist-what-makes-a-website-good-in-2026.html)), read against the spec reference and the kit as they are today.

## 1. Public sites (a business's own site)

| Usually there | Smithable today | Gap |
|---|---|---|
| Responsive pages, fast, HTTPS | Yes: every page, pre-bundled, the service terminates TLS | none |
| Home page with hero, call to action, features, pricing, testimonials, FAQ, gallery, contact, footer | Yes: the landing sections | none |
| Contact form that mails the owner | Yes: `contact: { form: Message }` and the contact section | none |
| Address, phone, opening hours, map | Address, phone, hours and a "Show on map" link; no embedded map | small: a map picture or embed is a section look |
| Blog or news | Yes: articles pages, Markdown, pictures, public `where: { status: published }` | none |
| Booking and appointments | Yes: calendar page, capacity, Book and Cancel | recurring sessions are not there (a weekly class is many records) |
| Search engine basics: titles, descriptions, Open Graph, sitemap, robots | Titles and robots.txt are there; Open Graph is in the generator; no `sitemap.xml`, no per-page description from the content file | **sitemap.xml** from the public pages, and a `description` text per page |
| Analytics | Nothing | a setting for one script (Plausible or Umami, both EU and cookie-free) in the context file; GA needs consent, so leave it to custom code |
| Cookie consent | Not needed: the app sets one session cookie, which is strictly necessary | none, and a line in the FAQ saying why |
| Privacy policy and terms pages | None generated; the hosted service has its own | a `legal` landing section or page with the operator's name, what is stored and why, written from the spec (it knows the fields with personal data) |
| Reviews and ratings | A `rating` field type is in the spec; no "write a review" flow | medium: reviews are a model with a public create and a moderation status; a starter could show it |
| Newsletter sign-up | No; the spec reference uses `newsletter` as the example of a taught plugin | medium: a `Subscriber` model with public create and a send-out; the send-out is the part that is not there (see §3) |
| Social links in the footer | Not as a construct | small: footer texts can hold links already; an icon row is a look |
| Several languages | One language, English words (docs/design/language.md) | in work |
| Video | Only as a link in Markdown | small: a video section (a hosted video's address, shown in a frame) |

## 2. Apps people sign in to (internal tools and member sites)

| Usually there | Smithable today | Gap |
|---|---|---|
| Sign-in, invitations, roles, who may do what | Yes: email codes, Google, invitations, roles, access per model and page, owners | SSO (SAML, Microsoft) is not there; fine before the launch, asked for by larger customers later |
| Records: list, search, filter, sort, create, edit, delete | Yes | paging is in work (docs/design/paging.md) |
| Bulk actions on selected records | Yes: selection, standard actions, delete | bulk edit of one field (set status on five orders) is not there; the selection bar could take any standard action with a value |
| Export | The API answers JSON; the CLI exports the whole app | **CSV export of a list** as the person sees it (the filters applied), the twin of the import that exists |
| Import | Yes: CSV import with a dry run | none |
| Dashboards and reports | Yes: counts, sums, charts by month, lists | a printable or PDF report is not there; the browser's print of a page is the answer for now, with print styles |
| Notifications | Mails from hooks and custom code; nothing built in | **mail on an event**: "when an order is placed, mail the sales team" as a construct (`notify` on an action or a model), the most asked-for thing in internal tools after search |
| Audit log | Yes: the activity log, who did what, per record and for the app | none |
| Comments and notes on a record | No | medium: a `Note` model with a reference is the maker's today; a `comments: true` on a crud page would give the thread and the mail |
| Files on a record (a PDF, a contract) | Pictures only | **attachments**: a `file` field like `picture` but any type, with a size limit and virus-free by being never executed; stored and served like pictures |
| Record history, undo of one change | The audit log holds the facts; no "restore this record as it was" | later: `audit: values` is in the logging design |
| Soft delete, a trash | No; a delete is a delete, with the app's undo of a change only in Studio | medium: `trash: true` on a model keeps deleted records for thirty days with a restore |
| Approvals and workflows | Actions with `when` and `set` cover status flows; no approver step | later: an action a second role must confirm |
| Recurring and scheduled things | `daily` hooks in custom code; no recurring records | medium for booking; a weekly schedule generated from a rule |
| Settings page for the app's own data | Yes: settings pages and onboarding | none |
| User profile: name, picture, password | A name and a role; no profile page, no picture of a person | small: a profile page from the user model with a picture field |
| Two-factor sign-in | No | codes by mail are the second factor for Google users; for email-only sign-in it is the only factor. Passkeys later |
| Keyboard, screen readers | Yes: labels, focus, the tests check | none |
| API and assistants | Yes: REST with OpenAPI, MCP tools, keys | webhooks are not there (see the integration list) |

## 3. What I would build, in order

1. **Mail on an event** (`notify`): small spec addition, one operation, the mail kit exists. It makes a CRM or a booking app useful to a team at once.
2. **CSV export of a list** as filtered: a button on list pages and `GET /api/v1/<model>.csv`; no spec change.
3. **Attachments**: the `file` field type beside `picture`; the pictures code is the mould.
4. **sitemap.xml and a page description**: half a day, and what every site checker asks about first.
5. **A legal page from the spec**: the operator's name from the context file, the stored personal data from the validator's own list; the hosted service already knows the operator.
6. **Reviews** as a starter construct, after the website starter.
7. **Trash with restore**, **comments on a record**, **a send-out to subscribers**, **recurring sessions**: each a design note first, none before the launch.

Not worth building: cookie banners (no third-party cookies), SSO before a customer asks, a report designer (print styles and the API do it), an embedded map (a link and a picture do it, and Google's embed needs consent).
