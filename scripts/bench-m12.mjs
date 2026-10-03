// M12 first builds: the same app descriptions (ten, and two status pages since the sixth starter), each started from a sentence with
// `smithable new --describe` by the models set up in the environment (docs/ai.md). Records
// whether a valid app came out, how many model calls it took, tokens, cost and time, and the
// plain-language summary for people to review. Uses the configured model: ask before running.
// Run after `pnpm build`, once per model: `node scripts/bench-m12.mjs`.
// Writes docs/benchmarks/m12-first-builds-<model>.md, with a scorecard of the kept spec files:
// facts only (what the draft kept of its starter, access, what is public, warnings, reuse of the
// starter's texts, sample records), for the reader to judge. `--score <kept dir>` scores a run's
// kept files again without calling a model, and puts the table into that run's report.
import { spawnSync } from "node:child_process";
import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";
import { parseArgs } from "node:util";
import {
  fitSamples,
  titleField,
  validateAuth,
  validateContent,
  validateSpec,
  validateUx,
} from "../packages/core/dist/index.js";

const repo = new URL("..", import.meta.url).pathname;
const cli = join(repo, "packages/cli/dist/bin.js");
const root = mkdtempSync(join(tmpdir(), "smithable-bench-m12-"));
const { values: args } = parseArgs({ options: { score: { type: "string" } } });

const SPECS = ["smithable.yml", "smithable.auth.yml", "smithable.ux.yml", "smithable.content.yml"];
const read = (dir, file) =>
  existsSync(join(dir, file)) ? readFileSync(join(dir, file), "utf8") : undefined;

/** A project's spec files checked like `smithable validate`: the IR, the auth file, every diagnostic. */
function check(dir) {
  const authFile = { path: "smithable.auth.yml", text: read(dir, "smithable.auth.yml") ?? "" };
  const roles = validateAuth(authFile).auth?.roles.map((r) => r.name);
  const spec = validateSpec(
    { path: "smithable.yml", text: read(dir, "smithable.yml") ?? "" },
    roles ? { roles } : {},
  );
  const diagnostics = [...spec.diagnostics];
  let auth;
  if (spec.ir) {
    const a = validateAuth(authFile, spec.ir);
    auth = a.auth;
    diagnostics.push(...a.diagnostics);
    for (const [file, validate] of [
      ["smithable.content.yml", validateContent],
      ["smithable.ux.yml", validateUx],
    ]) {
      const text = read(dir, file);
      if (text !== undefined)
        diagnostics.push(...validate({ path: file, text }, spec.ir).diagnostics);
    }
  }
  return { ir: spec.ir, auth, diagnostics };
}

