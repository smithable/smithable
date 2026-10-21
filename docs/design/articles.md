# Articles: pictures on records, Markdown, and an article page pattern (design)

Status: built 2026-09-30 (pictures and the public `where`, Markdown, the `articles` pattern, the booking starter's blog). Proposed 2026-09-29 by Fable. The first step of the company-websites milestone (ROADMAP, "Later") and what a blog, a news page or a knowledge base needs. It adds four constructs to the spec, so it needs Johan's go-ahead (merging this document is that). Each passes ARCHITECTURE §2.4: common on almost every site, deterministic, it replaces custom code a model would otherwise write, it names no technology, and two of the four (pictures and drafts) touch data and access, where generated code is safer than per-app code. Step 2 (Markdown) built 2026-09-30 by Opus: the `markdown` type, the kit's editor (Write and Preview) and formatter (react-markdown, loaded only where Markdown is shown), through a field's own `input` control in the kit's FieldUi; the booking starter's instructor bio is Markdown. The public `where` and pictures on records (step 1, Fable, 2026-09-30) are built too; left of the design: the article pages (step 3), pictures on landing cards (step 4). Step 3 (the articles pattern) and step 4 (the booking starter's blog) built 2026-09-30 by Opus; a new article's address is made from its title when it is saved (in the generated new route, so no other app's form changes), not as the title is typed.

## 1. What people get

- **A picture on a record**: a post's cover, a product photo, an instructor's portrait. Chosen in the record's form, resized in the browser, with a required description (alt text); shown as a thumbnail in lists and cards and large on the record's page.
- **Long text with formatting**: headings, lists, links, emphasis and quotes, written as Markdown with a preview beside it.
- **An article page**: a list of articles with picture, title, date and summary, newest first, and each article at its own address (`/blog/my-first-post`) with its picture, text, and title and description for search engines and link previews.
- **Drafts stay private**: visitors see only published articles, enforced where every read is checked, not only on the page.

Staff write articles where they edit any record: a crud page or the data page. The article page is for reading.

## 2. The spec

```yaml
models:
  Post:
    fields:
      title: string!
      address: string unique            # the article's address; filled from the title when left empty
      summary: text                     # optional; otherwise the body's first paragraph
      cover: picture                    # new type: a picture with its description
      body: markdown!                   # new type: long text with formatting
      publishedOn: date
      status: draft | published
      author: User

pages:
  blog:
    articles: Post                      # new pattern; the long form names fields when they are ambiguous:
    # articles: { model: Post, title: title, body: body, picture: cover, date: publishedOn, address: address }
  posts: { crud: Post, access: [admin, editor] }      # where staff write them
```

```yaml
# smithable.auth.yml
public:
  pages: [blog]
  read:
    - ClassType
    - Post: { where: { status: published } }          # new: visitors read only these records
```

- **`picture`** is a field type. Its value is a stored picture with its description, width and height. It cannot be `unique`, have a default or appear in formulas and searches.
- **`markdown`** is a field type like `text`, shown formatted. Raw HTML inside it is shown as text, never run.
- **`articles`** is a page pattern. The short form reads its fields from their types, never their names (since 2026-10-21, docs/design/inference.md): title is the model's title field (a string), body its one `markdown` field, picture its one `picture` field, date its one `date` or `datetime` field, address its one `string unique` besides the title, summary its one `text` field, author its one `User` field. Validation reports what it cannot infer or finds twice, and the long form settles it. Only title and body are required. Without an address field, articles are at `/blog/<id>`.
- **`where` on a public read** narrows what visitors (and anyone who reads only because it is public) may read, with the same grammar as a dashboard tile: choice values and yes/no fields. Roles and owners that may read the model are unaffected, so staff see drafts.
- Validation warns when an `articles` page is public, its model is public to read, and it has a status or yes/no field but no `where` ("visitors can read drafts").

## 3. How it works

### Pictures are data, not code

A record's picture is uploaded in the running app, so it belongs with the app's data, not in Git: `DATA_DIR/uploads/<model>/<id>-<field>-<hash>.webp`. That settles the question left open on 2026-09-28. Content pictures (a hero, a gallery) stay in `public/images/` as they are, because they belong to the design and are committed with it. `smithable backup` and `restore` already copy `DATA_DIR/uploads`, and the hosted service backs up each app's data volume, so pictures are backed up with no new mechanism.

- **Column:** one text column holding JSON, `{ file, alt, width, height }`, as Drizzle's `text({ mode: "json" }).$type<Picture>()`. Width and height stop the page from jumping while it loads.
- **Upload:** the kit's `PictureInput` reads the chosen file in the browser (`createImageBitmap`), scales it to at most 1600 px on the long side and encodes WebP at about 0.82 quality (`canvas.toBlob`), then sends it with the form. No image library on the server; phones' 12 MB photos never travel.
- **Server checks, trusting nothing from the browser:** WebP only (the `RIFF….WEBP` header and a width and height read from it), at most 1 MB, and the record's write access through the model's data function before anything is written. The file name is made on the server. Replacing or removing a picture deletes the old file after the record is saved; deleting the record deletes its files (`afterDelete`, in the kit, not the project's hooks).
- **Serving:** `/files/<model>/<id>/<field>` is a generated server route that loads the record through the data function, so a picture is readable exactly when its record is: a draft's cover is as private as the draft. `Content-Type: image/webp`, `nosniff`, `Cache-Control` public for records visitors may read, private otherwise, and an `ETag` from the hash. The Content Security Policy already allows `img-src 'self'`.
- **Storage in one place:** saving, reading and deleting a picture's file live in one kit module (`src/kit/uploads.ts`), and nothing else touches `DATA_DIR/uploads`. The scalable deployment mode (ROADMAP, "Later": several instances sharing files) then replaces that module's file system calls with S3 in one place, without an interface built before it is needed.
- **Sample data:** the starters carry a few sample pictures; `pnpm db:seed` copies them into `uploads/` for records whose picture field is filled in the sample rows.

### Markdown

Rendered with `react-markdown` (MIT), without raw HTML, so it becomes React elements and there is no HTML string anywhere to inject into. Headings start at `h2` (the article's title is the `h1`); links to other sites get `rel="noopener nofollow"`; images inside the text are not supported in this version (the CSP would block other sites' images anyway, and pictures go in picture fields). It is loaded only on routes that show a markdown field, so other pages do not pay for it. The form's editor is a textarea with Write and Preview tabs, nothing more.

### Drafts: `where` in the access layer

`modelAccess` gains, per model, the condition under which the public may read. The generated data functions apply it in `list` and `get` when the viewer reads only through `public` (no role and not the owner), exactly where `readScope` is decided today, so every page, search, reference title, landing card, picture and export follows it without knowing about it. The generated `access.test.ts` gains a case per condition: a visitor reads a published record and not a draft; an editor reads both.

### The article pages

For `blog: { articles: Post }` at `/blog`:

| Route | Shows |
|---|---|
| `/blog` | Articles newest first (by the date field, else by creation), 12 at a time with "Older articles": picture, title, date, summary |
| `/blog/<address>` | The picture large, the title, the date and the author's name when there is a `User` field named `author`, the Markdown body, links to the previous and next article, and an Edit link for those who may change it |

- **Frame:** a public article page has the site's frame (the landing pages' header and footer), a signed-in one the app's shell, so the same pattern serves a public blog and an internal news page.
- **Head:** the article's title, the summary as the description, and `og:image` with the picture's absolute address, so links shared in chat apps show a card.
- **Addresses:** when the address field is empty on create, the kit fills it from the title (lowercase, ASCII, dashes) until the writer edits it; uniqueness is the field's `unique`, so a clash is the usual "already taken" message.
- A landing page's records section of an article model links each card to its article, and shows the card's picture when the model has a picture field (every records section gains pictures this way).

## 5. Out of scope, for later

- Comments (visitors add a record linked to the article, with moderation and spam protection).
- Pictures inside the Markdown text, galleries on records, cropping, several sizes per picture (`srcset`).
- Tags and categories as their own pages (a choice field and a list filter cover it for now), search across articles, RSS.
- Scheduled publishing (a daily hook can flip a status today).
- Picture fields in Studio's data view for the preview.
