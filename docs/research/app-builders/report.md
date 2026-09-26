# App-builder research: public evidence of user problems and praise

Research cutoff: 26 September 2026. This is the full research response from the conversation, with chat citations converted to portable Markdown source links.

The strongest recurring finding is **paid repair work after the first successful build**: users describe small changes causing regressions, repeated unsuccessful fixes, and uncertainty about the final cost. The EU evidence is narrower and concentrates on **data location, client acceptance, and the price of regional hosting**.

**1. Summary — ranked findings**

Counts below describe a **selected qualitative sample**, not market prevalence: 15 prompt-to-code threads/reviews, five EU-facing discussions, and two additional agency discussions. Each thread counts once per pain, regardless of comment count. The dated sources and coding are in [evidence-register.md](evidence-register.md).

**Group 1: people hitting the limits of prompt-to-code builders**

| Rank | Pain | Sources | Short verbatim evidence |
|---|---|---:|---|
| 1 | **Fixes fail or break previously working behavior.** Progress becomes repeated repair. | **12/15** | “Every time it says it did — but nothing changes.” — Lovable user restoring a broken layout, **10 May 2025**. [Source][lovable-layout] |
| 2 | **Changes have unpredictable metered costs**, especially when corrections also consume credits. | **10/15** | “just to add a couple of category pages” — v0 user reporting $30/day, **21 Aug 2025**. [Source][v0-category] |
| 3 | **Database, backend and permission work becomes difficult**, including before launch. | **5/15** | “trying to get a form that was complete to fill in the DB” — Replit user, **12 Sep 2025**. [Source][replit-agent3] |
| 4 | **Taking ownership or leaving introduces more work**: restricted editing, reconstruction, deployment and data migration. | **4/15** | “It's a one way trip to Github and then OUT.” — Base44 user describing their export experience, **4 Jul 2025 thread**. [Source][base44-migration] |
| 5 | **Larger projects lose usable context or encounter size constraints.** | **2/15** | “workflow nuances get lost” — Bolt user with 15,000+ lines; **21 Jul 2026 according to an index; exact primary date uncertain**. [Thread][bolt-large]; [date index][bolt-index] |

**Group 2: EU businesses and agencies**

Only the first three themes support an EU-facing frequency ranking. The final two are supported by agency evidence whose EU location could not be established; presenting them as established EU prevalence would overstate the research.

| Rank/status | Pain | Sources | Short verbatim evidence |
|---|---|---:|---|
| 1 | **Hosting/data location blocks client acceptance.** | **4/5 EU-facing** | “this is blocking deals in practice” — France-based developer, **25 Nov 2025**. [Source][eu-clients] |
| 2 | **Regional hosting is perceived as priced beyond the project’s budget.** | **3/5 EU-facing** | “not affordable for a startup” — Bubble discussion, **9 Mar 2025**. [Source][eu-price] |
| 3 | **Uncertainty about AI training, retention and deletion complicates client-data decisions.** | **2/5 EU-facing** | “zero data retention (no re-training on client data)” — builder of client apps, **6 Nov 2025**. [Source][eu-privacy] |
| EU prevalence unestablished | **Maintaining delivered apps safely**, including staging, backups and operational failures. | **0/5 EU-facing; 2 adjacent agency sources** | “their warehouse was at a standstill” — agency report, **6 May 2025**; cause disputed. [Source][weweb-stability] |
| EU prevalence unestablished | **Client ownership and handover**, including accounts, connections and reusable copies. | **0/5 EU-facing; 1 adjacent agency source** | “what all will break/have to be rebuilt ?” — client-transfer question, **7 Jan 2026**. [Source][weweb-transfer] |

**2. Concrete numbers**

These are **self-reported experiences**, not audited bills or comparable benchmarks. Credits, tokens, messages and dollars are different units.

