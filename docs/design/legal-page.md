# The privacy page, written from the app

Design, 2026-10-06 (Fable; Johan's go the same day). Built with the design: `legal: privacy`.

## 1. What it is

A page every public app needs and nobody wants to write: who runs the app, what it stores about people and why, cookies, mail, logs and backups, and what a person may ask for. Smithable knows most of it from the app's own definition, so the page is generated from it and stays true when the app changes. The maker adds what only they know: who they are.

```yaml
pages:
  privacy:
    route: /privacy
    legal: privacy
```

```yaml
# smithable.content.yml
pages:
  privacy:
    title: Privacy
    operator: { name: Calm Yoga Studio Ab, address: Torggatan 1, 22100 Mariehamn, email: hello@calmyoga.example, country: Åland, Finland, hosting: in the EU }
    more: { title: Pictures, text: Photos from classes are published only with your written consent. }
```

## 2. What the page says, and where each fact comes from

| Part | From |
|---|---|
| Who runs it | the content file's `operator` (name, address, email, country); the app's purpose from `app.description` |
| Your account | the auth file: sign-in providers (a code by mail, Google), invited-only; what an account holds (name, address, role) and the session cookie |
| Information in records | every model with an email or phone field or a field referring to a user: the model's label, the fields' labels, who may read them (visitors, signed-in people, or the roles), from the access rules |
| Uploads | whether any model has pictures or documents |
| Cookies | one session cookie when there is sign-in, none otherwise; the analytics setting: a cookie-free counter is named, Google Analytics with the consent bar |
| Mail | sign-in and invitations; the `outgoing` entries' models |
| Logs and backups | the kit's fixed facts: the access log's 90 days, the activity log's 12 months with names blanked after 90; backups, and `hosting` when given |
| Your rights | access, correction, removal, objection; the operator's email; the supervisory authority |
| More | the maker's own `more` part, after the generated text |

The sentences are the kit's words (`legal*` in `words/en.ts` and `sv.ts`), so the page is in the app's language; the labels are the content file's. Nothing is written by a model.

## 3. How it behaves

- `addPrivacyPage [page] [route]` adds it at `/privacy`, lists it under `public.pages`, and one per app. It is not a menu entry: the site's footer links it beside the cookie settings, and the consent bar links it. In an app without a public landing page it renders in the app's shell.
- `smithable validate` warns when the operator's name is missing (`operator-unknown`), and the page itself says the details are not filled in yet, so a maker cannot publish a page that pretends.
- A first build adds it with the landing page (the draft guidance says so); the operator's details come from the maker afterwards, or from the hosted service's account when that is built.

## 4. The five questions (ARCHITECTURE §2.4)

1. Common: every site with visitors needs one; it is asked for in the first week.
2. Deterministic: every fact but the operator is in the spec, the auth file and the context file.
3. Less ambiguity: a hand-written page goes stale when a field is added; this one cannot.
4. Technology-neutral: a page pattern; the kit renders it.
5. Better than custom code or free text: the facts come from the same source as the app's behaviour.

## 5. What it is not

Not legal advice and not a terms page: `legal: terms` can follow the same shape when someone needs it. No per-country texts, no cookie list beyond what the app sets, no consent records.

## 6. The whole configuration, and the owner's review

Design, 2026-11-13 (Fable). Not built. Sections 1 to 5 describe the page as built; this section closes the gap between what the page says and what the app really does, and adds the owner's review of it. Three rules hold throughout: the page states only what the app's own files or its running settings show; it never states a legal basis, a consent or a retention period nobody set; and it never says the app complies with anything.

### 6.1 Facts the page does not state yet

| Part | From | Today |
|---|---|---|
| AI assistant | the spec's assistant section: that the app has one, what it may read, whether questions are kept; the provider and region from the running app's settings (`ASSISTANT_PROVIDER`, `ASSISTANT_REGION`, the kit's `aiFacts()`) | not on the page |
| Signing in with another service | the auth file's providers: that signing in with Google sends the person to Google and brings back their name and address | the provider is named as a way in, nothing more |
| Payments | the context file's payment provider, by name; which models a payment is about | says "the payment provider", unnamed |
| Text messages and push | the `outgoing` entries by channel; the SMS provider from the running app's settings (`SMS_PROVIDER`) | channels named, provider not |
| Other services the app sends to | `outgoing` entries whose target is not mail: the target's name and the model sent | not on the page |
| What comes in | `incoming` entries: mail received at the app's address becomes a record of which model; requests from which named service (a webhook) become which | not on the page |
| What visitors are asked for | the public forms (a landing page's form, an order page's asked fields): the fields by label, whatever their type | only models with an email, phone or user field are listed |
| Records the maker names | any model with a `keeps` line (6.2) is listed with its fields, so a model holding only names or notes can be put on the page | not possible |
| The operator's own functions | whether the project has custom code or custom actions, and the maker's `custom` text about them (6.2) | not on the page |
| How long records are kept | the content file, when the maker says it (6.2) | only the kit's fixed log and backup times |

Which models hold personal information is still decided by the shape of the spec (an email, a phone number, a link to a user, a public form) and by the maker's own naming in `keeps`, never by a field's name.

Two kinds of source, kept apart on purpose. What the project's files say is frozen into the page at generation, as today: the same files give the same generated code, and section 4's answer on determinism stands for it. What only the running app knows (which AI provider, which region, which SMS provider) is read when the page is shown, by the kit function that already feeds the assistant's own notice, extended to the SMS provider; when such a setting is absent the page says the service is one the operator chose and does not guess a name. The page states a region as it is set and draws no conclusion from it.

### 6.2 What only the maker knows

Three additions to the page's part of the content file, all plain text shown as written:

```yaml
pages:
  privacy:
    operator: { name: …, address: …, email: …, country: …, hosting: in the EU }
    keeps:                       # how long, per model; the maker's words
      Booking: Two years after the class, for the bookkeeping.
      Message: Until answered, at most six months.
    services:                    # others the operator uses that the files do not show
      - { name: Example Mail Ab, for: sending mail, where: in the EU }
    custom: The waiting-list function mails the next person when a place is free.
```

A listed model without a `keeps` line gets the sentence that records stay until the operator removes them or a person asks for removal. A `keeps` line for a model that no longer exists is a validation warning, so a renamed model does not silently lose its line.

The page's generated sentences are never written by a model (section 2). The maker's own lines are the maker's text like any other content, however they come to write it.

On the hosted service, Studio offers the account's name and contact as the operator's details; the maker confirms, and it is an ordinary change to the content file.

### 6.3 The completeness check

`smithable validate` and the app card say what is missing, as warnings, never as a verdict on the law:

| Code | When |
|---|---|
| `privacy-missing` | no privacy page, and the app has sign-in, a public form, incoming mail, an assistant open to visitors, or analytics |
| `operator-unknown` (exists) | no operator name; extended to a missing contact email |
| `privacy-custom` | the project has custom code or custom actions and the page has no `custom` text |
| `privacy-keeps-unknown` | a `keeps` line names a model that does not exist |
| `privacy-unreviewed` | the page has never been reviewed, or its facts changed since (6.4) |

A setting only the running app knows cannot be checked at validation; the page's own wording covers its absence (6.1), and the app card shows the running value.

### 6.4 The owner's review

The page is generated, and its operator answers for it. So the owner reads it and says so, and is asked again when it changes.

- **What is reviewed.** The page's description of the app as the project's files give it: the facts the generator freezes into the route, which already hold the operator's details, `keeps`, `services`, `custom` and `more`, and the names of the custom actions; and the generated sentences the page uses, in the app's own language. The `reviewed` record itself and the page's title are left out.
- **The fingerprint.** SHA-256 over those facts written as JSON with sorted keys and Unix line ends, followed by the sentences used, in a fixed order; the first sixteen hexadecimal digits are kept. Rewording a sentence the page uses asks for a new review; a change to another language's file or to a sentence the page does not use asks for none.
- **Which sentences.** Every sentence of the privacy page in the app's language counts (the kit's `legal*` words), not only those the page shows now: rewording one an app does not show (the texts' sentence in an app without texts) asks its owner to review again. It errs toward asking; a map from facts to the sentences they use is not worth its upkeep (Fable, 2026-11-13). So a change to any `legal*` word is named in the CHANGELOG as one that asks owners to review their privacy page again.
- **Recording it.** One operation, `reviewPrivacyPage`, writes `reviewed: { facts: <fingerprint>, on: <date, UTC> }` under the page in the content file. It goes through the operation layer like every change, so it is in the history and can be undone. It records no person's name. A review that arrives by a merge from another branch counts only if the fingerprint matches the merged facts.
- **When the facts change.** A new field in a listed model, a new provider, a changed access rule, a new custom action: the fingerprint no longer matches. Studio shows the page as "changed since your review" with the changed parts side by side in words, and one button to review again. It needs no stored copy for that: the facts as reviewed are computed again from the project's files at the change that recorded the review. `validate` warns `privacy-unreviewed`.
- **The page itself always shows the current facts**, reviewed or not: a true page nobody has confirmed is better than a confirmed page that is no longer true. While the fingerprint matches it carries one line, "The operator reviewed this description of the app on <date>"; otherwise it carries no line about review, in either direction.
- **Settings of the running app are outside the review**, because the files do not hold them and Studio's preview does not have the live ones. The review line's wording is about the description of the app for that reason, and the sentences that come from running settings say that they show the current setting. Where the hosted service sets or changes such a setting for a published app, its publish card shows the value the owner is publishing with.
- **Custom code is reviewed by its presence and the actions' names only.** Editing what a custom function does asks for no new review; the `custom` text is the maker's statement about it, and the page says so.
- **Publishing.** The engine does not stop a build over it; a self-hosted maker reads the warning. The hosted service reads the review's state from the build (reviewed, changed, never) for its publish card and decides there how firmly to ask.

`reviewed` is a record about the page's text, kept with that text; it is not a new construct of the app's definition and changes nothing the app does.

### 6.5 Still not

Not legal advice, no terms page, no legal basis per purpose, no consent records, no per-country texts, no list of what a visitor's browser fetches from elsewhere beyond the analytics setting, and no reading of custom code. The page says what the app does; whether that is enough is the operator's judgement, and the review is where they make it.

### 6.6 Build order

1. The missing facts of 6.1 that come from the files, with their sentences in every language file; the app card shares them.
2. The running app's settings on the page (AI provider and region, SMS provider).
3. `keeps`, `services` and `custom` in the content file, with Studio's form.
4. The fingerprint, `reviewPrivacyPage`, the warnings of 6.3 and Studio's "changed since your review".
5. On the hosted service: the account's details offered as the operator, and the publish card reading the review's state.
