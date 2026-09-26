# App-builder public evidence register
Research cutoff: 26 September 2026.

## Method
This is a purposive qualitative sample, not a representative survey or an estimate of market prevalence. Rankings count distinct source units (a thread including its comments, or one individual review), not comments, votes, or people. A source can support several categories. Repeated authors across threads remain possible: ericgurr appears in A5 and A6. Source dates are publication dates unless explicitly marked as thread dates or index-derived. All monetary, time and project-size figures are self-reported, not audited. Historical product behavior is not asserted to be current behavior.

The core ranking uses 15 prompt-to-code sources (A1–A16, with A3 deliberately omitted), five EU-facing sources (E1–E5), and two adjacent client-delivery sources whose authors' EU location was not established (B1, B3). Supplementary sources do not increase those ranking counts.

Category codes:
- R: unsuccessful repairs, regressions, or repeated error correction.
- C: metered costs or paid repair work obstruct progress.
- D: database/backend/authentication/permission work becomes a difficulty or concern.
- X: taking ownership or moving beyond the builder introduces access, export, reconstruction or operational work.
- S: explicit project-size/context difficulty.
- H: EU hosting/data-location requirement or concern.
- P: affordability of regional hosting or desire for access on lower tiers.
- T: uncertainty/requirements concerning AI training, retention or deletion.
- M: maintaining delivered client apps safely.
- O: handing ownership/accounts to clients.

