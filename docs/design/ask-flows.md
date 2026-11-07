# Ask without a model: a conversation that keeps its place, answers from the page and forgives a typo (design)

Status: draft for Johan, 2026-10-24; §8 (the history: what I changed, undo, milestones) added 2026-11-07 for Fable 102. Builds on [assistant.md](assistant.md) (Ask in the app, its wording rules in §5 and decisions 3, 4 and 6) and on Studio's chat ([ask-in-studio.md](ask-in-studio.md), Smith's small talk by rule). The history kept across a reload, the steering back to the app and Smith's answers from the docs are a separate item built beside this one; this note is about what the rules can do before any model is asked.

The references that started it: four small open-source chatbots without a model, read for their architecture, not their code: AI-ChatBox (triggers to a list of answers, one picked at random), RuleChat (ordered regular expressions, first match wins, the matched rule shown), DecodeBot (exact, then keyword, then typo-tolerant matching), and ELIZA (a pattern takes words out of the sentence and puts them into the answer). What they do well is to answer at once, for nothing, the same way every time. What they do badly is to be written by hand: every rule is a regular expression someone typed, so the bot knows what its author thought of and nothing else, in one language.

## 1. The principle: nothing is written as rules

Smithable already has what a hand-written bot lacks: a spec that names every kind of record, field, value, action and page, a content file with every text a visitor reads, and access rules that say who may do what. The chat's knowledge is derived from those, as the forms and the pages are. So:

- **No rule language.** A `when: contains [book, booking]` / `respond` / `set state` block in a spec file would be free text that says what the code does (ARCHITECTURE §2.4, question 5) and would name no kind, field or page the spec does not already name. The things such a block would say are already said: the fields a booking needs are on the form; the answer to "when are you open" is in the contact section; the hours are what the booking check uses. The chat reads them from there. A model writing such rules at build time would be writing them twice.
- **The flow comes from the forms** (§2), **the answers from the content** (§3), **the vocabulary from the spec** (§4), **the words from the language files** (§5), and the model, where there is one and the person may use it, comes last (§6). A visitor never gets a model (assistant.md decision 3).
- **Every word is accounted for**, as the wording rules have it today: a sentence the rules do not fully read is not guessed at. Accounted for after the filler is dropped: the language file lists the words that carry nothing ("please", "I'd like to", "could you", "well", "uhm", a closing "thanks"), and they are taken off before reading, as Smith takes a closing "Smith" off a greeting. A message with two parts ("book me for Friday, and is parking free?") is split at its clause boundaries (the language file's "and", "but", "by the way", a question mark inside the message) and each part is read on its own.

## 2. The conversation keeps its place

Today a question becomes one tool call and the next question starts over. A booking in one sentence is rare: "I'd like to book" is the usual start, and what follows is the form, asked one field at a time.

**What opens a conversation.** A sentence that names something to make or to do, in the app's own words: a kind the person may create ("book a class", "new order", "I want to join the waiting list" when the spec has a WaitingList kind), a custom action with input ("merge these customers"), or a standard action on a record the sentence names ("cancel my booking on Friday", read like "open Nordic Timber" is read today, then the action's `when` checked). What the person may not do is not offered, by the same access check the buttons use.

**The slots are the required fields**, in the order the form shows them, and nothing else: a create's required fields and the record's reference fields; a custom action's `input`; a standard action has none (its `set` is the spec's). Each kind of field is asked and read as its control would read it:

- a **reference** is asked as a choice among the records the person may see, narrowed by what the sentence already said ("Friday" narrows the sessions to Friday's); for a booking with a schedule the free times come from the same function the picker and the server use (the kit's `slots.ts`), so the chat never offers a time the form would refuse;
- a **choice** is asked with its values, read by label, in the app's language;
- a **date or time** is read as the wording rules read them in filters today, and no further: a date, a day of the month ("the 3rd"), today, tomorrow, a weekday (the coming one), "next <weekday>" (the one after the coming one), a clock time ("10", "10:30", "ten", "half past ten"), "morning", "afternoon" and "evening" as spans; in the app's time zone. A phrase the rules do not read ("in a fortnight", "the week after the holiday") is asked again as a choice of dates, never guessed; a phrase that reads two ways is asked as the two;
- a **text or number** is taken as written, a **yes/no** by the language file's yes and no words.

