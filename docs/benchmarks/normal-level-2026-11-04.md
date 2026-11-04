# Normal level: Claude Sonnet 4.6 and Haiku 4.5 against Mistral Medium (2026-11-04)

The same prompts and requests on current main, through Amazon Bedrock's EU profiles (eu-north-1) and Mistral's API, one run per model, with no response cache. One run is a small sample: a difference of one or two answers is not a finding.

| | Claude | Mistral Medium |
|---|---|---|
| First builds, 12 descriptions (Sonnet 4.6) | 12 created, 12 type-check | 12 created, 10 type-check |
| Builder changes, 12 requests (Sonnet 4.6) | 9 right, 2 wrong, 1 no change | 7 right, 5 wrong |
| Changes that leave an app failing its type-check | 1 of 12 | 1 of 12 |
| Ask, 70 questions (Haiku 4.5) | 69 right, 1 wrong | 64 right, 4 wrong, 2 gave up |
| Ask, wrong answers stated as fact | 0 | 4 |
| Cost per first build | $0.12 with Bedrock's prompt cache, about $0.33 without | $0.08 |
| Cost per Builder change | $0.135 with the prompt cache, about $0.22 without | $0.049 |
| Cost per question | $0.0073 | $0.0074 |
| Time: first builds, Builder changes, per question | 718 s, 57 s, 3.7 s | 589 s, 217 s, 2.3 s |

## Where this is not like for like

- **The prompt cache.** First builds and Builder changes on Bedrock use its prompt cache; Mistral is priced at full input. The bench's calls come one after another, so the cache hits nearly every time, more often than sparse hosted traffic would. The figures without it are worked out from the tokens at full input, the first exactly, the second approximately because its report does not split tokens in and out. Real use falls between the two.
- **Ask** has no prompt cache on either side, so its costs compare directly. Haiku 4.5 would cost less with one.
- **The questions.** Ask ran 70 of its 134 questions, on three of the six starters (crm, status, marketplace), to keep the run small. The pair of Mistral Small then Medium did not run.

## What the wrong changes did

Mistral Medium:

- *Only our team posts incidents; everyone else just reads them* became a new `team` role, the default for new users, which opens the components and team pages that were the administrators'. The `staff` role lost its page list. Nothing became public, but access inside the app widened.
- *Every order should belong to the salesperson who handles it* also set the whole app's access to private, so colleagues no longer see each other's records.
- *Only admins should see orders over 10 000 €* has no right change, and it locked the order's total instead. The generated code then fails its type-check.
- *Nobody should be able to delete an invoice once it has been sent* locked the invoice's status instead. Sonnet 4.6 did the same.
- *Put orders first in the menu and call them Sales* renamed the page and its address instead of the label.

Sonnet 4.6:

- The sent-invoice request above.
- *Every order should belong to the salesperson*: it added the field and the owner, without the write rule.
- *Rooms as a choice* ended in no change: the choice value it tried was refused on each try.
- *First and last name* was right in the spec, but renaming `name` left the starter's own test in `src/custom/` failing its type-check.

## Faults that are not the model's

Three of the four type-check failures come from Smithable, on specs that pass `validate`:

- Mistral's booking draft: `timers.server.ts` imports `#/kit/filter`, which that app does not have.
- Mistral's invoicing draft: `dev-door.server.ts` declares `pageAccess` and never reads it.
- `by: app` on a required field: `order.server.ts` does not compile.

The fourth is the rename above, which does not follow custom code. So the first builds' 12 against 10 says little about the models.

## What is public

No Builder change left a warning about what is public, on either model. One first build did, Mistral's job board: `public-page-closed-records`, a public page over records it cannot show.

## Reports

- [First builds, Sonnet 4.6](m12-first-builds-eu.anthropic.claude-sonnet-4-6.md)
- [First builds, Mistral Medium](m12-first-builds-mistral-medium-latest.md)
- [Builder changes](builder-changes-normal-level.md)
- [Ask](bench-ask-normal-level.md)
