// Smithable app kit: answering a question with the app's tools (docs/design/assistant.md §4).
// The wording rules first (./ask), which cost nothing; then, when the host gives one, a model that
// calls the same tools an outside assistant gets. The app runs every call itself and shows what
// came back; a call that would change something is only proposed, never run here.
import { type AskKind, readQuestion, smallTalk, suggestions, type Turn } from "./ask";
import { ungrounded } from "./grounded";
import { type Offer, offered } from "./tools";
import { w } from "./words";

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
  /** Ask with may: change: the proposal kept on the server, and what its card says. */
  proposal?: string;
  card?: Card;
  ms: number;
}

/** A proposed change as the app words it: the record, and each field from what it is to what it becomes. */
export interface Card {
  title: string;
  changes: { label: string; from?: Json; to: Json }[];
}

export interface Answer {
  /** "records": the rules read the question and the app answered; "ai": a model chose or worded it. */
  source: "records" | "ai" | "none";
  steps: Step[];
  /** The model's own words, or the rules' reply to small talk. */
  text?: string;
  /** Questions to try that lead back to the app's records (A 152): asked when picked. */
  suggestions?: string[];
  /** Why there is no (full) answer, in the app's or the host's words. */
  note?: string;
  /** The model's words did not stand on the tools' results, even after it tried again. */
  unconfirmed?: boolean;
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
  /** What is said when the rules do not read a question and there is no model to ask. */
  unread?: string;
  /** Its manner, as the app's look file says it: a fixed line each, given to the model. */
  voice?: Voice;
  /** What it is for, one sentence of the app's texts: shown, and given to the model. */
  about?: string;
  /**
   * Ask with may: change: checks a proposed change as the person would make it and keeps it
   * for them to confirm; a refusal in the app's words otherwise.
   */
  propose?: (tool: string, args: { [key: string]: Json }) => Promise<{ id: string; card: Card }>;
  /** The conversation so far, oldest first (A 152): what the model reads a follow-up by. */
  turns?: Turn[];
}

/** The assistant's voices (docs/design/ask-defaults.md §2), each a fixed line for the model. */
export type Voice = "plain" | "friendly" | "formal";
const VOICES: Record<Voice, string> = {
  plain: "Be brief and plain: no greetings, no pleasantries.",
  friendly: "Be warm and friendly, in a sentence or two.",
  formal: "Be formal and courteous, in complete sentences.",
};

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
      if (found.annotations?.readOnlyHint !== true) {
        // Kept for the person to confirm only once it is one they may make.
        if (parts.propose) {
          const kept = await parts.propose(tool, args);
          step.proposal = kept.id;
          step.card = kept.card;
        }
        step.proposed = true;
      } else step.result = (await parts.call(tool, args)) as Json;
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
  // Small talk is answered by rule and leads back to the records, for nothing (A 152).
  const tries = suggestions(parts.kinds);
  const talk = smallTalk(question);
  if (talk) return done({ source: "none", text: talk, suggestions: tries });
  const model = parts.model;
  if (!model)
    return done({
      source: "none",
      note: parts.unread ?? w.noModelToAsk,
      suggestions: tries,
    });

  const fetchModel = parts.fetch ?? fetch;
  const tools = parts.offer.tools.map((t) => ({
    type: "function",
    function: { name: t.name, description: t.description, parameters: t.inputSchema },
  }));
  const messages: Record<string, unknown>[] = [
    {
      role: "system",
      content: `${parts.offer.summary}\n${parts.about ? `The app's owner describes this assistant as: ${JSON.stringify(parts.about)}\n` : ""}Answer with the tools. The app shows what they return, so keep any words to a short caption. A question that is not about the app's records (small talk, something general) gets a sentence or two without tools; the app then offers questions about its records to try. ${VOICES[parts.voice ?? "plain"]}`,
    },
    // The conversation so far, so a follow-up ("and last month?") reads as one.
    ...(parts.turns ?? []).flatMap((turn) => [
      { role: "user", content: turn.question },
      { role: "assistant", content: turn.answer },
    ]),
    { role: "user", content: question },
  ];
  const tokens = { in: 0, out: 0 };
  // An answer not grounded in the results (ask-checks.md §3): once again with why, then once
  // marked for the host, which may give it to a better model; then shown as not confirmed.
  let checks = 0;
  for (let round = 0; round < ROUNDS + checks; round++) {
    let response: Response;
    try {
      response = await fetchModel(`${model.url}/chat/completions`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${model.key}`,
          "x-assistant-person": model.person,
          ...(checks > 1 ? { "x-assistant-ask": "ungrounded" } : {}),
        },
        body: JSON.stringify({ model: model.model, messages, tools }),
        signal: AbortSignal.timeout(MODEL_WAIT),
      });
    } catch (error) {
      const late = error instanceof Error && error.name === "TimeoutError";
      return done({
        source: steps.length ? "ai" : "none",
        note: late ? w.modelTimedOut(MODEL_WAIT / 1000) : w.modelNotReached,
        tokens,
      });
    }
    const body = (await response.json().catch(() => ({}))) as {
      error?: { message?: string };
      choices?: { message?: { content?: string | null; tool_calls?: ToolCall[] } }[];
      usage?: { prompt_tokens?: number; completion_tokens?: number };
    };
    if (!response.ok) {
      const said = body.error?.message ?? w.modelAnswered(response.status);
      // 402: the host's questions are used up; the rules still answer what they read.
      const note = response.status === 402 ? `${said} ${w.rulesStillAnswer}` : said;
      return done({ source: steps.length ? "ai" : "none", note, tokens });
    }
    tokens.in += body.usage?.prompt_tokens ?? 0;
    tokens.out += body.usage?.completion_tokens ?? 0;
    const message = body.choices?.[0]?.message ?? {};
    const calls = message.tool_calls ?? [];
    const text = message.content?.trim() || undefined;
    if (!calls.length) {
      // A number the person said earlier is known too; an earlier answer's is not, since the
      // page sends it and it may itself have been unconfirmed.
      const earlier = [...(parts.turns ?? []).map((t) => t.question), question];
      const why = text ? ungrounded(text, earlier.join("\n"), steps, parts.kinds) : undefined;
      // An answer with no lookup at all was talk: questions to try lead back to the records.
      if (!why)
        return done({
          source: "ai",
          text,
          tokens,
          ...(steps.length ? {} : { suggestions: tries }),
        });
      if (checks === 2)
        return done({ source: "ai", text, tokens, note: w.notConfirmed, unconfirmed: true });
      checks++;
      messages.push({ role: "assistant", content: text ?? null }, { role: "system", content: why });
      continue;
    }
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
        ? { proposed: true, note: w.proposedNote }
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
  return done({ source: "ai", note: w.stoppedAfter(ROUNDS), tokens });
}

interface ToolCall {
  id: string;
  type?: string;
  function: { name: string; arguments?: string };
}
