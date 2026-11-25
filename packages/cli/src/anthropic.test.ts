import { afterEach, expect, test, vi } from "vitest";
import { anthropic } from "./anthropic.js";
import { aiProviders } from "./ask.js";

afterEach(() => vi.unstubAllGlobals());

test("a request is a Messages call with the schema as structured output and the system text cached", async () => {
  const sent: { url: string; headers: Record<string, string>; body: Record<string, unknown> }[] =
    [];
  vi.stubGlobal(
    "fetch",
    async (url: string, init: { headers: Record<string, string>; body: string }) => {
      sent.push({ url, headers: init.headers, body: JSON.parse(init.body) });
      return new Response(
        JSON.stringify({
          content: [{ type: "text", text: '{"kind":"answer","text":"Yes."}' }],
          stop_reason: "end_turn",
          usage: {
            input_tokens: 100,
            output_tokens: 20,
            cache_read_input_tokens: 1000,
            cache_creation_input_tokens: 0,
          },
        }),
        { status: 200 },
      );
    },
  );
  const provider = anthropic("claude-haiku-5-5", "test-key");
  const answer = await provider.complete({
    system: "You change a Smithable app.",
    user: "Who can delete orders?",
    schema: { type: "object" },
  } as never);
  expect(answer.text).toBe('{"kind":"answer","text":"Yes."}');
  expect(answer.inputTokens).toBe(1100);
  // 100 fresh at $0.10, 1,000 read at $0.01 and 20 out at $0.50, per million.
  expect(answer.cost?.amount).toBeCloseTo((100 * 0.1 + 1000 * 0.01 + 20 * 0.5) / 1e6, 12);
  const [call] = sent;
  expect(call?.headers["x-api-key"]).toBe("test-key");
  expect(call?.body.output_config).toEqual({
    format: { type: "json_schema", schema: { type: "object" } },
  });
  expect(call?.body.system).toEqual([
    { type: "text", text: "You change a Smithable app.", cache_control: { type: "ephemeral" } },
  ]);
  expect(call?.body.max_tokens).toBe(16000);
});

test("a draft can request a larger output allowance", async () => {
  let maxTokens: unknown;
  vi.stubGlobal("fetch", async (_url: string, init: RequestInit) => {
    maxTokens = JSON.parse(String(init.body)).max_tokens;
    return Response.json({
      content: [{ type: "text", text: "{}" }],
      stop_reason: "end_turn",
      usage: { input_tokens: 1, output_tokens: 1 },
    });
  });
  await anthropic("claude-haiku-5-5", "test-key").complete({
    system: "Return JSON",
    user: "A draft",
    schema: {},
    maxOutputTokens: 32000,
  });
  expect(maxTokens).toBe(32000);
});

test("several models are tried cheapest first, each its own provider; without a key, none", () => {
  const env = {
    SMITHABLE_FRONTIER: "anthropic",
    SMITHABLE_FRONTIER_MODEL: "claude-haiku-5-5, claude-sonnet-5-5",
    ANTHROPIC_API_KEY: "k",
  };
  expect(aiProviders(env).map((p) => p.model)).toEqual(["claude-haiku-5-5", "claude-sonnet-5-5"]);
  expect(aiProviders({ ...env, ANTHROPIC_API_KEY: "" })).toEqual([]);
});

test("a refusal or an error status is an error, not an empty answer", async () => {
  vi.stubGlobal(
    "fetch",
    async () =>
      new Response(JSON.stringify({ stop_reason: "refusal", content: [] }), { status: 200 }),
  );
  await expect(
    anthropic("claude-sonnet-5-5", "k").complete({ system: "", user: "", schema: {} } as never),
  ).rejects.toThrow(/declined/);
  vi.stubGlobal(
    "fetch",
    async () => new Response(JSON.stringify({ error: { message: "overloaded" } }), { status: 529 }),
  );
  await expect(
    anthropic("claude-sonnet-5-5", "k").complete({ system: "", user: "", schema: {} } as never),
  ).rejects.toThrow(/529: overloaded/);
});

test("a fenced JSON answer is the JSON alone", async () => {
  const { unfenced } = await import("./anthropic.js");
  expect(unfenced('```json\n{"kind":"answer"}\n```')).toBe('{"kind":"answer"}');
  expect(unfenced('{"kind":"answer"}')).toBe('{"kind":"answer"}');
});

