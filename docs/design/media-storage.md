# A business's own pictures and videos: the engine's side

Status: proposed 2026-11-24, not built. Design only. The hosted service keeps a business's own
pictures and videos in private storage per account and makes web copies of them (renditions); its
design is the service's own. This note is what the engine does: where a project says which file is
used where, how that list is changed, fetched, built and downloaded, and what Studio shows. Pictures
first, video second.

## 1 Where it lives: no new file

A section's picture already has one place, and it stays the only one. Today a hero's, a
media-and-text section's, a feature card's and a gallery's picture is written in
`smithable.content.yml` as `image: { src, alt, generated, kind, width, widths }`, and its crop is
presentation in `smithable.ux.yml` (`fit`, `aspect`, `focal`). A stored file is one more way to
say which file it is:

```yaml
# smithable.content.yml
pages:
  home:
    hero:
      image: { asset: m_7f3k2qa9tq0v1m8c4n6p2r5s7w, alt: The shop's front door in winter,
               width: 2400, widths: [480, 960, 1600] }
```

| What | Where | Why there |
| - | - | - |
| Which stored file (`asset`) | the content file, in place of `src` | it is the picture, as `src` is |
| Alt text | the content file and the language files, as today | visible text |
| Its renditions (`width`, `widths`) | the content file, as today | the kit's `srcset` needs them; written by the operation from the service's record, never by a model |
| Crop and focal point | `smithable.ux.yml`: `fit`, `aspect`, `focal`, as today | presentation |
| The renditions' hashes | the service's record of the asset | see below |
| Who may use the file | the service only | the project's files never grant anything |

- **`asset` or `src`, exactly one.** `asset` is `m_` and 26 base32 characters, checked by the
  parser; anything else is refused. `generated` and `kind` keep their meaning (an owner's upload has
  neither). A language file holds a picture's `alt` only, never its `asset` or `src`, so the content
  file alone says which files a revision uses. A film takes `asset` the same way, in the video step
  (§7).
- **`width` and `widths` name renditions that exist.** The service makes the ladder's sizes (480,
  960, 1600, 2400) up to the original's own width; `width` is the largest one made and `widths` the
  others, both copied from the service's record when the slot is set. A size the service adds later
  reaches a slot when the slot is set again; an existing slot keeps naming files that exist.
- **Crop and focal point stay named choices** (`focal: center | top | bottom | left | right`), as
  ARCHITECTURE §2.4 decided for media composition: no authored numbers. A free point (two numbers
  set by dragging) is not added now; it becomes a construct of its own only if a concrete case
  passes the five questions. `fit`, `aspect` and `focal` reach the hero too, the same three choices.
- **No hashes in the repository.** What the service needs at a revision is the asset ids in use and
  a hash per rendition. The ids come from the revision's files (`mediaInUse`, §4). The hashes come
  from the service's own record, on rules the service keeps: **an asset's renditions never change
  under its id**, each rendition's recorded hash is written once and never replaced (a retry, a
  restore or a re-encoding writes no new hash over it), and an id is never given again after a
  delete. A new encoding is a new asset; a new rendition size may be added beside the old ones,
  never over one. So an id pins its bytes, the repository carries no list the AI and every diff
  would have to read past, and there is nothing in it to drift from the service's record. The
  workspace's fetch and the service's publish staging check each file against that record; a
  download carries the hashes beside the files (§3).

The five questions, for `asset` as a second way to name a picture's or a film's file (the same
construct in both: a name for fixed files the service made):

| Question | Answer |
| - | - |
| Common across applications? | Every landing page, gallery and story section shows the business's own pictures; a hero's film is the business's own too. |
| Deterministic? | An id names fixed files; generation writes the same `<img>` or `<video>` for the same values. |
| Reduces ambiguity or AI use? | A slot names one file the AI cannot invent or rewrite (§2). |
| Technology-neutral? | It names a file, not a storage or a provider; the hosting is the host's. |
| Better than free text and custom code? | The same picture and film components, `srcset`, crop and badge rules serve both kinds of file. |

## 2 Every change through the operation layer

