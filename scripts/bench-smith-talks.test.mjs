import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { cached, openAICompatible } from "../packages/ai/dist/index.js";
import { applyOperations, YamlEditor } from "../packages/core/dist/index.js";
import { budgetGuard, replayOnly, runTalk } from "./bench-smith-talks.mjs";
import { repo } from "./dev-app.mjs";
import { startFakeModel } from "./fake-model.mjs";
import { indexedProject, starterProject } from "./smith-cases.mjs";

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
  const budget = budgetGuard(0.003);
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

test("replay returns the recording and refuses a miss without hitting the provider", async () => {
  const stored = new Map();
  const store = {
    async get(key) {
      return stored.get(key);
    },
    async set(key, value) {
      stored.set(key, value);
    },
  };
  const request = { system: "Fixture", user: "This is recorded", schema: {} };
  let calls = 0;
  const provider = {
    name: "recorded-model",
    async complete() {
      calls++;
      return { text: "{}", model: "recorded-model", inputTokens: 5, outputTokens: 1 };
    },
  };
  await cached(provider, store).complete(request);
  let misses = 0;
  const replay = replayOnly(provider, store, () => misses++);
  assert.equal((await replay.complete(request)).text, "{}");
  await assert.rejects(replay.complete({ ...request, user: "This is absent" }), /not recorded/);
  assert.equal(calls, 1);
  assert.equal(misses, 1);
});

test("the labelled source checks distinguish untouched starters from applied changes", async () => {
  const { conversations } = JSON.parse(
    readFileSync(join(repo, "docs", "benchmarks", "smith-talks.json"), "utf8"),
  );
  assert.equal(new Set(conversations.map(({ id }) => id)).size, 12);
  for (const scenario of conversations) {
    const result = await runTalk(
      { ...scenario, answers: [] },
      {
        project: starterProject(repo, scenario.starter),
        person: async () => ({ action: "done" }),
        providers: [],
        docsIndex: { pages: [], parts: [] },
      },
    );
    assert.equal(result.right, Boolean(scenario.unchanged && !scenario.undo), scenario.id);
  }
});

test("a declared optional date passes the same goal in long and short forms", async () => {
  const project = starterProject(repo, "crm");
  const path = ["models", "Order", "fields", "deliveryDate"];
  const result = applyOperations(project.files, [
    { op: "addField", args: { model: "Order", field: "deliveryDate", type: "date" } },
  ]);
  assert.equal(result.ok, true);
  const editor = new YamlEditor(result.files.spec);
  editor.set(path, { type: "date" });
  for (const spec of [result.files.spec, editor.text]) {
    const talk = await runTalk(
      { id: "delivery", checks: [{ path: ["spec", ...path], optionalFieldType: "date" }] },
      {
        project: indexedProject({ ...result.files, spec }),
        person: async () => ({ action: "done" }),
        providers: [],
        docsIndex: { pages: [], parts: [] },
      },
    );
    assert.equal(talk.right, true);
  }
});
