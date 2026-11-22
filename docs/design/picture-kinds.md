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
- **Each picture still says for itself whether a model made it** (`generated` in `pictures.json`, as
  today). The Photographs style may hold a few generated pictures where no photograph was found. Such a
  picture counts as realistic and generated: it follows the badge rule of `ai-realistic`, and the card
  says how many there are ("2 of 14 made by an image model").

## 3 Where the badge shows

One key, as today: `aiBadge` in `smithable.ux.yml`. What changes is its default, and that the preview
stands apart.

| Where | Realistic generated pictures | Drawn generated pictures | Photographs, the owner's own pictures |
| - | - | - | - |
| Studio's preview | off; shown when the maker switches "Show AI badges here" on | the same | never |
| Staging and live, `aiBadge` not set | on | off | never |
| Staging and live, `aiBadge: true` | on | on | never |
| Staging and live, `aiBadge: false` | off | off | never |

- **The default when the key is absent follows each picture's kind**: on for a generated picture in a
  realistic style, off for one in a drawn style. `smithable explain` and Studio's settings show the
  default in force and why. Setting the key says the same for every generated picture in the app.
- **Switching the badge off while the app has realistic generated pictures asks one confirmation**: a
  single line saying that whether the app's audience must be told is the owner's responsibility. The
  operation records the answer like any other change, and undo brings the badge back.
- **Drawn pictures:** the badge is off by default when publishing, and the owner may switch it on.
- **The preview** is the app in development, and there the kit leaves the badge out. Studio's switch
  "Show AI badges here" is offered whenever the app has at least one generated picture. It is a way of
  looking, kept per person in Studio, not a change to the app: it writes no operation and no commit.
  Studio tells the preview through the channel that already carries selection and a theme being tried;
  the app's own code reads only its build mode and that message, and depends on nothing of Smithable's.
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
visitors will see. The copy itself is the service's work and has its own task; this note fixes only that
the badge rule on staging is live's.

## 6 The publish review: generated pictures standing in for the owner's own work

A starter for a trade shows finished jobs, and those pictures are generated. Published as they are, they
would present work nobody did. So before an app goes live for the first time, and whenever such a
picture is still in place at a later publish, the review lists them.

- **Which pictures:** every placed library picture with `generated: true` whose role is the hero or a
  slot on a public page (a landing gallery, a named job). The role comes from `pictures.json` and the
  page's spec, not from file names. Sample records are not listed: live has none.
- **Per picture:** its thumbnail, where it shows, and two choices: replace it (upload one of the
  owner's own, which then carries no badge), or keep it. Keep is remembered for that file's hash, so
  the review does not ask again until the picture changes.
- The review never blocks publishing. It makes the choice visible once.
- A page must look right with a slot left empty, so "remove" is the third choice where the page's layout
  allows it (the trade starters are built to work with text-only references).

## 7 The mark inside the file

The visible badge can be switched off. The statement in the file cannot be, from Studio.

- **Every generated library picture carries a standard metadata statement that an image model made it**
  (the IPTC digital source type for media made by a trained algorithm), written as the last step of the
  library's pipeline, after scaling and conversion to WebP. Written earlier, it is lost: conversion and
  resizing drop metadata unless told to keep it.
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
2. **Core:** the default of `aiBadge` by kind, said by `explain`; the confirmation on switching it off
   with realistic generated pictures present; the spec reference.
3. **The kit:** no badge in development unless the preview asks; the default by kind in a build.
4. **Studio:** the choice of kind before the style; the line and its overlay; "Show AI badges here"; the
   badge switch with its confirmation.
5. **The publish review:** the list of generated stand-in pictures, with replace, keep and remove.
6. **The service:** the copy of the preview's data to staging, its own task.
