# What people say to Smith: 2026-11-13-small

2026-11-13, 306 requests of docs/benchmarks/smith-requests.json (undo and feedback are Studio's rules, not here). Judge: mistral-medium-latest.

| Setup | Kind | Right | Of | By rule | Tokens | Cost | Seconds |
|---|---|---|---|---|---|---|---|
| small | ambiguous | 14 | 25 | 0 | 748452 | 0.1143 | 384.3 |
| small | change | 58 | 104 | 14 | 3448850 | 0.5222 | 1606.2 |
| small | custom-code | 6 | 13 | 0 | 247188 | 0.0376 | 218.9 |
| small | data | 11 | 23 | 0 | 1076910 | 0.1659 | 636.5 |
| small | docs-question | 2 | 28 | 0 | 541775 | 0.0968 | 316.4 |
| small | off-topic | 8 | 10 | 0 | 157558 | 0.0240 | 101.6 |
| small | smalltalk | 17 | 17 | 13 | 61768 | 0.0094 | 42.3 |
| small | spec-question | 12 | 38 | 2 | 743269 | 0.1331 | 514.9 |
| small | two-things | 11 | 17 | 0 | 599221 | 0.0913 | 339.2 |

Wrong ones:

- small bk-bio-required (change): change, changeField,setFieldRules for changeField
- small bk-capacity-default (change): change, setCapacity for changeField
- small bk-hide-about (change): change, setNavigation for setPublic
- small bk-schedule-agenda (change): none, none: This changes nothing.
- small bk-schedule-color-level (change): question, question
- small bk-reminder-2h (change): change, addAction,addField,addTimer for addOutgoing,addTimer
- small bk-sv-ask-members (change): none, none: This changes nothing.
- small crm-status-returned (change): failed, No model found a change that applies. changeField: changeField: Unknown argument "default".
- small crm-tones (change): question, question
- small crm-sv-segment-required (change): failed, No model found a change that applies. changeField: A choice field's default is its first value, so "=" is not used here. Put the default first, or use the long form with "default:".
- small bb-cancel-24h (change): none, none: The app already handles cancellations through a custom action called cancel(), but the 24-hour window is set in code, not in the spec. To change it, you need custom code in src/custom/actions/cancel.ts that reads TimeOff.until and checks the time difference. The operation setAction cannot do this.
- small bb-sms-confirm (change): change, addField,setAction for setOutgoingTo
- small inv-notes-required (change): change, addField for changeField
- small inv-overdue-3 (change): none, none: This changes nothing.
- small inv-tones (change): none, none: This changes nothing.
- small inv-totals (change): answer, answer
- small inv-sort-newest (change): none, none: This changes nothing.
- small inv-overdue-mail (change): none, none: Already done: the app already sends reminders when an invoice becomes overdue. The timer runs the standard action that changes the invoice’s status to overdue, and the outgoing mail to the client is set up by default.
- small ki-calories-rename (change): none, none: No operation can add a field to a model. You can add the field yourself in src/custom/models/Dish.ts and run the app’s migration to add it to the database, or ask me to rename the app instead.
- small ki-diet-glutenfree (change): failed, No model found a change that applies. changeField: A choice field's default is its first value, so "=" is not used here. Put the default first, or use the long form with "default:".
- small ki-email-required (change): failed, No model found a change that applies. changeField: "" says no new value: write it as old=new, e.g. =…, or = to leave the records empty.
- small ki-sunday-hours (change): change, setText for editSpec
- small ki-dishes-cards (change): question, question
- small ki-sms-ready (change): change, setOutgoingBody,setOutgoingTo for setOutgoingTo
- small ki-sv-kids (change): question, question
- small ki-orders-filter-default (change): change, setDefaultFilter,setFilters for setDefaultFilter
- small mp-category-toys (change): failed, No model found a change that applies. changeField: changeField: Unknown argument "default".
- small mp-no-review (change): none, none: Det går inte att ta bort kravet på godkännande för foton i den här appen. Appen har inget sådant godkännandeflöde och inga regler som kräver det. Om du vill att foton ska godkännas innan de visas för andra, kan du lägga till en granskning för modellens bildfält med operationen setReview. Då hamnar nya bilder i en kö för granskning av administratörer eller roller som har rätt att godkänna.
- small rec-kind-wishlist (change): change, addField for changeField
- small rec-cafe (change): failed, No model found a change that applies. addTheme: The theme is refused:
  themes/cafe.yml:10:3  error  Unknown color "danger" in "light".
  themes/cafe.yml:4:3  warning  In light mode, the text on the green badges may be hard to read.
  themes/cafe.yml:18:3  error  Unknown color "danger" in "dark".
  themes/cafe.yml:12:3  warning  In dark mode, the text on the other buttons may be hard to read.
  themes/cafe.yml:12:3  warning  In dark mode, the text on the green badges may be hard to read.
- small rec-brand-green (change): none, none: The app has no setting for a main colour. You can change the theme’s colours in a project theme (themes/<name>.yml) and apply it with addTheme, or change the menu’s surface with setChrome. The built-in themes are light, dark, system and default; to make the menu dark, try setChrome dark.
- small rec-sv-compact (change): change, setView for setTheme
- small st-component-required (change): change, setFieldRules for changeField
- small st-hide-maintenance (change): failed, No model found a change that applies. setPublicWhere: setPublicWhere would make smithable.auth.yml invalid. Nobody receives mail at ops@northwind.example, so nobody can sign in as this administrator. "where" of Maintenance: "status" must be a choice field of Maintenance with one of its values (or a list of them), or a yes/no field with true or false.
- small st-remove-uptime (change): failed, No model found a change that applies. setText: setText: "text" is missing.
- small st-sv-icon (change): failed, No model found a change that applies. setIcon: setIcon: "icon" must be one of "users", "user", "file", "receipt", "cart", "package", "calendar", "layers", "book", "briefcase", "building", "chart", "clipboard", "home", "mail", "settings", "star", "tag", "truck", "list", "auto".
- small st-fi-severity (change): failed, No model found a change that applies. setTone: Incident.severity is not a choice field.
- small sp-priority-2 (change): question, question
- small sp-autoclose (change): failed, No model found a change that applies. addTimer: addTimer would make smithable.yml invalid. Timer "closeInProgressCases": SupportCase has no field named "createdAt".
- small sp-newest (change): failed, No model found a change that applies. setSort: setSort would make smithable.ux.yml invalid. SupportCase has no field named "createdAt" to sort by.
- small sp-thread (change): none, none: This changes nothing.
- small api-assistant-delete-notes (change): failed, No model found a change that applies. setAction: There is no action named "deleteNotes".
- small tt-crm-phone-email (two-things): change, changeField for addField,changeField
- small tt-rec-name-theme (two-things): change, addTheme,setApp for setApp,setTheme
- small tt-st-sev-comp (two-things): change, addField for addField,changeField
- small tt-crm-sv (two-things): change, changeField for addField,changeField
- small tt-st-mail-uptime (two-things): failed, No model found a change that applies. setSectionLook: A custom section has no "layout".
- small q-bk-and-members (spec-question): answer, The answer does not state that bookings can only be deleted until the class starts (missing from 'must'), and it does not explicitly deny that members can delete other people's bookings (though it implies it, it doesn't state it clearly enough to satisfy 'mustNot').
- small q-bk-see-others (spec-question): answer, The answer states that members can see who else booked a class, which directly contradicts the required fact that members see only their own bookings.
- small q-bk-session-fields (spec-question): answer, The answer does not mention any of the required fields: 'class type', 'instructor', 'starts at', 'capacity', or 'places left'.
- small q-bk-mail-book (spec-question): change, change
- small q-bk-sv-drafts (spec-question): answer, Svaret säger 'Ja' och att besökare kan läsa utkast, men enligt 'must' ska svaret innehålla 'nej' och att endast publicerade inlägg är synliga. Dessutom saknas information om att utkast inte är tillgängliga.
- small q-crm-shared-private (change): answer, answer
- small q-crm-signup (spec-question): answer, The answer states that anyone with a valid email can register, which contradicts the 'must' fact that only invited colleagues with addresses on acme.example can register.
- small q-crm-fi-delete (spec-question): answer, The answer does not state that only users can delete their own customers or that administrators can delete customers. It incorrectly implies that any logged-in user can delete any customer by default.
- small q-bb-cancel (spec-question): answer, The answer states that the customer can cancel up to 24 hours before the appointment, but the required fact is that the cancellation must be at least 12 hours before. The answer does not meet the 'must' condition.
- small q-bb-hours (spec-question): answer, The answer does not mention any of the required opening hours (Monday to Friday 09:00-17:00, Saturday 10:00-14:00, or the break 12:00-12:30).
- small q-bb-sv-delete-services (spec-question): question, question
- small q-inv-overdue (spec-question): answer, The answer states the invoice becomes overdue the day after its due date (30 days after issuance), but the 'must' facts require it to be 7 days after the due date and only if it is still sent. The answer does not match these conditions.
- small q-inv-private (spec-question): answer, The answer does not explicitly state that other users cannot see your clients (i.e., it does not clearly affirm 'no' and 'each user sees only their own'). It provides conditional information but does not meet the 'must' criteria.
- small q-inv-overview (spec-question): answer, The answer does not mention 'invoiced by month' or 'latest invoices' which are required facts.
- small q-ki-order-notify (spec-question): answer, The answer does not mention that staff, mail and push notifications, and the kitchen are told when an order comes in. It only states that no automatic message is sent unless configured.
- small q-ki-sv-others (spec-question): answer, The answer correctly states 'Nej' (which matches 'nej' in must), but it does not mention that 'besökare kan bara skicka beställningar' (visitors can only send orders). This fact is required by 'must' but is missing in the answer.
- small q-mp-hidden (spec-question): answer, The answer does not mention that photos wait for approval or that an administrator approves them, which are required facts.
- small q-rec-who-adds (spec-question): answer, The answer states that any signed-in user can add items, which contradicts the requirement that only administrators can add items.
- small q-st-api (spec-question): answer, The answer does not mention 'components and incidents' or 'AI assistants too' as required by the 'must' list.
- small q-st-slack (spec-question): change, change
- small q-sp-mail-in (spec-question): answer, The answer does not mention that a mail is sent to the customer to confirm the case was received.
- small q-sp-close (spec-question): answer, The answer does not mention 'agents' as a role that can close cases, which is required by the 'must' list.
- small q-sp-email-locked (spec-question): answer, The answer states that the customer's email can be changed, but the 'must' facts require that the answer states it cannot be changed and is fixed once the case exists.
- small q-sp-sv-assignee (spec-question): answer, Svaren nämner inte att ett ärende måste ha en ansvarig 'när det pågår eller är stängt', vilket är en obligatorisk fakta enligt 'must'.
- small q-api-let-it (change): answer, answer
- small q-api-roles (spec-question): answer, The answer does not mention the 'member' and 'assistant' roles, which are required by the 'must' list.
- small d-publish (docs-question): answer, The answer does not mention 'Publish and share', 'Publish live', or 'a sandbox needs an invite to publish'.
- small d-domain (docs-question): answer, The answer does not mention the requirement of setting up 'an A record and a TXT record' once the app is live, and it also does not include any mention of a price for domains (which is correct for mustNot). However, it fails to cover all 'must' facts.
- small d-mcp (docs-question): answer, The answer does not mention the required facts 'Model Context Protocol', 'tools for AI assistants', '/mcp', or 'the same key'.
- small d-api-key (docs-question): answer, The answer does not mention any of the required facts: that an administrator must create the API key, that it is done on the users page (Team), or that the key is shown only once.
- small d-ask (docs-question): answer, The answer does not explicitly state that Ask can answer 'questions about the records' or that it 'reads only what the person may read'.
- small d-cost (docs-question): answer, The answer does not state that 'pricing and plans are not set' or that 'the beta is free'. It also implies a cost tied to a plan, which could be interpreted as a price per app or monthly price, violating the mustNot conditions.
- small d-export (docs-question): answer, The answer does not state that the app allows exporting everything as a .zip file, nor does it mention exporting code, history, data, and uploads. It also does not confirm the ability to export CSV on a list page.
- small d-where-data (docs-question): answer, The answer does not mention that the data is stored in Sweden or that backups are in the same region.
- small d-selfhost (docs-question): answer, The answer does not state that running on your own server is possible ("yes"), nor does it mention Docker or "smithable deploy" as required by the 'must' conditions.
- small d-sandbox (docs-question): answer, The answer states the sandbox lasts 30 days, but the required fact is that it lasts two hours.
- small d-import (docs-question): failed, No model found a change that applies. importRecords: Give the CSV file with --from, or its text.
- small d-apps (docs-question): answer, The answer does not mention the required facts: that there can be 10 apps, each with a live and a staging copy.
- small d-mail-limit (docs-question): answer, The answer does not mention the specific limits of '100 recipients a day per app' and '1,000 recipients a month per account' as required by the 'must' conditions.
- small d-ai-allowance (docs-question): answer, The answer does not mention the required facts: '€2 a month' and 'changes through forms, code and built-in rules still work'.
- small d-slack (docs-question): answer, The answer does not mention that the app 'calls in' or that 'a slash command makes a record'. It also does not violate the mustNot condition, but it fails to meet the must conditions.
- small d-depend (docs-question): answer, The answer states that the app is built with Smithable and depends on it, which contradicts the required fact that the app does not depend on Smithable ("no" and "smithable detach").
- small d-fi-finnish (docs-question): change, change
- small d-sv-data (docs-question): answer, The answer does not mention any of the required facts: 'Sverige' or 'säkerhetskopior i samma region'.
- small d-fi-cost (docs-question): answer, The answer does not explicitly state that 'hinnoittelua ei ole päätetty' (pricing has not been decided) or that 'beta on ilmainen' (beta is free). It only states that the application is free and does not include pricing, but does not confirm the required facts about the beta phase or the undecided pricing.
- small d-google (docs-question): change, change
- small d-staging (docs-question): answer, The answer does not explicitly state that staging is 'a separate copy with its own data'.
- small d-handover (docs-question): answer, The answer does not mention the requirement to provide a transfer link valid for seven days or the ability to download everything, which are both listed under 'must'.
- small d-lovable (docs-question): answer, The answer does not mention that the app 'keeps a spec and generates the code' or that 'changes are operations that can be undone', which are required facts under 'must'.
- small d-storage (docs-question): answer, The answer does not mention the 2 GB per app limit or that uploaded files are included in this limit.
- small d-sv-mcp (docs-question): answer, Svaren saknar omnämnande av 'en nyckel från Team-sidan' och '/mcp', som krävs enligt 'must'.
- small da-crm-acme (data): change, change
- small da-crm-fi (data): change, change
- small da-bk-hatha (data): failed, No model found a change that applies. addField: Session already has a field named "instructor".
- small da-bb-timeoff (data): failed, No model found a change that applies. setOccupies: setOccupies would make smithable.yml invalid. "occupies" of "TimeOff": "duration" must be a whole-number field of TimeOff, or of a record it refers to ("service.minutes"). "cancelUntil" in "occupies" of "TimeOff" is a whole number and a unit: "30m", "12h" or "2d".
- small da-inv-create (data): failed, No model found a change that applies. addAction: addAction: "add.lines" must be a string or a number or true or false or null or an object.
- small da-inv-paid (data): change, change
- small da-ki-dish (data): failed, No model found a change that applies. addField: addField would make smithable.yml invalid. Dish has several yes/no fields (available, fishAndChips): name the available of the order page of page "menu", or "available: none".
- small da-mp-remove (data): change, change
- small da-rec-watch (data): change, change
- small da-st-open (data): failed, No model found a change that applies. addAction: addAction would make smithable.yml invalid. "set" of action "openIncident", status: Default "investigating" is not one of the choices: operational, degraded, down, maintenance. "add" of action "openIncident": IncidentUpdate must refer to Component exactly once to be added to it (it does not).
- small da-sp-assign (data): change, change
- small da-api-task (data): change, change
- small cc-crm-register (custom-code): question, question
- small cc-crm-churn (custom-code): change, change
- small cc-sp-ai-reply (custom-code): question, question
- small cc-bb-map (custom-code): change, change
- small cc-rec-barcode (custom-code): answer, answer
- small cc-sv-postnord (custom-code): answer, answer
- small cc-fi-weather (custom-code): answer, answer
- small a-crm-status (ambiguous): answer, answer
- small a-bb-phone (ambiguous): answer, answer
- small a-inv-logo (ambiguous): change, change
- small a-mp-sold (ambiguous): change, change
- small a-crm-lost (ambiguous): change, change
- small a-ki-drinks (ambiguous): change, change
- small a-bb-prices (ambiguous): change, change
- small a-api-private (ambiguous): change, change
- small a-bk-teachers (ambiguous): answer, answer
- small a-mp-sv-cat (ambiguous): answer, answer
- small a-rec-darker (ambiguous): failed, No model found a change that applies. addTheme: The theme is refused:
  themes/cafe.yml:8:3  error  Unknown color "neutral" in "light".
  themes/cafe.yml:9:3  error  Unknown color "neutralText" in "light".
  themes/cafe.yml:10:3  error  Unknown color "neutralTextMuted" in "light".
  themes/cafe.yml:13:3  error  Unknown color "danger" in "light".
  themes/cafe.yml:4:3  warning  In light mode, the text on the other buttons may be hard to read.
  themes/cafe.yml:19:3  error  Unknown color "neutral" in "dark".
  themes/cafe.yml:20:3  error  Unknown color "neutralText" in "dark".
  themes/cafe.yml:21:3  error  Unknown color "neutralTextMuted" in "dark".
  themes/cafe.yml:24:3  error  Unknown color "danger" in "dark".
  themes/cafe.yml:15:3  warning  In dark mode, the text on the main buttons may be hard to read.
  themes/cafe.yml:15:3  warning  In dark mode, the text on the other buttons may be hard to read.
- small o-fi-recipe (off-topic): question, question
- small o-python (off-topic): none, none
- small long-bk-change (change): failed, No model found a change that applies. setMeaning: There is no model named "field:Session".
- small long-inv-spec (spec-question): answer, The answer does not state that a sent invoice is marked overdue 7 days after its due date, nor does it mention that the app mails the client only when an invoice is marked sent. Additionally, it does not explicitly confirm that the app does not mail the client when the invoice goes overdue (a mustNot fact).
- small long-sv-change (two-things): change, addField,setText for addField
- small long-status-change (change): change, addOutgoing for addOutgoing,setOutgoingBody
- small long-mp-docs (docs-question): answer, The answer states the data is hosted in the EU (Frankfurt and Stockholm) but does not explicitly confirm it is hosted in Sweden. It also mentions GDPR compliance and export tools but does not specify backups in the same region, a .zip download, or a transfer link.
- small long-api-spec (spec-question): answer, The answer states that Claude Code cannot delete anything (satisfies 'it cannot delete'), but it incorrectly claims it cannot access or change notes (contradicts 'it adds and changes tasks and notes' and 'it reads everything').