test.each(["max_tokens", "model_context_window_exceeded"])(
  "Anthropic reports %s as cut-off output with usage",
  async (stopReason) => {
    vi.stubGlobal(
      "fetch",
      async () =>
        new Response(
          JSON.stringify({
            stop_reason: stopReason,
            content: [{ type: "text", text: "{}" }],
            usage: { input_tokens: 10, output_tokens: 16000 },
          }),
          { status: 200 },
        ),
    );
    await expect(
      anthropic("claude-haiku-5-5", "k").complete({ system: "", user: "", schema: {} } as never),
    ).rejects.toMatchObject({
      message: "The model's answer was cut off.",
      completion: { text: "{}", inputTokens: 10, outputTokens: 16000 },
    });
  },
);

test("closed shuts every object schema, and only schemas: a field named properties, an enum", async () => {
  const { closed } = await import("./anthropic.js");
  expect(
    closed({
      type: "object",
      properties: {
        properties: { type: "string" },
        kind: { enum: [{ properties: 1 }] },
        child: { type: "object", properties: { a: { type: "string" } } },
      },
    }),
  ).toEqual({
    type: "object",
    additionalProperties: false,
    properties: {
      properties: { type: "string" },
      kind: { enum: [{ properties: 1 }] },
      child: { type: "object", properties: { a: { type: "string" } }, additionalProperties: false },
    },
  });
});

test("closed leaves out the bounds structured output refuses on each type, and keeps the rest (T1605)", async () => {
  const { closed } = await import("./anthropic.js");
  expect(
    closed({
      type: "object",
      minProperties: 1,
      properties: {
        list: {
          type: "array",
          minItems: 2,
          maxItems: 4,
          uniqueItems: true,
          items: { type: "string" },
        },
        one: { type: "array", minItems: 1, items: { type: "string", minLength: 1, maxLength: 9 } },
        count: { type: "integer", minimum: 0, maximum: 9, multipleOf: 1 },
        share: { type: ["number", "null"], exclusiveMinimum: 0, exclusiveMaximum: 1 },
        word: { type: "string", minimum: 1, pattern: "^a" },
      },
    }),
  ).toEqual({
    type: "object",
    additionalProperties: false,
    properties: {
      list: { type: "array", items: { type: "string" } },
      one: { type: "array", minItems: 1, items: { type: "string", minLength: 1, maxLength: 9 } },
      count: { type: "integer" },
      share: { type: ["number", "null"] },
      word: { type: "string", minimum: 1, pattern: "^a" },
    },
  });
});

test("a schema with a map is not sent as structured output: one request, without it (T1597)", async () => {
  const sent: Record<string, unknown>[] = [];
  vi.stubGlobal("fetch", async (_url: string, init: RequestInit) => {
    const body = JSON.parse(String(init.body)) as Record<string, unknown>;
    sent.push(body);
    if (body.output_config)
      return Response.json({ error: { message: "output_config: maps refused" } }, { status: 400 });
    return Response.json({
      content: [{ type: "text", text: "{}" }],
      stop_reason: "end_turn",
      usage: { input_tokens: 1, output_tokens: 1 },
    });
  });
  const map = {
    type: "object",
    properties: { texts: { type: "object", additionalProperties: { type: "string" } } },
  };
  await anthropic("claude-haiku-5-5", "test-key").complete({ system: "s", user: "u", schema: map });
  expect(sent).toHaveLength(1);
  expect(sent[0]?.output_config).toBeUndefined();
});

test("takesSchema refuses maps, and only maps: a field named like a keyword, an enum value", async () => {
  const { takesSchema } = await import("./anthropic.js");
  expect(takesSchema({ type: "object", additionalProperties: true })).toBe(false);
  expect(takesSchema({ type: "object", patternProperties: { "^a": {} } })).toBe(false);
  expect(takesSchema({ anyOf: [{ type: "string" }, { additionalProperties: {} }] })).toBe(false);
  expect(takesSchema({ items: { type: "object", unevaluatedProperties: true } })).toBe(false);
  expect(takesSchema({ type: "string", "x-ui": { additionalProperties: true } })).toBe(true);
  expect(
    takesSchema({
      type: "object",
      additionalProperties: false,
      properties: {
        additionalProperties: { type: "string" },
        patternProperties: { type: "string" },
        kind: { enum: [{ additionalProperties: true }] },
        value: { default: { patternProperties: 1 } },
      },
      dependencies: { additionalProperties: ["id"] },
    }),
  ).toBe(true);
});

test("a 400 to a request without structured output is an error, not asked again (T1597)", async () => {
  let calls = 0;
  vi.stubGlobal("fetch", async () => {
    calls++;
    return Response.json({ error: { message: "additionalProperties: bad" } }, { status: 400 });
  });
  const map = { type: "object", additionalProperties: { type: "string" } };
  await expect(
    anthropic("claude-haiku-5-5", "test-key").complete({ system: "s", user: "u", schema: map }),
  ).rejects.toThrow("400");
  expect(calls).toBe(1);
});
