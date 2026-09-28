import { spawn } from "node:child_process";
import { existsSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { allowedBy, type Location, parsePolicy, type Usage } from "@smithable/ai";
import { buildContext } from "@smithable/index";
import { usageLine } from "./ask.js";
import { discardChanges, ensureRepository, git, uncommitted } from "./git.js";
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
  const dirty = uncommitted(dir);
  if (dirty.length > 0) {
    io.err(`Commit or discard these changes first:\n${dirty.map((l) => `  ${l}\n`).join("")}`);
    return 1;
  }
  const started = Date.now();
  let usage: Usage;
  try {
    const before = watched(dir);
    const hooks = saveHooks(dir);
    usage = await coder.run(dir, task.prompt, task.area);
    const after = watched(dir);
    // Ignored files and Git's hooks are not in the diff: they must not change either.
    const touched = [...after]
      .filter(([path, stamp]) => before.get(path) !== stamp)
      .map(([p]) => p);
    touched.push(...[...before.keys()].filter((path) => !after.has(path)));
    const strays = touched.filter((path) => !path.startsWith(`${task.area}/`));
    if (strays.length) {
      // Git's undo does not reach its hooks: they are put back as they were.
      hooks();
      throw new Error(`it changed ${strays.slice(0, 5).join(", ")}`);
    }
  } catch (error) {
    discard();
    io.err(
      `The coder failed: ${error instanceof Error ? error.message : String(error)}\nNothing was changed.\n`,
    );
    return 1;
  }
  // What the coder used is reported whatever happens next.
  io.out(`${usageLine([usage])}\n`);
  const changed = changedFiles(dir);
  const outside = changed.filter((path) => !path.startsWith(`${task.area}/`));
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
 * What the diff does not show: ignored files (such as .env), and Git's hooks, each with its
 * modification time.
 */
function watched(dir: string): Map<string, number> {
  // Not the installed packages, databases and build output (large, and changed by tools).
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
  const hooks = join(dir, ".git", "hooks");
  const paths = [
    ...ignored.map((p) => [p, join(dir, p)] as const),
    ...(existsSync(hooks)
      ? readdirSync(hooks).map((h) => [`.git/hooks/${h}`, join(hooks, h)] as const)
      : []),
  ];
  return new Map(
    paths.map(([name, path]) => [name, existsSync(path) ? statSync(path).mtimeMs : 0]),
  );
}

/** Git's hooks as they are now; the function returned puts them back exactly so. */
function saveHooks(dir: string): () => void {
  const hooks = join(dir, ".git", "hooks");
  const saved = new Map(
    existsSync(hooks)
      ? readdirSync(hooks).map((h) => [h, readFileSync(join(hooks, h))] as const)
      : [],
  );
  return () => {
    if (!existsSync(hooks)) return;
    for (const h of readdirSync(hooks)) if (!saved.has(h)) rmSync(join(hooks, h), { force: true });
    for (const [h, content] of saved) writeFileSync(join(hooks, h), content);
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
    io.err(`${concept} has no custom code to write. Queries, actions and customized pages do.\n`);
    return 1;
  }
  const index = projectIndex(dir, ir, auth);
  const info = index.concepts.find((c) => c.concept === concept);
  const code = (info?.files ?? [])
    .filter((f) => f.role !== "generated" || f.path.startsWith("src/generated/queries/"))
    .map((f) => f.path)
    .filter((path) => existsSync(join(dir, path)))
    .map((path) => ({ path, text: readFileSync(join(dir, path), "utf8") }));
  const context = buildContext(index, `${instructions} (${concept})`, { implementation: code });
  const prompt = `You write the custom code of one part of a Smithable app. Smithable generates the rest of the app from smithable.yml.

Task: ${instructions}
Part: ${concept}, implemented in ${file}.

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