**Each turn** reads the whole message against all open slots first, so "Friday at ten for two" fills three at once, then against the slot that was just asked. A value that fits a filled slot and no open one replaces the filled one ("actually, for three"), and the chat says what changed. A word that fits no slot and no question leaves the slot open and the chat asks again, once, differently (§5), then offers the form itself ("Here is the form, if that is easier"). A question in the middle ("is parking free?") is answered by §3 and the open slot repeated. "Never mind", "stop", "cancel" and their equivalents in the language file end the conversation; so does any new thing to make.

**The end is a card, not a silent write.** When every required slot is filled, the chat shows the filled form as a card with the kind's own labels, and the person confirms it in the app (assistant.md decision 4). The card goes through the same server function as the form, with the same validation and access check and the same refusal texts, so a slot the chat read wrong is refused the way a form field would be, and the chat asks for that field again.

**Where the state lives.** In the browser, with the panel: the kind, the filled and open slots and the turn count. The browser sends that state with each turn and the server answers from the message and the state alone, so the server keeps no session and any instance answers any turn. The server receives questions and, at the end, the form; it stores neither (decision 6: a question's text is not stored). This is the same store the history-across-a-reload item uses, so an open conversation survives a reload with the history it belongs to, keyed by the app and the signed-in person, cleared at sign-out. A conversation older than a day is dropped: the free times it offered are stale.

**Smith gets the same mechanism** for a change missing a part. "Add a field" opens a conversation whose slots are the operation's required arguments (the operation schemas say which): the kind, then the field's name, then its type when the name does not settle it; "add a notes field to customers" fills all three at once and no question is asked, as today. The texts are Smith's (`small-talk.ts` and Studio's words), the reading is Builder's.

## 3. Answers from the page

The landing page already holds the answers a visitor asks for, as content: the FAQ section's items (`pages home faq items N question` and `answer` in the content file), the contact section (address, telephone, hours), the pricing section, the hero's lead and the app's name. A first build writes them from the description; the owner edits them in Studio; `setText` changes one. The chat answers from them and writes nothing of its own, so the page and the chat never disagree (words-once.md).

