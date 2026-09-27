import { spawn } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { Usage } from "@smithable/ai";
import { buildContext } from "@smithable/index";
import { usageLine } from "./ask.js";
import { discardChanges, ensureRepository, git, uncommitted } from "./git.js";
import { exec, type Io } from "./io.js";
import { projectIndex } from "./rules.js";
import { loadSpec } from "./validate.js";

/** Where AI may write code: the custom zone (ARCHITECTURE §6.4), nothing else. */
const CUSTOM = /^src\/custom\//;

/**
 * Something that writes code in a project, given instructions: Claude Code, or a command
 * (for tests and other agents). It may try anything; Smithable checks what it changed.
 */
export interface Coder {
  name: string;
  run(dir: string, prompt: string): Promise<Usage>;
}

/** The coder from the environment: SMITHABLE_CODER=claude-code, or a command to run. */
export function coderFromEnv(env: NodeJS.ProcessEnv = process.env): Coder | undefined {
  if (env.SMITHABLE_CODER === "claude-code") return claudeCodeCoder(env.SMITHABLE_CODER_MODEL);
  if (env.SMITHABLE_CODER_COMMAND) return commandCoder(env.SMITHABLE_CODER_COMMAND);
  return undefined;
}

function run(command: string, args: string[], dir: string, input?: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd: dir, stdio: ["pipe", "pipe", "pipe"] });
    let out = "";
    child.stdout.on("data", (d) => (out += d));
    child.stderr.on("data", (d) => (out += d));
    child.on("error", reject);
    child.on("close", (code) => (code === 0 ? resolve(out) : reject(new Error(out.trim()))));
    child.stdin.end(input ?? "");
  });
}

/**
 * Claude Code as the coder, headless in the project: it may read the project, edit only
 * src/custom/, and run only the type check and the tests. No MCP servers.
 */
function claudeCodeCoder(model?: string): Coder {
  return {
    name: "claude-code",
    async run(dir, prompt) {
      const out = await run(
        "claude",
        [
          "-p",
          prompt,
          "--output-format",
          "json",
          "--no-session-persistence",
          "--strict-mcp-config",
          "--permission-mode",
          "acceptEdits",
          "--allowedTools",
          "Read",
          "Glob",
          "Grep",
          "Edit(src/custom/**)",
          "Write(src/custom/**)",
          "Bash(pnpm typecheck)",
          "Bash(pnpm test *)",
          "Bash(pnpm test)",
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

/** A command that gets the prompt on stdin, e.g. another agent, or a stand-in for tests. */
function commandCoder(command: string): Coder {
  return {
    name: command,
    async run(dir, prompt) {
      await run("sh", ["-c", command], dir, prompt);
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
 * Has a coder write the custom code of a concept (ARCHITECTURE §9.1): only files in
 * src/custom/ may change, then the type check and the tests must pass. Otherwise every
 * change is undone. The result is committed as one change that `smithable undo` reverts.
 */
export async function writeCode(
  dir: string,
  io: Io,
  concept: string,
  instructions: string,
  coder: Coder | undefined = coderFromEnv(),
): Promise<number> {
  if (!coder) {
    io.err(
      "No coder is set up: set SMITHABLE_CODER=claude-code (see docs/ai.md), or implement the code yourself.\n",
    );
    return 1;
  }
  const { ir, auth } = loadSpec(dir, io);
  if (!ir || !auth) return 1;
  const file = customFile(concept);
  if (!file || !existsSync(join(dir, file))) {
    io.err(`${concept} has no custom code to write. Queries, actions and customized pages do.\n`);
    return 1;
  }
  ensureRepository(dir);
  const dirty = uncommitted(dir);
  if (dirty.length > 0) {
    io.err(`Commit or discard these changes first:\n${dirty.map((l) => `  ${l}\n`).join("")}`);
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
- Finish when "pnpm typecheck" and "pnpm test" pass.

${context.text}`;
  const started = Date.now();
  let usage: Usage;
  try {
    usage = await coder.run(dir, prompt);
  } catch (error) {
    discardChanges(dir);
    io.err(
      `The coder failed: ${error instanceof Error ? error.message : String(error)}\nNothing was changed.\n`,
    );
    return 1;
  }
  // Every changed file, one by one (also inside new folders); a rename counts as both names.
  const changed = git(dir, ["status", "--porcelain", "-uall"])
    .out.split("\n")
    .filter(Boolean)
    // "XY path": the status letters, then the path (the helper trims the first line's space).
    .flatMap((line) => line.replace(/^\s*\S{1,2}\s+/, "").split(" -> "))
    .map((path) => path.replace(/^"|"$/g, ""));
  const outside = changed.filter((path) => !CUSTOM.test(path));
  if (outside.length > 0) {
    discardChanges(dir);
    io.err(
      `The coder changed files outside src/custom/, so every change was undone:\n${outside.map((p) => `  ${p}\n`).join("")}`,
    );
    return 1;
  }
  if (changed.length === 0) {
    io.err("The coder changed nothing.\n");
    return 1;
  }
  for (const [what, args] of [
    ["The type check", ["typecheck"]],
    ["The tests", ["test"]],
  ] as const) {
    if (exec("pnpm", [...args], dir) !== 0) {
      discardChanges(dir);
      io.err(`${what} failed with the new code, so it was undone. Nothing was changed.\n`);
      return 1;
    }
  }
  git(dir, ["add", "-A"]);
  const trailer = `Smithable-AI: ${JSON.stringify({
    request: instructions,
    tier: usage.tier,
    model: usage.model,
    tokens: usage.inputTokens + usage.outputTokens,
    cost: Number(usage.cost.toFixed(6)),
    currency: usage.currency,
  })}`;
  const message = `smithable: Write the code of ${concept}\n\nSmithable-Code: ${JSON.stringify({ concept, files: changed })}\nSmithable-Duration: ${Date.now() - started} ms\n${trailer}\n`;
  const commit = git(dir, ["commit", "-q", "-m", message]);
  if (!commit.ok) {
    discardChanges(dir);
    io.err(`Could not commit the code: ${commit.out}\n`);
    return 1;
  }
  io.out(
    `${usageLine([usage])}\nWrote ${changed.join(", ")}; the type check and tests pass. Undo with: smithable undo\n`,
  );
  return 0;
}
