# bench-ask: claude (2026-10-26)

The questions of [bench-ask-questions.mjs](../../scripts/bench-ask-questions.mjs), asked of each starter's assistant tools at `/mcp` with an administrator's key ([bench-ask.mjs](../../scripts/bench-ask.mjs)), by each model: it calls tools until it answers (at most 8 model calls). A read is right when its answer gives the number, names, words or pairs worked out from the records; a change is right when the records afterwards say so. Each change starts from the starter's records.

Correctness is judged on the answer's facts against the records (a count, a name or id found, a record changed), never on the tool calls: a confident answer that is wrong counts as wrong. "Stated as fact" is a wrong answer given as true, such as a total, a name or "there is no such invoice", rather than one saying the model could not tell; it is the kind a person would act on. "Right when every tool call was valid" counts the questions whose tool calls all succeeded, and how many of them were answered right: valid calls are not a right answer.

| Model | Right | Wrong | Of them, stated as fact | Of them, a count or sum the model worked out | Right when every tool call was valid | Gave up or failed | Model calls per question | Reads in one or two calls | Tokens in / out per question | Tool results per question (tokens) | Cost per question | Time |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| claude-haiku-5-5 | 125 / 134 (93 %) | 9 | 3 | 0 | 119 / 127 | 0 | 2.5 | 81 / 99 | 5,978 / 287 | 55 | $0.0007 | 4.2 s |
| claude-sonnet-5-5 | 129 / 134 (96 %) | 5 | 0 | 0 | 129 / 132 | 0 | 2.6 | 76 / 99 | 6,287 / 259 | 75 | $0.0152 | 4.6 s |
| cascade:claude-haiku-5-5>claude-sonnet-5-5 | 127 / 134 (95 %) | 7 | 3 | 0 | 121 / 127 | 0 | 2.5 | 86 / 99 | 6,032 / 286 | 59 | $0.0019 | 4.1 s |

**cascade:claude-haiku-5-5>claude-sonnet-5-5** moved 11 of 134 questions to the better model (1 after two refused tool calls, 7 at the fourth call, 0 after an answer that gave up, 3 after an answer the check sent back twice); 7 of them were then right. Of the 123 that stayed on the cheap model, 120 were right.

**claude-haiku-5-5**, the app's answer check (ask-checks.md §3): 9 of 134 answers went back to the model; 5 of them came back grounded (4 right). 4 were shown as not confirmed: 3 wrong and 1 right. A wrong answer shown as not confirmed is not counted as stated as fact.

**claude-sonnet-5-5**, the app's answer check (ask-checks.md §3): 7 of 134 answers went back to the model; 5 of them came back grounded (4 right). 2 were shown as not confirmed: 0 wrong and 2 right. A wrong answer shown as not confirmed is not counted as stated as fact.

**cascade:claude-haiku-5-5>claude-sonnet-5-5**, the app's answer check (ask-checks.md §3): 10 of 134 answers went back to the model; 7 of them came back grounded (6 right). 3 were shown as not confirmed: 1 wrong and 2 right. A wrong answer shown as not confirmed is not counted as stated as fact.

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

| Starter | claude-haiku-5-5 | claude-sonnet-5-5 | cascade:claude-haiku-5-5>claude-sonnet-5-5 |
|---|---|---|---|
| crm | 25 / 25 | 25 / 25 | 25 / 25 |
| invoicing | 25 / 25 | 25 / 25 | 25 / 25 |
| status | 23 / 25 | 24 / 25 | 23 / 25 |
| booking | 22 / 24 | 24 / 24 | 23 / 24 |
| marketplace | 16 / 20 | 16 / 20 | 16 / 20 |
| records | 14 / 15 | 15 / 15 | 15 / 15 |

## Not right

