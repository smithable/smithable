// The labelled turns of a benchmark conversation describe an already-applied change.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { completeJson, proposeChange, searchPhrases } from "../packages/ai/dist/index.js";
import {
  applyOperation,
  validateAuth,
  validateContent,
  validateSpec,
  validateUx,
} from "../packages/core/dist/index.js";
import {
  appParts,
  buildContext,
  buildIndex,
  searchDocsWith,
  specLines,
  summarize,
} from "../packages/index/dist/index.js";

export const sourceFiles = {
  spec: "smithable.yml",
  auth: "smithable.auth.yml",
  content: "smithable.content.yml",
  ux: "smithable.ux.yml",
};

export function starterProject(repo, starter) {
  return indexedProject(
    Object.fromEntries(
      Object.entries(sourceFiles).flatMap(([key, name]) => {
        const path = join(repo, "examples", starter, name);
        return existsSync(path) ? [[key, readFileSync(path, "utf8")]] : [];
      }),
    ),
  );
}

export function recordingFolder(dir) {
  mkdirSync(dir, { recursive: true });
  return {
    get: async (key) =>
      existsSync(join(dir, `${key}.json`))
        ? readFileSync(join(dir, `${key}.json`), "utf8")
        : undefined,
    set: async (key, value) => writeFileSync(join(dir, `${key}.json`), value),
  };
}

/** Both benches ask Smith with the app and the parts of the docs that Studio gives it. */
export async function smithRequest(project, request, providers, docsIndex, conversation = []) {
  const phraseUsage = [];
  const asked =
    /\?\s*$/.test(request) ||
    /^(how|where|what|why|can i|is there|hur|var|vad|varför|kan jag|finns det)\b/i.test(
      request.trim(),
    );
  const phrases =
    asked && providers[0] ? await searchPhrases(providers[0], request, phraseUsage) : [];
  const docs = searchDocsWith(docsIndex, request, phrases);
  const lines = specLines(project.files.spec, request);
  const ask = () =>
    proposeChange({
      request,
      files: project.files,
      context: buildContext(project.index, request),
      providers,
      docs,
      app: `${appParts(project.summary, request)}${lines ? `\n\nIts lines in smithable.yml:\n${lines}` : ""}`,
      ...(conversation.length ? { conversation } : {}),
    });
  return { ask, docs, phraseUsage };
}

export async function judgeFacts(question, answer, facts, provider) {
  const { must = [], mustNot = [] } = facts;
  if (!must.length && !mustNot.length) return { right: true, usage: [] };
  const usage = [];
  const result = await completeJson(
    provider,
    {
      system:
        'You judge an answer against facts. Reply with JSON {"right":true|false,"why":"…"}: right only when the answer states every fact under must (in any words) and none under mustNot.',
      user: `Question: ${question}\nAnswer: ${answer}\nmust: ${JSON.stringify(must)}\nmustNot: ${JSON.stringify(mustNot)}`,
      schema: {
        type: "object",
        properties: { right: { type: "boolean" }, why: { type: "string" } },
        required: ["right", "why"],
        additionalProperties: false,
      },
    },
    usage,
  );
  return { ...result, usage };
}

export function indexedProject(files) {
  const ir = validateSpec({ path: "smithable.yml", text: files.spec }).ir;
  if (!ir) throw new Error("Invalid benchmark spec");
  const auth =
    files.auth && validateAuth({ path: "smithable.auth.yml", text: files.auth }, ir).auth;
  const content =
    files.content &&
    validateContent({ path: "smithable.content.yml", text: files.content }, ir).content;
  const ux = files.ux && validateUx({ path: "smithable.ux.yml", text: files.ux }, ir).ux;
  return {
    files,
    index: buildIndex({ ir, generated: {}, custom: [] }),
    summary: summarize(ir, auth || undefined, content || undefined, [], ux || undefined),
  };
}

/** Resolve history from the FULL set, even when --only selects just the follow-up. */
export function requestProject(base, request, all) {
  const turns = [];
  const seen = new Set([request.id]);
  let turn = request;
  while (turn.after) {
    const previous = all.find((r) => r.id === turn.after);
    if (!previous || seen.has(previous.id) || previous.starter !== request.starter)
      throw new Error(`Invalid predecessor for ${turn.id}: ${turn.after}`);
    seen.add(previous.id);
    turns.unshift(previous);
    turn = previous;
  }
  let files = base.files;
  for (const previous of turns) {
    const ops = previous.fixture?.operations ?? previous.outcome.operations ?? [];
    if (ops.length > 1)
      throw new Error(`The predecessor ${previous.id} needs explicit per-operation arguments`);
    for (const op of ops) {
      const result = applyOperation(files, op, previous.outcome.args ?? {});
      if (!result.ok) throw new Error(`Invalid predecessor ${previous.id}: ${result.message}`);
      files = result.files;
    }
  }
  return {
    ...(files === base.files ? base : indexedProject(files)),
    conversation: turns.map((t) => ({ request: t.text, reply: "" })),
  };
}

/** Only explicitly labelled, concrete alternatives may replace a proposed change with a question. */
export function acceptsQuestion(label, proposal) {
  const readings = label.acceptQuestion?.readings;
  if (
    proposal.kind !== "question" ||
    !readings ||
    readings.length < 2 ||
    proposal.options.length < 2
  )
    return false;
  // Both readings must be offered as different choices, not merely words in a generic question.
  const choices = proposal.options.map((s) => s.toLowerCase());
  const matches = (terms, choice) => terms.some((term) => choice.includes(term.toLowerCase()));
  return (
    readings.length === 2 &&
    choices.some(
      (choice, i) =>
        matches(readings[0], choice) &&
        choices.some((other, j) => i !== j && matches(readings[1], other)),
    )
  );
}
