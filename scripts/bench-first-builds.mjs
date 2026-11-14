// bench-first-builds (T756 point 7): first builds from a description, scored by rule against
// labelled facts (docs/benchmarks/first-builds.json, or --set PATH for the held-out set). Each
// description is built per tier with `smithable new --describe … --yes` and its questions taken from
// `smithable clarify`; the spec that comes out is scored:
//   must     each model (by name or label, alternatives with |) and its fields (by name or label and
//            type family), each page (id, route or title) and role, each access line tried on the
//            spec's own rules, sign-in (none, optional, required) and the app's language
//   mustNot  models that must not be there; kinds that must not be public
//   leaks    a mustNot public kind that is public, or a mayNot access line the rules allow: a hard
//            failure of the build, counted and listed apart, never averaged into the must share
//   open     the questions asked against the labelled open points (each point's words)
//   extra    models and pages built beyond the labels, reported, not scored
//   validates and generates; tokens and cost per build
// The landing text's fit (`taste`) is for a judging model, scored apart; not in this script yet.
//   node scripts/bench-first-builds.mjs [reader] [small] [small>better] [--set PATH] [--only fb-01,fb-02]
//     [--label today] [--max-cost USD] [--record DIR] [--replay DIR [--replay-from REC]]
// allowance-used: free; Studio's fallback when its model refuses (the allowance used up), with a
// stub model on this machine: the starter its questions step picks, replaced from the description.
// reader: no model, free: the description reader alone, or (when it cannot build) the starter `new`
// names instead, as a person without a model would start. small: Claude Haiku 5.5. small>better:
// Haiku and Sonnet 5.5, as the hosted service drafts (a first build takes the strongest first, so
// Sonnet drafts and Haiku stands behind it). Both through Anthropic's API (SMITHABLE_FRONTIER=
// anthropic; the key in ~/.config/smithable/claude.env, never printed). Ask before a paid run.
// Writes docs/benchmarks/first-builds-<label>.md and .jsonl.
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { basename, join } from "node:path";
import { repo } from "./dev-app.mjs";

const { validateAuth, validateContent, validateSpec } = await import(
  join(repo, "packages/core/dist/index.js")
);
const cli = join(repo, "packages/cli/dist/bin.js");
const args = process.argv.slice(2);
const option = (name) => (args.includes(name) ? args[args.indexOf(name) + 1] : undefined);
const tiers = args.filter((a, i) => !a.startsWith("--") && !args[i - 1]?.startsWith("--"));
if (!tiers.length) throw new Error("Name the tiers: reader, small, small>better.");
const setPath = option("--set") ?? join(repo, "docs/benchmarks/first-builds.json");
const set = JSON.parse(readFileSync(setPath, "utf8"));
const only = option("--only")?.split(",");
const items = set.descriptions.filter((d) => !only || only.includes(d.id));
const label = option("--label") ?? new Date().toISOString().slice(0, 10);
// --max-cost USD: stop before the next build once the run has spent this much (half again over its
// estimate, as agreed for paid rounds); what was built so far is written as usual.
const maxCost = option("--max-cost") ? Number(option("--max-cost")) : Number.POSITIVE_INFINITY;
let stopped = false;
const replay = option("--replay");
if (replay && option("--record")) throw new Error("--replay and --record do not go together.");

/**
 * For the allowance-used tier: a model on this machine that answers every call 402 with the
 * service's words, so Studio's fallback (the starter, kept as private as the description asks)
 * runs without spending anything.
 */
const refusing = await (async () => {
  if (!tiers.includes("allowance-used")) return undefined;
  const { createServer } = await import("node:http");
  const server = createServer((req, res) => {
    req.resume();
    res.writeHead(402, { "content-type": "application/json" });
    res.end(JSON.stringify({ error: { message: "The AI allowance for today is used up." } }));
  });
  await new Promise((done) => server.listen(0, "127.0.0.1", done));
  return { url: `http://127.0.0.1:${server.address().port}/v1`, close: () => server.close() };
})();
const { openQuestions } = await import(join(repo, "packages/cli/dist/new.js"));
const { replaceProject } = await import(join(repo, "packages/cli/dist/replace.js"));

/**
 * Studio's way for a description when its model cannot draft: the starter its questions step picks
 * (no model asked), made as a project, then replaced from the description, with the model refusing.
 */
