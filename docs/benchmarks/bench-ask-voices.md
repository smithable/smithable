# bench-ask: Ask's voices (2026-10-11)

Does Ask's manner cost accuracy (docs/design/ask-defaults.md §5)? The invoicing starter's 25
questions, asked by `mistral-small-latest` once per voice: `node scripts/bench-ask.mjs
mistral-small-latest --starter invoicing --voice <voice> --label voice-<voice>`. `--voice` sets the
voice with `setAssistantVoice` and gives the model the generated kit's line for it, as the app's Ask
does. Invoicing is where Small misses most, so a cost would show there first.

| Voice | Right | Wrong | Tokens in / out per question | Cost per question | Time |
|---|---|---|---|---|---|
| plain ([report](bench-ask-voice-plain.md)) | 22 / 25 | 8, 10, 22 | 3,870 / 64 | $0.0006 | 2.6 s |
| friendly ([report](bench-ask-voice-friendly.md)) | 23 / 25 | 8, 10 | 3,949 / 78 | $0.0006 | 1.9 s |
| formal ([report](bench-ask-voice-formal.md)) | 20 / 25 | 8, 10, 19, 22, 24 | 3,464 / 78 | $0.0006 | 2.2 s |

Every miss is one Small already makes without a voice: 8 and 10 in all three, and 19, 22 and 24
in [bench-ask-seven-tools](bench-ask-seven-tools.md). The misses are lookups: it finds no Finnish
client, no invoice 2026-006, nothing still to be paid. None is caused by the manner, such as an
answer that is right but phrased so the judging misses it. Formal's two extra misses are within
Small's spread from run to run; one run per voice cannot tell a point or two apart. The voice adds
about 14 output tokens a question (a sentence instead of a phrase), which costs nothing that shows.

So the manner costs no accuracy that one run can see. Friendly sometimes offers help nobody asked
for ("If you'd like, I can help you add a new client from Finland!"), and formal writes full
sentences with bold numbers, which is what each voice's line asks for.
