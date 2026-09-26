// M3 mini-benchmark: the same tasks on identical copies of the generated CRM, done by
// (A) Smithable operations and (B) Claude Code headless. Both are checked the same way.
// Run after `pnpm build`: `node scripts/bench-m3.mjs`. Writes docs/benchmarks/m3-mini.md.
import { spawn, spawnSync } from "node:child_process";
import { cpSync, mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const repo = new URL("..", import.meta.url).pathname;
const cli = join(repo, "packages/cli/dist/bin.js");
const root = mkdtempSync(join(tmpdir(), "smithable-bench-"));

const TASKS = [
  {
    id: "website",
    prompt: "Add a website field to customers.",
    ops: [["addField", "Customer", "website", "url"]],
    check: (db) => db.columns("customers").includes("website"),
    page: ["/customers/new", "Website"],
  },
  {
    id: "email-required",
    prompt: "Make the customer email required.",
    ops: [["changeField", "Customer", "email", "email!", "unique"]],
    check: (db) => db.notNull("customers", "email"),
    page: ["/customers/new", "Email"],
  },
  {
    id: "products",
    prompt:
      "Add products with a required name and a required price, with a page for them in the menu.",
    ops: [
      ["addModel", "Product", "name=string!", "price=money!"],
      ["addPage", "products", "Product"],
    ],
    check: (db) => ["name", "price"].every((c) => db.columns("products").includes(c)),
    page: ["/products", "Products"],
  },
];

const SUFFIX =
  " Keep the app working: update whatever is needed (database, forms, tables) and make sure it type-checks.";

function sh(command, args, cwd, input) {
  const started = Date.now();
  const r = spawnSync(command, args, { cwd, encoding: "utf8", input, maxBuffer: 64 * 1024 * 1024 });
  return {
    ok: r.status === 0,
    out: `${r.stdout}${r.stderr}`,
    stdout: r.stdout,
    ms: Date.now() - started,
  };
}

function database(dir) {
  const q = (sql) =>
    JSON.parse(
      sh(
        "node",
        [
          "-e",
          `const D=require("better-sqlite3");console.log(JSON.stringify(new D("data/db/app.db").prepare(${JSON.stringify(sql)}).all()))`,
        ],
        dir,
      ).stdout || "[]",
    );
  return {
    columns: (t) => q(`select name from pragma_table_info('${t}')`).map((c) => c.name),
    notNull: (t, c) =>
      q(`select "notnull" n from pragma_table_info('${t}') where name='${c}'`)[0]?.n === 1,
    rows: (t) => q(`select count(*) n from ${t}`)[0]?.n,
  };
}

async function serve(dir, [path, text]) {
  const port = 4600 + Math.floor(Math.random() * 300);
  const server = spawn("pnpm", ["start"], {
    cwd: dir,
    env: { ...process.env, PORT: String(port) },
    detached: true,
  });
  try {
    for (let i = 0; i < 60; i++) {
      try {
        const r = await fetch(`http://localhost:${port}${path}`);
        if (r.ok) return (await r.text()).includes(text);
      } catch {}
      await new Promise((r) => setTimeout(r, 250));
    }
    return false;
  } finally {
    try {
      process.kill(-server.pid);
    } catch {}
  }
}

/** The same checks for both sides. The production server applies migrations at startup. */
async function verify(dir, task, base) {
  sh("git", ["add", "-A"], dir);
  const stat = sh("git", ["diff", "--cached", "--numstat", base], dir)
    .out.split("\n")
    .filter(Boolean);
  const files = stat.filter((l) => !/drizzle\/meta\/|routeTree\.gen|\.smithable\//.test(l));
  const typecheck = sh("pnpm", ["typecheck"], dir).ok;
  const build = sh("pnpm", ["build"], dir).ok;
  const visible = build ? await serve(dir, task.page) : false;
  const db = database(dir);
  const spec =
    sh("git", ["diff", "--cached", "--quiet", base, "--", "smithable.yml"], dir).ok === false;
  // The code must be exactly what the spec generates, or the next change through Smithable
  // runs into hand-edited generated files.
  const regenerates = !sh("node", [cli, "generate", dir], repo).out.includes("edited by hand");
  return {
    filesTouched: files.length,
    linesChanged: files.reduce(
      (n, l) => n + (Number(l.split("\t")[0]) || 0) + (Number(l.split("\t")[1]) || 0),
      0,
    ),
    typecheck,
    build,
    visible,
    database: task.check(db),
    rowsKept: db.rows("customers") === 8,
    specInSync: spec,
    regeneratesCleanly: regenerates,
  };
}

// A fresh CRM with sample data, committed, as the common starting point.
const base = join(root, "base");
sh("node", [cli, "new", base], repo);
sh("git", ["init", "-q"], base);
sh("git", ["add", "-A"], base);
sh("git", ["commit", "-q", "-m", "start"], base);
const baseSha = sh("git", ["rev-parse", "HEAD"], base).stdout.trim();

const results = [];
for (const task of TASKS) {
  console.log(`\n${task.id}`);
  const a = join(root, `${task.id}-smithable`);
  cpSync(base, a, { recursive: true, verbatimSymlinks: true });
  let ms = 0;
  let ok = true;
  for (const op of task.ops) {
    const r = sh("node", [cli, "op", ...op, "--dir", a], repo);
    ms += r.ms;
    ok &&= r.ok;
  }
  const smithable = { ok, ms, tokens: 0, costUsd: 0, ...(await verify(a, task, baseSha)) };
  console.log("  smithable", JSON.stringify(smithable));

  const b = join(root, `${task.id}-claude`);
  cpSync(base, b, { recursive: true, verbatimSymlinks: true });
  const run = sh(
    "claude",
    [
      "-p",
      task.prompt + SUFFIX,
      "--output-format",
      "json",
      "--no-session-persistence",
      "--permission-mode",
      "acceptEdits",
      "--allowedTools",
      "Bash(pnpm *)",
      "Bash(npx *)",
      "Bash(node *)",
    ],
    b,
  );
  let report = {};
  try {
    report = JSON.parse(run.stdout);
  } catch {}
  const u = report.usage ?? {};
  const claude = {
    ok: report.subtype === "success",
    ms: report.duration_ms ?? run.ms,
    turns: report.num_turns,
    tokens:
      (u.input_tokens ?? 0) +
      (u.output_tokens ?? 0) +
      (u.cache_creation_input_tokens ?? 0) +
      (u.cache_read_input_tokens ?? 0),
    outputTokens: u.output_tokens ?? 0,
    costUsd: report.total_cost_usd ?? 0,
    ...(await verify(b, task, baseSha)),
  };
  console.log("  claude   ", JSON.stringify(claude));
  results.push({ task, smithable, claude });
}

const yes = (v) => (v ? "yes" : "**no**");
const rows = results.flatMap(({ task, smithable: s, claude: c }) =>
  [
    ["Smithable op", s],
    ["Claude Code", c],
  ].map(
    ([who, r]) =>
      `| ${task.prompt.replace(/\.$/, "")} | ${who} | ${r.tokens.toLocaleString("en")} | $${r.costUsd.toFixed(2)} | ${(r.ms / 1000).toFixed(1)} s | ${r.filesTouched} / ${r.linesChanged} | ${yes(r.typecheck && r.build)} | ${yes(r.database)} | ${yes(r.rowsKept)} | ${yes(r.visible)} | ${yes(r.specInSync)} | ${yes(r.regeneratesCleanly)} |`,
  ),
);
const date = new Date().toISOString().slice(0, 10);
mkdirSync(join(repo, "docs/benchmarks"), { recursive: true });
writeFileSync(
  join(repo, "docs/benchmarks/m3-mini.md"),
  `# M3 mini-benchmark (${date})

The same tasks on identical copies of the generated CRM (with sample data), done by Smithable operations and by Claude Code in headless mode (default model, file edits allowed, shell limited to pnpm, npx and node). Both results are checked the same way; the production server applies migrations at startup before the database is inspected.

Claude Code was given the task plus: "${SUFFIX.trim()}"

| Task | Done by | Tokens | Cost (API-equivalent) | Time | Files / lines changed | Type-checks and builds | Database changed | Existing rows kept | Visible in the app | Spec updated | Regenerates cleanly |
|---|---|---|---|---|---|---|---|---|---|---|---|
${rows.join("\n")}

Files and lines exclude generated migration snapshots, the route tree and Smithable's records. "Spec updated" means smithable.yml describes the change. "Regenerates cleanly" means the code is exactly what the spec generates; otherwise \`smithable generate\` finds hand-edited generated files and the next change through Smithable runs into a conflict.

Raw results:

\`\`\`json
${JSON.stringify(
  results.map(({ task, smithable, claude }) => ({ task: task.id, smithable, claude })),
  null,
  2,
)}
\`\`\`
`,
);
console.log(`\nWrote docs/benchmarks/m3-mini.md (work in ${root})`);
