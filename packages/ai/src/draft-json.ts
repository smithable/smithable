import {
  type CompletionRequest,
  completeJson,
  JsonAnswerError,
  type Provider,
  type Usage,
} from "./provider.js";

/**
 * Repair only separator punctuation, never strings, numbers or a cut-off value. At the first
 * syntax fault, try a missing comma/closing bracket or an extra closing bracket. Keep a repair
 * only when the fewest edits produce exactly one valid JSON document. The search is bounded.
 * Engines without a positioned separator error simply leave the answer for the model retry.
 */
export function repairDraftJson(text: string): string | undefined {
  let candidates = new Set([text]);
  const seen = new Set(candidates);
  for (let edits = 0; edits <= 8; edits++) {
    const valid = new Set<string>();
    const next = new Set<string>();
    for (const candidate of candidates) {
      try {
        JSON.parse(candidate);
        valid.add(candidate);
      } catch (error) {
        const fault =
          /Expected ',' or '([}\]])' after (?:array element|property value) in JSON at position (\d+)/.exec(
            error instanceof Error ? error.message : "",
          );
        if (!fault) continue;
        const at = Number(fault[2]);
        const char = candidate[at];
        if (!char) continue; // Never complete an answer that stops before its next value.
        const replacements = /[}\]]/.test(char)
          ? [
              candidate.slice(0, at) + candidate.slice(at + 1),
              candidate.slice(0, at) + fault[1] + candidate.slice(at),
            ]
          : /["{[\-0-9tfn]/.test(char)
            ? [candidate.slice(0, at) + "," + candidate.slice(at)]
            : [];
        for (const repaired of replacements) {
          if (seen.has(repaired)) continue;
          seen.add(repaired);
          if (seen.size > 64) return undefined;
          next.add(repaired);
        }
      }
    }
    if (valid.size) return valid.size === 1 ? [...valid][0] : undefined;
    if (!next.size) return undefined;
    candidates = next;
  }
  return undefined;
}

/** One punctuation repair pass, otherwise one fresh request naming the error. */
export async function completeDraftJson(
  provider: Provider,
  request: CompletionRequest,
  usage: Usage[],
): Promise<unknown> {
  // The small Claude draft can exceed its usual 16k allowance. Other providers keep their
  // existing limit: an arbitrary compatible endpoint may support less than 32k output.
  const draft = {
    ...request,
    ...(/claude-haiku-5-5(?:$|[-:])/.test(provider.model ?? "")
      ? { maxOutputTokens: Math.max(request.maxOutputTokens ?? 0, 32_000) }
      : {}),
  };
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      return await completeJson(provider, draft, usage);
    } catch (error) {
      if (error instanceof JsonAnswerError) {
        const repaired = repairDraftJson(error.text);
        if (repaired !== undefined) return JSON.parse(repaired);
      } else if (!(error instanceof Error && error.message === "The model's answer was cut off.")) {
        throw error;
      }
      if (attempt) throw error;
      // A distinct request also avoids replaying the same malformed cached answer.
      draft.user = `${request.user}\n\nThe previous answer could not be read: ${error instanceof Error ? error.message : String(error)}. Return the complete answer as valid JSON only. Keep it concise; do not omit required operations.`;
      draft.repair = true;
    }
  }
  throw new Error("No JSON draft was returned.");
}
