# Sample users who act: an app seen in use (design)

Status: draft for Johan, 2026-10-27 (Fable), on his go the same day ("design the sample users"); two second reviewers' points taken the same evening (the door's secret and its read path, expected refusals apart from findings, what a replay needs, numbers for the caps). Johan's idea (about 16:55): virtual users of an app, created through the admin side or through Smith, with a chosen role, driven by a model such as Haiku; one can follow them or just watch things happen, and get the mails a booking causes. Builds on the sample data (`samples/<Model>.yml`, [spec/v0.1.md](../spec/v0.1.md)), the development sign-in and the outbox ([email-sign-in.md](email-sign-in.md), [users.md](users.md) §Development), the demo build ([showcase.md](showcase.md)), Activity, [smith-first.md](smith-first.md) and the random tests (backlog item Fable 70).

## 1. What it is

An app's sample data stands still. Sample users move it: a few people with a role and a persona ("a regular who books on Tuesdays and sometimes cancels", "a new customer who asks before ordering") who use the app as a signed-in person would, at a walking pace, through the app's own doors. The builder watches the app live in the preview: records appear and change, Activity fills, mails land in the outbox. A refusal the app gives one of them is a line in the feed when it is the app doing its job (the session was full), and a finding when it is not (§3).

The word is **sample users** in every text (the people of the sample data, now acting); "virtual" and "bot" are not words the app's people need.

## 2. Where they run

- **Studio's preview first**: the development build, where the development sign-in and the outbox already are. The hosted first-build preview is the same build, so it works there too, within the project's allowance.
- **A demo build** later (showcase.md: a production build with `DEMO_SIGN_IN=1`, the data reset every hour): a demo with people moving in it is the showcase, with the same caps and the door's secret (§4).
- **Never a plain production app**: the door the runner uses (§4) is generated only into a development build or a build with the demo flag, as the development sign-in is, and nothing in the app itself calls a model.

## 3. Deterministic before AI: the moves come from the spec

What a sample user may do is read from the spec and the auth file by rule, in core, with no model: for a role (or a visitor), the pages it may open, the models it may add or change and with which fields, the actions it may run and their `when`, what it may delete, and the public pages. Each is a **move shape** with its slots: `add Booking { session, places }`, `run confirm on a Booking`, `open /sessions`, `change an Order { note }`. The values a move needs come from the same rules the sample data uses (`samples.ts`: a date near today, an amount in range, a choice among the field's values, a reference to an existing record), so a move is one the spec allows; whether the data allows it now (a session full, a unique value taken, another sample user first) is the app's answer.

Core gives the shapes; the app's own data fills them (§4's read path): which records the user may see, which actions' `when` fits now. The list of moves is the only thing the model may choose from. Without a model the runner walks the list at random from a seed: that walk is the random test of backlog item Fable 70 at speed.

