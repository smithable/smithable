// M7 benchmark: the roadmap's seven tasks, one after another on the same app, done by
//   S  Smithable operations run by this script (no model),
//   A  plain Claude Code editing the repository,
//   B  Claude Code with the same permissions plus the Smithable MCP server,
//   M  Smithable's own AI: `smithable ask "<task>" --yes` with the models set up in the
//      environment (docs/ai.md), e.g. a local model or the Smithable model.
// After every task, the same checks run for all three: type-check, build, the app's tests,
// the task's own check (database or a real browser signed in as a role), every earlier
// task's check again (regressions), and whether the code is still what the spec generates.
// A and B use the user's Claude usage, and M the configured models': ask before running them.
// Run after `pnpm build`: `node scripts/bench-m7.mjs [S] [A] [B]` (default: all three).
// Writes docs/benchmarks/m7.md (or m7-<setups>.md for a partial run).
import { spawn, spawnSync } from "node:child_process";
import { cpSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { chromium } from "playwright";

const repo = new URL("..", import.meta.url).pathname;
const cli = join(repo, "packages/cli/dist/bin.js");
const root = mkdtempSync(join(tmpdir(), "smithable-bench-m7-"));
const variants = process.argv.slice(2).length ? process.argv.slice(2) : ["S", "A", "B"];
const PORT = 4750;

// The starting point: the CRM without phone numbers and orders, so every task is a change.
const SPEC = `smithable: 0.1

app:
  name: Acme CRM
  description: Lightweight CRM for a small B2B sales team.
  currency: EUR
  timezone: Europe/Mariehamn

models:
  Customer:
    description: A company we have a commercial relationship with.
    fields:
      name: string!
      email: email unique
      segment: smb | enterprise | government
      notes: text

pages:
  customers:
    crud: Customer
  team:
    users: manage

navigation: [customers, team]
`;

const SUFFIX =
  " Keep the app working: update whatever is needed (database, forms, tables) and make sure it type-checks.";

/** Each task: the request, Smithable's operations (null: none fits), and its check. */
const TASKS = [
  {
    id: "phone",
    prompt: "Customers should have a phone number.",
    ops: [["addField", "Customer", "phone", "phone"]],
    check: async ({ db, page }) =>
      db.columns("customers").includes("phone") &&
      (await formHasField(page, "/customers/new", "Phone")),
  },
  {
    id: "email-required",
    prompt: "The customer email should be required.",
    ops: [["changeField", "Customer", "email", "email!", "unique"]],
    check: async ({ db }) => db.notNull("customers", "email"),
  },
  {
    id: "orders",
    prompt: "Add orders: each order has a number, belongs to a customer and has a total amount.",
    ops: [["addModel", "Order", "number=string!", "customer=Customer!", "total=money!"]],
    check: async ({ db }) => {
      const table = db.tables().find((t) => /^orders?$/.test(t));
      if (!table) return false;
      const columns = db.columns(table);
      return (
        columns.includes("number") && columns.includes("total") && db.references(table, "customers")
      );
    },
  },
  {
    id: "orders-page",
    prompt: "Add a page for orders, and show it in the menu.",
    ops: [["addPage", "orders", "Order"]],
    check: async ({ page, base }) => {
      await open(page, `${base}/customers`);
      if (
        !(await page
          .getByRole("navigation")
          .getByRole("link", { name: /orders/i })
          .count())
      )
        return false;
      await page
        .getByRole("navigation")
        .getByRole("link", { name: /orders/i })
        .click();
      // The heading changes once the page has loaded; the URL changes before that.
      return page
        .getByRole("heading", { level: 1, name: /orders/i })
        .waitFor({ timeout: 10000 })
        .then(
          () => true,
          () => false,
        );
    },
  },
  {
    id: "admin-delete",
    prompt: "Only admins may delete customers.",
    ops: [["setAccess", "model:Customer.delete", "admin"]],
    check: async ({ db, page, base, signIn }) => {
      // As sales: deleting must fail or be impossible. As admin: it must work.
      const attempt = async (role) => {
        const id = db.insert("customers", {
          name: `Delete test ${role}`,
          email: `delete-${role}-${Date.now()}@example.com`,
          segment: "smb",
        });
        await signIn(role);
        await open(page, `${base}/customers/${id}`);
        const button = page.getByRole("button", { name: "Delete", exact: true });
        if (await button.count()) {
          // The app asks in a dialog that names the record; confirm there.
          await button.click();
          await page
            .getByRole("dialog")
            .getByRole("button", { name: /^Delete / })
            .click();
          await page.waitForTimeout(1500);
        }
        return db.exists("customers", id);
      };
      const salesKept = await attempt("sales");
      const adminKept = await attempt("admin");
      return salesKept && !adminKept;
    },
  },
  {
    id: "search",
    prompt: "Make it possible to search customers by name on the customers page.",
    ops: [["setSearch", "customers", "name"]],
    check: async ({ page, base, signIn }) => {
      await signIn("admin");
      await open(page, `${base}/customers`);
      const box = page
        .getByRole("searchbox")
        .or(page.getByPlaceholder(/search/i))
        .first();
      if (!(await box.count())) return false;
      await box.fill("Nordic");
      await page.waitForTimeout(1500);
      return (
        (await page.getByText("Nordic Timber Oy").count()) > 0 &&
        (await page.getByText("Baltic Freight AB").count()) === 0
      );
    },
  },
  {
    id: "menu-order",
    prompt: "Show Orders first in the menu.",
    ops: [["setNavigation", "main", "orders", "customers"]],
    check: async ({ page, base }) => {
      await open(page, `${base}/customers`);
      // Orders first, and Customers still in the menu.
      const links = await page.getByRole("navigation").getByRole("link").allInnerTexts();
      return /orders/i.test(links[0] ?? "") && links.some((l) => /customers/i.test(l));
    },
  },
];

function sh(command, args, cwd, env) {
  const started = Date.now();
  const r = spawnSync(command, args, {
    cwd,
    encoding: "utf8",
    maxBuffer: 1 << 27,
    env: { ...process.env, ...env },
  });
  return {
    ok: r.status === 0,
    out: `${r.stdout}${r.stderr}`,
    stdout: r.stdout,
    ms: Date.now() - started,
  };
}

function database(dir) {
  const node = (code) =>
    sh(
      "node",
      ["-e", `const D=require("better-sqlite3");const db=new D("data/db/app.db");${code}`],
      dir,
    );
  const q = (sql) =>
    JSON.parse(
      node(`console.log(JSON.stringify(db.prepare(${JSON.stringify(sql)}).all()))`).stdout || "[]",
    );
  return {
    tables: () => q("select name from sqlite_master where type='table'").map((t) => t.name),
    columns: (t) => q(`select name from pragma_table_info('${t}')`).map((c) => c.name),
    notNull: (t, c) =>
      q(`select "notnull" n from pragma_table_info('${t}') where name='${c}'`)[0]?.n === 1,
    references: (t, target) =>
      q(`select "table" t from pragma_foreign_key_list('${t}')`).some((r) => r.t === target),
    exists: (t, id) => q(`select id from ${t} where id = ${Number(id)}`).length === 1,
    insert: (t, values) => {
      const now = Date.now();
      const row = { ...values, created_at: now, updated_at: now };
      const keys = Object.keys(row);
      const out = node(
        `console.log(db.prepare(${JSON.stringify(`insert into ${t} (${keys.join(", ")}) values (${keys.map(() => "?").join(", ")})`)}).run(...${JSON.stringify(Object.values(row))}).lastInsertRowid)`,
      );
      return Number(out.stdout.trim());
    },
  };
}

async function open(page, url) {
  await page.goto(url);
  await page.waitForLoadState("networkidle");
}

async function formHasField(page, url, label) {
  await open(page, `http://localhost:${PORT}${url}`);
  return (await page.getByLabel(new RegExp(`^${label}`)).count()) > 0;
}

/** Runs every check so far on the app, in a dev server with the development sign-in. */
async function checkAll(dir, upTo) {
  const server = spawn("pnpm", ["exec", "vite", "dev", "--port", String(PORT), "--strictPort"], {
    cwd: dir,
    env: {
      ...process.env,
      BETTER_AUTH_SECRET: "bench-secret-0123456789abcdef0123456789",
      BETTER_AUTH_URL: `http://localhost:${PORT}`,
    },
    detached: true,
  });
  const base = `http://localhost:${PORT}`;
  const browser = await chromium.launch();
  const page = await browser.newPage();
  const signIn = async (role) => {
    for (let attempt = 1; attempt <= 3; attempt++) {
      await open(page, `${base}/sign-in`);
      await page.getByRole("button", { name: `Sign in as ${role}` }).click();
      try {
        // The development user's name: "Sign out" is already there when switching roles.
        await page.getByText(`Dev ${role}`, { exact: true }).waitFor({ timeout: 5000 });
        return;
      } catch {}
    }
  };
  const results = {};
  try {
    for (let i = 0; i < 60; i++) {
      try {
        if ((await fetch(`${base}/health`)).ok) break;
      } catch {}
      await new Promise((r) => setTimeout(r, 500));
    }
    for (const task of TASKS.slice(0, upTo + 1)) {
      try {
        await signIn("admin");
        results[task.id] = await task.check({ db: database(dir), page, base, signIn });
      } catch (error) {
        console.log(
          `    ${task.id} check: ${String(error.message).split("\n")[0]} at ${page.url()}`,
        );
        results[task.id] = false;
      }
    }
  } finally {
    await browser.close();
    try {
      process.kill(-server.pid);
    } catch {}
  }
  return results;
}

/** Commits whatever the task left, and measures what changed since `since` (a commit). */
function commit(dir, message, since = "HEAD") {
  sh("git", ["add", "-A"], dir);
  const stat = sh("git", ["diff", "--cached", "--numstat", since], dir)
    .stdout.split("\n")
    .filter(Boolean)
    .filter((l) => !/drizzle\/meta\/|routeTree\.gen|\.smithable\/|pnpm-lock/.test(l));
  sh("git", ["commit", "-q", "--allow-empty", "-m", message], dir);
  return {
    files: stat.length,
    lines: stat.reduce(
      (n, l) => n + (Number(l.split("\t")[0]) || 0) + (Number(l.split("\t")[1]) || 0),
      0,
    ),
  };
}

/** One headless Claude Code session for a task; B also has the Smithable MCP server. */
function claude(dir, prompt, withMcp) {
  const config = join(root, `mcp-${withMcp ? "smithable" : "none"}.json`);
  writeFileSync(
    config,
    JSON.stringify({
      mcpServers: withMcp
        ? { smithable: { command: "node", args: [cli, "mcp", "--dir", dir] } }
        : {},
    }),
  );
  const run = sh(
    "claude",
    [
      "-p",
      prompt + SUFFIX,
      "--output-format",
      "stream-json",
      "--verbose",
      "--no-session-persistence",
      "--mcp-config",
      config,
      "--strict-mcp-config",
      "--permission-mode",
      "acceptEdits",
      "--allowedTools",
      "Bash(pnpm *)",
      "Bash(npx *)",
      "Bash(node *)",
      ...(withMcp ? ["mcp__smithable"] : []),
    ],
    dir,
  );
  const events = run.stdout.split("\n").flatMap((line) => {
    try {
      return [JSON.parse(line)];
    } catch {
      return [];
    }
  });
  const tools = events.flatMap((e) =>
    e.type === "assistant"
      ? (e.message?.content ?? []).filter((c) => c.type === "tool_use").map((c) => c.name)
      : [],
  );
  const result = events.find((e) => e.type === "result") ?? {};
  const u = result.usage ?? {};
  return {
    ms: result.duration_ms ?? run.ms,
    tokens:
      (u.input_tokens ?? 0) +
      (u.output_tokens ?? 0) +
      (u.cache_creation_input_tokens ?? 0) +
      (u.cache_read_input_tokens ?? 0),
    costUsd: result.total_cost_usd ?? 0,
    turns: result.num_turns ?? 0,
    smithableCalls: tools.filter((t) => t.startsWith("mcp__smithable__")).length,
    fileTools: tools.filter((t) =>
      ["Read", "Edit", "Write", "MultiEdit", "Grep", "Glob"].includes(t),
    ).length,
    finalMessage: String(result.result ?? "").slice(0, 400),
  };
}

// ── Run ──────────────────────────────────────────────────────────────────────

// Created like `smithable new` does: the spec with the CRM's auth file, generated and seeded.
const base = join(root, "base");
mkdirSync(base);
writeFileSync(join(base, "smithable.yml"), SPEC);
cpSync(join(repo, "examples/crm/smithable.auth.yml"), join(base, "smithable.auth.yml"));
if (!sh("node", [cli, "generate", base], repo).ok)
  throw new Error("generating the starting point failed");
sh("pnpm", ["db:seed"], base);
sh("git", ["init", "-q"], base);
commit(base, "start");

const results = {};
for (const variant of variants) {
  console.log(`\n${variant}`);
  const dir = join(root, variant);
  cpSync(base, dir, { recursive: true, verbatimSymlinks: true });
  if (variant === "A") {
    // Plain Claude Code: no Smithable guidance or tools in the repository.
    for (const f of ["AGENTS.md", "CLAUDE.md", ".mcp.json"]) rmSync(join(dir, f), { force: true });
    commit(dir, "without Smithable guidance");
  }
  results[variant] = [];
  for (const [index, task] of TASKS.entries()) {
    const before = sh("git", ["rev-parse", "HEAD"], dir).stdout.trim();
    let run;
    if (variant === "S") {
      const started = Date.now();
      const ok =
        task.ops?.every((op) => sh("node", [cli, "op", ...op, "--dir", dir], repo).ok) ?? false;
      run = {
        ms: Date.now() - started,
        tokens: 0,
        costUsd: 0,
        turns: 0,
        possible: task.ops !== null,
        opsOk: ok,
      };
    } else if (variant === "M") {
      const started = Date.now();
      const asked = sh("node", [cli, "ask", task.prompt, "--yes", "--dir", dir], repo);
      const used = /\(([^)]+)\) · ([\d,]+) tokens(?: · ([€$])([\d.]+))?/.exec(asked.out);
      run = {
        ms: Date.now() - started,
        model: used?.[1] ?? "none",
        // A wording rule read the request: no model was used (tier 0).
        generator: /^Generator /m.test(asked.out),
        tokens: Number((used?.[2] ?? "0").replaceAll(",", "")),
        costEur: used?.[3] === "€" ? Number(used[4]) : 0,
        costUsd: used?.[3] === "$" ? Number(used[4]) : 0,
        outcome: asked.out.split("\n").slice(1, 4).join(" ").slice(0, 200),
      };
    } else {
      run = claude(dir, task.prompt, variant === "B");
    }
    const changed = commit(dir, `task ${task.id}`, before);
    const typecheck = sh("pnpm", ["typecheck"], dir).ok;
    const build = sh("pnpm", ["build"], dir).ok;
    const tests = sh("pnpm", ["test"], dir).ok;
    const checks = await checkAll(dir, index);
    const regenerates = !sh("node", [cli, "generate", dir], repo).out.includes("edited by hand");
    sh("git", ["checkout", "--", "."], dir);
    const row = {
      task: task.id,
      ...run,
      ...changed,
      typecheck,
      build,
      tests,
      done: checks[task.id],
      regressions: TASKS.slice(0, index)
        .filter((t) => results[variant][TASKS.indexOf(t)]?.done && !checks[t.id])
        .map((t) => t.id),
      regenerates,
    };
    results[variant].push(row);
    console.log(`  ${task.id}: ${JSON.stringify(row)}`);
  }
}

