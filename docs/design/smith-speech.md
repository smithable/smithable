# Speech for Smith: talk to him, hear him answer (design)

Status: proposed 2026-11-07, Fable, on Johan's request; build after Johan reads it: step 1 (the
`browser` provider, press to talk, sound and voice) first, §8. Johan asked for a mic to press or
left listening while Smith is silent, sound on or off, Smith stopped by talking over him, noise
sorted away. Studio's Smith only (an app's assistant: assistant.md §8). Reviewed by a second reviewer.

## 1. Today

- Smith's thread and chat box are `apps/studio/src/builder/Ask.tsx`; `SmithLayer.tsx` holds the
  panel (overlay, floating, docked, or folded into his face in the top bar). Per-person settings
  live in `localStorage`. Studio's keys: Enter, Shift-Enter, Ctrl/Cmd+Z, +Y, +Shift+Z, Ctrl/Cmd+R
  over the preview, Esc and Enter in the overlay and the guide.
- The project's AI policy (ARCHITECTURE §9.5: `local-only`, `eu-only`, `best-available`,
  `custom`) is enforced in the host's provider layer; Studio gets where Smith's requests may go in
  words (`ai` in `api.ts`).
- Studio is in English (language.md §5); so are Smith's rule-made lines. No speech exists.

## 2. What people get

Three controls in Smith's panel, beside the chat box. Sound is on from the start, where the policy
allows a voice (§3): Smith speaks his introduction, and that first message says that sound can be
turned off and on with the speaker button and that Esc stops him (Johan, 2026-11-07). A browser
that refuses to play before the person has touched the page shows the sound button pulsing with
"Turn on sound" instead, and the first click starts it. The mic is off until the person uses it,
since it needs the browser's permission: the first press shows, in one line, where the voice goes
(§3), asks the browser for the microphone, and sets press to talk.

- **Mic:** off, press to talk, automatic. Press to talk listens while the mic button or the key is
  held; a click without holding listens for one utterance, for anyone who cannot hold a key.
  Automatic listens whenever Smith is silent and, while he speaks, only watches for the person
  starting to talk, to stop him (§4.3). Where barge-in is off for the voice, the control says so.
- **Sound:** on or off; it needs no microphone. **Voice:** the provider's voices for Studio's
  language, by name (§6).

While anything listens, a mic indicator shows on the button and on Smith's face, folded or not;
the panel does not fold by itself then or while he speaks, when a Stop button shows beside his
face. Only one Studio tab listens at a time: starting in another stops the first. The browser
remembers (`smithable:speech`) sound, voice, and the mic as off or press to talk; automatic is
chosen again on each visit. On every load and project switch the voice is checked against the
policy; one no longer allowed gives way to the first allowed, or speech is off, with a line why.
No microphone, a refused permission, no recognition or no voice: the control is off and says so.

### 2.1 Keyboard

- **Hold Ctrl+Shift+Space to talk** (Ctrl on a Mac too: Ctrl+Space switches input sources there),
  anywhere in Studio but the preview, whose keys go to its own page. No Studio key or browser
  default uses it that we know of; step 1 checks Windows does not switch keyboard layout on it.
  Key repeat is ignored; losing focus or hiding the tab counts as release. On the focused mic
  button, holding Space talks (its click on release is suppressed).
- **Esc stops Smith speaking** when the focus is in his panel, and does nothing else then. Every
  control is reachable by Tab, its state read out ("Mic: automatic, listening"). Captions are
  always there: the transcript is in the box, his words in the thread.

## 3. Where the voice goes

One provider interface, two providers. The host's policy layer, which already decides where
Smith's requests may go, also returns the speech providers the project allows (a `speech` list
beside `ai`), and Studio offers only those. **Under `local-only`, speech is off; a local provider
is not planned.** Under `custom`, speech is off too, so no list of speech providers is needed.

| Provider | Hears with | Speaks with | Allowed under |
|---|---|---|---|
| `browser` | the browser's recognition | the browser's voices | `best-available`; `eu-only` only when on the device |
| `service` | AWS Transcribe streaming, via our gateway | Amazon Polly neural, via our gateway | `best-available`, `eu-only` |

- **`browser`** is free. Chrome's recognition sends the voice to Google unless `processLocally`
  is set and the language pack is installed; Safari's goes to Apple; Firefox 161 recognises on
  the device only; Edge's is unreliable and is offered only if a test utterance works. Network
  voices send Smith's text out (Edge's "Online (Natural)" to Microsoft, Chrome's "Google" voices
  to Google). So `browser` counts as on-device only with `processLocally` and voices with
  `localService: true`. Those are the browser's own claims, checked in the browser, which the
  host cannot verify.
