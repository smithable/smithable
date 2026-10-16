import { afterEach, expect, test, vi } from "vitest";
import { cached, completeJson, listPrice, openAICompatible, type Usage } from "./provider.js";

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

test("a known model without a price of its own costs its list price, in dollars", async () => {
  vi.stubGlobal("fetch", async () =>
    Response.json({
      model: "mistral-medium-2604",
      choices: [{ message: { content: "{}" } }],
      usage: { prompt_tokens: 1_000_000, completion_tokens: 100_000 },
    }),
  );
  const mistral = openAICompatible({
    name: "smithable",
    baseUrl: "https://api.example/v1",
    model: "mistral-medium-latest",
    tier: "smithable",
    location: "eu",
  });
  const usage: Usage[] = [];
  await completeJson(mistral, { system: "s", user: "u", schema: {} }, usage);
  expect(usage[0]).toMatchObject({ cost: 1.5 + 0.75, currency: "USD" });
  expect(listPrice("a-model-nobody-knows")).toBeUndefined();
});

test("a response cache answers a request it has seen, for nothing", async () => {
  let calls = 0;
  vi.stubGlobal("fetch", async () => {
    calls++;
    return Response.json({
      model: "m",
      choices: [{ message: { content: '{"n":1}' } }],
      usage: { prompt_tokens: 10, completion_tokens: 2 },
    });
  });
  const kept = new Map<string, string>();
  const store = {
    get: async (key: string) => kept.get(key),
    set: async (key: string, value: string) => void kept.set(key, value),
  };
  const provider = cached(
    openAICompatible({
      name: "x",
      baseUrl: "http://x/v1",
      model: "m",
      tier: "local",
      location: "local",
    }),
    store,
  );
  const usage: Usage[] = [];
  const ask = (user: string) => completeJson(provider, { system: "s", user, schema: {} }, usage);
  expect(await ask("one")).toEqual({ n: 1 });
  expect(await ask("one")).toEqual({ n: 1 });
  await ask("two");
  expect(calls).toBe(2);
  expect(usage.map((u) => [u.cached ?? false, u.inputTokens])).toEqual([
    [false, 10],
    [true, 0],
    [false, 10],
  ]);
});

test("a server that takes only its default temperature is asked again without one, and from then on", async () => {
  const bodies: Record<string, unknown>[] = [];
  vi.stubGlobal("fetch", async (_url: string, init: RequestInit) => {
    const body = JSON.parse(String(init.body)) as Record<string, unknown>;
    bodies.push(body);
    if ("temperature" in body)
      return Response.json(
        {
          error: {
            message: "Unsupported value: 'temperature' does not support 0 with this model.",
          },
        },
        { status: 400 },
      );
    return Response.json({ model: "m", choices: [{ message: { content: "{}" } }], usage: {} });
  });
  const provider = openAICompatible({
    name: "x",
    baseUrl: "http://x/v1",
    model: "m",
    tier: "frontier",
    location: "elsewhere",
  });
  await completeJson(provider, { system: "s", user: "u", schema: {} }, []);
  await completeJson(provider, { system: "s", user: "v", schema: {} }, []);
  expect(bodies.map((b) => "temperature" in b)).toEqual([true, false, false]);
});

test("a prompt over 100k tokens is never sent: the model charges more above it", async () => {
  const complete = vi.fn();
  const provider = {
    name: "p",
    tier: "frontier",
    location: "eu",
    model: "m",
    price: { input: 0, output: 0 },
    complete,
  } as never;
  const usage: Usage[] = [];
  await expect(
    completeJson(provider, { system: "s", user: "x".repeat(300_001), schema: {} }, usage),
  ).rejects.toThrow(/too large/);
  expect(complete).not.toHaveBeenCalled();
  expect(usage).toEqual([]);
});
