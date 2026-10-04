# M12 first builds: three models side by side (2026-10-04)

The same 34 descriptions (the twelve of the first set and the 22 of the second, [bench-m12](../../scripts/bench-m12.mjs)) drafted by three models, for choosing the beta's default model. Each run is in its own report with every description's row, scorecard and summary:

- **Mistral Medium 3.5** (`mistral-medium-latest`, Mistral's API, EU): [first set](m12-first-builds-mistral-medium-latest.md), [second set](m12-first-builds-mistral-medium-latest-wide.md). This run is from main after #217 (#220), earlier today. Answers at temperature 0.
- **Claude Opus 5.5** (Claude Code's default model, through `SMITHABLE_FRONTIER=claude-code`, on Johan's subscription): [first set](m12-first-builds-claude-code.md), [second set](m12-first-builds-claude-code-wide.md). All 71 calls were answered by `claude-opus-5-5`. Claude Code sets the temperature itself.
- **OpenAI gpt-6.1-sol** (OpenAI's current mid-priced model, `SMITHABLE_MODEL_LOCATION=elsewhere`): [first set](m12-first-builds-gpt-6.1-sol.md), [second set](m12-first-builds-gpt-6.1-sol-wide.md). The model takes only its default temperature (1), so its answers vary from run to run (#228).

The Claude and OpenAI runs are from main after #226 and #228. Since the Mistral run, the drafting prompt has grown (the guidance for booking, standard actions, computed fields), so Mistral's token counts and costs below are not on the same prompt. One description run again today (the CRM) gives the like-for-like cost.

## The table

| | Mistral Medium 3.5 | Claude Opus 5.5 | OpenAI gpt-6.1-sol |
|---|---|---|---|
| Created | 34 / 34 | 34 / 34 | 34 / 34 |
| Type-check | 34 / 34 | 31 / 34 | 29 / 34 |
| Why not | | 3 generator bugs, fixed in #232 | 2 of the same generator bugs, fixed in #232 |
| Drafting calls per build (first draft and corrections) | not recorded | 37 for 34 | 36 for 34 |
| Time per build (draft, without the type check) | 35 s | 42 s | 47 s |
| Tokens per build, in and out (averages) | 13,946 in all, earlier prompt | 25,584 in, 2,524 out | 13,438 in, 1,864 out |
| The CRM today, same prompt | 36,309 in, 2,738 out | 23,578 in, 2,405 out | 12,756 in, 2,137 out |
| Price per million tokens, in / out | $1.50 / $7.50 (list) | Claude Code's own figure | $2.00 / $10.00 (list) |
| **Cost per build** | **$0.075** for the CRM today; $0.029 averaged on the earlier prompt | $0.074 averaged, **as Claude Code reports it**; the run was on the subscription and cost no money | **$0.046** averaged, list price paid |
| All 34 | ≈ $1.00 on the earlier prompt | $2.53 reported, not paid | $1.55 paid |
| Starter chosen | all three chose the same starter for 31 of 34; the other three: the piano teacher (booking; records, records), the Swedish builder (crm; invoicing, invoicing), the German farm shop (crm; booking; crm) | | |
| Drafts made only of the starter's models | 11 | 10 | 16 |
| Status drafts' 3 actions kept | 4 of 4 | 4 of 4 | 4 of 4 |
| Warnings | 2 drafts (a timezone; personal data public) | 7 drafts (timezone 4, a shortcut to a closed page 3, a capacity without unique 1) | 4 drafts (timezone 3, a shortcut 1) |
| Answers repeatable | yes (temperature 0) | as Claude Code decides | no (temperature 1) |
| Where it runs | EU (Mistral) | US (Anthropic) | US (OpenAI) |

Costs marked *list* are Mistral's and OpenAI's published prices per million tokens (mistral.ai/pricing/api, developers.openai.com/api/docs/pricing, today), times the tokens the API reported. Claude Code's figure is what it reports for a call, not money paid: the run was on Johan's subscription.

"Drafts made only of the starter's models" counts drafts whose every model is one of its starter's, by name. That is right when the description fits the starter (a yoga studio from the booking starter, a status page from the status starter) and a miss when it does not: OpenAI kept the yoga starter's `ClassType`, `Instructor` and `Session` for both hair salons, and the marketplace's `Item` for the tool library, the vinyl collection and the bird sightings.

## What each built, side by side

Counts from each draft's spec files: models, fields (computed ones in brackets), pages, the landing page's sections, actions, a capacity, who may read, the public pages, and how many words of their own the texts have.

**A booking site for a yoga studio** (booking starter)

| | Models | Fields | Pages | Landing | Actions | Capacity | Words written |
|---|---|---|---|---|---|---|---|
| Mistral | class types, instructors, sessions, bookings, **posts, messages** | 24 (1) | 11 | hero, records, gallery, FAQ, records, contact | | bookings | 11 |
| Claude | class types, instructors, sessions, bookings | 14 (1) | 7 | hero, records ×2, FAQ | | bookings | 41 |
| OpenAI | class types, instructors, sessions, bookings | 14 (1) | 6 | hero, records ×2 | | bookings | 46 |

Mistral kept the starter's blog and contact form; the other two left them out. All three book through a capacity and make the schedule public.

**Invoicing for freelancers** (invoicing starter)

| | Models | Fields | Pages | Landing | Actions | Words written |
|---|---|---|---|---|---|---|
| Mistral | business profile, clients, invoices, lines | 22 (2) | 3 | none | mark sent, mark paid | 0 |
| Claude | clients, lines, **payments**, invoices | 25 (4: amount, due date, paid, balance) | 6 | hero, features, FAQ, call to action | mark sent, **mark overdue**, mark paid, **duplicate** | 42 |
| OpenAI | business profile, clients, lines, **payments**, invoices | 30 (4) | 5 | none | mark sent, mark paid | 2 |

Claude's draft is the richest (payments with a balance, four actions, a landing page), but it dropped the business profile that prints on every invoice, and it was one of the three that did not type-check (its `balance` formula, fixed in #232).

**A tool library where neighbors lend each other tools** (marketplace starter)

| | Models | Fields | Pages | Landing | Actions | Words written |
|---|---|---|---|---|---|---|
| Mistral | tools | 5 | 3 | hero | | 12 |
| Claude | tools | 7 | 4 | hero, records | **lend out, mark returned** | 45 |
| OpenAI | items (the starter's name) | 6 | 4 | hero, records | **lend, return** | 55 |

Both frontier models added the two buttons a tool library needs; Mistral added none.

**Event registration for a conference** (booking starter)

| | Models | Fields | Pages | Landing | Capacity | Words written |
|---|---|---|---|---|---|---|
| Mistral | talks, speakers, attendees, registrations | 19 | 5 | hero, records ×2, contact | registrations | 14 |
| Claude | speakers, talks, registrations | 12 (1) | 6 | hero, records ×2, FAQ, call to action | registrations | 29 |
| OpenAI | **class types, instructors**, attendees, **sessions, bookings** | 16 (1) | 8 | hero, records ×2 | bookings | 50 |

OpenAI kept the yoga starter's names for a conference: a person would have to rename four of five models. Mistral and Claude named them for a conference.

**A status page for our API** (status starter)

| | Models | Fields | Pages | Landing | Actions | Words written |
|---|---|---|---|---|---|---|
| Mistral | components, incidents, updates, maintenance | 20 | 7 | hero, records ×2 | identified, monitoring, resolve | 10 |
| Claude | the same | 20 | 7 | hero, records ×4 | the same | 10 |
| OpenAI | the same | 20 | 6 | hero, records ×4 | the same | 35 |

The starter fits, and all three keep it, with its three actions.

**Bokning för min frisörsalong** (a Swedish hair salon; booking starter)

| | Models | Fields | Pages | Landing | Capacity | Words written (Swedish) |
|---|---|---|---|---|---|---|
| Mistral | **services, stylists**, sessions, bookings | 17 (1) | 6 | hero, records ×2, contact | bookings | 44 |
| Claude | **services, stylists, slots**, bookings | 16 (1) | 7 | hero, records ×2, FAQ, call to action | bookings | 79 |
| OpenAI | class types, instructors, sessions, bookings | 13 (1) | 7 | hero, records, call to action | bookings | 81 |

Mistral and Claude named a salon's records (services, stylists); OpenAI kept the yoga studio's.

## What stands out

- **All three create every app.** Type-checking differs only by generator bugs that richer drafts hit, now fixed (#232).
- **Claude Opus 5.5 builds the most:** more actions where a person would expect them (lend and return, mark overdue, duplicate), payments with a balance, landing pages with an FAQ and a call to action. It names records for the description, not the starter. It reports about the same cost per build as Mistral on today's prompt, but runs in the US and, through Claude Code, on a subscription rather than per call.
- **Mistral Medium 3.5** is the only EU-hosted one and answers repeatably. It names records for the description as Claude does, but adds fewer actions and writes fewer words. On today's prompt it costs about as much per build as the other two (the CRM: $0.075).
- **OpenAI gpt-6.1-sol** is the cheapest per build at list price ($0.046) and writes the most words. But it keeps the starter's names more often (16 of 34, including a conference and two hair salons named like a yoga studio), and its answers vary between runs.
- Tokens are not comparable across models: the same CRM prompt counts 36,309 tokens at Mistral, 23,578 at Claude and 12,756 at OpenAI, each by its own tokenizer, so cost per build is the fair figure.

Tonight's daily Mistral run, on the same main as the other two, will give Mistral's averages on today's prompt.
