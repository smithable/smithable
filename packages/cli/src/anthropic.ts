import { appendFileSync } from "node:fs";
import type { Provider } from "@smithable/ai";

/**
 * Anthropic's list prices per million tokens for its own API (platform.claude.com, 2026-10-26),
 * in dollars: input, output, a cache write (1.25× input), a cache read (0.1× input).
 */
const PRICES: [RegExp, { input: number; output: number; write: number; read: number }][] = [
  [/claude-haiku-5-5/, { input: 0.1, output: 0.5, write: 0.125, read: 0.01 }],
  [/claude-sonnet-5-5/, { input: 2, output: 10, write: 2.5, read: 0.2 }],
  [/claude-opus-5-5/, { input: 4, output: 20, write: 5, read: 0.4 }],
];

/**
 * Claude through Anthropic's own API (SMITHABLE_FRONTIER=anthropic, SMITHABLE_FRONTIER_MODEL=one
 * model or several, cheapest first, e.g. claude-haiku-5-5,claude-sonnet-5-5: a request that the
 * first cannot do or whose answer fails the checks goes to the next, as the hosted service does),
 * with the key in ANTHROPIC_API_KEY. The answer's schema is the structured output; the system text
 * is marked for prompt caching, since it is the same in every call. Thinking is the model's own
 * default, as the hosted service sends it.
 */
export function anthropic(
  model: string,
  key: string,
  usageLog?: string,
  url = "https://api.anthropic.com/v1/messages",
): Provider {
  const price = PRICES.find(([name]) => name.test(model))?.[1];
  return {
    name: "anthropic",
    tier: "frontier",
    location: "elsewhere",
    model,
    price: price ? { input: price.input, output: price.output } : { input: 0, output: 0 },
    currency: "USD",
    async complete({ system, user, schema }) {
      const post = (format: boolean) =>
        fetch(url, {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "x-api-key": key,
            "anthropic-version": "2023-06-01",
          },
          body: JSON.stringify({
            model,
            max_tokens: 16000,
            system: [{ type: "text", text: system, cache_control: { type: "ephemeral" } }],
            messages: [{ role: "user", content: user }],
            ...(format
              ? { output_config: { format: { type: "json_schema", schema: closed(schema) } } }
              : {}),
          }),
        });
      let response = await post(true);
      // A schema structured output cannot hold (a map of any keys): the JSON the prompt asks for.
      if (
        response.status === 400 &&
        /output_config|json_schema|additionalProperties/.test(await response.clone().text())
      )
        response = await post(false);
      const body = (await response.json().catch(() => ({}))) as {
        content?: { type?: string; text?: string }[];
        stop_reason?: string;
        error?: { message?: string };
        usage?: {
          input_tokens?: number;
          output_tokens?: number;
          cache_read_input_tokens?: number;
          cache_creation_input_tokens?: number;
        };
      };
      if (!response.ok)
        throw new Error(
          `Anthropic's API answered ${response.status}: ${body.error?.message ?? ""}`,
        );
      if (body.stop_reason === "refusal") throw new Error("The model declined the request.");
      // Half an answer is no answer: the next model, or the person, hears so.
      if (body.stop_reason === "max_tokens") throw new Error("The model's answer was cut off.");
      const u = body.usage ?? {};
      const fresh = u.input_tokens ?? 0;
      const read = u.cache_read_input_tokens ?? 0;
      const write = u.cache_creation_input_tokens ?? 0;
      const output = u.output_tokens ?? 0;
      // The bench's record of each call's tokens by kind (SMITHABLE_USAGE_LOG=<file>).
      if (usageLog)
        appendFileSync(usageLog, `${JSON.stringify({ model, fresh, read, write, output })}\n`);
      return {
        // Without structured output a model may still fence its JSON (```json … ```): the JSON alone.
        text: unfenced(
          (body.content ?? [])
            .filter((c) => c.type === "text")
            .map((c) => c.text ?? "")
            .join(""),
        ),
        model,
        inputTokens: fresh + read + write,
        outputTokens: output,
        ...(price
          ? {
              cost: {
                amount:
                  (fresh * price.input +
                    write * price.write +
                    read * price.read +
                    output * price.output) /
                  1_000_000,
                currency: "USD" as const,
              },
            }
          : {}),
      };
    },
  };
}

/**
 * The schema as structured output takes it: every object that lists its properties closed to
 * others (additionalProperties: false), which it requires. A map of any keys stays as it is, and
 * the API refuses it, so the request goes again without structured output.
 */
export function closed(schema: unknown): unknown {
  if (Array.isArray(schema)) return schema.map(closed);
  if (!schema || typeof schema !== "object") return schema;
  const out = Object.fromEntries(
    Object.entries(schema).map(([key, value]) => [
      key,
      // A map of properties holds schemas under any names (one may be "properties"), and a
      // value (enum, const, default, examples) is data, not a schema.
      key === "properties" && value && typeof value === "object"
        ? Object.fromEntries(Object.entries(value).map(([name, s]) => [name, closed(s)]))
        : VALUES.has(key)
          ? value
          : closed(value),
    ]),
  ) as Record<string, unknown>;
  if (out.properties && out.additionalProperties === undefined) out.additionalProperties = false;
  return out;
}

const VALUES = new Set(["enum", "const", "default", "examples"]);

/** A JSON answer without the Markdown fence a model may put around it. */
export const unfenced = (text: string): string =>
  /^\s*```(?:json)?\s*\n([\s\S]*?)\n?```\s*$/.exec(text)?.[1] ?? text;
