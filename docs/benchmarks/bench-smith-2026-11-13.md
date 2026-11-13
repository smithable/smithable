# What people say to Smith: 2026-11-13

2026-11-13, 306 requests of docs/benchmarks/smith-requests.json (undo and feedback are Studio's rules, not here). Judge: mistral-medium-latest.

The small rows of this run are not valid: 119 of its 275 requests were refused by the provider’s rate limit before the script asked again on a 429. The valid small run is [bench-smith-2026-11-13-small](bench-smith-2026-11-13-small.md); the small>better rows here stand (one request rate-limited).

| Setup | Kind | Right | Of | By rule | Tokens | Cost | Seconds |
|---|---|---|---|---|---|---|---|
| small | ambiguous | 11 | 25 | 0 | 333863 | 0.0515 | 190.3 |
| small | change | 32 | 104 | 14 | 1283488 | 0.1957 | 815.1 |
| small | custom-code | 4 | 13 | 0 | 112619 | 0.0171 | 92.5 |
| small | data | 5 | 23 | 0 | 296082 | 0.0452 | 207.4 |
| small | docs-question | 0 | 28 | 0 | 312867 | 0.0575 | 200.9 |
| small | off-topic | 6 | 10 | 0 | 92877 | 0.0141 | 50.8 |
| small | smalltalk | 15 | 17 | 13 | 30829 | 0.0047 | 26.3 |
| small | spec-question | 7 | 38 | 2 | 411085 | 0.0752 | 277.6 |
| small | two-things | 4 | 17 | 0 | 353339 | 0.0541 | 189.1 |
| small>better | ambiguous | 16 | 25 | 0 | 518864 | 0.3153 | 222.4 |
| small>better | change | 62 | 104 | 14 | 3207413 | 2.6072 | 989.0 |
| small>better | custom-code | 8 | 13 | 0 | 333671 | 0.2580 | 134.9 |
| small>better | data | 17 | 23 | 0 | 830045 | 0.5958 | 329.0 |
| small>better | docs-question | 3 | 28 | 0 | 559936 | 0.2447 | 263.7 |
| small>better | off-topic | 8 | 10 | 0 | 157445 | 0.0914 | 77.0 |
| small>better | smalltalk | 17 | 17 | 13 | 61705 | 0.0302 | 26.3 |
| small>better | spec-question | 12 | 38 | 2 | 742797 | 0.4859 | 312.6 |
| small>better | two-things | 12 | 17 | 0 | 623428 | 0.4676 | 187.2 |

Wrong ones:

- small bk-bio-required (change): failed, No model found a change that applies. mistral-small-latest answered 429: {"object":"error","message":"Rate limit exceeded","type":"rate_limited","param":null,"code":"1300","raw_status_code":429}
- small bk-capacity-default (change): change, setCapacity for changeField
- small bk-level-intermediate (change): failed, No model found a change that applies. mistral-small-latest answered 429: {"object":"error","message":"Rate limit exceeded","type":"rate_limited","param":null,"code":"1300","raw_status_code":429}
- small bk-hide-about (change): change, setNavigation for setPublic
- small bk-schedule-agenda (change): failed, No model found a change that applies. mistral-small-latest answered 429: {"object":"error","message":"Rate limit exceeded","type":"rate_limited","param":null,"code":"1300","raw_status_code":429}
- small bk-schedule-color-level (change): question, question
- small bk-reminder-2h (change): failed, No model found a change that applies. mistral-small-latest answered 429: {"object":"error","message":"Rate limit exceeded","type":"rate_limited","param":null,"code":"1300","raw_status_code":429}
- small bk-fi-phone-messages (change): failed, No model found a change that applies. mistral-small-latest answered 429: {"object":"error","message":"Rate limit exceeded","type":"rate_limited","param":null,"code":"1300","raw_status_code":429}
- small bk-cancel-2h (change): failed, No model found a change that applies. mistral-small-latest answered 429: {"object":"error","message":"Rate limit exceeded","type":"rate_limited","param":null,"code":"1300","raw_status_code":429}
- small bk-sv-ask-members (change): none, none: This changes nothing.
- small crm-email-required (change): failed, No model found a change that applies. mistral-small-latest answered 429: {"object":"error","message":"Rate limit exceeded","type":"rate_limited","param":null,"code":"1300","raw_status_code":429}
- small crm-status-returned (change): failed, No model found a change that applies. mistral-small-latest answered 429: {"object":"error","message":"Rate limit exceeded","type":"rate_limited","param":null,"code":"1300","raw_status_code":429}
- small crm-followups-no-trash (change): failed, No model found a change that applies. mistral-small-latest answered 429: {"object":"error","message":"Rate limit exceeded","type":"rate_limited","param":null,"code":"1300","raw_status_code":429}
- small crm-followups-rename-page (change): failed, No model found a change that applies. mistral-small-latest answered 429: {"object":"error","message":"Rate limit exceeded","type":"rate_limited","param":null,"code":"1300","raw_status_code":429}
- small crm-tones (change): none, none: This changes nothing.
- small crm-sv-segment-required (change): failed, No model found a change that applies. mistral-small-latest answered 429: {"object":"error","message":"Rate limit exceeded","type":"rate_limited","param":null,"code":"1300","raw_status_code":429}
- small crm-followup-priority (change): failed, No model found a change that applies. mistral-small-latest answered 429: {"object":"error","message":"Rate limit exceeded","type":"rate_limited","param":null,"code":"1300","raw_status_code":429}
- small crm-mail-manager (change): failed, No model found a change that applies. mistral-small-latest answered 429: {"object":"error","message":"Rate limit exceeded","type":"rate_limited","param":null,"code":"1300","raw_status_code":429}
- small bb-phone-required (change): failed, No model found a change that applies. mistral-small-latest answered 429: {"object":"error","message":"Rate limit exceeded","type":"rate_limited","param":null,"code":"1300","raw_status_code":429}
- small bb-service-45 (change): failed, No model found a change that applies. mistral-small-latest answered 429: {"object":"error","message":"Rate limit exceeded","type":"rate_limited","param":null,"code":"1300","raw_status_code":429}
- small bb-cancel-24h (change): failed, No model found a change that applies. mistral-small-latest answered 429: {"object":"error","message":"Rate limit exceeded","type":"rate_limited","param":null,"code":"1300","raw_status_code":429}
- small bb-sms-confirm (change): failed, No model found a change that applies. mistral-small-latest answered 429: {"object":"error","message":"Rate limit exceeded","type":"rate_limited","param":null,"code":"1300","raw_status_code":429}
- small bb-fi-barber-email (change): failed, No model found a change that applies. mistral-small-latest answered 429: {"object":"error","message":"Rate limit exceeded","type":"rate_limited","param":null,"code":"1300","raw_status_code":429}
- small inv-notes-required (change): change, addField for changeField
- small inv-vat-required (change): failed, No model found a change that applies. mistral-small-latest answered 429: {"object":"error","message":"Rate limit exceeded","type":"rate_limited","param":null,"code":"1300","raw_status_code":429}
- small inv-overdue-3 (change): failed, No model found a change that applies. mistral-small-latest answered 429: {"object":"error","message":"Rate limit exceeded","type":"rate_limited","param":null,"code":"1300","raw_status_code":429}
- small inv-tones (change): none, none: This changes nothing.
- small inv-totals (change): failed, No model found a change that applies. mistral-small-latest answered 429: {"object":"error","message":"Rate limit exceeded","type":"rate_limited","param":null,"code":"1300","raw_status_code":429}
- small inv-sort-newest (change): none, none: This changes nothing.
- small inv-overdue-mail (change): failed, No model found a change that applies. mistral-small-latest answered 429: {"object":"error","message":"Rate limit exceeded","type":"rate_limited","param":null,"code":"1300","raw_status_code":429}
- small inv-sv-currency (change): question, question
- small inv-sv-language (change): failed, No model found a change that applies. mistral-small-latest answered 429: {"object":"error","message":"Rate limit exceeded","type":"rate_limited","param":null,"code":"1300","raw_status_code":429}
- small ki-calories-rename (change): none, none: No operation can add a field to a model. You can add the field yourself in src/custom/models/Dish.ts and src/custom/models/Dish.ts, naming the field calories and giving it a type like decimal or int, then run the app to see it on the dishes page.
- small ki-diet-glutenfree (change): failed, No model found a change that applies. mistral-small-latest answered 429: {"object":"error","message":"Rate limit exceeded","type":"rate_limited","param":null,"code":"1300","raw_status_code":429}
- small ki-email-required (change): failed, No model found a change that applies. mistral-small-latest answered 429: {"object":"error","message":"Rate limit exceeded","type":"rate_limited","param":null,"code":"1300","raw_status_code":429}
- small ki-sunday-hours (change): change, changeField,setText for editSpec
- small ki-dishes-cards (change): failed, No model found a change that applies. mistral-small-latest answered 429: {"object":"error","message":"Rate limit exceeded","type":"rate_limited","param":null,"code":"1300","raw_status_code":429}
- small ki-sms-ready (change): failed, No model found a change that applies. mistral-small-latest answered 429: {"object":"error","message":"Rate limit exceeded","type":"rate_limited","param":null,"code":"1300","raw_status_code":429}
- small ki-sv-kids (change): question, question
- small ki-fi-allergens-required (change): failed, No model found a change that applies. mistral-small-latest answered 429: {"object":"error","message":"Rate limit exceeded","type":"rate_limited","param":null,"code":"1300","raw_status_code":429}
- small ki-orders-filter-default (change): change, setDefaultFilter,setFilters for setDefaultFilter
- small mp-category-toys (change): failed, No model found a change that applies. mistral-small-latest answered 429: {"object":"error","message":"Rate limit exceeded","type":"rate_limited","param":null,"code":"1300","raw_status_code":429}
- small mp-no-review (change): failed, No model found a change that applies. mistral-small-latest answered 429: {"object":"error","message":"Rate limit exceeded","type":"rate_limited","param":null,"code":"1300","raw_status_code":429}
- small mp-sort-price (change): failed, No model found a change that applies. mistral-small-latest answered 429: {"object":"error","message":"Rate limit exceeded","type":"rate_limited","param":null,"code":"1300","raw_status_code":429}
- small rec-kind-wishlist (change): failed, No model found a change that applies. mistral-small-latest answered 429: {"object":"error","message":"Rate limit exceeded","type":"rate_limited","param":null,"code":"1300","raw_status_code":429}
- small rec-members-add (change): failed, No model found a change that applies. mistral-small-latest answered 429: {"object":"error","message":"Rate limit exceeded","type":"rate_limited","param":null,"code":"1300","raw_status_code":429}
- small rec-sv-app-name (change): failed, No model found a change that applies. mistral-small-latest answered 429: {"object":"error","message":"Rate limit exceeded","type":"rate_limited","param":null,"code":"1300","raw_status_code":429}
- small rec-cafe (change): failed, No model found a change that applies. applyTheme: applyTheme: "mode" is missing.
- small rec-brand-green (change): failed, No model found a change that applies. applyTheme: applyTheme: "mode" is missing.
- small rec-sv-compact (change): failed, No model found a change that applies. mistral-small-latest answered 429: {"object":"error","message":"Rate limit exceeded","type":"rate_limited","param":null,"code":"1300","raw_status_code":429}
- small st-severity (change): failed, No model found a change that applies. mistral-small-latest answered 429: {"object":"error","message":"Rate limit exceeded","type":"rate_limited","param":null,"code":"1300","raw_status_code":429}
- small st-component-required (change): change, setFieldRules for changeField
- small st-staff-components (change): failed, No model found a change that applies. mistral-small-latest answered 429: {"object":"error","message":"Rate limit exceeded","type":"rate_limited","param":null,"code":"1300","raw_status_code":429}
- small st-hide-maintenance (change): failed, No model found a change that applies. mistral-small-latest answered 429: {"object":"error","message":"Rate limit exceeded","type":"rate_limited","param":null,"code":"1300","raw_status_code":429}
- small st-mail-admins (change): failed, No model found a change that applies. mistral-small-latest answered 429: {"object":"error","message":"Rate limit exceeded","type":"rate_limited","param":null,"code":"1300","raw_status_code":429}
- small st-remove-uptime (change): failed, No model found a change that applies. mistral-small-latest answered 429: {"object":"error","message":"Rate limit exceeded","type":"rate_limited","param":null,"code":"1300","raw_status_code":429}
- small st-sv-icon (change): failed, No model found a change that applies. mistral-small-latest answered 429: {"object":"error","message":"Rate limit exceeded","type":"rate_limited","param":null,"code":"1300","raw_status_code":429}
- small st-fi-severity (change): failed, No model found a change that applies. mistral-small-latest answered 429: {"object":"error","message":"Rate limit exceeded","type":"rate_limited","param":null,"code":"1300","raw_status_code":429}
- small st-api-monitoring (change): failed, No model found a change that applies. mistral-small-latest answered 429: {"object":"error","message":"Rate limit exceeded","type":"rate_limited","param":null,"code":"1300","raw_status_code":429}
- small sp-priority-2 (change): none, none: Already done: the priority field of SupportCase is already set to 3 by default, and the app has no rule that sets it to 2.
- small sp-autoclose (change): failed, No model found a change that applies. mistral-small-latest answered 429: {"object":"error","message":"Rate limit exceeded","type":"rate_limited","param":null,"code":"1300","raw_status_code":429}
- small sp-newest (change): failed, No model found a change that applies. mistral-small-latest answered 429: {"object":"error","message":"Rate limit exceeded","type":"rate_limited","param":null,"code":"1300","raw_status_code":429}
- small sp-by-priority (change): failed, No model found a change that applies. mistral-small-latest answered 429: {"object":"error","message":"Rate limit exceeded","type":"rate_limited","param":null,"code":"1300","raw_status_code":429}
- small sp-thread (change): none, none: This changes nothing.
- small sp-sv-customer-name (change): failed, No model found a change that applies. mistral-small-latest answered 429: {"object":"error","message":"Rate limit exceeded","type":"rate_limited","param":null,"code":"1300","raw_status_code":429}
- small sp-fi-slider (change): question, question
- small api-assistant-delete-notes (change): failed, No model found a change that applies. mistral-small-latest answered 429: {"object":"error","message":"Rate limit exceeded","type":"rate_limited","param":null,"code":"1300","raw_status_code":429}
- small api-sv-projects-page (change): failed, No model found a change that applies. mistral-small-latest answered 429: {"object":"error","message":"Rate limit exceeded","type":"rate_limited","param":null,"code":"1300","raw_status_code":429}
- small tt-crm-phone-email (two-things): failed, No model found a change that applies. mistral-small-latest answered 429: {"object":"error","message":"Rate limit exceeded","type":"rate_limited","param":null,"code":"1300","raw_status_code":429}
- small tt-bk-phone-message (two-things): change, changeField for addField,changeField
- small tt-bb-email-phone (two-things): failed, No model found a change that applies. mistral-small-latest answered 429: {"object":"error","message":"Rate limit exceeded","type":"rate_limited","param":null,"code":"1300","raw_status_code":429}
- small tt-ki-cal-cards (two-things): failed, No model found a change that applies. mistral-small-latest answered 429: {"object":"error","message":"Rate limit exceeded","type":"rate_limited","param":null,"code":"1300","raw_status_code":429}
- small tt-rec-name-theme (two-things): change, addTheme,setApp for setApp,setTheme
- small tt-st-sev-comp (two-things): failed, No model found a change that applies. mistral-small-latest answered 429: {"object":"error","message":"Rate limit exceeded","type":"rate_limited","param":null,"code":"1300","raw_status_code":429}
- small tt-sp-cat-search (two-things): failed, No model found a change that applies. mistral-small-latest answered 429: {"object":"error","message":"Rate limit exceeded","type":"rate_limited","param":null,"code":"1300","raw_status_code":429}
- small tt-api-prio-page (two-things): failed, No model found a change that applies. mistral-small-latest answered 429: {"object":"error","message":"Rate limit exceeded","type":"rate_limited","param":null,"code":"1300","raw_status_code":429}
- small tt-crm-sv (two-things): failed, No model found a change that applies. mistral-small-latest answered 429: {"object":"error","message":"Rate limit exceeded","type":"rate_limited","param":null,"code":"1300","raw_status_code":429}
- small tt-bk-sv (two-things): change, setLanguage for setLanguage,setSort
- small tt-inv-contract-address (two-things): failed, No model found a change that applies. mistral-small-latest answered 429: {"object":"error","message":"Rate limit exceeded","type":"rate_limited","param":null,"code":"1300","raw_status_code":429}
- small tt-st-mail-uptime (two-things): failed, No model found a change that applies. mistral-small-latest answered 429: {"object":"error","message":"Rate limit exceeded","type":"rate_limited","param":null,"code":"1300","raw_status_code":429}
- small q-bk-and-members (spec-question): answer, The answer does not state that bookings can only be deleted until the class starts (missing from 'must'), and it correctly avoids stating that members can delete other people's bookings (no 'mustNot' violation).
- small q-bk-see-others (spec-question): failed, No model found a change that applies. mistral-small-latest answered 429: {"object":"error","message":"Rate limit exceeded","type":"rate_limited","param":null,"code":"1300","raw_status_code":429}
- small q-bk-session-fields (spec-question): answer, The answer does not mention any of the required fields: 'class type', 'instructor', 'starts at', 'capacity', or 'places left'.
- small q-bk-mail-book (spec-question): failed, No model found a change that applies. mistral-small-latest answered 429: {"object":"error","message":"Rate limit exceeded","type":"rate_limited","param":null,"code":"1300","raw_status_code":429}
- small q-bk-sv-drafts (spec-question): answer, Svaren säger 'Ja' och att utkast visas, men 'must' kräver att svaret säger 'nej' och att endast publicerade inlägg visas.
- small q-crm-shared (spec-question): failed, No model found a change that applies. mistral-small-latest answered 429: {"object":"error","message":"Rate limit exceeded","type":"rate_limited","param":null,"code":"1300","raw_status_code":429}
- small q-crm-shared-private (change): answer, answer
- small q-crm-shipping (spec-question): failed, No model found a change that applies. mistral-small-latest answered 429: {"object":"error","message":"Rate limit exceeded","type":"rate_limited","param":null,"code":"1300","raw_status_code":429}
- small q-crm-signup (spec-question): answer, The answer does not state that only invited colleagues can register, nor does it mention that the email addresses must be from the 'acme.example' domain.
- small q-crm-fi-delete (spec-question): answer, The answer does not state that only the account owner (omat asiakkaansa) and administrators (ylläpitäjät) can delete customers. It incorrectly implies that any logged-in user with write permissions can delete customers.
- small q-bb-cancel (spec-question): answer, The answer does not state that the customer can cancel the appointment at least 12 hours in advance, which is a required fact.
- small q-bb-hours (spec-question): failed, No model found a change that applies. mistral-small-latest answered 429: {"object":"error","message":"Rate limit exceeded","type":"rate_limited","param":null,"code":"1300","raw_status_code":429}
- small q-bb-sv-delete-services (spec-question): question, question
- small q-inv-overdue (spec-question): failed, No model found a change that applies. mistral-small-latest answered 429: {"object":"error","message":"Rate limit exceeded","type":"rate_limited","param":null,"code":"1300","raw_status_code":429}
- small q-inv-overview (spec-question): failed, No model found a change that applies. mistral-small-latest answered 429: {"object":"error","message":"Rate limit exceeded","type":"rate_limited","param":null,"code":"1300","raw_status_code":429}
- small q-ki-order-notify (spec-question): failed, No model found a change that applies. mistral-small-latest answered 429: {"object":"error","message":"Rate limit exceeded","type":"rate_limited","param":null,"code":"1300","raw_status_code":429}
- small q-ki-sv-others (spec-question): answer, The answer does not state the fact 'besökare kan bara skicka beställningar' from the 'must' list.
- small q-ki-decline (spec-question): failed, No model found a change that applies. mistral-small-latest answered 429: {"object":"error","message":"Rate limit exceeded","type":"rate_limited","param":null,"code":"1300","raw_status_code":429}
- small q-mp-seller (spec-question): failed, No model found a change that applies. mistral-small-latest answered 429: {"object":"error","message":"Rate limit exceeded","type":"rate_limited","param":null,"code":"1300","raw_status_code":429}
- small q-mp-hidden (spec-question): answer, The answer does not mention that photos wait for approval or that an administrator approves them, which are required facts.
- small q-rec-who-adds (spec-question): answer, The answer states that any signed-in user can add items, which contradicts the requirement that only administrators can add items.
- small q-st-public-incidents (spec-question): failed, No model found a change that applies. mistral-small-latest answered 429: {"object":"error","message":"Rate limit exceeded","type":"rate_limited","param":null,"code":"1300","raw_status_code":429}
- small q-st-api (spec-question): answer, The answer does not mention 'components and incidents' or 'AI assistants too' as required by the 'must' list.
- small q-st-fi-resolve (spec-question): failed, No model found a change that applies. mistral-small-latest answered 429: {"object":"error","message":"Rate limit exceeded","type":"rate_limited","param":null,"code":"1300","raw_status_code":429}
- small q-st-slack (spec-question): answer, The answer does not state that an incoming call creates an incident with status 'investigating'.
- small q-sp-mail-in (spec-question): answer, The answer does not mention that a mail is sent to the customer to confirm receipt of their submission.
- small q-sp-close (spec-question): failed, No model found a change that applies. mistral-small-latest answered 429: {"object":"error","message":"Rate limit exceeded","type":"rate_limited","param":null,"code":"1300","raw_status_code":429}
- small q-sp-email-locked (spec-question): answer, The answer states that the customer's email can be changed later, which contradicts the 'must' fact that it is 'no' and 'fixed once the case exists'.
- small q-sp-sv-assignee (spec-question): answer, The answer states that an assignee is required when the status is 'open' or 'inProgress', but the 'must' condition requires it to be stated that an assignee is required when the issue is ongoing or closed ('när det pågår eller är stängt'). The answer does not cover the 'closed' status.
- small q-api-let-it (change): answer, answer
- small q-api-roles (spec-question): failed, No model found a change that applies. mistral-small-latest answered 429: {"object":"error","message":"Rate limit exceeded","type":"rate_limited","param":null,"code":"1300","raw_status_code":429}
- small d-publish (docs-question): answer, The answer does not mention 'Publish and share', 'Publish live', or 'a sandbox needs an invite to publish' as required by the 'must' conditions.
- small d-domain (docs-question): failed, No model found a change that applies. mistral-small-latest answered 429: {"object":"error","message":"Rate limit exceeded","type":"rate_limited","param":null,"code":"1300","raw_status_code":429}
- small d-mcp (docs-question): answer, The answer does not explicitly state that MCP stands for 'Model Context Protocol' or mention the key '/mcp' or 'the same key'.
- small d-api-key (docs-question): answer, The answer does not mention that an administrator must create the API key on the users page (Team) and that it is shown only once.
- small d-ask (docs-question): answer, The answer does not explicitly state that Ask answers questions about the records (it says 'app’s data' instead) and does not mention that it reads only what the person may read.
- small d-cost (docs-question): answer, The answer does not mention that 'pricing and plans are not set' or that 'the beta is free'.
- small d-export (docs-question): answer, The answer does not state that the app allows exporting everything as a .zip file, nor does it mention exporting code, history, data, uploads, or CSV on a list page. It only mentions the lack of a built-in export feature and a possible custom implementation.
- small d-where-data (docs-question): answer, The answer does not mention that the data is stored in Sweden or that backups are in the same region.
- small d-selfhost (docs-question): answer, The answer states that Smithable apps cannot be self-hosted, which contradicts the required fact 'yes'. Additionally, it does not mention 'Docker' or 'smithable deploy'.
- small d-need-ai (docs-question): failed, No model found a change that applies. mistral-small-latest answered 429: {"object":"error","message":"Rate limit exceeded","type":"rate_limited","param":null,"code":"1300","raw_status_code":429}
- small d-sandbox (docs-question): answer, The answer does not state that the sandbox lasts for 'two hours' (a required fact under 'must'). It only mentions a general timeframe of 'a few hours to a few days'.
- small d-import (docs-question): failed, No model found a change that applies. mistral-small-latest answered 429: {"object":"error","message":"Rate limit exceeded","type":"rate_limited","param":null,"code":"1300","raw_status_code":429}
- small d-apps (docs-question): answer, The answer states that only one app can be active at a time in a single project, which contradicts the 'must' requirement of having 10 apps, each with a live and staging copy.
- small d-mail-limit (docs-question): failed, No model found a change that applies. mistral-small-latest answered 429: {"object":"error","message":"Rate limit exceeded","type":"rate_limited","param":null,"code":"1300","raw_status_code":429}
- small d-ai-allowance (docs-question): answer, The answer does not mention the required facts: '€2 a month' and 'changes through forms, code and built-in rules still work'.
- small d-slack (docs-question): answer, The answer does not mention that the app can call in or that a slash command makes a record. It also does not mention a Connect button, but it fails to state the required facts.
- small d-depend (docs-question): answer, The answer states that the app is built with and depends on Smithable, which contradicts the required fact that the app does not depend on Smithable ("no" and "smithable detach").
- small d-fi-finnish (docs-question): change, change
- small d-sv-publish (docs-question): failed, No model found a change that applies. mistral-small-latest answered 429: {"object":"error","message":"Rate limit exceeded","type":"rate_limited","param":null,"code":"1300","raw_status_code":429}
- small d-sv-data (docs-question): answer, Svaren nämner inte att datan lagras i Sverige eller att säkerhetskopiorna finns i samma region.
- small d-fi-cost (docs-question): answer, The answer states that the application is free to use and does not charge for its services, which aligns with 'beta on ilmainen' but does not mention that pricing has not been decided ('hinnoittelua ei ole päätetty'). Additionally, it does not violate 'mustNot' by mentioning a monthly fee.
- small d-google (docs-question): change, change
- small d-staging (docs-question): answer, The answer does not mention that staging is 'a separate copy with its own data'.
- small d-handover (docs-question): failed, No model found a change that applies. mistral-small-latest answered 429: {"object":"error","message":"Rate limit exceeded","type":"rate_limited","param":null,"code":"1300","raw_status_code":429}
- small d-lovable (docs-question): answer, The answer does not mention that the app keeps a spec and generates the code, nor does it state that changes are operations that can be undone.
- small d-storage (docs-question): failed, No model found a change that applies. mistral-small-latest answered 429: {"object":"error","message":"Rate limit exceeded","type":"rate_limited","param":null,"code":"1300","raw_status_code":429}
- small d-sv-mcp (docs-question): answer, Svaren nämner inte 'en nyckel från Team-sidan' eller '/mcp', som krävs enligt 'must'.
- small da-crm-acme (data): failed, No model found a change that applies. mistral-small-latest answered 429: {"object":"error","message":"Rate limit exceeded","type":"rate_limited","param":null,"code":"1300","raw_status_code":429}
- small da-crm-delete-week (data): failed, No model found a change that applies. mistral-small-latest answered 429: {"object":"error","message":"Rate limit exceeded","type":"rate_limited","param":null,"code":"1300","raw_status_code":429}
- small da-crm-import (data): failed, No model found a change that applies. mistral-small-latest answered 429: {"object":"error","message":"Rate limit exceeded","type":"rate_limited","param":null,"code":"1300","raw_status_code":429}
- small da-crm-fi (data): failed, No model found a change that applies. mistral-small-latest answered 429: {"object":"error","message":"Rate limit exceeded","type":"rate_limited","param":null,"code":"1300","raw_status_code":429}
- small da-bk-book-me (data): failed, No model found a change that applies. mistral-small-latest answered 429: {"object":"error","message":"Rate limit exceeded","type":"rate_limited","param":null,"code":"1300","raw_status_code":429}
- small da-bk-hatha (data): failed, No model found a change that applies. mistral-small-latest answered 429: {"object":"error","message":"Rate limit exceeded","type":"rate_limited","param":null,"code":"1300","raw_status_code":429}
- small da-bb-timeoff (data): failed, No model found a change that applies. mistral-small-latest answered 429: {"object":"error","message":"Rate limit exceeded","type":"rate_limited","param":null,"code":"1300","raw_status_code":429}
- small da-inv-create (data): failed, No model found a change that applies. mistral-small-latest answered 429: {"object":"error","message":"Rate limit exceeded","type":"rate_limited","param":null,"code":"1300","raw_status_code":429}
- small da-inv-paid (data): change, change
- small da-ki-soldout (data): failed, No model found a change that applies. mistral-small-latest answered 429: {"object":"error","message":"Rate limit exceeded","type":"rate_limited","param":null,"code":"1300","raw_status_code":429}
- small da-ki-dish (data): failed, No model found a change that applies. mistral-small-latest answered 429: {"object":"error","message":"Rate limit exceeded","type":"rate_limited","param":null,"code":"1300","raw_status_code":429}
- small da-mp-remove (data): failed, No model found a change that applies. mistral-small-latest answered 429: {"object":"error","message":"Rate limit exceeded","type":"rate_limited","param":null,"code":"1300","raw_status_code":429}
- small da-rec-watch (data): change, change
- small da-st-open (data): failed, No model found a change that applies. mistral-small-latest answered 429: {"object":"error","message":"Rate limit exceeded","type":"rate_limited","param":null,"code":"1300","raw_status_code":429}
- small da-st-resolve (data): failed, No model found a change that applies. mistral-small-latest answered 429: {"object":"error","message":"Rate limit exceeded","type":"rate_limited","param":null,"code":"1300","raw_status_code":429}
- small da-sp-assign (data): change, change
- small da-sp-sv-close (data): failed, No model found a change that applies. mistral-small-latest answered 429: {"object":"error","message":"Rate limit exceeded","type":"rate_limited","param":null,"code":"1300","raw_status_code":429}
- small da-api-task (data): failed, No model found a change that applies. mistral-small-latest answered 429: {"object":"error","message":"Rate limit exceeded","type":"rate_limited","param":null,"code":"1300","raw_status_code":429}
- small cc-ki-postal (custom-code): failed, No model found a change that applies. mistral-small-latest answered 429: {"object":"error","message":"Rate limit exceeded","type":"rate_limited","param":null,"code":"1300","raw_status_code":429}
- small cc-crm-register (custom-code): question, question
- small cc-bk-gcal (custom-code): failed, No model found a change that applies. mistral-small-latest answered 429: {"object":"error","message":"Rate limit exceeded","type":"rate_limited","param":null,"code":"1300","raw_status_code":429}
- small cc-crm-churn (custom-code): change, change
- small cc-st-ping (custom-code): failed, No model found a change that applies. mistral-small-latest answered 429: {"object":"error","message":"Rate limit exceeded","type":"rate_limited","param":null,"code":"1300","raw_status_code":429}
- small cc-sp-ai-reply (custom-code): failed, No model found a change that applies. mistral-small-latest answered 429: {"object":"error","message":"Rate limit exceeded","type":"rate_limited","param":null,"code":"1300","raw_status_code":429}
- small cc-bb-map (custom-code): failed, No model found a change that applies. mistral-small-latest answered 429: {"object":"error","message":"Rate limit exceeded","type":"rate_limited","param":null,"code":"1300","raw_status_code":429}
- small cc-fi-weather (custom-code): failed, No model found a change that applies. mistral-small-latest answered 429: {"object":"error","message":"Rate limit exceeded","type":"rate_limited","param":null,"code":"1300","raw_status_code":429}
- small a-crm-status (ambiguous): failed, No model found a change that applies. mistral-small-latest answered 429: {"object":"error","message":"Rate limit exceeded","type":"rate_limited","param":null,"code":"1300","raw_status_code":429}
- small a-bb-phone (ambiguous): failed, No model found a change that applies. mistral-small-latest answered 429: {"object":"error","message":"Rate limit exceeded","type":"rate_limited","param":null,"code":"1300","raw_status_code":429}
- small a-inv-logo (ambiguous): change, change
- small a-mp-sold (ambiguous): failed, No model found a change that applies. mistral-small-latest answered 429: {"object":"error","message":"Rate limit exceeded","type":"rate_limited","param":null,"code":"1300","raw_status_code":429}
- small a-crm-lost (ambiguous): change, change
- small a-sp-priority (ambiguous): failed, No model found a change that applies. mistral-small-latest answered 429: {"object":"error","message":"Rate limit exceeded","type":"rate_limited","param":null,"code":"1300","raw_status_code":429}
- small a-rec-home (ambiguous): failed, No model found a change that applies. mistral-small-latest answered 429: {"object":"error","message":"Rate limit exceeded","type":"rate_limited","param":null,"code":"1300","raw_status_code":429}
- small a-ki-drinks (ambiguous): failed, No model found a change that applies. mistral-small-latest answered 429: {"object":"error","message":"Rate limit exceeded","type":"rate_limited","param":null,"code":"1300","raw_status_code":429}
- small a-bb-prices (ambiguous): change, change
- small a-st-notify (ambiguous): failed, No model found a change that applies. mistral-small-latest answered 429: {"object":"error","message":"Rate limit exceeded","type":"rate_limited","param":null,"code":"1300","raw_status_code":429}
- small a-api-private (ambiguous): change, change
- small a-sp-tags (ambiguous): failed, No model found a change that applies. mistral-small-latest answered 429: {"object":"error","message":"Rate limit exceeded","type":"rate_limited","param":null,"code":"1300","raw_status_code":429}
- small a-mp-sv-cat (ambiguous): failed, No model found a change that applies. mistral-small-latest answered 429: {"object":"error","message":"Rate limit exceeded","type":"rate_limited","param":null,"code":"1300","raw_status_code":429}
- small a-rec-darker (ambiguous): failed, No model found a change that applies. addTheme: The theme is refused:
  themes/cafe.yml:14:1  error  Unknown key "mode" in the theme.
    hint: Did you mean "modes"?
  themes/cafe.yml:8:3  error  Unknown color "neutral" in "light".
  themes/cafe.yml:9:3  error  Unknown color "positive" in "light".
  themes/cafe.yml:10:3  error  Unknown color "attention" in "light".
  themes/cafe.yml:11:3  error  Unknown color "negative" in "light".
  themes/cafe.yml:13:3  error  Unknown color "textMuted" in "light".
  themes/cafe.yml:1:1  error  A theme needs "dark" colors: at least background, foreground and primary.
- small o-capital (off-topic): failed, No model found a change that applies. mistral-small-latest answered 429: {"object":"error","message":"Rate limit exceeded","type":"rate_limited","param":null,"code":"1300","raw_status_code":429}
- small o-fi-recipe (off-topic): failed, No model found a change that applies. mistral-small-latest answered 429: {"object":"error","message":"Rate limit exceeded","type":"rate_limited","param":null,"code":"1300","raw_status_code":429}
- small o-python (off-topic): failed, No model found a change that applies. mistral-small-latest answered 429: {"object":"error","message":"Rate limit exceeded","type":"rate_limited","param":null,"code":"1300","raw_status_code":429}
- small o-essay (off-topic): failed, No model found a change that applies. mistral-small-latest answered 429: {"object":"error","message":"Rate limit exceeded","type":"rate_limited","param":null,"code":"1300","raw_status_code":429}
- small s-thnks (smalltalk): failed, No model found a change that applies. mistral-small-latest answered 429: {"object":"error","message":"Rate limit exceeded","type":"rate_limited","param":null,"code":"1300","raw_status_code":429}
- small s-thank-you-much (smalltalk): failed, No model found a change that applies. mistral-small-latest answered 429: {"object":"error","message":"Rate limit exceeded","type":"rate_limited","param":null,"code":"1300","raw_status_code":429}
- small long-bk-change (change): failed, No model found a change that applies. mistral-small-latest answered 429: {"object":"error","message":"Rate limit exceeded","type":"rate_limited","param":null,"code":"1300","raw_status_code":429}
- small long-kiosk-cc (custom-code): failed, No model found a change that applies. mistral-small-latest answered 429: {"object":"error","message":"Rate limit exceeded","type":"rate_limited","param":null,"code":"1300","raw_status_code":429}
- small long-inv-spec (spec-question): answer, The answer correctly states that the app won't mark the invoice overdue or email the client by itself, and that the user must manually mark the invoice as paid. However, it fails to mention that a sent invoice is marked overdue 7 days after its due date (a required fact under 'must'). Additionally, it does not explicitly confirm that the app mails the client only when an invoice is marked sent (another required fact under 'must').
- small long-sv-change (two-things): change, addField,setText for addField
- small long-status-change (change): failed, No model found a change that applies. mistral-small-latest answered 429: {"object":"error","message":"Rate limit exceeded","type":"rate_limited","param":null,"code":"1300","raw_status_code":429}
- small long-mp-docs (docs-question): failed, No model found a change that applies. mistral-small-latest answered 429: {"object":"error","message":"Rate limit exceeded","type":"rate_limited","param":null,"code":"1300","raw_status_code":429}
- small long-api-spec (spec-question): answer, The answer states that Claude Code cannot delete notes or any other records, which aligns with the 'must' fact 'it cannot delete'. However, it does not explicitly state that it can add and change tasks and notes (only that it adds tasks), nor does it confirm that it reads everything. These are required by the 'must' list.
- small>better bk-capacity-default (change): change, setCapacity for changeField
- small>better bk-hide-about (change): change, setNavigation for setPublic
- small>better bk-schedule-agenda (change): none, none: This changes nothing.
- small>better bk-schedule-color-level (change): question, question
- small>better bk-reminder-2h (change): none, none: Sending reminders automatically requires custom code. The nearest thing that can be done with operations is to add a timer that runs 2 hours before Session.startsAt, but it would need custom code to send the message. Add a timer with `addTimer remind on Session at "2 hours before startsAt" run remindMembers` and write the code in src/custom/timers/remind.ts.
- small>better bk-cancel-2h (change): failed, No model found a change that applies. setCapacity: Say "max": a whole number, or a field like session.capacity.
- small>better bk-sv-ask-members (change): none, none: This changes nothing.
- small>better crm-followups-rename-page (change): change, renamePage,setNavigation for renamePage
- small>better crm-tones (change): none, none: This changes nothing.
- small>better crm-sv-segment-required (change): none, none: This changes nothing.
- small>better crm-mail-manager (change): failed, No model found a change that applies. addOutgoing: addOutgoing would make smithable.yml invalid. There is no role named "accountManager".
- small>better crm-fi-followup-sort (change): question, question
- small>better bb-cancel-24h (change): question, question
- small>better bb-sms-confirm (change): change, addField,setAction for setOutgoingTo
- small>better inv-notes-required (change): change, addField for changeField
- small>better inv-totals (change): none, none: This changes nothing.
- small>better inv-sort-newest (change): none, none: This changes nothing.
- small>better inv-overdue-mail (change): change, addAction,addTimer for addOutgoing
- small>better ki-calories-rename (change): change, addField,setText for renameField
- small>better ki-email-required (change): change, setFieldRules for changeField
- small>better ki-sunday-hours (change): question, question
- small>better ki-dishes-cards (change): question, question
- small>better ki-sms-ready (change): change, setOutgoingBody,setOutgoingTo for setOutgoingTo
- small>better ki-sv-kids (change): question, question
- small>better ki-fi-allergens-required (change): change, addField for changeField
- small>better rec-kind-wishlist (change): change, addField,setFieldRules for changeField
- small>better rec-cafe (change): failed, No model found a change that applies. addTheme: addTheme: "text" is missing.
- small>better rec-brand-green (change): failed, No model found a change that applies. setTheme: setTheme: Unknown argument "chrome".
- small>better rec-sv-compact (change): question, question
- small>better st-component-required (change): change, setFieldRules for changeField
- small>better st-hide-maintenance (change): failed, No model found a change that applies. setPublicWhere: setPublicWhere would make smithable.auth.yml invalid. Nobody receives mail at ops@northwind.example, so nobody can sign in as this administrator. "where" of Maintenance: "component.status" must be a choice field of Maintenance with one of its values (or a list of them), or a yes/no field with true or false.
- small>better st-remove-uptime (change): question, question
- small>better st-sv-icon (change): none, none: This changes nothing.
- small>better sp-priority-2 (change): answer, answer
- small>better sp-autoclose (change): failed, No model found a change that applies. setRuleId: There is no concept "timer:closeInProgressCases". Use e.g. "action:mergeCustomers".
- small>better sp-newest (change): none, none: This changes nothing.
- small>better sp-thread (change): question, question
- small>better sp-fi-slider (change): question, question
- small>better api-assistant-delete-notes (change): change, setApi for grant
- small>better tt-bk-phone-message (two-things): change, changeField for addField,changeField
- small>better tt-rec-name-theme (two-things): failed, No model found a change that applies. addTheme: There is already a theme "cafe", built in: choose another name.
- small>better tt-st-sev-comp (two-things): change, addField for addField,changeField
- small>better tt-sp-cat-search (two-things): change, addField,changeField,setFilters for addField,setSearch
- small>better tt-crm-sv (two-things): change, changeField for addField,changeField
- small>better q-bk-and-members (spec-question): answer, The answer does not state that bookings can only be deleted until the class starts (missing from 'must'), and it does not explicitly deny that members can delete other people's bookings (though it implies it, it doesn't state it clearly enough to satisfy 'mustNot').
- small>better q-bk-session-fields (spec-question): answer, The answer does not mention the required fields 'class type', 'instructor', 'starts at', 'capacity', or 'places left'.
- small>better q-bk-mail-book (spec-question): answer, The answer states that members do not get an email when they book, which contradicts the required fact that they should receive a mail when the booking is made and a reminder the day before.
- small>better q-bk-sv-drafts (spec-question): answer, Svaren säger 'Ja' och att utkast visas, men 'must' kräver att svaret säger 'nej' och att endast publicerade inlägg visas.
- small>better q-crm-shared (spec-question): answer, The answer does not state that 'everyone who signs in' can see shared customers, which is required by the 'must' list.
- small>better q-crm-shared-private (change): answer, answer
- small>better q-crm-signup (spec-question): answer, The answer states that anyone with a valid email from allowed domains (or all if none are set) can register, and admins can always log in. However, it does not explicitly state that only invited colleagues can register or that the allowed email addresses must be from 'acme.example'.
- small>better q-bb-cancel (spec-question): question, question
- small>better q-bb-hours (spec-question): answer, The answer does not mention any of the required opening hours (Monday to Friday 09:00-17:00, Saturday 10:00-14:00, or the break 12:00-12:30).
- small>better q-bb-sv-delete-services (spec-question): question, question
- small>better q-inv-overdue (spec-question): answer, The answer states the invoice becomes overdue the day after its due date (30 days after issuance), but the 'must' facts require it to become overdue 7 days after the due date and only if it is still sent. The answer does not match these conditions.
- small>better q-inv-private (spec-question): answer, The answer states that other users can see clients by default unless set to private, which contradicts the 'must' requirement that the answer should state 'no' and 'each user sees only their own'.
- small>better q-inv-overview (spec-question): answer, The answer does not mention 'invoiced by month' or 'latest invoices' as required by the 'must' list.
- small>better q-ki-order-notify (spec-question): answer, The answer does not mention that staff, mail and push notifications, and the kitchen are told when an order comes in.
- small>better q-ki-sv-others (spec-question): answer, The answer correctly states 'Nej' (which matches 'nej' in must), but it does not mention that 'besökare kan bara skicka beställningar' (visitors can only send orders). This fact is required by 'must' but is missing in the answer.
- small>better q-mp-hidden (spec-question): answer, The answer does not mention that photos wait for approval or that an administrator approves them, which are required facts.
- small>better q-rec-who-adds (spec-question): answer, The answer states that any signed-in user can add items, which contradicts the requirement that only administrators can add items.
- small>better q-st-public-incidents (spec-question): answer, The answer states that the public can see no incidents, which contradicts the 'must' requirement that all incidents (investigating, identified, monitoring, and resolved) should be visible to the public.
- small>better q-st-api (spec-question): answer, The answer does not mention 'components and incidents' as part of what the API offers, which is required by the 'must' list.
- small>better q-st-slack (spec-question): change, change
- small>better q-sp-mail-in (spec-question): answer, The answer does not mention that a mail is sent to the customer to confirm receipt of their submission.
- small>better q-sp-close (spec-question): answer, The answer does not explicitly mention 'agents' as a group that can close cases, only 'admins and staff with write access' and 'the record’s owner'. The 'must' list requires 'agents' to be included.
- small>better q-sp-email-locked (spec-question): answer, The answer states that the customer email can be changed, but the 'must' facts require that the answer states it cannot be changed and is fixed once the case exists.
- small>better q-sp-sv-assignee (spec-question): answer, Svaren nämner inte att ett ärende måste ha en ansvarig när det pågår eller är stängt, vilket är en obligatorisk fakta enligt 'must'.
- small>better q-api-let-it (change): answer, answer
- small>better q-api-roles (spec-question): answer, The answer does not mention the 'member' and 'assistant' roles, which are required by the 'must' list.
- small>better d-publish (docs-question): answer, The answer does not mention any of the required facts: 'Publish and share', 'Publish live', or 'a sandbox needs an invite to publish'.
- small>better d-domain (docs-question): answer, The answer does not mention the requirement of setting up 'an A record and a TXT record' once the app is live, and it also does not explicitly state that these records are needed. Additionally, it does not violate the 'mustNot' condition.
- small>better d-mcp (docs-question): answer, The answer does not mention the required facts: 'Model Context Protocol', 'tools for AI assistants', '/mcp', or 'the same key'.
- small>better d-api-key (docs-question): answer, The answer does not mention any of the required facts: that an API key is created by an administrator, on the users page (Team), and is shown only once.
- small>better d-ask (docs-question): answer, The answer does not explicitly state that Ask 'reads only what the person may read'.
- small>better d-cost (docs-question): answer, The answer correctly states that pricing and plans are not set in the app's spec, but it fails to mention that the beta is free, which is a required fact under 'must'.
- small>better d-export (docs-question): answer, The answer does not state that the app allows exporting everything as a .zip file (including code, history, data, and uploads) or exporting CSV on a list page. It only mentions the possibility of adding a custom CSV export feature.
- small>better d-where-data (docs-question): answer, The answer does not mention that the data is stored in Sweden or that backups are kept in the same region.
- small>better d-selfhost (docs-question): answer, The answer states 'No' and does not mention any of the required facts: 'yes', 'Docker', or 'smithable deploy'.
- small>better d-sandbox (docs-question): answer, The answer states the sandbox lasts for 30 days, but the required fact is that it lasts for two hours.
- small>better d-import (docs-question): answer, The answer does not mention 'Import on the list page' as a required step, and it does not explicitly state that the Excel file must be saved as a CSV (it implies it but does not explicitly say 'save as CSV'). Additionally, it does not violate any mustNot conditions.
- small>better d-apps (docs-question): answer, The answer states that only one app can be active at a time, which contradicts the 'must' requirement of having 10 apps, each with a live and staging copy.
- small>better d-mail-limit (docs-question): answer, The answer does not mention the required facts: '100 recipients a day per app' and '1,000 recipients a month per account'.
- small>better d-ai-allowance (docs-question): answer, The answer does not mention the required facts: '€2 a month' and 'changes through forms, code and built-in rules still work'.
- small>better d-slack (docs-question): none, none
- small>better d-depend (docs-question): answer, The answer states that the app is built with and depends on Smithable, which contradicts the required fact that the app does not depend on Smithable ("no" and "smithable detach").
- small>better d-fi-finnish (docs-question): change, change
- small>better d-sv-data (docs-question): answer, Svaren nämner inte att datan lagras i Sverige eller att säkerhetskopiorna finns i samma region.
- small>better d-fi-cost (docs-question): answer, The answer does not state that pricing has not been decided ('hinnoittelua ei ole päätetty') or that the beta is free ('beta on ilmainen'). It also does not violate the 'mustNot' condition.
- small>better d-google (docs-question): change, change
- small>better d-handover (docs-question): answer, The answer does not mention the requirement to provide a transfer link valid for seven days or to download everything, which are both mandatory facts.
- small>better d-lovable (docs-question): answer, The answer does not mention that the app keeps a spec and generates the code, nor does it state that changes are operations that can be undone.
- small>better d-storage (docs-question): answer, The answer does not mention the '2 GB per app' limit or explicitly state that 'uploaded files are included' in the storage.
- small>better d-sv-mcp (docs-question): answer, Svaren saknar omnämnande av 'en nyckel från Team-sidan' och '/mcp'.
- small>better da-crm-fi (data): change, change
- small>better da-inv-paid (data): change, change
- small>better da-ki-fi-stop (data): change, change
- small>better da-mp-remove (data): change, change
- small>better da-st-open (data): failed, No model found a change that applies. addAction: addAction would make smithable.yml invalid. Incident in "add" of action "openPaymentsIncident": component is filled with the record the action runs on; leave it out.
- small>better da-sp-assign (data): change, change
- small>better cc-crm-register (custom-code): question, question
- small>better cc-crm-churn (custom-code): change, change
- small>better cc-sp-ai-reply (custom-code): change, change
- small>better cc-bb-map (custom-code): change, change
- small>better cc-fi-weather (custom-code): answer, answer
- small>better a-simpler (ambiguous): change, change
- small>better a-ki-darker (ambiguous): change, change
- small>better a-bb-phone (ambiguous): answer, answer
- small>better a-inv-logo (ambiguous): change, change
- small>better a-mp-sold (ambiguous): change, change
- small>better a-crm-lost (ambiguous): change, change
- small>better a-bb-prices (ambiguous): change, change
- small>better a-api-private (ambiguous): change, change
- small>better a-mp-sv-cat (ambiguous): answer, answer
- small>better o-fi-recipe (off-topic): question, question
- small>better o-python (off-topic): none, none
- small>better long-inv-spec (spec-question): answer, The answer does not state that a sent invoice is marked overdue 7 days after its due date, nor does it confirm that the app mails the client only when an invoice is marked sent. It also does not explicitly mention that the app does not mail the client when the invoice goes overdue (a mustNot fact).
- small>better long-status-change (change): change, addOutgoing for addOutgoing,setOutgoingBody
- small>better long-mp-docs (docs-question): answer, The answer does not state that the data is hosted in Sweden, that backups are in the same region, or that a .zip download or transfer link is available. It only mentions self-hosted PostgreSQL, CSV export, and direct database access.
- small>better long-api-spec (spec-question): answer, The answer states that Claude Code cannot delete anything (satisfies 'it cannot delete'), but it does not state that it adds and changes tasks and notes (it only mentions adding and updating tasks, not notes). Additionally, it does not state that it reads everything.
