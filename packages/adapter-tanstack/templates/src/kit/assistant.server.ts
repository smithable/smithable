// Smithable app kit: answering a question with the app's tools (docs/design/assistant.md §4).
// The wording rules first (./ask), which cost nothing; then, when the host gives one, a model that
// calls the same tools an outside assistant gets. The app runs every call itself and shows what
// came back; a call that would change something is only proposed, never run here.
import { type AskKind, readQuestion } from "./ask";
import { type Offer, offered } from "./tools";

/** A value as JSON carries it: what tools take and give. */
export type Json = string | number | boolean | null | Json[] | { [key: string]: Json };

/** One tool call: what was asked, and what came back or why not. */
export interface Step {
  tool: string;
  args: { [key: string]: Json };
  result?: Json;
  error?: string;
  /** A change the app did not make: the person would confirm it first. */
  proposed?: boolean;
  ms: number;
}

export interface Answer {
  /** "records": the rules read the question and the app answered; "ai": a model chose or worded it. */
  source: "records" | "ai" | "none";
  steps: Step[];
  /** The model's own words, when it gave any. */
  text?: string;
  /** Why there is no (full) answer, in the app's or the host's words. */
  note?: string;
  tokens?: { in: number; out: number };
  ms: number;
}

/** A chat service that can call tools, as the host gives it (ASSISTANT_URL, _KEY, _MODEL). */
export interface Model {
  url: string;
  key: string;
  model: string;
  /** Who is asking, so the host can count questions per person. */
  person: string;
}

/** The host's model, when it gives one. */
export function hostModel(person: string): Model | undefined {
  const { ASSISTANT_URL: url, ASSISTANT_KEY: key, ASSISTANT_MODEL: model } = process.env;
  return url && model ? { url: url.replace(/\/$/, ""), key: key ?? "", model, person } : undefined;
}

/** Model calls for one question, at most: a lookup takes one. */
const ROUNDS = 4;
/** How long one model call may take. */
const MODEL_WAIT = 30_000;
/** What one tool result may send back to the model. */
const RESULT_MAX = 8_000;

interface Parts {
  offer: Offer;
  kinds: AskKind[];
  call: (tool: string, args: Record<string, unknown>) => Promise<unknown>;
  model?: Model;
  fetch?: typeof fetch;
}

export async function answer(question: string, parts: Parts): Promise<Answer> {
  const started = Date.now();
  const steps: Step[] = [];
  const done = (rest: Omit<Answer, "steps" | "ms">): Answer => ({
    ...rest,
    steps,
    ms: Date.now() - started,
  });
  const run = async (tool: string, args: { [key: string]: Json }): Promise<Step> => {
    const at = Date.now();
    const step: Step = { tool, args, ms: 0 };
    try {
      const found = offered(parts.offer, tool, args);
      // Only a tool marked as reading runs here; anything else is proposed.
      if (found.annotations?.readOnlyHint !== true) step.proposed = true;
      else step.result = (await parts.call(tool, args)) as Json;
    } catch (error) {
      step.error = error instanceof Error ? error.message : String(error);
    }
    step.ms = Date.now() - at;
    steps.push(step);
    return step;
  };

  // The rules: a question they read fully is the same call a model would make, for nothing.
  const read = readQuestion(question, parts.kinds);
  if (read) {
    const { tool, ...args } = read;
    await run(tool, args as { [key: string]: Json });
    return done({ source: "records" });
  }
  const model = parts.model;
  if (!model)
    return done({
      source: "none",
      note: "The rules did not read this question, and the app has no model to ask (ASSISTANT_URL).",
    });

  const fetchModel = parts.fetch ?? fetch;
  const tools = parts.offer.tools.map((t) => ({
    type: "function",
    function: { name: t.name, description: t.description, parameters: t.inputSchema },
  }));
  const messages: Record<string, unknown>[] = [
    {
      role: "system",
      content: `${parts.offer.summary}\nAnswer with the tools. The app shows what they return, so keep any words to a short caption.`,
    },
    { role: "user", content: question },
  ];
  const tokens = { in: 0, out: 0 };
  for (let round = 0; round < ROUNDS; round++) {
    let response: Response;
    try {
      response = await fetchModel(`${model.url}/chat/completions`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${model.key}`,
          "x-assistant-person": model.person,
        },
        body: JSON.stringify({ model: model.model, messages, tools }),
        signal: AbortSignal.timeout(MODEL_WAIT),
      });
    } catch (error) {
      const late = error instanceof Error && error.name === "TimeoutError";
      return done({
        source: steps.length ? "ai" : "none",
        note: late
          ? `The model did not answer within ${MODEL_WAIT / 1000} seconds.`
          : "The model could not be reached.",
        tokens,
      });
    }
    const body = (await response.json().catch(() => ({}))) as {
      error?: { message?: string };
      choices?: { message?: { content?: string | null; tool_calls?: ToolCall[] } }[];
      usage?: { prompt_tokens?: number; completion_tokens?: number };
    };
    if (!response.ok) {
      const said = body.error?.message ?? `The model answered ${response.status}.`;
      // 402: the host's questions are used up; the rules still answer what they read.
      const note =
        response.status === 402 ? `${said} Questions the rules read are still answered.` : said;
      return done({ source: steps.length ? "ai" : "none", note, tokens });
    }
    tokens.in += body.usage?.prompt_tokens ?? 0;
    tokens.out += body.usage?.completion_tokens ?? 0;
    const message = body.choices?.[0]?.message ?? {};
    const calls = message.tool_calls ?? [];
    const text = message.content?.trim() || undefined;
    if (!calls.length) return done({ source: "ai", text, tokens });
    messages.push({ role: "assistant", content: message.content ?? null, tool_calls: calls });
    let proposed = false;
    for (const c of calls) {
      let args: { [key: string]: Json } = {};
      try {
        args = JSON.parse(c.function.arguments || "{}");
      } catch {}
      const step = await run(c.function.name, args);
      proposed ||= Boolean(step.proposed);
      const content = step.proposed
        ? { proposed: true, note: "Shown to the person to confirm; nothing is changed yet." }
        : step.error
          ? { error: step.error }
          : step.result;
      messages.push({
        role: "tool",
        tool_call_id: c.id,
        content: JSON.stringify(content ?? null).slice(0, RESULT_MAX),
      });
    }
    // A proposed change ends the question: the person decides, not another model call.
    if (proposed) return done({ source: "ai", text, tokens });
  }
  return done({ source: "ai", note: `Stopped after ${ROUNDS} model calls.`, tokens });
}

interface ToolCall {
  id: string;
  type?: string;
  function: { name: string; arguments?: string };
}