**Matching.** The question's words and each item's question and answer are normalised the same way (lower case, punctuation off, the language file's stop words off, a typo forgiven by §4) and scored by the words they share, an item's question weighing more than its answer. The best item answers when its score is clearly above the second's (a margin, not a threshold alone); when two are close the chat offers both as questions to pick ("Do you mean 'Can I cancel?' or 'Can I change my booking?'"); below a floor nothing matches and §6 applies. The answer is shown as the item's own answer text, with the question it answered as a heading, so a wrong match is visible at a glance.

**Live answers over stored ones.** "Are you open on Sunday", "when do you close today" and "where are you" are answered from the contact section's hours and address by rule, in the app's time zone, because the hours are structured and a stored FAQ answer about hours goes stale. The kit's `hours.ts` already formats them for the page.

**Who gets which.** A visitor gets the public landing page's content, which is exactly what the page shows them anyway. A signed-in person also gets the FAQ sections of the pages their role may open.

## 4. Forgiving a typo

The wording rules read the app's vocabulary exactly, so "how many custmers" goes to the model, or to nothing. DecodeBot's order is right: exact, then keyword, then typo-tolerant, and the last stage is bounded so it never guesses:

- a word is compared only with the app's vocabulary: kind labels and plural labels, field labels, choice labels, the FAQ items' words, and the rules' own small vocabulary in the language file (how many, show, open, book, cancel, yes, no): a few hundred words, fixed at build time. The values in records (a customer's name, an order's number) are not in it: a record is found by the search tool, which already matches a part of a name, never by edit distance over the table;
- an edit distance of one for words of four to seven letters, two for longer ones; never for words of three letters or fewer, for numbers, dates, times or anything quoted;
- a correction stands only if the whole sentence then reads (every word accounted for); otherwise the word is left as it was and the sentence goes on to §6;
- the answer shows the reading ("Customers: 41", "Showing the bookings for Friday"), so a wrong correction is seen and undone by saying so.

The cost is a few hundred comparisons per word, nothing against a model call. **Smith** gets the same in Builder's reading of change requests, over the operations' vocabulary and the spec's names ("add a feild to custmers" reads by rule), and the proposal card shows the reading as it does today.

## 5. Variants and voice

An answer that always has the same words reads like a form. Each rule answer in the language file has two or three variants ("Which day?", "What day suits you?", "When would you like to come?"), and the one shown is chosen by the turn count and the conversation's number in this browser (the store counts them), not at random: the same sequence always reads the same, so a test from an empty store can assert it and a screenshot does not change between runs, while a person who comes back is not greeted with the same words every day. Varied, not random.

The words live where the kit's words live, `words/<language>.ts`, one entry per answer with its variants, in every language the kit has; the kit writes no English of its own. Smith's small talk and the steering texts have the same voice and keep to the same forms of address, and the greeting, thanks and goodbye patterns are language data in the same files, so an app in Swedish greets in Swedish.

ELIZA's trick, taking words out of the sentence and putting them into the answer, is used for one thing only: confirming the reading ("Friday at 10:00, for two people: shall I book it?"). As conversation filler it wears thin in three turns.

## 6. When nothing matches

- **Signed in, with a model, within the limits:** the model, as today, under the project's policy; the open conversation's filled and open slots are given to it as context, so the model continues the form rather than starting over, and its answer is checked like any tool call.
- **A visitor, or no model, or the limits used up:** never "No operation can do this". The answer names what the chat can do here, from the spec and the content: the FAQ items' questions (three at most), the hours, the public lists it can show, the things it can help make ("I can help you book a class, tell you about prices and opening hours, or show the schedule. For anything else, write to us"), with the contact form or sign-in as the way to a person. Decision 3 stands: a visitor's question never costs the owner a model call.
- **Greetings, thanks, goodbye and small talk** are answered by rule in the app as they are in Studio since Smith learned to, with the next step suggested from the spec ("Hello! I can help you book a class or answer questions about the studio.").

## 7. Seeing and testing the flow

Because the flow is derived, it can be drawn and tested without anyone writing it. For each kind a person may make, the conversation is a small graph: the slots in order, the sideways question, cancel, the card. Studio's Visualize tab shows it beside "What happens" for the kind, from the same IR. The adapter's tests hold, per starter, a table of conversations (the sentences in, the filled form or the fallback out), and the assistant bench gets conversations beside its single questions, so a change to the readers is measured the way the first-build readers are.

## 8. The history: what I changed, undo, milestones

Added 2026-11-07 (Fable 102). Johan: Smith presents the recent changes, the Changes window is not shown by default, the person tells Smith to undo the latest or another change, and a chip asks "what changes have I made". These are flows of this note: read by rule, no model, words from Studio's language file, worded by §5's variants. "The history" here is the change log, not the chat's history store of §10. The flows read what Changes already has (ARCHITECTURE §9.7, studio-changes.md, studio-v3.md §3): the trace's entries, newest first, a request's several changes as one line written from what they did, each change's milestone, and what its undo puts back. Nothing new is stored. The chat panel is `Ask` (`apps/studio/src/builder/Ask.tsx`); the Changes window is `Trace` (`apps/studio/src/shared.tsx`), placed by `App.tsx` and `windows.tsx`.

**Reading.** §4's vocabulary gains, at question time, the words of the Changes lines and the milestone names, read from the trace (they change at run time, unlike the rest of §4's). Two places are free text and exempt from "every word accounted for": the words after "undo the change that" (or "undo" followed by anything but "that", "it" or "the last change"), up to the end of the message, and a milestone's name after "milestone", "call it" or "call the last change", up to the end of the message or a quote; neither is split at §1's clause boundaries. A request that arrives while a change runs waits in the box's queue, as today, and is read when the change has landed.

