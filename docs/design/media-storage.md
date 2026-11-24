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
| Its sizes (`width`, `widths`) | the content file, as today | the kit's `srcset` needs them; written by the operation from the service's record, never by a model |
| Crop and focal point | `smithable.ux.yml`: `fit`, `aspect`, `focal`, as today | presentation |
| The renditions' hashes | the service's record of the asset | see below |
| Who may use the file | the service only | the project's files never grant anything |

- **`asset` or `src`, exactly one.** `asset` is `m_` and 26 base32 characters, checked by the
  parser; anything else is refused. `generated` and `kind` keep their meaning (an owner's upload has
  neither). A film (`film: { asset: … }`) takes `asset` the same way, in the video step (§7).
- **Crop and focal point stay named choices** (`focal: center | top | bottom | left | right`), as
  ARCHITECTURE §2.4 decided for media composition: no authored numbers. A free point (two numbers
  set by dragging) is not added now; it becomes a construct of its own only if a concrete case
  passes the five questions. `fit`, `aspect` and `focal` reach the hero too, the same three choices.
- **No hashes in the repository.** What the service needs at a revision is the asset ids in use and
  a hash per rendition. The ids come from the revision's files (`mediaInUse`, §4). The hashes come
  from the service's own record, on one rule the service keeps: **an asset's renditions never change
  under its id.** A new encoding is a new asset; a new rendition size may be added beside the old
  ones, never over one. So an id pins its bytes, the repository carries no list the AI and every
  diff would have to read past, and there is nothing in it to drift from the service's record. The
  workspace's fetch and the service's publish staging check each file against that record; an
  download writes the hashes beside the files it carries (§3).

The five questions, for `asset` as a second way to name a picture's file:

| Question | Answer |
| - | - |
| Common across applications? | Every landing page, gallery and story section shows the business's own pictures. |
| Deterministic? | An id names fixed files; generation writes the same `<img>` for the same values. |
| Reduces ambiguity or AI use? | A slot names one file the AI cannot invent or rewrite (§2). |
| Technology-neutral? | It names a file, not a storage or a provider; the hosting is the host's. |
| Better than free text and custom code? | The same picture component, `srcset`, crop and badge rules serve both kinds of file. |

## 2 Every change through the operation layer

- **`setSectionPicture <page> <section> [item] --asset <id>`** sets a slot to a stored file, as
  `src` does today; another file loses the old one's `generated`, `kind`, `width` and `widths`, and
  `alt` stays unless given. The host fills `width` and `widths` from the service's record of the
  asset; a caller cannot give them with `--asset`. `--was` works as today, so Studio's choice does
  nothing when another file is there by then.
- **A model never names an asset.** The operation schemas offered to a model leave `--asset` out,
  and `setText` refuses a picture's `asset`, which is not text (it may still change a `src`, as
  today). A model can still remove
  a picture or a whole section, so **every operation reports the stored files it releases** (an
  asset the project's files no longer name after it); a batch that releases one is destructive in
  ARCHITECTURE §9.4's sense: shown and confirmed by the person, never applied by itself. An edit
  that does not ask for a picture therefore cannot lose one, whatever the model writes, because
  nothing a model writes reaches the files but operations.
- **Undo** restores the content file and so the reference. Releasing a slot does not delete the
  file or the project's right to use it, which only the library's own delete does, so an undone
  removal shows the picture again.

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
- **The download** is the service's: it adds `media/` with the files of the assets the downloaded
  revision names (by `mediaInUse`, never the whole cache, which may still hold a removed slot's
  files) and `media/hashes.json` beside them, after checking the project's right to each; the
  README's two lines copy `media/` into `public/media/`. The engine has no export of its own to
  change.

## 4 Fetching renditions: the host's call

Engine packages do no I/O (rule 8). Core gives the list; the host fetches.

- **`mediaInUse(files)`** in core: from a revision's content and language files, each asset id
  with the variant names its values need (`w<n>.webp` for `width` and each of `widths`; a film's
  `720.mp4`, `1080.mp4` and `poster.webp`). Pure and deterministic; the service uses the same
  function on the revision it publishes, so the two never disagree on what is in use.
- **The host's `MediaSource`**: `fetch(asset, variant)` returns the bytes and the record's hash.
  The hosted workspace implements it against the service's internal address, which may be in the
  environment; no credential is. The CLI has none, so locally nothing is fetched.
- **The writer** is the host's: it accepts only the fixed variant names and a valid id, writes
  under `public/media/` only, never through a link, checks each file's hash before moving it into
  place, and runs at workspace start and after any operation whose result changes `mediaInUse`.

## 5 The build and the server

- **No renamed copies.** An id's files never change (§1), so `/media/<asset>/<variant>` is already a
  name that holds its content for good. The starters' server gives `/media/` the year-long
  `immutable` cache that `/assets/` has, and the sandboxing policy that `/images/` has. A CDN later
  caches them by the same rule.
- **A missing file** is caught before the build, not by code in the app: the service's publish
  staging refuses an asset it cannot supply, and `smithable validate` names one absent from the
  cache (§3).
- **Range.** A browser plays a video in Safari only from a server that answers a range request with
  206. The starters' production server is tested for it on a `/media/…/720.mp4` (and on
  `/images/`, which a film uses today), and fixed in `server.mjs` if its static handler does not.
  Studio's preview passes the `Range` header through.

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

A hero's film takes `asset` as its picture does. The film's playing rules stay (silent, 3 to 12
seconds, at most 1920 by 1080): they are the hero's design, not a storage limit. The five-megabyte
cap was for the repository's history and does not apply to a stored film, whose size limit is the
service's per level. Longer videos with sound, in a section of their own, are not part of this note.

## 8 Not done here

- Pictures that an app's own users upload into records (`DATA_DIR/uploads/`): app data, unchanged.
- The logo and the image library's pictures: `src` under `public/images/`, as today.
- A free focal point, or a crop per language.
- Moving a project's stored files into `public/images/` to leave the hosted service (`smithable
  detach` or a command of its own): the download's `media/` covers it for now.

## 9 Order of work

1. **Core:** `asset` in the picture grammar and the spec reference; `mediaInUse`; `setSectionPicture
   --asset`; the release report and its confirmation; `setText` refusing `asset`; `fit`, `aspect` and
   `focal` on the hero.
2. **Adapter and kit:** the picture URL and `srcset` from an asset; `public/media` in the starters'
   `.gitignore`; the `/media/` cache and sandbox headers; the Range test and fix.
3. **Hosts:** `MediaSource` and the writer in the workspace; `validate`'s warning for absent files;
   `mediaInUse` for the service's download and publish staging.
4. **Studio:** Replace photo on the preview and the Photos and videos panel, hosted and local.
5. **Video:** `film: { asset }`, the film's checks on a stored file, the panel's videos.
