# Picture kinds and the AI badge: what an app's pictures are, and where the badge shows

Status: proposed 2026-11-22, not built. Design only. It follows Johan's decision of 2026-11-21 and
replaces first-look.md §5 ("The AI mark"), whose last line left "showing the mark differently per stage"
to a note of its own. It builds on first-look.md §4 (image styles, `pictures.json`, `setPictureStyle`).
The hero with the app's name and icon on it is a separate section, not written yet.

## 1 What changes for the user

- Studio asks **what kind of pictures** the app has before it asks which style. There are three kinds:
  AI pictures that look real, AI pictures that are drawn, and real photographs.
- **The preview in Studio shows no AI badge.** The published app does, by a default that follows the
  kind: on for pictures that look real, off for drawn ones. The owner can switch it either way.
- Beside the choice of realistic AI pictures stands one line, "An AI badge may be needed", with a
  question mark that opens an overlay explaining it (§4).
- Before an app goes live, the publish review lists the generated pictures that stand where the owner's
  own work will be (the hero, a gallery of finished jobs). The owner replaces or keeps each one (§6).
- A generated file says in its own metadata that an AI made it, whatever the badge switch says (§7).

## 2 The three kinds

| Kind | Shown in Studio as | Styles today | Made by an image model | Looks real |
| - | - | - | - | - |
| `ai-realistic` | AI pictures, realistic | Lifelike | yes | yes |
| `ai-drawn` | AI pictures, drawn | Pastel, Ink wash | yes | no |
| `photograph` | Real photographs | Photographs | no | yes |

- **The kind is a field of the style in the library's index**, beside the field that already says whether
  an image model makes the style. Studio and the engine read it from there. Nothing is inferred from a
  style's name.
- The kind is not a new key in the app's spec. `pictures.style` already names the style, and the style
  has one kind. Studio's choice of a kind only narrows the list of styles shown next. A kind with one
  style on offer applies that style at once.
- **Real photographs** is the kind's name in Studio. Its card carries the licence line (CC0: free to use,
  no credit required), and the app keeps its credits file as today.
- **Stock pictures** (a bought licence) are used only in Smithable's own showcase starters. They are
  never offered in the picker and never written into a user's project, as first-look §6 already rules.
- The picker offers a kind only when the library has a complete set for the app in at least one of its
  styles (first-look §4.1). A kind with no complete set is shown as not available yet, not hidden, so
  the three choices stay in the same place.
- **Sample pictures in the app's data** (a product's photo, a finished job) follow the same style as the
  hero. For almost every app the realistic kind is the sensible one for these, since the samples stand
  for photographs the owner's users will upload. They exist in the preview, and on staging when the
  owner copies the preview's data there (§5). Live never gets them.
- **Each placed picture records its own kind.** `pictures.json` gets `kind` per file beside `generated`,
  written when the picture is placed, from the library's entry. So the app's own files say what each
  picture is, and neither generation nor the built app ever asks the library.
- The Photographs style may hold a few generated pictures where no photograph was found. The library
  marks such an entry `ai-realistic`, and it is recorded so. A style's kind is therefore what most of
  its pictures are and what the picker shows; the badge always follows the picture's own record. The
  card says how many there are ("2 of 14 made by an image model").
- For apps made before this, the host fills `kind` in once from the library version the record names,
  as first-look §4.2 rebuilt the record itself.

## 3 Where the badge shows

One key, as today: `aiBadge` in `smithable.ux.yml`. What changes is what an absent key means, and that
Studio's preview stands apart. The columns are each picture's recorded kind (§2).

| Where | `ai-realistic` | `ai-drawn` | `photograph`, the owner's own pictures |
| - | - | - | - |
| Staging and live, `aiBadge` absent | on | off | never |
| Staging and live, `aiBadge: true` | on | on | never |
| Staging and live, `aiBadge: false` | off | off | never |
| Studio's preview | hidden, until the maker switches "Show AI badges here" on; then as the row above that applies | the same | never |

