# Every value written once: the generated app's words and settings in one place each

Design, 2026-10-17 (Fable). Johan, 2026-10-17 (via human assistance), widening A 123: any value the generated app uses in several places is written once, in a single generated module, and every place that needs it imports it from there; page titles first, but every value the generator duplicates as literals today. A text change then touches one file, and the preview updates in place without a reload. Status: a go; A builds the adapter part (§2), Fable the preview part (§3); §4 is to revisit.

## 1. What is duplicated today

Measured on the CRM starter (every string of three characters or more that appears in two or more generated files, code and class names left out): 74 values, of which these are the ones that matter, with the files they are written into.

| Value | Written in | Once already in |
|---|---|---|
| A page's title ("Customers", "Orders", "Team") | the root route's `menus` array; each route's `head` as `"Customers · Acme CRM"`, the kind's new and record routes too; the page's `PageHeader`; `ask.server.ts`'s words | nowhere |
| The app's name | each route's `head` title; `src/lib/auth.ts` (`APP_NAME`, a scaffold file: written once at the start and never again, so it goes stale when the app is renamed) | `src/generated/app.ts` (`app.name`) |
| A role's label ("Admin", "Sales") | `src/routes/sign-in.tsx` (`ROLE_LABELS`) | `src/generated/users.server.ts` (`ROLE_LABELS`) |
| A choice's label ("Draft", "Placed", …) | the list page's filter chips (`routes/orders/index.tsx`) | the model's module (`src/generated/order.ts`, `orderUi.fields[].choices`) |
| A field's label, a kind's label and plural | `ask.server.ts` (a JSON copy of every kind's words for the assistant, and the same in its description text) | the model's module (`customerUi`: `label`, `pluralLabel`, `fields[].label`) |

What is already right: a kind of record's words live once in its generated module (`<model>.ts`, the `RecordUi`), and the list, form and record routes import them; the app's name, currency and time zone live once in `app.ts`; the kit's own words in `src/kit/words/<language>.ts`; the theme's values once in `src/styles.css` as CSS variables, which every page reads. So the gap is the pages' words, the app name in tab titles and the scaffold, the roles' labels, the choice labels in filters, and the assistant's copy.

## 2. The rule, and what the adapter changes (A)

**The rule.** A value the generated app uses in more than one file is exported once from a generated module and imported where it is used; a literal is written only where a value is used in one file. New generator code follows it; ARCHITECTURE §5 says so.

- **Pages.** `src/generated/pages.ts` (which has each page's access rule today) gains the pages' words: `pageUi = { customers: { title, subtitle?, description?, icon }, … }`. The root route builds its menus from `pageUi` and the navigation (labels no longer literals); each route's `head` is `title(pageUi.customers, app)` at run time (`"Customers · Acme CRM"` made from the two, `tx()` in an app of several languages as today); `PageHeader` takes `pageUi.customers`. A page's title then lives in one file, and `pages.ts` is the one file a title change touches.
- **The app's name.** `src/lib/auth.ts` imports `app` from `#/generated/app` instead of its own `APP_NAME`. Scaffold files are written once, so this is the kind of value they must never copy; the scaffold templates are checked for others (grep for the starter's name in `templates/`).
- **Roles.** `sign-in.tsx` imports `ROLE_LABELS` from `#/generated/users.server` (or a small `#/generated/roles` module when the server file must not reach the client).
- **Choices.** The list page's filters take their chips from the model module's field (`orderUi.fields.find(f => f.name === "status").choices`), not a second literal list.
- **The assistant.** `ask.server.ts` builds its words from the model modules at run time (import `customerUi`, `orderUi`), or at least from the same generator function with no second copy of the texts in the file; the description texts the same.
- **Check.** A unit test in the adapter generates the CRM and the booking starter and asserts that no page title, app name, role label or choice label appears as a literal in more than one generated file (the script that made the table above, kept as `scripts/measure-duplicates.mjs` or inside the test), so the rule holds as the generator grows.

## 3. The preview updates in place (Fable)

With the words in data modules, a text change touches `pages.ts`, a model module or `app.ts`, modules without components. Studio's preview plugin (`packages/cli/src/preview-editor.ts`, `holdUpdates`) holds every hot update today and Studio makes one reload. For those modules it lets the hot update through: Vite propagates it to the importers (the root route, the page components), React Refresh re-renders them, and the new text shows in place with no reload, menu and tab title included. Studio's `touchesPage` then says a text change touches no page, since the preview updates itself; the measurement of 2026-10-16 (frame reloads and React commits per change) is the yardstick: a text change should give 0 reloads. Everything else stays held, and a change that touches the schema or the routes still gets Studio's one reload.

## 4. To revisit: navigation and the page header as choices, more layouts

Johan, 2026-10-17: more layout variants than the side menu and the header menu are wanted later, and the page header (title, subtitle, icon) as optional or placed differently belongs with that. For now only this: the generated structure stays open for it. The navigation and the page header are the shell's, drawn from `pageUi` and the ux file's choices by the root route and `AppShell`, never baked into each route file: a route gives its content and names its page; where the title goes (above the content, in the top bar, nowhere) and where the menu is (a side, the top, a drawer) are the shell's to decide from `ux.layout` when that exists. §2's `pageUi` is the first step of this: once the header reads it from the shell, moving the header is one change in the shell, not one in every route. The design of the choices themselves (the ux keys, the variants, the pictures) is a later item, with Johan.