- **`setSectionPicture <page> <section> [item] --asset <id>`** sets a slot to a stored file, as
  `src` does today; another file loses the old one's `generated`, `kind`, `width` and `widths`, and
  `alt` stays unless given. The host checks the project's right to the asset with the service and
  fills `width` and `widths` from its record; a caller cannot give them with `--asset`. `--was`
  works as today, so Studio's choice does nothing when another file is there by then.
- **A model never names an asset.** The operation schemas offered to a model leave `--asset` out,
  and `setText` refuses a picture's `asset`, which is not text, and refuses a `src` on a picture
  that holds an `asset` (it may still change a `src` that replaces a `src`, as today).
- **Losing a stored picture is confirmed, slot by slot.** A model can still remove a picture, a
  card or a whole section. Every operation reports each slot (page, section, item) that held a
  stored file before it and holds another file or none after it, whether or not the same file is
  still used elsewhere; a batch with such a slot is destructive in ARCHITECTURE §9.4's sense: shown
  and confirmed by the person, never applied by itself, and applied only to the revision the person
  saw. An edit that does not ask for a picture therefore cannot lose one, whatever the model
  writes, because nothing a model writes reaches the files but operations.
- **`removeMedia --asset <id> [--asset <id>…]`** empties every slot naming the given files in one
  change, so one undo step: the service's take-off after a library delete names every deleted
  file a revision uses at once. A section's picture goes; a gallery's or media-and-text section's
  item goes with its caption, the highest place first so the places before it stay as they are; a
  features card keeps its words and a tile its label; any other slot (a hero's film) goes whole;
  the same in every language file. Each emptied slot is reported and confirmed as above. Its ids
  are a person's choice, so no model is offered the operation at all (`forModels`: an operation
  with a required argument only a person or the host gives). A file named nowhere is no change,
  and the change says so.
- **Undo** restores the content file and so the reference. Releasing a slot does not delete the
  file or the project's right to use it, which only the library's own delete does, so an undone
  removal shows the picture again (after a library delete, the reference shows the reserved frame
  and `validate` names it, §3).

## 3 Local first, and no dependency on Smithable

- **Without the hosted service nothing changes.** `src` names a file under `public/images/`,
  committed with the project, as today; Studio's form uploads into it as today.
- **With it**, the renditions are a fetched cache: `public/media/<asset>/<variant>`, a folder the
  starters' `.gitignore` leaves out. The kit's picture component builds its URL from the values
  alone (`/media/<asset>/w<width>.webp`, `srcset` from `widths`); the app reads plain local files,
  and no URL in the code names a Smithable service.
- **A clone without the cache** still generates and builds; a stored picture whose files are absent
  shows the reserved frame, as a missing `public/images/` file does. `smithable validate` names
  each such asset as a warning.
