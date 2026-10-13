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
