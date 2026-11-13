// bench-smith (T731): what people say to Smith (docs/benchmarks/smith-requests.json), the ones the
// rules pass on put to the configured models, per setup: small alone, small then better, better
// alone. A change is judged by rule (the operations' names); an answer by a judging model on the
// facts it must and must not state. Per kind: right, wrong, tokens, cost, time.
//   node scripts/bench-smith.mjs [small] [small>better] [better] [haiku] [--label today] [--only id,id]
//   node scripts/bench-smith.mjs --rules    the rules alone, no model, free
// The models are Claude's by default, as the hosted service answers: small claude-haiku-5-5, better
// and judge claude-sonnet-5-5, through scripts/claude-route.mjs (the key in ~/.config/smithable/claude.env,
// never printed). --provider mistral: small mistral-small-latest, better and judge mistral-medium-latest
// (the key in ~/.config/smithable/mistral.env). BENCH_SMALL, BENCH_BETTER and BENCH_JUDGE name others.
// The judge is never the small model under test.
// haiku is Claude Haiku through Anthropic's API (BENCH_HAIKU, claude-haiku-4-5, the hosted
// service's model), its key read from ~/.config/smithable/claude.env and never printed.
// Smith's reading (T755): the docs' parts by docs.smithable.ai's own index (site/search.json,
// built by `pnpm site` first) and the app's summary parts, both searched as Studio does; for a
// docs question the row says whether its labelled part ("docs") was among those found.
// Not part of check; ask before a paid run (C runs it daily within the bench budget).
// Writes docs/benchmarks/bench-smith-<label>.md and .jsonl.
import { appendFileSync, existsSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { claudeRoute } from "./claude-route.mjs";
import { repo } from "./dev-app.mjs";

const { validateAuth, validateContent, validateSpec, validateUx } = await import(
  join(repo, "packages/core/dist/index.js")
);
const { appParts, buildContext, buildIndex, searchDocs, summarize } = await import(
  join(repo, "packages/index/dist/index.js")
);
const { proposeChange, openAICompatible, listPrice } = await import(
  join(repo, "packages/ai/dist/index.js")
);

const args = process.argv.slice(2);
const option = (name) => (args.includes(name) ? args[args.indexOf(name) + 1] : undefined);
const rulesOnly = args.includes("--rules");
const setups = args.filter((a, i) => !a.startsWith("--") && !args[i - 1]?.startsWith("--"));
const label = option("--label") ?? (rulesOnly ? "rules" : "today");
const only = option("--only")?.split(",");
if (!rulesOnly && !setups.length)
  throw new Error("Name the setups: small, small>better, better (or --rules for no model).");

const set = JSON.parse(readFileSync(join(repo, "docs/benchmarks/smith-requests.json"), "utf8"));
const requests = set.requests.filter((r) => !only || only.includes(r.id));

/** Mistral's key, read from its file and never printed. */
const mistralKey = () => {
  const text = readFileSync(join(homedir(), ".config/smithable/mistral.env"), "utf8");
  const key = /(?:MISTRAL_API_KEY|SMITHABLE_MODEL_KEY)=["']?([^"'\n]+)/.exec(text)?.[1];
  if (!key) throw new Error("No Mistral key in ~/.config/smithable/mistral.env");
  return key;
};
const provider = option("--provider") ?? "claude";
if (!["claude", "mistral"].includes(provider))
  throw new Error("--provider takes claude or mistral.");
const route = provider === "claude" && !rulesOnly ? await claudeRoute() : undefined;
const model = (name, tier) => {
  if (provider === "mistral")
    return openAICompatible({
      name,
      baseUrl: "https://api.mistral.ai/v1",
      model: name,
      apiKey: mistralKey(),
      tier,
      location: "eu",
    });
  if (!listPrice(name)) throw new Error(`No list price for ${name} in packages/ai (listPrice)`);
  return openAICompatible({ name, baseUrl: route.url, model: name, tier, location: "elsewhere" });
};
const SMALL =
  process.env.BENCH_SMALL ?? (provider === "claude" ? "claude-haiku-5-5" : "mistral-small-latest");
const BETTER =
  process.env.BENCH_BETTER ??
  (provider === "claude" ? "claude-sonnet-5-5" : "mistral-medium-latest");
const JUDGE = process.env.BENCH_JUDGE ?? BETTER;
if (!rulesOnly && JUDGE === SMALL)
  throw new Error("The judge must not be the small model under test.");
const HAIKU = process.env.BENCH_HAIKU ?? "claude-haiku-4-5";

/** Claude's key, read from its file and never printed. */
const claudeKey = () => {
  const text = readFileSync(join(homedir(), ".config/smithable/claude.env"), "utf8");
  const key = /^(?:export\s+)?[A-Za-z_]*(?:API_KEY|api_key)=["']?([^"'\n]+)/m.exec(text)?.[1];
  if (!key) throw new Error("No key in ~/.config/smithable/claude.env");
  return key;
};

/** Claude through Anthropic's Messages API, the answer's JSON as a forced tool call. */
const claude = (name) => ({
  name,
  tier: "smithable",
  location: "elsewhere",
  model: name,
  price: { input: 1, output: 5 },
  currency: "USD",
  async complete(request) {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": claudeKey(),
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: name,
        max_tokens: 4000,
        system: [{ type: "text", text: request.system, cache_control: { type: "ephemeral" } }],
        messages: [{ role: "user", content: request.user }],
        tools: [{ name: "answer", description: "The answer.", input_schema: request.schema }],
        tool_choice: { type: "tool", name: "answer" },
      }),
    });
    const body = await response.json();
    if (!response.ok)
      throw new Error(`${name} answered ${response.status}: ${JSON.stringify(body).slice(0, 300)}`);
    const call = (body.content ?? []).find((c) => c.type === "tool_use");
    return {
      text: JSON.stringify(call?.input ?? {}),
      model: name,
      inputTokens:
        (body.usage?.input_tokens ?? 0) +
        (body.usage?.cache_read_input_tokens ?? 0) +
        (body.usage?.cache_creation_input_tokens ?? 0),
      outputTokens: body.usage?.output_tokens ?? 0,
    };
  },
});
const providersOf = (setup) =>
  setup === "haiku"
    ? [claude(HAIKU)]
    : setup === "small"
      ? [model(SMALL, "smithable")]
      : setup === "better"
        ? [model(BETTER, "frontier")]
        : setup === "small>better"
          ? [model(SMALL, "smithable"), model(BETTER, "frontier")]
          : (() => {
              throw new Error(`Unknown setup "${setup}": small, small>better, better or haiku.`);
            })();

