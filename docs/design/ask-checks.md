# Ask answers only what a tool said (design)

Status: 2026-10-14, Fable, on Johan's wish after the cascade bench (bench-ask-cascade.md): raise
Ask's accuracy through the tools and the gateway, so the EU-only path, where a small model
answers, gets safer. The bench's rule stands: a confident wrong answer counts as wrong, and the
small model's wrong answers are almost all of that kind (13 of 15 stated as fact). This note is
two layers, both without a model: tools that answer better, and a check of the answer against
what the tools said. A build for A (the engine), B (the gateway), measured by C.

## 1. What goes wrong today, in the bench's own cases

| Kind | Cases | What the model saw |
|---|---|---|
| **A filter value no record has**, answered as "none" | six: status "unpaid", country "Finland" written where the field holds a city, "has a link", "Website down" as a title | `{ total: 0 }`, nothing about why |
| **"Done" with no write** | two: a rename and a bio change | no `change` call at all; the model answered from the question |
| **A count worked out by hand** | three: sessions per class, 14 for 13, a tie given as one winner | rows it added up itself, or a `by` result with two equal tops |
| **A record without its lines** | one: an invoice's content | `read` gives the record's own fields, not its lists |
| unclear | three | |

Johan's four steps (the model must use tools; a tool says what it can do and needs; the call is
checked; a tool checks the answer is reasonable): the first three exist (the summary, the tool
schemas, the app's refusals). The fourth is the new thing, and the small model is the wrong one
to do it: a model that is confidently wrong does not call a checker, and checks itself poorly.
So the check is the app's, after the answer, without a model.

## 2. Layer one: tools that leave no room

- **A zero result says why.** A `find` or `measure` whose `where` names a value no record has
  answers `{ total: 0, note }`: for a choice field, the values that exist ("no invoice has status
  unpaid; the statuses are draft, sent, paid, overdue"); for a reference by title, the nearest
  titles; for a `search` with nothing, the nearest titles by the same closeness `didYouMean`
  uses. The model then asks again with a value that exists, or says truthfully that the question
  named something the app does not have.
- **A grouped measure says its ties.** `measure … by <field>` returns the groups sorted, and
  a `note` when the top is shared ("Kallio Design and Skerry Software both have 2"). A `measure`
  over a `where` the model would otherwise add up by hand (sessions per class) is the same call.
- **`read` includes the record's lists**, twenty rows each at most, as the record page shows
  them: an invoice comes with its lines, a case with its messages.
- **A write answers with the record as it is now**, so "done" has something to be about; a
  refusal is a refusal, in the app's words, as today.

The summary line the tools get says the one rule in one sentence: "Answer with what a tool
returned; a number, a name or 'none' you did not get from a tool is not an answer."

## 3. Layer two: the answer checked against the tools

After the model's final text, the kit's loop (`assistant.server.ts`, which ran every tool and
holds every result) checks it, without a model:

| Check | Not grounded when |
|---|---|
| **none** | the answer says none, no such, nothing or an equivalent in the app's language, and no call returned `total: 0`, or the one that did carried a `note` (the value did not exist) |
| **done** | the answer says a change was made (done, marked, added, changed, renamed; the app's words), and no `add`, `change` or `run` call succeeded |
| **number** | a number in the answer (money, counts, minutes; not an id, a date or a year) appears in no tool result, as the result's number or its sum |
| **read** | the answer states something about records and no reading tool was called |

The words are the kit's (`words/<language>.ts`), so the checks hold in Swedish too.

When an answer is not grounded:

1. **One retry,** the same model, with one system line saying what failed ("You answered 'no
   unpaid invoices', but no tool returned an empty result; the note says the statuses are …").
2. **Then the better model,** where there is one: the kit marks the call (`X-Smithable-Ask:
   ungrounded`), and the gateway's cascade (B 35) escalates on it, which gives the cascade the
   signal it lacks today: it escalates on refused calls and on the fourth call, never on a
   confident wrong answer.
3. **Without a better model** (self-hosted with one model, EU-only with Small alone): the
   answer is given with its tool results shown and a line that it could not be confirmed,
   never as a fact.

Each check is a few lines; the "number" one is the largest (numbers out of the text and the
results, the same normalisation for both). A grounded answer costs nothing more than today; an
ungrounded one costs one more model call.

## 4. What it does not do

- It does not judge a right answer wrong: an answer whose numbers and names all come from tools
  passes, whatever it says about them. It is a floor, not a judge.
- It does not read the records itself: a check that re-runs the question is the better model's
  job, which the cascade now gets to.
- It does not change the API or `/mcp`: an outside assistant gets the better tools (§2) and does
  its own checking.

## 5. Steps and measurement

1. **C, before anything merges:** bench-ask on Mistral Small alone and the cascade, the stored
   questions, as the baseline (bench-ask-cascade.md's numbers, re-run on the day). A and B tell
   C before a step merges, and C runs again after each.
2. **A, the tools (§2):** the zero-result note, the ties, `read` with lists, the write's answer,
   the summary's sentence. Engine, one PR.
3. **A, the checks (§3):** in the kit's loop, with the retry and the mark; a test-apps step
   with a stand-in model that answers "done" without a call and is caught. One PR.
4. **B, the gateway:** the cascade escalates on the mark; the usage count shows how often.
5. **C, after each:** the same bench; the number to watch is "stated as fact", then "right",
   then cost per question. If the checks catch fewer than half of the confident wrong answers
   on the stored questions, the rules are widened before the question of a default model is
   reopened.
