// Builder changes that reach a model: requests the wording rules do not read, phrased as people
// write them (two things in one, a rule instead of a field, indirect), each on a fresh copy of a
// starter through `smithable ask --yes`, and checked in the spec files it leaves (not by reading the
// answer). Some ask for what the spec cannot express: the right outcome there is no change.
//   node scripts/bench-changes.mjs --rules                 rules only: proves tier 0 reads none of them
//   node scripts/bench-changes.mjs <model> [<model>…]      eu.anthropic.…, mistral-…, claude-… (or
//                                                          claude-haiku-5-5>claude-sonnet-5-5); ask before running
//   node scripts/bench-changes.mjs --score <apps dir>      checks a run's apps again (its results.json)
// Writes docs/benchmarks/builder-changes.md (or builder-changes-rules.md).
import { spawnSync } from "node:child_process";
import { cpSync, existsSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { homedir, tmpdir } from "node:os";
import { join } from "node:path";

const repo = new URL("..", import.meta.url).pathname;
const cli = join(repo, "packages/cli/dist/bin.js");
const { parse } = createRequire(join(repo, "packages/core/package.json"))("yaml");
const args = process.argv.slice(2);
const rules = args.includes("--rules");
const rescore = args.includes("--score") ? args[args.indexOf("--score") + 1] : undefined;
const models = rules ? ["rules"] : rescore ? [] : args;
if (!models.length && !rescore) throw new Error("Name the models, or --rules.");

const field = (y, model, re) =>
  Object.entries(y.spec.models?.[model]?.fields ?? {}).find(([name]) => re.test(name));
const typeOf = (def) => (typeof def === "string" ? def : (def?.type ?? ""));

/** The requests: a starter, what a person types, and what the spec must say afterwards. */
const TASKS = [
  {
    id: "vat-in-list",
    starter: "crm",
    prompt: "Customers should also have a VAT number, and I want to see it in the list.",
    expect: "a VAT field on Customer, among the customers list's columns",
    check: (y) => {
      const f = field(y, "Customer", /vat/i);
      return Boolean(f && (y.ux.pages?.customers?.table?.columns ?? []).includes(f[0]));
    },
  },
  {
    id: "first-last-name",
    starter: "crm",
    prompt:
      "We sell to people too, not only companies, so customers need a first name and a last name.",
    expect: "first and last name fields on Customer",
    check: (y) => Boolean(field(y, "Customer", /first/i) && field(y, "Customer", /last/i)),
  },
  {
    id: "owner-of-order",
    starter: "crm",
    prompt:
      "Every order should belong to the salesperson who handles it, and only that person may change it.",
    expect: "a User field on Order that owns it, and write: [owner]",
    check: (y) => {
      const order = y.spec.models?.Order ?? {};
      const owner = order.ownedBy && order.fields?.[order.ownedBy];
      return Boolean(
        owner && /^User/.test(typeOf(owner)) && (order.access?.write ?? []).includes("owner"),
      );
    },
  },
  {
    id: "orders-first-as-sales",
    starter: "crm",
    prompt: "Orders are what we look at most: put them first in the menu and call them Sales.",
    expect: "orders first in the navigation, labelled Sales in the content file",
    check: (y) =>
      y.spec.navigation?.[0] === "orders" && /sales/i.test(JSON.stringify(y.content ?? {})),
  },
  {
    id: "big-orders-admins-only",
    starter: "crm",
    prompt: "Only admins should see orders over 10 000 €.",
    expect: "no change: access cannot depend on a value",
    unchanged: true,
  },
  {
    id: "vat-amount",
    starter: "invoicing",
    prompt: "Our invoices should show the VAT too, which is 25 % of the total.",
    expect: "a computed field on Invoice from the total and 25 %",
    check: (y) => {
      const f = Object.values(y.spec.models?.Invoice?.fields ?? {}).find(
        (d) =>
          typeof d === "object" &&
          /total/.test(d.formula ?? "") &&
          /0?\.25|25/.test(d.formula ?? ""),
      );
      return Boolean(f);
    },
  },
  {
    id: "client-phone-search",
    starter: "invoicing",
    prompt: "Clients need a phone number, it's optional, and I want to find clients by it.",
    expect: "an optional phone field on Client, in the clients page's search",
    check: (y) => {
      const f = field(y, "Client", /phone/i);
      return Boolean(
        f &&
          /^phone/.test(typeOf(f[1])) &&
          !typeOf(f[1]).includes("!") &&
          (y.spec.pages?.clients?.search ?? []).includes(f[0]),
      );
    },
  },
  {
    id: "no-delete-sent",
    starter: "invoicing",
    prompt: "Nobody should be able to delete an invoice once it has been sent.",
    expect: "no change: deleting cannot depend on the status",
    unchanged: true,
  },
  {
    id: "staff-posts",
    starter: "status",
    prompt: "Only our team posts incidents; everyone else just reads them.",
    expect:
      "creating incidents for staff (and admins) only; already so (invite-only, public reading), so no change is right too",
    already: true,
    check: (y) => {
      const create = y.spec.models?.Incident?.access?.create;
      return Array.isArray(create) && create.includes("staff") && !create.includes("owner");
    },
  },
  {
    id: "home-says-what",
    starter: "status",
    prompt:
      "Make the home page say what we do: we keep the Pulse payment API running around the clock.",
    expect: "the landing page's texts mention Pulse",
    check: (y) => /pulse/i.test(JSON.stringify(y.content?.pages?.home ?? {})),
  },
  {
    id: "room-choice",
    starter: "booking",
    prompt: "Classes happen in Studio 1 or Studio 2, so each session should say which.",
    expect: "a choice field on Session with both studios",
    check: (y) => {
      const f = field(y, "Session", /^(room|studio|hall|location|venue)/i);
      return Boolean(
        f &&
          /studio 1|studio1|studioOne/i.test(JSON.stringify(f[1])) &&
          /2|two/i.test(JSON.stringify(f[1])),
      );
    },
  },
  {
    id: "teachers-not-instructors",
    starter: "booking",
    prompt: "We say teachers, not instructors.",
    expect: "Instructor renamed to Teacher, or labelled Teacher(s)",
    check: (y) =>
      Boolean(y.spec.models?.Teacher) ||
      /teacher/i.test(JSON.stringify(y.content?.models?.Instructor ?? {})),
  },
];

/** The environment that makes `ask` use one model (or none), with nothing inherited. */
const keyFile = (file) =>
  Object.fromEntries(
    readFileSync(join(homedir(), ".config/smithable", file), "utf8")
      .split("\n")
      .map((line) => /^(?:export\s+)?([A-Za-z_]+)=(.*)$/.exec(line.trim()))
      .filter(Boolean)
      .map(([, key, value]) => [key, value.replace(/^["']|["']$/g, "")]),
  );
function envFor(model) {
  const env = { ...process.env, SMITHABLE_AI_POLICY: "best-available" };
  for (const name of Object.keys(env))
    if (/^SMITHABLE_(MODEL|FRONTIER|LOCAL|LLM_CACHE)/.test(name)) delete env[name];
  if (model.startsWith("eu.anthropic."))
    Object.assign(env, {
      SMITHABLE_FRONTIER: "bedrock",
      SMITHABLE_FRONTIER_MODEL: model,
      SMITHABLE_BEDROCK_REGION: "eu-north-1",
    });
  else if (model.startsWith("mistral-")) {
    const m = keyFile("mistral.env");
    Object.assign(env, {
      SMITHABLE_MODEL: model,
      SMITHABLE_MODEL_URL: m.SMITHABLE_MODEL_URL ?? "https://api.mistral.ai/v1",
      SMITHABLE_MODEL_KEY: m.SMITHABLE_MODEL_KEY,
    });
  } else if (model.startsWith("claude-"))
    // Anthropic's own API; "claude-haiku-5-5>claude-sonnet-5-5" escalates as the hosted service does.
    Object.assign(env, {
      SMITHABLE_FRONTIER: "anthropic",
      SMITHABLE_FRONTIER_MODEL: model.split(">").join(","),
      ANTHROPIC_API_KEY: keyFile("claude.env").claude_smithable_api_key,
    });
  else if (model !== "rules")
    throw new Error(`${model}: an eu.anthropic.…, mistral-… or claude-… model, or --rules.`);
  return env;
}

const SPECS = ["smithable.yml", "smithable.ux.yml", "smithable.content.yml", "smithable.auth.yml"];
const read = (dir) =>
  Object.fromEntries(
    SPECS.map((f) => [f, existsSync(join(dir, f)) ? readFileSync(join(dir, f), "utf8") : ""]),
  );
const parsed = (files) => ({
  spec: parse(files["smithable.yml"]) ?? {},
  ux: parse(files["smithable.ux.yml"]) ?? {},
  content: parse(files["smithable.content.yml"]) ?? {},
  auth: parse(files["smithable.auth.yml"]) ?? {},
});

// One copy of each starter, made once; every request starts from a fresh copy of it.
const root = rescore ?? mkdtempSync(join(tmpdir(), "smithable-bench-changes-"));
const bases = {};
for (const starter of rescore ? [] : new Set(TASKS.map((t) => t.starter))) {
  const made = spawnSync(
    "node",
    [cli, "new", join(root, `base-${starter}`), "--starter", starter, "--yes"],
    { encoding: "utf8", env: { ...process.env, SMITHABLE_NO_PICTURES: "1" } },
  );
  if (made.status !== 0)
    throw new Error(`making the ${starter} starter failed:\n${made.stdout}${made.stderr}`);
  bases[starter] = join(root, `base-${starter}`);
}

/** What a change did, by the spec files it left: right, wrong or no change. */
function judge(task, before, after) {
  const changed = SPECS.some((f) => before[f] !== after[f]);
  if (task.unchanged) return changed ? "wrong" : "right";
  if (!changed) return task.already ? "right" : "no change";
  try {
    return task.check(parsed(after)) ? "right" : "wrong";
  } catch {
    return "wrong";
  }
}

const results = [];
if (rescore) {
  // The apps of an earlier run, checked again (a check corrected after the run).
  for (const row of JSON.parse(readFileSync(join(rescore, "results.json"), "utf8"))) {
    const task = TASKS.find((t) => t.id === row.task);
    const dir = join(rescore, `${row.model.replace(/[^a-z0-9.-]/gi, "-")}-${task.id}`);
    results.push({
      ...row,
      outcome: judge(task, read(join(rescore, `base-${task.starter}`)), read(dir)),
    });
  }
  models.splice(0, models.length, ...new Set(results.map((r) => r.model)));
} else
  for (const model of models)
    for (const task of TASKS) {
      const dir = join(root, `${model.replace(/[^a-z0-9.-]/gi, "-")}-${task.id}`);
      cpSync(bases[task.starter], dir, { recursive: true, verbatimSymlinks: true });
      const before = read(dir);
      const started = Date.now();
      const asked = spawnSync("node", [cli, "ask", task.prompt, "--yes", "--dir", dir], {
        encoding: "utf8",
        env: envFor(model),
        timeout: 10 * 60_000,
        maxBuffer: 64 << 20,
      });
      const out = `${asked.stdout}${asked.stderr}`;
      const after = read(dir);
      const used =
        /\(([^)]+)\) · ([\d,]+) tokens(?: \(([\d,]+) in, ([\d,]+) out\))? · ([€$])([\d.]+)/.exec(
          out,
        );
      const rule = /^Generator \(([^)]+)\)/m.exec(out)?.[1];
      const outcome = judge(task, before, after);
      const row = {
        model,
        task: task.id,
        outcome,
        rule,
        tokens: Number((used?.[2] ?? "0").replaceAll(",", "")),
        currency: used?.[5] ?? "$",
        cost: Number(used?.[6] ?? 0),
        seconds: Math.round((Date.now() - started) / 1000),
        answer: out
          .trim()
          .split("\n")
          .filter((l) => l.trim() && !/^Generated|^\s*at |·/.test(l))
          .slice(0, 4)
          .join(" ")
          .slice(0, 220),
      };
      results.push(row);
      console.log(
        `${model} ${task.id}: ${row.outcome}${rule ? ` (rule: ${rule})` : ""} · ${row.tokens} tokens · ${row.currency}${row.cost.toFixed(4)} · ${row.seconds} s`,
      );
    }

if (!rescore) writeFileSync(join(root, "results.json"), `${JSON.stringify(results, null, 2)}\n`);

// ── Report ───────────────────────────────────────────────────────────────────
const today = new Date().toISOString().slice(0, 10);
const cell = (s) => String(s).replaceAll("|", "\\|").replaceAll("\n", " ");
const totals = models.map((m) => {
  const rows = results.filter((r) => r.model === m);
  const n = (o) => rows.filter((r) => r.outcome === o).length;
  const cost = rows.reduce((s, r) => s + r.cost, 0);
  return `| ${m} | ${n("right")} / ${rows.length} | ${n("wrong")} | ${n("no change")} | ${rows.filter((r) => r.rule).length} | ${rows.reduce((s, r) => s + r.tokens, 0).toLocaleString("en")} | ${rows[0]?.currency ?? "$"}${cost.toFixed(4)} | ${rows.reduce((s, r) => s + r.seconds, 0)} s |`;
});
const report = `# Builder changes that reach a model (${today})

${TASKS.length} requests as people type them into Builder's Describe box, on fresh copies of the starters, through \`smithable ask --yes\` ([scripts/bench-changes.mjs](../../scripts/bench-changes.mjs)). The wording rules (tier 0) read none of them (\`--rules\` run). Each outcome is checked in the spec files the change leaves: *right* is what the request means; *wrong* is a change that is not it; *no change* is a refusal or a question back. ${TASKS.filter((t) => t.unchanged).length} requests ask for what the spec cannot express (access by a value); for those, no change is right.

| Model | Right | Wrong | No change | Read by a rule | Tokens | Cost | Time |
|---|---|---|---|---|---|---|---|
${totals.join("\n")}

## The requests

| # | Starter | Request | Right means |
|---|---|---|---|
${TASKS.map((t, i) => `| ${i + 1} | ${t.starter} | ${t.prompt} | ${t.expect} |`).join("\n")}

## Each answer

| Request | Model | Outcome | Tokens | Cost | Time | What it said (first lines) |
|---|---|---|---|---|---|---|
${results.map((r) => `| ${r.task} | ${r.model} | ${r.outcome === "right" ? "right" : `**${r.outcome}**`}${r.rule ? ` (rule: ${r.rule})` : ""} | ${r.tokens.toLocaleString("en")} | ${r.currency}${r.cost.toFixed(4)} | ${r.seconds} s | ${cell(r.answer)} |`).join("\n")}

The apps are in ${root}.
`;
const file = `docs/benchmarks/builder-changes${rules ? "-rules" : ""}.md`;
writeFileSync(join(repo, file), report);
console.log(`\nWrote ${file}.`);