- **The download** is the service's: it puts in `public/media/` the files of the assets the
  downloaded revision names (by `mediaInUse`, assembled fresh from the service's storage, never
  from a workspace's cache) after checking the project's right to each, and `media-hashes.json` at
  the root beside them: `{"<asset>": {"<variant>": "<sha256 hex>"}}`, keys sorted. The downloaded
  app builds and runs offline as it is. The engine has no export of its own to change; the service
  reads the list from `smithable media in-use --json` run on a checkout of the revision, as names
  only.

## 4 Fetching renditions: the host's call

Engine packages do no I/O (rule 8). Core gives the list; the host fetches.

- **`mediaInUse(files)`** in core: from a revision's content file, each asset id with the variant
  names its values need (`w<n>.webp` for `width` and each of `widths`; a film's `<h>.mp4` for each
  of its `heights` and `poster.webp`, §7). Pure and deterministic; the service uses the same
  function on the revision it publishes, so the two never disagree on what is in use.
- **The host's `MediaSource`**: `fetch(asset, variant)` returns the bytes and the record's hash.
  The hosted workspace implements it against the service's internal address. Each request names
  the workspace's project, an identity the service set when it started the workspace (not
  anything in the project's files), and the service answers only for an asset that project has a
  right to, at every fetch. The CLI has no `MediaSource`, so locally nothing is fetched.
- **The writer** is the host's: it accepts only the fixed variant names and a valid id, writes
  under `public/media/` only, never through a link, checks each file's hash before moving it into
  place, and runs at workspace start and after any operation whose result changes `mediaInUse`. At
  workspace start it asks again for each cached asset; one the service refuses (deleted, or no
  longer the project's) is removed from the cache, so the preview never shows what a publish could
  not.

## 5 The build and the server

- **No renamed copies.** An id's files never change (§1), so `/media/<asset>/<variant>` is already a
  name that holds its content for good. The starters' server gives `/media/` the year-long
  `immutable` cache that `/assets/` has, and the sandboxing policy that `/images/` has. A CDN later
  caches them by the same rule.
- **Publish staging is clean.** The service's publish builds from the revision with a
  `public/media/` assembled from `mediaInUse` and its own storage, after checking the project's
  right to each asset, never from the workspace's cache, which may still hold a removed slot's
  files. It refuses a revision naming an asset it cannot supply; `smithable validate` names one
  absent from a local cache (§3).
- **Range.** A browser plays a video in Safari only from a server that answers a range request with
  206. The starters' production server and Studio's preview are each tested on a
  `/media/…/720.mp4` (and on `/images/`, which a film uses today): a range request gets 206 with
  the right bytes, `Content-Range`, `Content-Length`, `Accept-Ranges: bytes` and `video/mp4`;
  `server.mjs` is fixed if its static handler does not, and the preview passes `Range` on and the
  206 and its headers back. The service's MP4 renditions keep their index at the front
  (fast start) in a codec Safari plays; playing and seeking are tried in WebKit where the test
  machine has it.

## 6 Studio

- **Replace photo** on the preview: a selected picture offers it beside the section's form. It opens
  the Photos and videos panel as a chooser; choosing or uploading there runs `setSectionPicture`
  with `--asset` (hosted) or with a new file under `public/images/` (local).
- **The Photos and videos panel** lists the files to choose from: the account's library on the
  hosted service, with each one's state while it is processed and where in this project it is used
  (from `mediaInUse`); the project's `public/images/` locally. Upload and delete are the service's;
  delete says which published sites still show the file before it asks.
- Release review (picture-kinds.md §6) treats a stored file as the owner's own picture.

## 7 Video, the second step

A hero's film takes `asset` as its picture does: `film: { asset, heights: [720, 1080] }`, where
`heights` names the MP4 renditions the service made (1080 only from a source at least that tall),
filled by the operation from the record as a picture's `widths` are; `poster.webp` is always made.
The film's playing rules stay (silent, 3 to 12 seconds, at most 1920 by 1080): they are the hero's
design, not a storage limit. For a stored film the renditions meet the size and the silence: the
service makes them at most 1080 high and strips their sound, so the source may be larger and may
have sound (its record says so, and the panel says the film plays without it). The record holds
the duration, the source's size, whether it had sound and the renditions made; the operation
refuses an asset whose length is outside 3 to 12 seconds or with no rendition and poster on
record, so no check needs the file at hand. The five-megabyte
cap was for the repository's history and does not apply to a stored film, whose size limit is the
service's per level. Longer videos with sound, in a section of their own, are not part of this note.

## 8 Not done here

- Pictures that an app's own users upload into records (`DATA_DIR/uploads/`): app data, unchanged.
- The logo and the image library's pictures: `src` under `public/images/`, as today.
- A free focal point, a crop per language, or a picture per language.
- Moving a project's stored files into `public/images/` to leave the hosted service (`smithable
  detach` or a command of its own): the download's `public/media/` covers it for now.

## 9 Order of work

1. **Core:** `asset` in the picture grammar and the spec reference; `mediaInUse`; `setSectionPicture
   --asset`; the slot report and its confirmation; `setText` refusing `asset`, and `src` over an
   `asset`; `fit`, `aspect` and `focal` on the hero.
2. **Adapter and kit:** the picture URL and `srcset` from an asset; `public/media` in the starters'
   `.gitignore`; the `/media/` cache and sandbox headers; the Range tests and fix.
3. **Hosts:** `MediaSource` and the writer in the workspace, with the project's identity on each
   fetch; `validate`'s warning for absent files; `mediaInUse` for the service's download and clean
   publish staging.
4. **Studio:** Replace photo on the preview and the Photos and videos panel, hosted and local.
5. **Video:** `film: { asset, heights }`, the record's checks for a stored film, the panel's videos.
6. **Take-off:** `removeMedia` in core, for the service's take-off of deleted files (its own note in
   the service).
