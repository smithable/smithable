# Ask learns the app's words (design)

Status: draft for Johan, 2026-10-28 (Fable). Johan's go the same day for the three steps of backlog item Fable 79. Step 1 is built (a choice field's short `description` in Ask's summary, PR #881); this note is steps 2 and 3. A second reviewer's fourteen points taken the same day.

Built so far (2026-10-29, Fable): step 1 (the summary line, #881 with Fable 78); step 2's core parts (`setMeaning`, the rule-only pre-pass `wordsAtRisk`, #884); step 3's core part, `validateAsk` for `samples/ask.yml` (§4): the file's shape, and a kind, field, choice value or role no longer in the spec as a warning naming the line, every question kept as written so the host can say what it finds now; `smithable validate` reads it with the samples. Not built: the meaning-text check for a value that no longer exists, since by rule a quoted word in a description ("down" means any status but operational) is the text's point, not a stale value; a rename's `change-field` effect with its `renamed` map is the place to rewrite meaning texts, as a follow, when it comes. The door's ask side is in A's door (#888); the pass and the proposals (daemon and Studio) follow the runner (#896), A's.

## 1. The problem

Ask answers from the records through the tools, and the grounding check (ask-checks.md) passes any answer that fits what the tools returned. What neither can see is a question read one of two ways because a word means two things in one app: "Is anything down?" when `down` is a status value and a degraded component is not `down`; "our newest post" when posts have a published date and a created one. C's bench of 2026-10-27 (haiku-wrapped.md, three runs of 134 questions) shows one to five such answers a run, stated as facts. Fable 78 makes them visible: the panel says what was asked, and how the records split when a filter found none. This note makes them rarer, per app, before anyone asks.

## 2. Where the words live: the spec's own meaning text

The spec already has a place for meaning: `description` (and `intent`, `rules`) on the app, a model, a field, an action or a page, free text for AI and developers, never shown to visitors, read by the `describe` tool. A field's `description` is the glossary, and it settles which reading the app wants:

```yaml
status:
  type: operational | degraded | down | maintenance
  description: In a question, "down" or "not working" means any status but operational; the value down alone is unreachable.
```

Step 1 puts a short one (120 characters at most) in the summary's line, so the model reads the words before it filters; a longer one stays behind `describe`. Nothing new in the spec, no copy in the content file (meaning is not visible text), nothing generated: Studio shows and edits it where the field is. This keeps the principle of Fable 74: words in the spec, records as data.

**One operation is missing.** No operation sets meaning text today (`changeField` takes a type and rules, not a description). Step 2 adds `setMeaning <concept> [--description …] [--intent …]`, where the concept is `app`, a `Model`, a `Model.field`, an action's name or a page's: every place the spec's semantic text may sit. An empty value removes the key. `rules` stay where they are set today (`setFieldRules` for a field's, the model's and action's rules by their own operations), since a rule is a sentence something implements, not a meaning. It is a plain spec edit through the operation layer (rule 2), undoable like every change, in What it does as "Explained what *status* means to the assistant".

## 3. Step 2: Smith's question pass

Run by the host (the daemon behind Studio, or `smithable ask-check` from the command line), never by the app, when the preview is running. "Smith" is the chat in Studio and its model: the better one configured, Sonnet alone or the Haiku-then-Sonnet pair of the cascade (ask-checks.md §3).

