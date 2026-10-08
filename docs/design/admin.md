# The administrator's pages in one place

Johan, testing the CRM on 2026-10-08 as "Dev admin": "where do I find the admin page?" The administrator's things were in three places: Team in the menu (with the API keys on it), the trash as a small link under each list, and the activity only on a data page, which the CRM has none of. Fable said go on 2026-10-08 (backlog A53).

## What it is

- **The Admin group.** When the navigation shows the users page, the menu's last group is Admin: Team, Trash and Activity. The users page leaves the menu the author put it in for this group (a menu it leaves empty is not shown). It is presentation the generator chooses, like the menu's icons: nothing in the spec says it, and a project without a users page in its navigation has no group.
- **Who sees it.** The three have the users page's own access (admins, unless the page's `access` widens it): the two new pages live under its route (`/team/trash`, `/team/activity`) and are guarded by its rule, so the group shows to whoever may open Team, and to nobody else.
- **Trash** lists every model with a trash on one page, each under its name, with the per-list Trash page's table: Restore and Delete for good on a row or a selection, a row opening the record. What a person sees is what the model's delete rule lets them delete, as on the per-list page, so an administrator never needs that page. The per-list Trash links stay, for whoever may delete without being an administrator.
- **Activity** is the data page's activity, at `/team/activity`; an app with a data page has both, the same log.
- **Keys** stay a part of Team.

## Removing a member whom records name

Johan asked on 2026-10-08 what happens to a removed member's records; a required reference to them made the removal fail with no way forward (backlog A56). Now the remove dialog says which records name the person, by kind and reference ("12 tasks have Anna as assignee.", "3 customers belong to Anna."), and offers to give them to another member. Without one, the optional references and the records that are theirs are cleared, as before; a required reference needs someone, and Remove waits for the choice. The change and the removal are one transaction, with an Activity line per kind ("records reassigned" or "records cleared", with the records' ids), and records in the trash follow the same choice.

## Not now

A settings page of its own (the app's settings model, onboarding answers) in the group; a count of what is in the trash beside its menu item.
