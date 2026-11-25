import { appendFileSync } from "node:fs";
import { CutOffAnswerError, type Provider } from "@smithable/ai";

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
    async complete({ system, user, schema, maxOutputTokens }) {
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
            max_tokens: maxOutputTokens ?? 16000,
            system: [{ type: "text", text: system, cache_control: { type: "ephemeral" } }],
            messages: [{ role: "user", content: user }],
            ...(format
              ? { output_config: { format: { type: "json_schema", schema: closed(schema) } } }
              : {}),
          }),
        });
      // A schema structured output cannot hold (a map of any keys) is not sent: the JSON the prompt
      // asks for, without a request the API is known to refuse first (T1597). Any other refusal
      // of the schema still has the request sent again without it.
      const format = takesSchema(schema);
      let response = await post(format);
      if (
        format &&
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
      const u = body.usage ?? {};
      const fresh = u.input_tokens ?? 0;
      const read = u.cache_read_input_tokens ?? 0;
      const write = u.cache_creation_input_tokens ?? 0;
      const output = u.output_tokens ?? 0;
      // The bench's record of each call's tokens by kind (SMITHABLE_USAGE_LOG=<file>).
      if (usageLog)
        appendFileSync(usageLog, `${JSON.stringify({ model, fresh, read, write, output })}\n`);
      const completion = {
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
      if (body.stop_reason === "max_tokens" || body.stop_reason === "model_context_window_exceeded")
        throw new CutOffAnswerError(completion);
      return completion;
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

/**
 * Whether structured output can take the schema: a map keyed by an app's own names
 * (additionalProperties or unevaluatedProperties that is a schema or true, or patternProperties)
 * it refuses with a 400, as the hosted service's gateway knows too (T759). The draft's answer
 * schema holds such maps. Only places that hold schemas are walked, so a value (an enum, a default)
 * or an unknown keyword (x-ui) is never taken for a map.
 */
export function takesSchema(schema: unknown): boolean {
  if (Array.isArray(schema)) return schema.every(takesSchema);
  if (!schema || typeof schema !== "object") return true;
  const node = schema as Record<string, unknown>;
  if (node.patternProperties !== undefined) return false;
  for (const open of ["additionalProperties", "unevaluatedProperties"])
    if (node[open] !== undefined && node[open] !== false) return false;
  return Object.entries(node).every(([key, value]) =>
    NAMED.has(key) && value && typeof value === "object"
      ? Object.values(value).every(takesSchema)
      : SCHEMAS.has(key)
        ? takesSchema(value)
        : true,
  );
}
/**
 * Keywords whose value maps names to schemas (a name may be "additionalProperties"); draft-07's
 * dependencies maps a name to a schema or to a list of names, which holds no map.
 */
const NAMED = new Set(["properties", "$defs", "definitions", "dependentSchemas", "dependencies"]);
/** Keywords whose value is a schema or a list of schemas. */
const SCHEMAS = new Set([
  "items",
  "prefixItems",
  "additionalItems",
  "unevaluatedItems",
  "contains",
  "propertyNames",
  "not",
  "if",
  "then",
  "else",
  "anyOf",
  "oneOf",
  "allOf",
]);

/** A JSON answer without the Markdown fence a model may put around it. */
export const unfenced = (text: string): string =>
  /^\s*```(?:json)?\s*\n([\s\S]*?)\n?```\s*$/.exec(text)?.[1] ?? text;