| Model | Starter | # | Question | Outcome | Expected | Answer |
|---|---|---|---|---|---|---|
| claude-haiku-5-5 | status | 5 | How long was the website down, in minutes? | wrong (stated as fact) | 21 | The tools don't return a duration in minutes. The only duration text is the incident title, "Website unreachable for twenty minutes," so the best figure from the app is **twenty minutes**. The timestamps are 2026-09-24 08:40 to 09:01 UTC, b |
| claude-haiku-5-5 | status | 22 | Report a new incident: logging in to the mobile app fails, we're investigating. | wrong (stated as fact) |  | I've logged the incident "Logging in to the mobile app fails" (ID 3) with status investigating. It has no component linked yet. The detected time was stored as 2026-10-25 22:00 UTC, which is 2026-10-26 00:00 in the app's local time. |
| claude-sonnet-5-5 | status | 5 | How long was the website down, in minutes? | wrong (said unsure) | 21 | No tool returned a duration in minutes, and the app can't calculate one. I haven't found a way to get a minute figure from a tool. What the tools returned about the website incident: - Title: "Website unreachable for twenty minutes" - Detec |
| cascade:claude-haiku-5-5>claude-sonnet-5-5 | status | 5 | How long was the website down, in minutes? | wrong (shown as not confirmed) | 21 | My search for "website down" matched nothing. The nearest title it suggested was "Website unreachable for twenty minutes". I then looked up the Website component's incidents and found that same incident, so I didn't answer "none". Going by  |
| cascade:claude-haiku-5-5>claude-sonnet-5-5 | status | 7 | What was our last update on the card payments problem? | wrong (stated as fact) | ["Payments confirm in seconds again"] | The last update logged on "Card payments slow at checkout" (Oct 1, 2026, 14:10 UTC) says: "We are looking into slow card payments at checkout." Its status was investigating. The incident itself is now marked monitoring, and its summary says |
| claude-haiku-5-5 | booking | 9 | What is our newest post? | wrong (stated as fact) | ["Morning classes are back"] | Our newest post is "Summer sessions by the sea," published on 2026-08-31. |
| claude-haiku-5-5 | booking | 16 | What is the biggest class we run, by places? | wrong (shown as not confirmed) | 16 | The 31 is in the session 13 record I read: "startsAt":"2026-10-31T08:00:00.000Z". That is the source for the date, 31 October 2026. |
| claude-haiku-5-5 | booking | 17 | Which teachers have a portrait? | skipped (pictures are not in the API) |  |  |
| claude-sonnet-5-5 | booking | 17 | Which teachers have a portrait? | skipped (pictures are not in the API) |  |  |
| cascade:claude-haiku-5-5>claude-sonnet-5-5 | booking | 9 | What is our newest post? | wrong (stated as fact) | ["Morning classes are back"] | Your newest post is "Summer sessions by the sea," published on 2026-08-31. |
| cascade:claude-haiku-5-5>claude-sonnet-5-5 | booking | 17 | Which teachers have a portrait? | skipped (pictures are not in the API) |  |  |
| claude-haiku-5-5 | marketplace | 17 | Lower the price of the sailing dinghy to 950. | wrong (said unsure) |  | I couldn't find a sailing dinghy in Torget. The only boat listed is "Rowing boat with oars" (currently 600.00). Did you mean that one? If so, I'll change its price to 950. If not, tell me the right title. |
| claude-haiku-5-5 | marketplace | 18 | Put up a tent for sale: two-person tent, sports, good condition, 45 €, in Sund. | wrong (said unsure) |  | I couldn't post the tent. The app says some values are not valid, and the listing needs a photo, which I don't have. Can you send a photo of the tent? Once I have it, I'll post the listing as: two-person tent, sports, good condition, 45 €,  |
| claude-haiku-5-5 | marketplace | 19 | Take the balance bike off the site. | wrong (said unsure) |  | I couldn't find a balance bike on the site. The only bikes listed are: - **Road bike, 56 cm frame** (id 6) - **City bike, seven gears** (id 4) Did you mean one of these? If so, tell me which and I'll remove it. I haven't deleted anything. |
| claude-haiku-5-5 | marketplace | 20 | The car roof box is in Jomala, not Mariehamn. | wrong (shown as not confirmed) |  | The search result said: "Nothing has every word of 'car roof box' in title, description, place. The nearest titles: Three old books, Turntable, Green floor lamp." I haven't changed anything. Which item should I move to Jomala? If you give m |
| claude-sonnet-5-5 | marketplace | 17 | Lower the price of the sailing dinghy to 950. | wrong (said unsure) |  | I couldn't find an item called a sailing dinghy. The closest match is "Rowing boat with oars", but I haven't changed it because it may not be the one you mean. Is that the listing you want set to 950, or is it a different item? |
| claude-sonnet-5-5 | marketplace | 18 | Put up a tent for sale: two-person tent, sports, good condition, 45 €, in Sund. | wrong (said unsure) |  | I can't post the tent yet because a photo is required and I don't have one. Please send at least one photo of the tent. Here is what I'll use for the rest: - **Title:** Two-person tent - **Category:** Sports - **Condition:** Good - **Price: |
| claude-sonnet-5-5 | marketplace | 19 | Take the balance bike off the site. | wrong (said unsure) |  | I couldn't find a balance bike on Torget. I searched for "balance" and checked the kids and bikes categories. The only bikes listed are: - Road bike, 56 cm frame (id 6) - City bike, seven gears (id 4) I haven't deleted anything. Tell me if  |
| claude-sonnet-5-5 | marketplace | 20 | The car roof box is in Jomala, not Mariehamn. | wrong (said unsure) |  | I couldn't find a car roof box in Torget, so I haven't changed anything. Searches for "roof box", "roof", "car" and "box" returned no matching item. Four items are listed in Mariehamn: Turntable, Laptop (13 inch), City bike (seven gears) an |
| cascade:claude-haiku-5-5>claude-sonnet-5-5 | marketplace | 17 | Lower the price of the sailing dinghy to 950. | wrong (said unsure) |  | I couldn't find a sailing dinghy in Torget, so I haven't changed any price. The closest listing is "Rowing boat with oars," which is a different kind of boat. Do you want me to lower that one to 950, or is the dinghy listed under another na |
| cascade:claude-haiku-5-5>claude-sonnet-5-5 | marketplace | 18 | Put up a tent for sale: two-person tent, sports, good condition, 45 €, in Sund. | wrong (said unsure) |  | I couldn't post the tent because the listing needs at least one photo, and I don't have one. Could you send a photo of the tent? Once I have it, I'll post the listing with these details: - Title: Two-person tent - Category: Sports - Conditi |
| cascade:claude-haiku-5-5>claude-sonnet-5-5 | marketplace | 19 | Take the balance bike off the site. | wrong (said unsure) |  | I couldn't find a balance bike on the site, so I haven't removed anything. The only bikes listed are "Road bike, 56 cm frame" and "City bike, seven gears". Neither is a balance bike. If you meant one of those, tell me which and I'll take it |
| cascade:claude-haiku-5-5>claude-sonnet-5-5 | marketplace | 20 | The car roof box is in Jomala, not Mariehamn. | wrong (stated as fact) |  | The search for "car roof box" returned this: "Nothing has every word of "car roof box" in title, description, place. The nearest titles: Three old books, Turntable, Green floor lamp." So no listing matches, and I haven't changed any place.  |
| claude-haiku-5-5 | records | 4 | Which items were added in September 2026? | wrong (shown as not confirmed) | ["Linen tablecloth","Brass ship's lamp","Bentwood chair","Stoneware teapot"] | The count is 4, confirmed by a count measure over September 2026. The dates I listed come straight from the records: the Bentwood chair's addedOn value is "2026-09-18", so the 18 is the day of the month from that date. |
