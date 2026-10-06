# Analytics and the consent bar

Design, 2026-10-06 (A). Johan (2026-10-06): apps should have a reasonable way of getting a cookie banner when they need one; he has no opinion on Google Analytics itself. Status: to build (A); Fable reviews the context-file part.

## 1. The setting

One line in `smithable.context.yml` names one provider and the app's id with it:

```yaml
analytics: { plausible: shop.example.com }   # or
analytics: { umami: 4f2a1c3e-… }             # or
analytics: { fathom: ABCDEFGH }              # or
analytics: { google: G-XXXXXXXXXX }
```

- It is implementation policy (it names a service), so it is the context file's, set by an operation (`setAnalytics`) like the rest of that file, and `none` takes it away.
- The script is added to the root route's head in a production build only: development, Studio's preview and a hosted workspace's preview are never counted.
- The app's Content-Security-Policy (src/kit/security.ts) allows the provider's script and the address its counts are sent to, and nothing more; the CSP stays as strict as it is for every other app.
- One provider at a time. Plausible, Umami and Fathom run on their own hosted service here; a self-hosted Umami (its own address) can follow when someone asks.

## 2. What needs consent

Storing or reading anything on a visitor's device that the app does not need to work, or sending what identifies them to a third party for tracking, needs a yes first (the ePrivacy rule, with GDPR for the data). So:

- **No consent:** the app's own session cookie (strictly necessary to be signed in), and the cookie-free counters Plausible, Umami and Fathom, which set no cookie and keep no personal data by their own account. These get no bar.
- **Consent:** Google Analytics; and, through the hook (§4), anything custom code adds that does the same: a YouTube or Google Maps embed, a chat widget, an advertising pixel.

Whether a given use needs consent is in the end the operator's call (with their counsel); the bar is the reasonable way for an app to ask when it does.

## 3. The bar

A small kit piece (`src/kit/Consent.tsx`) at the bottom of every page, shown only when something needs consent and no choice has been made:

- One sentence, then **Accept** and **Decline** as equal buttons (no pre-ticked boxes, no "accept" more prominent than "decline"), and a link to the app's privacy page when it has a page named `privacy`.
- Its texts are the kit's words (English and Swedish, like the rest) and can be changed in `smithable.content.yml` under `consent: { text, accept, decline }`.
- The choice is kept in the browser (localStorage, with the date) and asked again after a year. Nothing is loaded before Accept; Decline loads nothing and is remembered just as long.
- A "Cookie settings" link in the app's footer opens the bar again, so a yes can be taken back as easily as it was given (on a later page load the scripts are then gone).

## 4. The hook for custom code

```ts
import { afterConsent } from "#/kit/consent";

afterConsent(() => loadChatWidget());
```

`afterConsent(run)` runs `run` at once when the visitor has said yes, else when they do, else never. Calling it is also what makes the bar appear when no setting needs it, so a page of the owner's own that embeds a map gets the bar without a setting. Google Analytics itself goes through the same function.

## 5. Steps

1. Core (Fable reviews): `analytics` in the context file's validator and its JSON schema, `setAnalytics` (provider and id, `none`), the spec reference's context section, `consent` texts in the content file.
2. Adapter and kit: the script per provider in the root route (production only), the CSP's sources per provider, `src/kit/consent.ts` (the choice, `afterConsent`), `src/kit/Consent.tsx` (the bar), the footer link; words in en.ts and sv.ts.
3. Checks: test-apps builds an app with Plausible (the script in the page, the CSP allows it, no bar) and one with Google (the bar, no Google script before Accept, the script after, Decline remembered); a unit test of `afterConsent`.

## 6. Not in this

No cookie scanner, no list of every cookie, no categories (statistics, marketing, …): one yes covers what the app asks for. Categories come when an app needs to tell them apart.
