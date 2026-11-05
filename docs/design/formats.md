# Formats: how an app writes dates, times, numbers and money

Status: design, 2026-11-05. Decides the question left open by the clock change (`app.clock`, 24-hour unless the app says 12): whether an app needs a region or locale setting. It does not. An app makes a few explicit choices where a reader would notice a difference, each with a readable default, and the kit writes every date, time, number and amount from those choices together with what the spec already says: the page's language, the app's time zone and its currency.

## 1. The problem

The kit asks `Intl` with no locale in about twenty places (`new Intl.DateTimeFormat(undefined, …)`, `new Intl.NumberFormat()`), and in two with the page's language. No locale means the runtime's own: on the server that is the container's, in practice US English, and in the browser it is the reader's. So a date reads "Nov 5, 2026" on a page rendered on the server and "5.11.2026" once the same page is rendered again in a Finnish browser; an Åland barber's slots read "9:00 AM" because the slots followed the language, English; and the same amount is "€9.90" for one reader and "9,90 €" for the next. Three things are wrong at once: the app's pages do not read the same for everyone, the server and the browser disagree (a hydration mismatch waiting to happen), and nothing in the spec says what was meant.

A region or locale key (`region: FI`, `locale: en-FI`) would answer all of it with one word, and that is why it is the wrong answer: a code decides a dozen things at once, nobody can say from the code which, and the maker cannot see what it changed or change one of them without a second mechanism. The app's time zone and currency already say what they mean, one thing each; the formats should too.

## 2. What matters

Only what a reader would notice, and where the choice is not already made:

| Format | Choice | Default | Why it matters |
|---|---|---|---|
| Time | `clock: 24h` or `12h` (exists) | `24h` | "09:00" and "9:00 AM" are different habits, not a style |
| Date order | `date: day-month` or `month-day` | `day-month` | "5 Nov 2026" and "Nov 5, 2026" are read fluently only in one's own order |
| First day of the week | `week: monday` or `sunday` | `monday` | A calendar that starts on the wrong day is misread |
| Numbers | `numbers: point` or `comma` | from the language, §3 | "1,234.56" and "1 234,56" are each a mistake to the other's readers, and money follows |

The values are the conventions of the kit's languages, English and Swedish, and no more: year-first dates, Saturday-first weeks and the dot-grouped numbers ("1.234,56": German, Dutch, Italian, Spanish) are added as values when the kit gets words in a language written that way (`numbers: comma-dot` is the first in line). A choice nobody can use yet is a choice too many, and each value carries rules (below) that are only right once a language is there to check them against.

What does not get a choice:

- **Numeric dates.** Dates are written with the month's name wherever a person reads them ("5 Nov 2026", "Thu 5 Nov", as [record-names.md §1](record-names.md) already has it), never as "05/11/2026", which is ambiguous in exactly the apps this note is for. A date is a day, with no time zone; a timestamp is shown in the app's time zone (or the person's own, below). Date inputs are the browser's own date control, which takes ISO and shows the reader's habit by itself, including the week it starts on; that is the one place a reader's own locale shows, and it is the control's, not the page's. The API, exports and files stay ISO.
- **Money.** Two bundled presets, one per `numbers` value, each the way English and Swedish write an amount: a point writes the symbol before the number with no space ("€9.90", "$12.00"), a comma writes it after, with a space ("9,90 €", "100,00 kr"). Which symbol or code is written is a word, so it follows the page's language as `Intl` gives it for that language ("kr" in Swedish, "SEK" in English, "€" and "$" in both); the number, its marks and its place follow `numbers`. Minor units are the currency's own (two for EUR and SEK, none for JPY); a negative amount has the minus before everything ("−9,90 €", "−€9.90"), never parentheses. Amounts are in the app's `currency`, so there is no second currency to tell apart. The pairing of symbol-last with a decimal comma is not a law of nature (Dutch writes "€ 9,90"); it is the rule of these two values, and `comma-dot` gets its own when it comes.
- **Grouping and percent.** Follow `numbers`: a point groups with commas and writes "12.5%", a comma groups with a no-break space (U+00A0, so a number never breaks over a line) and writes "12,5 %". The kit writes these characters itself (§4), so they are the same on the server and in every browser.
- **Month and weekday names.** Words a person reads, so they are in the page's language like every other word, and they come from where the kit's words live, `words/<language>.ts` ([languages.md](languages.md)), not from `Intl`: a Swedish page says "tors 5 nov" and an English one "Thu 5 Nov", in the same order, because the order is the app's choice and the words are the page's. A language whose dates need other forms of a month's name (a case ending, a particle) adds them with its words, and the date helper takes the form the order asks for.
- **A person's own.** A signed-in person may already choose their own time zone and clock under their name (spec §calendar); those are what a traveller or a colleague abroad needs. Date order, week and numbers stay the app's: the app is one thing read by many, and its lists must read the same in a meeting.

## 3. Defaults

Every default has an explicit key and a reason `smithable validate --explain` gives, as [inference.md](inference.md) asks of every default:

- `clock`: `24h`. Fixed. (The unambiguous form, and the one the kit's two languages share in writing.)
- `date`: `day-month`. Fixed. (The order of most of the world and of the record names the kit already writes; month-first is a choice for the apps that want it.)
- `week`: `monday`. Fixed. (ISO weeks; the ISO week numbers the calendar shows are defined on them, and a Sunday-first calendar shows none, which its Studio row says.)
- `numbers`: from the app's `language`: `en` is `point`, `sv` is `comma`; a language added later brings its convention with its words. This is the one derived default, and it is a code deciding a habit, the move §1 rejects for a region; it is allowed here because it decides one thing, `--explain` names it ("numbers: comma, from language sv"), and an app that wants otherwise sets `numbers` itself, one line. An app in Swedish with "1,234.56" would read as a mistake in every row, which is why the default is not simply `point`. An English-language app in Finland sets `numbers: comma` itself.

Rejected ways to choose a default, so they are not proposed again:

- **From the time zone or the currency.** `Europe/Mariehamn` would guess right for most apps there, `EUR` cannot guess at all (the euro is written "€9.90" in Ireland, "9,90 €" in Finland and "9,90 €" with dot grouping in Germany), and both are a region by the back door: a habit guessed from a place, wrong for the Swedish-language app in Minnesota, and not explainable in a sentence without the word "region". The time zone places records in time, the currency names the money, nothing more.
- **From the browser.** The reader's locale differs from reader to reader and from the server, so the page would not read the same for everyone and the server and the browser would disagree. The kit guesses nothing from the browser for the language either.
- **Asked at the first build.** The clarifying questions ask about the app, not about typography; the three new choices are one click each in Studio, with an example beside them, and the first build takes the defaults.

## 4. Where the choices are made

- **Spec.** Three new keys under `app`, beside `currency`, `timezone` and `clock`: `date`, `week`, `numbers`, each optional, with the values in §2; an unknown value is refused with the choices named (`invalid-value`, as `clock` is). The reference's `app` table gets three rows, the JSON Schema follows (`pnpm schema`), and `--explain` names each default and its reason.
- **Operation layer.** `setApp` takes the three keys like `clock` ("none" removes one, back to the default); no new operation.
- **Kit.** All formatting goes through `format.ts` and `time-text.ts`, and none of it asks `Intl` for a format: a date helper assembles weekday, day, month and year from the words file in the app's order, writing the punctuation of that order itself ("Thu 5 Nov 2026"; "Thu, Nov 5, 2026"); a number helper writes the digits, the grouping character and the decimal mark of the `numbers` value itself, and the money helper puts the currency's word from `Intl` with the page's language before or after it. `Intl` stays for what it is good at and what does not vary with a locale: time zones (`Intl.DateTimeFormat` with `timeZone`, the parts read numerically) and a currency's symbol and minor units. `Calendar.tsx`'s Monday becomes the app's first day, with week numbers only when it is Monday. The server and the browser then format identically by construction, with no CLDR version to agree on. A unit test over the templates keeps every implicit locale out: no `Intl.DateTimeFormat(undefined` or `Intl.DateTimeFormat()`, no `Intl.NumberFormat(` without a locale, no `Intl.RelativeTimeFormat`, no `toLocaleString`, `toLocaleDateString` or `toLocaleTimeString`, the way `kit-words.mjs` keeps the kit's own English out of them. Form inputs parse by the app's `numbers`: the app's grouping character is ignored, its decimal mark read; the other mark is accepted only where it cannot be grouping ("1,5" under a point is 1.5; "1,234" is 1234), and the field writes the value back in the app's form.
- **Studio.** The place that sets the time zone (the app's settings) shows the four choices as rows with a live example each: "09:00 · 21:00" against "9:00 AM · 9:00 PM", "Thu 5 Nov 2026" against "Thu, Nov 5, 2026", "Mon Tue Wed … (week 45)" against "Sun Mon Tue … (no week numbers)", "1 234,56 · 9,90 €" against "1,234.56 · €9.90". A row shows which value is the default and why, in the words of `--explain`.
- **The first build and the starters.** Neither sets a format key; the starters are read with the defaults, and the starter pictures on the site therefore show "5 Nov 2026" and "1,234.56", not the server's "Nov 5, 2026".

## 5. What existing apps get

Nothing in a spec changes. Regenerating an app brings the kit's formatting, so:

- Dates no longer depend on where the page was rendered: an English app shows "5 Nov 2026" everywhere, where a page rendered on the server showed "Nov 5, 2026" and the browser something else. That is the fix the look reviews of the starters asked for.
- A Swedish app's numbers and amounts become "1 234,56" and "9,90 €" by the derived default. An app that wants the point sets `numbers: point`.
- Month and weekday names come from the words file on the server as well as in the browser, so they agree.
- Clocks stay 24-hour, calendars stay Monday-first; nothing else in a page's text moves.

As with every regeneration, the change is one commit and undo takes it back.

## 6. Out of scope

Translating Studio or the Builder; a reader's own date, week or number choice; numeric dates; the values other languages need (year-first, Saturday-first, dot grouping) until a language needs them; and any key that names a country, a region or a locale.
