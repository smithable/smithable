# Outgoing templates: an administrator's own words in a mail or a call (design)

Status: draft for Johan, 2026-10-27 (Fable); Johan's go the same day on the five points of §2 and the principle of §5, with the step of §6 designed but not built; two second reviewers' points taken the same evening (§4 rewritten on the access model as it is, custom actions' placeholders left out, §6 and §7 shortened). Builds on [integrations.md](integrations.md) §4 (outgoing mail and calls, the outbox, Activity's line with "Send again"), the content file ([spec/v0.1.md](../spec/v0.1.md), `smithable.content.yml`) and the `{path}` texts the spec already has (a record's title from an incoming call, `set` values of an incoming entry).

## 1. Today, and what Johan asked

An outgoing entry's mail is fixed: the subject and a text from the content file, with no placeholders, then the record's fields as the record page shows them ("Label: value", one a line), then a link to the record. A call's body is the fixed JSON `{ event, model, happened, at, record }`, the record as the API gives it, with no say over which fields go and no previous values on a change. A sentence with a value in it ("Your booking #{number} is confirmed for {date}") needs code: a hook with `tellMail` or `tell`.

Johan (2026-10-27, through the human assistant): keep today's behaviour as the default, but let an app's administrator customise an entry's mail (its subject and text with placeholders like `{number}` or `{customer.name}`) and a call's body (which fields, perhaps the previous values on a change), from the app's admin side rather than only from the spec. Questions he wants answered: where the template lives; what a placeholder can reach; a preview, and what an empty value gives; how it fits Activity and "Send again"; and safety: a template must not leak what the recipient may not see.

## 2. The design in five points

1. **The words stay in `smithable.content.yml`**, under `outgoing: { <entry>: { subject, text } }` as today, and may hold placeholders in the one form the spec already uses, `{path}`. No new template language: no conditions, no loops, no formatting codes. The texts are visible text (rule 1), so they are versioned, undone with one undo, shown in What it does and the same in every copy of the app.
2. **Which fields go is functionality**, so it is on the entry in `smithable.yml`: `show: [field…]` (the fields the mail lists under the text and a call's `record` carries, in that order) or `show: none` (the text alone, and a call's record with only its id), and `previous: true` on a `<Model> changed` entry, which adds what the changed fields among the listed ones were. Without `show` the mail lists the fields as today, and a call carries the record as the API gives it.
3. **Safety is checked when the spec is validated**, not when a mail is sent: a placeholder or a `show` field the recipient may not read refuses the entry and names the field (§4). The sent text can never say more than the spec allows.
4. **A preview**, in Studio's Content panel and from the command line, renders the entry with the model's sample record (`samples/<Model>.yml`), so it works without a running app and without data. An empty value renders as an empty text. The text is rendered when the mail or call is queued, in the change's own transaction, and stored in the outbox as sent: Activity keeps a mail's subject and text and a call's body; "Send again" sends that again; a changed template applies to the events after the change, never to what is queued.
5. **The administrator edits the words in Studio**: in the Content panel, or by telling Smith ("make the booking mail say thank you and the date"), both through `setText`. For now the administrator is the app's builder, so Studio is the admin side; the app's own database keeps no second copy (§5 says why), and §6 is the answer to the literal ask, for the day the person running the app is not its builder.

## 3. Placeholders

A placeholder is `{path}`, filled from the record the event is about, formatted as the record page shows the value: a date in the app's format, an amount with its currency, a choice by its label, a reference by its record's title, yes/no in words. What a path may be:

| Path | Fills with | Where |
|---|---|---|
| `{field}` | a stored or worked-out field of the model, as the record page shows it | every entry on a model |
| `{reference}` | the title of the record a reference field points to | every entry on a model |
| `{reference.field}` | a field of that record, one hop (§4 says which) | every entry on a model |
| `{title}` | the record's title, as the record page's heading | every entry on a model |
| `{link}` | the record page's address, as the link at the mail's foot | every entry on a model (nothing for a model without a page) |
| `{by}` | the name of the person whose change it is | every entry on a model; empty for a timer's or an incoming call's event |
| `{before.field}` | what the field was before the change | `<Model> changed` only |

- **A custom action's entry** (no record: its mail shows the action's input and output by their labels) takes no placeholders in this step; a text with braces there is an error. Its input can hold anything, a token too, and a rule for it is better written when someone needs one.
- **Empty is empty.** A field with no value, a reference that points nowhere, `{by}` for the app's own change: the placeholder renders as nothing, and the words around it stay. A text that reads oddly with a gap is the writer's to word ("Pick up: {wanted}" rather than "Pick up at {wanted} sharp"). No fallback syntax (`{wanted|soon}`): that is the template language the design keeps out; a sentence that needs one is written without the placeholder, or as code.
- **The subject** takes the same placeholders and renders on one line: a newline in a value becomes a space. The mail is plain text, as today (the kit's `html` is optional and unused by the spec's mails), so nothing is escaped in a mail; a call's body is JSON, and a value in it is encoded by the JSON writer, never spliced into a string.
- **A deleted record** fills from the record as it was, as its mail does today.
- **What a path cannot be:** a picture, document or files field (nothing to write), a list of other records (`bookings`), a password or secret kind (`sensitiveKind`), two hops (`customer.company.name`), or a name the model does not have. Each is an error at validation (`unknown-placeholder`, with the fields the model has, or `invalid-placeholder` saying why), as a bad `{path}` in an incoming entry is today. A worked-out field goes as the record page shows it, the same as today's list; what it reads to get there is the page's concern, not the template's.
- **The preview** renders `{by}` as the first sample user's name, `{before.field}` as the sample's own value and a reference from the referenced model's sample; a missing sample renders empty, so the preview shows gaps only where a real mail could have them.
- **A renamed field** is followed in the texts, as the summary's and the entries' references are; a removed field a text uses is refused, naming the text.
- **A text without placeholders** renders as today, byte for byte: a template is only what has braces. A literal brace is not a need the spec has had; `{{` is not a syntax.