async function studioFallback(dir, text) {
  const saved = { ...process.env };
  const without = envOf("reader");
  for (const k of Object.keys(process.env)) if (!(k in without)) delete process.env[k];
  // The environment is put back however this ends, a failed new or a throw included.
  let starter = "crm";
  try {
    starter = (await openQuestions(text)).starter ?? "crm";
    const made = spawnSync("node", [cli, "new", dir, "--starter", starter], {
      cwd: repo,
      encoding: "utf8",
      env: without,
    });
    if (made.status !== 0)
      return {
        status: made.status ?? 1,
        out: made.error?.message ?? `${made.stdout}${made.stderr}`,
        starter,
      };
    Object.assign(process.env, envOf("allowance-used"));
    let out = "";
    const io = { out: (t) => (out += t), err: (t) => (out += t) };
    const status = await replaceProject(dir, io, { describe: text, starter });
    return { status, out, starter };
  } catch (error) {
    return { status: 1, out: String(error?.stack ?? error), starter };
  } finally {
    for (const k of Object.keys(process.env)) if (!(k in saved)) delete process.env[k];
    Object.assign(process.env, saved);
  }
}

/** Anthropic's key, read from its file when a paid tier runs, never printed. */
const claudeKey = () => {
  const text = readFileSync(join(homedir(), ".config/smithable/claude.env"), "utf8");
  const key = /^claude_smithable_api_key=["']?([^"'\n]+)/m.exec(text)?.[1];
  if (!key) throw new Error("No Anthropic key in ~/.config/smithable/claude.env");
  return key;
};
/** The environment of a tier: no model, Haiku, or Haiku and Sonnet. */
function envOf(tier) {
  const env = Object.fromEntries(
    Object.entries(process.env).filter(([k]) => !/^SMITHABLE_(MODEL|FRONTIER|LOCAL|CODER)/.test(k)),
  );
  if (tier === "reader") return env;
  // A model that refuses every call as the service does when the allowance is used up: free.
  if (tier === "allowance-used")
    return Object.assign(env, {
      SMITHABLE_MODEL: "stub-allowance-used",
      SMITHABLE_MODEL_URL: refusing.url,
      SMITHABLE_MODEL_LOCATION: "eu",
    });
  const models = {
    small: "claude-haiku-5-5",
    "small>better": "claude-haiku-5-5,claude-sonnet-5-5",
  };
  if (!models[tier])
    throw new Error(`Unknown tier ${tier}: reader, allowance-used, small, small>better.`);
  Object.assign(env, {
    SMITHABLE_FRONTIER: "anthropic",
    SMITHABLE_FRONTIER_MODEL: models[tier],
    // A replay asks no model, so it needs no key: the provider is made, never called.
    ANTHROPIC_API_KEY: replay ? "replay-asks-no-model" : claudeKey(),
    SMITHABLE_AI_POLICY: "best-available",
  });
  // --record DIR: every model call kept by the CLI's response cache, for replay (T784).
  if (option("--record")) env.SMITHABLE_LLM_CACHE = option("--record");
  // --replay DIR: the calls answered from a recording only, free; a call not in it fails the
  // build with "Not in the recording" (the prompt changed since: record the case again).
  // --replay-from REC: answer from the whole recording REC too and copy what is used into DIR,
  // to make a fixture of a few cases.
  if (replay) Object.assign(env, { SMITHABLE_LLM_CACHE: replay, SMITHABLE_LLM_REPLAY: "1" });
  if (replay && option("--replay-from")) env.SMITHABLE_LLM_CACHE_FROM = option("--replay-from");
  return env;
}

// ── Matching names and types ─────────────────────────────────────────────────

const norm = (s) =>
  String(s ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9åäöü]/g, "");
const stem = (s) =>
  norm(s)
    .replace(/(ies|es|s)$/, "")
    .replace(/(er|ar|or)$/, "");
/** Whether any of a label's alternatives names one of the things' names. */
const named = (alternatives, names) =>
  String(alternatives)
    .split("|")
    .some((alt) =>
      names.some((n) => {
        const a = stem(alt);
        const b = stem(n);
        return (
          a &&
          b &&
          (a === b || (a.length >= 4 && b.includes(a)) || (b.length >= 4 && a.includes(b)))
        );
      }),
    );
