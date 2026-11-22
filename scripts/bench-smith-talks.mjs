// Whole conversations with Smith. The person sees only their goal and the visible conversation.
// After the model-spend estimate is approved: node scripts/bench-smith-talks.mjs --paid --label LABEL
import { appendFileSync, existsSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { isDeepStrictEqual, parseArgs, parseEnv } from "node:util";
import { readHistory } from "../apps/studio/src/history.ts";
import {
  CutOffAnswerError,
  cached,
  completeJson,
  listPrice,
  openAICompatible,
} from "../packages/ai/dist/index.js";
import { applyOperations, YamlEditor } from "../packages/core/dist/index.js";
import { claudeRoute } from "./claude-route.mjs";
import { repo } from "./dev-app.mjs";
import {
  indexedProject,
  judgeFacts,
  recordingFolder,
  smithRequest,
  starterProject,
} from "./smith-cases.mjs";

const TURN_LIMIT = 12;

function changes(before, after, path = []) {
  if (isDeepStrictEqual(before, after)) return [];
  const maps = [before, after].every(
    (value) => value === undefined || (value && typeof value === "object" && !Array.isArray(value)),
  );
  if (!maps) return [path];
  return [...new Set([...Object.keys(before ?? {}), ...Object.keys(after ?? {})])].flatMap((key) =>
    changes(before?.[key], after?.[key], [...path, key]),
  );
}

function sourceValues(files) {
  return Object.fromEntries(
    Object.entries(files)
      .filter(([, text]) => typeof text === "string")
      .map(([file, text]) => [file, new YamlEditor(text).get([])]),
  );
}

const readAt = (values, path) => path.reduce((parent, key) => parent?.[key], values);

function visibleProposal(proposal) {
  switch (proposal.kind) {
    case "change":
      return {
        kind: "change",
        text: proposal.operations.map(({ description }) => description).join(". "),
        ...(proposal.note ? { note: proposal.note } : {}),
        buttons: ["Apply", "Cancel"],
      };
    case "question":
      return { kind: "question", text: proposal.question, buttons: proposal.options };
    case "answer":
      return { kind: "answer", text: proposal.text };
    case "none":
      return { kind: "refusal", text: proposal.reason };
    case "paused":
      return { kind: "failed", text: "Free building is paused." };
    default:
      return { kind: "failed", text: "Smith could not answer this request." };
  }
}

/** Run a full conversation on real checked project sources. Providers can be free fixtures. */
export async function runTalk(scenario, { project, person, providers, docsIndex, judge }) {
  const started = performance.now();
  const transcript = [];
  const conversation = [];
  const applied = [];
  const answers = [];
  const usage = [];
  const initial = sourceValues(project.files);
  let pending;
  let end = "turn limit";

  while (transcript.length < TURN_LIMIT) {
    let move;
    try {
      move = await person(
        {
          persona: scenario.persona,
          goal: scenario.goal,
          conversation: transcript.map(({ action, visible }) => ({ action, visible })),
        },
        usage,
      );
    } catch {
      end = "person unavailable";
      break;
    }
    if (move.action === "done" || move.action === "give up") {
      end = move.action;
      break;
    }
    const entry = { action: move, visible: undefined };
    transcript.push(entry);
    if (move.action === "accept" && pending?.proposal.kind === "change") {
      const before = project.files;
      const operations = pending.proposal.operations.map(({ op, args }) => ({ op, args }));
      const result = applyOperations(project.files, operations);
      if (result.ok) {
        project = indexedProject(result.files);
        applied.push({ before, after: project.files });
        entry.visible = { kind: "applied", text: `Done: ${pending.visible.text}.` };
        entry.operations = operations;
      } else entry.visible = { kind: "failed", text: result.message };
      conversation.push({ request: pending.request, reply: entry.visible.text });
      pending = undefined;
      continue;
    }
    if (move.action === "accept" && pending?.proposal.kind === "undo") {
      const latest = applied.findLast((change) => !change.undone);
      if (latest) {
        latest.undone = true;
        project = indexedProject(latest.before);
      }
      entry.visible = {
        kind: "undone",
        text: latest ? "Undid the last change." : "Nothing to undo.",
      };
      conversation.push({ request: pending.request, reply: entry.visible.text });
      pending = undefined;
      continue;
    }
    if (move.action === "decline" && pending) {
      entry.visible = { kind: "declined", text: "Nothing changed." };
      pending = undefined;
      continue;
    }
    if (move.action !== "say" || !move.text?.trim()) {
      entry.visible = { kind: "failed", text: "Choose a visible button or send Smith a message." };
      continue;
    }
    const words = move.text.trim().slice(0, 2000);
    const previous = pending;
    pending = undefined;
    const historyRequest = readHistory(words);
    if (historyRequest?.kind === "undo" && historyRequest.last) {
      if (applied.some((change) => !change.undone)) {
        entry.visible = {
          kind: "undo",
          text: "Undo the last change?",
          buttons: ["Undo", "Cancel"],
        };
        pending = { request: words, proposal: { kind: "undo" }, visible: entry.visible };
      } else entry.visible = { kind: "refusal", text: "Nothing to undo." };
      continue;
    }
    const request =
      previous?.proposal.kind === "question" && previous.proposal.options.includes(words)
        ? `${previous.request} (${words})`
        : words;
    const history = conversation.slice(-6).map(({ request, reply }) => ({
      request: request.slice(0, 500),
      reply: reply.slice(0, 500),
    }));
    const { ask, phraseUsage } = await smithRequest(
      project,
      request,
      providers,
      docsIndex,
      history,
    );
    const proposal = await ask();
    usage.push(...phraseUsage, ...proposal.usage);
    entry.visible = visibleProposal(proposal);
    if (proposal.kind === "change" || proposal.kind === "question")
      pending = { request, proposal, visible: entry.visible };
    else {
      conversation.push({ request, reply: entry.visible.text });
      if (proposal.kind === "answer" || proposal.kind === "none")
        answers.push({ question: request, text: entry.visible.text });
    }
    if (proposal.kind === "paused") {
      end = "paused";
      break;
    }
  }

  const final = sourceValues(project.files);
  const checks = (scenario.checks ?? []).map(({ path, equals, exists }) => {
    const actual = readAt(final, path);
    const right =
      exists === undefined ? isDeepStrictEqual(actual, equals) : (actual !== undefined) === exists;
    return { path, right };
  });
  if (scenario.unchanged) checks.push({ path: [], right: isDeepStrictEqual(initial, final) });
  if (scenario.minimumApplied)
    checks.push({ path: ["applied"], right: applied.length >= scenario.minimumApplied });
  if (scenario.undo)
    checks.push({ path: ["undo"], right: applied.some((change) => change.undone) });
  if (scenario.authUnchanged)
    checks.push({ path: ["auth"], right: isDeepStrictEqual(initial.auth, final.auth) });
  const facts = [];
  for (const requirement of scenario.answers ?? []) {
    const matches = answers.filter(({ question }) =>
      question.toLowerCase().includes(requirement.questionIncludes.toLowerCase()),
    );
    const result = matches.length
      ? await judgeFacts(
          matches.map(({ question }) => question).join("\n"),
          matches.map(({ text }) => text).join("\n"),
          requirement,
          judge,
        ).catch(() => ({ right: false, why: "The judge did not answer.", usage: [] }))
      : { right: false, why: "No matching answer.", usage: [] };
    usage.push(...result.usage);
    facts.push({ question: requirement.questionIncludes, right: result.right, why: result.why });
  }
  const reworked = applied.filter((change) => {
    if (change.undone) return true;
    const after = sourceValues(change.after);
    return changes(sourceValues(change.before), after).some(
      (path) => !isDeepStrictEqual(readAt(after, path), readAt(final, path)),
    );
  }).length;
  return {
    id: scenario.id,
    right: checks.every((check) => check.right) && facts.every((fact) => fact.right),
    turns: transcript.length,
    questions: transcript.filter((turn) => turn.visible?.kind === "question").length,
    applied: applied.length,
    reworked,
    end,
    tokens: usage.reduce((total, call) => total + call.inputTokens + call.outputTokens, 0),
    ms: Math.round(performance.now() - started),
    checks,
    facts,
    transcript,
  };
}

const actions = ["say", "accept", "decline", "done", "give up"];
const personSchema = {
  type: "object",
  properties: { action: { type: "string", enum: actions }, text: { type: "string" } },
  required: ["action", "text"],
  additionalProperties: false,
};

function personWith(provider) {
  return async (view, usage) => {
    const move = await completeJson(
      provider,
      {
        system:
          "Play the person using Smith. Follow the persona and pursue the goal one message at a time. You see only the visible conversation. Say a new short message or a visible question option with action say. Use accept or decline for a shown Apply, Undo or Cancel button. Use done when the goal is reached or give up if it is out of reach. Put words in text only when saying something.",
        user: JSON.stringify(view),
        schema: personSchema,
        maxOutputTokens: 400,
      },
      usage,
    );
    if (!actions.includes(move?.action) || typeof move.text !== "string")
      throw new Error("The person model did not return a valid move.");
    return { action: move.action, ...(move.action === "say" ? { text: move.text } : {}) };
  };
}

function keyFile(name) {
  return parseEnv(readFileSync(join(homedir(), ".config", "smithable", name), "utf8"));
}

function openAIPerson(name, key) {
  const price = /^gpt-4\.1-mini(?:-|$)/.test(name)
    ? { input: 0.4, output: 1.6 }
    : {
        input: Number(process.env.BENCH_PERSON_INPUT_PER_M),
        output: Number(process.env.BENCH_PERSON_OUTPUT_PER_M),
      };
  return {
    name,
    model: name,
    tier: "frontier",
    location: "elsewhere",
    price,
    currency: "USD",
    async complete({ system, user, schema, maxOutputTokens }) {
      const response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        signal: AbortSignal.timeout(90_000),
        headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: name,
          max_completion_tokens: maxOutputTokens,
          response_format: {
            type: "json_schema",
            json_schema: { name: "move", schema, strict: true },
          },
          messages: [
            { role: "system", content: system },
            { role: "user", content: user },
          ],
        }),
      });
      if (!response.ok) throw new Error(`The person model returned status ${response.status}.`);
      const body = await response.json();
      const completion = {
        text: body.choices?.[0]?.message?.content ?? "",
        model: body.model ?? name,
        inputTokens: body.usage?.prompt_tokens ?? 0,
        outputTokens: body.usage?.completion_tokens ?? 0,
      };
      if (body.choices?.[0]?.finish_reason === "length") throw new CutOffAnswerError(completion);
      return completion;
    },
  };
}

