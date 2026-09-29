# The data page: an admin view of every model (design and plan)

Status: 2026-09-29, proposed by Fable; to be built by Opus after PR #11 (invitations) is merged, because it uses the pattern-level default access (`PagePattern.access`) that #11 adds. Fable reviews.

## 1. Why

Real data lives only in the published app; the preview in Studio has sample data, and the two never mix (real customer data must not flow into the builder). Today an app's owner can see and correct data only through crud pages, and models without a page (a contact form's messages, an audit model, lookup tables) have no view at all. Every multi-user app needs an administrator's view of its data, the way Django has its admin. It passes ARCHITECTURE §2.4: common, deterministic, removes AI and custom code, technology-neutral, and it must go through the generated access layer rather than around it.

## 2. The spec

```yaml
pages:
  admin:                   # the page's name gives the route, /admin; "route" changes it
    data: all              # every model; or a list, e.g. data: [Customer, Order, Message]
    # access: [admin]      # the default for a data page; widen it with more roles
```

- `data` is a page pattern (next to crud, landing, dashboard, settings, onboarding, users). Its value is `all` or a list of models. An app may have more than one data page (a support view with fewer models), though one is the usual case.
- Admin-only by default through the pattern's default access, like the users page. In the main menu (the shell hides it from those who cannot open it), icon `layers`.
- `User` is not a model and is not listed; the users page covers people.

## 3. What the generated app gets

For a data page `admin` at `/admin`:

| Route | Shows |
|---|---|
| `/admin` | One row per model: its plural label, its record count, a link. Counts come from each model's data function, so they follow access. |
| `/admin/<models>` (kebab plural, e.g. `/admin/order-lines`) | The model's list: search over its text, email, phone, URL and choice fields; newest first; the first 500 records with a note when there are more |
| `/admin/<models>/new`, `/admin/<models>/$id` | Create, view, edit and delete, as on a crud page |

Everything reads and writes through `src/generated/<model>.server.ts`, so model access, owners, validation, hooks (`afterChange`, `afterDelete`) and refusals behave exactly as elsewhere. Widening the page's `access` never widens what a role may do with records: a `support` role on the page still sees only what the models' access gives it.

## 4. How to build it (plan for Opus)

Follow the users pattern in #11 file by file; it is the template for "one pattern object in core, one generator in the adapter".

1. **Core, `ir.ts` and `patterns.ts`.** Add `{ kind: "data"; models: string[] }` (resolved: `all` becomes every model's name in spec order, so the adapter never sees `all`; keep `all` in the YAML). The pattern object: schema (`"all"` or an array of strings), `example: "data: all"`, parse (each name is `ctx.reference("model", …)`), `models: (p) => p.models`, `icon: "layers"`, `inMenu: true`, `access: ["admin"]`, `operations: dataOperations`, and `follow`: a renamed model is renamed in the list, a removed one leaves it (an emptied list refuses the removal with a message naming the page). With `all` in the YAML nothing needs to follow. Watch that `manages` stays undefined, so `actions` and `search` stay crud-only.
2. **Core operations** in `page-operations.ts`: `addDataPage [page=admin] [route] [models…]` (no models means `all`; refuses without sign-in, since the page is for admins) and nothing else for now; `removePage` already works. Tier 0 in `phrases.ts`: "add an admin page", "add a page to manage all data", "add a data page for orders and customers". Index words in `summary.ts` and `project-index.ts` (the typed tables will not compile until you do).
3. **Auth companion check.** A data page needs sign-in (error `no-sign-in`, as for the users page).
4. **Adapter, the one real design point: reuse the crud generators, do not copy them.** `listRoute`, `newRoute` and `detailRoute` take a `PageIR` and use `page.id` for three things: the access guard (`pageAccess[page.id]`), the title and subtitle texts, and the preview's text markers. For the data page, call them with a synthetic crud page `{ id: <data page id>, route: "/admin/<models>", pattern: { kind: "crud", model } }` so the guard is the data page's rule, and add one optional parameter (e.g. `heading?: { title: string; subtitle?: string; editable: false }`) so the title is the model's plural label and no text marker points at the data page's title. Add `search` to the synthetic page from the model's searchable fields (the same list `checkSearch` allows). Links from a record to related records should stay inside the data page (`/admin/customers/$id`), not jump to the crud page: pass the base route through the same parameter rather than looking up `ir.pages`. The index route is a small new generator in `pages/data.ts`; register it in `PAGE_GENERATORS.data` with no kit file of its own (it uses `ModelTable`/`Card`).
5. **Newest first and the cap.** `list(viewer, where?)` in `data.ts` returns everything in insertion order. Add an optional third argument `{ limit?: number; newest?: boolean }` used only by data pages (order by `id` descending, `limit 501` to know whether there are more). Crud pages keep their behaviour; byte-identity for apps without a data page must hold.
6. **Tests.** Core: parsing (`all`, a list, an unknown model with did-you-mean), the default access, `addDataPage`, the rename follow and the refused removal, the phrases. Adapter: a `data.test.ts` like `users.test.ts` (the files per model under the route, guards use the data page's rule, titles are the models' labels, no text markers for the data page, the index lists every model), and the snapshot for the example. Example: add `admin: { data: all }` to the **booking** example, whose contact messages have no page today, so the visual checks and smoke tests cover it; in `scripts/test-apps.mjs` add one browser step: an admin opens `/admin`, opens Messages, opens a message and deletes it; a member is refused `/admin`.
7. **Docs.** `docs/spec/v0.1.md` (a "Data" subsection under pages, the pattern in the list and the table), ARCHITECTURE §3.1 (one line: the data page goes through the access layer) and §10.4's list of patterns, ROADMAP M15.5 progress, `pnpm schema`.

Commit only with `pnpm check` green, on a branch, as a PR.

## 5. Out of scope, noted for later

- Pagination for all lists (crud and data pages) instead of the cap: one change in the data functions and `ModelTable`, when a tester has more than a few hundred records.
- CSV export of a model (data ownership; small once the data page exists).
- A data view in Studio for the preview's sample data (browse, edit, reset to the samples); local developers have `pnpm db:studio`.
- Bulk edits, raw queries, and anything that bypasses the access layer: never.
