# What people say to Smith: t755-haiku

2026-11-13, 66 requests of docs/benchmarks/smith-requests.json (undo and feedback are Studio's rules, not here). Judge: mistral-medium-latest.

| Setup | Kind | Right | Of | By rule | Docs found | Tokens | Cost | Seconds |
|---|---|---|---|---|---|---|---|---|
| haiku | docs-question | 13 | 28 | 0 | 17 | 1219786 | 1.2498 | 85.2 |
| haiku | spec-question | 25 | 38 | 2 |  | 2175077 | 2.2129 | 115.5 |

Wrong ones:

- haiku q-bk-and-members (spec-question): answer, The answer does not state the fact 'until the class starts' from the 'must' list, and it does not violate any 'mustNot' facts.
- haiku q-bk-mail-book (spec-question): question, question
- haiku q-crm-signup (spec-question): answer, The answer does not mention that only colleagues from 'acme.example' email addresses can be invited, which is a required fact from 'must'.
- haiku q-bb-sv-delete-services (spec-question): answer, The answer does not state the fact 'bara ledighet' from the 'must' list.
- haiku q-inv-overview (spec-question): answer, The answer does not mention 'invoiced by month' as required by the 'must' list.
- haiku q-ki-order-notify (spec-question): answer, The answer does not mention that the kitchen gets notified when an order comes in, which is a required fact under 'must'.
- haiku q-ki-sv-others (spec-question): answer, The answer does not state the fact 'besökare kan bara skicka beställningar' from the 'must' list.
- haiku q-rec-who-adds (spec-question): answer, The answer states that anyone (including visitors) and signed-in users can add items, which contradicts the 'must' requirement that only administrators can add items.
- haiku q-st-public-incidents (spec-question): answer, The answer does not state that 'all of them' are visible to the public, and it incorrectly implies that 'investigating' incidents are not visible (contradicting the 'must' requirement that all statuses, including 'investigating', should be visible).
- haiku q-st-api (spec-question): answer, The answer does not mention 'AI assistants too' as required by the 'must' list.
- haiku q-sp-mail-in (spec-question): answer, The answer does not mention that the case status is set to 'open' or that a mail is sent to the customer confirming receipt.
- haiku q-sp-close (spec-question): answer, The answer does not explicitly state that 'agents' can close cases, only mentioning 'admins' and other roles with access to the cases page.
- haiku d-publish (docs-question): answer, docs part not found, The answer does not mention that 'a sandbox needs an invite to publish' (a required fact from 'must').
- haiku d-cost (docs-question): answer, docs part not found, The answer does not explicitly state that 'pricing and plans are not set' or that 'the beta is free'.
- haiku d-export (docs-question): answer, The answer does not mention the ability to 'Download everything (.zip)' or export 'code, history, data and uploads' as required by the 'must' facts. It only confirms 'Export CSV on a list page'.
- haiku d-where-data (docs-question): answer, docs part not found, The answer does not mention that the data is stored in Sweden or that backups are in the same region, which are required facts.
- haiku d-selfhost (docs-question): answer, The answer does not mention 'smithable deploy' as required by the 'must' list.
- haiku d-apps (docs-question): answer, docs part not found, The answer does not mention the specific fact that you can have 10 apps, each with a live and a staging copy.
- haiku d-mail-limit (docs-question): answer, docs part not found, The answer does not mention the specific limits of '100 recipients a day per app' or '1,000 recipients a month per account'.
- haiku d-fi-finnish (docs-question): answer, docs part not found, The answer does not mention that English and Swedish are supported (must), nor does it state that a new language is added upon request (must). Additionally, it incorrectly implies that Finnish is already supported (mustNot).
- haiku d-sv-publish (docs-question): answer, docs part not found, The answer does not explicitly state the facts 'Publish and share' or 'Publish live' as required by the 'must' conditions.
- haiku d-sv-data (docs-question): answer, docs part not found, The answer does not mention that the data is stored in Sweden ('Sverige') or that backups are in the same region ('säkerhetskopior i samma region').
- haiku d-fi-cost (docs-question): answer, docs part not found, The answer does not state that pricing has not been decided ('hinnoittelua ei ole päätetty') or that the beta is free ('beta on ilmainen'). Additionally, it mentions pricing details, which violates the 'mustNot' condition of not including a monthly price ('kuukausihinta').
- haiku d-google (docs-question): answer, The answer does not mention that Google sign-in is under 'Connections' as required by the 'must' facts.
- haiku d-storage (docs-question): answer, docs part not found, The answer does not mention the '2 GB per app' storage limit or that 'uploaded files are included' in the storage capacity.
- haiku d-sv-mcp (docs-question): answer, Svaren saknar omnämnande av 'en nyckel från Team-sidan' och '/mcp', som krävs enligt 'must'.
- haiku long-inv-spec (spec-question): answer, The answer states that the app does not automatically mark invoices as overdue or email clients, which contradicts the 'must' fact that a sent invoice is marked overdue 7 days after its due date. Additionally, it implies the app does not mail the client when it goes overdue, which aligns with 'mustNot', but it fails to confirm that the app mails the client only when an invoice is marked sent (a 'must' fact).
- haiku long-mp-docs (docs-question): answer, The answer does not state that the data is hosted in Sweden, that backups are in the same region, or that there is a downloadable .zip file or a transfer link. It only mentions that data is kept on secure servers (location unspecified) and can be exported, but not in the required formats or with the required guarantees.