/** Reserve worst-case token usage before issuing a request, then settle metered usage. */
export function budgetGuard(limit) {
  let spent = 0;
  let refused = false;
  const cost = (input, output, rate) => (input * rate.input + output * rate.output) / 1e6;
  return {
    get used() {
      return spent;
    },
    get exhausted() {
      return refused;
    },
    wrap(provider) {
      const rate = provider.price;
      if (![rate.input, rate.output].every((price) => Number.isFinite(price) && price > 0))
        throw new Error(`No confirmed USD prices for ${provider.name}.`);
      return {
        ...provider,
        async complete(request) {
          const maximum = Math.min(request.maxOutputTokens ?? 1500, 1500);
          const bytes = Buffer.byteLength(JSON.stringify(request)) + 512;
          // Only successful HTTP completions are billed. If reply usage is missing, hold the reserve.
          const reserve = cost(bytes, maximum, rate);
          if (refused || spent + reserve >= limit) {
            refused = true;
            throw new Error("The conversation benchmark reached its request budget.");
          }
          spent += reserve;
          const settle = ({ inputTokens, outputTokens }) => {
            if (
              [inputTokens, outputTokens].every(Number.isFinite) &&
              inputTokens > 0 &&
              outputTokens >= 0
            )
              spent += cost(inputTokens, outputTokens, rate) - reserve;
          };
          try {
            const completion = await provider.complete({ ...request, maxOutputTokens: maximum });
            settle(completion);
            return completion;
          } catch (error) {
            if (error instanceof CutOffAnswerError) settle(error.completion);
            throw error;
          }
        },
      };
    },
  };
}