**Expected refusals and findings.** A refusal the rules foresee (validation of a value, an action's `when` no longer fitting, capacity, a unique value, a race with another sample user: the state changed between the list and the move) is a feed line in the app's own words. A finding is a crash, a server error, or a refusal of a move the list said was open while nothing changed in between; a finding keeps its seed and the moves before it, and fails the weekly run.

**Replay.** A failing seed reproduces only with the rest fixed: the samples seeded afresh, the moves serialized (one at a time per project, each turn's list read just before its move), the model out (the random walk), and the clock: the development build takes a clock offset through the door (§4), so "a week later" is a call, timers fire, and "books on Tuesdays" happens in minutes rather than days.

## 4. The model's part, and the door into the app

- **The host runs the loop**, never the app: the daemon behind Studio (and `smithable preview --live` from the command line) has the model settings (`docs/ai.md`: the Smithable model, or the configured one) and the rules. For each turn of a sample user it gives the model the persona, the app's summary in words, the user's own recent moves and the list of moves open to it now, and asks for one move with its text values and one line of why ("Books Tuesday's yoga again"), as JSON. Haiku is enough: the choice is among a list, and the text is a name, a note or a message. A persona is data in the prompt, never an instruction: it is quoted as the person's description. The answer must name a move by its id from the list, with values for its slots only; anything else is dropped, logged in the feed as the model's miss, and the turn is forfeited (no retry loop: the next turn reads a fresh list).
- **The app has one door, with two sides**, generated only into a development build or a demo build: `GET /_dev/moves?user=<id>` gives the moves open to that user now (the shapes from core, instantiated by the adapter's generated code against the data: the records the user may see, the actions whose `when` fits), and `POST /_dev/act { user, move, values }` performs one as that user's session, through the same server functions the pages call, so grants, ownership, validation, Activity, outgoing mail and timers hold exactly as for a person at the keyboard. `user` is a sample user's id or `visitor` (no session: the public pages and forms); the door refuses any other user, an administrator included, unless the builder made a sample user an admin. A third call, `POST /_dev/clock { offset }`, shifts the development build's "now" for the replay and for personas that live by the week; it exists in the development build only, not in a demo.
- **The door's secret**: the host generates a secret when it starts the preview and hands it to the app in its environment (`SMITHABLE_DEV_DOOR`); the door refuses a call without it. A demo build gets its secret as a setting beside the demo flag. So a hosted preview or a public demo has no open door to act as anyone.
- **Pace**: a move a minute for each sample user by default, so the preview reads like life, not a flood; "step" for one move now; "fast" for the random walk without a model. Caps: at most five sample users acting at once, 300 moves an hour per project, a stop after 60 minutes without anyone touching Studio (and `--live` takes a duration, an hour unless said), and on the hosted service the moves count in the project's AI allowance. The builder acting alongside (§6) is a person like any other: the runner's moves are serialized among themselves, not with the builder's, and a collision is an expected refusal.

## 5. Who they are

- **Made in Studio or by Smith**: "Add sample users" picks a role and a number, with a persona each (suggested from the spec: the role's name and what it may do, in a sentence; editable); or one tells Smith "add three customers who book over the week", and Smith's reader maps it to the same operation.
- **A project file**, `samples/people.yml`: name, role, persona, pace; kept with the samples, versioned, the starters shipping two or three each (the booking starter: a regular, a newcomer, the receptionist). The operations `addSampleUser <name> --role <role> [--persona …]` and `removeSampleUser <name>` write it. The app seeds them as development users (users.md: the same hook, addresses `<name>@sample.example`), so they exist in the development database only; the users page of a development build marks them from that list, and no column or flag reaches a production schema.
- **Gone with the sample data**: the development database is the sample data, never published or exported (the rule the samples already have), and "Remove sample data" resets it to the seed, sample users and all they did included. A sample user acts on sample records and on records the builder made in the same database alike: both are samples of the same preview, and the reset takes both; nothing a sample user does is ever in a published app.

## 6. Watching, following, the mail

- **A People panel in Studio** (or a part of Smith's panel): the sample users with a line each of what they last did, a feed of moves in words with the app's answer ("Refused: the session is full"), pause, step and pace, and a count of moves and cost for the session.
- **Follow** opens the preview signed in as that user (the development sign-in, pointed at one user rather than a role), so the builder sees the app as they see it, and may act alongside.
- **The mail** they cause lands in the development outbox, shown in Studio's Mail view: the confirmation to the sample customer, the notice to the admin. A mail to a sample user never leaves the outbox. The owner's own copies (the admin's mails) can be sent on to the builder's verified address from the hosted preview when they switch that on, so Johan gets the booking mails he asked for; off by default, limited on its own (a few an hour), and never for a mail addressed to a sample user.
- **Smith-first**: after the presentation, Smith offers "Want to see it in use? I can add a few people who use the app for a while." A sample user's refusal is a thing Smith can explain ("Maria could not book: the session was full; that is the capacity rule").

## 7. Safety and cost

- No plain production build has the door; a demo build has it behind the demo flag and the secret, with the caps and the hourly reset.
- The model chooses from a list and fills text slots; it reaches no route, no SQL, no tool beyond the move. Its text values go through the app's validation as typed input does.
- A sample user acts under its own grants and is never admin unless the builder made it one; the door acts for sample users and the visitor only.
- Real mail: none; the outbox only, with the one opt-in of §6 for the builder's own copies.
- Cost: a turn is one small model call (the list and the persona, a few hundred tokens out of a cached prompt); at the default pace a session of an hour with three sample users is some two hundred calls, cents on Haiku. The caps of §4 keep a forgotten preview from running all night.

## 8. Steps

1. **Core (Fable):** `movesFor(ir, auth, content, role | "visitor")` with the shapes, their slots and the sample-value rules; the seeded random walk over a list; `samples/people.yml` read and checked (`addSampleUser`, `removeSampleUser`); the moves' words for the feed.
2. **Adapter and kit (A, core parts reviewed):** sample users seeded as development users and marked on the users page; the door's three calls in development builds (two in a demo) with the secret, the moves instantiated against the data, a move performed as a session; the test-apps flow walking twenty random moves on the booking starter without a model, with the clock shifted a week.
3. **Host and Studio (A):** the runner in the daemon with the model or the random walk, the serialization, pace and caps, the People panel, Follow, the outbox view's part; Smith's phrases ("add three customers…", "let them run", "stop").
4. **Hosted preview and demo (B):** the allowance, the demo build's flag and secret, the opt-in copies of the admin's mail to a verified address with their own limit.
5. **Backlog item Fable 70 joins:** the weekly random run uses the walk of step 1 over every starter, with the replay rules of §3 and the failing seed kept.

## 9. Undecided

- Whether personas belong in the project file (designed: yes, so a starter ships its people and a project keeps them) or only in the session.
- Whether a sample user may also talk to Ask, the app's own assistant (a person asking the app a question is a move too); designed: not in the first step.
- The panel's place: its own People panel, or a tab of Smith's.
