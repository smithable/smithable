import { expect, test } from "vitest";
import { completeDraftJson, repairDraftJson } from "./draft-json.js";
import {
  type CompletionRequest,
  CutOffAnswerError,
  cached,
  type Provider,
  type Usage,
} from "./provider.js";

test.each([
  ['{"items":[{"name":"one"} {"name":"two"}]}', { items: [{ name: "one" }, { name: "two" }] }],
  ['{"items":[{"name":"one"}}, {"name":"two"}]}', { items: [{ name: "one" }, { name: "two" }] }],
  ['{"items":[{"name":"one"}}', { items: [{ name: "one" }] }],
  ['{"items":[1]]}', { items: [1] }],
  ['{"items":[{"name":"one"}}}]}', { items: [{ name: "one" }] }],
  ['{"items":[{"name":"one"}}}}, {"name":"two"}]}', { items: [{ name: "one" }, { name: "two" }] }],
])("repairs separator punctuation in %s", (text, expected) => {
  const repaired = repairDraftJson(text);
  expect(repaired).toBeDefined();
  expect(JSON.parse(repaired as string)).toEqual(expected);
});

test.each([
  '{"items":[1,',
  '{"text":"cut off',
  '{"value":tru}',
  '{"number":1.}',
  '{"text":"one "two""}',
  '["width "100" px"]',
  '["say "null" here"]',
  '["say "true" here"]',
  '["say "false" here"]',
  "[1 2]",
  `{"items":[1${"}".repeat(10)}]}`,
])("leaves truncated, non-separator or excessive faults for retry: %s", (text) => {
  expect(repairDraftJson(text)).toBeUndefined();
});

test("preserves literal strings and valid documents exactly", () => {
  const literal = JSON.stringify('brackets }] comma, quote" and slash\\');
  const text = `{"items":[{"text":${literal}} {"text":${literal}}]}`;
  expect(repairDraftJson(text)).toBe(`{"items":[{"text":${literal}} ,{"text":${literal}}]}`);
  const valid = '{ "items": [1, 2] }';
  expect(repairDraftJson(valid)).toBe(valid);
});

const request: CompletionRequest = { system: "Return JSON", user: "Make an app", schema: {} };
function fake(answers: (string | Error)[], model = "claude-haiku-5-5") {
  const calls: CompletionRequest[] = [];
  const provider: Provider = {
    name: "test",
    tier: "frontier",
    location: "elsewhere",
    model,
    price: { input: 1, output: 2 },
    async complete(request) {
      calls.push({ ...request });
      const answer = answers[calls.length - 1];
      if (answer instanceof Error) throw answer;
      if (answer === undefined) throw new Error("Unexpected extra request");
      return { text: answer, model, inputTokens: 10, outputTokens: 20 };
    },
  };
  return { provider, calls };
}

test("a local punctuation repair uses one call and retains its usage", async () => {
  const { provider, calls } = fake(['{"items":[{} {}]}']);
  const usage: Usage[] = [];
  expect(await completeDraftJson(provider, request, usage)).toEqual({ items: [{}, {}] });
  expect(calls).toHaveLength(1);
  expect(calls[0]?.maxOutputTokens).toBe(32000);
  expect(usage).toHaveLength(1);
  expect(usage[0]).toMatchObject({ inputTokens: 10, outputTokens: 20 });
});

test("one fresh retry names the parse error, bypasses the malformed cache entry and retains both usages", async () => {
  const { provider, calls } = fake(['{"items":[', '{"items":[]}']);
  const entries = new Map<string, string>();
  const wrapped = cached(provider, {
    get: async (key) => entries.get(key),
    set: async (key, value) => void entries.set(key, value),
  });
  const usage: Usage[] = [];
  expect(await completeDraftJson(wrapped, request, usage)).toEqual({ items: [] });
  expect(calls).toHaveLength(2);
  expect(calls[1]?.repair).toBe(true);
  expect(calls[1]?.user).toContain("Unexpected end of JSON input");
  expect(calls[1]?.user).not.toBe(calls[0]?.user);
  expect(usage.map((entry) => entry.outputTokens)).toEqual([20, 20]);
  expect(entries.size).toBe(2);
});

test("a second malformed answer fails without a third request", async () => {
  const { provider, calls } = fake(['{"items":[', '{"items":[']);
  const usage: Usage[] = [];
  await expect(completeDraftJson(provider, request, usage)).rejects.toThrow(/JSON/);
  expect(calls).toHaveLength(2);
  expect(usage).toHaveLength(2);
});

test("a cut-off answer gets one concise retry; unrelated provider failures do not", async () => {
  const truncated = fake([
    new CutOffAnswerError({
      text: '{"items":[',
      model: "claude-haiku-5-5",
      inputTokens: 10,
      outputTokens: 32000,
    }),
    '{"items":[]}',
  ]);
  const usage: Usage[] = [];
  expect(await completeDraftJson(truncated.provider, request, usage)).toEqual({ items: [] });
  expect(usage.map((entry) => entry.outputTokens)).toEqual([32000, 20]);
  expect(truncated.calls).toHaveLength(2);
  expect(truncated.calls[1]?.user).toContain("cut off");
  const refused = fake([new Error("The provider refused this request")]);
  await expect(completeDraftJson(refused.provider, request, [])).rejects.toThrow(/refused/);
  expect(refused.calls).toHaveLength(1);
});

test("the higher small-model allowance leaves other models and explicit larger limits alone", async () => {
  const other = fake(["{}"], "some-local-model");
  await completeDraftJson(other.provider, request, []);
  expect(other.calls[0]?.maxOutputTokens).toBeUndefined();
  const small = fake(["{}"], "eu.anthropic.claude-haiku-5-5-v1:0");
  await completeDraftJson(small.provider, { ...request, maxOutputTokens: 48000 }, []);
  expect(small.calls[0]?.maxOutputTokens).toBe(48000);
});

test("output allowances use separate cache entries", async () => {
  const { provider, calls } = fake(["{}", "{}"]);
  const entries = new Map<string, string>();
  const wrapped = cached(provider, {
    get: async (key) => entries.get(key),
    set: async (key, value) => void entries.set(key, value),
  });
  await wrapped.complete(request);
  await wrapped.complete({ ...request, maxOutputTokens: 32000 });
  await wrapped.complete(request);
  expect(calls).toHaveLength(2);
});
