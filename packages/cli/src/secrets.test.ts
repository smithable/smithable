import { mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, expect, test } from "vitest";
import { git } from "./git.js";
import { execQuiet } from "./io.js";
import { childEnv, holdSecrets, modelKey, releaseSecretsForTests, studioToken } from "./secrets.js";

const NAMES = ["SMITHABLE_STUDIO_TOKEN", "SMITHABLE_MODEL_KEY"];
const dirs: string[] = [];
afterEach(() => {
  releaseSecretsForTests();
  for (const name of NAMES) delete process.env[name];
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

test("the two names leave the environment at start and are held for the engine alone", () => {
  const env: NodeJS.ProcessEnv = {
    SMITHABLE_STUDIO_TOKEN: "studio-token",
    SMITHABLE_MODEL_KEY: "model-key",
    HOME: "/home/someone",
  };
  holdSecrets(env);
  expect(env).toEqual({ HOME: "/home/someone" });
  expect(studioToken()).toBe("studio-token");
  expect(modelKey()).toBe("model-key");
  // Given back explicitly by mistake, a child's environment still leaves them out.
  const child = childEnv(
    { ...env, SMITHABLE_MODEL_KEY: "model-key" },
    {
      SMITHABLE_STUDIO_TOKEN: "studio-token",
      NO_COLOR: "1",
    },
  );
  expect(child).toEqual({ HOME: "/home/someone", NO_COLOR: "1" });
});

/**
 * Every child the CLI starts gets its environment from childEnv: each call of a node:child_process
 * function in the CLI's sources names it in its options. A new call that does not fails here.
 */
test("every child process the CLI starts is given childEnv's environment", () => {
  const src = new URL(".", import.meta.url).pathname;
  const missing: string[] = [];
  for (const name of readdirSync(src)) {
    if (!name.endsWith(".ts") || name.endsWith(".test.ts") || name.endsWith(".gen.ts")) continue;
    const text = readFileSync(join(src, name), "utf8");
    const from = /import \{([^}]*)\} from "node:child_process"/.exec(text);
    if (!from) continue;
    const calls = (from[1] ?? "")
      .split(",")
      .map(
        (s) =>
          s
            .trim()
            .split(/\s+as\s+/)
            .pop() ?? "",
      )
      .filter((s) => /^(spawn|spawnSync|execFile|execFileSync|execSync|exec|fork)$/.test(s));
    for (const call of calls) {
      for (const match of text.matchAll(new RegExp(`\\b${call}\\(`, "g"))) {
        // The call's own text, to its closing parenthesis.
        let depth = 0;
        let end = match.index + match[0].length - 1;
        for (; end < text.length; end++) {
          if (text[end] === "(") depth++;
          else if (text[end] === ")" && --depth === 0) break;
        }
        const body = text.slice(match.index, end + 1);
        if (!/\benv:\s*childEnv\(/.test(body)) {
          const line = text.slice(0, match.index).split("\n").length;
          missing.push(`${name}:${line} ${call}(`);
        }
      }
    }
  }
  expect(missing).toEqual([]);
});

test("a command and git run without the two names", () => {
  process.env.SMITHABLE_STUDIO_TOKEN = "studio-token";
  process.env.SMITHABLE_MODEL_KEY = "model-key";
  holdSecrets();
  const dir = mkdtempSync(join(tmpdir(), "child-env-"));
  dirs.push(dir);
  // A command the CLI runs (pnpm, tsc, the project's tests go this way): its environment, written.
  const script = join(dir, "env.mjs");
  writeFileSync(
    script,
    "import { writeFileSync } from 'node:fs'; writeFileSync(process.argv[2], JSON.stringify(process.env));",
  );
  expect(execQuiet("node", [script, join(dir, "command.json")], dir)).toBe(0);
  // Git as the CLI runs it (its hooks are off there): a shell alias prints the environment it gets.
  expect(git(dir, ["init", "-q"]).ok).toBe(true);
  const fromGit = git(dir, ["-c", "alias.envdump=!env", "envdump"]);
  expect(fromGit.ok).toBe(true);
  const seen = [readFileSync(join(dir, "command.json"), "utf8"), fromGit.out];
  for (const text of seen) for (const name of NAMES) expect(text).not.toContain(name);
  expect(seen[1]).toContain("PATH=");
  // The engine still has them.
  expect(studioToken()).toBe("studio-token");
});
