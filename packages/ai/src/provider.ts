// Model providers and the AI policy (ARCHITECTURE §9.5). Every tier speaks the same operation
// schemas, so swapping the model behind a tier never changes the product.

/** Tier 1 runs on the user's machine, tier 2 is the Smithable model, tier 3 a frontier model. */
export type Tier = "local" | "smithable" | "frontier";

/** Where a model runs: what the AI policy decides on. */
export type Location = "local" | "eu" | "elsewhere";

export interface CompletionRequest {
  system: string;
  user: string;
  /** The answer must be JSON matching this schema (constrained decoding where supported). */
  schema: object;
  /**
   * A simpler schema for a server that refuses `schema` (JSON Schema support differs: some
   * take a full argument schema per operation, some only an enum of names). A provider that
   * had to fall back keeps using the simpler form.
   */
  fallbackSchema?: object;
  /**
   * A second try after an answer that could not be applied: sent with `X-Smithable-Repair: 1`,
   * so a gateway that cascades to a stronger model knows without reading the prompt.
   */
  repair?: boolean;
}

export interface Completion {
  text: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  /** What the call cost, when the provider reports it (e.g. Claude Code, in dollars). */
  cost?: { amount: number; currency: Currency };
  /** Answered from a response cache: nothing was paid for it. */
  cached?: boolean;
}

export type Currency = "EUR" | "USD";

export interface Provider {
  name: string;
  tier: Tier;
  location: Location;
  /** Per million input and output tokens, in `currency`; 0 for a local model. */
  price: { input: number; output: number };
  /** The currency of `price`: euros unless said. */
  currency?: Currency;
  /** The model asked, when the provider names one: a response cache keys on it. */
  model?: string;
  complete(request: CompletionRequest): Promise<Completion>;
}

/**
 * Mistral's list prices per million tokens (mistral.ai/pricing/api, 2026-10-04), in US dollars,
 * for a model given no price of its own. A "-latest" name follows Mistral's current version
 * (mistral-medium-latest is Mistral Medium 3.5).
 */
const LIST_PRICES: [RegExp, { input: number; output: number }][] = [
  [/^mistral-medium/, { input: 1.5, output: 7.5 }],
  [/^mistral-large/, { input: 0.5, output: 1.5 }],
  [/^mistral-small/, { input: 0.15, output: 0.6 }],
];

/** A model's list price in US dollars per million tokens, when it is one Smithable knows. */
export function listPrice(model: string): { input: number; output: number } | undefined {
  return LIST_PRICES.find(([name]) => name.test(model))?.[1];
}

export interface OpenAICompatibleOptions {
  name: string;
  /** E.g. http://localhost:11434/v1 for Ollama, https://api.mistral.ai/v1 for Mistral. */
  baseUrl: string;
  model: string;
  apiKey?: string;
  tier: Tier;
  location: Location;
  price?: { input: number; output: number };
}

/**
 * A provider for any OpenAI-compatible chat completions API: Ollama, llama.cpp, vLLM, Mistral
 * and most EU hosts. The answer is constrained to the JSON schema where the server supports it.
 */
export function openAICompatible(options: OpenAICompatibleOptions): Provider {
  // Whether this server took the strict answer schema; unknown until the first call.
  let strict: boolean | undefined;
  // Temperature 0 for the same answer to the same request, unless the server refuses it (some
  // reasoning models take only their default): then it is left out, for this server.
  let steady = true;
  // A price given wins; otherwise a known model's list price, in dollars.
  const listed = options.price ? undefined : listPrice(options.model);
  return {
    name: options.name,
    tier: options.tier,
    location: options.location,
    model: options.model,
    price: options.price ?? listed ?? { input: 0, output: 0 },
    currency: listed ? "USD" : "EUR",
    async complete({ system, user, schema, fallbackSchema, repair }) {
      const post = (answerSchema: object) =>
        fetch(`${options.baseUrl.replace(/\/$/, "")}/chat/completions`, {
          method: "POST",
          // A model that never answers must not hang a change or a first build for good; a local
          // model on a slow machine still gets long enough for a large answer.
          signal: AbortSignal.timeout(options.tier === "local" ? 600_000 : 180_000),
          headers: {
            "Content-Type": "application/json",
            ...(options.apiKey ? { Authorization: `Bearer ${options.apiKey}` } : {}),
            ...(repair ? { "X-Smithable-Repair": "1" } : {}),
          },
          body: JSON.stringify({
            model: options.model,
            ...(steady ? { temperature: 0 } : {}),
            messages: [
              { role: "system", content: system },
              { role: "user", content: user },
            ],
            response_format: {
              type: "json_schema",
              json_schema: { name: "answer", schema: answerSchema },
            },
          }),
        });
      let current = strict === false && fallbackSchema ? fallbackSchema : schema;
      let response = await post(current);
      if (response.status === 400 && steady && /temperature/.test(await response.clone().text())) {
        steady = false;
        response = await post(current);
      }
      // A 400 for the strict schema: the server's JSON Schema support stops short of it. The
      // simpler schema is tried once, and kept for this server.
      if (response.status === 400 && fallbackSchema && current !== fallbackSchema) {
        strict = false;
        current = fallbackSchema;
        response = await post(current);
      } else if (response.ok && strict === undefined) strict = true;
      // Hosted APIs limit requests per second: wait as long as they ask (or 1, 2, 4 s), then retry.
      for (let retry = 0; response.status === 429 && retry < 3; retry++) {
        const after = Number(response.headers.get("retry-after"));
        await new Promise((r) => setTimeout(r, after > 0 ? after * 1000 : 1000 * 2 ** retry));
        response = await post(current);
      }
      if (!response.ok)
        throw new Error(`${options.name} answered ${response.status}: ${await response.text()}`);
      const body = (await response.json()) as {
        model?: string;
        choices?: { message?: { content?: string } }[];
        usage?: { prompt_tokens?: number; completion_tokens?: number };
      };
      return {
        text: body.choices?.[0]?.message?.content ?? "",
        model: body.model ?? options.model,
        inputTokens: body.usage?.prompt_tokens ?? 0,
        outputTokens: body.usage?.completion_tokens ?? 0,
      };
    },
  };
}

