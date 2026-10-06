# Hosting prices and levels

Design, 2026-10-06 (Fable, from Johan's question). Status: a proposal, not decided; the beta is free by invitation. Numbers from smithable-cloud/docs/capacity-2026-10-03.md and the service's container limits.

## 1. What one app costs us

A published app is a container capped at 384 MB and half a CPU that sleeps when idle, its SQLite database streamed to S3 by Litestream (30 days kept) and backed up monthly (12 months).

| Item | Cost |
|---|---|
| Today's host (t4g.large, on demand, eu-north-1) | about $50 a month |
| The same class on Spot (t4g.xlarge: 4 vCPU, 16 GB) | about $18 a month, twice the room |
| Awake apps per today's host, realistic footprint | 25 to 30 |
| Object storage for one app (project, stream, backups) | cents a month |
| Mail | $0.10 per thousand |
| Marginal cost per active app at 30 apps | roughly €1.50 to €2 a month |
| The same on the Spot host | under €0.50 |
| A first build with Sonnet 4.6 (clarify, draft, follow-up) | about €0.13 in model calls |
| A change by the model | a cent or two |

A paying customer at €10 a month is profitable from the first one. The free level's cost is almost entirely AI, not hosting.

## 2. The levels

Price by apps and by AI, never by end-user seats: an app with fifty members must not cost fifty times more, or "invite your team" dies. Local use is free forever by the licence, and that is the funnel. The EU-only guarantee is a setting at every level, not a tier (Johan, 2026-10-04).

| Level | Price | What it holds |
|---|---|---|
| Free | €0 | One published app on a `smithable.app` address, sleeps when idle, 7-day point-in-time recovery, a small AI allowance (a few builds and changes a month), community support |
| Starter | €12 a month | Three apps, custom domains, apps stay awake, 30-day recovery and monthly backups kept a year, mail sending, an AI allowance worth about €5 |
| Team | €39 a month | Ten apps, collaborators in Studio, a larger allowance, priority support |
| Business | by agreement | A dedicated host or an EU-owned provider, SLA, SSO, data processing agreement |

Comparable tools charge $20 to $25 for the first paid level (Lovable, Bolt, Base44), mostly for AI credits, without hosting of this kind. Our costs allow undercutting them with hosting included.

## 3. What is built and what is not

Built: apps sleep when idle, 30-day recovery for every app, monthly backups, the demo's daily AI cap (€5 a day across all demos), ten apps per account. Not built: per-level limits (apps per account by level, the 7-day recovery for Free, staying awake as a paid feature), an AI allowance per account, custom domains per level, payment. Each is a service setting once the levels are decided; nothing in the engine changes.

## 4. Open

- Whether Free keeps an app awake (it costs nothing while asleep; waking takes a few seconds and is the visible difference).
- Yearly prices (two months free is the convention).
- Whether Starter is €9 or €12: €12 leaves room for the AI allowance at Sonnet prices.
