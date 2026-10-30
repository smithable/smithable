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

(Steps 1 to 5 are revised in §12 after Johan's second look of 2026-10-30: the presentation runs on an overlay, Studio loading behind it.)

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

(The default arrangement is revised in §12.3: Smith floating by default, docked as a choice.)

- **Default arrangement:** Smith in the first slot with Changes under him, the preview in the second; the two-window layout on a wide screen. The manual view is not on the screen until the "show" arrow at the preview's edge opens it as the third slot (or, in the one-window layout, in place of Smith). The layouts stay as studio-v3.md §8 has them; only the defaults and the top bar change.
- **The top bar:** no "No code | Code" choice. Its tabs are the windows of the current layout, with Map beside them, as A 161 made them; the manual view appears as one tab, named by its open sub-tab ("Behavior", "Code"). Inside the manual view, two sub-tabs: **No code** (Behavior, Look, Who can, Content as today) and **Code** (the files, the wizard). Nothing says "manual".
- **Phone:** Smith first, the preview next, the manual view third; the swipe order follows.
- **Kept per device** as today; a person who moved the windows keeps their arrangement, and the presentation still runs in Smith wherever he is.

## 7. The guide as part of Smith

(Revised in §12.4: the guide's stop is Smith's line and a small card at the place, both.)

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

## 12. The second look (Johan, 2026-10-30): an overlay, then the guide

Johan tried Studio with Smith first and found it a bit too chaotic: Smith talking in one window while the windows, the preview and the ready prompts all arrive around him. His direction, in his words: Smith presents the app on an overlay and Studio loads behind; when the app has been presented and the overlay is closed, the guide goes on; the "Show me" links go; some effects on the chat bubbles, a bit more like a video game, still professional; the guide somewhere between the old cards and the new lines, still led by Smith; Smith may offer to show one change in every way, skippable; no suggestion buttons in the overlay nor in the guide. This section replaces §2's steps 1 to 5 and refines §6 (the default arrangement) and §7; §2's "Typing in the middle" and "What an answer does to the preview", §3, §4, §5 and §8 stand.

### 12.1 The overlay

- **What is on the screen.** Studio opens on one layer over everything: a calm backdrop (the brand's dark tone, the app's name in the brand type at the top), Smith's thread alone in the middle at reading width, the mascot beside his lines. Behind the layer Studio is loading as it does today (the stage of while-it-is-made.md, then the windows and the preview), dimmed and softened so the person senses an app being made without being asked to look at it; nothing behind takes a click or a key. The layer is a dialog: focus stays in it and goes back to where it was when it closes; Smith's lines are read out as they come (a polite live region).
- **What happens on it.** The presentation of §3, part by part, with each part's questions of §4 asked where they belong. The chips are only the presentation's own: **Next** on the current part, a question's options and **Keep it**, and one **Skip** for the whole overlay. No ready prompts, no "Show me" (Johan). A line typed is answered as §2's "Typing in the middle" says.
- **When the preview is ready behind**, the backdrop lets a little more of it through, at once and without a word, so an open question is not interrupted; at the next part Smith says it in one line ("Your app runs behind me") with his proud face. The last part's chip is **Show me the app** once the preview runs; until then the last part ends with Smith's working face and "A moment, the app is still being made", and the chip comes when it runs. A build that fails behind the overlay closes it to Studio as it is today, with the failure's own notice; the guide waits until the preview runs.
- **Closing.** Show me the app at the end, or **Skip** or Esc at any time (not a click on the backdrop: too easy beside an open question). Closing early ends the presentation: the parts not said are not said, and "Present the app again" (§12.6) gives them. The thread does not vanish: it slides into Smith's place (§12.3) while the backdrop lifts, so every line said and every question left open is still there; a question answered afterwards is a change like any other and resumes nothing.
- **Who sees it.** The first opening of a project in a browser, as the guide's rule in studio-guide.md §2. Two keys: `presented:<app>` is written when the overlay closes, `guideDone:<app>` when the guide ends or is skipped; a reload between the two gives the guide without the overlay. A returning person opens Studio directly. An app with nothing to present (no parts) skips straight to the guide. `?guide=off` turns both off, as today.
- **On a phone** the overlay is the whole screen, and the rest of this section is the phone's order of A 172 (the guide on a phone: Smith's lines, no cards, a stop scrolls its window into view).

