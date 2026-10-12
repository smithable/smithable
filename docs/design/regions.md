# Regions: EU and global

Status: proposal, not decided, apart from the decisions in its last section (Johan, 2026-10-07).

Johan, 2026-10-05, from testing smithable.ai: the start page should not say "an EU-hosted AI model" to a global audience; those texts belong on smithable.eu; from there "we should probably have a region picker", clear about what each choice means; "should we let people switch region later? We are currently planning for two regions, EU and global."

This note says what a region is, what each would promise, how one is chosen and changed, and what to build when. It ends with the decisions, taken by Johan on 2026-10-07.

## 1. What is already decided

- **Data location does not follow nationality** (the legal supplement of 2026-09-30): who may sign up, where the data is, and where people are, are three separate questions. Today all data is in Sweden (AWS `eu-north-1`) for everyone.
- **One stack, not a .eu and .ai pair** (2026-10-01). The provider for the launch (an EU-owned one, or AWS) is decided at the hosting launch.
- **EU-only is a setting, not the default** (2026-10-04): the AI policy `eu-only` on a project or an organization; the default is the best model available. smithable.eu, when it exists, is always EU-only.
- **What may be claimed** (the legal handoff): "stored and processed in Sweden", never "never leaves the EU": Stockholm is an EU region of a US company.

**Johan, later the same day:** "We will in the future have several hosts on for example Scaleway instead of AWS, so global == AWS and EU == Scaleway." That settles the open provider question for the EU region and changes "one stack" to one codebase run in two places. The rest of this note follows it.

## 2. What a region is

A region is a place: its own hosts at one provider, with its own copy of the service, its own database of accounts and projects, its own storage and backups.

| | EU | Global |
|---|---|---|
| The provider | An EU-owned one (Scaleway, say), in the EU | AWS (Sweden today; places nearer customers may come) |
| The domain | smithable.eu | smithable.ai |
| Which AI may read descriptions and records | EU-hosted providers only (the policy `eu-only`, pinned: no project can switch it off) | The best model available; a project may still switch on `eu-only` |
| Built-in services (mail, later text messages) | EU providers | The same EU providers where a good one exists |
| What may be promised | Stored and processed in the EU, by EU companies | Where it is stored, and by whom; nothing about the EU |

**Two services, not one service with two sets of hosts.** If one service on AWS managed the hosts at Scaleway, the accounts, the projects' names and the keys to the EU hosts would sit with a US company, and the EU promise would be worth what the AWS one is today. So each region runs the whole service. They share the code and nothing else: no account, no session, no database.

**Until the EU region exists** nothing on smithable.ai claims the EU, and smithable.eu keeps redirecting. The `eu-only` AI policy stays what it is, a project's setting.

## 3. Whose choice, and when

- **The account is in one region**, the one it was made in, and **all of its apps live there**. Signing up on smithable.eu makes an EU account; on smithable.ai a global one.
- **The picker** is shown on both domains before sign-up, with the table above in its words: where the data is, who the providers are (by name, linked to that region's privacy notice), which AI reads what you write, and that an app can be moved later. Choosing the other region sends the visitor to the other domain. Nothing decides silently.
- **Visitors from Europe are recommended the EU region**, and the picker says what the recommendation means: price, speed, stability and features are the same in both regions; the one difference is where the infrastructure, the data and the code run, and who operates them. Nothing else is promised for one and not the other.
- **Before the first app is published** the owner is told again, on the publish step, which region the account is in, what that implies for the app's visitors and data, and what the options are later (a move, §4). Sign-up is where the region is chosen; publishing is where it starts to matter, so that is where it must be clear.
- **One person may have an account in each**, with the same address: they are two accounts.

## 4. Moving an app to the other region

It is not hard, because an app is already a thing that can be picked up: the project is a Git repository with its manifest files, the published app is an image built from it, and its data is one database file and a folder of uploads, backed up and restored in a drill every month.

**What moves:** the project (its history too), the app's database and uploads, the app's own session secret (so its users stay signed in), and its settings. **What does not:** the old region's backups (they age out there, and the owner is told how long that takes: copies under a deletion lock cannot be removed sooner), secrets of connections (sealed with the old region's key: the owner enters them again, or they are passed once, re-sealed), and usage history.

**Who may, and on what terms:** a paying customer may move between global and EU, in either direction. Every move is a change of operator, so at every move the customer accepts the target region's terms and privacy notice, acknowledged each time, never carried over from an earlier move. Smithable asks for one month's notice to guarantee the move; it is usually done far sooner, but the notice is what is promised.

**How:** the owner asks for it on the app's page, signed in to both regions. The app stops taking writes, a last backup is taken, the bundle goes to the other region's storage, is restored and checked there (the pages answer, the record counts match), and only then is the old one removed. Minutes for an app of ordinary size. If the check fails, the app starts again where it was.

**The address** is what the owner notices. An app's own address under Smithable's domain belongs to a region's hosts, so it changes (or each region gets a label in it); the old address redirects for a time. A custom domain keeps its name, but its owner has to act: the domain's DNS is pointed at the new region, and the move waits for that. The move flow says so at the start, before anything is copied, and again at the step that waits.

**What is real work** is not the move but the second region: the parts of operations that are AWS's own today (remote administration, alarms and metrics, the image registry, the deployment's identity, the backup bucket's deletion lock) need their counterparts at the other provider, in the infrastructure code and the scripts. The service itself is a virtual machine, S3-compatible storage and DNS, as decided when OpenTofu was chosen.

## 5. What to build, and when

1. **Now (B, in hand):** smithable.ai says nothing about the EU.
2. **The EU region:** the infrastructure at the EU provider, the service running there with Mistral as its only AI, its privacy notice and terms, smithable.eu serving it. Its own decision of when: it doubles what is operated.
3. **With it:** the picker on both domains.
4. **After it:** the move between regions, as a request first (an operator runs the restore) and a button later.

The engine needs nothing new: `smithable backup` and `restore` already work against any S3-compatible storage, and the AI policy and its pinning exist (ARCHITECTURE §9).

## 6. Decisions (Johan, 2026-10-07: yes to all five, with additions)

1. **A region is a place with its own service: global on AWS, EU on an EU-owned provider.** Two services that share only the code, so an account is in one region, and all of a customer's apps are in that region.
2. **The EU region promises what only it can: EU location and EU companies,** for hosting, AI and built-in services. DNS for smithable.eu then also belongs at an EU provider. Everything else, price, speed, stability and features, is the same in both regions, and the texts say so.
3. **The picker is shown on both domains before sign-up; the domain, and later the country, only preselect.** Visitors from Europe are recommended the EU region, with what the recommendation means. The region is chosen at sign-up and made very clear again before the first app is published: which region, what it implies, and the options later.
4. **A paying customer may move an app to the other region,** as a transfer between the two services with a check before the old copy goes, never by itself. At every move the customer accepts the target region's terms and privacy notice, acknowledged each time. One month's notice guarantees the move. The address changes unless the app has its own domain; a custom domain needs the customer's DNS pointed at the new region, said up front and in the move flow.
5. **When:** the EU region is built when there is a customer for it or at the public release, whichever Johan chooses; until then smithable.eu redirects and the texts claim nothing. Not for the invited beta. The stack itself is designed in the cloud repository's `docs/design/smithable-eu.md`.
