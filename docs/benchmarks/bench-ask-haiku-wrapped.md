# bench-ask: haiku-wrapped (2026-10-27)

The questions of [bench-ask-questions.mjs](../../scripts/bench-ask-questions.mjs), asked of each starter's assistant tools at `/mcp` with an administrator's key ([bench-ask.mjs](../../scripts/bench-ask.mjs)), by each model: it calls tools until it answers (at most 8 model calls). A read is right when its answer gives the number, names, words or pairs worked out from the records; a change is right when the records afterwards say so. Each change starts from the starter's records.

Correctness is judged on the answer's facts against the records (a count, a name or id found, a record changed), never on the tool calls: a confident answer that is wrong counts as wrong. "Stated as fact" is a wrong answer given as true, such as a total, a name or "there is no such invoice", rather than one saying the model could not tell; it is the kind a person would act on. "Right when every tool call was valid" counts the questions whose tool calls all succeeded, and how many of them were answered right: valid calls are not a right answer.

| Model | Right | Wrong | Of them, stated as fact | Of them, a count or sum the model worked out | Right when every tool call was valid | Gave up or failed | Model calls per question | Reads in one or two calls | Tokens in / out per question | Tool results per question (tokens) | Cost per question | Time |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| claude-haiku-5-5 | 125 / 134 (93 %) | 9 | 5 | 0 | 118 / 125 | 0 | 2.4 | 85 / 99 | 5,733 / 276 | 68 | $0.0003 | 4.7 s |
| claude-sonnet-5-5 | 129 / 134 (96 %) | 5 | 1 | 0 | 129 / 133 | 0 | 2.6 | 74 / 99 | 6,358 / 273 | 87 | $0.0058 | 6.0 s |
| cascade:claude-haiku-5-5>claude-sonnet-5-5 | 126 / 134 (94 %) | 8 | 5 | 0 | 120 / 127 | 0 | 2.6 | 80 / 99 | 6,311 / 323 | 71 | $0.0011 | 4.7 s |
| wrap:alone:claude-haiku-5-5 | 129 / 134 (96 %) | 5 | 1 | 0 | 124 / 128 | 0 | 2.4 | 85 / 99 | 5,643 / 259 | 71 | $0.0003 | 7.3 s |
| wrap:critique:claude-haiku-5-5 | 128 / 134 (96 %) | 6 | 2 | 0 | 120 / 125 | 0 | 4.4 | 0 / 99 | 10,775 / 639 | 147 | $0.0006 | 14.7 s |
| wrap:vote3:claude-haiku-5-5 | 127 / 134 (95 %) | 7 | 3 | 0 | 120 / 126 | 0 | 5.5 | 0 / 99 | 12,836 / 583 | 139 | $0.0005 | 12.0 s |

**cascade:claude-haiku-5-5>claude-sonnet-5-5** moved 14 of 134 questions to the better model (2 after two refused tool calls, 7 at the fourth call, 1 after an answer that gave up, 4 after an answer the check sent back twice); 10 of them were then right. Of the 120 that stayed on the cheap model, 116 were right.

**claude-haiku-5-5**, the app's answer check (ask-checks.md §3): 5 of 134 answers went back to the model; 5 of them came back grounded (3 right). 0 were shown as not confirmed: 0 wrong and 0 right. A wrong answer shown as not confirmed is not counted as stated as fact.

**claude-sonnet-5-5**, the app's answer check (ask-checks.md §3): 9 of 134 answers went back to the model; 8 of them came back grounded (6 right). 1 were shown as not confirmed: 0 wrong and 1 right. A wrong answer shown as not confirmed is not counted as stated as fact.

**cascade:claude-haiku-5-5>claude-sonnet-5-5**, the app's answer check (ask-checks.md §3): 16 of 134 answers went back to the model; 14 of them came back grounded (10 right). 2 were shown as not confirmed: 0 wrong and 2 right. A wrong answer shown as not confirmed is not counted as stated as fact.

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