/** A starter's files as Studio reads them. */
const files = new Map();
const project = (starter) => {
  if (!files.has(starter)) {
    const read = (name) => {
      try {
        return readFileSync(join(repo, "examples", starter, name), "utf8");
      } catch {
        return undefined;
      }
    };
    const spec = read("smithable.yml");
    const f = { spec };
    for (const [key, name] of [
      ["auth", "smithable.auth.yml"],
      ["content", "smithable.content.yml"],
      ["ux", "smithable.ux.yml"],
    ])
      if (read(name)) f[key] = read(name);
    const ir = validateSpec({ path: "smithable.yml", text: spec }).ir;
    const auth = f.auth && validateAuth({ path: "smithable.auth.yml", text: f.auth }, ir).auth;
    const content =
      f.content && validateContent({ path: "smithable.content.yml", text: f.content }, ir).content;
    const ux = f.ux && validateUx({ path: "smithable.ux.yml", text: f.ux }, ir).ux;
    files.set(starter, {
      files: f,
      index: buildIndex({ ir, generated: {}, custom: [] }),
      summary: summarize(ir, auth || undefined, content || undefined, [], ux || undefined),
    });
  }
  return files.get(starter);
};

/** The docs' index as the site builds it; the bench needs it (`pnpm site`). */
const docsIndex = (() => {
  try {
    return JSON.parse(readFileSync(join(repo, "site/search.json"), "utf8"));
  } catch {
    throw new Error("No site/search.json: run `pnpm site` first.");
  }
})();
/** Whether a found part is one of a docs question's labelled parts (a page alone: any of its parts). */
const isLabelled = (url, labels) => {
  const at = url.replace("https://docs.smithable.ai/", "");
  return labels.some((d) => at === d || (!d.includes("#") && at.split("#")[0] === d));
};

