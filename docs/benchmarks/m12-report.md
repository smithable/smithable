# M12 report: Smithable's AI with real models (2026-09-27)

First runs of `smithable ask` and `smithable new --describe` with a real EU-hosted model: Mistral's API (`mistral-small-latest`, and `mistral-medium-latest` for comparison). Costs are at Mistral's list prices (Small €0.1 / €0.3, Medium €0.4 / €2 per million input / output tokens). No local model has been measured yet.

## Everyday changes: the seven M7 tasks through `smithable ask`

Each task is one `smithable ask "<task>" --yes` on the same app, checked like every other setup (type-check, build, tests, the task's own check, earlier tasks again, drift). Smithable's operations without a model do 7 / 7.

| Run | Model | What changed before the run | Tasks done | Tokens | Cost |
|---|---|---|---|---|---|
| 1 | Small | First version | 3 / 7 | 16,532 | €0.0019 |
| 2 | Small | Instructions: do only what is asked; messages and automation need custom code | 7 / 7 | 16,356 | €0.0018 |
| 3 | Small | The menu check also requires Customers to stay in the menu | 3 / 7 | 16,552 | €0.0018 |
| 4–6 | Small | Host checks (existing rows) join the repair loop; two repairs | 5, 5, 3 / 7 | ≈19,000 | ≈€0.002 |
| 7 | Medium | Same | 4 / 7 | 12,744 | €0.0057 |
| 8–10 | Small | Menus in the context; no "ask when something similar exists" rule | **6, 7, 7 / 7** | ≈21,000 | ≈€0.0023 |

Detailed results of the last run: [m7-M.md](m7-M.md).

### What the runs showed

1. **A model varies between runs even at temperature 0.** One run proves little; the same setup went 7 / 7 and 3 / 7. Measure several runs.
2. **Most failures were missing context, not a weak model.** The context had no menus, so "show Orders first" could only guess the rest of the menu, and dropped Customers. With the menus in the context (one line, also for MCP agents), every run kept it.
3. **Models do more than asked.** Unasked required flags, searches and menu changes were the most common errors. The instructions now forbid them, and what only the project's data can tell (a new required field on a table with rows) goes back to the model for repair instead of failing later.
4. **The safety net held.** No run applied a wrong change without it being visible: invalid proposals were refused by the dry run or the operation pipeline, and descriptions now name what a change removes ("no longer in it: customers"). One benchmark check was too weak to notice a dropped menu entry; it is stricter now.
5. **Small is enough for everyday changes.** Medium was not better here and costs about three times as much.

## First builds: ten descriptions through `smithable new --describe`

| Model | Valid apps | Cost for all ten |
|---|---|---|
| Small (first version) | 1 / 10 | €0.017 |
| Small (reference of every page pattern, three attempts) | 0 / 10 | €0.023 |
| Small (fenced files; repairs see their own draft) | 2 / 10 | €0.023 |
| Medium (same) | **4 / 10** | €0.10 |

Details and every summary: [Small](m12-first-builds-mistral-small-latest.md), [Medium](m12-first-builds-mistral-medium-latest.md).

The remaining errors are mostly one or two per app that repairs do not fix: searching by a related record (`jobPost`), a many-to-many link between two models, an `owner` field declared by hand, a YAML colon in a description. Two of these are features worth adding to the spec (search by a related record's name, `NOW()`), and the rest point to drafting **as a batch of operations** (ARCHITECTURE §9.8) rather than whole YAML files: each operation is small, validated on its own and repaired in place.

## Next

- Draft first builds as operations, and add search by a related record.
- Measure a local model (Ollama) and a frontier model the same way; choose the default for first builds from the results.
