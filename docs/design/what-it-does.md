# "What it does" does everything the spec can

Design, 2026-10-15 (Fable). Johan, 2026-10-15: the highest priority is that "What it does" can do everything the spec can; perhaps it needs a redesign that starts from the spec; try it on an experimental branch first. Status: to build (A, backlog A 117), on a branch, shown before it merges. Supersedes studio-v2.md §5 where they differ.

## 1. What is wrong today

"What it does" is the summary read aloud: sentences made from the spec, with a properties panel behind a click on some parts and a few "add" buttons that send the person to the Changes tab. It covers what someone thought of writing a sentence and a control for. Everything else is "describe a change" to a model, or Code mode. So the No code mode can do less than the spec, and nobody can tell what it cannot do until they try.

## 2. The rule

Start from the spec, not from the sentences. The spec is a tree whose shape is known: every section registers a JSON Schema with a description on every key (core's `buildJsonSchema`, and since #387 the companion files' schemas too). "What it does" is that tree shown as forms:

- **The sections are the spec's top-level keys**, as the summary groups them today: the app, its kinds of record, pages, actions, queries, navigation; and from the companion files sign-in and access, the look, the texts. The order is the spec's.
- **Every key is a control**, labelled in plain language by its description, and of the kind its schema says: a fixed set of values is a select or a row of choices (a field's kind, a page's kind, roles, icons, tones); a yes or no is a checkbox; a list is chips with an add box; a number is a number box with its bounds; free text is a text box; a named map (the models, the fields of a model, the pages, the actions, a landing page's sections) is a list of entries, each opening its own form, with "Add" at the end. A key with alternatives (a field in its short or long form) shows the long form's controls and writes whichever form is shorter.
- **Every value is reachable**: if the spec can hold it, the form can enter it. The test of the design is a script that walks the schema and fails on any key without a control.
- **Validation as you type**: the same validator the editor and the CLI use runs on each change, and a problem shows beside the control it is about, in the validator's words (names checked where typed, as A 23 did for identifiers). A control never offers what the validator would refuse: the roles are the auth file's, a page's model is one the spec has, a column is a field of the page's model.
- **Each change is one operation**: a control maps to the operation that sets its value (setAccess, setDefault, addField, setText and the others); where no operation covers a key, the control writes that part of the file through `editSpec` of the part (the file with that subtree replaced), which goes through the same checks, the checkpoint and undo. The Changes tab lists them as today. The summary's sentence for a part is kept beside its form, so the person sees what their change says.
- **Adding is the same form**, prefilled with its group: "Add a field" under a kind of record opens the field form; the kind of the thing (a field's type, a page's kind) is chosen first and then locked, since another kind is another form; a change of kind is a remove and an add, said so. Nobody is sent to the Changes tab.
- **The sentences stay**: the summary is the app in plain language and the words of every change in the trace. "In my own words" goes (Fable 22): a sentence is a map to its form, never a text to edit.

## 3. What the form cannot do, said where it stands

- **Custom code** (a custom action, a page or section of your own, a query by code): the form offers it as a choice, warns on the spot that this is code the app's maker writes and the app's tests run, links to the docs page for it, and once the stub is made shows the file's path with "Open in your editor" (a `vscode://file/<path>` link for those who have it, and the path to copy for the rest). Code mode's editor stays for the spec files: completion and checking for TypeScript need the language service with the app's types in the browser, which is the person's editor's job; Studio does not try.
- **Rules** (free text in `rules`): a text box as today, with the advice design's notes beside it (advice.md).
- **What a model does from a sentence**: "Describe a change" stays as the way to say several things at once in words; it proposes operations the form could have made, shown before they apply.

## 4. Where it lives

- `apps/studio/src/builder/`: the form is built from the schema at run time (`buildJsonSchema()` and the companion schemas, both in the tab already for Code mode), with a small table of control kinds by schema shape and a table of key to operation; the properties panel (`properties.tsx`) becomes one such form, no longer written by hand per concept.
- Core: the operations' argument schemas say which operation sets which key; where that is not derivable, a `sets: ["models.*.fields.*.required"]` on the operation makes it so, and a test checks every schema key is covered by an operation or by the editSpec fallback. `editSpec` of a part is a new argument, `path`, of the existing operation (the part to replace), no new operation.
- The preview re-renders only when what it shows is touched (A 116c); a form change to another page leaves the place.

## 5. Steps

1. (Done, 2026-10-15, opus/what-it-does.) The form from the schema, read-only, beside today's summary: every key shown with its label and value, on the experimental branch; the walk script that fails on a key without a control. This is where Johan looks first.
2. (Done, 2026-10-15; Johan: the form becomes the real controls.) The controls write through operations: for now every key through `editSpec` with its `path`, the specific operation per key next; a refusal in Studio's message bar; a named map's entry added by its name.
3. The properties panel and the Changes tab's forms replaced by the same forms; "In my own words" removed.
4. Custom code's warning, docs link and file link.

## 6. ARCHITECTURE §2.4

No construct is added: the form shows the spec that exists. `editSpec` gains a `path`, an argument of an existing operation.