/** A judging model on an answer: does it state each must and none of the mustNots? */
async function judge(r, text) {
  const must = r.outcome.must ?? [];
  const mustNot = r.outcome.mustNot ?? [];
  if (!must.length && !mustNot.length) return { right: true };
  const judging = model(JUDGE, "frontier");
  const usage = [];
  const { completeJson } = await import(join(repo, "packages/ai/dist/index.js"));
  const verdict = await completeJson(
    judging,
    {
      system:
        'You judge an answer against facts. Reply with JSON {"right":true|false,"why":"…"}: right only when the answer states every fact under must (in any words) and none under mustNot.',
      user: `Question: ${r.text}\nAnswer: ${text}\nmust: ${JSON.stringify(must)}\nmustNot: ${JSON.stringify(mustNot)}`,
      schema: {
        type: "object",
        properties: { right: { type: "boolean" }, why: { type: "string" } },
        required: ["right", "why"],
        additionalProperties: false,
      },
    },
    usage,
  );
  return { ...verdict, usage };
}

/** Whether what came back is right for the request's label. */
async function scored(r, p) {
  const kind = r.kind;
  if (p.kind === "failed") return { right: false, why: p.message };
  // The app's own page, pointed to or asked about, instead of a second one (T760).
  if (r.outcome.existingPage)
    return {
      right:
        p.kind === "question" ||
        (p.kind === "answer" && p.text.includes(r.outcome.existingPage)) ||
        (p.kind === "none" && p.reason.includes(r.outcome.existingPage)),
      why: p.kind,
    };
  if (kind === "change" || kind === "two-things") {
    // "Cannot as asked" is right only where nothing was to be added (already there).
    if (p.kind === "none")
      return { right: !(r.outcome.operations ?? []).length, why: `none: ${p.reason}` };
    if (p.kind !== "change") return { right: false, why: `${p.kind}` };
    // A plan that must hold these, whatever else it has (T760: a page's access).
    // Who the plan grants pages to (T760): the roles it must and must never.
    if (r.outcome.granted || r.outcome.notGranted) {
      const roles = p.operations.filter((o) => o.op === "grant").map((o) => String(o.args.role));
      const missing = (r.outcome.granted ?? []).filter((x) => !roles.includes(x));
      const wrong = (r.outcome.notGranted ?? []).filter((x) => roles.includes(x));
      return {
        right: !missing.length && !wrong.length,
        why: [missing.length && `not granted ${missing}`, wrong.length && `granted ${wrong}`]
          .filter(Boolean)
          .join("; "),
      };
    }
    if (r.outcome.operationsInclude) {
      const ops = p.operations.map((o) => o.op);
      const missing = r.outcome.operationsInclude.filter((op) => !ops.includes(op));
      return { right: !missing.length, why: missing.length ? `no ${missing.join(", ")}` : "" };
    }
    const got = [...new Set(p.operations.map((o) => o.op))].sort().join();
    const wanted = [...new Set(r.outcome.operations ?? [])].sort().join();
    return { right: got === wanted, why: got === wanted ? "" : `${got} for ${wanted}` };
  }
  if (kind === "ambiguous") return { right: p.kind === "question", why: p.kind };
  if (kind === "custom-code") return { right: p.kind === "none", why: p.kind };
  if (kind === "data") return { right: p.kind !== "change", why: p.kind };
  if (kind === "spec-question" || kind === "docs-question") {
    if (p.kind !== "answer") return { right: false, why: p.kind };
    // A judge that fails is a wrong mark with the reason, never a crash that prints the request.
    return judge(r, p.text).catch((error) => ({
      right: false,
      why: `judge failed: ${error.message}`,
    }));
  }
  // smalltalk, off-topic: an answer, no change.
  return { right: p.kind === "answer", why: p.kind };
}

// Each row is written as it comes (<out>.partial.jsonl), so a stopped run keeps its work: the next
// run with the same label takes those rows and asks only the rest (2026-11-13: 245 of 275 were lost).
const out = join(repo, `docs/benchmarks/bench-smith-${label}`);
const partial = `${out}.partial.jsonl`;
const rows = existsSync(partial)
  ? readFileSync(partial, "utf8")
      .split("\n")
      .filter(Boolean)
      .flatMap((line) => {
        // A run stopped mid-write leaves a cut last line: that request is asked again.
        try {
          return [JSON.parse(line)];
        } catch {
          return [];
        }
      })
  : [];
