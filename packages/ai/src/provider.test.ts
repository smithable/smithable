import { afterEach, expect, test, vi } from "vitest";
import { openAICompatible } from "./provider.js";

afterEach(() => vi.unstubAllGlobals());

test("a rate-limited request waits as long as the server asks, then goes through", async () => {
  const answers = [
    new Response("slow down", { status: 429, headers: { "retry-after": "0.01" } }),
    Response.json({
      model: "m",
      choices: [{ message: { content: '{"kind":"none"}' } }],
      usage: { prompt_tokens: 10, completion_tokens: 2 },
    }),
  ];
  const fetch = vi.fn(async (_url: string, _init?: RequestInit) => answers.shift() as Response);
  vi.stubGlobal("fetch", fetch);
  const provider = openAICompatible({
    name: "hosted",
    baseUrl: "https://example.eu/v1/",
    model: "m",
    apiKey: "key",
    tier: "smithable",
    location: "eu",
  });
  const completion = await provider.complete({ system: "s", user: "u", schema: {} });
  expect(completion).toEqual({
    text: '{"kind":"none"}',
    model: "m",
    inputTokens: 10,
    outputTokens: 2,
  });
  expect(fetch).toHaveBeenCalledTimes(2);
  expect(fetch.mock.calls[0]?.[0]).toBe("https://example.eu/v1/chat/completions");
});