/** The deterministic facts about one kept draft, against the starter it began from. */
function score(dir, description, starter) {
  const draft = check(dir);
  const example = join(repo, "examples", starter);
  const base = existsSync(example) ? check(example) : undefined;
  const names = (ir, key) => new Set((ir?.[key] ?? []).map((x) => x.id ?? x.name));
  const kept = (key) => {
    const from = names(base?.ir, key);
    const now = names(draft.ir, key);
    return `${[...from].filter((n) => now.has(n)).length} / ${from.size}`;
  };
  // The starter's name and its sample records' titles, found again in the draft's texts.
  const texts =
    `${read(dir, "smithable.yml") ?? ""}\n${read(dir, "smithable.content.yml") ?? ""}`.toLowerCase();
  const samplesDir = join(example, "samples");
  const sampleFiles = existsSync(samplesDir)
    ? readdirSync(samplesDir).map((f) => ({
        path: f,
        text: readFileSync(join(samplesDir, f), "utf8"),
      }))
    : [];
  const titles = sampleFiles.flatMap((f) => {
    const model = base?.ir?.models.find((m) => m.name === basename(f.path, ".yml"));
    if (!model) return [];
    const key = titleField(model);
    return [...f.text.matchAll(new RegExp(`(?:^|[{,]\\s*|- )${key}: ([^,}\\n]+)`, "gm"))].map((m) =>
      m[1].trim().replace(/^["']|["']$/g, ""),
    );
  });
  const starterName = base?.ir?.app.name;
  const reused = [starterName, ...titles].filter(
    (t) => t && t.length > 3 && texts.includes(t.toLowerCase()),
  );
  const fitted = draft.ir ? fitSamples(sampleFiles, draft.ir) : [];
  const withSamples = fitted.filter((f) => /^- /m.test(f.text)).length;
  const warnings = draft.diagnostics.filter((d) => d.severity === "warning");
  const codes = [...new Set(warnings.map((d) => d.code))];
  const auth = draft.auth;
  const mentionsPublic = /\b(visitors?|public|site)\b/i.test(description);
  const landing = (draft.ir?.pages ?? []).some((p) => p.pattern?.kind === "landing");
  const list = (xs) => (xs?.length ? xs.join(", ") : "none");
  return {
    starter,
    models: kept("models"),
    pages: kept("pages"),
    actions: kept("actions"),
    access: auth
      ? `${auth.defaultAccess}; ${list(auth.roles.map((r) => r.name))} (${auth.defaultRole})`
      : "?",
    pageAccess: list(
      (draft.ir?.pages ?? [])
        .filter((p) => p.access?.length)
        .map((p) => `${p.id}: ${p.access.join("/")}`),
    ),
    public: auth
      ? `pages ${list(auth.public.pages)}; read ${list(auth.public.read)}; create ${list(auth.public.create)}`
      : "?",
    warnings: warnings.length ? `${warnings.length} (${codes.join(", ")})` : "0",
    reused: list(reused),
    samples: `${withSamples} / ${draft.ir?.models.length ?? 0}`,
    landing: `${mentionsPublic ? "mentions visitors" : "no mention"}; ${landing ? "landing page" : "no landing page"}`,
  };
}

function scorecard(rows) {
  return `| # | Starter | Models kept | Pages kept | Actions kept | Access; roles (default) | Pages with access | Public | Warnings | Starter's texts in the draft | Models with the starter's samples | Visitors / landing |
|---|---|---|---|---|---|---|---|---|---|---|---|
${rows.map((r, i) => `| ${i + 1} | ${r.starter} | ${r.models} | ${r.pages} | ${r.actions} | ${r.access} | ${r.pageAccess} | ${r.public} | ${r.warnings} | ${r.reused} | ${r.samples} | ${r.landing} |`).join("\n")}

"Kept" counts the starter's models, pages and actions that the draft still has by name. "Starter's texts" lists the starter's app name or sample titles found in the draft's spec or content. "Models with the starter's samples" counts the draft's models that keep some of the starter's sample records after \`fitSamples\`; the rest get generated rows. "Mentions visitors" means the description says visitors, public or site.`;
}

const SCORE_START = "<!-- scorecard -->";
const SCORE_END = "<!-- /scorecard -->";

if (args.score) {
  const dir = args.score.replace(/\/$/, "");
  const reportFile = `${dir}.md`;
  const report = existsSync(reportFile) ? readFileSync(reportFile, "utf8") : "";
  // The starter of each app: meta.json beside its files, or the report's table for older runs.
  const tableStarters = [...report.matchAll(/^\| (.+?) \| (\w+) \| (?:yes|\*\*no\*\*) \|/gm)].map(
    (m) => ({
      description: m[1],
      starter: m[2],
    }),
  );
  const apps = readdirSync(dir)
    .filter((d) => /^app-\d+$/.test(d))
    .sort((a, b) => Number(a.slice(4)) - Number(b.slice(4)));
  const rows = apps.map((app) => {
    const n = Number(app.slice(4));
    const meta = existsSync(join(dir, app, "meta.json"))
      ? JSON.parse(readFileSync(join(dir, app, "meta.json"), "utf8"))
      : tableStarters[n - 1];
    if (!meta) throw new Error(`no starter known for ${app}: no meta.json and no report row`);
    return score(join(dir, app), meta.description, meta.starter);
  });
  const table = `${SCORE_START}\n## Scorecard (scripts/bench-m12.mjs --score)\n\n${scorecard(rows)}\n${SCORE_END}`;
  if (report) {
    const at = report.indexOf(SCORE_START);
    const next =
      at >= 0
        ? report.slice(0, at) + table + report.slice(report.indexOf(SCORE_END) + SCORE_END.length)
        : report.replace(/\n## /, `\n${table}\n\n## `);
    writeFileSync(reportFile, next);
    console.log(`The scorecard is in ${reportFile}.`);
  } else console.log(table);
  process.exit(0);
}

const model =
  process.env.SMITHABLE_MODEL ||
  process.env.SMITHABLE_LOCAL_MODEL ||
  (process.env.SMITHABLE_FRONTIER === "claude-code"
    ? process.env.SMITHABLE_FRONTIER_MODEL || "claude-code"
    : undefined);
if (!model) throw new Error("Set up a model first (docs/ai.md).");

const DESCRIPTIONS = [
  "A booking site for a yoga studio, with classes, teachers and online booking.",
  "A CRM for a small sales team: companies, contacts, deals and follow-ups.",
  "Invoicing for freelancers, with clients, invoices and payments.",
  "A tool library where neighbors lend each other tools.",
  "An inventory app for a small bakery: ingredients, suppliers and stock levels.",
  "A job board for a local union, with job posts and applications.",
  "A football club's site: teams, players, matches and results.",
  "Event registration for a conference: talks, speakers and attendees.",
  "A help desk for an IT team: tickets, priorities and who handles them.",
  "A recipe collection for a family, with ingredients and shopping lists.",
  "A status page for our API, with incidents and planned maintenance.",
  "A public uptime page for a web shop: which services work, outages and their updates.",
];

// Each draft's spec files, kept next to the report so what the model made can be read later.
const slug = `m12-first-builds-${model.replace(/[^a-z0-9.-]+/gi, "-")}`;
const kept = join(repo, "docs/benchmarks", slug);
rmSync(kept, { recursive: true, force: true });

const rows = [];
for (const [i, description] of DESCRIPTIONS.entries()) {
  const dir = join(root, `app-${i + 1}`);
  const started = Date.now();
  const run = spawnSync("node", [cli, "new", dir, "--describe", description, "--yes"], {
    cwd: repo,
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
  });
  const out = `${run.stdout}${run.stderr}`;
  const used = /\(([^)]+)\) · ([\d,]+) tokens · ([€$])([\d.]+)/.exec(out);
  const typecheck =
    existsSync(join(dir, "package.json")) &&
    spawnSync("pnpm", ["typecheck"], { cwd: dir, encoding: "utf8" }).status === 0;
  for (const spec of SPECS)
    if (existsSync(join(dir, spec))) {
      mkdirSync(join(kept, `app-${i + 1}`), { recursive: true });
      cpSync(join(dir, spec), join(kept, `app-${i + 1}`, spec));
    }
  const row = {
    description,
    starter: /Starting from the (\w+) starter/.exec(out)?.[1] ?? "?",
    created: run.status === 0,
    typecheck,
    tokens: Number((used?.[2] ?? "0").replaceAll(",", "")),
    cost: Number(used?.[4] ?? 0),
    currency: used?.[3] ?? "€",
    seconds: Math.round((Date.now() - started) / 1000),
    summary: out
      .slice(out.indexOf("\n", out.indexOf("tokens ·")) + 1, out.indexOf("Create this app?"))
      .trim(),
    error: run.status === 0 ? "" : out.slice(-600),
  };
  rows.push(row);
  if (existsSync(join(kept, `app-${i + 1}`)))
    writeFileSync(
      join(kept, `app-${i + 1}`, "meta.json"),
      `${JSON.stringify({ description, starter: row.starter }, null, 2)}\n`,
    );
  console.log(
    `${i + 1}. ${row.created ? "created" : "failed"} (${row.starter}) · ${row.tokens} tokens · ${row.currency}${row.cost}`,
  );
}

const yes = (v) => (v ? "yes" : "**no**");
const report = `# M12 first builds: ${model} (${new Date().toISOString().slice(0, 10)})

The app descriptions, each started with \`smithable new --describe\` (the closest starter, adapted by the model; errors go back up to twice). Totals: ${rows.filter((r) => r.created).length} / ${rows.length} created, ${rows.filter((r) => r.typecheck).length} type-check, ${rows.reduce((n, r) => n + r.tokens, 0).toLocaleString("en")} tokens, ${rows[0]?.currency ?? "€"}${rows.reduce((n, r) => n + r.cost, 0).toFixed(4)}.

| Description | Starter | Created | Type-checks | Tokens | Cost | Time |
|---|---|---|---|---|---|---|
${rows.map((r) => `| ${r.description} | ${r.starter} | ${yes(r.created)} | ${yes(r.typecheck)} | ${r.tokens.toLocaleString("en")} | ${r.currency}${r.cost.toFixed(4)} | ${r.seconds} s |`).join("\n")}

Each created app's four spec files are in [${slug}/](${slug}/), one folder per description (app-1 …).

${SCORE_START}
## Scorecard (scripts/bench-m12.mjs --score)

${scorecard(rows.map((r, i) => (existsSync(join(kept, `app-${i + 1}`, "smithable.yml")) ? score(join(kept, `app-${i + 1}`), r.description, r.starter) : null)).filter(Boolean))}
${SCORE_END}

## Summaries, for review

${rows.map((r, i) => `### ${i + 1}. ${r.description}\n\n${r.created ? `\`\`\`text\n${r.summary}\n\`\`\`` : `Failed:\n\n\`\`\`text\n${r.error}\n\`\`\``}`).join("\n\n")}
`;
const file = `docs/benchmarks/${slug}.md`;
writeFileSync(join(repo, file), report);
console.log(`\nWrote ${file}. The apps are in ${root}`);
