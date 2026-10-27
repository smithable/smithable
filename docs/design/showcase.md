# Showcase: live example sites, demo sign-in, and the sixty-second CLI example (design)

Status: proposed 2026-10-02 by Fable, from Johan's direction: without good-looking live examples the public release gets no traction with non-developers, and developers want to see a site set up from the command line in a minute. Merging this document is the go-ahead; the service parts are Opus's, the engine part is small.

## 1. What people get

- **"See it live"** on docs.smithable.ai and in the README: six example sites running permanently, each a published app on the hosted service, with real texts and photographs. A visitor opens one, signs in as an admin or a member with one click, adds and changes things, and sees the data come back to its seed within the hour.
- **"Open in Studio"** beside each: the sandbox the demo already offers, started from that example's spec, so the next step from looking is changing.
- **For developers:** a sixty-second transcript on the getting-started page: a site made, changed and deployed from the command line, with what each command did.

## 2. The six sites

| Site | What it shows | Starter |
|---|---|---|
| Stillwater Yoga | a company site with a landing page, schedule, bookings and a blog | booking |
| a company site like el.ax (news, services, a guide, contact) | the records and articles patterns as a plain company site, no sign-in for visitors | a new starter, `company` |
| Torget | the marketplace (marketplace.md): catalogue, filters, favourites, contact the seller | marketplace |
| a CRM | an internal tool: records, relations, a status flow, a dashboard, roles | crm |
| Invoicely | per-user data, formulas, a settings page | invoicing |
| a status page | components with a status, incidents with a flow and a timeline, planned maintenance; the public page from records sections (ROADMAP M16) | status, a new starter |

The texts are written by hand for each (not "A short description of Hatha 2"); the photographs come from the image library (Johan's decision on scope and budget). The sites are the starters' specs, so every improvement to a starter shows on its site at the next release, and every site is also what `smithable new --starter` gives. Decided 2026-10-02: there are never separate example specs; the starters are the showcase, the design effort goes into their sample records (`samples/<Model>.yml`, two real sentences each) and pictures, and `smithable new --no-sample-data` gives a starter empty.

## 3. Demo sign-in in production

- Today the role buttons on the sign-in page exist only in development builds. A production build with `DEMO_SIGN_IN=1` in its environment shows them too, with fixed demo users (one per role, `demo-<role>@<app's domain>`), and a banner on every page: "This is a demo. Sign in as anyone; the data resets every hour." The dev-only email-and-password sign-in stays off; the buttons sign in through the same server function the development build uses, gated by the variable instead of the build mode.
- No name starts with `SMITHABLE_` (a detached app forbids it). The variable is set by the service for showcase apps only; an owner cannot set it on their own published app. Self-hosted apps may set it themselves: it is a flag, not a secret, and the banner says what it does.
- Mail from a showcase app goes to the outbox, never out (`MAIL_MODE=outbox`, which the kit already has for development), so "contact the seller" shows "sent" and nobody is mailed.

## 4. Reset

- Each showcase app is an ordinary published app owned by a Smithable account. The service keeps its **seed**: the data volume right after publishing with the sample data (the backup script's consistent copy, taken once and kept beside the backups as `seed.tar.gz`).
- Every hour, and when the app's data has grown past a limit (records or uploads), the service restores the seed with the restore path it already has (stop, replace the data, start; a few seconds), so nothing a visitor added survives the hour. The existing per-address write limits apply; a showcase app's uploads are capped at a few megabytes each and a few hundred in all.
- With `DEMO_VISITORS=1` beside `DEMO_SIGN_IN=1` (2026-10-26), each visitor also works on a copy of the data of their own: a cookie names the visitor, and their first request copies the app's database (as the seed and the hourly reset leave it) into `data/visitors/<id>/`, with their uploads and outbox beside it. What one visitor adds, no other sees, and the app's own data stays as the seed made it. A copy idle an hour is deleted, at most 500 are kept (`DEMO_VISITORS_KEPT`; a new one replaces the visitor seen longest ago), every copy goes when the app starts, and new visitors are limited per address. What runs without a visitor (timers, the outbox worker) acts on the app's own, shared demo database, which the hourly reset puts back.
- Showcase apps are excluded from the weekly security republish's owner mails (the owner is the service) but not from the republish itself, and from the usage sampling and the monthly copies (nothing to keep).

## 5. Where

- Published like any app, at `demo-<name>.smithable.app` (the apps domain, never same-site with the service), with a `DEMO_SIGN_IN` build. The docs site's home page and the README link the five with one screenshot each (the visual check's screenshots, taken at each release); the service's landing page links them too.
- "Open in Studio" is the existing demo sandbox with the starter chosen; no new service route.

## 6. The sixty-second CLI example

On the getting-started page, after "A first app", a transcript with what each line did:

```sh
smithable new torget --starter marketplace        # a marketplace with sample items
cd torget
smithable op addField Item condition "new | used"  # a choice field: form, list, filter, migration
smithable op setTheme preset corporate             # another look, nothing else changes
smithable ask "let visitors sort by price"         # in your own words; confirmed before it applies
smithable deploy --target docker                   # release checks, then the container on :3000
```

Each line's output is shown shortened (what was generated, what was migrated, the checkpoint), so a developer sees the shape of the tool before installing it.

## 7. Steps

1. **Engine (Fable, small):** the `DEMO_SIGN_IN` gate on the sign-in page and the server function, the banner in the site frame and app shell, `MAIL_MODE=outbox` honoured in production builds; a test that a production build without the variable has no demo sign-in.
2. **Service (Opus):** the showcase account and apps, the seed taken after publishing, the hourly and on-growth reset, the environment for showcase apps, the limits, the exclusions, the links on the landing page.
3. **Content (Opus, with Johan):** the five specs' texts and the `company` starter (records: news, services, a guide; pages: home with a cover hero and shortcuts, news as articles, services as records, a contact section), the photographs from the image library, the screenshots at release.
4. **Docs (Fable):** the "See it live" block on the docs home and the README, the CLI transcript on the getting-started page, once the sites are up.

## 8. Out of scope

A multi-tenant "try with your own data" (that is the sandbox), analytics on the showcase sites, and sites for patterns that do not exist yet (payments, integrations).
