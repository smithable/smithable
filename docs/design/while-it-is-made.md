# While the app is being made: Studio at once, questions and changes during the wait

Status: design only, 2026-10-05, by Fable on Johan's ideas of the same day. **Not to be built
yet**: Johan tests Studio first and more feedback comes before this. Builds on
`first-build.md` (the questions step) and `fast-start.md` (a waiting workspace gets its app
under the running preview).

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

## 4. Questions during the draft

Today `clarify` does two things in one call: it picks the starter that the draft uses as its
example, and it asks. To start the draft at 0 s the starter must be known without that call.

- **The starter:** the reader that uses no model (`read-description.ts`) names the kind of app
  when it is sure. When it is, the draft starts at once on that starter. When it is not, the
  `clarify` call comes first, as today, and the draft starts 5 s later. No worse than today in
  either case. Studio does both itself, from the description in the replace request (it has
  the engine and the model's address): the service does not ask `clarify` first, which would
  cost it a container of its own for 2 to 3 s even when no model is needed (B).
- **The questions** come from two places: the reader's own, at once (it knows what it could
  not settle: who uses the app, what visitors see), and `clarify`'s, when that call has
  answered. At most three in all, as today; the reader's first.
- **The answers** cannot reach a call that is already running. So:
  - an answer that is a setting is made as an ordinary change when the app is in place, with no
    model: who may sign up, whether the app is shared or each person's own, which pages and
    records visitors see. The reader's questions are all of this kind.
  - any other answer goes to the model once, after the draft, as one round of corrections
    ("the person also said: …"), the way a draft's flaws go back today. One more call, smaller
    than a draft, only for people who gave such an answer.
- **Not answering** is fine at every point: the draft is what it is, as with `--yes`.

What it does to the time, with a person who takes 15 s to answer:

| | today | with this |
|---|---|---|
| answers are settings | 5 + 15 + 25 + 4 = about 49 s | about 29 s |
| an answer needs the model | about 49 s | about 29 s, then a correction of about 8 s that shows as a change |
| skips the questions | about 34 s | about 29 s |

Cost: the `clarify` call as today (or none, when the reader is sure and has no question of the
model's to wait for: to decide, §8), and the correction round for some.

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
- `POST /api/making/answer` and `/api/making/request` take answers and typed changes (and
  take one back); Studio's server keeps them and makes them when the app is in place: settings as operations, the rest as the
  one correction round (a new `adjust` beside the draft, given the applied operations and the
  answers), typed changes through the existing request path.
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
`making`; an answer that is a setting and a typed change are both made when the stand-in
model's draft is in place, in that order; without a model the starter comes in and the screen
says why. A unit test for each of the reader's questions and the operation its answers become.

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

## 8. For Johan to decide when it is taken up

1. All of §2's 1 to 5, or first only Studio at once with the bar and "What it does" (1, 2, 5:
   about a day, and no change to the questions)?
2. Questions always on the making screen, or still in front when the reader is not sure of the
   starter (§4 proposes the second: never slower than today)?
3. The correction round costs one more model call for some first builds. Accept that, or keep
   only the questions whose answers are settings (free) on the making screen?
4. When the reader is sure and has its own questions, is the model's `clarify` call still
   wanted for better questions, or dropped to save its cost and 5 s?