// Written back whole, so a cut line is gone before new rows follow it.
if (existsSync(partial)) writeFileSync(partial, rows.map((r) => `${JSON.stringify(r)}\n`).join(""));
if (rows.length) console.log(`${rows.length} rows kept from ${partial}`);
for (const setup of rulesOnly ? ["rules"] : setups) {
  const providers = rulesOnly ? [] : providersOf(setup);
  for (const r of requests) {
    // Undo, redo and feedback are Studio's own rules before Smith (apps/studio's test).
    if (r.kind === "undo" || r.kind === "feedback") continue;
    if (rows.some((x) => x.setup === setup && x.id === r.id)) continue;
    const { files: f, index, summary } = project(r.starter);
    const docs = searchDocs(docsIndex, r.text);
    const before = r.after ? requests.find((x) => x.id === r.after) : undefined;
    const started = Date.now();
    // A provider's rate limit (429) is the bench's pace, not the model's answer: the request is
    // asked again after a wait, up to four times (2026-11-13: 119 of small's 275 hit it).
    const ask = () =>
      proposeChange({
        request: r.text,
        files: f,
        context: buildContext(index, r.text),
        providers,
        docs,
        app: appParts(summary, r.text),
        ...(before ? { conversation: [{ request: before.text, reply: "" }] } : {}),
      });
    let p = await ask();
    for (
      let wait = 10;
      p.kind === "failed" && /\b429\b|rate limit/i.test(JSON.stringify(p));
      wait *= 2
    ) {
      if (wait > 80) break;
      await new Promise((done) => setTimeout(done, wait * 1000));
      p = await ask();
    }
    const byRule = !p.usage.length && p.kind !== "failed";
    // --rules is free: a rule's answer is scored by its kind, as the unit test does, no judge.
    const score = !rulesOnly
      ? await scored(r, p)
      : !byRule
        ? { right: false, why: "needs a model" }
        : p.kind === "answer"
          ? {
              right: (p.generator === "small talk" ? "smalltalk" : "spec-question") === r.kind,
              why: p.generator ?? "",
            }
          : await scored(r, p);
    const usage = [...p.usage, ...(score.usage ?? [])];
    const row = {
      setup,
      id: r.id,
      kind: r.kind,
      language: r.language,
      byRule,
      got: p.kind,
      right: score.right,
      why: score.why ?? "",
      tokens: usage.reduce((n, u) => n + u.inputTokens + u.outputTokens, 0),
      cost: usage.reduce((n, u) => n + u.cost, 0),
      ms: Date.now() - started,
      ...(r.docs ? { found: docs.some((d) => isLabelled(d.url, r.docs)) } : {}),
    };
    rows.push(row);
    appendFileSync(partial, `${JSON.stringify(row)}\n`);
    process.stdout.write(score.right ? "." : "x");
  }
  process.stdout.write("\n");
}

writeFileSync(`${out}.jsonl`, `${rows.map((r) => JSON.stringify(r)).join("\n")}\n`);
rmSync(partial, { force: true });
const kinds = [...new Set(rows.map((r) => r.kind))].sort();
const lines = [
  `# What people say to Smith: ${label}`,
  "",
  `${new Date().toISOString().slice(0, 10)}, ${requests.length} requests of docs/benchmarks/smith-requests.json (undo and feedback are Studio's rules, not here). ${rulesOnly ? "No model." : `Small: ${SMALL}; better: ${BETTER}; judge: ${JUDGE}. Cost in US dollars at the models' list prices.`}`,
  "",
  "| Setup | Kind | Right | Of | By rule | Docs found | Tokens | Cost | Seconds |",
  "|---|---|---|---|---|---|---|---|---|",
];
for (const setup of [...new Set(rows.map((r) => r.setup))])
  for (const kind of kinds) {
    const of = rows.filter((r) => r.setup === setup && r.kind === kind);
    if (!of.length) continue;
    const sum = (k) => of.reduce((n, r) => n + r[k], 0);
    lines.push(
      `| ${setup} | ${kind} | ${of.filter((r) => r.right).length} | ${of.length} | ${of.filter((r) => r.byRule).length} | ${of.some((r) => "found" in r) ? of.filter((r) => r.found).length : ""} | ${sum("tokens")} | ${sum("cost").toFixed(4)} | ${(sum("ms") / 1000).toFixed(1)} |`,
    );
  }
lines.push("", "Wrong ones:", "");
for (const r of rows.filter((x) => !x.right))
  lines.push(
    `- ${r.setup} ${r.id} (${r.kind}): ${r.got}${r.found === false ? ", docs part not found" : ""}${r.why ? `, ${r.why}` : ""}`,
  );
writeFileSync(`${out}.md`, `${lines.join("\n")}\n`);
await route?.close();
console.log(`${out}.md`);
