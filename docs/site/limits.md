# Limits

These are the limits of Smithable's private beta on smithable.ai. They keep the service fair and its costs known while it is small; a later upgrade will give you more. When an app or an account reaches one, Smithable says so where it happens, such as a refused upload. **Your apps** shows what you have used of the AI allowance and of the month's mail, and your account page lists these limits. At 80 % of an app's storage or of its traffic, its owner gets a mail, at most once a month for each.

An app you run yourself has none of these: it has what your machine gives it ([self-hosting](self-host.md)), and its AI is the model you set up ([AI setup](../ai.md)).

## Per account

| | Limit |
|---|---|
| Apps | 10, each with a live and a staging copy |
| AI allowance | €2 a month, for every model together: first builds and changes made with AI |
| Mail | 1,000 recipients a month, across your apps |

The service also has its own caps on what it spends with each AI provider in a month. They are safety caps for the whole service, shared by everyone, not an amount any account has: your account's AI is the €2 above. When the AI allowance is used up, first builds and changes in your own words wait for the next month; changes made through forms, in the code, or in words the built-in rules understand without a model still work.

## Per app

Each published app runs with these, and so does its staging copy, separately:

| | Limit |
|---|---|
| Memory | 384 MB |
| CPU | half a core |
| Storage | 2 GB, its uploaded files included |
| Mail sent | 100 recipients a day, at most 10 a message, within the account's month |
| Web calls out | 1,000 a day |
| Traffic | 20 GB a month in all, requests and answers together |
| When idle | sleeps after an hour without visits, and wakes on the next one in a few seconds |

Past its storage, an app takes no new files; at a quarter more (2.5 GB, as its database grows), it takes no changes either, though its pages still show. Mail pauses for an address that keeps bouncing.

## While you change an app

Each app's workspace behind Studio has 4 GB of storage and sleeps after half an hour without use; it wakes when you open the app again.

## The free sandbox

A sandbox started without signing up lasts two hours, and five can run at once across all visitors; when they are all taken, the start page says to try again in a few minutes.