The renderer is one small pure function of core, `fillText(text, values)`, used by validation's check, the preview and Studio; the app kit has its own copy of the same twenty lines (a generated app depends on no Smithable package), checked by the adapter's test that renders the same cases alike.

## 4. Safety: the recipient's view

The app's access rules are per model: who may read a model's records is anyone, the users with one of some roles, or a record's owner (`readScope`: all, own, public or none); there are no rules per field beyond the sensitive kinds the mail never sends, and none per row beyond "own". So the check is on what a name reaches, and the rule is that a template never widens what today's mail sends unless the recipient could read it anyway:

- **The record's own fields** (`{field}`, `show`) are the ones today's field list sends to every recipient: no sensitive kind, no files or pictures, no lists. A template cannot bring a sensitive kind back, whoever the recipient is.
- **`{title}`, `{link}` and `{reference}`** are in every mail today (the subject, the foot, the list's references by their titles), so they widen nothing.
- **`{reference.field}`** is the one way to widen, and is allowed in two cases: the field is one the referenced record's title shows (`{customer.name}` where Customer's title is its name: the same words as `{customer}`); or the recipient is a role whose read rule on the referenced model is "all" (the roles listed, or anyone). An "own" read, an owner recipient and an address on the record (an outside person) get neither of the other fields: refused, naming the field and the model ("{customer.notes}: a customer's email may not read Customer's notes"). No proxy through other roles' rights.
- **A role recipient** who may not read the entry's own model is today a warning (the default body would tell them what the record holds). It stays a warning for the default body and becomes an error when the entry has `show` or a text with a placeholder: a deliberate list of fields for a reader who may not see them is a mistake, not an oversight.
- **`{before.field}` and `previous`** follow the field's own rule: `previous` adds the previous values of the changed fields among the ones sent (`show`, or the default list), never a sensitive kind.
- **`{by}`** gives a name, never an address or a role; for an address recipient (a customer told a staff member's name) it is a warning (`by-to-address`), so the builder opts in knowingly.
- **A call** is checked for sensitive kinds only, as its default body is: the target is the app owner's own system. An entry with `format: text` (§7) goes to a channel people read, so its text is checked as a mail to the `admin` role, and the entry must have a text in the content file (an error without one).

Nothing is checked at send time beyond what the kit does today, so a mail is never silently blank: the spec that compiles is the spec that sends.

## 5. The principle: spec, data, settings

Johan's principle, agreed 2026-10-27: **the spec and the content file hold what the app is**, its structure, rules and default wording, checked, versioned and the same in every copy; **the app's data holds what the people running it change day to day**, records and per-business values, as the settings page's; **settings hold addresses and secrets**. A mail's wording sits between: it is the app's default wording, and it becomes the running business's data only when the person running the app is not its builder, as an agency's client is. The kit stores no second copy of a text today because the spec could not see it, a release or an export would not carry it, and two sources drift; Studio, where the builder is, is the administrator's side.

## 6. Later: a text editable in the running app (designed, not built)

When the person running the app is not its builder, one step adds editing without rework: the content file marks the entry's words `editable: true` (the one key there that is not a text, as `generated: false` is on an image), and the words stay the default; an administrator's own version lives in the app's data, edited on the app's settings page with "Back to default" clearing it; the generated app carries each editable text's allowed paths (the list §3 and §4 accepted for that entry) and refuses a saved text outside them with the same words, so an own text can only say less than the spec allows; an own text whose paths a later spec forbids is not rendered and is shown as stale on that page. Rendering reads the own text when there is one, else the content file's, and Activity's line says which. Shopify's notification templates work this way: a default per event, an own version per shop, back to default. The same flag could later mark other everyday texts (opening hours, a banner).

## 7. Chat hooks and other services

- **A chat hook needs no plugin.** Slack's incoming webhook takes a POST of `{"text": "…"}`, as Discord's, Mattermost's and Teams-style hooks do. So a call to a target gets `format: text`: the body is `{ "text": <the entry's text rendered> }` (the subject before it, on its own line, when the content file gives one), with the same headers and signature as any call. The spec names no service; the target's address in the settings says where. `format: json` is today's body and the default.
- **Jira and its kind are plugins**, as [integrations.md](integrations.md) §4.2 says, built one at a time when a tester asks; the plugin fills the issue's summary and description from the same template and its fields from `show`. Custom code and n8n or Zapier on the generic call stay the answer for the rest (§4.3, §5 there).

## 8. Steps and operations

1. **Core:** `show` and `previous` on `OutgoingIR` (the section's reader, validation, schema, `pnpm schema`); placeholders in the content file's outgoing texts (the paths of §3, the checks of §4); `fillText` in core; the spec reference's `outgoing` and content sections; the summary line ("… mails its owner with the booking's number and date"); the operation `setOutgoingBody <entry> [--show field…|none] [--previous true|false]` (`addOutgoing` takes `--show` and `--previous` too); the texts go through `setText outgoing.<entry>.subject …` as every text does. Fable.
2. **Adapter and kit:** the generated entry renders its subject and text with the kit's `fillText` from the record, the previous row (`counts` already has it), the viewer and the referenced records it names; `show` and `previous` in the mail's field list ("Status: ready (was accepted)") and in a call's `record` and `before`; the preview's renderer is the same function. The test-apps flow sends one templated mail and one call with `previous`. Fable or A.
3. **Studio:** the Content panel's outgoing texts show the placeholders the entry may use (from the validator's list) and a preview from the sample record; Smith's reader maps "make the booking mail say …" to `setText`. A.
4. **`format: text`** on a target (§7), with its two checks of §4: a few lines on the kit's call body. After step 2.
5. **Editable in the app** (§6): when a tester who is not the builder asks.
6. **Service plugins** (§7): when asked.

## 9. Undecided

- Whether a mail's field list under a templated text should go by default (`show: none` implied when the text has placeholders), or stay as designed here (listed unless `show` says otherwise; a value named in the text then appears twice). Designed: listed, so an added placeholder changes nothing else.
- Whether `{before.field}` in a text is wanted without `previous: true` (designed: the placeholder alone does not change the list; the list's "(was …)" needs `previous`).
