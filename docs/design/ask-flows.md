# Ask without a model: a conversation that keeps its place, answers from the page and forgives a typo (design)

Status: draft for Johan, 2026-10-24. Builds on [assistant.md](assistant.md) (Ask in the app, its wording rules in §5 and decisions 3, 4 and 6) and on Studio's chat ([ask-in-studio.md](ask-in-studio.md), Smith's small talk by rule). The history kept across a reload, the steering back to the app and Smith's answers from the docs are a separate item built beside this one; this note is about what the rules can do before any model is asked.

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

## 8. The five questions (ARCHITECTURE §2.4)

Nothing new is added to the spec, so the questions are asked of the mechanism: common (every booking, order and support app has the same first sentence, and visitors ask the same five questions); deterministic (everything is read from the spec and the content, with no model); it reduces AI use (visitors get none, and a signed-in person's model is asked only for what the rules do not read); technology-neutral (no model or provider is named; the generated app depends on nothing of Smithable's); and better than free text, since there is nothing to write. A hand-written rule language fails the fifth question and is not added.

## 9. Not in this note

The history store and its keys, Smith's steering texts and its answers from the docs (the item built beside this one); voice in and out (assistant.md §8); any rule language; translating a question into the app's language before reading it (a question in Swedish to an English app goes to the model, as today).

## 10. Steps

1. **Answers from the page and the fallback** (§3, §6): the kit's `ask.ts` reads FAQ items, hours and address; the fallback and small-talk texts in the language files. The visitor's chat becomes useful before any conversation is kept.
2. **The conversation** (§2): slots from a create's required fields and a custom action's input, the card, the state in the panel's store; then the standard action on a named record.
3. **Typo tolerance** (§4) in the kit's reader and in Builder's.
4. **Variants** (§5) and the shared voice with Smith.
5. **Visualize, the test tables and the bench** (§7).

The readers (steps 1 to 3's reading) are core-side work; the panel, the store and Studio are the Studio session's; the bench the measuring session's.

## 11. Decisions for Johan

1. **No rule language; the flow from the forms, the answers from the content.** Recommended: yes.
2. **Typo tolerance bounded as §4** (the app's vocabulary only, one or two edits by word length, never on numbers and dates, the reading shown). Recommended: yes.
3. **Variants chosen by the turn count, not at random**, so conversations are testable. Recommended: yes.
4. **The visitor's fallback names what the chat can do here and the way to a person; no model for visitors**, as decided on 2026-10-04. Recommended: yes.
5. **The conversation's state lives in the browser only; the server stores no question** (decision 6 kept). Recommended: yes.