// ── Report ───────────────────────────────────────────────────────────────────

const yes = (v) => (v ? "yes" : "**no**");
const NAMES = {
  S: "Smithable ops (no model)",
  A: "Claude Code",
  B: "Claude Code + MCP",
  M: `smithable ask (${process.env.SMITHABLE_MODEL || process.env.SMITHABLE_LOCAL_MODEL || (process.env.SMITHABLE_FRONTIER === "bedrock" ? `${process.env.SMITHABLE_FRONTIER_MODEL} through Amazon Bedrock` : process.env.SMITHABLE_FRONTIER ? "Claude Code" : "no model")})`,
};
// Smithable's models are priced in euros, Claude Code in dollars.
const money = (v, r) =>
  v === "M" && r.costEur ? `€${r.costEur.toFixed(4)}` : `$${r.costUsd.toFixed(v === "M" ? 4 : 2)}`;
const rows = TASKS.flatMap((task, i) =>
  variants.map((v) => {
    const r = results[v][i];
    if (!r) return "";
    const how =
      v === "S"
        ? r.possible
          ? "operations"
          : "no operation fits"
        : v === "M"
          ? r.outcome
          : `${r.turns} turns, ${r.smithableCalls} Smithable calls, ${r.fileTools} file tools`;
    const by = v === "M" && r.generator ? `generator (${r.model}), no model` : NAMES[v];
    return `| ${task.prompt} | ${by} | ${r.tokens.toLocaleString("en")} | ${money(v, r)} | ${(r.ms / 1000).toFixed(0)} s | ${how} | ${r.files} / ${r.lines} | ${yes(r.typecheck && r.build && r.tests)} | ${yes(r.done)} | ${r.regressions.length ? `**${r.regressions.join(", ")}**` : "none"} | ${yes(r.regenerates)} |`;
  }),
);
const totals = variants.map((v) => {
  const list = results[v];
  const sum = (k) => list.reduce((n, r) => n + r[k], 0);
  return `| ${NAMES[v]} | ${list.filter((r) => r.done).length} / ${list.length} | ${sum("tokens").toLocaleString("en")} | ${v === "M" ? `€${sum("costEur").toFixed(4)}` : `$${sum("costUsd").toFixed(2)}`} | ${(sum("ms") / 1000).toFixed(0)} s | ${list.filter((r) => r.regressions.length).length} | ${list.filter((r) => !r.regenerates).length} |`;
});
const report = `# M7 benchmark (${new Date().toISOString().slice(0, 10)})

Seven tasks, in order, on the same app: a CRM with customers only (name, email, segment, notes) and a team page, sample data and the CRM's roles (admin, sales). Each Claude Code task is a fresh headless session (default model, ${sh("claude", ["--version"], repo).stdout.trim()}), with file edits allowed and the shell limited to pnpm, npx and node; B also has the Smithable MCP server. A's repository has no Smithable guidance (AGENTS.md, CLAUDE.md and .mcp.json removed). Every prompt ends with: "${SUFFIX.trim()}"

After every task the same checks run for all: type-check, build and the app's own tests; the task's check (the database, or a real browser signed in with the development sign-in); every earlier task's check again; and whether \`smithable generate\` still finds the code to be exactly what the spec generates.

## Totals

| Done by | Tasks done | Tokens | Cost (API-equivalent) | Time | Tasks with regressions | Tasks leaving drift |
|---|---|---|---|---|---|---|
${totals.join("\n")}

## Per task

| Task | Done by | Tokens | Cost | Time | How | Files / lines | Type-checks, builds, tests pass | Task done | Regressions | Regenerates cleanly |
|---|---|---|---|---|---|---|---|---|---|---|
${rows.filter(Boolean).join("\n")}

Files and lines exclude migration snapshots, the route tree, the lockfile and Smithable's records.

## Raw results

\`\`\`json
${JSON.stringify(results, null, 2)}
\`\`\`
`;
// A run of only some setups gets its own report, so the full run stays as it was.
const file = `docs/benchmarks/m7${variants.join("") === "SAB" ? "" : `-${variants.join("")}`}.md`;
writeFileSync(join(repo, file), report);
console.log(`\nWrote ${file}. The apps are in ${root}`);
