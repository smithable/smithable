# bench-ask: haiku-wrapped-2 (2026-10-27)

The questions of [bench-ask-questions.mjs](../../scripts/bench-ask-questions.mjs), asked of each starter's assistant tools at `/mcp` with an administrator's key ([bench-ask.mjs](../../scripts/bench-ask.mjs)), by each model: it calls tools until it answers (at most 8 model calls). A read is right when its answer gives the number, names, words or pairs worked out from the records; a change is right when the records afterwards say so. Each change starts from the starter's records.

Correctness is judged on the answer's facts against the records (a count, a name or id found, a record changed), never on the tool calls: a confident answer that is wrong counts as wrong. "Stated as fact" is a wrong answer given as true, such as a total, a name or "there is no such invoice", rather than one saying the model could not tell; it is the kind a person would act on. "Right when every tool call was valid" counts the questions whose tool calls all succeeded, and how many of them were answered right: valid calls are not a right answer.

| Model | Right | Wrong | Of them, stated as fact | Of them, a count or sum the model worked out | Right when every tool call was valid | Gave up or failed | Model calls per question | Reads in one or two calls | Tokens in / out per question | Tool results per question (tokens) | Cost per question | Time |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| wrap:alone:claude-haiku-5-5 | 126 / 134 (94 %) | 8 | 4 | 0 | 121 / 128 | 0 | 2.4 | 88 / 99 | 5,573 / 254 | 69 | $0.0002 | 12.1 s |
| claude-haiku-5-5 | 127 / 134 (95 %) | 6 | 2 | 0 | 121 / 127 | 1 | 2.5 | 84 / 99 | 5,976 / 291 | 66 | $0.0003 | 14.4 s |
| wrap:critique:claude-haiku-5-5 | 129 / 134 (96 %) | 5 | 1 | 0 | 120 / 124 | 0 | 4.5 | 0 / 99 | 11,089 / 655 | 157 | $0.0006 | 22.8 s |
| wrap:vote3:claude-haiku-5-5 | 128 / 134 (96 %) | 6 | 2 | 0 | 123 / 128 | 0 | 5.5 | 0 / 99 | 12,857 / 588 | 140 | $0.0005 | 21.4 s |
| claude-sonnet-5-5 | 130 / 134 (97 %) | 4 | 1 | 0 | 129 / 132 | 0 | 2.6 | 71 / 99 | 6,443 / 277 | 89 | $0.0058 | 17.4 s |
| cascade:claude-haiku-5-5>claude-sonnet-5-5 | 128 / 134 (96 %) | 6 | 3 | 0 | 123 / 128 | 0 | 2.5 | 84 / 99 | 5,928 / 286 | 68 | $0.0008 | 13.0 s |

**cascade:claude-haiku-5-5>claude-sonnet-5-5** moved 9 of 134 questions to the better model (1 after two refused tool calls, 4 at the fourth call, 1 after an answer that gave up, 3 after an answer the check sent back twice); 7 of them were then right. Of the 125 that stayed on the cheap model, 121 were right.

**claude-haiku-5-5**, the app's answer check (ask-checks.md §3): 7 of 134 answers went back to the model; 3 of them came back grounded (2 right). 4 were shown as not confirmed: 2 wrong and 2 right. A wrong answer shown as not confirmed is not counted as stated as fact.

**claude-sonnet-5-5**, the app's answer check (ask-checks.md §3): 10 of 134 answers went back to the model; 9 of them came back grounded (8 right). 1 were shown as not confirmed: 0 wrong and 1 right. A wrong answer shown as not confirmed is not counted as stated as fact.

**cascade:claude-haiku-5-5>claude-sonnet-5-5**, the app's answer check (ask-checks.md §3): 9 of 134 answers went back to the model; 8 of them came back grounded (7 right). 1 were shown as not confirmed: 0 wrong and 1 right. A wrong answer shown as not confirmed is not counted as stated as fact.

The tools each starter offers (`tools/list`, about four characters a token):

| Starter | Tools | Their size (tokens) | The app's summary (tokens) |
|---|---|---|---|
| crm | 8 | 1,111 | 145 |
| invoicing | 8 | 1,111 | 233 |
| status | 8 | 1,117 | 255 |
| booking | 8 | 1,124 | 222 |
| marketplace | 7 | 944 | 109 |
| records | 7 | 944 | 84 |

## Per starter

