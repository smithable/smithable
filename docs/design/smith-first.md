# Smith first: the assistant as the way into an app (design)

Status: draft for Johan, 2026-10-27 (Fable). From Johan's words of 2026-10-27, through the human assistant: Smith is to be the main way to get to know an app and to adjust it. Builds on [studio-v3.md](studio-v3.md) §2 (Smith as a chat, §8 the layout), [ask-in-studio.md](ask-in-studio.md) (the panel, the first-build questions in it), [first-build.md](first-build.md) §2 (the `clarify` call and the reader without a model), [while-it-is-made.md](while-it-is-made.md) (Studio at once, the stage), [studio-guide.md](studio-guide.md) (the tour) and [ask-flows.md](ask-flows.md) (Smith asking for the missing part of a change). The assistant is **Smith**, never "Agent Smith", in every text, file and picture (Johan, 2026-10-27).

## 1. What Johan asked

- Smith on the left by default: the main entry. He may need more model capability, and the harness around him needs sharpening to our needs as much as text to spec does.
- When an app is being started or built, go straight to Smith. He presents the app being built, simpler than Behavior's text: its name and what it does; which pages exist; which roles there are and what is public; what a visitor can do and what a signed-in user can do.
- If Haiku's first spec leaves open questions, Smith asks them while presenting the part they concern. Whether Sonnet should be asked, so that Smith suggests rather than only asks, is open.
- When the preview is ready it opens on the right. When the questions are done, Smith says he can make changes and answer anything about how the app works. Then Behavior shows, and the guide starts.
- The guide is part of Smith. Code and No code are no longer top-level choices but sub-tabs of a manual view, opened with the "show" arrow; nothing needs to say "manual". The guide no longer asks about code or no-code.
- The beta information and "Ask for an invite" leave the landing page; Smith covers them in his introduction at a fitting point (Johan, 09:3x).

## 2. The flow, moment by moment

1. **Start.** A new project (a description, a starter, a page's address, or the demo's sandbox) opens Studio on Smith: on a wide screen Smith left and the preview's place right, on a phone Smith alone. Nothing else is on the screen yet: no Behavior, no tabs to choose from. While the app is being made (the stage of while-it-is-made.md), Smith is already talking.
2. **The draft comes first, then the presentation.** Today a described app gets `clarify`'s questions before the draft; here the draft is made at once from the description, with its assumptions kept (§4), and Smith presents the drafted app part by part (§3). Each assumption is asked at the part it belongs to, with the draft's own answer already chosen, so the person sees something real within seconds and corrects it rather than filling a form first. A starter has no assumptions; its presentation has no questions.
3. **The preview appears on the right** when the app runs (the stage hands over, as today), and Smith says so in one line. From then on every answer to a question is a change the person watches land in the preview.
4. **The questions done**, Smith says what he can do now: make changes in the person's words, answer anything about how the app works, and explain Smithable from the docs. In the beta he says here what the beta is (§8).
5. **Then the manual view and the guide.** The "show" arrow at the preview's edge opens the manual view (No code and Code as its sub-tabs); Smith walks the places as the guide, in his own thread (§7). The guide's first card, "How do you want to work?", is gone: both ways are shown where they are, and nobody is asked to choose.