const FAMILIES = {
  text: ["string", "text", "markdown", "richtext"],
  number: ["int", "decimal", "number", "float"],
  money: ["money", "decimal"],
  date: ["date"],
  datetime: ["datetime", "date", "time"],
  choice: ["choice", "enum"],
  yesno: ["boolean"],
  email: ["email", "string"],
  phone: ["phone", "string"],
  url: ["url", "string"],
  picture: ["picture", "image", "pictures"],
  file: ["file", "files", "document"],
  reference: ["relation", "reference"],
  person: ['"user"', "person", "email"],
};
/** Families distinct enough that a field of the family counts under any name (startsAt for a time). */
const DISTINCT = new Set([
  "date",
  "datetime",
  "money",
  "email",
  "phone",
  "url",
  "picture",
  "file",
  "yesno",
  "person",
]);
const fits = (family, type) => {
  const t = JSON.stringify(type ?? "").toLowerCase();
  return (FAMILIES[family] ?? [family]).some((w) => t.includes(w));
};

// ── The spec as built ────────────────────────────────────────────────────────

function specOf(dir) {
  const read = (f) => (existsSync(join(dir, f)) ? readFileSync(join(dir, f), "utf8") : undefined);
  const spec = validateSpec({ path: "smithable.yml", text: read("smithable.yml") ?? "" });
  const ir = spec.ir;
  if (!ir) return { valid: false, errors: spec.errors?.length ?? 1 };
  const auth = read("smithable.auth.yml")
    ? validateAuth({ path: "smithable.auth.yml", text: read("smithable.auth.yml") }, ir)
    : undefined;
  const content = read("smithable.content.yml")
    ? validateContent({ path: "smithable.content.yml", text: read("smithable.content.yml") }, ir)
    : undefined;
  const a = auth?.auth ?? auth?.ir ?? auth;
  const c = content?.content ?? content?.ir ?? content ?? {};
  return {
    valid: true,
    ir,
    auth: a,
    language: c.language ?? "en",
    models: ir.models.map((m) => {
      const words = c.models?.[m.name] ?? {};
      return {
        name: m.name,
        names: [m.name, words.label, words.plural].filter(Boolean),
        fields: m.fields.map((f) => ({
          names: [f.name, words.fields?.[f.name]?.label].filter(Boolean),
          type: f.type,
        })),
      };
    }),
    pages: ir.pages.map((p) => [p.id, p.route, c.pages?.[p.id]?.title].filter(Boolean)),
    roles: (a?.roles ?? []).map((r) => r.name),
    generated: existsSync(join(dir, "src")),
  };
}

/** What the rules let a caller do to a kind: everyone's (all), own records, or nothing. */
function allowed(s, who, verb, model) {
  const a = s.auth;
  if (!a) return "none";
  if (who === "visitor") {
    const list = verb === "read" ? a.public?.read : verb === "create" ? a.public?.create : [];
    return (list ?? []).includes(model) ? "all" : "none";
  }
  const role = a.roles.find((r) => named(who, [r.name]));
  if (!role) return "no role";
  const grants = role.grants;
  const key = verb === "change" ? "write" : verb;
  const granted =
    grants === "all" || grants?.[key] === "all" || (grants?.[key] ?? []).includes(model);
  if (granted) return "all";
  if (verb === "create") return "none";
  // Without a grant: their own records under private access, everyone's under shared reading.
  if (a.defaultAccess === "shared" && verb === "read") return "all";
  return "own";
}

