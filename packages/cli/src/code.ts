import { spawn } from "node:child_process";
import {
  existsSync,
  lstatSync,
  readdirSync,
  readFileSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { join, resolve, sep } from "node:path";
import { allowedBy, type Location, parsePolicy, type Usage } from "@smithable/ai";
import { buildContext } from "@smithable/index";
import { usageLine } from "./ask.js";
import { discardChanges, ensureRepository, git, uncommittedRefusal } from "./git.js";
import { exec, type Io } from "./io.js";
import { projectIndex } from "./rules.js";
import { loadSpec } from "./validate.js";

/**
 * Something that writes code in a project, given instructions: Claude Code, or a command
 * (for tests and other agents). It may try anything; Smithable checks what it changed.
 */
export interface Coder {
  name: string;
  /** Where the project goes when it runs: the AI policy decides whether it may. */
  location: Location;
  /**
   * Runs in `dir`; it should change files only in `area`, e.g. "src/custom", and may run the
   * type check. It runs nothing that executes the project's code (the tests would): Smithable
   * runs those itself afterwards, once the changes are checked.
   */
  run(dir: string, prompt: string, area: string): Promise<Usage>;
}

/** The coder from the environment: SMITHABLE_CODER=claude-code, or a command to run. */
export function coderFromEnv(env: NodeJS.ProcessEnv = process.env): Coder | undefined {
  if (env.SMITHABLE_CODER === "claude-code") return claudeCodeCoder(env.SMITHABLE_CODER_MODEL);
  if (env.SMITHABLE_CODER_COMMAND) return commandCoder(env.SMITHABLE_CODER_COMMAND);
  return undefined;
}

function run(
  command: string,
  args: string[],
  dir: string,
  input?: string,
  env?: Record<string, string>,
): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: dir,
      stdio: ["pipe", "pipe", "pipe"],
      env: { ...process.env, ...env },
    });
    let out = "";
    child.stdout.on("data", (d) => (out += d));
    child.stderr.on("data", (d) => (out += d));
    child.on("error", reject);
    child.on("close", (code) => (code === 0 ? resolve(out) : reject(new Error(out.trim()))));
    child.stdin.end(input ?? "");
  });
}

/**
 * Claude Code as the coder, headless in the project: it may read the project, edit only its
 * area, and run only the type check, the tests and the given commands. No MCP servers.
 */
function claudeCodeCoder(model?: string): Coder {
  return {
    name: "claude-code",
    location: "elsewhere",
    async run(dir, prompt, area) {
      const out = await run(
        "claude",
        [
          "-p",
          prompt,
          "--output-format",
          "json",
          "--no-session-persistence",
          "--strict-mcp-config",
          // Only what is allowed below; acceptEdits would accept any edit in the project.
          "--permission-mode",
          "dontAsk",
          "--allowedTools",
          // Reading too stays in the project: plain "Read" would allow any file on the machine.
          "Read(./**)",
          "Glob(./**)",
          "Grep(./**)",
          `Edit(${area}/**)`,
          `Write(${area}/**)`,
          // The type check only: tests run the code the coder wrote, so Smithable runs them.
          "Bash(pnpm typecheck)",
          ...(model ? ["--model", model] : []),
        ],
        dir,
      );
      const result = JSON.parse(out) as {
        total_cost_usd?: number;
        usage?: Record<string, number>;
        modelUsage?: Record<string, unknown>;
      };
      const u = result.usage ?? {};
      return {
        provider: "claude-code",
        model: Object.keys(result.modelUsage ?? {})[0] ?? model ?? "claude",
        tier: "frontier",
        inputTokens:
          (u.input_tokens ?? 0) +
          (u.cache_creation_input_tokens ?? 0) +
          (u.cache_read_input_tokens ?? 0),
        outputTokens: u.output_tokens ?? 0,
        cost: result.total_cost_usd ?? 0,
        currency: "USD",
      };
    },
  };
}

/**
 * A command that gets the prompt on stdin and the folder it may change in
 * SMITHABLE_CODER_AREA: another agent, or a stand-in for tests.
 */
function commandCoder(command: string): Coder {
  return {
    name: command,
    // A command says where it runs; unsaid, it may send the project anywhere.
    location:
      (["local", "eu"] as const).find((l) => l === process.env.SMITHABLE_CODER_LOCATION) ??
      "elsewhere",
    async run(dir, prompt, area) {
      await run("sh", ["-c", command], dir, prompt, { SMITHABLE_CODER_AREA: area });
      return {
        provider: "command",
        model: command,
        tier: "frontier",
        inputTokens: 0,
        outputTokens: 0,
        cost: 0,
        currency: "USD",
      };
    },
  };
}

