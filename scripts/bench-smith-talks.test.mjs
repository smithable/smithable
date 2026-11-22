import assert from "node:assert/strict";
import { test } from "node:test";
import { openAICompatible } from "../packages/ai/dist/index.js";
import { budgetGuard, runTalk } from "./bench-smith-talks.mjs";
import { repo } from "./dev-app.mjs";
import { startFakeModel } from "./fake-model.mjs";
import { starterProject } from "./smith-cases.mjs";

test("a person reads Smith's answers, applies a real proposal and undoes it", async () => {
  const model = await startFakeModel();
  const provider = openAICompatible({
    model: "fake-model",
    name: "fake-model",
    baseUrl: model.url,
    tier: "local",
    location: "local",
  });
  const request = "One little thing, a mobile number for each customer would help.";
  const actions = [
    { action: "say", text: "Thanks!" },
    { action: "say", text: request },
    { action: "accept" },
    { action: "say", text: "undo" },
    { action: "accept" },
    { action: "done" },
  ];
  try {
    const result = await runTalk(
      { id: "undo", persona: "A new maker", goal: "Try and undo a field.", unchanged: true },
      {
        project: starterProject(repo, "crm"),
        providers: [provider],
        docsIndex: { pages: [], parts: [] },
        async person(view) {
          assert.deepEqual(Object.keys(view).sort(), ["conversation", "goal", "persona"]);
          assert.ok(view.conversation.every((turn) => !("operations" in turn)));
          const next = actions[view.conversation.length];
          assert.ok(next);
          return next;
        },
      },
    );
    assert.equal(result.right, true);
    assert.equal(result.end, "done");
    assert.equal(result.applied, 1);
    assert.equal(result.reworked, 1);
    assert.deepEqual(
      result.transcript.map((turn) => turn.visible.kind),
      ["answer", "change", "applied", "undo", "undone"],
    );
    assert.ok(
      model.requests.some((request) =>
        request.messages.some((message) => message.content.includes("The conversation so far:")),
      ),
    );
  } finally {
    await model.close();
  }
});

test("a budget refusal does not issue a provider request", async () => {
  const budget = budgetGuard(0.001);
  let calls = 0;
  const provider = budget.wrap({
    name: "Metered fixture",
    price: { input: 1, output: 1 },
    async complete(request) {
      calls++;
      assert.equal(request.maxOutputTokens, 20);
      return { inputTokens: 10, outputTokens: 2 };
    },
  });
  await provider.complete({ system: "Small", user: "Hello", maxOutputTokens: 20 });
  assert.equal(calls, 1);
  assert.ok(Math.abs(budget.used - 0.000012) < 1e-12);
  await assert.rejects(provider.complete({ system: "x".repeat(1000) }), /request budget/);
  assert.equal(calls, 1);
  assert.equal(budget.exhausted, true);
});