| Starter | claude-haiku-5-5 | claude-sonnet-5-5 | cascade:claude-haiku-5-5>claude-sonnet-5-5 | wrap:alone:claude-haiku-5-5 | wrap:critique:claude-haiku-5-5 | wrap:vote3:claude-haiku-5-5 |
|---|---|---|---|---|---|---|
| crm | 25 / 25 | 25 / 25 | 25 / 25 | 25 / 25 | 25 / 25 | 25 / 25 |
| invoicing | 25 / 25 | 25 / 25 | 25 / 25 | 25 / 25 | 25 / 25 | 25 / 25 |
| status | 21 / 25 | 24 / 25 | 22 / 25 | 24 / 25 | 23 / 25 | 23 / 25 |
| booking | 23 / 24 | 24 / 24 | 23 / 24 | 24 / 24 | 24 / 24 | 23 / 24 |
| marketplace | 16 / 20 | 16 / 20 | 16 / 20 | 16 / 20 | 16 / 20 | 16 / 20 |
| records | 15 / 15 | 15 / 15 | 15 / 15 | 15 / 15 | 15 / 15 | 15 / 15 |

## Not right

| Model | Starter | # | Question | Outcome | Expected | Answer |
|---|---|---|---|---|---|---|
| claude-haiku-5-5 | status | 1 | Is anything down right now? | wrong (stated as fact) | ["Payments"] | No. None of your components is marked down right now. |
| claude-haiku-5-5 | status | 5 | How long was the website down, in minutes? | wrong (said unsure) | 21 | I can't give a duration in minutes from the tool results. The incident has no duration field, and measure can't subtract one date from another. Here is what the tools returned for incident #1, "Website unreachable for twenty minutes": - det |
| claude-haiku-5-5 | status | 7 | What was our last update on the card payments problem? | wrong (stated as fact) | ["Payments confirm in seconds again"] | Our last update on "Card payments slow at checkout" (October 1, 2026, 14:10) was: "We are looking into slow card payments at checkout." Its status was investigating. The incident is now in monitoring and has not been resolved. I found no la |
| claude-haiku-5-5 | status | 22 | Report a new incident: logging in to the mobile app fails, we're investigating. | wrong (stated as fact) |  | I've reported the incident "Logging in to the mobile app fails" (ID 6) with status "investigating." I set the detected time to 2026-10-27 00:00, since you didn't give one. It has no component or summary yet. Tell me if you want either added |
| claude-sonnet-5-5 | status | 5 | How long was the website down, in minutes? | wrong (said unsure) | 21 | No tool returned a duration, and the app has no duration field for incidents, so I can't give you a minute count I got from a tool. Here is what the records say: - **Incident record:** detected 2026-09-24 08:40, resolved 2026-09-24 09:01. - |
| cascade:claude-haiku-5-5>claude-sonnet-5-5 | status | 1 | Is anything down right now? | wrong (stated as fact) | ["Payments"] | No, nothing is down right now. No components are marked as down. |
| cascade:claude-haiku-5-5>claude-sonnet-5-5 | status | 5 | How long was the website down, in minutes? | wrong (said unsure) | 21 | The tools don't return a duration in minutes, so I can't give you a figure that came from one. Here is what they did return. There is one website incident (the count of incidents on the Website component is 1). It is id 1, "Website unreacha |
| cascade:claude-haiku-5-5>claude-sonnet-5-5 | status | 22 | Report a new incident: logging in to the mobile app fails, we're investigating. | wrong (stated as fact) |  | The find result confirms that incident 6 has no component linked (the component field is empty). That also matched the add response, which returned component as null. The detection time is stored as 2026-10-26 22:00 UTC, which is the 2026-1 |
| claude-haiku-5-5 | booking | 9 | What is our newest post? | wrong (stated as fact) | ["Morning classes are back"] | Your newest post is "Summer sessions by the sea," published on 2026-08-31. |
| claude-haiku-5-5 | booking | 17 | Which teachers have a portrait? | skipped (pictures are not in the API) |  |  |
| claude-sonnet-5-5 | booking | 17 | Which teachers have a portrait? | skipped (pictures are not in the API) |  |  |
| cascade:claude-haiku-5-5>claude-sonnet-5-5 | booking | 9 | What is our newest post? | wrong (stated as fact) | ["Morning classes are back"] | Our newest post is "Summer sessions by the sea," published on 2026-08-31. |
| cascade:claude-haiku-5-5>claude-sonnet-5-5 | booking | 17 | Which teachers have a portrait? | skipped (pictures are not in the API) |  |  |
| claude-haiku-5-5 | marketplace | 17 | Lower the price of the sailing dinghy to 950. | wrong (said unsure) |  | I couldn't find a sailing dinghy in Torget. Searches for "sailing dinghy", "dinghy" and "sailing" returned no matching items. The closest listing is **"Rowing boat with oars."** Is that the one you mean? If so, I'll lower its price to 950.  |
| claude-haiku-5-5 | marketplace | 18 | Put up a tent for sale: two-person tent, sports, good condition, 45 €, in Sund. | wrong (said unsure) |  | I couldn't post the tent. The app refused it with "Some values are not valid," and it doesn't say which value is wrong. The likely cause is that **photos** is required and I have no photo to attach. I can't upload images from here. If you s |
| claude-haiku-5-5 | marketplace | 19 | Take the balance bike off the site. | wrong (said unsure) |  | I couldn't find a balance bike on the site. The only bike listings are: - **Road bike, 56 cm frame** (id 6) - **City bike, seven gears** (id 4) Did you mean one of these? Or is the balance bike listed under a different name? I haven't delet |
| claude-haiku-5-5 | marketplace | 20 | The car roof box is in Jomala, not Mariehamn. | wrong (stated as fact) |  | The app returned this: "Nothing has every word of "car roof box" in title, description, place. The nearest titles: Three old books, Turntable, Green floor lamp." I haven't changed anything. Which item should I move to Jomala? |
| claude-sonnet-5-5 | marketplace | 17 | Lower the price of the sailing dinghy to 950. | wrong (said unsure) |  | I couldn't find a listing for a sailing dinghy, so I haven't changed any prices. The closest match is "Rowing boat with oars", but that's a different item. Should I lower that one to 950, or did you mean another listing? |
| claude-sonnet-5-5 | marketplace | 18 | Put up a tent for sale: two-person tent, sports, good condition, 45 €, in Sund. | wrong (said unsure) |  | I couldn't post the tent because the listing needs at least one photo, and I don't have one. Could you send a photo of the tent? I'll add the listing as soon as I have it. Here is what I have so far: - Title: Two-person tent - Category: Spo |
| claude-sonnet-5-5 | marketplace | 19 | Take the balance bike off the site. | wrong (said unsure) |  | I couldn't find a balance bike on the site. I searched for "balance bike" and "balance", then checked the bikes and kids categories. The only bikes listed are: - Road bike, 56 cm frame (id 6) - City bike, seven gears (id 4) I haven't delete |
| claude-sonnet-5-5 | marketplace | 20 | The car roof box is in Jomala, not Mariehamn. | wrong (stated as fact) |  | The search for "roof box" returned this: "Nothing has every word of "roof box" in title, description, place. The nearest titles: Road bike, 56 cm frame, City bike, seven gears, Rowing boat with oars." So there is no roof box listing to move |
| cascade:claude-haiku-5-5>claude-sonnet-5-5 | marketplace | 17 | Lower the price of the sailing dinghy to 950. | wrong (stated as fact) |  | Here is what the tool returned for "sailing dinghy": "Nothing has every word of "sailing dinghy" in title, description, place. The nearest titles: Laptop, 13 inch, Rowing boat with oars, Table with four chairs." That means no listing is cal |
| cascade:claude-haiku-5-5>claude-sonnet-5-5 | marketplace | 18 | Put up a tent for sale: two-person tent, sports, good condition, 45 €, in Sund. | wrong (said unsure) |  | I couldn't post the tent yet. A photo is required for every listing, and I don't have one. Can you send one? The rest is ready: - Title: Two-person tent - Category: Sports - Condition: Good - Price: 45 € - Place: Sund I wrote the descriptio |
| cascade:claude-haiku-5-5>claude-sonnet-5-5 | marketplace | 19 | Take the balance bike off the site. | wrong (said unsure) |  | I couldn't find a balance bike on the site. The only bikes listed are: 1. **Road bike, 56 cm frame** (id 6) 2. **City bike, seven gears** (id 4) Did you mean one of these, or is the balance bike listed under another name? I haven't removed  |
| cascade:claude-haiku-5-5>claude-sonnet-5-5 | marketplace | 20 | The car roof box is in Jomala, not Mariehamn. | wrong (stated as fact) |  | The search for "car roof box" returned this: "Nothing has every word of "car roof box" in title, description, place. The nearest titles: Three old books, Turntable, Green floor lamp." So no item matches, and I haven't changed anything. Sear |
| wrap:alone:claude-haiku-5-5 | status | 22 | Report a new incident: logging in to the mobile app fails, we're investigating. | wrong (stated as fact) |  | I've logged the incident "Logging in to the mobile app fails" (ID 6) with status investigating. It has no component linked and no summary yet. Detected time is set to today, 2026-10-27 00:00 in your local time. |
| wrap:critique:claude-haiku-5-5 | status | 1 | Is anything down right now? | wrong (stated as fact) | ["Payments"] | No components are currently marked as down. |
| wrap:critique:claude-haiku-5-5 | status | 22 | Report a new incident: logging in to the mobile app fails, we're investigating. | wrong (stated as fact) |  | I've logged the incident "Logging in to the mobile app fails" (ID 6) with status investigating. Its detected time is stored as 2026-10-26 22:00 UTC. It isn't linked to a component yet, although a "Mobile app" component exists (ID 3, current |
| wrap:vote3:claude-haiku-5-5 | status | 1 | Is anything down right now? | wrong (stated as fact) | ["Payments"] | No components are marked down right now. I checked the status of every component with "down" status and found none. |
| wrap:vote3:claude-haiku-5-5 | status | 22 | Report a new incident: logging in to the mobile app fails, we're investigating. | wrong (stated as fact) |  | I've reported the incident "Logging in to the mobile app fails" (ID 6). Its status is investigating, and it's detected as of today, 2026-10-27. It has no component or summary yet. |
| wrap:alone:claude-haiku-5-5 | booking | 17 | Which teachers have a portrait? | skipped (pictures are not in the API) |  |  |
| wrap:critique:claude-haiku-5-5 | booking | 17 | Which teachers have a portrait? | skipped (pictures are not in the API) |  |  |
| wrap:vote3:claude-haiku-5-5 | booking | 17 | Which teachers have a portrait? | skipped (pictures are not in the API) |  |  |
| wrap:vote3:claude-haiku-5-5 | booking | 9 | What is our newest post? | wrong (stated as fact) | ["Morning classes are back"] | Your newest post is "Summer sessions by the sea," published on 2026-08-31. |
| wrap:alone:claude-haiku-5-5 | marketplace | 17 | Lower the price of the sailing dinghy to 950. | wrong (said unsure) |  | I couldn't find a sailing dinghy in Torget. The closest listing is "Rowing boat with oars." Do you want me to lower the price of that one to 950 instead? |
| wrap:alone:claude-haiku-5-5 | marketplace | 18 | Put up a tent for sale: two-person tent, sports, good condition, 45 €, in Sund. | wrong (said unsure) |  | I couldn't create the listing. The app says some values are not valid, and it still refused when I sent only the title, description, category and condition. The likely cause is the required **photos** field, which I have no way to fill in.  |
| wrap:alone:claude-haiku-5-5 | marketplace | 19 | Take the balance bike off the site. | wrong (said unsure) |  | I couldn't find a balance bike on the site. The only bikes listed are: 1. **Road bike, 56 cm frame** (id 6) 2. **City bike, seven gears** (id 4) Did you mean one of these? If so, tell me which one and I'll delete it. If the balance bike was |
| wrap:alone:claude-haiku-5-5 | marketplace | 20 | The car roof box is in Jomala, not Mariehamn. | wrong (said unsure) |  | I couldn't find a car roof box in Torget. I searched for "car roof box", "roof" and "box", and none of the 12 items matches. The closest titles were Road bike, Rowing boat, and Wooden pull-along toys. None of the items is listed in Marieham |
| wrap:critique:claude-haiku-5-5 | marketplace | 17 | Lower the price of the sailing dinghy to 950. | wrong (said unsure) |  | I couldn't find a sailing dinghy in Torget, so I haven't changed any price. The search for "sailing dinghy" matched nothing. The nearest titles are Laptop, 13 inch, Rowing boat with oars, and Table with four chairs. The only boat listed is  |
| wrap:critique:claude-haiku-5-5 | marketplace | 18 | Put up a tent for sale: two-person tent, sports, good condition, 45 €, in Sund. | wrong (said unsure) |  | I couldn't add the tent listing. Torget rejected it with only "Some values are not valid," and I tried it again with the price written two ways, with the same result. The app doesn't say which value is wrong. The likely cause is the photos  |
| wrap:critique:claude-haiku-5-5 | marketplace | 19 | Take the balance bike off the site. | wrong (said unsure) |  | I couldn't find a balance bike on the site, so I haven't removed anything. A search for "balance" matches no items, and a search for "bike" returns two: 1. **Road bike, 56 cm frame** (bikes, available) 2. **City bike, seven gears** (bikes,  |
| wrap:critique:claude-haiku-5-5 | marketplace | 20 | The car roof box is in Jomala, not Mariehamn. | wrong (said unsure) |  | I couldn't find a car roof box in Torget. Searching for "roof box" in titles, descriptions and places returned nothing. The closest titles were Road bike, 56 cm frame; City bike, seven gears; and Rowing boat with oars. I checked all 12 item |
| wrap:vote3:claude-haiku-5-5 | marketplace | 17 | Lower the price of the sailing dinghy to 950. | wrong (said unsure) |  | I couldn't find a sailing dinghy in Torget. The closest listing is "Rowing boat with oars," but I haven't changed it because it may not be the one you mean. Do you want me to lower the price of the rowing boat to 950, or is the dinghy liste |
| wrap:vote3:claude-haiku-5-5 | marketplace | 18 | Put up a tent for sale: two-person tent, sports, good condition, 45 €, in Sund. | wrong (said unsure) |  | I couldn't post the tent. The app refused the listing with "Some values are not valid," and it doesn't say which value is wrong. The item form requires photos, and I have no way to upload one here. I tried three versions of the price and it |
| wrap:vote3:claude-haiku-5-5 | marketplace | 19 | Take the balance bike off the site. | wrong (said unsure) |  | I couldn't find a balance bike on the site, so I haven't removed anything. The only bike listings are: - **Road bike, 56 cm frame** (bikes, available) - **City bike, seven gears** (bikes, available) Did you mean one of these, or is the bala |
| wrap:vote3:claude-haiku-5-5 | marketplace | 20 | The car roof box is in Jomala, not Mariehamn. | wrong (said unsure) |  | I can't find a car roof box in Torget, so I haven't changed anything. I searched titles, descriptions and places, and I also checked all 12 items. The closest matches were Road bike, City bike, Rowing boat and Wooden pull-along toys, and no |