/** The custom file of a concept, e.g. query:churnRisk → src/custom/queries/churn-risk.ts. */
function customFile(concept: string): string | undefined {
  const [kind, name = ""] = concept.split(":");
  const file = name.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`);
  if (kind === "query") return `src/custom/queries/${file}.ts`;
  if (kind === "action") return `src/custom/actions/${file}.ts`;
  if (kind === "page") return `src/custom/pages/${name}.tsx`;
  if (concept === "hooks") return "src/custom/hooks.ts";
  return undefined;
}

/**
 * Runs a coder in the project and checks what it did, never trusting it: every changed file
 * must be in `area`, or everything is undone. Then `after` (Smithable's own follow-up, e.g.
 * regenerating), the type check and the tests; any failure undoes everything. The result is
 * one commit that `smithable undo` reverts.
 */
export async function runCoder(
  dir: string,
  io: Io,
  coder: Coder | undefined,
  task: {
    prompt: string;
    area: string;
    request: string;
    subject: string;
    after?: () => number | Promise<number>;
  },
): Promise<number> {
  if (!coder) {
    io.err(
      "No coder is set up: set SMITHABLE_CODER=claude-code (see docs/ai.md), or write the code yourself.\n",
    );
    return 1;
  }
  // The same policy as every model call: a coder elsewhere needs a policy that allows it.
  const policy = parsePolicy(process.env.SMITHABLE_AI_POLICY);
  const as = { name: coder.name, location: coder.location } as Parameters<typeof allowedBy>[1];
  if (!allowedBy(policy, as)) {
    io.err(
      `The coder (${coder.name}) runs ${coder.location === "elsewhere" ? "outside the EU" : `on ${coder.location}`}, which the AI policy (${process.env.SMITHABLE_AI_POLICY ?? "eu-only"}) does not allow. Set SMITHABLE_AI_POLICY to best-available or allow:${coder.name} to use it (see docs/ai.md).\n`,
    );
    return 1;
  }
  ensureRepository(dir);
  // Undoing also clears ignored files the coder may have left in its folder.
  const discard = () => {
    discardChanges(dir);
    git(dir, ["clean", "-fdxq", "--", task.area]);
  };
  const refused = uncommittedRefusal(dir);
  if (refused) {
    io.err(refused);
    return 1;
  }
  const started = Date.now();
  let usage: Usage;
  // Git's config and hooks are not in the diff: on any failure they are put back as they were.
  const restoreGitConfig = saveGitConfig(dir);
  try {
    const before = watched(dir);
    usage = await coder.run(dir, task.prompt, task.area);
    const after = watched(dir);
    // Ignored files, installed packages, build output, the dev database and Git's config/hooks are not
    // in the diff: they must not change either.
    const touched = [...after]
      .filter(([path, stamp]) => before.get(path) !== stamp)
      .map(([p]) => p);
    touched.push(...[...before.keys()].filter((path) => !after.has(path)));
    const strays = touched.filter(
      (path) => path !== task.area && !path.startsWith(`${task.area}/`),
    );
    if (strays.length) {
      const repaired = repair(dir, strays);
      throw new Error(`it changed ${strays.slice(0, 5).join(", ")}${repaired}`);
    }
  } catch (error) {
    restoreGitConfig();
    discard();
    io.err(
      `The coder failed: ${error instanceof Error ? error.message : String(error)}\nNothing was changed.\n`,
    );
    return 1;
  }
  // What the coder used is reported whatever happens next.
  io.out(`${usageLine([usage])}\n`);
  const changed = changedFiles(dir);
  const root = realpathSync(dir);
  const areaRoot = resolve(root, task.area);
  const outside = changed.filter((path) => {
    if (path !== task.area && !path.startsWith(`${task.area}/`)) return true;
    const full = join(dir, path);
    const stat = lstatSync(full, { throwIfNoEntry: false });
    if (stat?.isSymbolicLink()) return true;
    if (existsSync(full)) {
      const real = realpathSync(full);
      if (real !== areaRoot && !real.startsWith(`${areaRoot}${sep}`)) return true;
    }
    return false;
  });
  if (outside.length > 0) {
    discard();
    io.err(
      `The coder changed files outside ${task.area}/, so every change was undone:\n${outside.map((p) => `  ${p}\n`).join("")}`,
    );
    return 1;
  }
  if (changed.length === 0) {
    io.err("The coder changed nothing.\n");
    return 1;
  }
  const checks: [string, () => boolean | Promise<boolean>][] = [
    ...(task.after
      ? [
          ["Smithable", async () => (await task.after?.()) === 0] as [
            string,
            () => Promise<boolean>,
          ],
        ]
      : []),
    ["The type check", () => exec("pnpm", ["typecheck"], dir) === 0],
    ["The tests", () => exec("pnpm", ["test"], dir) === 0],
  ];
  for (const [what, check] of checks) {
    if (!(await check())) {
      discard();
      io.err(`${what} failed with the new code, so everything was undone.\n`);
      return 1;
    }
  }
  git(dir, ["add", "-A"]);
  const trailer = `Smithable-AI: ${JSON.stringify({
    request: task.request,
    tier: usage.tier,
    model: usage.model,
    tokens: usage.inputTokens + usage.outputTokens,
    cost: Number(usage.cost.toFixed(6)),
    currency: usage.currency,
  })}`;
  const message = `smithable: ${task.subject}\n\nSmithable-Code: ${JSON.stringify({ files: changed })}\nSmithable-Duration: ${Date.now() - started} ms\n${trailer}\n`;
  const commit = git(dir, ["commit", "-q", "-m", message]);
  if (!commit.ok) {
    discard();
    io.err(`Could not commit: ${commit.out}\n`);
    return 1;
  }
  io.out(`Wrote ${changed.join(", ")}; the type check and tests pass. Undo with: smithable undo\n`);
  return 0;
}

/**
 * What the diff does not show, each with its modification time and size: ignored files (such
 * as .env), Git's hooks, and the installed packages, build output and dev database, which the
 * host's own type check and tests would run. Not the caches the preview's dev server writes
 * while the coder works, nor Smithable's snapshots and token log.
 */
function watched(dir: string): Map<string, string> {
  const ignored = git(dir, [
    "status",
    "--porcelain",
    "--ignored",
    "-uall",
    "--",
    ".",
    ":!node_modules",
    ":!data",
    ":!dist",
    ":!test-results",
  ])
    .out.split("\n")
    .filter((line) => line.startsWith("!! "))
    .map((line) => line.slice(3));
  const stamp = (path: string) => {
    if (!existsSync(path)) return "gone";
    const s = lstatSync(path);
    return `${s.mtimeMs}:${s.size}`;
  };
  const out = new Map(ignored.map((p) => [p, stamp(join(dir, p))]));
  for (const gitFile of [".git/config", ".git/info/attributes", ".git/info/exclude"]) {
    out.set(gitFile, stamp(join(dir, gitFile)));
  }
  const hooks = join(dir, ".git", "hooks");
  if (existsSync(hooks))
    for (const h of readdirSync(hooks)) out.set(`.git/hooks/${h}`, stamp(join(hooks, h)));
  const skip =
    /^(node_modules\/\.(vite|cache)|data\/\.smithable\/(snapshots|token-log\.jsonl))(\/|$)/;
  const walk = (rel: string) => {
    if (!existsSync(join(dir, rel))) return;
    for (const entry of readdirSync(join(dir, rel), { withFileTypes: true })) {
      const path = `${rel}/${entry.name}`;
      if (skip.test(path)) continue;
      if (entry.isDirectory()) walk(path);
      else out.set(path, stamp(join(dir, path)));
    }
  };
  for (const folder of ["node_modules", "dist", "data"]) walk(folder);
  return out;
}

/**
 * Puts back what Git cannot: build output goes (it is rebuilt), packages are installed again;
 * a changed dev database is only named. Returns what it did, for the message.
 */
function repair(dir: string, changed: string[]): string {
  const done: string[] = [];
  if (changed.some((p) => p.startsWith("dist/"))) {
    rmSync(join(dir, "dist"), { recursive: true, force: true });
    done.push("the build output was removed");
  }
  if (changed.some((p) => p.startsWith("node_modules/")))
    done.push(
      exec("pnpm", ["install", "--force", "--frozen-lockfile"], dir) === 0
        ? "the packages were installed again"
        : "reinstall the packages with pnpm install --force",
    );
  if (changed.some((p) => p.startsWith("data/")))
    done.push("check the dev database, or restore it from data/.smithable/snapshots");
  return done.length ? `; ${done.join("; ")}` : "";
}

/** Git's hooks and config as they are now; the function returned puts them back exactly so. */
function saveGitConfig(dir: string): () => void {
  const hooks = join(dir, ".git", "hooks");
  const savedHooks = new Map(
    existsSync(hooks)
      ? readdirSync(hooks).map((h) => [h, readFileSync(join(hooks, h))] as const)
      : [],
  );
  const readGit = (path: string) =>
    existsSync(join(dir, path)) ? readFileSync(join(dir, path)) : null;
  const savedConfig = readGit(".git/config");
  const savedAttrs = readGit(".git/info/attributes");

  return () => {
    if (existsSync(hooks)) {
      for (const h of readdirSync(hooks))
        if (!savedHooks.has(h)) rmSync(join(hooks, h), { force: true });
      for (const [h, content] of savedHooks) writeFileSync(join(hooks, h), content);
    }
    const writeGit = (path: string, content: Buffer | null) =>
      content ? writeFileSync(join(dir, path), content) : rmSync(join(dir, path), { force: true });
    writeGit(".git/config", savedConfig);
    writeGit(".git/info/attributes", savedAttrs);
  };
}

/** Every changed file, one by one (also inside new folders); a rename counts as both names. */
function changedFiles(dir: string): string[] {
  return (
    git(dir, ["status", "--porcelain", "-uall"])
      .out.split("\n")
      .filter(Boolean)
      // "XY path": the status letters, then the path (the helper trims the first line's space).
      .flatMap((line) => line.replace(/^\s*\S{1,2}\s+/, "").split(" -> "))
      .map((path) => path.replace(/^"|"$/g, ""))
  );
}

/**
 * Has a coder write the custom code of a concept (ARCHITECTURE §9.1): only files in
 * src/custom/ may change, then the type check and the tests must pass.
 */
export async function writeCode(
  dir: string,
  io: Io,
  concept: string,
  instructions: string,
  coder: Coder | undefined = coderFromEnv(),
): Promise<number> {
  const { ir, auth } = loadSpec(dir, io);
  if (!ir || !auth) return 1;
  const file = customFile(concept);
  if (!file || !existsSync(join(dir, file))) {
    io.err(
      `${concept} has no custom code to write. Queries, actions, customized pages and hooks do.\n`,
    );
    return 1;
  }
  const index = projectIndex(dir, ir, auth);
  const info = index.concepts.find((c) => c.concept === concept);
  const paths =
    concept === "hooks"
      ? [file, "src/generated/hooks.ts"]
      : (info?.files ?? [])
          .filter((f) => f.role !== "generated" || f.path.startsWith("src/generated/queries/"))
          .map((f) => f.path);
  const code = paths
    .filter((path) => existsSync(join(dir, path)))
    .map((path) => ({ path, text: readFileSync(join(dir, path), "utf8") }));
  const context = buildContext(index, `${instructions} (${concept})`, { implementation: code });
  const prompt = `You write the custom code of one part of a Smithable app. Smithable generates the rest of the app from smithable.yml.

Task: ${instructions}
Part: ${concept}, implemented in ${file}.
${
  concept === "hooks"
    ? `Hooks run on the server after a record is created, changed or deleted (afterCreate, afterUpdate, afterDelete, by model) and once a day (daily); their types are in src/generated/hooks.ts. Add to the exported hooks object and keep the other hooks. To send mail, import { sendMail } from "#/kit/mail" ({ to, subject, text, html? }); in tests, outbox() from the same module lists what was sent. Put a Vitest test in src/custom/hooks.test.ts that calls the data function and checks what the hook did.
`
    : ""
}
Rules:
- Change only files in src/custom/. Everything else is generated or owned by Smithable, and changes there are undone.
- Read and write data only through the functions in src/generated/*.server.ts: they apply the access rules for the viewer.
- Keep the exported function's name and signature; its types come from src/generated/.
- For each rule of this part that you implement, put "// implements rule <id>" above the code, and a Vitest test named "rule <id>: …" in src/custom/ next to it.
- Finish when "pnpm typecheck" passes; Smithable runs the tests afterwards.

${context.text}`;
  return runCoder(dir, io, coder, {
    prompt,
    area: "src/custom",
    request: instructions,
    subject: `Write the code of ${concept}`,
  });
}