| Starter | wrap:alone:claude-haiku-5-5 | claude-haiku-5-5 | wrap:critique:claude-haiku-5-5 | wrap:vote3:claude-haiku-5-5 | claude-sonnet-5-5 | cascade:claude-haiku-5-5>claude-sonnet-5-5 |
|---|---|---|---|---|---|---|
| crm | 25 / 25 | 25 / 25 | 25 / 25 | 25 / 25 | 25 / 25 | 25 / 25 |
| invoicing | 25 / 25 | 25 / 25 | 25 / 25 | 25 / 25 | 25 / 25 | 25 / 25 |
| status | 22 / 25 | 23 / 25 | 24 / 25 | 23 / 25 | 25 / 25 | 23 / 25 |
| booking | 23 / 24 | 23 / 24 | 24 / 24 | 24 / 24 | 24 / 24 | 24 / 24 |
| marketplace | 16 / 20 | 16 / 20 | 16 / 20 | 16 / 20 | 16 / 20 | 16 / 20 |
| records | 15 / 15 | 15 / 15 | 15 / 15 | 15 / 15 | 15 / 15 | 15 / 15 |

## Not right

| Model | Starter | # | Question | Outcome | Expected | Answer |
|---|---|---|---|---|---|---|
| wrap:alone:claude-haiku-5-5 | status | 1 | Is anything down right now? | wrong (stated as fact) | ["Payments"] | No. None of the components is currently marked as down. |
| wrap:alone:claude-haiku-5-5 | status | 7 | What was our last update on the card payments problem? | wrong (stated as fact) | ["Payments confirm in seconds again"] | The latest update on "Card payments slow at checkout" is from 1 October 2026, 14:10 UTC: "We are looking into slow card payments at checkout." Its status was investigating. The incident itself is now in monitoring and has no resolved time.  |
| wrap:alone:claude-haiku-5-5 | status | 22 | Report a new incident: logging in to the mobile app fails, we're investigating. | wrong (stated as fact) |  | I've logged a new incident, "Logging in to the mobile app fails", with status investigating (ID 6). It has no component or summary yet. Detected time is recorded as 2026-10-27 00:00 in local time, which the app stores as 2026-10-26 22:00 UT |
| claude-haiku-5-5 | status | 5 | How long was the website down, in minutes? | wrong (said unsure) | 21 | I can't give you a duration from the app's data. No tool returned a minutes figure, and the app can't compute the difference between two datetimes. The tool results contain: - Incident #1 "Website unreachable for twenty minutes", status res |
| claude-haiku-5-5 | status | 22 | Report a new incident: logging in to the mobile app fails, we're investigating. | wrong (stated as fact) |  | I've logged the incident "Logging in to the mobile app fails" with status investigating (ID 6). It has no component linked and no summary yet. The detected time was stored as 2026-10-26 22:00 UTC, which is 2026-10-27 00:00 in the app's loca |
| wrap:critique:claude-haiku-5-5 | status | 22 | Report a new incident: logging in to the mobile app fails, we're investigating. | wrong (said unsure) |  | I logged the incident "Logging in to the mobile app fails" (ID 6) with status investigating. No component or summary is linked yet. The detected time is stored as 2026-10-26 22:00 UTC. That shows as 2026-10-27 00:00 only if your local time  |
| wrap:vote3:claude-haiku-5-5 | status | 1 | Is anything down right now? | wrong (stated as fact) | ["Payments"] | No. No components are currently marked as down. |
| wrap:vote3:claude-haiku-5-5 | status | 22 | Report a new incident: logging in to the mobile app fails, we're investigating. | wrong (stated as fact) |  | I've created incident #6, "Logging in to the mobile app fails", with status investigating. It has no component linked yet. Its detected time was saved as 2026-10-26 22:00 UTC, not midnight on 27 October as I entered it. The app may be apply |
| cascade:claude-haiku-5-5>claude-sonnet-5-5 | status | 1 | Is anything down right now? | wrong (stated as fact) | ["Payments"] | No. None of our components is currently marked down. |
| cascade:claude-haiku-5-5>claude-sonnet-5-5 | status | 22 | Report a new incident: logging in to the mobile app fails, we're investigating. | wrong (stated as fact) |  | I've logged the incident "Logging in to the mobile app fails" with status investigating (ID 6). I set the detected time to the start of today, 2026-10-27, since you didn't give a time. It isn't linked to a component. |
| wrap:alone:claude-haiku-5-5 | booking | 9 | What is our newest post? | wrong (stated as fact) | ["Morning classes are back"] | Our newest post is "Summer sessions by the sea," published on 2026-08-31 (status: published). |
| wrap:alone:claude-haiku-5-5 | booking | 17 | Which teachers have a portrait? | skipped (pictures are not in the API) |  |  |
| claude-haiku-5-5 | booking | 9 | What is our newest post? | wrong (stated as fact) | ["Morning classes are back"] | Our newest post is "Summer sessions by the sea," published on 2026-08-31. |
| claude-haiku-5-5 | booking | 17 | Which teachers have a portrait? | skipped (pictures are not in the API) |  |  |
| wrap:critique:claude-haiku-5-5 | booking | 17 | Which teachers have a portrait? | skipped (pictures are not in the API) |  |  |
| wrap:vote3:claude-haiku-5-5 | booking | 17 | Which teachers have a portrait? | skipped (pictures are not in the API) |  |  |
| claude-sonnet-5-5 | booking | 17 | Which teachers have a portrait? | skipped (pictures are not in the API) |  |  |
| cascade:claude-haiku-5-5>claude-sonnet-5-5 | booking | 17 | Which teachers have a portrait? | skipped (pictures are not in the API) |  |  |
| wrap:alone:claude-haiku-5-5 | marketplace | 17 | Lower the price of the sailing dinghy to 950. | wrong (said unsure) |  | I couldn't find a sailing dinghy in Torget. Searching for "sailing dinghy" and "dinghy boat" found no matches. The closest listing is "Rowing boat with oars." Is that the one you mean? If so, I'll lower its price to 950. If you meant a diff |
| wrap:alone:claude-haiku-5-5 | marketplace | 18 | Put up a tent for sale: two-person tent, sports, good condition, 45 €, in Sund. | wrong (said unsure) |  | I couldn't add the tent. The app refused the listing with "Some values are not valid," and it doesn't say which value. The likely cause is the required photos field, which I have no way to fill in. I tried three versions of the listing and  |
| wrap:alone:claude-haiku-5-5 | marketplace | 19 | Take the balance bike off the site. | wrong (said unsure) |  | I couldn't find a balance bike on the site. I searched by title and description and checked the bikes and kids categories. The closest matches were "Road bike, 56 cm frame" and "City bike, seven gears," and neither is a balance bike. I have |
| wrap:alone:claude-haiku-5-5 | marketplace | 20 | The car roof box is in Jomala, not Mariehamn. | wrong (said unsure) |  | I couldn't find a "car roof box" in Torget, so I haven't changed anything. There are 12 items in the app, and none is a roof box. The item list doesn't show one under any place, including Mariehamn. Could you check the title? If you give me |
| claude-haiku-5-5 | marketplace | 17 | Lower the price of the sailing dinghy to 950. | wrong (shown as not confirmed) |  | The search tool returned this: "Nothing has every word of 'sailing dinghy' in title, description, place. The nearest titles: Laptop, 13 inch, Rowing boat with oars, Table with four chairs." I haven't changed any prices. Do you want me to lo |
| claude-haiku-5-5 | marketplace | 18 | Put up a tent for sale: two-person tent, sports, good condition, 45 €, in Sund. | gave up |  |  |
| claude-haiku-5-5 | marketplace | 19 | Take the balance bike off the site. | wrong (said unsure) |  | I couldn't find a balance bike on the site. The only bike listings are: - **Road bike, 56 cm frame** (id 6) - **City bike, seven gears** (id 4) Neither is a balance bike. Do you want me to remove one of these, or did you mean a different li |
| claude-haiku-5-5 | marketplace | 20 | The car roof box is in Jomala, not Mariehamn. | wrong (shown as not confirmed) |  | Torget returned this: "Nothing has every word of 'car roof box' in title, description, place. The nearest titles: Three old books, Turntable, Green floor lamp." I haven't changed anything. Which item should be moved to Jomala? |
| wrap:critique:claude-haiku-5-5 | marketplace | 17 | Lower the price of the sailing dinghy to 950. | wrong (said unsure) |  | I couldn't find a sailing dinghy in Torget. The closest listing is "Rowing boat with oars," which may be a different kind of boat. Should I lower the price of the rowing boat to 950, or is the dinghy listed under another name? |
| wrap:critique:claude-haiku-5-5 | marketplace | 18 | Put up a tent for sale: two-person tent, sports, good condition, 45 €, in Sund. | wrong (said unsure) |  | I couldn't add the tent. The app refuses the listing with "Some values are not valid," and I can't tell which value it objects to. The Item form requires photos, and this assistant has no way to upload pictures. The listing failed even with |
| wrap:critique:claude-haiku-5-5 | marketplace | 19 | Take the balance bike off the site. | wrong (said unsure) |  | I couldn't find a balance bike on the site, so I haven't removed anything. The bike-related listings are "Road bike, 56 cm frame" and "City bike, seven gears". The only kids item is "Wooden pull-along toys". Is the balance bike listed under |
| wrap:critique:claude-haiku-5-5 | marketplace | 20 | The car roof box is in Jomala, not Mariehamn. | wrong (stated as fact) |  | I checked again and the first answer was right. There is no car roof box in Torget, under any title, description or place. The 12 items are listed by place, and none is a roof box. The items marked Mariehamn are Turntable, Laptop (13 inch), |
| wrap:vote3:claude-haiku-5-5 | marketplace | 17 | Lower the price of the sailing dinghy to 950. | wrong (said unsure) |  | I couldn't find a sailing dinghy in Torget. The only boat listed is "Rowing boat with oars," priced at 600.00. Do you want me to change that one to 950? Note that it's a higher price than it currently has, so it would be an increase, not a  |
| wrap:vote3:claude-haiku-5-5 | marketplace | 18 | Put up a tent for sale: two-person tent, sports, good condition, 45 €, in Sund. | wrong (said unsure) |  | I couldn't add the tent. The app rejected the listing with "Some values are not valid," and it doesn't say which value is wrong. The most likely cause is the required **photos** field, which I have no way to upload. If you send me a photo o |
| wrap:vote3:claude-haiku-5-5 | marketplace | 19 | Take the balance bike off the site. | wrong (said unsure) |  | I couldn't find a balance bike on the site, so I haven't removed anything. I searched for "balance bike" and "balance", and checked the bikes and kids categories. The closest matches were unrelated: Road bike, 56 cm frame; City bike, seven  |
| wrap:vote3:claude-haiku-5-5 | marketplace | 20 | The car roof box is in Jomala, not Mariehamn. | wrong (said unsure) |  | I couldn't find a car roof box in Torget. There are 12 items, and none is called that or mentions a roof box. The closest matches were "Three old books," "Turntable," and "Green floor lamp," which don't fit. I haven't changed anything. Coul |
| claude-sonnet-5-5 | marketplace | 17 | Lower the price of the sailing dinghy to 950. | wrong (said unsure) |  | I couldn't find a sailing dinghy in Torget, so I haven't changed any price. The closest listing is "Rowing boat with oars". Is that the one you meant? If it is, I'll set its price to 950. |
| claude-sonnet-5-5 | marketplace | 18 | Put up a tent for sale: two-person tent, sports, good condition, 45 €, in Sund. | wrong (said unsure) |  | I couldn't post the tent because the listing needs at least one photo, and I don't have one. Can you send a photo of the tent? Once I have it, I'll post it with these details: - Title: Two-person tent - Category: Sports - Condition: Good -  |
| claude-sonnet-5-5 | marketplace | 19 | Take the balance bike off the site. | wrong (said unsure) |  | I couldn't find a balance bike on the site, so I haven't removed anything. Searching "balance" and "balance bike" returned no matches. The only bikes listed are: - Road bike, 56 cm frame (id 6) - City bike, seven gears (id 4) The only item  |
| claude-sonnet-5-5 | marketplace | 20 | The car roof box is in Jomala, not Mariehamn. | wrong (stated as fact) |  | You're right to point that out. The search for "roof box" returned this: "Nothing has every word of "roof box" in title, description, place. The nearest titles: Road bike, 56 cm frame, City bike, seven gears, Rowing boat with oars." So no l |
| cascade:claude-haiku-5-5>claude-sonnet-5-5 | marketplace | 17 | Lower the price of the sailing dinghy to 950. | wrong (said unsure) |  | I couldn't find a sailing dinghy in Torget. The only boat listed is "Rowing boat with oars," priced at 600.00. I haven't changed it. Do you want me to lower that one to 950, or is the sailing dinghy listed under another name? |
| cascade:claude-haiku-5-5>claude-sonnet-5-5 | marketplace | 18 | Put up a tent for sale: two-person tent, sports, good condition, 45 €, in Sund. | wrong (said unsure) |  | I couldn't post the tent yet. A photo is required for every listing, and you didn't give me one. Can you send a photo of the tent? Once I have it, I'll post the listing with these details: - Title: Two-person tent - Category: Sports - Condi |
| cascade:claude-haiku-5-5>claude-sonnet-5-5 | marketplace | 19 | Take the balance bike off the site. | wrong (said unsure) |  | I couldn't find a balance bike on the site. The only bike listings are: - **Road bike, 56 cm frame** (id 6) - **City bike, seven gears** (id 4) Neither is a balance bike. Do you want me to remove one of these, or did you mean a different li |
| cascade:claude-haiku-5-5>claude-sonnet-5-5 | marketplace | 20 | The car roof box is in Jomala, not Mariehamn. | wrong (stated as fact) |  | The search for "car roof box" returned this: "Nothing has every word of "car roof box" in title, description, place. The nearest titles: Three old books, Turntable, Green floor lamp." So no listing matches the roof box, and I haven't change |
