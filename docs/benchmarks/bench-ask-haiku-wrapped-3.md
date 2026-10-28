# bench-ask: haiku-wrapped-3 (2026-10-27)

The questions of [bench-ask-questions.mjs](../../scripts/bench-ask-questions.mjs), asked of each starter's assistant tools at `/mcp` with an administrator's key ([bench-ask.mjs](../../scripts/bench-ask.mjs)), by each model: it calls tools until it answers (at most 8 model calls). A read is right when its answer gives the number, names, words or pairs worked out from the records; a change is right when the records afterwards say so. Each change starts from the starter's records.

Correctness is judged on the answer's facts against the records (a count, a name or id found, a record changed), never on the tool calls: a confident answer that is wrong counts as wrong. "Stated as fact" is a wrong answer given as true, such as a total, a name or "there is no such invoice", rather than one saying the model could not tell; it is the kind a person would act on. "Right when every tool call was valid" counts the questions whose tool calls all succeeded, and how many of them were answered right: valid calls are not a right answer.

| Model | Right | Wrong | Of them, stated as fact | Of them, a count or sum the model worked out | Right when every tool call was valid | Gave up or failed | Model calls per question | Reads in one or two calls | Tokens in / out per question | Tool results per question (tokens) | Cost per question | Time |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| wrap:alone:claude-haiku-5-5 | 127 / 134 (95 %) | 7 | 3 | 0 | 121 / 127 | 0 | 2.3 | 89 / 99 | 5,495 / 249 | 65 | $0.0002 | 16.9 s |
| claude-haiku-5-5 | 127 / 134 (95 %) | 6 | 2 | 0 | 121 / 127 | 1 | 2.6 | 82 / 99 | 6,122 / 314 | 71 | $0.0003 | 19.8 s |
| wrap:critique:claude-haiku-5-5 | 128 / 134 (96 %) | 6 | 2 | 0 | 119 / 124 | 0 | 4.4 | 0 / 99 | 10,868 / 643 | 158 | $0.0006 | 23.4 s |
| wrap:vote3:claude-haiku-5-5 | 127 / 134 (95 %) | 7 | 3 | 0 | 121 / 127 | 0 | 5.5 | 0 / 99 | 12,912 / 582 | 146 | $0.0005 | 24.9 s |
| claude-sonnet-5-5 | 129 / 134 (96 %) | 5 | 1 | 0 | 129 / 132 | 0 | 2.5 | 73 / 99 | 6,150 / 257 | 87 | $0.0054 | 19.0 s |
| cascade:claude-haiku-5-5>claude-sonnet-5-5 | 126 / 134 (94 %) | 8 | 4 | 0 | 120 / 127 | 0 | 2.4 | 84 / 99 | 5,799 / 274 | 72 | $0.0007 | 18.4 s |

**cascade:claude-haiku-5-5>claude-sonnet-5-5** moved 8 of 134 questions to the better model (0 after two refused tool calls, 6 at the fourth call, 1 after an answer that gave up, 1 after an answer the check sent back twice); 7 of them were then right. Of the 126 that stayed on the cheap model, 119 were right.

**claude-haiku-5-5**, the app's answer check (ask-checks.md §3): 10 of 134 answers went back to the model; 6 of them came back grounded (5 right). 4 were shown as not confirmed: 2 wrong and 2 right. A wrong answer shown as not confirmed is not counted as stated as fact.

**claude-sonnet-5-5**, the app's answer check (ask-checks.md §3): 6 of 134 answers went back to the model; 6 of them came back grounded (4 right). 0 were shown as not confirmed: 0 wrong and 0 right. A wrong answer shown as not confirmed is not counted as stated as fact.

**cascade:claude-haiku-5-5>claude-sonnet-5-5**, the app's answer check (ask-checks.md §3): 5 of 134 answers went back to the model; 4 of them came back grounded (3 right). 1 were shown as not confirmed: 0 wrong and 1 right. A wrong answer shown as not confirmed is not counted as stated as fact.

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
| status | 23 / 25 | 22 / 25 | 23 / 25 | 23 / 25 | 24 / 25 | 21 / 25 |
| booking | 23 / 24 | 24 / 24 | 24 / 24 | 23 / 24 | 24 / 24 | 24 / 24 |
| marketplace | 16 / 20 | 16 / 20 | 16 / 20 | 16 / 20 | 16 / 20 | 16 / 20 |
| records | 15 / 15 | 15 / 15 | 15 / 15 | 15 / 15 | 15 / 15 | 15 / 15 |

## Not right

