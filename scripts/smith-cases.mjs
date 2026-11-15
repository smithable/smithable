// The labelled turns of a benchmark conversation describe an already-applied change.
import {
  applyOperation,
  validateAuth,
  validateContent,
  validateSpec,
  validateUx,
} from "../packages/core/dist/index.js";
import { buildIndex, summarize } from "../packages/index/dist/index.js";

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
