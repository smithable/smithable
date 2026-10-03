// M12 first builds: the same app descriptions (ten, and two status pages since the sixth starter), each started from a sentence with
// `smithable new --describe` by the models set up in the environment (docs/ai.md). Records
// whether a valid app came out, how many model calls it took, tokens, cost and time, and the
// plain-language summary for people to review. Uses the configured model: ask before running.
// Run after `pnpm build`, once per model: `node scripts/bench-m12.mjs`.
// Writes docs/benchmarks/m12-first-builds-<model>.md.
import { spawnSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const repo = new URL("..", import.meta.url).pathname;
const cli = join(repo, "packages/cli/dist/bin.js");
const root = mkdtempSync(join(tmpdir(), "smithable-bench-m12-"));
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
  for (const spec of ["smithable.yml", "smithable.auth.yml", "smithable.ux.yml", "smithable.content.yml"])
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

## Summaries, for review

${rows.map((r, i) => `### ${i + 1}. ${r.description}\n\n${r.created ? `\`\`\`text\n${r.summary}\n\`\`\`` : `Failed:\n\n\`\`\`text\n${r.error}\n\`\`\``}`).join("\n\n")}
`;
const file = `docs/benchmarks/${slug}.md`;
writeFileSync(join(repo, file), report);
console.log(`\nWrote ${file}. The apps are in ${root}`);
