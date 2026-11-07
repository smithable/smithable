# Notifications that reach staff: live, push, SMS (design)

Status: proposed 2026-11-07, Fable, on Johan's question the same evening: "If someone makes an
order of food how does the staff know? We can send emails but perhaps notifications via browser
or sms is stronger for this? As well as sound perhaps if they have the site opened." Build after
Johan reads it, in the order of §9. Nothing in the engine changes with this note alone.
Reviewed by three second reviewers (§11).

## 1. Today

- An `outgoing` entry ([spec](../spec/v0.1.md#outgoing), [integrations.md §4](integrations.md))
  tells someone by mail (`to: mail`, `recipient` the record's owner, a role, or an address on the
  record) or calls a named target (`to: <target>`, its address and secret the settings
  `OUTGOING_<TARGET>_URL` and `_SECRET`). The kiosk starter has both: `orderPlaced` mails the
  administrators when an order is created, `toKitchen` calls the kitchen's address.
- A mail is written to the outbox in the change's own transaction and sent after it
  (`src/kit/outgoing.server.ts`): nothing is sent for a change that did not commit, a mail that
  cannot be sent is tried again with growing pauses for a day, and Activity has a line for each
  mail sent or given up, with Send again. The person whose change it is is not mailed about it; a
  confirmation of what they created is theirs. A visitor's change mails only the app's users,
  never an address typed into the record.
- The app has no live updates. A list is as fresh as its last load (a route's `loader` calling a
  server function; `router.invalidate()` loads it again after the person's own change). There is
  no push, no sound and no web app manifest.
- So staff at a counter learn of an order by mail, or by reloading a screen.

## 2. The principle

The outgoing entry already says who is to hear of what. Notifications are more ways for the same
entry to reach them: the channel is a property of the entry, the recipient rule stays, and the
outbox delivers every channel with the same transaction, retries and Activity lines. Nothing new
says who hears; only how. Each channel reaches the recipient by the address it needs: a person
(the owner, a role's users, a field that refers to User) by their mail, their browsers or their
phone; a field of the record by what it holds, an email field by mail and a phone field by SMS,
one reference away as `customer.email` is today.

Three layers:

1. **Live in the app** (§3): a banner, a sound and a list that refreshes, for whoever has the app
   open. No spec change; every app with outgoing entries gets it.
2. **Browser push** (§4): `to: push`, for whoever has the app closed.
3. **SMS** (§5): `to: sms`, for a phone without the app, or a customer.

Rule 4 holds: the app implements two web standards (server-sent events, Web Push) and calls the
owner's SMS provider with plain requests. No Smithable package is in the app; an ordinary library
for Web Push's encryption is allowed as any other library is (A decides, §9 step 3).

## 3. Live in the app, with sound

No spec change; every app with sign-in and outgoing entries.

- **The stream.** The kit serves `/events`, server-sent events, same-origin, read with the session
  cookie; each open tab holds one, a few per person at most. When a change commits that an
  outgoing entry is about, the kit works out the entry's recipients as it does for the mail (the
  role's users, the owner, the user whose address the record names) and sends each one's open
  streams one event: the entry's name, the model, the record's id, its title line (§6) and its
  link. Nothing else of the record. The event is sent after the commit, from the same place that
  wakes the outbox, so nothing is announced for a change that rolled back. The fan-out is in the
  app's process, which assumes one process per app (to check for the hosted service). An app
  that stops between the commit and the event loses that banner; the mail and the push are in
  the outbox and are not lost.
- **Bounded.** At most five streams per person; a sixth closes the oldest. Each stream checks the
  session at every event and at least once a minute, and closes when it has ended or been
  revoked.
- **Only what the person may read.** Before an event goes to a stream, the kit checks the viewer
  may read the record (the model's read rule, as the record page would). The spec allows a role
  recipient who may not read the model (a warning for the default mail); such a role gets no live
  event, since the banner would link to a page that answers 404. A role's users are those who
  have it when the event is sent, so a person whose role changed or who was removed hears nothing
  more.
- **The banner.** At the top of the page: the title line ("New order: #123") and the link to the
  record. It stays until closed or followed; several stack into one with a count.
- **Lists refresh themselves.** A page that shows the event's model (a list, a dashboard tile, a
  calendar, a landing page's list) invalidates its route's loader, so a kitchen view is live
  without anyone reloading. Only the loader runs again, through the same access rules.
- **Sound.** Off until the person turns it on. The first banner offers it in one line ("Play a
  sound for these?"): a browser plays nothing before the person has touched the page
  ([smith-speech.md §2](smith-speech.md)), and that click is the touch. Then a short chime with
  each banner. The choice is kept in the browser (`localStorage`, a per-viewer convenience, as the
  appearance is) and can be changed under the person's name in the menu, where their name, time
  zone and clock already are.
- **A hidden tab** keeps its stream, and the page's title gains a count, "(2) Orders", until the
  tab is looked at again.
- **Reconnecting.** `EventSource` reconnects by itself. Events missed while away are not replayed:
  on reconnecting the page loads its lists again, so it is current, and mail and push carry the
  rest.
- **Which entries are live:** every outgoing entry that names the viewer as a recipient (§10
  question 1), whatever its channels, less what the read check above leaves out. An entry with
  `to: push` alone is live and pushed, and mails nobody. A list mail on a clock timer and a call
  to a target name no person, so they are not live.
- **The mail is still sent.** Live is for whoever is looking; mail for whoever is not.
- The person whose change it is gets no banner for it, a creation included: they are looking at it.

## 4. Browser push (`to: push`)

Web Push (RFC 8030 the protocol, RFC 8291 the payload's encryption, RFC 8292 VAPID, the app's
keys): the browser's own push service (Google's, Apple's, Mozilla's, Microsoft's) carries an
encrypted message to the device, so it reaches a closed tab and a phone. On iPhone and iPad it
works only for an app added to the home screen, which needs a web app manifest; the kit has none
today and gains one with this step.

```yaml
outgoing:
  orderPlaced:
    when: Order created
    to: [mail, push]             # a channel, or a list of channels
    recipient: staff
```

- **The spec.** `to:` takes a channel or a list of channels; each built-in channel (`mail`,
  `push`, `sms`) delivers to the same recipient. A target's name stays alone, as today
  (`to: kitchen`). `push` and `sms` become reserved: a target already named so is refused, with
  the rename the message suggests.
- **The kit.** A service worker (`/sw.js`, from the kit) shows the notification and opens its
  link on a click, the app's own pages only. The Content Security Policy (`src/kit/security.ts`)
  already lets a same-origin worker run (`script-src 'self'`, which a missing `worker-src` falls
  back to); the kit adds `worker-src 'self'` to say it outright. A `push_subscriptions` table
  holds the person, the endpoint, its keys, when it was made and last used; a subscription the
  push service answers as gone (404, 410) is removed. A `notification_choices` table holds which
  entries the person turned on, per channel; the browser's subscription is one, whatever the
  entries.
- **The endpoint is checked.** It comes from the browser, so a person could hand the app any
  address. The sender posts only over https, follows no redirect, and refuses at each send what
  `refusedAddress` refuses for calls already (the app itself, a private or local network, the
  name resolved then); on the hosted service, the egress proxy lets through only the push
  services' hosts (integrations.md §6.1: B adds them beside the sign-in hosts).
- **The keys** are settings, `PUSH_VAPID_PUBLIC_KEY` and `PUSH_VAPID_PRIVATE_KEY`, with
  `PUSH_VAPID_SUBJECT` the contact the push services ask for (the app's address or `MAIL_FROM`
  when not set). On the hosted service B sets them per app. Self-hosted, `smithable new` does not
  write them (generation stays byte-identical); the app's first start without them makes a pair
  and keeps it in the database under `DATA_DIR`, so a backup keeps it and the subscriptions stay
  valid. Settings, when given, win over a kept pair. A key pair lost or replaced ends every
  subscription; people turn push on again. (A release that refuses to start without the keys, as
  it does without `BETTER_AUTH_SECRET`, is the other way; step 3 settles it.)
- **Turning it on is the person's own.** Under their name in the menu, "Notifications" lists the
  entries with `push` that reach them ("New orders"), each a toggle, off until they turn it on;
  the first one turned on in a browser asks the browser's permission and subscribes it. A person
  with a phone and a laptop turns it on in each. Turning the last entry off, or signing out in
  that browser, removes its subscription, so a shared counter tablet does not keep pushing to
  whoever turned it on. Removing a user removes their subscriptions and choices. Nobody turns it
  on for someone else; the choices change only through the app's server functions, with the
  session, as every change does.
- **Sending.** The outbox gets one row per person and entry in the change's transaction, for
  those who turned the entry on; the sender, when it sends, checks again that the person still
  has the role or the record and may read it (also for Send again), then posts to each of their
  subscriptions, keeping which have answered so a retry does not push twice to a device that had
  it. The same growing pauses for a day; Activity has a line per push sent or given up, with Send
  again.
- **The message** is the title line (§6) and the link: no record field beyond what the maker
  wrote into the subject. A locked screen and a shared phone show it to whoever is near.
- **Disclosure.** When the spec has `push`, the generated privacy page and the app card
  ([app-card.md §3](app-card.md), part 5) name the browsers' push services as services the app
  sends through, and what goes: the title line and the link, encrypted.

## 5. SMS (`to: sms`)

An integration like mail's provider: the app calls the owner's SMS provider with plain HTTPS
requests.

```yaml
outgoing:
  orderReadyText:
    when: ready
    to: sms
    recipient: phone             # a phone field of the record: the customer's number
```

A list of channels needs a recipient every channel can reach: `to: [mail, sms]` with a phone
field is refused (a phone field has no mail; the kiosk's `orderReady` keeps mailing `email`, and a
second entry texts `phone`). The owner, a role and a field that refers to User reach every
channel.

- **Settings:** `SMS_PROVIDER` (one EU provider first, 46elks, Swedish; a second, Twilio, later),
  `SMS_KEY`, `SMS_SECRET`, `SMS_FROM`, and `SMS_MAX_PER_DAY`. Without them nothing leaves the
  machine: each text is written under `DATA_DIR` as the mail is without SMTP settings, which is
  how development and the tests see what would have been sent; a release needs them set, and
  `smithable deploy` names them.
- **Who receives.** `recipient` as today, where the person has a phone: a `phone` field of the
  record, or one reference away (`customer.phone`); or a role or the owner, reaching those users
  who gave a phone themselves. The kit's user table gains an optional `phone` column beside
  `timezone` and `clock`, set by the person under their name in the menu and removable there,
  never set by an administrator or by the app. It is used only after a code texted to it has
  been typed back, so a mistyped or someone else's number gets one text and no more. As with
  push, each entry with `sms` that reaches them is a toggle there, off until they turn it on;
  removing the user removes the number and the choices.
- **A number must be whole.** The `phone` field is free text today. A number that is not in the
  international form (`+` and digits) is not sent, and Activity says why. Reading a local number
  with the app's country is a later step.
- **Never a stranger's number from a stranger.** A visitor's change never texts a number typed
  into the record, as it never mails an address typed into it: otherwise an order form could send
  anyone's text anywhere, at the owner's cost. A staff member's change may (the kiosk's order is
  ready: the customer is texted). That number is still a stranger's word: a visitor can give
  someone else's, and staff's action then texts them once about that order, as a mail to a typed
  address does today. `smithable validate` warns when an SMS recipient is a phone field of a
  model visitors may create, as it does for mail.
- **For the work, not for news.** A text is about the person's own record or their work; a list
  mail on a clock timer takes no `sms`. A customer who answers STOP is the provider's to handle
  where it does; the app sends that number nothing it did not cause.
- **Cost.** Each message is paid by the owner to their provider, so `sms` is never a default, in
  a starter or a first build. `SMS_MAX_PER_DAY` caps the messages a day per app, and a smaller
  cap holds per number, both with low defaults the kit sets, so a loop or a bot placing orders
  cannot run up a bill or flood one phone. Retries and Send again count. Past a cap, a text is
  given up with "over the day's limit" in Activity, and Send again works the next day.
- **Never twice by accident.** A text the provider may have accepted (the request timed out, no
  answer) is not tried again by itself: Activity marks it unknown, and Send again is a person's
  choice. One outbox row per number, with its own state.
- **The text** is the title line (§6), kept to one message's length where it fits. A person with
  an account also gets the link; a number on a record (a customer without an account) gets the
  title line alone, since the record's page would ask them to sign in.
- **Hosted:** the settings go on the project's Connections page (B), the sender number verified
  with the provider; the egress proxy lets the provider's host through as a connection.
- **Delivery:** an outbox row per number in the change's transaction, retries for a day,
  Activity's line per SMS with Send again, as mail. The privacy page and the app card name the
  provider and what goes.

## 6. Where the words come from

- **The title line** of a banner, a push and an SMS is the content file's
  `outgoing.<name>.subject` where given, placeholders filled as for the mail; else, as the mail's
  subject is, "<Model label>: <record title>". For push and SMS without a subject in the content
  file, the record's title is left out ("New order", from the model's label and the event), since
  a title can be a person's name on a locked screen; `smithable validate` warns when a push or SMS
  subject's placeholder reaches a field that is about a person (an email, a phone, a user) or
  that `sensitiveKind` flags (core's check by field name, the one the app card uses).
  `{number}` or a time is fine. It is a warning: a maker may still write a name into the subject,
  and it then shows on a locked screen.
- **The kit's own words** (the sound offer, "Notifications", "Turn on notifications", the toggles'
  states, the browser refusing permission) are in `words/<language>.ts`, as every kit word is.
- **Smith's summary line** names the channels before the recipient words it has now: "When an
  order is added: mails and pushes to every staff." / "When an order is ready: mails and texts its
  phone."

## 7. What it never does

- No record field leaves the app in a push or an SMS beyond what the maker wrote into the subject;
  the default carries none.
- No third party of Smithable's: push goes through the browser's own push service, SMS through
  the owner's provider. The push service sees an encrypted message and when it went to which
  device; the SMS provider sees the number and the text in plain. The privacy page says both.
- The private push key, kept in the database when no setting gives it, is in every backup of the
  app's data; whoever holds a backup could push to its subscribers until the key is replaced.
- The live stream never shows a person a record their role may not read, and never anything a
  mail to them would not say.
- A person's own change makes no banner, push or SMS to themselves, and no mail but a
  confirmation of what they created (today's rule, unchanged).
- A phone number on an account is the person's to give and to remove; push and SMS to someone
  with an account are theirs to turn on. A number on a record is texted only about that record.
- Nothing is sent, shown or pushed for a change that did not commit.
- A demo (`DEMO_VISITORS=1`) sends no push and no SMS: its visitors' copies would reach real
  devices.

## 8. Growing the DSL: `to: push | sms`

`push` and `sms` are values of a key that exists, `to`, and the list form is the same key holding
several; the construct is small. ARCHITECTURE §2.4's five questions:

1. **Common:** telling staff of an order, a booking or a request, and a customer that their order
   is ready, is in nearly every app that has outgoing mail today.
2. **Deterministic:** the recipients are the entry's, the message is the subject the content file
   holds; no model is involved.
3. **Less AI and less ambiguity:** "text the customer when it is ready" becomes one value instead
   of custom code calling a provider from a hook.
4. **Technology-neutral:** `push` and `sms` name channels, not services; the provider is a
   setting and the push services are the browsers'.
5. **Better than free text and code:** the outbox's transaction, retries, Activity line, the
   visitor rule, the daily cap and the privacy page come with the value; custom code would have
   to write each.

Live updates need no construct: they follow from the entries there are. Step 1 adds to
ARCHITECTURE.md §6.3 (the app kit) what runs in the app: the event stream, the service worker,
the subscriptions table, and the SMS sender beside the mail's.

## 9. Build order

1. **Core (Fable).** `to:` as a channel or a list; the channels `push` and `sms`, reserved as
   target names (a spec with a target so named is refused with the reason; its `to` and the
   target's settings are renamed by hand); validation (`sms` needs a phone to reach: a phone
   field, one reference away, or a role or owner; every channel of a list reaches the recipient;
   `push` needs no setting at validation; the visitor warning for SMS; the subject warning of
   §6); the operations (`addOutgoing --to mail,push`, and one way to change an entry's
   channels: a new `setOutgoingChannels <name> <channels>` or `--to` on `setOutgoingBody`, to
   decide in this step); the summary words; the schema; the spec reference; ARCHITECTURE §6.3.
2. **The kit, live (A).** The stream, the banner, the chime and its offer, the list refresh, the
   sound choice under the person's name. Works on every app with outgoing entries today.
3. **Push.** A: the web app manifest, the service worker, the subscriptions table, the toggles,
   the sender, the privacy page's and the app card's line. B: the keys per hosted app, the push
   services' hosts in the egress proxy, the Connections page's line. The kiosk starter takes
   `to: [mail, push]` on `orderPlaced` (§10 questions 4 and 5); C's starter words follow.
4. **SMS.** B: the provider's integration and its settings on Connections. A: the channel in the
   sender, the phone on the person's account, the daily cap. Core's validator warning is Fable's
   (step 1).

## 10. Open questions for Johan

1. Live banners for every outgoing entry that names the viewer, or only entries marked for it?
   Recommended: every one; whoever an entry tells is shown it live too, where they may read the
   record.
2. The sound: offered by the first banner, off before? Recommended: yes.
3. The first SMS provider: 46elks (EU), a second later? Recommended: 46elks.
4. The kiosk starter with push on new orders by default? Recommended: yes.
5. The kiosk's `orderPlaced` mails the administrators, not the staff who take the orders; one
   recipient per entry. Should the starter tell `staff` instead (the owner then hears through a
   second entry, or not at all)? Recommended: `staff`, with push.

## 11. Second reviewers

Taken: a list of channels must reach the recipient by every channel (`[mail, sms]` with a phone
field is refused); each channel's address for the same recipient said in §2; per-entry choices in
their own table; subscriptions removed on sign-out in that browser and with the user; recipients
and read access checked again at send and at Send again; delivery state per device and per
number, and a text with no answer not retried by itself; a cap per number beside the app's, with
retries and Send again counted; an account's phone confirmed by a texted code; no link in a text
to a number on a record; the push endpoint checked at each send, no redirects; a bound on streams
and the session checked while one is open; the one-process assumption and a lost banner after a
stop said; what the push service and the SMS provider see; the private key in backups; settings
winning over a kept key; `sensitiveKind` named; the subject warning said to be only a warning;
§10 question 1 worded without "what is mailed is what is shown".

Declined: a `to: live` channel (an entry with `to: push` alone is already live without mail, and
live needs no construct); replaying missed banners after a reconnect (the lists reload; push and
mail carry what was missed); a consent and opt-out flow for numbers on records beyond the
provider's own STOP handling (texts are about the customer's own order, never news); stricter
rules for a staff action texting a number a visitor typed (one text per entry and the caps bound
it, as a mail to a typed address is bounded today).