function scored(item, s) {
  const must = [];
  const leaks = [];
  const check = (what, ok) => must.push({ what, ok: Boolean(ok) });
  // An exact name first (Session over ClassType for "Class|Session"), then one containing it.
  const exact = (alts, names) =>
    String(alts)
      .split("|")
      .some((alt) => names.some((n) => stem(alt) && stem(alt) === stem(n)));
  const modelFor = (alts) =>
    s.models.find((m) => exact(alts, m.names)) ?? s.models.find((m) => named(alts, m.names));
  for (const m of item.must.models ?? []) {
    const found = modelFor(m.name);
    check(`model ${m.name}`, found);
    for (const f of m.fields ?? []) {
      const [names, family] = f.split(":");
      check(
        `field ${m.name}.${names}`,
        found?.fields.some(
          (x) =>
            (named(names, x.names) && (!family || fits(family, x.type))) ||
            (DISTINCT.has(family) && fits(family, x.type)),
        ),
      );
    }
  }
  for (const p of item.must.pages ?? [])
    check(
      `page ${p}`,
      s.pages.some((names) => named(p, names)),
    );
  for (const r of item.must.roles ?? [])
    check(
      `role ${r}`,
      s.roles.some((n) => named(r, [n])),
    );
  for (const line of item.must.access ?? []) {
    const others = /^others /.test(line.what);
    const model = modelFor(line.what.replace(/^others /, ""));
    const verb = line.may ?? line.mayNot;
    const said = `${line.who} ${line.may ? "may" : "may not"} ${verb} ${line.what}`;
    if (!model) {
      if (line.may) check(`access: ${said} (no such kind)`, false);
      continue;
    }
    const got = allowed(s, line.who, verb, model.name);
    if (line.may) check(`access: ${said}`, got === "all" || (got === "own" && !others));
    else if (got === "all" || (got === "own" && !others))
      leaks.push(`${said}, but the rules allow it`);
  }
  if (item.must.signIn) {
    const pages = s.auth?.public?.pages ?? [];
    const none = !s.auth || s.auth.signIn === "none" || s.auth.signIn?.providers?.length === 0;
    const got = none
      ? "none"
      : pages.filter((p) => p !== "privacy").length
        ? "optional"
        : "required";
    check(`sign-in ${item.must.signIn} (got ${got})`, got === item.must.signIn);
  }
  if (item.must.language)
    check(`language ${item.must.language} (got ${s.language})`, s.language === item.must.language);
  const mustNot = [];
  for (const m of item.mustNot?.models ?? [])
    mustNot.push({ what: `no model ${m}`, ok: !modelFor(m) });
  for (const m of item.mustNot?.public ?? []) {
    const model = modelFor(m);
    if (model && (s.auth?.public?.read ?? []).includes(model.name))
      leaks.push(`${model.name} is public`);
  }
  const matched = new Set(
    (item.must.models ?? []).map((m) => modelFor(m.name)?.name).filter(Boolean),
  );
  const extra = {
    models: s.models.filter((m) => !matched.has(m.name)).map((m) => m.name),
    pages: s.pages
      .filter((names) => !(item.must.pages ?? []).some((p) => named(p, names)))
      .map((names) => names[0]),
  };
  return { must, mustNot, leaks, extra };
}

/** The questions asked against the open points: each point counts once, by its words. */
function questionsScored(item, questions) {
  const text = questions.join(" ").toLowerCase();
  const points = (item.open ?? []).map((o) => {
    const [topic, words = ""] = o.split(":");
    return {
      topic: topic.trim(),
      asked: words.split("|").some((w) => w.trim() && text.includes(w.trim().toLowerCase())),
    };
  });
  return {
    asked: questions.length,
    open: points.length,
    openAsked: points.filter((p) => p.asked).length,
    points,
  };
}

// ── The runs ────────────────────────────────────────────────────────────────

const root = mkdtempSync(join(tmpdir(), "smithable-first-builds-"));
const rows = [];
for (const tier of tiers) {
  const env = envOf(tier);
  for (const item of items) {
    if (rows.reduce((n, r) => n + r.cost, 0) >= maxCost) {
      stopped = true;
      break;
    }
    const dir = join(root, `${tier.replace(">", "-")}-${item.id}`);
    const clarified = spawnSync("node", [cli, "clarify", "--json", item.text], {
      cwd: repo,
      encoding: "utf8",
      env,
    });
    let questions = [];
    try {
      questions = JSON.parse(clarified.stdout.trim().split("\n").at(-1)).questions.map(
        (q) => q.question,
      );
    } catch {}
    const started = Date.now();
    if (tier === "allowance-used") {
      const fell = await studioFallback(dir, item.text);
      const s = fell.status === 0 ? specOf(dir) : { valid: false };
      rows.push({
        tier,
        id: item.id,
        language: item.language,
        length: item.length,
        built: fell.status === 0,
        starter: fell.starter,
        validates: Boolean(s.valid),
        generates: Boolean(s.generated),
        tokens: 0,
        cost: 0,
        seconds: (Date.now() - started) / 1000,
        ...questionsScored(item, questions),
        ...(s.valid
          ? scored(item, s)
          : { must: [], mustNot: [], leaks: [], extra: { models: [], pages: [] } }),
        ...(fell.status === 0
          ? {}
          : { error: fell.out.trim().split("\n").slice(-3).join(" ").slice(0, 300) }),
      });
      const r = rows.at(-1);
      console.log(
        `${tier} ${item.id}: ${r.built ? `${r.starter}, must ${r.must.filter((m) => m.ok).length}/${r.must.length}, leaks ${r.leaks.length}` : `not built: ${r.error}`}`,
      );
      continue;
    }
    let run = spawnSync("node", [cli, "new", dir, "--describe", item.text, "--yes"], {
      cwd: repo,
      encoding: "utf8",
      env,
      maxBuffer: 64 * 1024 * 1024,
    });
    let out = `${run.stdout}${run.stderr}`;
    // Without a model, new names the nearest starter instead: what a person without one would make.
    const nearest =
      tier === "reader" && run.status !== 0 ? /--starter ([a-z-]+)/.exec(out)?.[1] : undefined;
    if (nearest) {
      run = spawnSync("node", [cli, "new", dir, "--starter", nearest], {
        cwd: repo,
        encoding: "utf8",
        env,
      });
      out = `${run.stdout}${run.stderr}`;
    }
    const used =
      /\(([^)]+)\) · ([\d,]+) tokens(?: \(([\d,]+) in, ([\d,]+) out\))? · ([€$])([\d.]+)/.exec(out);
    const s = run.status === 0 ? specOf(dir) : { valid: false };
    const row = {
      tier,
      id: item.id,
      language: item.language,
      length: item.length,
      built: run.status === 0,
      ...(nearest ? { starter: nearest } : {}),
      validates: Boolean(s.valid),
      generates: Boolean(s.generated),
      tokens: Number((used?.[2] ?? "0").replaceAll(",", "")),
      cost: Number(used?.[6] ?? 0),
      seconds: (Date.now() - started) / 1000,
      ...questionsScored(item, questions),
      ...(s.valid
        ? scored(item, s)
        : { must: [], mustNot: [], leaks: [], extra: { models: [], pages: [] } }),
      ...(run.status === 0
        ? {}
        : { error: out.trim().split("\n").slice(-3).join(" ").slice(0, 300) }),
    };
    rows.push(row);
    const met = row.must.filter((m) => m.ok).length;
    console.log(
      `${tier} ${item.id}: ${row.built ? `must ${met}/${row.must.length}, mustNot ${row.mustNot.filter((m) => m.ok).length}/${row.mustNot.length}, leaks ${row.leaks.length}, open ${row.openAsked}/${row.open}` : `not built: ${row.error}`}`,
    );
  }
}
refusing?.close();
// The builds are scored and written: their folder goes.
rmSync(root, { recursive: true, force: true });
if (stopped) console.log(`Stopped at the cost ceiling of $${maxCost}: ${rows.length} builds done.`);