- **Three states, kept as they are.** The key is absent (each picture's default by its kind), `true` or
  `false`. The schema gives it no default value, so absence survives a round trip. Today an absent key
  means on; after this an app with only realistic generated pictures behaves the same, and an app in a
  drawn style loses its badge unless it sets `true`. The pull request that changes this says so in the
  release notes.
- **The operation is `setAiBadge { value: on | off | default }`.** `default` removes the key. Undo
  restores the earlier state, absence included, since it restores the file.
- **Switching off with realistic generated pictures present needs an acknowledgement.** The operation
  takes `acknowledged: true`; without it, when any placed picture is `ai-realistic`, it is refused with
  the one line: whether the app's audience must be told is the owner's responsibility. Studio shows that
  line as a confirmation and the command line takes `--acknowledge`, so both record the same thing in
  the operation's history.
- **How the app knows:** generation writes each picture's `generated` and `kind` where the app already
  reads `generated`, and the setting's state, all from the project's own files. The kit decides per
  picture: badge when generated and (the setting is on, or the setting is absent and the kind is
  `ai-realistic`). Identical files give identical output, and nothing of Smithable's is read at run time.
- `smithable explain` and Studio's settings show the state in force and, when it is the default, how
  many pictures of each kind it badges.
- **Studio's preview.** The app always works out the published rule. Studio's preview frame asks it to
  hide the badges, and "Show AI badges here" stops asking, so the maker then sees exactly what will be
  published. It is a way of looking, kept per person in Studio: no operation, no commit. The request
  travels the channel that already carries selection and a theme being tried, is honoured only in a
  development build, and is known before the first paint so no badge flashes. An app run in development
  outside Studio gets no such request and shows the published rule.
- The badge itself is unchanged: the EU's label for AI-generated content, as the kit draws it today,
  with the smaller disc alone on small pictures. A logo is never badged.
- Pictures a person uploads carry no badge. Smithable does not know how they were made.

## 4 The overlay behind the question mark

It opens from the line "An AI badge may be needed" in the picker and from the badge switch in the app's
settings. It holds, in this order:

1. what the badge is, with the label shown at the sizes the app uses;
2. a link to the rule it comes from;
3. where it shows: not in Studio's preview, on by default in the published app for pictures that look
   real, off by default for drawn ones;
4. that the owner can switch it off, and that the choice is theirs to answer for;
5. that the file's own metadata says an AI made it either way (§7).

The words are Studio's, in its language files. Their wording is reviewed before the overlay ships.

## 5 Staging

Staging and live each have their own data, and a published app starts empty. That stays. New: when
publishing to staging, the owner may ask for **a copy of the preview's data**, sample pictures included.
It is one way and happens only when asked; staging and the preview never share data, and live is never
offered the copy. Staging shows the badge by the same rule as live, so the owner sees there exactly what
visitors will see. The copy itself is the service's work and has its own design and task, which must say
what happens to records already on staging, what a second copy does, and how the copy is taken back.
This note fixes only that the badge rule on staging is live's.

## 6 The publish review: generated pictures standing in for the owner's own work

A starter for a trade shows finished jobs, and those pictures are generated. Published as they are, they
would present work nobody did. So before an app goes live for the first time, and whenever such a
picture is still in place at a later publish, the review lists them.

- **Which pictures:** every placed library picture with `generated: true` whose recorded role is
  `hero` or `work`. `work` is a new role in `pictures.json` beside `hero` and `sample`: a picture in
  a slot that presents the owner's own work (a landing gallery of jobs, a named project). The slot says
  so in the page's spec, explicitly, and a starter sets it; it is never guessed from a name or from where
  the picture sits. Decorative pictures and sample records are not listed.
- **Per picture:** its thumbnail, where it shows, and the choices: replace it (the owner's own picture,
  which then carries no badge), keep it, or, where the slot is optional in the page's spec, remove it.
  The trade starters are built so a page reads well with text-only references.
- **Each choice is an operation**, so it is in the history and can be undone. Keep writes `kept` on that
  placement in `pictures.json`, with the hash of the library original, so a recoloured copy of the same
  picture does not ask again and a different picture in the slot does.
- **The review never blocks publishing.** An item left unanswered is published as it is and listed again
  at the next publish.

## 7 The mark inside the file

The visible badge can be switched off. The statement in the file cannot be, from Studio.

- **Every generated library picture carries a standard metadata statement that an image model made it**:
  the IPTC digital source type for media made by a trained algorithm, as XMP in the WebP file. It is
  written as the last step of the library's pipeline, after scaling and conversion. Written earlier, it
  is lost: conversion and resizing drop metadata unless told to keep it.
- **Any later step that encodes the picture again writes the statement again and checks it**: the
  recolouring of theme-pictures.md is one. A recoloured file without it is a failed recolouring.
- **An image model's own invisible watermark is not relied on.** Whether it survives enlarging a hero,
  cropping and re-encoding depends on the model and is not something the library can promise. The
  library's check reports what it finds on a sample of files today, as information.
- The engine and the kit never strip metadata from a placed picture. The kit's responsive sizes, where a
  host produces them, are derived files; they keep the statement where the tool can, and the original
  placed file always has it.
- An owner's uploaded picture is passed through as it is; nothing is added or removed.
- `pictures.json` already records `generated` per file, so the app's repository says the same thing in
  plain text.

## 8 Not done

- A badge choice per picture or per page: one key per app, with the kind's default.
- Telling whether an uploaded picture was generated.
- Different badge behaviour on staging and live.
- Changing the label's drawing, colour or minimum size.
- Data flowing back from staging to the preview: only as a separate, explicit action, if it is asked for.

## 9 Order of work

1. **The library:** `kind` on each style in the index (`ai-realistic`, `ai-drawn`, `photograph`); the
   metadata statement as the pipeline's last step, with a check that every generated file has it; the
   report on what marks survive today.
2. **The host:** `kind` per file in `pictures.json` at placement, and filled in once for older apps.
3. **Core and the kit:** `setAiBadge` with its three states and the acknowledgement; the absent key's
   meaning by each picture's kind, said by `explain`; the role `work` and `kept`; the kit's rule per
   picture and the preview's request to hide; the spec reference.
4. **Studio:** the choice of kind before the style; the line and its overlay; "Show AI badges here"; the
   badge switch with its confirmation.
5. **The publish review:** the list of generated stand-in pictures, with replace, keep and remove.
6. **The service:** the copy of the preview's data to staging, its own task.