- **`service`** runs on the hosted service only. The gateway holds the AWS keys. Transcribe
  streaming and Polly neural run in Frankfurt or Ireland, since Stockholm has neither. Both
  are in the EU, so it fits `eu-only`. The CLI's local Studio has `browser` only.
  On the hosted service's levels (eu-levels.md in the service's repository), `service` is offered at
  Normal, Relaxed and Global. Not at Strict (B's question, 2026-11-07): Strict takes AI only from EU
  companies, and Transcribe and Polly are AWS's managed AI services, the same class as Bedrock,
  which Strict excludes; that our hosting runs on AWS is data at rest in our own account, another
  thing. A Strict project has `browser` only where the browser says it is on the device, else
  speech is off with the line why. A transcription by an EU company (Mistral's Voxtral) is the
  later option for Strict, not planned now.

The line shown at turn-on and in the voice menu names, per browser, where the voice and the text
go: "Your voice is sent to Google to be written out, and kept under Google's terms", "Your voice
is written out on this computer", "Your voice is sent to Smithable's service, which uses Amazon's
speech service in Frankfurt". Turning speech on with that line in view is the person's consent.

## 4. Listening

### 4.1 Capture

With `service`, one microphone stream (`getUserMedia`) with `noiseSuppression`,
`echoCancellation` and `autoGainControl` on, checked with `track.getSettings()`, feeds the VAD
and the provider. With `browser`, the recognition opens its own capture, without our constraints;
in automatic mode our stream runs beside it for the VAD, and if step 2 finds the two do not work
together, automatic mode is not offered with browser recognition. Every capture opens when
listening starts and closes when it stops.

### 4.2 Who is speaking, and the modes

Silero VAD through `@ricky0123/vad-web` (MIT, about 2 MB, loaded only once speech is turned on)
marks where speech starts and ends and keeps a short lead-in so the first syllable is not lost.
In automatic mode only these segments go to a provider. With `browser`, recognition starts at
the onset and stops at the end (step 2 measures whether the first syllable survives); where it is
on the device it may run the whole time. Noise is the browser's suppression plus the VAD's
threshold; a heavier model (RNNoise) only if real use needs one.

**The modes.** Press to talk listens while held (or for one utterance after a click), without the VAD.
Automatic: while Smith is silent, an utterance ends after about 800 ms of silence and is sent
(§6). It returns to press to talk after ten minutes without the person speaking, and whenever the
tab is hidden; a line says so. No wake word.

### 4.3 Barge-in, without Smith interrupting himself

While Smith speaks, nothing is transcribed; the VAD watches for an onset held about 300 ms above a
raised threshold, ignoring the first 300 ms after each sentence starts playing. On one, Smith stops
at once, and that utterance is transcribed from its onset like any other.

This works only if the echo canceller knows what Smith says. Sound the page plays (`<audio>`, Web
Audio) is in its reference, so `service` voices play that way. `speechSynthesis` is
played by the operating system, and whether it is cancelled is unverified, so with a `browser`
voice barge-in is off and Stop or Esc stops him. **Step 2 starts with the test:** through laptop
speakers in Chrome, Edge, Safari and Firefox, with each kind of voice, Smith must never stop
himself, and a person talking over him must stop him within half a second; barge-in is on only
where both hold. Automatic mode suggests a headset.

## 5. Speaking

- With sound on, Smith reads each new line in order (answers, the presentation, a proposal's
  summary, the guide's cards), sentence by sentence, a long one split at a comma, so speech
  starts at once and Chrome's cut-off of long network utterances is avoided. Code, links and
  tables are not read; a list is read to five items and "and N more".
- Sending a message, Stop, Esc, a barge-in or sound off stops speech and drops the queue. A
  hidden tab keeps speaking; it only stops listening.

## 6. The transcript

Recognition and voice follow Studio's language. English is supported now; other languages come
later, each when its recognition and voices are checked.

What was heard appears in the chat box as the person's message (interim words greyed). **Press
to talk:** after release Studio waits for the final text and sends it after about 1.5 s; any touch
of the box (a key, a click, a paste) cancels that send, Enter or Send sends at once, and talking
again adds to the text and restarts the wait. **Automatic:** sent when the utterance ends. With
words already typed, or Smith still working, the transcript is added and waits to be sent. A
spoken line does exactly what the same typed line does; nothing applies without today's
confirmation. The transcript is kept as any typed message is, and only it.

## 7. What it never does

- **Keep sound.** Smithable stores no audio anywhere; the gateway logs only durations and
  character counts. Before `service` ships, the AWS organisation sets the AI services opt-out
  policy for Transcribe and Polly. The browser's cloud recognition keeps what its maker's terms
  say, and §3's line says so.
- **Send silence.** In automatic mode only speech segments leave the browser; in press to talk,
  only what is held. **Listen** when hidden, before speech is turned on, or for a wake word.
- **Run under `local-only`.** Speech is off there; a local provider is not planned.
- **Add to the spec.** A Studio setting per person (the service may remember it per account
  later); no key, so ARCHITECTURE §2.4's five questions do not arise.

## 8. Build order

1. **Step 1 (A).** The provider interface and `browser`; the controls with press to talk, sound,
   voice and the key; the transcript; `speech` beside `ai` in the session's answer from the host's
   policy layer (the daemon; B mirrors it on the service).
2. **Step 2 (A).** The self-interruption test (§4.3) and the two-capture test (§4.1) first; then
   the VAD, automatic mode, and barge-in for the voices that pass.
3. **Step 3 (B, the service; A, Studio's side).** Two gateway endpoints: transcribe a segment as
   a stream (interim and final text back) and speak a text (audio back). Each takes Studio's
   session, checks the person is a member of the project, decides the policy and the region on the
   server from the project, enforces per-account limits (past one, `browser` where allowed, else
   off for the day, with a line), and ends the AWS stream when the browser closes it or after 60 s.

## 9. Open questions

Answered by Johan on 2026-11-07: sound on from the start with the spoken introduction and the
mic press to talk until pressed (§2); Frankfurt (eu-central-1) for Transcribe and Polly; the
browser's cloud recognition offered under `best-available` with §3's line; `local-only` gets no
speech, revisited if a local-only customer asks.
