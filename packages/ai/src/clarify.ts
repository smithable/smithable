// Before the first draft (docs/design/first-build.md, 2.1): one cheap call reads the
// description, picks the starter that is the best example for it, and asks at most three
// questions when the description leaves the app's shape open. A clear description gets none.

import type { Language } from "@smithable/core";
import { questionsNote } from "./language.js";
import { completeJson, type Provider, type Usage } from "./provider.js";

export interface Question {
  question: string;
  /** Suggested answers; free text is always fine too. */
  options: string[];
}

export interface Clarification {
  /** The starter chosen as the example, when the model chose one that exists. */
  starter?: string;
  questions: Question[];
  usage: Usage[];
}

const SYSTEM = `Someone describes an app they want in one or two sentences. Smithable will draft it from a starter app that serves as the example of the format, adapted to the description.
The description may be in any language: judge it by what the app is, never by which words it shares with a starter, and write your questions and their suggested answers in the description's language unless you are told another.
Two jobs: pick the starter that is the best example for this description, and ask at most three short questions, only about what changes the app's shape and the description leaves open: who uses it (only the person, a team, anyone on the internet), what visitors may see without signing in, what the main kinds of records are and what they hold. Read the description closely first: what it already says is settled, and asking it again is a mistake (if it says only the team posts, never ask who may post). Never ask about looks, colors or names. Give each question two to four suggested answers. When the description already says enough, ask nothing. Pick a starter only when its main records are what this app is mainly about (people reserving times: a booking starter; a team's customers and their orders: a CRM; invoices and payments; things people list for others to find; services and their incidents); a shared detail is not a match (a car log is not a status page, a museum's collection is not a marketplace). When no starter's main records are the app's, the answer is "records".
Answer with JSON only: {"starter": "<name>", "questions": [{"question": "...", "options": ["...", "..."]}]}.`;

const schema = (starters: string[]) => ({
  type: "object",
  required: ["starter", "questions"],
  additionalProperties: false,
  properties: {
    starter: { type: "string", enum: starters },
    questions: {
      type: "array",
      maxItems: 3,
      items: {
        type: "object",
        required: ["question", "options"],
        additionalProperties: false,
        properties: {
          question: { type: "string" },
          options: { type: "array", items: { type: "string" }, maxItems: 4 },
        },
      },
    },
  },
});

/**
 * The starter and the questions for a description, from the cheapest allowed model. A failed
 * or malformed answer means no questions and no starter, so nothing is worse than before.
 */
export async function clarifyProject(options: {
  description: string;
  /** Each starter by name, with what it is (its app description) and its models. */
  starters: Record<string, { description: string; models: string[] }>;
  providers: Provider[];
  /** The language to ask in, when it is not the description's (a page's text is not the person's words). */
  askIn?: Language;
}): Promise<Clarification> {
  const usage: Usage[] = [];
  const names = Object.keys(options.starters);
  const provider = options.providers[0];
  if (!provider || names.length === 0) return { questions: [], usage };
  const list = names
    .map(
      (n) =>
        `- ${n}: ${options.starters[n]?.description ?? ""} Records: ${options.starters[n]?.models.join(", ")}.`,
    )
    .join("\n");
  const user = `Description: ${options.description}${questionsNote(options.description, options.askIn)}\n\nStarters:\n${list}`;
  try {
    const answer = (await completeJson(
      provider,
      { system: SYSTEM, user, schema: schema(names) },
      usage,
    )) as { starter?: unknown; questions?: unknown };
    const starter =
      typeof answer.starter === "string" && names.includes(answer.starter)
        ? answer.starter
        : undefined;
    const questions = Array.isArray(answer.questions)
      ? answer.questions
          .filter((q): q is Question => typeof q?.question === "string" && q.question.trim() !== "")
          .slice(0, 3)
          .map((q) => ({
            question: q.question.trim(),
            options: (Array.isArray(q.options) ? q.options : [])
              .filter((o) => typeof o === "string" && o.trim())
              .slice(0, 4),
          }))
      : [];
    return { ...(starter ? { starter } : {}), questions, usage };
  } catch {
    return { questions: [], usage };
  }
}

/** The description with the answers folded in, for the draft. */
export function describedWith(
  description: string,
  answers: { question: string; answer: string }[],
): string {
  const given = answers.filter((a) => a.answer.trim());
  if (given.length === 0) return description;
  return `${description}\n\nAnswers:\n${given.map((a) => `- ${a.question} ${a.answer.trim()}`).join("\n")}`;
}