0. **The rule-only pre-pass, before any model call.** From the spec alone: choice fields whose values are everyday words (`down`, `open`, `closed`, `new`, `done`, `active`: a short list in core, as the wording rules have) or overlap each other in meaning, kinds with more than one date or number field, and those of them that have no `description`. These are the fields at risk; Smith's questions target them first, and an app with none of them gets a shorter pass.
1. **Questions.** Smith gets, per role the assistant serves, the role's summary (the same text Ask's prompt carries), the first few sample records of each kind as the API shows them, the choice fields' values with their labels, and the fields at risk. It writes about twenty questions a person with that role would ask, each with the shape of the answer it expects: the kind, the `where` or `measure` it has in mind, and whether a count, names or a number is the answer. For a field at risk it writes the question both ways on purpose ("Is anything down?" expecting any status but operational, and "Which components have the status down?" expecting that value). The shape is data for the check, never shown to anyone as a fact.
2. **Answers.** Each question goes to the app through the development door of sample-users.md §4 (the door the host uses to make sample users act, with a secret in the development build's environment), on one more side: `POST /_dev/ask { user, question }` answers as that sample user's session with the kit's `answer()`, the same code the panel runs, with the app's model (Haiku as a rule). `user` is a sample user (samples/people.yml) of the role, or `visitor`; a role without a sample user gets a session the door makes for the pass and forgets with the process, nothing written anywhere. The door's secret and the development-build-only rule hold as for moves, and the example apps' check asserts that a production build answers 404 on every `/_dev/` path: a test of the door's absence, never of Ask's answers.
3. **The check, by rule.** The answer's steps carry what was asked (Fable 78: the tool, its arguments, the records' split). The host compares the asked `where`, sort and measure field with the expected shape, and a difference is a candidate: a choice value or set other than expected, another field sorted or measured by, `none` where records were expected. Nothing else is: an answer marked not confirmed names no field, so it goes in the pass's report as a line, not a proposal. **This is two readings, not a verdict**: the shape is a model's reading too, and when the two differ nothing says which model misread. So a candidate is shown as the question with its two readings in words (the asked line, and the expected shape in the same words), and the field whose meaning decides between them.
4. **The proposal.** For each field with a candidate, Smith drafts one `description` of 120 characters at most (so it reaches the summary's line; a longer draft is cut to the first sentence with a warning), in the app's language, from the field's values, its label and the two readings, and shows it in Studio's Smith chat as a change to accept: "*status*: two readings of 'Is anything down?'. Explain it to the assistant: 'In a question, down means any status but operational'", with both readings under it. The owner edits the words, picks the other reading, or rejects; accepting applies `setMeaning`, never the pass itself.

**When.** At the first build, once the first preview is up, so the first conversation with Ask already knows the app's words; at a publish, and on "Check Ask's words" in Studio, when the spec's words changed since the last pass: the set of kinds, fields, choice values, labels and meaning texts, hashed and kept with the last pass's result in the project's `.smithable/` folder. A change that leaves the words as they are (a page, a theme, a rule) runs no pass. Cost: a Sonnet call for the questions and one for the descriptions, and twenty Haiku questions per role, a few cents in all, within the project's AI allowance.

**What it is not.** Not a test that blocks: the bench moves a setup by up to three questions between identical runs, so a pass that failed a build would fail it at random. Not a second glossary: the result is spec text the owner accepted. Not a model judging a model: the comparison is of arguments to shapes, by rule, and where the readings differ the owner decides; the models write questions and sentences only.

## 4. Step 3: the app's own Ask check

The questions and their expected shapes are kept as data beside the samples, `samples/ask.yml` (a list of `{ role, question, expects: { kind, where | measure, answer: count | names | number } }`), written by the pass and editable by hand, like the bench's own set but per app. It is validated like the sample files: a kind, field or choice value it names that is no longer in the spec is a warning naming the line, so a rename leaves nothing silently broken; the same check reads every meaning text for a choice value that no longer exists ("down" after it became "outage") and says so. The re-run follows the same words hash as step 2, or "Check Ask's words" on demand: Smith sends the questions through the door and compares the asked arguments, which are stable, never the answers' text, and tells the owner which asked lines changed since the last run: "Since *down* became *outage*, 'Is anything down?' finds nothing; its expectation still says down". A report in Studio and `smithable ask-check --report`, never a gate; the weekly run of Fable 70 includes the report as a line of its own, at the same cost as a pass. Gone with the sample data, never published, like `people.yml`.

## 5. Later, if real questions are wanted

A question's text is by design not stored (assistant.md, "what is logged"), so the pass stands on invented questions. If an owner wants the real ones, a per-app opt-in could keep a week's questions (the text, the role, whether the answer was confirmed) for the pass to read as its first source; a privacy decision for the owner to make in the auth file's assistant block, not a default, and not part of these steps.

## 6. Cost and order

| Step | Builds | Costs per run |
|---|---|---|
| 1 (built) | the summary line (core) | nothing |
| 2 | the rule-only pre-pass and `setMeaning` (core); the door's ask side and the production-build check (adapter, with the door of sample-users step 2, A's); the pass and the proposals (daemon and Studio, with the runner of sample-users step 3, A's) | two Sonnet calls and about twenty Haiku questions per role |
| 3 | `samples/ask.yml` and its validation, the re-run and the report, the weekly run's line | twenty Haiku questions per role per run (a changed words hash, on demand, or weekly) |

Step 2's core parts (the pre-pass, `setMeaning`) can be built now; the door's ask side goes with A's door, so the two share one secret and one development-only rule; the pass follows the runner.