## Prompt-to-code core corpus
| ID | Date | Source | Codes | Evidence and limits |
|---|---|---|---|---|
| A1 | 2025-05-10 | [Lovable: Help needed](https://www.reddit.com/r/lovable/comments/1kj5iqt/help_needed/) | R,C | Statue-catalog layout/cropping repair; over 60 credits reverting, over 200 total; user estimates half wasted. Replies explain restore controls: some friction may reflect unfamiliarity. |
| A2 | 2025-09-25 | [Lovable: I can't waste another credit](https://www.reddit.com/r/lovable/comments/1nql9o5/i_cant_waste_another_credit_please_help/) | R,C | At least 50 credits fixing preview/form issue; deleting form did not eliminate broader symptom. Export suggested, not demonstrated as completed. |
| A4 | Thread 2025-07-04; individual migration reply dates not exposed | [Base44: Migrating away](https://www.reddit.com/r/Base44/comments/1lron1x/migrating_away_from_base44/) | R,D,X | OP reports small fixes damage other pages, restricted system files and no usable round-trip. A commenter reports about $50 Claude Code credits reconstructing backend; another describes screenshot-guided WordPress recreation. These are user experiences at posting time, not verified current export specifications. |
| A5 | 2025-05-18 to 2025-05-29 | [Replit: New agent costs outrageous](https://replit.discourse.group/t/new-agent-costs-outrageous/4551) | R,C | ericgurr reports $6/hour repair loops, a day of layout work and $500 paid for external assessment. Assessment is not proof of completed handover. |
| A6 | 2025-09-12 to 2025-09-15 | [Replit: Agent 3 pricing and target audience](https://replit.discourse.group/t/thoughts-on-agent-3-replits-pricing-and-target-audience-as-a-casual-user/7028) | R,C,D | Five changes over $200, about nine hours repair; $50 form-to-DB task; failed 26-minute $9.84 run. Different CRM commenter: $10–20/prompt, $70 afternoon and a day repairing a change, unable to roll back DB. OP stops using for one to two months after spending extra $50–100. |
| A7 | 2025-06-15; usage 2025-06-14 | [v0 premium credits](https://community.vercel.com/t/v0-dev-premium-credits-gone-fast-errors-cost-more-than-dev-hire/13407) | R,C | Reports about $20.09 over two hours, around 30 minutes active chat, many correction prompts. Internally inconsistent: says 36 messages, breakdown 29+8=37; component costs sum to $20.06. |
| A8 | Thread 2025-05-28 | [v0: I'm churning](https://community.vercel.com/t/bye-v0-im-churning/11928) | R,C,D | OP announces departure after price change; praises prior MVP. Claimed ~$30 single change/prompt disputed by Vercel staff, who suggest total chat. Another commenter reports failed Neon integration and ~$15 total leaving shell code. |
| A9 | 2025-08-21 | [v0: credits burning too fast](https://community.vercel.com/t/credits-are-burning-way-too-fast-under-the-new-pricing-model/20288) | R,C | $30/day for a couple category pages; another commenter estimates 20% of iterations correct breakage. Conditional plan to migrate, not completed migration. |
| A10 | 2025-07-09 | [Hacker News discussion](https://news.ycombinator.com/item?id=44511770) | R | Bolt repair-loop report; other contributors praise v0 functional prototypes, stakeholder communication, family itinerary and newsletter tooling. One team deliberately discards prototype code. Competitor-promotion comment excluded. |
| A11 | 2026-07-21 according to secondary index; primary exposes relative date only | [Bolt: regressions in larger projects](https://www.reddit.com/r/boltnewbuilders/comments/1v2vsvn/anyone_else_seeing_regressions_in_larger_bolt/) | R,C,S | OP reports 15,000+ lines and paid recovery from regressions/context loss. Counterexample in same thread: about 28,900 TypeScript lines across 67 files, positive experience using explicit project knowledge and external AI assistance. No universal size limit inferred. [Date index](https://comparativo.clickmvp.com/boltnewbuilders-relatorio-negativo.html). |
| A12 | 2026-01-03 | [Bolt: project size blocks changes](https://www.reddit.com/r/boltnewbuilders/comments/1q2w43r/cant_make_changes_on_my_boltnew_app_because_of/) | D,X,S | E-commerce app loses Supabase connection; user reports ignored prompts/project-size limit, recovers through rollback, still considers move. Commenter describes external editor/deployment workflow. Exact root cause unverified. |
| A13 | 2025-12-10 | [Bolt: checkout keeps breaking](https://www.reddit.com/r/boltnewbuilders/comments/1pitqk5/bolt_keeps_breaking_my_checkout/) | R,C | Bakery app security fix reportedly broke checkout; nearly ten million tokens spent unsuccessfully repairing. Location not established. |
| A14 | 2026-06-12 | [Replit: $400/month and migration](https://www.reddit.com/r/replit/comments/1u424ly/my_replit_bill_hit_400month_so_i_finally_learned/) | R,C,X | Over $400/month combined building/hosting; repairs sometimes $20+ and create new issues. Reports move to VS Code/Claude/self-hosting and migration of hundreds of thousands of database rows. Values Replit's initial speed/infrastructure abstraction. |
| A15 | 2026-06-02 | [v0 Trustpilot: Bella](https://uk.trustpilot.com/reviews/6a1f13268a7f601d3e3bcb09) | X | Reports credit exhaustion/access problems, unusable export and rebuilding UI elsewhere, four days lost. Unverified review; read through [review listing](https://uk.trustpilot.com/review/v0.dev). Does not establish universal export behavior. |
| A16 | 2026-07-15 | [Lovable: admin page](https://www.reddit.com/r/lovable/comments/1ux86mw/best_way_to_setup_an_admin_page/) | D | Preparing launch, user worries whether username whitelist is safe. Need for admin-only access; not evidence of an observed breach or an exact admin-only action request. |

Computed counts: R=12/15 (A1,A2,A4,A5,A6,A7,A8,A9,A10,A11,A13,A14); C=10/15 (A1,A2,A5,A6,A7,A8,A9,A11,A13,A14); D=5/15 (A4,A6,A8,A12,A16); X=4/15 (A4,A12,A14,A15); S=2/15 (A11,A12).
If the date-uncertain A11 is excluded: R=11/14, C=9/14, D=5/14, X=4/14, S=1/14; ranking order unchanged.

## EU-facing and adjacent client-delivery sources
| ID | Date | Source | Codes | Scope and limits |
|---|---|---|---|---|
| E1 | 2025-11-25 | [Bubble: loss of major EU clients](https://forum.bubble.io/t/loss-of-major-eu-clients-due-to-us-hosting/386061) | H,P | France-based developer reports three lost large-client opportunities and possible €50k+ opportunity value; prospective internal dashboards. Enterprise recurring cost rejected. Clients are large organizations, not representative small businesses. Regulatory claims are disputed within thread and are not adopted here. |
| E2 | 2026-01-19 to 2026-01-20 | [European Bubble users](https://forum.bubble.io/t/european-bubble-users-gafam-and-datas/389383) | H,P | Self-identified European builders report end-client skepticism about US infrastructure and want regional choices on lower tiers; praise existing quality/infrastructure. |
| E3 | 2025-03-07 to 2025-03-09 comments | [Bubble EU server thread](https://forum.bubble.io/t/bubble-app-on-europe-eu-server-located/6893?page=8) | H,P | Community estimate about $4,000/month for regional dedicated hosting; described as unaffordable for startup. This is not a current official quotation. Author geography not verified. |
| E4 | 2025-03-13 | [Bubble AI training/deletion concerns](https://forum.bubble.io/t/q-for-app-owners-with-european-users-and-or-for-legal-experts-how-concerned-are-you-with-our-inability-to-comply-with-gdpr-art-17-given-uncertainty-about-bubble-ais-training-data/363146) | T | Asks about training-data transparency and deletion requests. Concern is evidence; actual use of personal data for training is not established. Author geography not verified. |
| E5 | 2025-11-06 | [No-code client apps: privacy-friendly AI API](https://www.reddit.com/r/nocode/comments/1opu8h6/looking_for_the_most_privacyfriendly_ai_api/) | H,T | n8n/Softr/Airtable client apps; asks for EU hosting, zero retention, no client-data training and privacy safeguards. Author geography not verified. |
| B1 | 2026-01-07 to 2026-01-12 | [WeWeb: app transfer challenges](https://community.weweb.io/t/app-transfer-challenges/20601) | M,O | Client transfer, Supabase credentials, reusable copy, staging/backups and applying fixes without disturbing live app. Questions, not demonstrated failed handover. EU location not established. |
| B3 | 2025-05-05 to 2025-05-06 | [WeWeb: production stability](https://community.weweb.io/t/urgent-concern-production-breaking-changes-platform-stability/18129) | M | Agency reports client warehouse scanning failures, delayed dispatch and costly fixes. Vendor acknowledges component oversight but disputes that updates can change already-deployed, unrepublished apps. EU location not established. |

EU-facing counts: H=4/5 (E1,E2,E3,E5); P=3/5 (E1,E2,E3); T=2/5 (E4,E5).
Maintenance: 0/5 EU-facing, 2/2 adjacent. Ownership handover: 0/5 EU-facing, 1/2 adjacent.
Zero means not established in this selected corpus, not absence of the problem.
Only E1 and E2 explicitly identify a European practitioner context. E3–E5 discuss EU requirements without establishing the author's location.

## Routine-change evidence (supplementary; not counted above)
| Task | Date | Source | Strength |
|---|---|---|---|
| Add a form field | 2025-08-22 | [WeWeb popup add/edit data](https://community.weweb.io/t/using-a-popup-to-edit-add-data/19746) | Direct discussion of adding fields and inheriting validation; reusable form behavior rather than a measured one-field change. |
| Make a field required | 2025-05-01 to 2025-05-08 | [Bubble: check valid fields at once](https://forum.bubble.io/t/check-valid-fields-at-once/368317) | Direct: approximately 50 conditionally visible fields, validate required fields at save; solution evolves through May 8. Seven calendar days is not seven days labor. |
| Related list | 2025-03-06 | [WeWeb: inputs from one collection row](https://community.weweb.io/t/how-do-i-get-the-data-from-an-input-field-within-a-collection-from-only-one-specific-row/17032) | Direct: Customers–Orders–Goods and add order inside chosen customer row. |
| Page in menu | 2025-01-13; response 2025-01-28 | [WeWeb: dynamic navigation](https://community.weweb.io/t/dynamic-navigation-to-pages/15382) | Adjacent: menu destinations users/refunds/settings and dynamic routing. Not an explicit measured request to add one new menu item. |
| Admin action | 2026-07-15 | A16 | Direct admin-page restriction; individual action authorization not established. |
| Search | 2025-05-15 | [Bubble: search bar and filtering](https://forum.bubble.io/t/help-with-search-bar-and-filtering-in-my-first-app/369701) | Direct search/filter request. |
| Reorder navigation | — | No eligible firsthand example established | Do not count tutorials/vendor feature pages as expressed user demand. |

## Additional numeric and positive counterexamples
- [v0 Trustpilot listing](https://uk.trustpilot.com/review/v0.dev): Nabarun Das, 2026-09-09, says Premium credits exhausted after six messages; task and token sizes not given. Alex G, published 2026-06-23, experience dated 2026-04-29, says approximately $100 for several successful projects and that support supplied credits after failed attempts. Bruno Landrichter, published 2025-08-25, experience dated 2025-08-20, praises usability, understandable code and explanations.
- [Replit hosting agency report](https://www.reddit.com/r/nocode/comments/1tfun8z/warning_replits_autoscale_has_no_spend_cap_by/), 2026-05-17: says a client landing page went from below $12/month to $480 in 36 hours after a traffic spike. Not verified billing or a general statement about platform safeguards.
- [Replit student report](https://www.reddit.com/r/replit/comments/1udnndh/replit_agent_cost_me_85_as_a_student_in_2_days/), 2026-06-23 to 2026-06-26: $20 subscription plus $65 agent charges over two days; later reports courtesy refund, amount unstated.
- [Replit spending discussion](https://www.reddit.com/r/replit/comments/1vzbx0d/how_much_are_you_spending_monthly_on_replit_im_a/), 2026-08-29 to 2026-08-30: includes positive all-in-one accounts and lower spending after model/workflow changes. Not comparable to earlier model/pricing regimes.

## Gaps and biases
English-language public support forums and complaint-oriented searches dominate. Threads and reviews are not independent customers, and cannot establish prevalence, churn rates or product rankings. EU evidence disproportionately concerns Bubble and larger-client procurement; it does not establish the needs of ordinary EU microbusinesses or every member state. No representative booking-business cohort was found. EU authors' location and company size are usually missing. Handover and maintenance evidence is stronger in globally accessible agency communities than in verified EU practitioners.

Private Discord discussion is inaccessible. No usable dated individual G2/Capterra evidence was retained for the counts; YouTube/blog migration marketing was not treated as independent user evidence. Financial figures lack invoices, logs or reproducible tasks. Credit/token units and plans are not comparable across products or years. Some migrations are asserted successful without code review; independent developer audits, final maintenance costs and long-term operating outcomes remain thin. Absence of an exact requested task in this search is not absence of demand.