| Model | Starter | # | Question | Outcome | Expected | Answer |
|---|---|---|---|---|---|---|
| wrap:alone:claude-haiku-5-5 | status | 1 | Is anything down right now? | wrong (stated as fact) | ["Payments"] | No. None of your components is currently marked down. |
| wrap:alone:claude-haiku-5-5 | status | 22 | Report a new incident: logging in to the mobile app fails, we're investigating. | wrong (stated as fact) |  | I've logged the incident "Logging in to the mobile app fails" (ID 6) with status investigating, detected today, 2026-10-27. It isn't linked to a component yet. |
| claude-haiku-5-5 | status | 1 | Is anything down right now? | wrong (stated as fact) | ["Payments"] | No. None of your components is currently marked as down. |
| claude-haiku-5-5 | status | 8 | What maintenance is planned? | wrong (shown as not confirmed) | ["Sign-in system update","Move of the app's notification service","Database upgrade"] | The 26 is in the tool result. The sign-in maintenance's start time came back as the exact text "2026-10-26T05:00:00.000Z", and the day part of that date is 26. I haven't changed or inferred anything beyond that text. |
| claude-haiku-5-5 | status | 22 | Report a new incident: logging in to the mobile app fails, we're investigating. | wrong (stated as fact) |  | I've logged the incident "Logging in to the mobile app fails" with status investigating (ID 6). It has no component linked and no summary yet. Its detected time is recorded as 2026-10-26 22:00 UTC, which is 2026-10-27 00:00 in the app's loc |
| wrap:critique:claude-haiku-5-5 | status | 1 | Is anything down right now? | wrong (stated as fact) | ["Payments"] | No component is currently marked as down. I checked all components with status "down" and found none. |
| wrap:critique:claude-haiku-5-5 | status | 22 | Report a new incident: logging in to the mobile app fails, we're investigating. | wrong (stated as fact) |  | I logged the incident "Logging in to the mobile app fails" as ID 6 with status **investigating**. It isn't linked to a component. I set the detection time to 2026-10-27 00:00, which the app stored as 2026-10-26 22:00 UTC. You didn't give a  |
| wrap:vote3:claude-haiku-5-5 | status | 1 | Is anything down right now? | wrong (stated as fact) | ["Payments"] | No. None of your components is currently marked as down. |
| wrap:vote3:claude-haiku-5-5 | status | 22 | Report a new incident: logging in to the mobile app fails, we're investigating. | wrong (stated as fact) |  | I've logged the incident "Logging in to the mobile app fails" (ID 6) with status investigating. It has no component linked, and its detected time is set to today, 2026-10-27 at 00:00 in your local time. |
| claude-sonnet-5-5 | status | 5 | How long was the website down, in minutes? | wrong (said unsure) | 21 | No tool returned a duration in minutes, and `measure` can't compute one because the app has no duration field. I can only give you what the tools returned: - **Detected at:** 2026-09-24T08:40:00Z - **Resolved at:** 2026-09-24T09:01:00Z - ** |
| cascade:claude-haiku-5-5>claude-sonnet-5-5 | status | 1 | Is anything down right now? | wrong (stated as fact) | ["Payments"] | No. No components are currently marked as down. |
| cascade:claude-haiku-5-5>claude-sonnet-5-5 | status | 7 | What was our last update on the card payments problem? | wrong (stated as fact) | ["Payments confirm in seconds again"] | The last posted update on "Card payments slow at checkout" is from 1 October 2026, 14:10 UTC: "We are looking into slow card payments at checkout" (status: investigating). The incident itself has since moved to monitoring. Its summary says  |
| cascade:claude-haiku-5-5>claude-sonnet-5-5 | status | 16 | How many incidents per status? | wrong (stated as fact) | {"monitoring":2,"resolved":3} | You're right to check. I had inferred that from the grouped result, which didn't list those statuses. A direct count confirms it: 0 incidents are investigating or identified. |
| cascade:claude-haiku-5-5>claude-sonnet-5-5 | status | 22 | Report a new incident: logging in to the mobile app fails, we're investigating. | wrong (stated as fact) |  | I've created incident #6, "Logging in to the mobile app fails", with status investigating. It has no component linked and no summary yet. The app recorded its detection time as 2026-10-26 22:00 UTC. |
| wrap:alone:claude-haiku-5-5 | booking | 9 | What is our newest post? | wrong (stated as fact) | ["Morning classes are back"] | Your newest post is "Summer sessions by the sea," published 2026-08-31. |
| wrap:alone:claude-haiku-5-5 | booking | 17 | Which teachers have a portrait? | skipped (pictures are not in the API) |  |  |
| claude-haiku-5-5 | booking | 17 | Which teachers have a portrait? | skipped (pictures are not in the API) |  |  |
| wrap:critique:claude-haiku-5-5 | booking | 17 | Which teachers have a portrait? | skipped (pictures are not in the API) |  |  |
| wrap:vote3:claude-haiku-5-5 | booking | 9 | What is our newest post? | wrong (stated as fact) | ["Morning classes are back"] | Your newest post is "Summer sessions by the sea," published on 2026-08-31. |
| wrap:vote3:claude-haiku-5-5 | booking | 17 | Which teachers have a portrait? | skipped (pictures are not in the API) |  |  |
| claude-sonnet-5-5 | booking | 17 | Which teachers have a portrait? | skipped (pictures are not in the API) |  |  |
| cascade:claude-haiku-5-5>claude-sonnet-5-5 | booking | 17 | Which teachers have a portrait? | skipped (pictures are not in the API) |  |  |
| wrap:alone:claude-haiku-5-5 | marketplace | 17 | Lower the price of the sailing dinghy to 950. | wrong (said unsure) |  | I couldn't find a sailing dinghy in Torget. The closest match is "Rowing boat with oars," which may not be the item you mean, so I haven't changed anything. Do you want me to lower the price of the rowing boat to 950, or is the dinghy liste |
| wrap:alone:claude-haiku-5-5 | marketplace | 18 | Put up a tent for sale: two-person tent, sports, good condition, 45 €, in Sund. | wrong (said unsure) |  | I couldn't post the tent. The app rejected the listing with "Some values are not valid," and it doesn't say which value is wrong. The likely cause is that photos are required and I have none to attach. I tried the price as both "45.00" and  |
| wrap:alone:claude-haiku-5-5 | marketplace | 19 | Take the balance bike off the site. | wrong (said unsure) |  | I couldn't find a balance bike on the site. The only bikes listed are: 1. **Road bike, 56 cm frame** (id 6) 2. **City bike, seven gears** (id 4) Neither is a balance bike. Do you want me to remove one of these, or was the balance bike liste |
| wrap:alone:claude-haiku-5-5 | marketplace | 20 | The car roof box is in Jomala, not Mariehamn. | wrong (said unsure) |  | I couldn't find a car roof box in Torget, so I haven't changed anything. I searched titles, descriptions and places, and went through all 12 items. None is a roof box, and none is listed in Mariehamn for it to move from. Do you want me to a |
| claude-haiku-5-5 | marketplace | 17 | Lower the price of the sailing dinghy to 950. | wrong (said unsure) |  | I couldn't find a sailing dinghy in Torget. The closest match is "Rowing boat with oars" (id 11), currently priced at 600.00. Is that the one you mean? If so, I can change its price to 950. Otherwise, let me know the right title. |
| claude-haiku-5-5 | marketplace | 18 | Put up a tent for sale: two-person tent, sports, good condition, 45 €, in Sund. | gave up |  |  |
| claude-haiku-5-5 | marketplace | 19 | Take the balance bike off the site. | wrong (shown as not confirmed) |  | Nothing has every word of "balance bike" in title, description, place. The nearest titles: Turntable, Road bike, 56 cm frame, City bike, seven gears. Nothing has been deleted. If you tell me which listing you want removed, I'll delete it. |
| claude-haiku-5-5 | marketplace | 20 | The car roof box is in Jomala, not Mariehamn. | wrong (said unsure) |  | I couldn't find a car roof box in Torget, so I haven't changed anything. The only items listed in Mariehamn are Turntable, Laptop (13 inch), City bike (seven gears) and Light gray armchair. Could you give me the exact title, or check whethe |
| wrap:critique:claude-haiku-5-5 | marketplace | 17 | Lower the price of the sailing dinghy to 950. | wrong (said unsure) |  | I couldn't find a sailing dinghy in Torget. The only boat listed is "Rowing boat with oars", priced at 600.00, which is a different kind of boat. Do you want me to lower that one's price to 950 instead? If not, give me the exact title of th |
| wrap:critique:claude-haiku-5-5 | marketplace | 18 | Put up a tent for sale: two-person tent, sports, good condition, 45 €, in Sund. | wrong (said unsure) |  | I couldn't create the tent listing. The app rejected it because the item form requires a **photo**, and I can't upload pictures from here. Once you send a photo of the tent, I'll post it with these details: - **Title:** Two-person tent - ** |
| wrap:critique:claude-haiku-5-5 | marketplace | 19 | Take the balance bike off the site. | wrong (said unsure) |  | I couldn't find a balance bike on the site, so I haven't deleted anything. I checked all 12 listings, and none is a balance bike. The only bikes are: 1. Road bike, 56 cm frame (id 6, available) 2. City bike, seven gears (id 4, available) Do |
| wrap:critique:claude-haiku-5-5 | marketplace | 20 | The car roof box is in Jomala, not Mariehamn. | wrong (said unsure) |  | I couldn't find a car roof box in Torget, so I haven't changed anything. Searches for "car roof box", "roof", "box" and "car" in titles, descriptions and places matched nothing. The four items currently listed in Mariehamn are Turntable, La |
| wrap:vote3:claude-haiku-5-5 | marketplace | 17 | Lower the price of the sailing dinghy to 950. | wrong (said unsure) |  | I couldn't find a sailing dinghy in Torget. The closest match is "Rowing boat with oars" (currently 600.00), which is a different item. I haven't changed anything. Do you want me to lower the price of the rowing boat to 950? Note that 950 i |
| wrap:vote3:claude-haiku-5-5 | marketplace | 18 | Put up a tent for sale: two-person tent, sports, good condition, 45 €, in Sund. | wrong (said unsure) |  | I couldn't create the listing yet. The app rejected it with "Some values are not valid," and the most likely cause is the **photos** field, which is required and which I have no way to upload. Could you send a photo of the tent? Once I have |
| wrap:vote3:claude-haiku-5-5 | marketplace | 19 | Take the balance bike off the site. | wrong (said unsure) |  | I couldn't find a balance bike on the site, so I haven't deleted anything. The closest matches are "Road bike, 56 cm frame" and "City bike, seven gears," and neither is a balance bike. The only kids' item is "Wooden pull-along toys." Do you |
| wrap:vote3:claude-haiku-5-5 | marketplace | 20 | The car roof box is in Jomala, not Mariehamn. | wrong (said unsure) |  | I can't find a "car roof box" in Torget. I searched titles, descriptions and places, and the full list of 12 items has no roof box. Nothing has been changed. Could you check the exact title? If you tell me which item you mean, I'll set its  |
| claude-sonnet-5-5 | marketplace | 17 | Lower the price of the sailing dinghy to 950. | wrong (said unsure) |  | I couldn't find a listing called "sailing dinghy". The closest match is "Rowing boat with oars", but I haven't changed it because it may not be the item you mean. Should I lower the price of the rowing boat to 950, or is the dinghy listed u |
| claude-sonnet-5-5 | marketplace | 18 | Put up a tent for sale: two-person tent, sports, good condition, 45 €, in Sund. | wrong (said unsure) |  | I couldn't post the tent yet. Every listing needs at least one photo, and I don't have one for it. Can you send a photo of the tent? Once I have it, I'll post the listing with these details: - Title: Two-person tent - Category: Sports - Con |
| claude-sonnet-5-5 | marketplace | 19 | Take the balance bike off the site. | wrong (said unsure) |  | I couldn't find a balance bike on the site, so I haven't deleted anything. The only bikes listed are: - Road bike, 56 cm frame - City bike, seven gears The only kids' item is "Wooden pull-along toys". Is the balance bike listed under anothe |
| claude-sonnet-5-5 | marketplace | 20 | The car roof box is in Jomala, not Mariehamn. | wrong (stated as fact) |  | The search for "roof box" returned this: Nothing has every word of "roof box" in title, description, place. The nearest titles: Road bike, 56 cm frame, City bike, seven gears, Rowing boat with oars. No listing matches, so I haven't changed  |
| cascade:claude-haiku-5-5>claude-sonnet-5-5 | marketplace | 17 | Lower the price of the sailing dinghy to 950. | wrong (said unsure) |  | I couldn't find a sailing dinghy in Torget. Searches for "sailing dinghy", "dinghy", "boat" and "sail" returned no match. The closest listing is **Rowing boat with oars**. Do you want me to lower that one's price to 950 instead, or is the d |
| cascade:claude-haiku-5-5>claude-sonnet-5-5 | marketplace | 18 | Put up a tent for sale: two-person tent, sports, good condition, 45 €, in Sund. | wrong (said unsure) |  | I couldn't add the tent. The app says some values are not valid, and the listing needs a photo, which I don't have. Can you send a photo of the tent? Once I have it, I'll post the listing as: "Two-person tent", sports, good condition, 45 €, |
| cascade:claude-haiku-5-5>claude-sonnet-5-5 | marketplace | 19 | Take the balance bike off the site. | wrong (said unsure) |  | I couldn't find a balance bike on the site. The only bike listings are: - **Road bike, 56 cm frame** (id 6) - **City bike, seven gears** (id 4) Neither is a balance bike. Do you want me to remove one of these, or is the balance bike listed  |
| cascade:claude-haiku-5-5>claude-sonnet-5-5 | marketplace | 20 | The car roof box is in Jomala, not Mariehamn. | wrong (said unsure) |  | I couldn't find a roof box listing, so I haven't changed anything. A search for "car roof box" and one for "roof" both came back empty. The only Mariehamn listings are: - Turntable (id 9) - Laptop, 13 inch (id 7) - City bike, seven gears (i |
