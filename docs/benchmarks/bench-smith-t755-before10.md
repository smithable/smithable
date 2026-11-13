# What people say to Smith: t755-before10

2026-11-13, 10 requests of docs/benchmarks/smith-requests.json (undo and feedback are Studio's rules, not here). Small: claude-haiku-5-5; better: claude-sonnet-5-5; judge: claude-sonnet-5-5. Cost in US dollars at the models' list prices.

| Setup | Kind | Right | Of | By rule | Docs found | Tokens | Cost | Seconds |
|---|---|---|---|---|---|---|---|---|
| small | docs-question | 2 | 5 | 0 | 4 | 118854 | 0.0195 | 18.7 |
| small | spec-question | 4 | 5 | 2 |  | 64238 | 0.0150 | 20.3 |

Wrong ones:

- small q-bk-full (spec-question): failed, No model found a change that applies. claude-haiku-5-5 answered 400: {"type":"error","error":{"type":"invalid_request_error","message":"output_config.format.schema: For 'object' type, 'additionalProperties' must be explicitly set to false"},"request_id":"req_011Cgzn18bwyKQiZgXUikRmB"}
- small d-publish (docs-question): question, docs part not found, question
- small d-mcp (docs-question): answer, The answer mentions "Model Context Protocol" but omits the other required facts: that it provides tools for AI assistants, the "/mcp" endpoint, and that the same key is used. Only one of the four must-have facts is stated.
- small d-ask (docs-question): answer, The answer covers questions about the records ("ask about its records in their own words"), but it omits two required facts. It never describes Ask as a panel in the app, only as "the assistant built into this app". It also never says Ask reads only what the person may read. It says only that it answers "without changing anything", which concerns not modifying data, not read permissions.
