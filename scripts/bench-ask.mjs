// bench-ask (docs/design/assistant.md §9): the questions of bench-ask-questions.mjs put to an app's
// assistant tools at /mcp, with a key, by a model. Per model: right or wrong, model calls per
// question, tokens in and out, cost and time, and how big the tools are.
//   node scripts/bench-ask.mjs <model>… [--starter crm,status] [--label today] [--voice friendly]
//   models: eu.anthropic.… (Amazon Bedrock, EU), mistral-… (Mistral's API), or the hosted
//   assistant's cascade, cascade:mistral-small-latest>eu.anthropic.…; ask before running.
// Each starter is made, offers everything to programs and assistants (setApi all), gets an admin
// key, and is served; questions that change records each start from the starter's records again.
// --voice sets Ask's voice (setAssistantVoice) and gives the model the generated kit's line for it,
// to see that the manner costs no accuracy (docs/design/ask-defaults.md §5).
// Writes docs/benchmarks/bench-ask-<label>.md.
import { spawnSync } from "node:child_process";
import { createHash, randomBytes } from "node:crypto";
import {
  appendFileSync,
  copyFileSync,
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { createRequire } from "node:module";
import { homedir, tmpdir } from "node:os";
import { join } from "node:path";
import { answered, QUESTIONS } from "./bench-ask-questions.mjs";
import { newApp, op, repo, serveDev } from "./dev-app.mjs";

const { kebab, plural, validateSpec } = await import(join(repo, "packages/core/dist/index.js"));
const args = process.argv.slice(2);
const option = (name) => (args.includes(name) ? args[args.indexOf(name) + 1] : undefined);
const models = args.filter((a, i) => !a.startsWith("--") && !args[i - 1]?.startsWith("--"));
const starters = option("--starter")?.split(",") ?? Object.keys(QUESTIONS);
const label = option("--label") ?? "today";
const voice = option("--voice");
const only = option("--only")?.split(",").map(Number);
// --score: the stored answers judged again (after the judging changed), without asking anything.
const rescore = args.includes("--score");
if (!models.length && !rescore)
  throw new Error("Name the models: eu.anthropic.…, mistral-… or cascade:<cheap>><better>.");
const PORT = 6470;
const MAX_CALLS = 8;

// Prices per million tokens, in dollars: Bedrock's EU profiles (eu-north-1) and Mistral's list.
const PRICES = [
  [/claude-sonnet-4-6/, [3.3, 16.5]],
  [/claude-haiku-4-5/, [1.1, 5.5]],
  [/mistral-small/, [0.15, 0.6]],
  [/mistral-medium/, [1.5, 7.5]],
];
const price = (model) => PRICES.find(([re]) => re.test(model))?.[1] ?? [0, 0];

const keyFile = (file) =>
  Object.fromEntries(
    readFileSync(join(homedir(), ".config/smithable", file), "utf8")
      .split("\n")
      .map((line) => /^(?:export\s+)?([A-Z_]+)=(.*)$/.exec(line.trim()))
      .filter(Boolean)
      .map(([, key, value]) => [key, value.replace(/^["']|["']$/g, "")]),
  );

// ── The app's tools at /mcp ─────────────────────────────────────────────────

/** A request to the app, tried again twice when the dev server drops the connection. */
async function appFetch(url, init) {
  for (let i = 0; ; i++) {
    try {
      return await fetch(url, init);
    } catch (error) {
      if (i >= 2) throw error;
      await new Promise((r) => setTimeout(r, 2000));
    }
  }
}

function mcp(base, key) {
  let next = 1;
  return async (method, params = {}) => {
    const response = await appFetch(`${base}/mcp`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json, text/event-stream",
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({ jsonrpc: "2.0", id: next++, method, params }),
    });
    const body = await response.json().catch(() => ({}));
    if (body.error) throw new Error(`${method}: ${body.error.message}`);
    if (!body.result) throw new Error(`${method}: HTTP ${response.status}, no result`);
    return body.result;
  };
}

// ── The models: one call each, in their own forms ──────────────────────────

/** Claude through Bedrock's Converse API, with the tools as tool specs. */
function bedrock(model) {
  return async (system, messages, tools) => {
    const dir = mkdtempSync(join(tmpdir(), "bench-ask-"));
    try {
      const input = join(dir, "input.json");
      writeFileSync(
        input,
        JSON.stringify({
          modelId: model,
          system: [{ text: system }],
          messages: messages.map((m) => ({ role: m.role, content: m.content })),
          toolConfig: {
            tools: tools.map((t) => ({
              toolSpec: {
                name: t.name,
                description: t.description ?? t.name,
                inputSchema: { json: t.inputSchema },
              },
            })),
          },
          inferenceConfig: { maxTokens: 2000, temperature: 0 },
        }),
      );
      const out = spawnSync(
        "aws",
        [
          "bedrock-runtime",
          "converse",
          "--region",
          "eu-north-1",
          "--cli-input-json",
          `file://${input}`,
          "--output",
          "json",
        ],
        { encoding: "utf8", maxBuffer: 64 << 20 },
      );
      if (out.status !== 0) throw new Error(out.stderr || out.stdout);
      const result = JSON.parse(out.stdout);
      const content = result.output.message.content;
      return {
        message: { role: "assistant", content },
        calls: content
          .filter((c) => c.toolUse)
          .map((c) => ({ id: c.toolUse.toolUseId, name: c.toolUse.name, input: c.toolUse.input })),
        text: content.map((c) => c.text ?? "").join(""),
        tokensIn: result.usage.inputTokens,
        tokensOut: result.usage.outputTokens,
      };
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  };
}

/** Mistral's chat completions, with the tools as functions. */
function mistral(model) {
  const key = keyFile("mistral.env").SMITHABLE_MODEL_KEY;
  return async (system, messages, tools) => {
    const response = await fetch("https://api.mistral.ai/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model,
        temperature: 0,
        messages: [{ role: "system", content: system }, ...messages],
        tools: tools.map((t) => ({
          type: "function",
          function: {
            name: t.name,
            description: t.description ?? t.name,
            parameters: t.inputSchema,
          },
        })),
      }),
    });
    const body = await response.json();
    if (!response.ok) throw new Error(JSON.stringify(body).slice(0, 400));
    const message = body.choices[0].message;
    return {
      message: {
        role: "assistant",
        content: message.content ?? "",
        ...(message.tool_calls ? { tool_calls: message.tool_calls } : {}),
      },
      calls: (message.tool_calls ?? []).map((c) => ({
        id: c.id,
        name: c.function.name,
        input: JSON.parse(c.function.arguments || "{}"),
      })),
      text: typeof message.content === "string" ? message.content : "",
      tokensIn: body.usage.prompt_tokens,
      tokensOut: body.usage.completion_tokens,
    };
  };
}

/**
 * The hosted assistant's cascade (smithable-cloud service/src/gateway.ts, backlog B 35), named
 * `cascade:<cheap>><better>`: a question starts on the cheap model and goes on to the better one
 * when the cheap one is seen failing: two tool calls refused, a fourth model call (the kit's last
 * round), or an answer that gives up, which is asked again of the better model. Once there, the
 * question stays there. An answer the app's check finds ungrounded twice moves too, as the
 * gateway does on the kit's `x-assistant-ask: ungrounded` (cloud #202). The conversation is kept
 * in the cheap model's (OpenAI) shape and turned into Converse's for Claude (a Mistral better model
 * takes it as it is). Each turn says what it cost, at its own model's price, and why it moved.
 */
function cascade(cheap, better) {
  const GIVE_UP =
    /\b(I (cannot|can't|can not|am unable|'m unable|don't have (access|the ability))|unable to (find|answer|help|access)|jag kan (inte|tyvärr inte))\b/i;
  const callCheap = mistral(cheap);
  // Strict's cascade is Mistral to Mistral (Small, then Medium): the same shape, nothing to turn.
  const callBetter = better.startsWith("mistral-") ? mistral(better) : bedrock(better);
  const onBetter = new WeakSet();
  const cost = (model, t) => {
    const [pin, pout] = price(model);
    return (t.tokensIn * pin + t.tokensOut * pout) / 1e6;
  };
  const converse = (messages) => {
    const out = [];
    for (const m of messages) {
      if (m.role === "user" || m.role === "system")
        out.push({ role: "user", content: [{ text: m.content }] });
      else if (m.role === "assistant")
        out.push({
          role: "assistant",
          content: [
            ...(m.content ? [{ text: m.content }] : []),
            ...(m.tool_calls ?? []).map((c) => ({
              toolUse: {
                toolUseId: c.id,
                name: c.function.name,
                input: JSON.parse(c.function.arguments || "{}"),
              },
            })),
          ],
        });
      else {
        const result = {
          toolResult: { toolUseId: m.tool_call_id, content: [{ text: m.content }] },
        };
        const last = out.at(-1);
        if (last?.role === "user" && last.content[0]?.toolResult) last.content.push(result);
        else out.push({ role: "user", content: [result] });
      }
    }
    return out;
  };
  const askBetter = async (system, messages, tools) => {
    if (better.startsWith("mistral-")) {
      const turn = await callBetter(system, messages, tools);
      return { ...turn, cost: cost(better, turn) };
    }
    const turn = await callBetter(system, converse(messages), tools);
    return {
      ...turn,
      message: {
        role: "assistant",
        content: turn.text,
        ...(turn.calls.length
          ? {
              tool_calls: turn.calls.map((c) => ({
                id: c.id,
                type: "function",
                function: { name: c.name, arguments: JSON.stringify(c.input ?? {}) },
              })),
            }
          : {}),
      },
      cost: cost(better, turn),
    };
  };
  return async (system, messages, tools) => {
    if (onBetter.has(messages)) return askBetter(system, messages, tools);
    const rounds = messages.filter((m) => m.role === "assistant" && m.tool_calls?.length).length;
    const why = messages.ungrounded
      ? "ungrounded"
      : (messages.refused ?? 0) >= 2
        ? "refused"
        : rounds >= 3
          ? "rounds"
          : undefined;
    if (why) {
      onBetter.add(messages);
      return { ...(await askBetter(system, messages, tools)), moved: why };
    }
    const turn = { ...(await callCheap(system, messages, tools)) };
    turn.cost = cost(cheap, turn);
    const words = turn.text.trim();
    const toolsAnswered = messages.some((m) => m.role === "tool");
    if (!turn.calls.length && (words ? GIVE_UP.test(words) : !toolsAnswered)) {
      onBetter.add(messages);
      const again = await askBetter(system, messages, tools);
      return {
        ...again,
        tokensIn: turn.tokensIn + again.tokensIn,
        tokensOut: turn.tokensOut + again.tokensOut,
        cost: turn.cost + again.cost,
        moved: "gave up",
      };
    }
    return turn;
  };
}

/** The tool results as the model's next message. */
function results(model, done) {
  return model.startsWith("eu.anthropic.")
    ? [
        {
          role: "user",
          content: done.map((r) => ({
            toolResult: {
              toolUseId: r.id,
              content: [{ text: r.text }],
              ...(r.error ? { status: "error" } : {}),
            },
          })),
        },
      ]
    : done.map((r) => ({ role: "tool", tool_call_id: r.id, name: r.name, content: r.text }));
}

/** The writes the app's tools make; at /mcp they are done, in the kit only proposed. */
const WRITES = /^(add|change|delete|remove|run)(_|$)/;

/**
 * One question: the model asks for tools until it answers, at most MAX_CALLS model calls. With the
 * app's answer check (its kit's grounded.ts, ask-checks.md §3), as the kit's loop runs it: an
 * answer that is not grounded goes back once with why, then once more marked (the cascade moves it
 * to the better model), and is then shown as not confirmed; each check adds a call to the limit.
 */
async function ask(model, call, tools, system, question, check) {
  const messages = [
    { role: "user", content: model.startsWith("eu.anthropic.") ? [{ text: question }] : question },
  ];
  let calls = 0;
  let toolCalls = 0;
  let tokensIn = 0;
  let tokensOut = 0;
  let resultTokens = 0;
  let cost;
  let moved;
  let checks = 0;
  const steps = [];
  const trace = [];
  while (calls < MAX_CALLS + checks) {
    calls++;
    const turn = await call(system, messages, tools.list);
    tokensIn += turn.tokensIn;
    tokensOut += turn.tokensOut;
    if (turn.cost !== undefined) cost = (cost ?? 0) + turn.cost;
    moved ??= turn.moved;
    messages.push(turn.message);
    const why = !turn.calls.length && turn.text.trim() && check?.(turn.text, question, steps);
    if (why && checks < 2) {
      checks++;
      trace.push(`check: ${why}`);
      messages.push(
        model.startsWith("eu.anthropic.")
          ? { role: "user", content: [{ text: why }] }
          : { role: "system", content: why },
      );
      if (checks === 2) messages.ungrounded = true;
      continue;
    }
    if (!turn.calls.length)
      return {
        text: turn.text,
        calls,
        toolCalls,
        tokensIn,
        tokensOut,
        resultTokens,
        trace,
        cost,
        moved,
        checks: check ? checks : undefined,
        unconfirmed: Boolean(why) || undefined,
      };
    const done = [];
    for (const c of turn.calls) {
      toolCalls++;
      try {
        const r = await tools.run("tools/call", { name: c.name, arguments: c.input ?? {} });
        const text = (r.content ?? []).map((x) => x.text ?? "").join("\n");
        resultTokens += Math.ceil(text.length / 4);
        done.push({ id: c.id, name: c.name, text, error: r.isError });
        let result;
        try {
          result = JSON.parse(text);
        } catch {
          result = text;
        }
        steps.push(
          r.isError
            ? { tool: c.name, args: c.input ?? {}, error: text }
            : { tool: c.name, args: c.input ?? {}, result, proposed: WRITES.test(c.name) },
        );
        trace.push(
          `${c.name}(${JSON.stringify(c.input ?? {}).slice(0, 120)})${r.isError ? ` → ${text.slice(0, 160)}` : ""}`,
        );
      } catch (error) {
        done.push({ id: c.id, name: c.name, text: String(error.message), error: true });
        steps.push({ tool: c.name, args: c.input ?? {}, error: String(error.message) });
        trace.push(`${c.name} → ${String(error.message).slice(0, 160)}`);
      }
    }
    messages.push(...results(model, done));
    // For the cascade: the tool calls the app refused so far.
    messages.refused = (messages.refused ?? 0) + done.filter((d) => d.error).length;
  }
  return {
    text: "",
    calls,
    toolCalls,
    tokensIn,
    tokensOut,
    resultTokens,
    trace,
    gaveUp: true,
    cost,
    moved,
    checks: check ? checks : undefined,
  };
}

// ── The apps ────────────────────────────────────────────────────────────────

/** Every model's records as the API gives them, by the admin key. */
async function records(base, key, ir) {
  const d = {};
  for (const m of ir.models) {
    const rows = [];
    for (let page = 1; page < 50; page++) {
      const r = await appFetch(`${base}/api/v1/${kebab(plural(m.name))}?limit=100&page=${page}`, {
        headers: { Authorization: `Bearer ${key}` },
      });
      if (!r.ok) break;
      const body = await r.json();
      rows.push(...body.items);
      if (page >= body.pages) break;
    }
    d[m.name] = rows;
  }
  return d;
}

/** An administrator and a key for them, written into the app's database as the app would. */
function adminKey(dir) {
  const Database = createRequire(join(dir, "package.json"))("better-sqlite3");
  const db = new Database(join(dir, "data/db/app.db"));
  const now = Date.now();
  db.prepare(
    "insert or ignore into user (id, name, email, email_verified, role, created_at, updated_at) values (?, ?, ?, 1, 'admin', ?, ?)",
  ).run("bench-admin", "Bench admin", "bench@example.org", now, now);
  const key = `smk_${randomBytes(24).toString("base64url")}`;
  db.prepare(
    "insert into api_key (name, role, hash, prefix, created_by_id, created_at) values (?, 'admin', ?, ?, 'bench-admin', ?)",
  ).run("bench-ask", createHash("sha256").update(key).digest("hex"), key.slice(0, 10), now);
  // Into the database file itself, not only its write-ahead log: the reset copies the file.
  db.pragma("wal_checkpoint(TRUNCATE)");
  db.close();
  return key;
}

// Every answer is written down as soon as it is judged, so a run that stops can go on later.
const log = join(repo, `docs/benchmarks/bench-ask-${label}.jsonl`);
const results_ = existsSync(log)
  ? readFileSync(log, "utf8")
      .split("\n")
      .filter(Boolean)
      .map((l) => JSON.parse(l))
  : [];
const done = (model, starter, n) =>
  results_.some((r) => r.model === model && r.starter === starter && r.n === n);
const sizes = Object.fromEntries(
  results_.filter((r) => r.type === "size").map((r) => [r.starter, r]),
);
const keep = (row) => {
  results_.push(row);
  appendFileSync(log, `${JSON.stringify(row)}\n`);
};
const today = new Date().toISOString().slice(0, 10);
if (rescore) {
  for (const r of results_) {
    const question = r.type ? undefined : QUESTIONS[r.starter][r.n - 1];
    if (question?.skip) Object.assign(r, { outcome: "skipped", note: question.skip });
    else if (
      question &&
      question.kind !== "change" &&
      r.expected !== undefined &&
      // Answers kept whole only (early rows kept 240 characters: their judgement then stands).
      (r.full || (r.answer ?? "").length < 239) &&
      !["error", "gave up", "skipped"].includes(r.outcome)
    )
      r.outcome = answered(question, r.answer ?? "", r.expected, r.also) ? "right" : "wrong";
  }
  writeFileSync(log, results_.map((r) => JSON.stringify(r)).join("\n") + "\n");
  models.push(...new Set(results_.filter((r) => r.model).map((r) => r.model)));
}
for (const starter of rescore ? [] : starters) {
  if (
    sizes[starter] &&
    models.every((m) =>
      QUESTIONS[starter].every(
        (_, i) => (only && !only.includes(i + 1)) || done(m, starter, i + 1),
      ),
    )
  )
    continue;
  const dir = newApp(starter, `ask-${starter}`);
  // Keys are made on a users page; a starter without one gets it.
  const spec0 = validateSpec({
    path: "smithable.yml",
    text: readFileSync(join(dir, "smithable.yml"), "utf8"),
  }).ir;
  if (!spec0.pages.some((p) => p.pattern.kind === "users"))
    op(dir, "addUsersPage", "team", "/team");
  if (voice) op(dir, "setAssistantVoice", voice);
  // Deleting too, where setApi can say so (--assistants-delete, #276).
  try {
    op(
      dir,
      "setApi",
      "all",
      "--actions",
      "all",
      "--assistants",
      "true",
      "--assistants-delete",
      "true",
    );
  } catch {
    op(dir, "setApi", "all", "--actions", "all", "--assistants", "true");
  }
  // The app migrates its database when it starts: once, so the keys' table is there.
  (await serveDev(dir, PORT))();
  const key = adminKey(dir);
  const pristine = join(dir, "..", "pristine.db");
  copyFileSync(join(dir, "data/db/app.db"), pristine);
  const ir = validateSpec({
    path: "smithable.yml",
    text: readFileSync(join(dir, "smithable.yml"), "utf8"),
  }).ir;
  const base = `http://localhost:${PORT}`;
  let stop = await serveDev(dir, PORT);
  const run = mcp(base, key);
  // The app's summary, when it gives one (the server's instructions), goes with the tools.
  const instructions =
    (
      await run("initialize", {
        protocolVersion: "2025-03-26",
        capabilities: {},
        clientInfo: { name: "bench-ask", version: "1" },
      })
    ).instructions ?? "";
  const list = (await run("tools/list")).tools;
  const tools = { list, run };
  const deletes = list.some((t) => /^(delete|remove)(_|$)/.test(t.name));
  if (!sizes[starter]) {
    sizes[starter] = {
      type: "size",
      starter,
      tools: list.length,
      tokens: Math.ceil(JSON.stringify(list).length / 4),
      summary: Math.ceil(instructions.length / 4),
    };
    keep(sizes[starter]);
  }
  // The voice's line as the generated app gives it to its model.
  const voiceLine =
    voice &&
    new RegExp(`${voice}: "([^"]+)"`).exec(
      readFileSync(join(dir, "src/kit/assistant.server.ts"), "utf8"),
    )?.[1];
  if (voice && !voiceLine) throw new Error(`No line for the voice ${voice} in the app's kit.`);
  const system = `You are the assistant in the app "${ir.app.name}". Answer the person's question or make the change they ask for, using the tools. Today is ${today}. Answer briefly, in plain text.${voiceLine ? ` ${voiceLine}` : ""}${instructions ? `\n\n${instructions}` : ""}`;
  // The app's answer check, when its kit has one: grounded.ts bundled by the app's own esbuild
  // (Vite's, since the app does not depend on it directly; grounded.ts imports ./words without an
  // extension), with the kinds of record named as the app names them.
  let check;
  if (existsSync(join(dir, "src/kit/grounded.ts"))) {
    const out = join(dir, "..", "grounded.mjs");
    const vite = createRequire(join(dir, "package.json")).resolve("vite");
    await createRequire(vite)("esbuild").build({
      entryPoints: [join(dir, "src/kit/grounded.ts")],
      bundle: true,
      format: "esm",
      platform: "node",
      outfile: out,
      logLevel: "error",
    });
    const { ungrounded } = await import(out);
    const words = (name) => name.replace(/([a-z])([A-Z])/g, "$1 $2").toLowerCase();
    const kinds = ir.models.map((m) => ({
      label: words(m.name),
      pluralLabel: words(plural(m.name)),
    }));
    check = (text, q, steps) => ungrounded(text, q, steps, kinds);
  }
  const reset = async () => {
    stop();
    copyFileSync(pristine, join(dir, "data/db/app.db"));
    rmSync(join(dir, "data/db/app.db-wal"), { force: true });
    rmSync(join(dir, "data/db/app.db-shm"), { force: true });
    stop = await serveDev(dir, PORT);
  };
  const before = await records(base, key, ir);
  for (const model of models) {
    const call = model.startsWith("eu.anthropic.")
      ? bedrock(model)
      : model.startsWith("mistral-")
        ? mistral(model)
        : model.startsWith("cascade:")
          ? cascade(...model.slice("cascade:".length).split(">"))
          : null;
    if (!call) throw new Error(`${model}: eu.anthropic.…, mistral-… or cascade:<cheap>><better>.`);
    for (const [i, question] of QUESTIONS[starter].entries()) {
      if ((only && !only.includes(i + 1)) || done(model, starter, i + 1)) continue;
      if (question.skip) {
        keep({ model, starter, n: i + 1, q: question.q, outcome: "skipped", note: question.skip });
        continue;
      }
      const deleting =
        question.kind === "change" && /^(delete|remove|take .* off)/i.test(question.q);
      if (deleting && !deletes) {
        keep({
          model,
          starter,
          n: i + 1,
          q: question.q,
          outcome: "skipped",
          note: "no delete tool",
        });
        continue;
      }
      const started = Date.now();
      try {
        if (question.kind === "change") await reset();
        let r;
        try {
          r = await ask(model, call, tools, system, question.q, check);
        } catch (error) {
          r = {
            text: "",
            calls: 0,
            toolCalls: 0,
            tokensIn: 0,
            tokensOut: 0,
            resultTokens: 0,
            error: String(error.message).slice(0, 200),
          };
        }
        let right;
        let expected;
        let also;
        if (question.kind === "change")
          right = Boolean(question.check(await records(base, key, ir), before));
        else {
          expected = question.expect(before);
          also = question.also?.expect(before);
          right = answered(question, r.text, expected, also);
        }
        const [pin, pout] = price(model);
        const row = {
          model,
          starter,
          n: i + 1,
          q: question.q,
          outcome: r.error ? "error" : r.gaveUp ? "gave up" : right ? "right" : "wrong",
          expected,
          also,
          full: true,
          answer: r.text.replace(/\s+/g, " "),
          calls: r.calls,
          toolCalls: r.toolCalls,
          tokensIn: r.tokensIn,
          tokensOut: r.tokensOut,
          resultTokens: r.resultTokens,
          trace: r.trace,
          cost: r.cost ?? (r.tokensIn * pin + r.tokensOut * pout) / 1e6,
          moved: r.moved,
          checks: r.checks,
          unconfirmed: r.unconfirmed,
          seconds: (Date.now() - started) / 1000,
          note: r.error,
        };
        keep(row);
        console.log(
          `${model} ${starter} ${i + 1}: ${row.outcome} · ${row.calls} calls · ${row.tokensIn}+${row.tokensOut} tokens · $${row.cost.toFixed(4)}`,
        );
      } catch (error) {
        // The app failed (not the model): written down as such, and the app started again.
        keep({
          model,
          starter,
          n: i + 1,
          q: question.q,
          outcome: "error",
          note: `app: ${String(error.message).slice(0, 160)}`,
          calls: 0,
          toolCalls: 0,
          tokensIn: 0,
          tokensOut: 0,
          resultTokens: 0,
          cost: 0,
          seconds: (Date.now() - started) / 1000,
        });
        await reset().catch(() => {});
      }
    }
    await reset();
  }
  stop();
}

// ── Report ──────────────────────────────────────────────────────────────────

const cell = (s) => String(s ?? "").replaceAll("|", "\\|");
// Correctness apart from valid tool calls (C 25): a tool call that failed is in the trace with its
// error after "→"; a wrong answer either states something as fact or says the model could not tell.
const toolErrors = (r) => (r.trace ?? []).filter((t) => t.includes(" → ")).length;
const allValid = (r) => r.toolCalls > 0 && toolErrors(r) === 0;
const unsure = (r) =>
  /\b(could not|couldn't|can't|cannot|unable|not sure|don't know|do not know|did you mean|which one)\b/i.test(
    r.answer ?? "",
  );
const wrongKind = (r) =>
  r.unconfirmed ? "shown as not confirmed" : unsure(r) ? "said unsure" : "stated as fact";
/** A question whose answer is a count, sum or average over records. */
const adds = (q) =>
  q.kind === "pairs" ||
  (q.kind === "number" &&
    /how many|total|together|average|in all|owe|still to be paid|cost together/i.test(q.q));
/** Worked out by the model itself: no tool of the app's that counts or adds was called. */
const byModel = (r) =>
  !(r.trace ?? []).some((t) => /^(measure|count|sum|total|aggregate|summar)/i.test(t));
const totals = models.map((m) => {
  const rows = results_.filter((r) => r.model === m && r.outcome !== "skipped");
  const k = (o) => rows.filter((r) => r.outcome === o).length;
  // Rows taken over from a run's log lack some numbers (time, result size): averaged over those that have them.
  const avg = (f) => {
    const v = rows.map(f).filter(Number.isFinite);
    return v.length ? v.reduce((s, x) => s + x, 0) / v.length : 0;
  };
  const reads = rows.filter((r) => !QUESTIONS[r.starter][r.n - 1].kind.startsWith("change"));
  const lookups = reads.length ? reads.filter((r) => r.calls <= 2).length : 0;
  const added = rows.filter(
    (r) => r.outcome === "wrong" && adds(QUESTIONS[r.starter][r.n - 1]) && byModel(r),
  ).length;
  const wrong = rows.filter((r) => r.outcome === "wrong");
  const asFact = wrong.filter((r) => !unsure(r) && !r.unconfirmed).length;
  const valid = rows.filter(allValid);
  const validRight = valid.filter((r) => r.outcome === "right").length;
  return `| ${m} | ${k("right")} / ${rows.length} (${Math.round((100 * k("right")) / Math.max(1, rows.length))} %) | ${k("wrong")} | ${asFact} | ${added} | ${validRight} / ${valid.length} | ${k("gave up") + k("error")} | ${avg((r) => r.calls).toFixed(1)} | ${lookups} / ${reads.length} | ${Math.round(avg((r) => r.tokensIn)).toLocaleString("en")} / ${Math.round(avg((r) => r.tokensOut)).toLocaleString("en")} | ${Math.round(avg((r) => r.resultTokens)).toLocaleString("en")} | $${avg((r) => r.cost).toFixed(4)} | ${avg((r) => r.seconds).toFixed(1)} s |`;
});
const report = `# bench-ask: ${label} (${today})${voice ? `, voice ${voice}` : ""}

The questions of [bench-ask-questions.mjs](../../scripts/bench-ask-questions.mjs), asked of each starter's assistant tools at \`/mcp\` with an administrator's key ([bench-ask.mjs](../../scripts/bench-ask.mjs)), by each model: it calls tools until it answers (at most ${MAX_CALLS} model calls). A read is right when its answer gives the number, names, words or pairs worked out from the records; a change is right when the records afterwards say so. Each change starts from the starter's records.

Correctness is judged on the answer's facts against the records (a count, a name or id found, a record changed), never on the tool calls: a confident answer that is wrong counts as wrong. "Stated as fact" is a wrong answer given as true, such as a total, a name or "there is no such invoice", rather than one saying the model could not tell; it is the kind a person would act on. "Right when every tool call was valid" counts the questions whose tool calls all succeeded, and how many of them were answered right: valid calls are not a right answer.

| Model | Right | Wrong | Of them, stated as fact | Of them, a count or sum the model worked out | Right when every tool call was valid | Gave up or failed | Model calls per question | Reads in one or two calls | Tokens in / out per question | Tool results per question (tokens) | Cost per question | Time |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
${totals.join("\n")}
${models
  .filter((m) => m.startsWith("cascade:"))
  .map((m) => {
    const rows = results_.filter((r) => r.model === m && r.outcome !== "skipped");
    const up = rows.filter((r) => r.moved);
    const by = (w) => up.filter((r) => r.moved === w).length;
    const right = (rs) => rs.filter((r) => r.outcome === "right").length;
    return `\n**${m}** moved ${up.length} of ${rows.length} questions to the better model (${by("refused")} after two refused tool calls, ${by("rounds")} at the fourth call, ${by("gave up")} after an answer that gave up, ${by("ungrounded")} after an answer the check sent back twice); ${right(up)} of them were then right. Of the ${rows.length - up.length} that stayed on the cheap model, ${right(rows.filter((r) => !r.moved))} were right.\n`;
  })
  .join("")}${models
  .map((m) => {
    const rows = results_.filter((r) => r.model === m && r.checks !== undefined);
    if (!rows.length) return "";
    const back = rows.filter((r) => r.checks > 0);
    const shown = rows.filter((r) => r.unconfirmed);
    const of = (rs, o) => rs.filter((r) => r.outcome === o).length;
    return `\n**${m}**, the app's answer check (ask-checks.md §3): ${back.length} of ${rows.length} answers went back to the model; ${back.length - shown.length} of them came back grounded (${of(
      back.filter((r) => !r.unconfirmed),
      "right",
    )} right). ${shown.length} were shown as not confirmed: ${of(shown, "wrong")} wrong and ${of(shown, "right")} right. A wrong answer shown as not confirmed is not counted as stated as fact.\n`;
  })
  .join("")}
The tools each starter offers (\`tools/list\`, about four characters a token):

| Starter | Tools | Their size (tokens) | The app's summary (tokens) |
|---|---|---|---|
${Object.entries(sizes)
  .map(
    ([s, x]) =>
      `| ${s} | ${x.tools} | ${x.tokens.toLocaleString("en")} | ${(x.summary ?? 0).toLocaleString("en")} |`,
  )
  .join("\n")}

## Per starter

| Starter | ${models.join(" | ")} |
|---|${models.map(() => "---").join("|")}|
${starters
  .map(
    (s) =>
      `| ${s} | ${models
        .map((m) => {
          const rows = results_.filter(
            (r) => r.model === m && r.starter === s && r.outcome !== "skipped",
          );
          return `${rows.filter((r) => r.outcome === "right").length} / ${rows.length}`;
        })
        .join(" | ")} |`,
  )
  .join("\n")}

## Not right

| Model | Starter | # | Question | Outcome | Expected | Answer |
|---|---|---|---|---|---|---|
${results_
  .filter((r) => r.model && r.outcome !== "right")
  .map(
    (r) =>
      `| ${r.model} | ${r.starter} | ${r.n} | ${cell(QUESTIONS[r.starter][r.n - 1].q)} | ${r.outcome}${r.outcome === "wrong" ? ` (${wrongKind(r)})` : ""}${r.note ? ` (${cell(r.note)})` : ""} | ${cell(r.expected === undefined ? "" : JSON.stringify(r.expected))} | ${cell(String(r.answer ?? "").slice(0, 240))} |`,
  )
  .join("\n")}
`;
const file = `docs/benchmarks/bench-ask-${label}.md`;
writeFileSync(join(repo, file), report);

console.log(`\nWrote ${file}.`);
