// Search phrases for a question (T755 step 2): the cheapest model writes two or three short English
// phrases as the docs would word them (the docs are in English; a question may not be, or may be
// worded otherwise or misspelt), and the docs are searched with each beside the question itself.
import { completeJson, type Provider, type Usage } from "./provider.js";

const SYSTEM =
  "You turn a question to Smithable's assistant into search phrases for Smithable's English documentation (an app builder: publishing, hosting, limits, keys, data, import and export, languages, integrations). Write two or three short English phrases, each as the docs would word it, correcting typos. Phrases only.";

const SCHEMA = {
  type: "object",
  required: ["phrases"],
  additionalProperties: false,
  // No maxItems: Anthropic's structured output refuses it (400); the code keeps three.
  properties: { phrases: { type: "array", items: { type: "string" } } },
};

/** The phrases, or none when the model cannot be reached (the question alone is searched then). */
export async function searchPhrases(
  provider: Provider,
  question: string,
  usage: Usage[] = [],
): Promise<string[]> {
  try {
    const answer = (await completeJson(
      provider,
      { system: SYSTEM, user: question.slice(0, 500), schema: SCHEMA },
      usage,
    )) as { phrases?: unknown };
    return Array.isArray(answer.phrases)
      ? answer.phrases
          .filter((p): p is string => typeof p === "string")
          .map((p) => p.slice(0, 100))
          .slice(0, 3)
      : [];
  } catch {
    return [];
  }
}
