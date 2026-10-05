# Regions: EU and global

Johan, 2026-10-05, from testing smithable.ai: the start page should not say "an EU-hosted AI model" to a global audience; those texts belong on smithable.eu; from there "we should probably have a region picker", clear about what each choice means; "should we let people switch region later? We are currently planning for two regions, EU and global."

This note says what a region is, what each would promise, how one is chosen and changed, and what to build when. It ends with the decisions that are Johan's.

## 1. What is already decided

- **Data location does not follow nationality** (the legal supplement of 2026-09-30): who may sign up, where the data is, and where people are, are three separate questions. Today all data is in Sweden (AWS `eu-north-1`) for everyone.
- **One stack, not a .eu and .ai pair** (2026-10-01). The provider for the launch (an EU-owned one, or AWS) is decided at the hosting launch.
- **EU-only is a setting, not the default** (2026-10-04): the AI policy `eu-only` on a project or an organization; the default is the best model available. smithable.eu, when it exists, is always EU-only.
- **What may be claimed** (the legal handoff): "stored and processed in Sweden", never "never leaves the EU": Stockholm is an EU region of a US company.

Two regions fit these if a region is an edition of the one service, not a second service.

## 2. What a region is

A region is a promise about two things, kept by the account it belongs to:

| | EU | Global |
|---|---|---|
| Where the apps and their data are | In the EU (Sweden today) | Where Smithable hosts (Sweden today; a place nearer the customer may come) |
| Which AI may read descriptions and records | EU-hosted providers only (the policy `eu-only`, pinned: no project can switch it off) | The best model available; a project may still switch on `eu-only` |
| Built-in services (mail, later text messages) | EU providers | The same EU providers where a good one exists |
| The domain | smithable.eu | smithable.ai |
| What the pages say | That it is EU-hosted, and by whom | Nothing about the EU; what is true |

Today the two differ only in the AI and in what is promised: there is one host. That is worth saying plainly in the picker rather than implying two data centres.

**What EU does not promise yet:** EU-owned infrastructure. The host is AWS in Stockholm until the provider decision. An organization that needs an EU-owned stack is told so, not sold the EU region as if it were one.

## 3. Whose choice, and when

- **The account chooses**, at sign-up. An organization's projects are all in its region; a region per project would let one invoice span two promises and helps nobody yet.
- **The domain preselects**: arriving at smithable.eu the picker shows EU chosen, at smithable.ai global. Later the visitor's country may preselect too. Nothing decides silently: the picker is always shown, with the table above in its words.
- **The picker's texts are the implications**, one short paragraph each: where the data is, which AI reads what you write, who the providers are (by name, linked to the privacy notice), and that it can be changed.

## 4. Changing region

Yes, people can change, because today it is a setting.

- **Global to EU:** at once, by the account's owner. From then on only EU-hosted AI is used. What was sent to other providers before is not undone, and the confirmation says so.
- **EU to global:** by the account's owner, after a confirmation that names what changes (which providers may now process descriptions and records). An organization may lock this.
- **When a second host exists** (a global region outside Sweden): changing where the data is becomes a move: a backup restored in the other place, minutes of downtime, the app's address unchanged. The owner asks for it; it never happens by itself, and never because of where someone signs in from.

## 5. What to build, and when

1. **Now (B, in hand):** smithable.ai says nothing about the EU.
2. **Before the public release:** the account's region (a field, default by domain), the picker at sign-up, the pinned policy for EU accounts, smithable.eu serving the same service with the EU texts instead of redirecting, the change of region on the account page, and the privacy notice and terms naming the providers per region.
3. **Later, on demand:** a second host, and the move between hosts.

The engine needs nothing new: the AI policy and its pinning by an organization exist (ARCHITECTURE §9).

## 6. Decisions (Johan)

1. **A region is an edition of the one service, kept per account,** until a second host is needed. Recommended. The alternative, two services, doubles operations for a difference that is today one setting.
2. **EU promises location (Sweden), EU-hosted AI and EU providers for built-in services, and says the host is AWS** until the provider decision. Recommended: it is what is true.
3. **The picker is shown on both domains at sign-up; the domain, and later the country, only preselect.** Recommended.
4. **Changing is allowed both ways by the account's owner,** at once towards EU, with a confirmation towards global; a move of data only when there are two hosts, and only when asked for. Recommended.
5. **Built for the public release, not for the invited beta,** except the texts. Recommended: the beta's testers are few and all on one host.