**What have I changed.** "What have I changed", "what did I do", "show my changes" and their language-file equivalents answer with the Changes lines, newest first, each with what its undo would put back in the Changes window's own words ("Undoing it puts back the app's files, and the records as they were before it" for the newest change still in place when it kept a snapshot; "…; the records stay as they are now" for any other). Three scopes, from a trailing word or phrase:

- **today**: the changes since midnight in the browser's time zone (the person's day, not the app's time zone of §2);
- **since a milestone** ("since <name>", "after <name>"): the changes after the one carrying that milestone, the name matched by §4's tolerance among the milestone names; a scope word wins over a milestone of the same name unless quoted; no match lists the milestones as chips;
- **all** ("everything", "all my changes"), and the bare question: from the newest back.

At most five lines, a request's group being one line and "Undid: …" lines counting like any other, each with its milestone as in Changes; then **Show all**, which opens the Changes window at the first line not shown. With no change yet: "Nothing changed yet" and the ready prompts.

**Undo.** The target is a line of Changes that is still in place and is not itself an undo (an "Undid: …" line is taken back by "redo", ask-in-studio.md §1, not by undo):

- **"Undo the last change"**, "undo that", "take that back": the newest such line, which is what the Changes window's X on that line undoes: a request's changes together, newest first, each checked and undone in turn and stopping at the first refusal, as the X does, the answer saying what was undone and what was not. With every change undone: "There is nothing left to undo".
- **"Undo the change that <words>"** ("undo the phone field", "undo adding the Orders page"): the words are scored against the lines and their milestone names as §3 scores a question against the FAQ: a margin over the second best, a floor. A request's group is one line; a single change inside it is undone from Changes. Two close: Smith asks which, the two lines as chips. Below the floor: "I found no change about that", with Show all. A line already undone: "That one is undone already (Undid: …)", and nothing else happens.

Before confirming, Smith asks the daemon the check the X relies on (`smithable undo --change <id> --check`, `packages/cli/src/undo.ts`): a refusal (a later change depends on it, a later change edited the same part, it made the app itself) is said in its own words with the line it names, and Show all, and no confirmation is shown. Safe, one confirmation names the line and what comes back: for the newest with a snapshot, "the files and the records as they were before it"; for the newest without one, or an earlier one, "the files only; the records stay as they are now", and for an earlier one "the N later changes stay" (up to three lines, then "and N more"). A column the undo removes is named in the same confirmation ("It deletes the phone column and the values in it"): that is the destructive confirmation the Changes window asks, not a second one. **Yes** undoes through the X's route (`/api/undo`, the ids, confirmed); if the history moved since the confirmation was shown, the confirmation is void and Smith checks and asks again. While a confirmation waits it is a question of Smith's, as §2's open slot: a question is answered and the confirmation repeated; No, "stop" or "cancel" end it; a new request ends it and is read; it does not survive a reload. The answer is the Changes window's "Undid: …".

**Milestones.** "Name this a milestone <x>", "call the last change <x>": the newest line still in place gets the name through Changes' route (`/api/milestone`, `packages/cli/src/milestones.ts`), with no confirmation, since a name changes no file; a line that already has a name is renamed, and the answer says so. "Rename the milestone <x> to <y>" and "remove the milestone <x>" act on that milestone; one that does not exist is answered with the milestones as chips. The one confirmation: a name already on another change ("Move 'Before the shop' here?"), Yes moves it, anything else keeps it where it is. An earlier change is named in Changes.

**Mixed requests.** As §1: split at the clause boundary (outside the free text above), each part read on its own, in order. An undo's confirmation is answered before the next part is read, so "undo that and add a notes field" proposes the field on the app as the undo left it; No drops the undo and the next part goes on.

**Chips.** The ready prompts live under the box (studio-v3.md §2, `ReadyChips` in `Ask.tsx`): "What should I do next?", "Help me add…", "How do I publish?", then any "You left open: …"; they are not shown while Smith works, presents, waits for an answer (a confirmation included, which has its own Yes and No) or a guide runs, and they rest, disabled with a line saying why, while words are in the box. Kept so, with two more after the three when a line is still in place: **What have I changed?** and **Undo the last change**. Right after a request's changes applied, **Undo that** replaces **Undo the last change** until the next thing is sent. A chip sends its words as if typed, so it reaches the same flow and its confirmation.

