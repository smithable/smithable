import { expect, test } from "vitest";
import { everyday, wordsAtRisk } from "./at-risk.js";
import type { SpecIR } from "./ir.js";
import { validateSpec } from "./spec.js";

const ir = validateSpec({
  path: "smithable.yml",
  text: `smithable: 0.1
app: { name: Status }
models:
  Component:
    fields:
      name: string!
      status: operational | degraded | down | maintenance
      kind: { type: "api | site | worker", description: What the component is. }
  Post:
    fields:
      title: string!
      body: text
      publishedOn: date
      createdOn: date
      status: { type: "draft | published", description: Published posts are public. }
  Order:
    fields:
      number: string!
      subtotal: money
      total: money
      items: int
pages:
  components: { crud: Component }
  posts: { crud: Post }
  orders: { crud: Order }
`,
}).ir as SpecIR;

test("everyday words among a choice's values", () => {
  expect(everyday(["operational", "degraded", "down", "maintenance"])).toEqual([
    "degraded",
    "down",
  ]);
  expect(everyday(["api", "site", "worker"])).toEqual([]);
  expect(everyday(["inProgress", "onHold", "closedWon"])).toEqual(["onHold", "closedWon"]);
});

test("the fields at risk: loose words, several dates, several amounts; the unexplained first", () => {
  const risks = wordsAtRisk(ir);
  expect(risks.map((r) => `${r.model}.${r.field}${r.explained ? " (explained)" : ""}`)).toEqual([
    "Component.status",
    "Post.publishedOn",
    "Post.createdOn",
    "Order.subtotal",
    "Order.total",
    "Order.items",
    "Post.status (explained)",
  ]);
  expect(risks[0]?.why).toBe(
    '"degraded", "down" are both a value of status and a word a question uses loosely.',
  );
  expect(risks.find((r) => r.field === "publishedOn")?.why).toBe(
    'Post has 2 dates (publishedOn, createdOn): "newest" or "latest" may mean any of them.',
  );
  // An explained field is still named, so the pass asks about it, but it is not at risk.
  expect(risks.find((r) => r.field === "status" && r.model === "Post")?.explained).toBe(true);
  expect(risks.some((r) => r.model === "Component" && r.field === "kind")).toBe(false);
});
