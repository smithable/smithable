# User interviews (M7)

Goal: 10–15 conversations with the two beachhead groups ([VISION.md](../VISION.md#where-we-start-the-beachhead)), so the benchmark measures what they care about and the next milestones (the Builder and Studio app, M9 onwards) solve their real problems. Learn about their past behaviour, not their opinion of Smithable: people are bad at predicting what they would use, and good at describing what they did.

## Who

| Group | How many | Screener: all must be true |
|---|---|---|
| **Hit the wall** with a prompt-to-code builder (Lovable, Bolt, v0, Replit Agent, Base44 …) | 5–8 | Built something they meant to use or sell, not just tried it · worked on it for at least a few weeks · stopped, restarted, hired help or moved it elsewhere |
| **EU small businesses and agencies** building business apps (booking, customer portals, internal tools) | 5–7 | Paid for, built or maintain such an app in the last year · decides or influences the choice of tool · based in the EU |

Mix within each group: non-developers and developers; at least three agencies or freelancers who build for clients.

Where to find them: Lovable, Bolt and Replit communities (Discord, Reddit threads about "my app got too big", "credits"), indie maker communities, local business networks and agencies in Åland, Finland and Sweden, and LinkedIn posts about GDPR and no-code. Offer a gift card or a free year of the hosted product.

## The conversation (30–40 minutes)

Ask permission to record. Say there are no wrong answers, and that nothing is being sold today.

**1. Context (5 min)**
- What do you do? What do you build, and for whom?
- Which tools do you build apps with today? How did you pick them?

**2. The last real project (15 min)**, as a story, from the beginning:
- What were you building, and why?
- How did it start? What went well in the first days?
- When did it get hard? What happened? *(Ask for the specific moment: the change that broke something, the bill, the error they could not fix.)*
- What did you do then? Who helped? What did it cost, in money and time?
- Where is the project now?
- *Hit the wall:* how many credits or how much money did it take? What would a change like "add a phone number to customers" cost you today, in time and credits?
- *Agencies:* how do you hand an app over to the client or their developers? What goes wrong?

**3. What matters (10 min)**
- When a change goes wrong, how do you notice? What does it cost you?
- Who needs to understand the app after you: a developer, the client, you in six months?
- Where is your app's data stored today? Does anyone ask about that (GDPR, EU hosting)?
- Rank what hurt most in the last project: cost · speed · changes breaking things · not understanding the code · getting it hosted · sign-in and permissions · data and privacy · handing it over.

**4. Show the benchmark tasks (5 min)**: read the seven tasks below. Which ones would you actually ask for? What is missing? What would a typical week of changes look like?

**5. Close**
- Is there anyone else I should talk to?
- May I show you an early version in a few months?

## Notes template (one file per interview in `docs/research/interviews/NN-group.md`, which is git-ignored because it holds personal data)

```
Group / role / country:
Tools used:
Last project (one line):
The moment it got hard:
What it cost (money, time, credits):
Workaround:
Ranking (1 = hurt most):
Tasks they would ask for / missing:
Quotes:
Surprises:
```

## After the interviews

- Summarise per group: the three most common pains, with counts and quotes.
- Compare with the benchmark's tasks and measurements (`docs/benchmarks/m7.md`): add tasks people asked for, drop ones nobody cares about, and weigh the measurements (cost, time, regressions, drift) by what they said hurt.
- Update VISION.md (beachhead, positioning) and ROADMAP.md (M9–M11) with the product decisions, as the M7 exit requires.

## The benchmark tasks

1. Customers should have a phone number.
2. The customer email should be required.
3. Add orders: each order has a number, belongs to a customer and has a total amount.
4. Add a page for orders, and show it in the menu.
5. Only admins may delete customers.
6. Make it possible to search customers by name on the customers page.
7. Show Orders first in the menu.
