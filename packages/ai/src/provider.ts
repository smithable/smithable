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
}

export interface Completion {
  text: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  /** What the call cost, when the provider reports it (e.g. Claude Code, in dollars). */
  cost?: { amount: number; currency: Currency };
}

export type Currency = "EUR" | "USD";

export interface Provider {
  name: string;
  tier: Tier;
  location: Location;
  /** Euros per million input and output tokens; 0 for a local model. */
  price: { input: number; output: number };
  complete(request: CompletionRequest): Promise<Completion>;
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
  return {
    name: options.name,
    tier: options.tier,
    location: options.location,
    price: options.price ?? { input: 0, output: 0 },
    async complete({ system, user, schema, fallbackSchema }) {
      const post = (answerSchema: object) =>
        fetch(`${options.baseUrl.replace(/\/$/, "")}/chat/completions`, {
          method: "POST",
          // A model that never answers must not hang a change or a first build for good; a local
          // model on a slow machine still gets long enough for a large answer.
          signal: AbortSignal.timeout(options.tier === "local" ? 600_000 : 180_000),
          headers: {
            "Content-Type": "application/json",
            ...(options.apiKey ? { Authorization: `Bearer ${options.apiKey}` } : {}),
          },
          body: JSON.stringify({
            model: options.model,
            temperature: 0,
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
  if (!text) return "eu-only";
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
  provider: string;
  model: string;
  tier: Tier;
  inputTokens: number;
  outputTokens: number;
  cost: number;
  currency: Currency;
}

/**
 * Asks a provider for a JSON answer and records what the call used. Throws when the model
 * is unreachable or its answer is not JSON.
 */
export async function completeJson(
  provider: Provider,
  request: CompletionRequest,
  usage: Usage[],
): Promise<unknown> {
  const completion = await provider.complete(request);
  usage.push({
    provider: provider.name,
    model: completion.model,
    tier: provider.tier,
    inputTokens: completion.inputTokens,
    outputTokens: completion.outputTokens,
    // Prices are in euros per million tokens, unless the provider reports its own cost.
    cost:
      completion.cost?.amount ??
      (completion.inputTokens * provider.price.input +
        completion.outputTokens * provider.price.output) /
        1_000_000,
    currency: completion.cost?.currency ?? "EUR",
  });
  return JSON.parse(completion.text);
}