**The Changes window is the detail view.** Closed by default: the first arrangement is Smith alone in his column (`windows.tsx`'s default no longer "smith+changes"; an arrangement already kept in the browser stays), and on a phone Changes is no longer under Smith by default. It opens from Smith's Show all, from a line in his answer (Changes opened at that entry, expanded), and from the windows menu as today. What it shows and does does not change, only that it can be opened at an entry: its lines, "Undid: …", milestones and X are the words and actions Smith uses, so both tell the same story.

**Safety.** Nothing is undone without the confirmation, and the confirmation is Studio's text built from the check, never a model's. The model never decides what to undo: a request the rules do not read goes to the model as any other (§6), and an undo in its answer is not run, nor offered as a chip; Smith offers Show all, for the person to choose the line. The X's rules stand: only the newest change puts the records back, and only when it kept a snapshot; an earlier one is a new change that reverses its files, refused when later changes depend on it.

**Tests.** In `scripts/test-studio.mjs` and Ask's units, a table as §7 has: "what have I changed" (bare, today, since a milestone, since a misspelt one, a milestone named "today", all, empty, more than five); "undo the last change", "undo that" after a request of three changes, after an undo, with everything undone; "undo the change that <words>" (one match, a typo, two close, none, already undone, refused by a dependant, an earlier one with "files only" and the later changes named, one that removes a column, the history moved before Yes), Yes, No, a question while it waits, a new request while it waits; "name this a milestone <x>", on a named line, a name taken elsewhere, rename and remove of a missing one; "undo that and add a notes field"; the chips (shown, "Undo that" after a request, resting with words in the box, gone while Smith works or waits); Changes closed at first, opened by Show all and by a line, on a desktop and a phone.

## 9. The five questions (ARCHITECTURE §2.4)

Nothing new is added to the spec, so the questions are asked of the mechanism: common (every booking, order and support app has the same first sentence, and visitors ask the same five questions); deterministic (everything is read from the spec and the content, with no model); it reduces AI use (visitors get none, and a signed-in person's model is asked only for what the rules do not read); technology-neutral (no model or provider is named; the generated app depends on nothing of Smithable's); and better than free text, since there is nothing to write. A hand-written rule language fails the fifth question and is not added.

## 10. Not in this note

The history store and its keys, Smith's steering texts and its answers from the docs (the item built beside this one); voice in and out (assistant.md §8); any rule language; translating a question into the app's language before reading it (a question in Swedish to an English app goes to the model, as today).

## 11. Steps

1. **Answers from the page and the fallback** (§3, §6): the kit's `ask.ts` reads FAQ items, hours and address; the fallback and small-talk texts in the language files. The visitor's chat becomes useful before any conversation is kept.
2. **The conversation** (§2): slots from a create's required fields and a custom action's input, the card, the state in the panel's store; then the standard action on a named record.
3. **Typo tolerance** (§4) in the kit's reader and in Builder's.
4. **Variants** (§5) and the shared voice with Smith.
5. **Visualize, the test tables and the bench** (§7).
6. **The history** (§8): Studio's session, one pull request, after Johan has read it.

The readers (steps 1 to 3's reading) are core-side work; the panel, the store and Studio are the Studio session's; the bench the measuring session's.

## 12. Decisions for Johan

1. **No rule language; the flow from the forms, the answers from the content.** Recommended: yes.
2. **Typo tolerance bounded as §4** (the app's vocabulary only, one or two edits by word length, never on numbers and dates, the reading shown). Recommended: yes.
3. **Variants chosen by the turn count, not at random**, so conversations are testable. Recommended: yes.
4. **The visitor's fallback names what the chat can do here and the way to a person; no model for visitors**, as decided on 2026-10-04. Recommended: yes.
5. **The conversation's state lives in the browser only; the server stores no question** (decision 6 kept). Recommended: yes.
6. **Smith tells the history and undoes by words, after one confirmation built from the undo check; Changes closed by default as the detail view** (§8). Recommended: yes.
