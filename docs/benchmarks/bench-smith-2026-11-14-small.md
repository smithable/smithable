# What people say to Smith: 2026-11-14-small

2026-11-14, 357 requests of docs/benchmarks/smith-requests.json (undo and feedback are Studio's rules, not here). Small: claude-haiku-5-5; better: claude-sonnet-5-5; judge: claude-sonnet-5-5. Cost in US dollars at the models' list prices.

| Setup | Kind | Right | Of | By rule | Docs found | Tokens | Cost | Seconds |
|---|---|---|---|---|---|---|---|---|
| small | ambiguous | 20 | 25 | 0 |  | 542726 | 0.0579 | 87.6 |
| small | change | 101 | 141 | 14 |  | 3912640 | 0.4142 | 477.8 |
| small | custom-code | 11 | 13 | 0 |  | 324016 | 0.0347 | 46.9 |
| small | data | 23 | 23 | 0 |  | 641911 | 0.0686 | 91.2 |
| small | docs-question | 23 | 34 | 0 | 29 | 152579 | 0.0808 | 154.2 |
| small | off-topic | 8 | 10 | 0 |  | 71524 | 0.0080 | 24.5 |
| small | smalltalk | 17 | 17 | 13 |  | 11764 | 0.0014 | 9.4 |
| small | spec-question | 35 | 46 | 2 |  | 181785 | 0.1102 | 208.0 |
| small | two-things | 13 | 17 | 0 |  | 473107 | 0.0500 | 52.2 |

Wrong ones:

- small bk-capacity-default (change): change, setFieldDefault for changeField
- small bk-level-intermediate (change): change, changeField,setFieldDefault for changeField
- small bk-schedule-agenda (change): question, question
- small bk-schedule-color-level (change): none, none: This changes nothing.
- small bk-sv-ask-members (change): none, none: Already done: Ask is open to everyone who signs in, members included, and it only reads and answers; it changes nothing. Nothing needs to change.
- small crm-tones (change): none, none: This changes nothing.
- small crm-sv-segment-required (change): none, none: Redan gjort: segment är ett valfält med tre värden som alltid har ett värde (standardvärdet smb), så kunder kan inte sparas utan segment. Ett utropstecken behövs inte för det.
- small bb-service-45 (change): change, setFieldDefault for changeField
- small bb-sms-confirm (change): change, addOutgoing for setOutgoingTo
- small inv-notes-required (change): question, question
- small inv-totals (change): none, none: A totals row on the invoice list can only add up stored amount fields, and the invoice total is calculated from its lines, so the list has no total to show. The Overview page already sums outstanding, overdue, paid and invoiced amounts. For a total on the list itself, it would need custom code.
- small inv-sort-newest (change): none, none: This changes nothing.
- small ki-calories-rename (change): change, addField for renameField
- small ki-email-required (change): change, setFieldRules for changeField
- small ki-sunday-hours (change): question, question
- small ki-dishes-cards (change): none, none: This changes nothing.
- small mp-no-favorites (change): question, question
- small mp-sv-delivery (change): question, question
- small rec-cafe (change): question, question
- small rec-brand-green (change): failed, No model found a change that applies. setTheme: setTheme: Unknown argument "brand".
- small st-hide-maintenance (change): question, question
- small st-sv-icon (change): none, none: Ett varningstecken finns inte bland menyns ikoner, så det kan jag inte sätta här. Närmast finns klippbrädan (clipboard) eller listikonen (list), som du kan välja med setIcon. Vill du ha just en varningstriangel behöver du egen kod för sidan.
- small sp-priority-2 (change): change, setFieldDefault for changeField
- small sp-autoclose (change): question, question
- small sp-newest (change): none, none: Already done: the cases list shows the newest cases first by default, and nothing in the app changes that order until someone sorts it. Anyone can also pick Created under Sort by to get the newest first at any time.
- small sp-by-priority (change): question, question
- small sp-thread (change): none, none: Already done: på Cases-sidan visas ett ärendes meddelanden redan som en konversation med svarsruta. Öppna ett ärende så ser du det. Vill du att konversationen ska ligga före formuläret, kan jag ändra det med en inställning för sidans första innehåll.
- small api-assistant-delete-notes (change): question, question
- small api-fi-tag (change): question, question
- small tt-st-sev-comp (two-things): question, question
- small tt-sp-cat-search (two-things): question, question
- small tt-api-prio-page (two-things): question, question
- small q-bk-mail-book (spec-question): answer, The answer does not state the required facts. It says it cannot confirm that members get an email on booking, rather than saying yes, and it never mentions a mail sent when the booking is made as established behavior or a reminder the day before. It offers to set up a confirmation email, which does not satisfy the must items.
- small q-crm-signup (spec-question): answer, Svaret anger att adresser på acme.example kan registrera sig, vilket täcker det andra kravet. Men det första kravet, att bara inbjudna kollegor kan registrera sig, saknas. Svaret säger i stället att "vem som helst" med en acme.example-adress kan registrera sig, vilket tyder på att ingen inbjudan behövs och därmed motsäger kravet.
- small q-crm-fi-delete (spec-question): answer, The answer covers the first required fact: users can delete only the customers they own, i.e. their own customers. It never mentions that administrators (ylläpitäjät) can also delete customers, which is the second required fact. It also adds a trash/30-day restore detail, but that is not what is missing. Since one required fact is absent, the answer is incomplete.
- small q-bb-double (spec-question): answer, The answer says no, but it never states that an appointment takes up its barber's time. It describes free times, shop hours, lunch breaks, time off and a ten-minute buffer. It also says two customers cannot book the same time at once. None of that says outright that a booked appointment occupies the barber's time, so one required fact is missing.
- small q-bb-sv-delete-services (spec-question): answer, Svaret säger nej, men det nämner inte "bara ledighet" som kravet kräver. Det säger att staff öppnar dagsidan, bokningssidan och sidan för frånvaro, och det motsvarar inte uttryckligen att staff bara kan hantera ledighet. Därför saknas ett av de nödvändiga faktumen.
- small q-inv-overview (spec-question): answer, The answer covers outstanding, overdue, paid and latest invoices, but it says only "invoiced" rather than "invoiced by month". The required fact is a monthly breakdown, and the answer never mentions one. It therefore misses one of the required facts.
- small q-ki-order-notify (spec-question): answer, The answer covers staff and mail and push (email plus push notifications), but it never mentions the kitchen, which is a required fact under must. It says every staff member is notified and does not say the kitchen is told, so one required fact is missing. No mustNot items exist.
- small q-mp-seller (spec-question): answer, The answer hedges with "I don't know" instead of saying plainly that visitors cannot see who is selling an item. It does note that no seller field appears in an item's details, but it never concludes that the owner is not shown. It also suggests that the For sale page lets people contact the owner by mail, which muddies the point. So it does not clearly state either required fact.
- small q-rec-who-adds (spec-question): answer, The answer says any signed-in user, including members, can add items. It does not say that only administrators can add items, so it does not state the required fact and in fact contradicts it.
- small q-st-fi-resolve (spec-question): answer, Vastaus mainitsee tilan resolved ja kentän resolvedAt, mikä vastaa kohtia "tila on ratkaistu" ja "ratkaisuaika". Se ei kuitenkaan kerro, että päivitys lisätään, ja sanoo lisäksi, ettei Resolve-toiminnon vaikutusta tiedetä. Kaikkia vaadittuja faktoja ei siis esitetä.
- small q-api-let-it (change): answer, answer
- small d-domain (docs-question): answer, docs part not found, The answer does not state either required fact. It never says that once the app is live a custom domain can be set up, and it never mentions an A record and a TXT record. It says only that it doesn't know how to publish on your own domain and that setDomains limits sign-up email domains. It does not mention a price for domains, so it avoids the mustNot, but it still misses both must items.
- small d-ask (docs-question): answer, The answer says Ask is the app's assistant that anyone signing in can ask questions, which loosely covers the assistant idea, but it misses the required facts. It does not say Ask is a panel in the app, and it does not say the questions are about the records. It also never says Ask reads only what the person may read; it says only that it answers without changing anything, which is a different claim. It adds a CLI command instead.
- small d-export (docs-question): answer, The answer only covers Export CSV on list pages. It never mentions the "Download everything (.zip)" option or that it includes code, history, data and uploads, so two of the three required facts are missing.
- small d-where-data (docs-question): answer, docs part not found, The answer says the app's details don't say where data is physically kept, and it never mentions Sweden or that backups are in the same region. It describes the /data volume and the 2 GB storage limit instead, so both required facts are missing.
- small d-mail-limit (docs-question): answer, docs part not found, The answer states the 1,000 recipients a month per account limit, but it omits the required fact of 100 recipients a day per app. Since both facts under must are needed, it fails.
- small d-fi-finnish (docs-question): answer, Vastaus mainitsee englannin ja ruotsin, eikä väitä suomen olevan jo tuettu. Se ei kuitenkaan kerro, että uusi kieli lisätään pyynnöstä, joten toinen vaadituista asioista puuttuu.
- small d-google (docs-question): answer, The answer mentions the "Sign in with Google" page (as the docs source), which loosely covers the first must item. But it never says anything about "under Connections", so that required fact is missing. Since every must item has to be stated, the answer is not right.
- small d-sv-mcp (docs-question): answer, The answer includes /mcp, but it never says the key comes from the Team page. It only says $KEY is the assistant's key, that the key is shown in step 2, and that it should have the assistant role. The required fact about a key from the Team page is missing.
- small cc-crm-churn (custom-code): change, change
- small a-bb-phone (ambiguous): answer, answer
- small a-api-private (ambiguous): change, change
- small a-mp-sv-cat (ambiguous): answer, answer
- small o-python (off-topic): none, none
- small o-translate (off-topic): none, none
- small long-crm-ambig (ambiguous): answer, answer
- small long-kiosk-cc (custom-code): answer, answer
- small long-sv-change (two-things): answer, answer
- small long-status-change (change): change, addOutgoing for addOutgoing,setOutgoingBody
- small long-fi-ambig (ambiguous): answer, answer
- small long-mp-docs (docs-question): answer, docs part not found, The answer does not state any of the required facts. It says it lacks details on where data is kept and on full export, so it never mentions hosting in Sweden, backups in the same region, the "Download everything (.zip)" option, or a transfer link. It mentions only CSV export from list pages, which is not what the required facts describe.
- small bk-sv-staff-today-again (change): none, none
- small bk-members-for-staff (change): question, question
- small bk-sv-members-for-staff (change): question, question
- small bk-bookings-members-staff (change): question, question
- small bk-neg-not-for (change): question, question
- small bk-neg-without (change): question, question
- small bk-sv-neg-forutom (change): question, question
- small q-inv-sv-overdue (spec-question): answer, Svaret anger inte att fakturan blir förfallen 7 dagar efter förfallodagen. Det säger tvärtom att appen inte anger när timern körs. Att statusen gäller en skickad faktura nämns, men det räcker inte eftersom det andra kravet (7 dagar efter förfallodagen) saknas.
- small d-sv-export (docs-question): answer, The answer mentions the Export CSV button, but it never mentions the "Download everything (.zip)" option, which is also required under must. Because one required fact is missing, the answer is incomplete.
- small d-sv-mail-limit (docs-question): answer, docs part not found, Svaret anger bara gränsen 1 000 mottagare per månad per konto, men nämner inte den andra obligatoriska gränsen på 100 mottagare per dag per app. Dessutom beskrivs månadsgränsen som "totalt över alla dina appar", vilket stämmer med kontogränsen, men den dagliga gränsen per app saknas helt.
- small bk-sv-staff-delete-sessions (change): question, question
- small bb-sv-sms-confirm (change): change, addOutgoing for setOutgoingTo
