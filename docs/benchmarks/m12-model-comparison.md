# M12 first builds: the models side by side (2026-10-04, Mistral Large 2026-10-05)

The same 34 descriptions (the twelve of the first set and the 22 of the second, [bench-m12](../../scripts/bench-m12.mjs)) drafted by five models, for choosing the beta's default model. Each run is in its own report with every description's row, scorecard and summary:

- **Mistral Medium 3.5** (`mistral-medium-latest`, Mistral's API, EU): [first set](m12-first-builds-mistral-medium-latest.md), [second set](m12-first-builds-mistral-medium-latest-wide.md). This run is from main after #217 (#220), earlier today. Answers at temperature 0.
- **Claude Opus 5.5** (Claude Code's default model, through `SMITHABLE_FRONTIER=claude-code`, on a Claude subscription): [first set](m12-first-builds-claude-code.md), [second set](m12-first-builds-claude-code-wide.md). All 71 calls were answered by `claude-opus-5-5`. Claude Code sets the temperature itself.
- **Claude Sonnet 4.6 and Claude Haiku 4.5 through Amazon Bedrock** (`eu.anthropic.claude-sonnet-4-6`, `eu.anthropic.claude-haiku-4-5-20251001-v1:0`, the EU inference profiles in eu-north-1, so requests stay in the EU; #239): Sonnet [first set](m12-first-builds-eu.anthropic.claude-sonnet-4-6.md), [second set](m12-first-builds-eu.anthropic.claude-sonnet-4-6-wide.md); Haiku [first set](m12-first-builds-eu.anthropic.claude-haiku-4-5-20251001-v1-0.md), [second set](m12-first-builds-eu.anthropic.claude-haiku-4-5-20251001-v1-0-wide.md). Answers at temperature 0, with the fixed system text cached (below). Sonnet 5.5, Bedrock's cheaper newer Sonnet ($2.20 / $11.00 in the EU), is not yet available on this AWS account; Opus is not either.
- **OpenAI gpt-6.1-sol** (OpenAI's current mid-priced model, `SMITHABLE_MODEL_LOCATION=elsewhere`): [first set](m12-first-builds-gpt-6.1-sol.md), [second set](m12-first-builds-gpt-6.1-sol-wide.md). The model takes only its default temperature (1), so its answers vary from run to run (#228).

The Claude and OpenAI runs are from main after #226 and #228; the Bedrock runs from #239's branch, a little before #232 (so they still hit two of the generator bugs #232 fixed). Since the Mistral run, the drafting prompt has grown (the guidance for booking, standard actions, computed fields), so Mistral's token counts and costs below are not on the same prompt. One description run again today (the CRM) gives the like-for-like cost.

## The table

| | Mistral Medium 3.5 | Claude Opus 5.5 | OpenAI gpt-6.1-sol | Claude Sonnet 4.6 (Bedrock) | Claude Haiku 4.5 (Bedrock) |
|---|---|---|---|---|---|
| Created | 34 / 34 | 34 / 34 | 34 / 34 | 33 / 34 | 34 / 34 |
| Type-check | 34 / 34 | 31 / 34 | 29 / 34 | 29 / 34 | 34 / 34 |
| Why not | | 3 generator bugs, fixed in #232 | 2 of the same generator bugs, fixed in #232 | 4 of #232's bugs (the branch predates it); 1 new: dashboard widgets named in kebab-case (reported to A) | |
| Drafting calls per build (first draft and corrections) | not recorded | 37 for 34 | 36 for 34 | 129 calls in all, 3.8 per build | 113 calls in all, 3.3 per build |
| Time per build (draft, without the type check) | 35 s | 42 s | 47 s | 45 s | 33 s |
| Tokens per build, in and out (averages) | 13,946 in all, earlier prompt | 25,584 in, 2,524 out | 13,438 in, 1,864 out | 29,172 in, 3,377 out | 27,508 in, 1,973 out |
| The CRM today, same prompt | 36,309 in, 2,738 out | 23,578 in, 2,405 out | 12,756 in, 2,137 out | 36,912 in, 4,086 out (6 calls) | 17,910 in, 1,266 out (3 calls) |
| Price per million tokens, in / out | $1.50 / $7.50 (list) | Claude Code's own figure | $2.00 / $10.00 (list) | $3.30 / $16.50; a cache read $0.33 | $1.10 / $5.50; a cache read $0.11 |
| **Cost per build** | **$0.075** for the CRM today; $0.029 averaged on the earlier prompt | $0.074 averaged, **as Claude Code reports it**; the run was on the subscription and cost no money | **$0.046** averaged, list price paid | **$0.076** averaged, paid (the CRM: $0.091) | **$0.016** averaged, paid (the CRM: $0.010) |
| All 34 | ≈ $1.00 on the earlier prompt | $2.53 reported, not paid | $1.55 paid | $2.58 paid | $0.55 paid |
| Starter chosen | all three chose the same starter for 31 of 34; the other three: the piano teacher (booking; records, records), the Swedish builder (crm; invoicing, invoicing), the German farm shop (crm; booking; crm) | | | | |
| Drafts made only of the starter's models | 11 | 10 | 16 | 11 | 11 |
| Actions in all 34 drafts | 51 | 69 | 68 | **75** | 29 |
| Words written per draft (texts of its own) | 13 | 24 | 27 | 26 | 11 |
| Fields and pages per draft | 15.9; 4.2 | 16.9; 4.8 | 16.0; 4.2 | **18.4; 5.6** | 15.8; 4.7 |
| Status drafts' 3 actions kept | 4 of 4 | 4 of 4 | 4 of 4 | 4 of 4 | 4 of 4 |
| Warnings | 2 drafts (a timezone; personal data public) | 7 drafts (timezone 4, a shortcut to a closed page 3, a capacity without unique 1) | 4 drafts (timezone 3, a shortcut 1) | 7 warnings (timezone 2, shortcut 2, a capacity without unique 2, personal data public 1) | 4 warnings (**personal data public 3**: speakers' email, a job post's poster, a bird sighting's observer; timezone 1) |
| Answers repeatable | yes (temperature 0) | as Claude Code decides | no (temperature 1) | yes (temperature 0) | yes (temperature 0) |
| Where it runs | EU (Mistral) | US (Anthropic) | US (OpenAI) | EU (AWS eu-north-1, EU profile) | EU (AWS eu-north-1, EU profile) |

Costs marked *list* are Mistral's and OpenAI's published prices per million tokens (mistral.ai/pricing/api, developers.openai.com/api/docs/pricing, today), times the tokens the API reported. Bedrock's are the AWS Price List's for eu-north-1 on the EU profiles (today), per kind of token: new input, a cache write (a quarter more), a cache read (a tenth), output. Claude Code's figure is what it reports for a call, not money paid: the run was on Johan's subscription.

"Drafts made only of the starter's models" counts drafts whose every model is one of its starter's, by name. That is right when the description fits the starter (a yoga studio from the booking starter, a status page from the status starter) and a miss when it does not: OpenAI kept the yoga starter's `ClassType`, `Instructor` and `Session` for both hair salons, and the marketplace's `Item` for the tool library, the vinyl collection and the bird sightings.

## Mistral Large 3, the EU-owned alternative (first set, 2026-10-05)

Johan's choice of Sonnet 4.6 on Bedrock leaves Mistral as the EU-owned alternative, checked weekly with Large ([report](m12-first-builds-mistral-large-latest.md), `--model mistral-large-latest`, $0.50 / $1.50 per million tokens). Beside Claude's daily run the same night and Sonnet's first set (2026-10-04, before #259 and #266 changed drafting):

| The first set (12) | Mistral Large 3 | Claude Opus 5.5 (Claude Code) | Sonnet 4.6 (Bedrock, EU) |
|---|---|---|---|
| Created | 11 / 12 | 12 / 12 | 12 / 12 |
| Type-check | 10 / 12 (one a generator bug, with A) | 12 / 12 | 11 / 12 (a generator bug, since fixed) |
| Actions in all drafts | 16 | 26 | 26 |
| Fields; pages per draft | 18.2; 4.5 | 18.6; 5.1 | 18.3; 5.8 |
| Words of its own per draft | 38 | 28 | 24 |
| Drafts that still leave personal data public | 2 | 0 | 0 (Sonnet's second set after #266: 0 of 24) |
| Cost per build | **$0.016**, list price paid | $0.089 reported (subscription) | $0.072 paid |
| Time per build | 34 s | 34 s | 43 s |

Large's one failure is its own: a formula written with single quotes, refused twice. It costs a fifth of the others per build and writes more of its own words, but adds fewer actions. It leaves personal data public on two drafts: a job board's contact email and phone, a football club's dates of birth. Whether a contact detail is meant to be public is for the description to say, so the drafting step does not remove it: the warning reaches the model once (#266), stays on the draft, and the hosted publish page shows it. With Sonnet none is left; with Large it is the price of the smaller model, and the person sees it before publishing.

## Prompt caching on Bedrock

Every drafting call starts with the same system text: the spec grammar, the operations and the guidance, about 16,550 tokens for Sonnet and Haiku alike. Bedrock keeps it for five minutes after a call that marks it (a cache point), so in a run of builds one after the other it is written once and read back at a tenth of the input price.

| | Calls | Input read from the cache | Written to it | New input | Share of the input from the cache |
|---|---|---|---|---|---|
| Sonnet 4.6, both sets | 88 | 877,097 | 16,549 | 143,213 | 85% |
| Haiku 4.5, both sets | 86 | 860,704 | 0 (still warm from a test just before) | 119,547 | 88% |

What is new in each call is the description and the draft so far: about 1,600 tokens for Sonnet and 1,400 for Haiku. Without the cache, the input of the 34 builds would cost about four times as much: Sonnet $3.42 instead of $0.83, Haiku $1.08 instead of $0.23 (output not included). For the beta this means the cache pays whenever builds come within five minutes of each other; a lone build pays the write once, about $0.06 more for Sonnet and $0.02 for Haiku.

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
- **Claude Sonnet 4.6 through Bedrock** builds the most of all five: 75 actions, 18.4 fields and 5.6 pages per draft, a landing page on 21 of 34. It runs in the EU, answers repeatably, and costs about what Opus reports through Claude Code ($0.076 per build), paid per call. It needs the most correction rounds (3.8 calls per build), and two of its new kinds of draft hit generator bugs (#232's, and the kebab-case dashboard names).
- **Claude Haiku 4.5 through Bedrock** is the cheapest by far ($0.016 per build, a fifth of the others) and the fastest (33 s), and every draft type-checks. But it builds the least: 29 actions in all (Sonnet 75), 11 words of its own per draft. It is also the one that most often makes personal data public (3 drafts).
- Tokens are not comparable across models: the same CRM prompt counts 36,309 tokens at Mistral, 23,578 at Claude and 12,756 at OpenAI, each by its own tokenizer, so cost per build is the fair figure.

## Blind comparison, round 1

Ten descriptions built by Claude Opus 5.5 (through Claude Code), gpt-6.1-sol and Mistral Medium 3.5, shown to Johan as A, B and C in a shuffled order, the start page and the main list of each. His answer was an overall lean to "C" (better landing pages and data, and a gallery view for the tool library rather than rows). Mapped through the key, "C" was Claude Opus 5.5 on 5 sheets, Mistral Medium on 4 and gpt-6.1-sol on 1. That is no clear winner, with a lean to Claude; the landing page, the sample data and the choice of view decide. The heroes on those sheets were the starter's own, not the picked ones (fixed on fable/hero-pick). Round 2 puts Sonnet 4.6 and Haiku 4.5 through Bedrock beside Opus 5.5, with one answer asked per sheet.

## Blind comparison, round 2

The same ten descriptions built by Claude Opus 5.5 (round 1's apps), and by Claude Sonnet 4.6 and Claude Haiku 4.5 through Bedrock's EU profiles, as A, B and C in a shuffled order with the question on each sheet; one answer per sheet, "none" allowed. The heroes come from the fixed picker (#242) for all three.

| Sheet | Johan's pick | Model | His reason, condensed |
|---|---|---|---|
| 1. Yoga studio | none | | Haiku's and Sonnet's have a blog ("news & articles") that may not belong; Opus's lacks class types and messages |
| 2. Invoicing | B | Sonnet 4.6 | a better heading, more complete; its app name is too long for the header. Opus's list showed "Something went wrong" (a formula bug since fixed on main) |
| 3. Tool library | A | Opus 5.5 | shows the tools before sign-in; the other two open on a sign-in page |
| 4. Conference | C | Opus 5.5 | the better landing page and heading, and a schedule (Haiku's has none) |
| 5. Status page | none | | Sonnet's landing button leads to the incident history, which needs sign-in |
| 6. Hair salon (Swedish) | C | Opus 5.5 | calls the services "behandlingar" |
| 7. Car log | B | Sonnet 4.6 | all similar; Sonnet's a bit more complete |
| 8. Wedding | B | Sonnet 4.6 | correct and the most complete |
| 9. Bird sightings | none | | Sonnet's has a landing page and data; Opus's has species as well as sightings |
| 10. Allotments | none | | Opus's is the most complete and filters by member, but a plot marked vacant has a tenant |

**Tally:** Sonnet 4.6 3 (2, 7, 8), Opus 5.5 3 (3, 4, 6), Haiku 4.5 0, no preference 4. Sonnet through AWS in the EU matches Opus on Johan's picks, and Haiku is never the one he would start from. With round 1 (Opus 5 of 10 against gpt-6.1-sol and Mistral Medium), this agrees with the bench: Sonnet and Opus build the most, and Haiku builds thin.

What he saw that is not about the model (sent on, 2026-10-04): the same hero on all three yoga apps (variety among equally good matches), closed apps opening on sign-in where showing the content first fits (the tool library), a long app name in the header, a landing button to a page that needs sign-in, and sample data that contradicts itself (a vacant plot with a tenant).

Tonight's daily Mistral run, on the same main as the other two, will give Mistral's averages on today's prompt, and Mistral Large becomes another column.