/**
 * Which models may see the project: only local ones, local and EU-hosted ones (the default),
 * any, or the providers named in an allowlist.
 */
export type Policy = "local-only" | "eu-only" | "best-available" | { allow: string[] };

export function allowedBy(policy: Policy, provider: Provider): boolean {
  if (policy === "local-only") return provider.location === "local";
  if (policy === "eu-only") return provider.location !== "elsewhere";
  if (policy === "best-available") return true;
  return policy.allow.includes(provider.name);
}

/** The providers a policy allows, cheapest tier first: the order requests escalate in. */
export function route(providers: Provider[], policy: Policy): Provider[] {
  const order: Tier[] = ["local", "smithable", "frontier"];
  return providers
    .filter((p) => allowedBy(policy, p))
    .sort((a, b) => order.indexOf(a.tier) - order.indexOf(b.tier));
}

export function parsePolicy(text: string | undefined): Policy {
  // Where models may run is a setting: nothing said means the best model configured, wherever
  // it runs; "eu-only" and "local-only" restrict it.
  if (!text) return "best-available";
  if (text === "local-only" || text === "eu-only" || text === "best-available") return text;
  if (text.startsWith("allow:"))
    return {
      allow: text
        .slice(6)
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
    };
  throw new Error(
    `Unknown AI policy "${text}". Use local-only, eu-only, best-available or allow:<provider>,…`,
  );
}

/** What one model call used, for the change trace. */
export interface Usage {
  /** Answered from a response cache: no tokens and no cost. */
  cached?: boolean;
  provider: string;
  model: string;
  tier: Tier;
  inputTokens: number;
  outputTokens: number;
  cost: number;
  currency: Currency;
}

/**
 * Rounds in which a model mends its own answer from the checks' reasons before the next model
 * tries: four, since a round of Claude Haiku 5.5 costs a tenth of a cent.
 */
export const REPAIRS = 4;

/**
 * The largest prompt sent, in tokens, estimated at three characters each (JSON and YAML make
 * short tokens): Claude Haiku 5.5 charges five times as much for a prompt over 100k tokens, and
 * none of ours needs that many.
 */
export const MAX_PROMPT_TOKENS = 100_000;

/**
 * Asks a provider for a JSON answer and records what the call used. Throws when the model
 * is unreachable or its answer is not JSON.
 */
export async function completeJson(
  provider: Provider,
  request: CompletionRequest,
  usage: Usage[],
): Promise<unknown> {
  const size = Math.ceil(
    (request.system.length + request.user.length + JSON.stringify(request.schema).length) / 3,
  );
  if (size > MAX_PROMPT_TOKENS)
    throw new Error(
      `The request is too large for the model (about ${size} tokens; at most ${MAX_PROMPT_TOKENS}).`,
    );
  const completion = await provider.complete(request);
  usage.push({
    provider: provider.name,
    model: completion.model,
    tier: provider.tier,
    inputTokens: completion.inputTokens,
    outputTokens: completion.outputTokens,
    // Prices are per million tokens in the provider's currency, unless it reports its own cost.
    cost:
      completion.cost?.amount ??
      (completion.inputTokens * provider.price.input +
        completion.outputTokens * provider.price.output) /
        1_000_000,
    currency: completion.cost?.currency ?? provider.currency ?? "EUR",
    ...(completion.cached ? { cached: true } : {}),
  });
  return JSON.parse(completion.text);
}

/** Where a response cache keeps its answers: the host decides (a folder, for the CLI). */
export interface ResponseStore {
  get(key: string): Promise<string | undefined>;
  set(key: string, value: string): Promise<void>;
}

/**
 * A provider that answers a request it has seen before from the store, by the hash of the
 * model, the system text, the user text and the schemas, and asks the model only otherwise. For
 * the benchmark and tests (requests go out at temperature 0); never on for people by default. A
 * cached answer costs nothing and counts no tokens.
 */
export function cached(provider: Provider, store: ResponseStore): Provider {
  return {
    ...provider,
    async complete(request) {
      const key = await sha256(
        JSON.stringify([
          provider.name,
          provider.model ?? null,
          request.system,
          request.user,
          request.schema,
          request.fallbackSchema ?? null,
        ]),
      );
      const kept = await store.get(key);
      if (kept !== undefined) {
        const { text, model } = JSON.parse(kept) as Completion;
        return { text, model, inputTokens: 0, outputTokens: 0, cached: true };
      }
      const completion = await provider.complete(request);
      await store.set(key, JSON.stringify(completion));
      return completion;
    },
  };
}

async function sha256(text: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
