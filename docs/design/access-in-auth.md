# Who may do what lives in `smithable.auth.yml`

Johan, 2026-10-09, on the CRM: "There are explicit access set for models and pages in the smithable.yml. Shouldn't this be in the auth file? Shouldn't more be covered by convention and implicit or global rules?" Then: the structure under the roles can be like `public`, `all` for the admin role, and "if we use global rules we don't need to be implicit; it will be so short anyway."

## The problem

Today `smithable.auth.yml` holds the defaults (`defaultAccess`, the roles, what is public) and `smithable.yml` holds the exceptions: `access` on a model or a page and `allow` on an action. "Who may do what" is answered by two files, and the exceptions repeat: the CRM says `write: [sales]` and `delete: [admin]` on every model, the booking app `create: [admin]` on every model members must not add to and `access: [admin]` on five pages. Those lines say something about the roles, not about the models, and they are the only place a role name appears in `smithable.yml`.

## The rule

`smithable.yml` says what the app is. `smithable.auth.yml` says who may do what, in full, with three global rules and a block per role that reads like `public`:

```yaml
smithableAuth: 0.1
signIn: { providers: [email] }

defaultAccess: shared              # the record rule for everyone who signs in (below)

roles:
  admin: all                       # the whole app; it always exists and is always all
  sales:
    description: Works with customers and orders.
    pages: all                     # may open every page (or a list of pages)
    create: all                    # may add records of every model (or a list of models)
    write: [Customer, Order]       # may change anyone's customers and orders
    actions: [mergeCustomers]      # may run these custom actions

public:                            # as today
  pages: []
```

The global rules, each one sentence in the spec, none of them changed by a model:

1. **The record rule** is `defaultAccess`: with `shared`, everyone who signs in reads every record; with `private`, only their own. Everyone changes and deletes their own records.
2. **Nothing else is implied.** A role opens the pages, adds to the models, changes or deletes anyone's records, and runs the custom actions that its block lists. `all` is a list of everything. A role with no block has the record rule and nothing more; the validator warns when a role can open no page.
3. **Admins do everything.** `admin: all` is written in the file so that it is read there, and anything else under `admin` is an error.

Two conventions, named in the spec rather than implied:

- A **standard action** (`set`, `add`, `copy`…) is run by the roles that may change the record, as today; `actions` lists custom actions.
- `pages: all` is every page except the administrators' pages (the users page and a data page), which a role gets by naming them.

A role's block has the keys `description`, `pages`, `read`, `create`, `write`, `delete` and `actions`. `read` matters with `private` (staff that reads every booking); with `shared` it says nothing, and the validator says so.

## What leaves `smithable.yml`

`access` on a model, `access` on a page and `allow` on an action. Each is an error that names where it went: "Who may change Customer records is said in smithable.auth.yml: `roles.sales.write`." `ownedBy` stays: it says which field is the owner, which is the shape of the data.

The CRM becomes:

```yaml
roles:
  admin: all
  sales: { description: Works with customers and orders., pages: all, create: all, write: all, actions: [mergeCustomers] }
```

(deleting anyone's customer stays the administrators': the record rule lets a salesperson delete their own). The booking app:

```yaml
roles:
  admin: all
  member: { description: A student who books classes., pages: [schedule, my-bookings, settings], create: [Booking] }
```

and no model or page in `smithable.yml` says a word about roles. The status page: `staff: { pages: all, create: all, write: all }`. The API example's assistant: `assistant: { read: all, create: [Task, Note], write: [Task, Note] }` (it never deletes).

## Operations

`setAccess` and the `allow` part of the action operations go. One operation grants: `grant sales write Customer Order`, `grant sales pages all`, `grant sales write none` (nothing), `grant sales all` and `grant sales none`. `setOwner` stays. Studio's access forms call it; the Builder's summary keeps showing the effective access of each model and page, computed as today.

## In core

`RoleIR` gets `grants` (`all`, or the lists), parsed with the role in `auth.ts`, checked against the spec's models, pages and actions (an unknown name is an error, as in `public`). `access.ts` reads the grants instead of the models' exceptions: `modelAccess` lists the roles whose grant names the model (admin always), `pageAccess` the roles whose `pages` names the page, `actionAccess` the roles whose `actions` names a custom action; a standard action follows write as today, minus the `among` narrowing that `allow` gave. The `Allowed` shape the adapter reads does not change, so the generated access layer, the users page, the API, the assistant and the trash are untouched. `complete.ts` offers the grant keys and names under a role. The JSON Schema of the auth file lists the keys; the spec's schema loses `access` and `allow`.

The reader of first descriptions and `smithable new` write the role blocks: a shared app's default role gets `pages: all, create: all`; a private app's gets `pages: all, create: all` too, the record rule keeping records apart.

## Not in this change

Narrowing the record rule for one model (an order the owner may not change once placed) is a workflow rule, and nothing asked for it yet; when it comes it is a role-independent `readonly` on the model, not a role list. Teams and workspaces stay where ARCHITECTURE §3.1 puts them.
