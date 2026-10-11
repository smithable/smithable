# Ask on by default, and how it behaves in the spec (design)

Johan, 2026-10-11: "the assistant should be on by default and it should be supported in no-code
as well. How the assistant behaves should be included in spec." The assistant itself is built
(`assistant.md`); this note settles the default, which file says what, and what stays the
host's. The no-code control is backlog A 95; the model cascade is B 35.

## 1. On by default, without changing what an absent block means

Every new app gets the block written in:

```yaml
# smithable.auth.yml
assistant:
  for: signed-in          # everyone who signs in; may: read is the default
```

- `smithable new` writes it: the seven starters carry it in their auth files (C), and a drafted
  app gets it from the blank the draft starts from (`BLANK` in `draft-operations.ts`), so
  `--describe` and `--from` apps have it too. `signed-in` rather than `anyone`: visitors are
  answered by the rules only, and a public app's owner decides about them.
- An absent block keeps its meaning, off. An app made before this keeps what it has, and an
  engine upgrade changes nothing: a CHANGELOG line under the engine, not a breaking change of the
  spec file.
- A self-hosted app with no model configured (`ASSISTANT_URL` unset) shows the panel and answers
  by the wording rules, as `assistant.md` §5 designed; the one line it says when a question
  needs a model is for the person, not the owner: "The app's assistant has no model yet; ask
  whoever runs the app" (today's `noModelToAsk` names the environment variable). The app's
  README keeps the owner's instructions.

## 2. What the spec says, by file

Each companion file keeps its concern (CLAUDE.md rule 1):

| Where | Keys | Meaning |
|---|---|---|
| `smithable.auth.yml` `assistant` | `for`, `may` | who gets it and what it may do (as today) |
| `smithable.content.yml` `assistant` | `name`, `greeting`, `placeholder`, `about` | its visible texts, in the app's language: the panel's name ("Ask" by default), the first line it shows, the input's placeholder, and one sentence of what it is for, shown under the greeting and given to the model |
| `smithable.ux.yml` `assistant` | `voice: plain \| friendly \| formal` | its manner, as a theme is a manner: `plain` (the default: short, no pleasantries), `friendly`, `formal` |

The five questions (ARCHITECTURE §2.4): the manner is wanted in every app that has the panel;
each voice is a fixed set of prompt lines, so the behaviour is deterministic; three choices
leave nothing to interpret, where a free sentence of style would be sent to the model as is
(an owner's text in the system prompt, a wording to argue about); nothing names a model; and
the one free text that is wanted, what the assistant is for, is `about`, visible to the person
too, so it is content, not a hidden instruction. Limits, the model's name and the routing are
not in any file: they are the host's (§4).

The summary's sentence grows with it: "Everyone who signs in can ask the app questions as
Nova; it changes nothing. It answers plainly." The panel reads its texts from the content file
as every kit text is read, through the words of the app's language when the content says none.

## 3. Operations and the no-code control

- `setAssistant [roles… | signed-in | anyone] [--may read|change]` stays (auth).
- `setAssistantTexts [--name …] [--greeting …] [--placeholder …] [--about …]` (content; a bare
  flag clears one).
- `setAssistantVoice plain | friendly | formal` (ux).
- In Builder the Who can tab's Ask block (A 95) holds all of it in one place, since it is one
  feature to the person: off / for roles / signed-in / anyone; read or change; the name, the
  greeting, the placeholder, the sentence; the voice as three choices; the cost line. It writes
  the three operations.

## 4. What stays the host's

The model's address, key and name, the limits per person and per app, and the cascade between
a cheap and a better model (B 35) are environment and service settings: they decide cost and
where a question goes, which is the host's business and the project's AI policy (`eu-only`
keeps a cascade on EU models), never the app's spec.

## 5. Tests

Units: the two operations (set, clear, a refused voice); the summary's sentence with a name and
a voice; the content and ux schemas. test-apps: every starter's auth validates with the block,
and the generated app's panel shows the content's name and greeting. test-studio: the Who can
block (A 95). bench-ask: a run per voice on one starter, to see that the manner does not cost
accuracy (C).

## 6. Steps

1. Core: the content and ux fields, the two operations, the summary's sentence, the spec
   reference's lines, the JSON Schema (`pnpm schema`). (Fable or A.)
2. The kit: the panel's texts from the content file, the voice's prompt lines in
   `assistant.server.ts`, the person's line for a missing model. (A.)
3. The starters' auth files and the draft's blank; the CHANGELOG line. (C, with 1.)
4. A 95, the Who can block, with the texts and the voice. (A, after 1.)
5. B 35, the cascade, measured by C. (B.)
