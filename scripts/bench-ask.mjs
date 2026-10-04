// bench-ask (docs/design/assistant.md §9): the questions of bench-ask-questions.mjs put to an app's
// assistant tools at /mcp, with a key, by a model. Per model: right or wrong, model calls per
// question, tokens in and out, cost and time, and how big the tools are.
//   node scripts/bench-ask.mjs <model>… [--starter crm,status] [--label today]
//   models: eu.anthropic.… (Amazon Bedrock, EU), mistral-… (Mistral's API); ask before running.
// Each starter is made, offers everything to programs and assistants (setApi all), gets an admin
// key, and is served; questions that change records each start from the starter's records again.
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
const only = option("--only")?.split(",").map(Number);
// --score: the stored answers judged again (after the judging changed), without asking anything.
const rescore = args.includes("--score");
if (!models.length && !rescore) throw new Error("Name the models: eu.anthropic.… or mistral-….");
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

/** One question: the model asks for tools until it answers, at most MAX_CALLS model calls. */
async function ask(model, call, tools, system, question) {
  const messages = [
    { role: "user", content: model.startsWith("eu.anthropic.") ? [{ text: question }] : question },
  ];
  let calls = 0;
  let toolCalls = 0;
  let tokensIn = 0;
  let tokensOut = 0;
  let resultTokens = 0;
  const trace = [];
  while (calls < MAX_CALLS) {
    calls++;
    const turn = await call(system, messages, tools.list);
    tokensIn += turn.tokensIn;
    tokensOut += turn.tokensOut;
    messages.push(turn.message);
    if (!turn.calls.length)
      return { text: turn.text, calls, toolCalls, tokensIn, tokensOut, resultTokens, trace };
    const done = [];
    for (const c of turn.calls) {
      toolCalls++;
      try {
        const r = await tools.run("tools/call", { name: c.name, arguments: c.input ?? {} });
        const text = (r.content ?? []).map((x) => x.text ?? "").join("\n");
        resultTokens += Math.ceil(text.length / 4);
        done.push({ id: c.id, name: c.name, text, error: r.isError });
        trace.push(
          `${c.name}(${JSON.stringify(c.input ?? {}).slice(0, 120)})${r.isError ? ` → ${text.slice(0, 160)}` : ""}`,
        );
      } catch (error) {
        done.push({ id: c.id, name: c.name, text: String(error.message), error: true });
        trace.push(`${c.name} → ${String(error.message).slice(0, 160)}`);
      }
    }
    messages.push(...results(model, done));
  }
  return { text: "", calls, toolCalls, tokensIn, tokensOut, resultTokens, trace, gaveUp: true };
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
      !["error", "gave up", "skipped"].includes(r.outcome)
    )
      r.outcome = answered(question, r.answer ?? "", r.expected) ? "right" : "wrong";
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
  op(dir, "setApi", "all", "--actions", "all", "--assistants", "true");
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
  const list = (await run("tools/list")).tools;
  const tools = { list, run };
  const deletes = list.some((t) => /^delete_|^remove_/.test(t.name));
  if (!sizes[starter]) {
    sizes[starter] = {
      type: "size",
      starter,
      tools: list.length,
      tokens: Math.ceil(JSON.stringify(list).length / 4),
    };
    keep(sizes[starter]);
  }
  const system = `You are the assistant in the app "${ir.app.name}". Answer the person's question or make the change they ask for, using the tools. Today is ${today}. Answer briefly, in plain text.`;
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
        : null;
    if (!call) throw new Error(`${model}: eu.anthropic.… or mistral-….`);
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
          r = await ask(model, call, tools, system, question.q);
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
        if (question.kind === "change")
          right = Boolean(question.check(await records(base, key, ir), before));
        else {
          expected = question.expect(before);
          right = answered(question, r.text, expected);
        }
        const [pin, pout] = price(model);
        const row = {
          model,
          starter,
          n: i + 1,
          q: question.q,
          outcome: r.error ? "error" : r.gaveUp ? "gave up" : right ? "right" : "wrong",
          expected,
          answer: r.text.replace(/\s+/g, " "),
          calls: r.calls,
          toolCalls: r.toolCalls,
          tokensIn: r.tokensIn,
          tokensOut: r.tokensOut,
          resultTokens: r.resultTokens,
          trace: r.trace,
          cost: (r.tokensIn * pin + r.tokensOut * pout) / 1e6,
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
  return `| ${m} | ${k("right")} / ${rows.length} (${Math.round((100 * k("right")) / Math.max(1, rows.length))} %) | ${k("wrong")} | ${k("gave up") + k("error")} | ${avg((r) => r.calls).toFixed(1)} | ${lookups} / ${reads.length} | ${Math.round(avg((r) => r.tokensIn)).toLocaleString("en")} / ${Math.round(avg((r) => r.tokensOut)).toLocaleString("en")} | ${Math.round(avg((r) => r.resultTokens)).toLocaleString("en")} | $${avg((r) => r.cost).toFixed(4)} | ${avg((r) => r.seconds).toFixed(1)} s |`;
});
const report = `# bench-ask: ${label} (${today})

The questions of [bench-ask-questions.mjs](../../scripts/bench-ask-questions.mjs), asked of each starter's assistant tools at \`/mcp\` with an administrator's key ([bench-ask.mjs](../../scripts/bench-ask.mjs)), by each model: it calls tools until it answers (at most ${MAX_CALLS} model calls). A read is right when its answer gives the number, names, words or pairs worked out from the records; a change is right when the records afterwards say so. Each change starts from the starter's records.

| Model | Right | Wrong | Gave up or failed | Model calls per question | Reads in one or two calls | Tokens in / out per question | Tool results per question (tokens) | Cost per question | Time |
|---|---|---|---|---|---|---|---|---|---|
${totals.join("\n")}

The tools each starter offers (\`tools/list\`, about four characters a token):

| Starter | Tools | Their size (tokens) |
|---|---|---|
${Object.entries(sizes)
  .map(([s, x]) => `| ${s} | ${x.tools} | ${x.tokens.toLocaleString("en")} |`)
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
      `| ${r.model} | ${r.starter} | ${r.n} | ${cell(QUESTIONS[r.starter][r.n - 1].q)} | ${r.outcome}${r.note ? ` (${cell(r.note)})` : ""} | ${cell(r.expected === undefined ? "" : JSON.stringify(r.expected))} | ${cell(String(r.answer ?? "").slice(0, 240))} |`,
  )
  .join("\n")}
`;
const file = `docs/benchmarks/bench-ask-${label}.md`;
writeFileSync(join(repo, file), report);

console.log(`\nWrote ${file}.`);