function report(label, rows) {
  const header = [
    `# Conversations with Smith: ${label}`,
    "",
    `${rows.filter(({ right }) => right).length} of ${rows.length} goals reached.`,
    "",
    "| Conversation | Goal reached | Turns | Questions | Applied | Reworked | End | Tokens | Seconds |",
    "| - | - | - | - | - | - | - | - | - |",
  ];
  const lines = rows.map(
    (row) =>
      `| ${row.id} | ${row.right ? "Yes" : "No"} | ${row.turns} | ${row.questions} | ${row.applied} | ${row.reworked} | ${row.end} | ${row.tokens} | ${(row.ms / 1000).toFixed(1)} |`,
  );
  return [...header, ...lines, ""].join("\n");
}

async function main() {
  const { values: options } = parseArgs({
    options: {
      help: { type: "boolean" },
      paid: { type: "boolean" },
      label: { type: "string" },
      only: { type: "string" },
      provider: { type: "string", default: "mistral" },
      setup: { type: "string", default: "small" },
      budget: { type: "string", default: "1.90" },
      record: { type: "string" },
      replay: { type: "string" },
    },
  });
  const { label, paid, record, replay, provider, setup } = options;
  if (options.help) {
    console.log(
      "node scripts/bench-smith-talks.mjs --label LABEL (--paid [--record DIR] | --replay DIR) [--only ID,ID] [--provider mistral|claude] [--setup small|small>better|better] [--budget USD]",
    );
    return;
  }
  if (
    !label ||
    !/^[a-z0-9_-]+$/i.test(label) ||
    Boolean(paid) === Boolean(replay) ||
    (record && !paid)
  )
    throw new Error("Use --label LABEL and either --paid [--record DIR] or --replay DIR.");
  if (
    !["mistral", "claude"].includes(provider) ||
    !["small", "small>better", "better"].includes(setup)
  )
    throw new Error(
      "Choose a bench-smith provider and setup: mistral or claude, small, small>better or better.",
    );
  const limit = Number(options.budget);
  if (!(limit > 0 && limit < 2)) throw new Error("The run budget must be below 2 USD.");
  const dir = join(repo, "docs", "benchmarks");
  const path = join(dir, `bench-smith-talks-${label}`);
  const partial = `${path}.partial.jsonl`;
  if (existsSync(`${path}.jsonl`)) throw new Error("The report label already exists.");
  const { conversations } = JSON.parse(readFileSync(join(dir, "smith-talks.json"), "utf8"));
  const only = options.only?.split(",");
  const scenarios = conversations.filter(({ id }) => !only || only.includes(id));
  if (!scenarios.length || only?.some((id) => !scenarios.some((scenario) => scenario.id === id)))
    throw new Error("No benchmark scenario has that name.");
  const docsIndex = JSON.parse(readFileSync(join(repo, "site", "search.json"), "utf8"));
  const projects = scenarios.map((scenario) => starterProject(repo, scenario.starter));
  if (replay && !existsSync(replay)) throw new Error("The recording directory does not exist.");
  const openai = paid ? keyFile("openai.env").OPENAI_API_KEY : undefined;
  const mistralEnv = paid && provider === "mistral" ? keyFile("mistral.env") : {};
  const mistral = mistralEnv.MISTRAL_API_KEY ?? mistralEnv.SMITHABLE_MODEL_KEY;
  if (paid && (!openai || (provider === "mistral" && !mistral)))
    throw new Error("A required provider key is missing.");
  const route =
    paid && provider === "claude" ? await claudeRoute({ respectOutputLimit: true }) : undefined;
  const budget = budgetGuard(limit);
  let replayMisses = 0;
  const recording = record || replay ? recordingFolder(record ?? replay) : undefined;
  const wrap = (model) => {
    if (replay)
      return cached(
        {
          ...model,
          async complete() {
            replayMisses++;
            throw new Error("The model request was not recorded.");
          },
        },
        recording,
      );
    const guarded = budget.wrap(model);
    return recording ? cached(guarded, recording) : guarded;
  };
  try {
    const model = (name, tier) => {
      const list = listPrice(name);
      if (paid && !list) throw new Error(`No list price for ${name}.`);
      const price = provider === "claude" && list ? { ...list, input: list.input * 1.25 } : list;
      return wrap({
        ...openAICompatible({
          name,
          model: name,
          tier,
          price,
          baseUrl: provider === "mistral" ? "https://api.mistral.ai/v1" : (route?.url ?? ""),
          apiKey: mistral,
          location: provider === "mistral" ? "eu" : "elsewhere",
        }),
        currency: "USD",
      });
    };
    const small =
      process.env.BENCH_SMALL ??
      (provider === "mistral" ? "mistral-small-latest" : "claude-haiku-5-5");
    const better =
      process.env.BENCH_BETTER ??
      (provider === "mistral" ? "mistral-medium-latest" : "claude-sonnet-5-5");
    const judgeName = process.env.BENCH_JUDGE ?? better;
    if (judgeName === small) throw new Error("Use a judge other than the small model.");
    const providers = [
      ...(setup === "better" ? [] : [model(small, "smithable")]),
      ...(setup === "small" ? [] : [model(better, "frontier")]),
    ];
    const judge = model(judgeName, "frontier");
    const person = personWith(
      wrap(openAIPerson(process.env.BENCH_PERSON ?? "gpt-4.1-mini", openai)),
    );
    writeFileSync(partial, "", { flag: "wx" });
    const rows = [];
    for (const [index, scenario] of scenarios.entries()) {
      const row = await runTalk(scenario, {
        project: projects[index],
        person,
        providers,
        docsIndex,
        judge,
      });
      rows.push(row);
      appendFileSync(partial, `${JSON.stringify(row)}\n`);
      console.log(`${scenario.id}: ${row.right ? "goal reached" : row.end}`);
      if (budget.exhausted) break;
    }
    renameSync(partial, `${path}.jsonl`);
    writeFileSync(`${path}.md`, report(label, rows));
    if (paid) console.log(`Usage charged or reserved privately: ${budget.used.toFixed(6)} USD.`);
    if (budget.exhausted) {
      console.error("The benchmark stopped at its budget.");
      process.exitCode = 1;
    }
    if (replayMisses) {
      console.error(`${replayMisses} replay requests were missing from the recording.`);
      process.exitCode = 1;
    }
  } finally {
    await route?.close();
  }
}

if (import.meta.main) {
  await main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
