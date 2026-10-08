# The administrator's pages in one place

Johan, testing the CRM on 2026-10-08 as "Dev admin": "where do I find the admin page?" The administrator's things were in three places: Team in the menu (with the API keys on it), the trash as a small link under each list, and the activity only on a data page, which the CRM has none of. Fable said go on 2026-10-08 (backlog A53).

## What it is

- **The Admin group.** When the navigation shows the users page, the menu's last group is Admin: Team, Trash and Activity. The users page leaves the menu the author put it in for this group (a menu it leaves empty is not shown). It is presentation the generator chooses, like the menu's icons: nothing in the spec says it, and a project without a users page in its navigation has no group.
- **Who sees it.** The three have the users page's own access (admins, unless the page's `access` widens it): the two new pages live under its route (`/team/trash`, `/team/activity`) and are guarded by its rule, so the group shows to whoever may open Team, and to nobody else.
- **Trash** lists every model with a trash on one page, each under its name, with the per-list Trash page's table: Restore and Delete for good on a row or a selection, a row opening the record. What a person sees is what the model's delete rule lets them delete, as on the per-list page, so an administrator never needs that page. The per-list Trash links stay, for whoever may delete without being an administrator.
- **Activity** is the data page's activity, at `/team/activity`; an app with a data page has both, the same log.
- **Keys** stay a part of Team.

## Not now

A settings page of its own (the app's settings model, onboarding answers) in the group; a count of what is in the trash beside its menu item.
