# bench-ask on Mistral Small: the answer checks, step by step (2026-10-14)

The design's §5 ([ask-checks.md](../design/ask-checks.md)) asks for a run of
[bench-ask](../../scripts/bench-ask.mjs) after each step: the tools (#620), the kit's answer
check (#621, then its fixes in #625), and the gateway moving an ungrounded answer to the better
model. All on Mistral Small, the model of the Strict level; the last run is Strict as the gateway
runs it, Small with Mistral Medium as the better model (`cascade:mistral-small-latest>mistral-medium-latest`).
bench-ask runs the kit's own `grounded.ts` (bundled from the generated app) in its loop, as the
kit does: one retry with the reason, then the second marked, then the answer shown as not confirmed.

| Run | Right | Wrong, stated as fact | Gave up or failed | Cost per question | Report |
|---|---|---|---|---|---|
| Before (main 90d08bfd) | 123 / 134 | 10 | 1 | $0.0006 | [small-before](bench-ask-small-before.md) |
| The tools (#620) | 122 / 134 | 10 | 2 | $0.0006 | [small-after-tools](bench-ask-small-after-tools.md) |
| The check as first merged (#621) | 116 / 134 | 15 | 3 | $0.0006 | [small-after-checks-621](bench-ask-small-after-checks-621.md) |
| The check with its fixes (#625) | 121 / 134 | 11 | 2 | $0.0006 | [small-after-checks](bench-ask-small-after-checks.md) |
| Strict: Small, then Medium | 122 / 134 | 11 | 1 | $0.0016 | [small-after-gateway](bench-ask-small-after-gateway.md) |

The "before" and "with its fixes" rows count crm 14 ("Which customers have never ordered
anything?") as right: their answer, "All customers have placed at least one order", was judged
wrong by these runs' version of the judge, which now takes it as "none" (their reports keep the
judgement they were written with).

What the check did:

- **As first merged** it sent 10 answers back and made things worse: four right answers were shown
  as not confirmed and four became wrong after the retry. Two causes: invoice numbers such as
  "2026-003" read as the amount 202, and a number inside a text field (a description's "56 cm",
  a phone number) was not known. Both fixed in #625, with the note said back (status 18).
- **With its fixes** it sent 3 answers back and showed none as not confirmed. It caught status 5,
  a duration the model worked out (21 minutes) that no tool gave: the answer became "gave up"
  instead of a wrong number stated as fact.
- **One false alarm left:** crm 14's right answer "none" is sent back, since no tool returns an
  empty result for "never ordered" (the model must compare two lists). In the Strict run it was
  shown as not confirmed.
- **The Strict cascade** moved 19 questions to Medium, all for the earlier reasons (5 after two
  refused tool calls, 14 at the fourth call), and 17 of them were then right; none moved for an
  ungrounded answer, since the fourth-call rule comes first.

The differences between runs that the check had no part in (a question right in one run and
wrong in the next, with no answer sent back) are the model's own variation at temperature 0,
about three questions either way.