| Tool/context | Reported amount or effort | What it covered; qualification | Dated source |
|---|---|---|---|
| Lovable | **>60 credits** repairing; **>200 credits** total | Restoring thumbnail cropping/grid styling. User estimated roughly half the total was wasted. | [10 May 2025][lovable-layout] |
| Lovable | **At least 50 credits** | Trying to resolve a preview/form problem; symptoms persisted after removing the form. | [25 Sep 2025][lovable-preview] |
| Bolt | **Nearly 10 million tokens** | Bakery-app checkout reportedly broke after a security fix; repair still unsuccessful. | [10 Dec 2025][bolt-checkout] |
| Replit | **>$200 for five changes; about nine hours** | Mostly repairing agent-caused problems, according to the commenter. | [12 Sep 2025][replit-agent3] |
| Replit | **$50** on form-to-database work; one run **26 minutes/$9.84** | That run still failed; user eventually found the problem. | [12 Sep 2025][replit-agent3] |
| Replit CRM | **$10–20/prompt; $70 in an afternoon; a day repairing one change** | Different commenter; reported being unable to roll back the database. | [13 Sep 2025][replit-agent3] |
| v0 | **About $20.09 over two hours**, approximately **30 minutes active chat** | Many correction messages. **Internally inconsistent:** says 36 messages, but lists 29+8=37; listed costs total $20.06. | [15 Jun 2025, describing 14 Jun usage][v0-premium] |
| v0 | **$30/day** | Adding a couple of category pages; user contemplated migration if costs persisted. | [21 Aug 2025][v0-category] |
| v0 | Claimed **~$30 for a simple change/prompt** | **Disputed:** Vercel staff found no individual $30 prompt and suggested this was the chat total. | [28 May 2025 thread][v0-churn] |
| v0 | Premium credits exhausted after **six messages** | Task scope and token sizes not supplied; not a six-prompt repair benchmark. | [9 Sep 2026 review](https://uk.trustpilot.com/reviews/6aa1345128d35eb5171c5e64); retrieved through [review listing][v0-reviews] |
| Replit | **>$400/month**, some repairs **$20+** | Combined building/hosting bill; user described maintenance costs as the reason to migrate. | [12 Jun 2026][replit-migration] |
| Replit | **$500 external assessment**; a day on layout | User sought outside help while trying to leave. This does not establish a completed developer handover. | [18–19 May 2025 discussion][replit-costs] |
| Base44 migration | **About $50 in Claude Code credits** | Commenter reported reconstructing a backend from frontend code and existing schemas, then completing migration. Labor excluded. | [4 Jul 2025 thread; reply date not exposed][base44-migration] |
| EU Bubble developer | **Three lost client opportunities; possible €50,000+ value** | Estimated foregone work, **not invoiced losses**. Prospects were large organizations seeking internal dashboards. | [25 Nov 2025][eu-clients] |
| EU hosting discussion | **Approximately $4,000/month** | Community estimate for dedicated regional hosting, **not a verified current vendor quote**. | [7–9 Mar 2025 comments][eu-price] |
| Replit client hosting | Previously **<$12/month**, then **$480 in 36 hours** | Agency attributed the bill to a traffic spike on a client landing page. Location and billing unverified. | [17 May 2026][replit-hosting] |
| v0, positive counterexample | **About $100 for several successful projects** | Reviewer also reported receiving additional credits after failed attempts. | [Published 23 Jun 2026; experience 29 Apr 2026](https://uk.trustpilot.com/reviews/6a3a63ab978d028dc7af88bb); retrieved through [review listing][v0-reviews] |

**When users stop, restart or move—and what happens afterward**

| Observed outcome | Evidence |
|---|---|
| **Pause instead of cancel** | A Replit hobbyist described spending an extra **$50–100**, then not using it for **one or two months**. **12 Sep 2025.** [Source][replit-agent3] |
| **Announce departure after pricing changes** | The v0 “I’m churning” author praised their previous MVP but rejected the new cost of continued iteration. Departure was announced; subsequent migration was not documented. **28 May 2025.** [Source][v0-churn] |
| **Rollback and continue temporarily** | A Bolt e-commerce user recovered by reverting after project-size/Supabase difficulties, while still considering leaving. **3 Jan 2026.** [Source][bolt-size] |
| **Export, then reconstruct missing services** | Base44 commenters described backend reconstruction and a screenshot-guided WordPress rebuild with considerable trial and error. These were reported successes, not independently tested migrations. **4 Jul 2025 thread; individual reply dates unavailable.** [Source][base44-migration] |
| **Take over infrastructure and data migration** | A former Replit user reported moving to a local development workflow and self-hosting, including transferring hundreds of thousands of database rows. **12 Jun 2026.** [Source][replit-migration] |
| **Restart the interface elsewhere** | A v0 reviewer reported access/export problems and rebuilding the UI, losing four days of work. This remains an unverified individual account. **2 Jun 2026.** [Review](https://uk.trustpilot.com/reviews/6a1f13268a7f601d3e3bcb09); retrieved through [listing][v0-reviews] |
| **Deliberately discard prototype code** | A Hacker News contributor described using builders to communicate requirements and sometimes retaining only screenshots. This was an intentional team workflow. **9 Jul 2025.** [Source][hn] |

There is **no demonstrated universal app-size ceiling**. The Bolt thread reporting trouble at 15,000+ lines also contains a positive account of approximately **28,900 TypeScript lines across 67 files**, supported by explicit project instructions and external AI assistance. **2026 thread; indexed date 21 July is uncertain.** [Thread][bolt-large]; [date index][bolt-index].

**3. Five things users praise**

These are the clearest positive themes in the retrieved material. The sample does not support a reliable population-wide frequency ranking.

| Praise | What users actually valued |
|---|---|
| **Fast movement from idea to functional prototype** | A Hacker News user described turning an afternoon idea into a roughly one-hour newsletter project; others used functional prototypes to clarify stakeholder requirements. **9 Jul 2025.** [Source][hn] |
| **Polished initial interfaces** | A v0 reviewer praised crisp, clean, fast visual design even while criticizing later pricing and control. **20 Aug 2025.** [Source][v0-reviews] |
| **Making working software accessible to non-programmers** | A Base44 commenter who had never coded described building a functional site with follow-ups, pop-ups and language integration before seeking more control. **4 Jul 2025 thread; reply date unavailable.** [Source][base44-migration] |
| **Infrastructure handled in one place** | The user who later left Replit still valued being able to focus on building rather than infrastructure and credited it with helping them move quickly. **12 Jun 2026.** [Source][replit-migration] |
| **Understandable, interactive assistance** | A v0 reviewer praised understandable code, ease of use and explanations of changes. **Published 25 Aug 2025; experience 20 Aug.** [Source][v0-reviews] |

**4. Evidence for the specific changes you listed**

Several precise examples come from established no-code communities. They demonstrate the task being wanted; they do **not** establish how frequently prompt-to-code users request it.

| Task | Evidence strength | User wording and context |
|---|---|---|
| **Add a field to a form** | **Direct, with qualification** | “any field I add into the form container” — wants added fields to inherit validation in a reusable add/edit popup. It is a form-behavior question, not a measured one-field change. WeWeb, **22 Aug 2025**. [Source][task-field] |
| **Make a field required** | **Direct** | “this input should not be empty” — approximately 50 conditionally visible fields; wants required-field validation when saving. Bubble, **1–8 May 2025**. [Source][task-required] |
| **Add a related list** | **Direct** | “add an Order inside the row of the desired Customer” — Customers–Orders–Goods structure; difficulty obtaining input from the correct row. WeWeb, **6 Mar 2025**. [Source][task-related] |
| **Add a page to the menu** | **Adjacent evidence** | “navigate to my selected page dynamically” — dashboard menu destinations including users, refunds and settings. This establishes menu-routing work, not an explicit request to insert one new menu item. WeWeb, **13 Jan 2025**. [Source][task-menu] |
| **Restrict an action to admins** | **Direct for page access; action-specific evidence missing** | User had “whitelisted specific usernames for access” and questioned security before launch. Lovable, **15 Jul 2026**. [Source][task-admin] |
| **Add search** | **Direct** | “currently stuck with the search bar and filtering” — first-app builder seeking implementation help. Bubble, **15 May 2025**. [Source][task-search] |
| **Reorder navigation** | **Not established** | No sufficiently clear, dated firsthand example retained. Tutorials and advertised features were not counted as expressed demand. |

Other concrete changes mentioned include **thumbnail cropping and grid styling** (Lovable, **10 May 2025**), **moving a header and saving a form into the database** (Replit, **12 Sep 2025**), **adding category pages** (v0, **21 Aug 2025**), and **security changes affecting checkout** (Bolt, **10 Dec 2025**). Sources: [Lovable][lovable-layout], [Replit][replit-agent3], [v0][v0-category], [Bolt][bolt-checkout].

For delivered business apps, users also describe **clearing barcode-scanner inputs and repairing warehouse-location dropdowns** (WeWeb agency, **6 May 2025**) and **backups, staging, reusable client templates and transferring database connections** (WeWeb, **7–12 Jan 2026**). Sources: [warehouse workflow][weweb-stability], [client transfer][weweb-transfer].

**5. Gaps and biases**

- **Complaint selection:** Support forums and searches about failure disproportionately surface unhappy users. These counts cannot establish churn rates, average costs, or which product performs best. Multiple threads can also contain the same person.
- **EU coverage is limited:** Only two of the five EU-facing discussions explicitly establish European practitioners. Much of the evidence concerns Bubble and larger-client procurement. It does not establish typical requirements for EU microbusinesses, booking businesses, or each member state.
- **Privacy concerns are not legal findings:** The evidence establishes requests for data-location and privacy assurances. It does not prove unlawful processing, personal-data training, or that a particular hosting arrangement satisfies GDPR.
- **Historical conditions differ:** Reports span 2025–2026 and different models, plans and workflows. They should not be treated as statements of current pricing or functionality.
- **Numbers lack comparable denominators:** Invoices, prompt logs, task complexity and labor costs are usually missing. Exact repair-prompt counts are particularly weak; message totals are not necessarily fix attempts.
- **Some important claims are disputed:** Vercel challenged the $30 single-prompt interpretation. WeWeb acknowledged a component oversight but disputed that platform updates could alter already-deployed apps without republication. **28 May 2025 and 5–6 May 2025 discussions.** Sources: [v0][v0-churn], [WeWeb][weweb-stability].
- **Migration follow-through is thin:** There are reported completed moves and rewrites, but little independent code review, final developer-handover evidence, or long-term maintenance accounting.
- **Channel coverage is uneven:** Reddit, Hacker News, Trustpilot and public product forums supplied the usable evidence. No sufficiently retrievable dated individual G2/Capterra reviews were retained in the counts; private Discords were unavailable, and promotional migration content was excluded.
- **Missing evidence is not missing demand:** This particularly applies to navigation reordering, individual admin-only actions, and EU-specific handover arrangements.

[lovable-layout]: https://www.reddit.com/r/lovable/comments/1kj5iqt/help_needed/
[lovable-preview]: https://www.reddit.com/r/lovable/comments/1nql9o5/i_cant_waste_another_credit_please_help/
[v0-category]: https://community.vercel.com/t/credits-are-burning-way-too-fast-under-the-new-pricing-model/20288
[replit-agent3]: https://replit.discourse.group/t/thoughts-on-agent-3-replits-pricing-and-target-audience-as-a-casual-user/7028
[base44-migration]: https://www.reddit.com/r/Base44/comments/1lron1x/migrating_away_from_base44/
[bolt-large]: https://www.reddit.com/r/boltnewbuilders/comments/1v2vsvn/anyone_else_seeing_regressions_in_larger_bolt/
[bolt-index]: https://comparativo.clickmvp.com/boltnewbuilders-relatorio-negativo.html
[eu-clients]: https://forum.bubble.io/t/loss-of-major-eu-clients-due-to-us-hosting/386061
[eu-price]: https://forum.bubble.io/t/bubble-app-on-europe-eu-server-located/6893?page=8
[eu-privacy]: https://www.reddit.com/r/nocode/comments/1opu8h6/looking_for_the_most_privacyfriendly_ai_api/
[weweb-stability]: https://community.weweb.io/t/urgent-concern-production-breaking-changes-platform-stability/18129
[weweb-transfer]: https://community.weweb.io/t/app-transfer-challenges/20601
[bolt-checkout]: https://www.reddit.com/r/boltnewbuilders/comments/1pitqk5/bolt_keeps_breaking_my_checkout/
[v0-premium]: https://community.vercel.com/t/v0-dev-premium-credits-gone-fast-errors-cost-more-than-dev-hire/13407
[v0-churn]: https://community.vercel.com/t/bye-v0-im-churning/11928
[v0-reviews]: https://uk.trustpilot.com/review/v0.dev
[replit-migration]: https://www.reddit.com/r/replit/comments/1u424ly/my_replit_bill_hit_400month_so_i_finally_learned/
[replit-costs]: https://replit.discourse.group/t/new-agent-costs-outrageous/4551
[replit-hosting]: https://www.reddit.com/r/nocode/comments/1tfun8z/warning_replits_autoscale_has_no_spend_cap_by/
[bolt-size]: https://www.reddit.com/r/boltnewbuilders/comments/1q2w43r/cant_make_changes_on_my_boltnew_app_because_of/
[hn]: https://news.ycombinator.com/item?id=44511770
[task-field]: https://community.weweb.io/t/using-a-popup-to-edit-add-data/19746
[task-required]: https://forum.bubble.io/t/check-valid-fields-at-once/368317
[task-related]: https://community.weweb.io/t/how-do-i-get-the-data-from-an-input-field-within-a-collection-from-only-one-specific-row/17032
[task-menu]: https://community.weweb.io/t/dynamic-navigation-to-pages/15382
[task-admin]: https://www.reddit.com/r/lovable/comments/1ux86mw/best_way_to_setup_an_admin_page/
[task-search]: https://forum.bubble.io/t/help-with-search-bar-and-filtering-in-my-first-app/369701
