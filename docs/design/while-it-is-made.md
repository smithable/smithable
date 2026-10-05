# While the app is being made: Studio at once, questions and changes during the wait

Status: live on the beta, 2026-10-05, both stages (engine #367 and #369, Studio's page #368 and
#372, the service's cloud #118 and #119). For a described app through a waiting workspace,
"Build it" to Studio on screen is 0.5 to 3 s (about 30 s on a "Starting" page before); the app
is in place at about 30 s and the preview answers 2 to 3 s later, as before, since the model's
draft is the wait. Not built: answering while the draft already runs (§8) and §7. Without a
waiting workspace (a cold start) the service's own questions page stays. Designed 2026-10-05 by
Fable on Johan's ideas of the same day; he said to start it the same evening.

## 1. The wait today

A described app on the beta, B's run of 2026-10-05 with a real draft:

| | seconds from "Build it" |
|---|---|
| The questions call (`clarify`: picks the starter, asks up to three questions) | 0 to 5 |
| The person reads and answers | as long as they take |
| The draft: one call to the model, which answers with the whole app as a list of operations | about 22 of the replace request's 24.5 |
| Operations applied, files generated, the first migration, the app brought in | about 2 |
| The preview answers | about 2 after that |

The person looks at the service's "Starting" page for all of it: about 30 s when they answer
at once. Nothing is shown of what is being made, and their own time and the model's are added
together.

## 2. What the person gets

1. **Studio at once.** "Build it" opens Studio in 2 to 3 s (a waiting workspace, as for a
   starter today), on a screen that says the app is being made.
2. **What is being made, in their words.** Their description, the stage ("Drafting", "Building
   it", "Starting the preview"), and a progress bar on the time a draft usually takes.
3. **The questions on that screen**, while the draft already runs, not before it.
4. **The words box open from the start.** What they type is kept and made, in order, when the
   app is in place.
5. **"What it does" as soon as the model has answered**: the plain-language outline of the
   drafted app, a few seconds before the preview shows it.
6. Later (§7): the parts appearing one by one as the model writes them, and an animation.

## 3. The screen, moment by moment

| When | The screen shows |
|---|---|
| 0 s | "Your app is being made", the description, the bar starting, the words box. Questions the description leaves open that can be read without a model (who uses it, what visitors see) |
| about 5 s | The model's own questions, if it has any more, added below |
| while drafting | The bar moves on the usual time and slows towards the end rather than stopping; answers and typed changes are taken |
| the model has answered | "What it does" replaces the description; the stage is "Building it" |
| the app is in place | Builder as it is today, the preview loading; then what waited is made: the answers first, the typed changes after, each as its own line in the list of changes |

The bar is honest about being an estimate: it never reaches the end before the app is there, and
past the usual time it says "Taking a little longer than usual".

## 4. The questions, in Studio

Today `clarify` does two things in one call: it picks the starter that the draft uses as its
example, and it asks. Asked to (`ask: true`), Studio does this itself, from the description in
the replace request (it has the engine and the model's address), so the service's own questions
page goes and no container is started for it (B).

- **A starter's own description** leaves nothing open: no question, no model.
- **The reader that uses no model** (`read-description.ts`) names the kind of app when it is
  sure: 53 of the 70 test descriptions, never wrongly. That is the starter. It then asks only
  what it could not settle of who signs in and what visitors see; where it settled both, the
  draft starts at once with no question at all (about half of the descriptions).
- **Otherwise** the model picks the starter and asks, as `clarify` does today, about 5 s.
- **The answers go into the draft**, folded into the description as today. So the draft starts
  when the questions are answered or skipped, not before.

As first designed, the questions were to be answered while the draft already ran, and an answer
that is a setting made as an ordinary change afterwards. On a closer look that cannot be done
without guessing: in an app whose shape the model chose, "visitors may look" does not say which
pages and records to open. Answering in parallel therefore needs the model once more after the
draft, a round of corrections; that is the open decision in §8.

What it gives without that round: no question in about half the cases, questions on screen at
once (no 5 s call before them) in most of the rest, and all of it in Studio.

## 5. Changes typed during the wait

The words box takes requests while the app is being made. They are kept in Studio, shown as
"Waiting: …" under the box, and can be taken back. When the app is in place they run in the
order typed, through the same path as any request (the wording rules first, then the model), and
each becomes a change that can be undone. A request that no longer fits the drafted app is
refused in the usual words; nothing is lost but that request.

Not in this: editing the "What it does" text itself. That text is made from the app, and
turning free edits of it back into changes exists only for the starters' own descriptions
(`readEdit`). With §7's parts appearing one by one, each part can get its own "not this" and
"rename", which is the direct editing that fits.

## 6. How it is built

**Engine (Fable).**
- `replaceProject` and `smithable new` report where they are (drafting, drafted with the
  draft's files, building, in place) to a function they are given.
- `POST /api/project/replace` with `describe` answers at once ("accepted"); the work goes on in
  Studio. `GET /api/project` carries `making`: the description, the stage, when it started, the
  usual time, the questions, and from "drafted" on the draft's files, from which the page makes
  "What it does" as Builder does for any app. Each change of stage is also an event to the
  open pages.
- `POST /api/making/answer` takes the answers, in the questions' order, and the draft starts.
  `POST /api/waiting` keeps what the person types meanwhile (and takes one back); it is in
  `GET /api/project` as `waiting` until the page has made it, through the existing request
  path, once the app is in place.
- The reader's verdict and questions become part of what `clarify --json` answers, so the
  service and the command line use one thing.
- A failure is said on the same screen: a description the model cannot use brings the starter
  in with the notice (as today); a replace that fails says so and offers "Try again".

**Studio's page (A).** The making screen: description, stage, bar, questions with their
suggested answers, the waiting requests, then "What it does"; the hand-over to Builder when
the app is in place. A slot for the animation. From A's reading (2026-10-05):
- The waiting answers and requests live in Studio's server, in `making`, not in the page: a
  reload, a second tab or a phone shows the same "Waiting: …" list, and taking one back is a
  request to the server too.
- While the app is being made, Undo, Redo, Look, Change and Select have nothing to act on.
  They are shown, switched off, with a short reason, so the layout does not move at the
  hand-over.
- `making.files` has the shape of the files in `GET /api/project`: the page already turns
  those into the summary in the browser.
- The bar ends when the stage is "in place", not when the preview answers; from there the
  preview panel says "Starting…" as it does today. Otherwise the bar would stand full for the
  preview's two seconds.

**The service (B).** A described app's claim sends the replace with the description and lets
the person into Studio at once; the questions step on the service's own page goes, since Studio
reads the description and asks. From B's reading (2026-10-05):
- "Accepted" is not "in place": the claim no longer learns whether the draft worked, so a
  failed draft is Studio's to say and to offer again, and the service's own fallback for a
  failed replace (the workspace made again from nothing) no longer runs for it.
- The usual time: the service cannot time the replace any more. The gateway records when a
  call was made, not how long it took; it gets the duration, and the service passes the median
  of its last twenty or so drafts.
- A demo guest may have two model calls running at once: the draft and `clarify` fit, a typed
  request waits until the app is in place anyway, and the allowance holds a draft, `clarify`
  and a correction.

**Checks.** `test-studio`: a replaceable Studio given a description answers at once and shows
`making`; asked to, it asks nothing for a starter's own description and one question, without
a model, for a description that leaves one thing open; the answer reaches the draft; what is
typed meanwhile waits and can be taken back.

**Size.** About two days across the three: engine one, the page half to one, the service a few
hours. The correction round is the least certain part.

## 7. Later

- **The parts as they are written.** The model's answer can be read while it arrives; each
  operation that is complete is applied to the draft and "What it does" grows: customers, then
  their bikes, then repair jobs with a status and a price. It needs streaming in the engine's
  model layer and through the service's gateway (neither does it today; providers differ), and
  a reader of unfinished JSON. A few days on each side: the gateway reads answers whole today,
  and would translate Bedrock's and Mistral's streams to one, count the cost from the usage
  that arrives at the end, and release the reservation when a stream is dropped (B). It is what
  makes the wait a review.
- **The animation.** The making screen has a place for it: a looped picture to start with,
  later perhaps an interactive scene (a sledge on an anvil). It is Studio's page only, and must
  not slow the page on a small machine or a phone: loaded after the screen is up, stopped when
  the app is in place, still when the person has asked their system for less motion.

## 8. Decided, and open

Decided 2026-10-05 on Fable's advice, Johan having said to start: two stages; the questions
always in Studio; no `clarify` call when the reader is sure of the kind of app.

Open: answering while the draft already runs. It needs one more call to the model after the
draft for people whose answers differ from what was assumed (§4). Built first is the version
without it; this would be added on top.
