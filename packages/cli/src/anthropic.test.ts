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