### 12.2 Effects, the game feeling without the game

A bit more like a video game is the rhythm, not the props. In the overlay and in the guide:

- A line of Smith's arrives as one piece, rising a few pixels while it fades in; the next comes after a pause to read the first (as today), or at once on a tap, Enter or Space. No letter-by-letter typing: it slows reading and looks like a chatbot.
- The mascot's face changes with a small bounce when the expression changes; the part's place in the whole shows as dots under the thread ("3 of 5"), filling as the parts come.
- A chip presses down a little when clicked; a question answered folds its other options away and leaves the chosen one as a tag on the line.
- In the guide, the place a stop is about lights with one soft pulse of the accent when the stop arrives, then stays lit.
- No sound, no confetti, no score, no badges, nothing that counts the person (studio-guide.md §6 stands). Every motion is off under `prefers-reduced-motion`, which is the only switch (no setting of Studio's own), and no motion takes longer than a third of a second; the one named exception is the overlay's closing, half a second, since it carries the thread to its place.
- **Keys.** Enter is Next and Esc is Skip only while the box is empty and no control has the focus, so nothing typed is eaten; the keys never reach Studio behind the overlay or the dimmed rest during the guide.

### 12.3 Where Smith lives after the overlay

Johan's question: should Smith always be on the overlay rather than in the left window, or more like the app's Ask, or should the person have the choice? The recommendation:

- **One Smith, two sizes.** Smith's thread is one thing that can be **floating**, a panel over the preview opened from his face at the right end of the top bar (the feel of the kit's Ask, which the people who use the app meet in the app; his button is not at the bottom right, where the previewed app's own Ask sits), or **docked**, the window on the left as today with Changes under him. The overlay is the floating Smith at full size; closing it shrinks the thread into the open panel, hanging from the top right over the preview, so the guide has his lines in view; the panel folds into the face when the person closes it or when nothing has happened in it for a while after the guide, and opens again from the face. The switch between floating and docked is one button in Smith's header, remembered per device like the windows' arrangement. On a phone there is no choice: Smith is a window in the swipe row (A 172).
- **The default is floating.** What Johan called chaotic is the number of things arriving at once; with Smith floating, the first screen after the overlay is the app, the top bar and his panel, and the manual view and Changes come when the "show" arrow at the preview's edge (§2 step 5) or a tab is opened; floating, Smith leaves the layout's first slot and the preview takes the width, Changes and the manual view being the windows behind the arrow and the tabs as §6 has them. Docking is for a long sitting of changes, where watching the preview beside the thread pays. A person who docks him keeps it.
- **The guide runs in whichever he is.** A stop about a place the floating panel covers moves the panel to the other side for that stop and back afterwards; when no side has room (a narrow window, a split layout) the panel folds into the face for the stop and the card at the place carries the stop alone.
- The left window is not removed: docked is the layout of §6; floating is a second state of the same component, not a second Smith.

### 12.4 The guide, between the cards and the lines

Each stop is Smith's line in his thread **and** a small card at the place it is about: the card carries the stop's title and one sentence, with **Next** and **Skip**; the thread's line carries the same title, the full text, the same chips, and the mascot pointing. The two Next are one action, as are the two Skip. The place is lit and the rest dims a little, as the cards did (studio-guide.md §1); the dimmed rest takes no clicks, Smith's panel excepted. Esc skips, Enter is Next (§12.2's rule), **Guide** in the top bar runs it again. On a phone the card is left out and the stop scrolls its window into view (A 172). The stops are those of `guide.ts`; the ready prompts are not shown while the guide runs (Johan), and come back under the box when it ends or is skipped.

### 12.5 One change, shown every way

After the stop "Ask me", Smith offers: "Shall I show you one change made three ways?" with **Yes** and **Skip** (Esc skips). On Yes:

1. **Smith's way.** He proposes a small, visible, harmless change chosen by rule from the IR: a text field `notes` added to the first model that has none (`addField <model> notes text`). An app with no model, or where every model has one, gets no offer. He applies it himself, Yes having been the person's word and Undo being one chip away, and the preview is taken to that model's new-record form (as Select takes the preview to a part), where the field shows.
2. **No code.** The manual view opens on Behavior at that model (every kind of record lives there), the new field's row lit: "The same change, by hand: this row is the field I added; any setting of the app is a row like it." A floating Smith covering the row moves as §12.3 says.
3. **Code.** The manual view's Code sub-tab opens `smithable.yml` at the field's line, lit: "And this is the line it became; a change here is the same change."
4. **Undo.** "Keep the field, or take it back?" with **Keep** and **Undo**; Undo reverts the one change as any undo (Changes holds it, wherever its window is). Either way the manual view closes again and the preview is in front, so nobody is left before the raw file, and the guide goes on with its next stop. Esc during steps 1 to 4 is Undo and goes on.

Nothing here is a new mechanism: a proposed change, the manual view opened at a concept (as a "Show me" did), the editor at a line (the concept tree's Show in smithable.yml), and undo.

### 12.6 What goes

- The "Show me" buttons under the presentation's parts (the concept keys stay on the parts for the guide and for "that page" in the next line, §5).
- "What does this app do?" among the ready prompts (A 200, the ready prompts that did not work for Johan). **Guide** in the top bar becomes a small menu with two lines, "Tour Studio" and "Present the app again"; the presentation again runs in Smith's thread, with no overlay and no dimming, see decision 5.
- The ready prompts in the overlay and during the guide; they come back under the box afterwards, three of them: What should I do next?, Help me add…, How do I publish?

### 12.7 Steps (A; Studio only)

1. The overlay with the presentation and its questions, the closing transition into Smith's panel, the two first-visit keys (§12.1); the effects of §12.2 under one `motion` flag that `prefers-reduced-motion` turns off.
2. Floating and docked Smith, the switch, the default, the move for a stop (§12.3).
3. The guide's cards beside the lines, no ready prompts while it runs (§12.4).
4. The shown change (§12.5), with the stop's words in `guide.ts`.
5. The removals (§12.6). A 200 (the ready prompts) and A 201 (the CRM's checkboxes painting over the header) are bugs and go first, on their own.

Pictures for Johan after steps 1 and 2, through the human assistant; the Studio check walks the new order (overlay, close, guide, the shown change kept or undone).

### 12.8 Decisions for Johan

1. **The overlay closes on the person's word** (Show me the app, Skip, Esc), not by itself when the presentation ends. Recommended: yes; the one exception is an app with nothing to present, which goes straight to the guide.
2. **Smith floating by default, docked as a choice** (§12.3), the overlay being the floating Smith at full size and his button the face in the top bar. Recommended: yes. The alternative is docked by default with the overlay only at the start; it keeps today's screen and answers less of the chaos.
3. **The guide as Smith's line and a small card at the place, both** (§12.4). Recommended: yes.
4. **The shown change is a notes field on the first model without one**, undone or kept at the end (§12.5). Recommended: yes; the alternative, a look change (an accent color), shows the Look tab rather than the three ways of the same change.
5. **The presentation again from the Guide menu** ("Present the app again"), in the thread without the overlay, since the chip goes. Recommended: yes; the alternative is no way back to it, which a returning person may miss.
6. **No sound** in the effects, now or as a setting. Recommended: no sound.

Two second reviewers read the section; their points (Skip meaning two things, the floating Smith hidden when the guide starts, the last part before the preview runs, the backdrop click, keys against typing, the shown change's end and empty cases, phones) are in the text.