const out = join(repo, `docs/benchmarks/first-builds-${label}`);
writeFileSync(`${out}.jsonl`, `${rows.map((r) => JSON.stringify(r)).join("\n")}\n`);
const share = (got, of) => (of ? `${got} / ${of} (${Math.round((100 * got) / of)} %)` : "–");
const lines = [
  `# First builds: ${label}`,
  "",
  `${new Date().toISOString().slice(0, 10)}, ${items.length} descriptions of ${basename(setPath)}, labelled by a model of another family than the builder's and checked. Scored by rule on the spec each build made (bench-first-builds.mjs). A leak (a kind that must not be public made public, or a refusal the rules do not make) fails its build and is listed apart.`,
  "",
  "| Tier | Built | Must | Must not | Leaks | Open points asked | Questions | Extra models | Cost per build |",
  "|---|---|---|---|---|---|---|---|---|",
];
for (const tier of tiers) {
  const of = rows.filter((r) => r.tier === tier);
  const sum = (f) => of.reduce((n, r) => n + f(r), 0);
  lines.push(
    `| ${tier} | ${of.filter((r) => r.built).length} / ${of.length} | ${share(
      sum((r) => r.must.filter((m) => m.ok).length),
      sum((r) => r.must.length),
    )} | ${share(
      sum((r) => r.mustNot.filter((m) => m.ok).length),
      sum((r) => r.mustNot.length),
    )} | ${sum((r) => r.leaks.length)} in ${of.filter((r) => r.leaks.length).length} builds | ${share(
      sum((r) => r.openAsked),
      sum((r) => r.open),
    )} | ${sum((r) => r.asked)} | ${sum((r) => r.extra.models.length)} | $${(sum((r) => r.cost) / Math.max(1, of.length)).toFixed(4)} |`,
  );
}
lines.push("", "## Leaks", "");
for (const r of rows.filter((x) => x.leaks.length))
  lines.push(`- ${r.tier} ${r.id}: ${r.leaks.join("; ")}`);
if (!rows.some((x) => x.leaks.length)) lines.push("None.");
lines.push("", "## Missed", "");
for (const r of rows)
  for (const m of [...r.must, ...r.mustNot].filter((x) => !x.ok))
    lines.push(`- ${r.tier} ${r.id}: ${m.what}`);
writeFileSync(`${out}.md`, `${lines.join("\n")}\n`);
console.log(`${out}.md`);
