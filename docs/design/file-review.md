# Files reviewed before others see them

Design, 2026-10-09 (Fable). Johan's idea and go (2026-10-09): pictures and documents that other people would see can be held for review when the maker chooses so; the rule lives on the model; an admin page lists what waits; reviewers are told. Johan's two follow-ups settled here too: a required picture holds the record, not only the file; no virus scanner on the hosted host for now, only the hook. A builds it (backlog A 60), Fable reviews the core part.

## 1. The rule, in smithable.yml

```yaml
models:
  Listing:
    fields:
      title: text required
      photo: picture required
      contract: file
    review: [photo]        # or review: all (every picture, file and files field)
```

- `review` names the model's picture, `file` and `files` fields whose uploads are held until a reviewer approves them, or `all`. A name that is not such a field is an error (`review-not-file`); `all` on a model with no file field is a warning (`review-nothing`).
- **Required decides what is held.** A reviewed field that is `required` holds the **record**: a listing without its picture is not a listing, so until the file is approved the record is out of lists, search, dashboards, calendars, the API and the assistant's tools for everyone but its owner and the reviewers; its owner sees it marked "Awaiting review". A reviewed field that is optional holds only the **file**: the record shows as usual, and to others the picture is a blank saying "Awaiting review" and the document is not offered.
- A new upload, and a file replacing one, starts pending. Approval makes it visible. Rejection removes the file, leaves the field empty, and shows the reviewer's reason to the owner on the record until the next upload.
- The maker's own uploads are reviewed like anyone's unless the maker is a reviewer. Sample data is approved from the start.
- It is functionality, so it is in `smithable.yml`, like `required`; who reviews is access, so it is in the auth file (§3).

## 2. The Review page

```yaml
pages:
  review:
    review: all            # or a list of models: [Listing, Post]
```

A reserved page like `users` and `data`: for admins, and for the roles granted `review` (§3); `pages: all` in a role's grants does not open it, as with the other admin pages. It lists what waits, newest first: the file (a picture or a PDF shown inline under the sandbox policy, a document as a download), the record's title with a link, who uploaded it and when, and two buttons: **Approve**, and **Reject** with an optional reason. Approved and rejected files are kept in the page's second list for thirty days (the audit log keeps the rest). The menu entry carries the number waiting, which is the in-app notice; apps get no inbox for this.

## 3. Who reviews, in smithable.auth.yml

```yaml
roles:
  admin: all
  moderator:
    review: all            # or [Listing]: may approve and reject those models' files, and opens the Review page for them
```

`review` is a seventh grant key beside `pages`, `read`, `create`, `write`, `delete` and `actions` ([access-in-auth.md](access-in-auth.md)); `admin: all` includes it. The operation is `grant <role> review <models…|all|none>`.

## 4. Telling the reviewers

Through the outgoing mail that exists ([integrations.md](integrations.md) §4.1b), as a built-in event, no spec line needed: when a file starts waiting, each reviewer who may review it gets at most one mail every fifteen minutes, "3 files await review in Acme Market", with a link to the page. Texts in the content file under `review: { subject, text }` with defaults. Without mail configured, the badge alone.

## 5. Virus scanning: a hook, no scanner

Files are never run by the app, pictures are re-encoded in the browser, documents are served as attachments under a sandbox policy, SVG is refused: the app is not at risk; a person who downloads another person's document is, first of all the reviewer. Most uploads come from invited members who know each other, so no scanner on the hosted host now (Johan, 2026-10-09). The upload path gets one hook: when `SCAN_URL` is set, the file's bytes are sent to it before anything is stored, and any answer but OK refuses the upload with "This file was refused by the virus check." A scanner (ClamAV's clamd behind a small HTTP front) can then be added to the hosted service when an app with open sign-up and document uploads is published, or to a self-hosted Compose file, with no change to any app. attachments.md and the terms keep saying files are not scanned.

## 6. The five questions (ARCHITECTURE §2.4)

1. **Real need:** a marketplace, a community site, a job board, a support portal: anywhere strangers upload what others see.
2. **Not expressible today:** a file's visibility follows its record's; no status field or rule can hold a file, or hold a record on a file's account.
3. **Deterministic:** a table and a filter generated from one key; no model involved.
4. **Framework-neutral:** the IR says which fields are reviewed and who reviews; the adapter decides the table and the queries.
5. **Undoable:** `setReview`, `addPage review` and `grant` are operations like any; approving and rejecting are data, in the audit log, with the file gone on rejection (said in the dialog).

## 7. What A builds

1. **Core:** `review` on the model (`all` or fields; the validator's two codes), the `review` page pattern (reserved, `review: all | [Model…]`, access through the grant), the `review` grant key, `setReview <Model> <fields…|all|none>`, Studio's chips ("Reviewed before others see it" on a file field's details) and the summary's words ("Photos of listings are reviewed before others see them; a listing waits until its photo is"), phrases for "review photos before they are shown". Spec reference, access-in-auth.md's key list, ARCHITECTURE §3.1 one line. Fable reviews this part.
2. **Adapter:** a `file_reviews` table (model, record, field, file, state, reason, by, at), generated only when a model has `review`; the hold in the data function's access filter (a held record is unreadable to all but owner and reviewers; a held file answers 404 to them, the form and the table show "Awaiting review"); the page with Approve and Reject (standard actions, audit-logged; Reject deletes the file); the badge; the mail digest; the `SCAN_URL` hook in uploads.ts.
3. **Tests:** test-apps on the marketplace example (a stranger's listing with a required photo: unseen by a visitor and in the API, seen by its owner marked; approve, seen; reject with a reason, the owner reads it; an optional document on another model held alone); a Studio step for the chip; units for the validator codes and the grant.
4. **Example and docs:** `examples/marketplace` gets `review: [photo]` on Listing and a `review` page; the site's attachments page gets a section; the Starters page's marketplace line says listings are reviewed.
