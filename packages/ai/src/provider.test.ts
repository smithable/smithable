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

test("a server that refuses the strict schema gets the simpler one, and keeps getting it", async () => {
  const bodies: string[] = [];
  const fetch = vi.fn(async (_url: string, init?: RequestInit) => {
    const body = String(init?.body);
    bodies.push(body);
    if (body.includes('"anyOf"'))
      return new Response('{"error":"unsupported schema"}', { status: 400 });
    return Response.json({
      model: "m",
      choices: [{ message: { content: '{"kind":"none"}' } }],
      usage: {},
    });
  });
  vi.stubGlobal("fetch", fetch);
  const provider = openAICompatible({
    name: "hosted",
    baseUrl: "https://example.eu/v1",
    model: "m",
    tier: "smithable",
    location: "eu",
  });
  const strict = { anyOf: [{ type: "object" }] };
  const loose = { type: "object" };
  expect(
    (await provider.complete({ system: "s", user: "u", schema: strict, fallbackSchema: loose }))
      .text,
  ).toBe('{"kind":"none"}');
  expect(bodies).toHaveLength(2);
  await provider.complete({ system: "s", user: "u", schema: strict, fallbackSchema: loose });
  // The second call goes straight to the simpler schema.
  expect(bodies).toHaveLength(3);
  expect(bodies[2]).not.toContain('"anyOf"');
});
