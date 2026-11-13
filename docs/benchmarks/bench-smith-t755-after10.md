# What people say to Smith: t755-after10

2026-11-13, 10 requests of docs/benchmarks/smith-requests.json (undo and feedback are Studio's rules, not here). Small: claude-haiku-5-5; better: claude-sonnet-5-5; judge: claude-sonnet-5-5. Cost in US dollars at the models' list prices.

| Setup | Kind | Right | Of | By rule | Docs found | Tokens | Cost | Seconds |
|---|---|---|---|---|---|---|---|---|
| small | docs-question | 3 | 5 | 0 | 4 | 15517 | 0.0105 | 20.7 |
| small | spec-question | 5 | 5 | 2 |  | 14089 | 0.0118 | 19.8 |

Wrong ones:

- small d-publish (docs-question): answer, docs part not found, The answer does not state any of the required facts. It says nothing about "Publish and share", publishing live, or a sandbox needing an invite to publish. It only describes setting a blog post's status from draft to published and says it lacks the Smithable docs on publishing the app. No mustNot items exist, but every must item is missing.
- small d-mcp (docs-question): answer, The answer states "Model Context Protocol", that AI assistants use the app's operations as tools, and the /mcp endpoint. However, it never says the same key is used. It only says the app connects through /mcp "with a key", which does not convey that the same key is reused. That required fact is missing.