**Typing in the middle.** A line typed during the presentation or while a question waits is answered first, as any line to Smith (a question about the app, a change, small talk); the presentation pauses and goes on afterwards with "Shall I go on?" as a chip, or at once if the line was itself an answer to the open question (ask-flows.md's reading of a short line after a question). Nothing is lost: a skipped question stays in the ready prompts as "You left open: who signs in".

**What an answer does to the preview.** An answer is an operation like any change from Smith, so the preview takes it the way it takes every change today: the stage's "Updating…" over the last good page, one reload, the page the person was on. A change that reshapes the app (who signs in, what is public) is still one reload, since the operations are applied together as one change; nothing rebuilds from scratch.

The order is the one Johan gave: Smith, the preview, the offer to change and answer, the manual view, the guide. A returning person (a project already made, the guide done) opens on Smith with the preview beside him and no presentation; "What does this app do?" among his ready prompts gives the presentation again at any time.

## 3. The presentation: five parts, each from the spec

Every part is built by rule from the IR, the auth file and the content file, the way the plain-language summary already is (the summary in own words of first-build.md): no model writes a fact about the app, so nothing Smith says about it can be wrong. A model words a part only where the files hold no words for it (an app with no description), and then from the same facts. Each part is one message of Smith's, short, with the mascot's expression beside it; the parts come one after another with a short pause, and a tap or a key brings the next at once.

| Part | What it says | From | Questions that belong here | Expression |
|---|---|---|---|---|
| 1. The app | "This is *Stillwater Yoga*: a studio's site where visitors see the schedule and members book classes." | `app.name`, `app.description`, the landing page's lead | the app's name when the draft took it from a page title or made one up | happy |
| 2. The pages | "It has a home page for everyone, a schedule, the classes, a blog, and for the team: bookings, members, instructors, a planning calendar." Public pages first, then the signed-in ones, each with its kind in a word. | `pages`, `public` in the auth file | a page the description named that the draft left out; a page whose purpose the draft guessed | pointing |
| 3. The roles | "Two roles: members, who book; the team, who run the studio. Admins do everything." | `roles`, `signIn` | who signs in (nobody, invited people, anyone); the roles themselves when the draft invented one | pointing |
| 4. Visitors | "Anyone on the internet can see the schedule and the blog and send a message; booking needs an account." | `public` (pages, models, the contact form) | what visitors may see (every record kind the draft made public, asked once as a list to tick) | waiting |
| 5. Signed in | "A member can book a class, cancel a booking, read their own bookings. The team can add and change classes and sessions, see every booking, invite people." | the roles' grants, the actions' `when`, `ownedBy` | the records' main fields when the description was thin (what a booking holds) | proud |

Each part names what it stands for in Behavior's words (the same labels), so the manual view reads as the thing Smith just said. The parts are the content of the summary split by subject; the summary's code is the source, kept in one place (`packages/index`, where the summary lives), with a `present(ir, auth, content)` that returns the five parts as plain sentences and, per part, the keys of Behavior it covers.

## 4. The open questions, asked where they belong

- **Where the questions come from.** The draft records its assumptions: the reader without a model already lists what a description settles and what it leaves open (first-build.md §2.9, `bench-read`); the model's draft gets the same shape, a list of `{ part, question, chosen, options }` beside the operations, in the same request (the draft prompt asks for it; a draft that gives none has none). The `part` is one of the five of §3. `clarify`'s three questions become these: asked after the draft rather than before, with the draft's choice as the chosen option.
- **How one is asked.** At the end of the part, as one message: the question, the chosen answer marked "I went with: your team", the other options as chips, a box for other words. Answering changes the app: each option is an operation or a few (who signs in → `setSignUp`; what is public → `setPublic`; a page's purpose → `setText`/`addSection`; a record's fields → `addField`), proposed and applied as any change from Smith (confirmed in the Changes window's words, undoable). "Keep it" moves on. A question skipped stays in Smith's ready prompts as "You left open: who signs in".
- **No Sonnet for the questions.** The suggestion is the draft's own choice, already made by the drafting model; asking Sonnet to suggest again would cost ten to twenty times a Haiku turn to say the same thing (§5). What a stronger model buys is a better draft, and that is where it is spent.
- **A starter** has no assumptions; its presentation ends with "Tell me what to change, or ask me anything". A page's address (`--from`) has the page's own assumptions (the name from the logo, the pages from the menu), asked the same way.
- **During the wait** (the app not yet running) the answers are kept and applied in order once the project exists, as while-it-is-made.md §5 keeps typed changes.

## 5. The model, and the harness

The figures are A's bench of 2026-10-26 ([claude-5-5.md](../benchmarks/claude-5-5.md)): on changes typed into Builder, Haiku 5.5 scores 9.8 of 10 at $0.0025 a request against Sonnet 5.5's 9.2 at $0.043 and Opus 5.5's 9.8 at $0.086; on first builds both make 12 of 12 that type-check, Haiku at $0.004 a build and Sonnet at $0.04; on Ask, Haiku is right 93 % of the time at $0.0007 a question, Sonnet 96 % at $0.015. So:

- **The presentation costs no model** (§3), and the questions' suggestions cost none beyond the draft (§4).
- **Haiku 5.5 per turn** for Smith's talk, questions and changes, as today; **Sonnet 5.5** when a turn's checks fail (the cascade of first-build.md and assistant.md, on the checks, never on confidence), and for the draft itself on the global route, where the first impression is made (B's routing plan, Johan's go of 2026-10-25). "More model capability" is Sonnet on the draft and on a failed check, not a stronger model for every line.
- **The harness, sharpened.** What makes Smith good is not the model but what is around it, and three things here are new: every fact about the app comes from the IR by rule and is never asked of a model (§3); every answer to a question is an operation, checked and confirmed like any change, never a free-text note; and the presentation's parts name Behavior's keys, so "that page" or "the members" in the next line resolves without a model (ask-flows.md's slots, the same mechanism). The grounding check Ask has (a claim is held against the tools' results) applies to Smith's answers about the app: a sentence that names a page, a role or a field the IR does not have is sent back once, then shown as unconfirmed.
- **Docs answers** stay Haiku over the site's search index (studio-v3.md §2): the match is found without a model.

## 6. The layout

- **Default arrangement:** Smith in the first slot with Changes under him, the preview in the second; the two-window layout on a wide screen. The manual view is not on the screen until the "show" arrow at the preview's edge opens it as the third slot (or, in the one-window layout, in place of Smith). The layouts stay as studio-v3.md §8 has them; only the defaults and the top bar change.
- **The top bar:** no "No code | Code" choice. Its tabs are the windows of the current layout, with Map beside them, as A 161 made them; the manual view appears as one tab, named by its open sub-tab ("Behavior", "Code"). Inside the manual view, two sub-tabs: **No code** (Behavior, Look, Who can, Content as today) and **Code** (the files, the wizard). Nothing says "manual".
- **Phone:** Smith first, the preview next, the manual view third; the swipe order follows.
- **Kept per device** as today; a person who moved the windows keeps their arrangement, and the presentation still runs in Smith wherever he is.

## 7. The guide as part of Smith

The tour's stops stay the stops of studio-guide.md (the running app, what it does, every change in words, the look, publish and share; the code stops when Code is open), but each is a line of Smith's in his thread, the mascot pointing, the place lit as the cards lit it; Next and Skip are chips, Esc skips. The first stop, "How do you want to work?", is removed: when the manual view is first opened, Smith says "Here you can change the app by hand: No code, or the code itself" and points at the two sub-tabs. The stops' texts stay in `guide.ts` as Studio's words, with Smith's voice; "Guide" in the top bar runs it again. It shows when studio-guide.md §2 says, after the presentation and the questions; a stop whose place is not on the screen is left out, as today.

## 8. The beta, in Smith's words

The landing page's beta block and its "Ask for an invite" leave the page (the cloud's pages keep the footer's way to an invite only until Smith tells of it, Johan 2026-10-27). Smith says it at step 4 of §2, once the preview runs and the questions are done, in one message: what the beta is (a private beta; the app and the tester guide), that a sandbox lasts two hours, and how to keep the app: "Ask for an invite", a chip that opens the invite page with the email filled in when it is known. In a sandbox he says it again when fifteen minutes are left, with the mascot's impatient face, and once more at the end with what was made ("I kept your description; ask for an invite and start from it"). A line in the thread scrolls away under typing, so the sandbox's time left also stands in Smith's own header ("Sandbox: 14 min left", with the invite chip beside it) from the fifteen-minute mark, where it stays in view. For a signed-in tester the message is the beta line and the tester guide's link, without the two hours. The texts are Studio's words, the sandbox's minutes the service's (`DEMO_MINUTES`). (Built 2026-10-27: the service writes `data/.smithable/beta.json` in the project, `{ until?, invite, guide }`, at a workspace's start and at a sandbox's hand-over; Studio reads it with each poll, and no file means no beta.)

## 9. Steps (A builds; the core parts first where named)

1. **The layout** (§6): the default arrangement, the top bar's tabs, the manual view with its two sub-tabs, the phone order. Studio only.
2. **The presentation** (§3): `present(ir, auth, content)` in `packages/index` beside the summary (Fable), the five parts as Smith's messages with their expressions, "What does this app do?" among the ready prompts (A).
3. **The assumptions** (§4): the draft's `assumptions` beside its operations and the reader's open items in the same shape (Fable, packages/ai); the questions asked per part, each answer an operation (A).
4. **The guide in Smith** (§7): Studio only.
5. **The beta message** (§8): Studio's words plus the service's minutes and the invite address (A, with the cloud's page change by B or C).
6. **The grounding of Smith's answers about the app** (§5): the kit's check applied in Studio (Fable's part in packages/ai, A's in the panel).

Pictures for Johan after steps 1, 2 and 4, through the human assistant; the Studio check walks the new order (the test's first-build and guide steps change with it).

A second reviewer read the note: the three points it raised (a line typed in the middle, what an answer does to the preview, the sandbox's time left scrolling away) are in §2 and §8.

## 10. ARCHITECTURE §2.4

No construct is added: the presentation reads the spec, the questions are operations, the guide is the tour, the layout is Studio's.

## 11. Decisions for Johan

1. **The draft first, then the presentation with its assumptions as questions**, instead of the questions before the draft. Recommended: yes, since the person sees something real at once and every answer is an undoable change.
2. **No Sonnet for the questions**; Sonnet stays on the draft and on a failed check. Recommended: yes, on the bench's numbers.
3. **The manual view's two sub-tabs are "No code" and "Code"**, the view itself named by the open one, nothing called "manual". Recommended: yes.
4. **The beta message at step 4**, again at fifteen minutes left and at the end of a sandbox; the landing page drops the beta block and the invite link. Recommended: yes.
5. **The guide's "How do you want to work?" is removed**; Smith names both ways when the manual view first opens. Recommended: yes.
