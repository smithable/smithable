# What the engine infers, and how

Status: decided 2026-10-21 (Johan: no assumptions about field or role names in the code; what the spec leaves out is read from its shape, as an implicit setting, and everything stays explicitly configurable). Step 1 (the record's title) built; the others follow in the same series.

## 1. The rule

The engine fills what a spec leaves out, so a first app needs few words. Three things hold for every such default:

1. **It is read from the spec's shape only**: the fields' types, their order, their rules, the roles' grants. Never from what a field or a role is called. A field named `title` is a short text like any other; one named `price` is a money field like any other.
2. **It has an explicit key.** Whatever the rule settles, the spec can say outright, and the explicit word wins. The key is one a person would write without knowing the rule exists.
3. **It is shown.** `smithable validate --explain` says what each rule settled and whether it was written or read; the plain-language summary says what was written.

A default is **written out** by `smithable upgrade` where a later change of the spec would move data or access: an index, a counter, a scope, a grant. Where the default only shows something (a title, a column), it stays a rule, and the upgrade writes it only when a rule's change would pick another field than before, so an app keeps what it had.

## 2. The rules, one by one

| What | Explicit key | By rule (shape only) | Shown by | Frozen by upgrade |
|---|---|---|---|---|
| A record's title | `Model.namedBy: field` (`setNamedBy`) | the first stored short text field, else the first stored long text, else the number | `--explain`; the summary when written ("A customer is known by its company") | where the rule before 2026-10-21 (a short text called like a name or title) picked another field |
| Where a value is unique | `unique: owner \| app`; `unique: [{ fields, scope }]` (`setFieldRules --unique`, `setUnique`) | `true`: per owner when the model's records are read by their owners only, else in the whole app | `--explain` | always (an index moves) |
| Who runs a standard action | a role's `actions` grant (`grant <role> actions <name>`) | the roles that write the model, and the record's owner | `--explain` ("run by …") | `actions: all` becomes the list where `all` would widen |
| What a conversation reads | `Model.thread: { body, author, side }` (`setThread`) | the first long text; the first field that refers to a person, else the first email; the first two-valued choice | `--explain`, the summary, the `thread-ambiguous` warning | no (presentation) |
| An articles page's parts | the long form `articles: { model, title, body, picture, date, address, summary }` | title: the model's title field; body: the one markdown field; picture, date: the one field of the kind; address: the one unique string; summary: the one text (next step; today title, address and summary also match names) | the error names the long form when a part is missing or found twice | no |
| An order page's price, quantity and asked fields | `order: { from, price, quantity, ask }` | the one money field; the one whole number; the fields a customer can fill (next step; today `price`, `quantity` and `status` are matched by name) | the error names the key when a part is found twice | no |
| An article's author | the long form's `author` (next step; today a User field named `author`) | the one field that refers to a person | the page shows it or not | no |
| A calendar's `starts`, `ends`, `title` | the long form | the one date or date-time field; the model's title field | the error names the long form | no |
| Sample values for a first app | a `samples/<Model>.csv` file | by the field's type; the field's name only shapes the sample text (a presentation choice, nothing the app does depends on it) | the generated samples | no |

Not inferences: `admin` and `owner` are reserved names the spec reference defines, like `id` and `createdAt`; a field's type (`email`, `money`) is what the spec says, not a guess.

## 3. Why `namedBy`, not `title`

A model's `title` is already a text in `smithable.content.yml` (how the kind of record is called on its pages), and the content file holds every visible word. `namedBy` says what the key does, the way `ownedBy` does: which field names a record.

## 4. Steps

1. **The title** (built): `namedBy` on the model, `setNamedBy`, `titleField` by shape, `writeNamedBy` in `smithable upgrade`, `--explain` saying written or by rule, the summary sentence, this note.
2. **Articles and the author**: the short form's parts by shape; `author` in the long form; the old name matches go.
3. **The order page**: `price`, `quantity` and `ask` by shape and by key; the old name matches go.
4. Studio: the model's form offers `namedBy` and `thread` (A 128 with the unique forms).
