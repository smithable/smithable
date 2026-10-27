# Sign in with Google

New apps sign people in with a code by email, which needs no keys (see [Getting started](start-local.md#signing-in)). If the people who use your app have Google accounts, you can offer "Continue with Google" beside it. Google wants to know about every app that signs people in through it, so you register the app once and give it the two keys Google hands you. It takes about ten minutes.

## 1. Register the app with Google

1. Open the [Google Cloud console](https://console.cloud.google.com/) and create a project for the app, or pick an existing one. Sign in with your organisation's Google account, such as a Google Workspace account on the app's domain, not a personal Gmail account: the app's sign-in then doesn't depend on one person's private login, and others can be given access to the project later.
2. Under **Google Auth Platform → Branding** (in older consoles, **APIs & Services → OAuth consent screen**), give the name people see when they sign in and a support address. If people outside your own Google Workspace will sign in, choose the **External** audience.
3. Under **Clients** (or **Credentials → Create credentials → OAuth client ID**), create a client of type **Web application**.
4. Under **Authorized redirect URIs**, add both addresses the app signs in from:

   ```text
   http://localhost:3000/api/auth/callback/google
   https://your-domain.example/api/auth/callback/google
   ```

   Use the published app's real address in the second one: the same as its `BETTER_AUTH_URL`.
5. Create it, and copy the **Client ID** and the **Client secret**.

While the app's audience is in testing, only the test users you list there can sign in. Publish it under **Audience** when the app is ready for everyone.

## 2. Give the app its keys

In the project folder, put them in `.env`. The generated `.gitignore` keeps that file out of Git; never commit the keys.

```sh
GOOGLE_CLIENT_ID=1234567890-abc.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=...
```

On a server, set the same two variables in the app's environment. `smithable deploy --target docker` takes them from your shell; see [Self-hosting](self-host.md).

## 3. Offer Google on the sign-in page

```sh
smithable op setProviders email google
```

The order is the order of the buttons. Keep `email` so that people without a Google account can still get in, or leave it out (`setProviders google`) for an app whose users all have one. Like every operation, this is one change that `smithable undo` takes back.

Until the keys are set, the sign-in page leaves Google out. In development it says which keys are missing.

## Who may sign in

Google decides who someone is; the app's sign-in settings still decide whether they may come in. These are the same rules as for the code by email:

- With `smithable op setSignUp invited`, only invited addresses and the administrators get in, whichever way they sign in.
- When the auth file names `allowedDomains`, only addresses in those domains get in. Google is also asked to show only accounts in the first of them.
- An administrator is an address, not a provider. You stay an administrator whether you sign in by code or with Google, as long as the address is the same.

## Facebook

Facebook works the same way. Create an app with **Facebook Login** in [Meta for Developers](https://developers.facebook.com/apps). Use the redirect addresses with `facebook` in place of `google`, and the variables `FACEBOOK_CLIENT_ID` and `FACEBOOK_CLIENT_SECRET`. Then run `smithable op setProviders email facebook`, or list all three.
