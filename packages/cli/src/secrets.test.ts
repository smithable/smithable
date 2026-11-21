import { mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, expect, test } from "vitest";
import { git } from "./git.js";
import { execQuiet } from "./io.js";
import {
  capabilityFault,
  childOptions,
  forgetProjectUserForTests,
  holdSecrets,
  holdSecretsFromJson,
  modelKey,
  releaseSecretsForTests,
  scratchDir,
  studioToken,
} from "./secrets.js";

const NAMES = ["SMITHABLE_STUDIO_TOKEN", "SMITHABLE_MODEL_KEY"];
const dirs: string[] = [];
afterEach(() => {
  releaseSecretsForTests();
  delete process.env.SMITHABLE_PROJECT_UID;
  delete process.env.SMITHABLE_PROJECT_GID;
  forgetProjectUserForTests();
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
  const child = childOptions(
    { ...env, SMITHABLE_MODEL_KEY: "model-key" },
    {
      SMITHABLE_STUDIO_TOKEN: "studio-token",
      NO_COLOR: "1",
    },
  );
  // No project user given: the environment alone, and no uid or gid.
  expect(child).toEqual({ env: { HOME: "/home/someone", NO_COLOR: "1" } });
});

test("children may run under a configured uid, with that user's home and name, and are not told it", () => {
  // The user named in /etc/passwd by that uid, wherever the test runs (root is 0 on every Linux).
  process.env.SMITHABLE_PROJECT_UID = "0";
  process.env.SMITHABLE_PROJECT_GID = "0";
  const child = childOptions({ HOME: "/home/studio", USER: "studio", PATH: "/bin" });
  expect(child.uid).toBe(0);
  expect(child.gid).toBe(0);
  expect(child.env.PATH).toBe("/bin");
  expect(child.env.SMITHABLE_PROJECT_UID).toBeUndefined();
  expect(child.env.SMITHABLE_PROJECT_GID).toBeUndefined();
  if (process.platform === "linux") {
    expect(child.env.USER).toBe("root");
    expect(child.env.HOME).toBe("/root");
  }
});

test("a scratch folder is the project group's to enter where a project uid is configured", () => {
  const plain = scratchDir("smithable-scratch-test-");
  expect(statSync(plain).mode & 0o7777).toBe(0o700);
  rmSync(plain, { recursive: true });
  if (process.platform !== "linux") return;
  // This process's own ids, so the change of group is one it may make.
  process.env.SMITHABLE_PROJECT_UID = String(process.getuid?.());
  process.env.SMITHABLE_PROJECT_GID = String(process.getgid?.());
  forgetProjectUserForTests();
  const shared = scratchDir("smithable-scratch-test-");
  const stat = statSync(shared);
  expect(stat.mode & 0o7777).toBe(0o2770);
  expect(stat.gid).toBe(process.getgid?.());
  rmSync(shared, { recursive: true });
});

test("a project uid given alone, or not a number, refuses rather than running children as this user", () => {
  process.env.SMITHABLE_PROJECT_UID = "1000";
  expect(() => childOptions()).toThrow("go together");
  forgetProjectUserForTests();
  process.env.SMITHABLE_PROJECT_GID = "node";
  expect(() => childOptions()).toThrow("must be a number");
});

test("a process given a project uid holds exactly KILL, SETGID and SETUID and passes none on", () => {
  const status = (eff: string, prm: string, inh: string, amb: string) =>
    `Name:\tnode\nCapInh:\t${inh}\nCapPrm:\t${prm}\nCapEff:\t${eff}\nCapBnd:\t00000000000000e0\nCapAmb:\t${amb}\n`;
  const exact = "00000000000000e0";
  const none = "0000000000000000";
  expect(capabilityFault(status(exact, exact, none, none))).toBeUndefined();
  // Ambient left set (started without the preload): every child would keep SETUID after its exec.
  expect(capabilityFault(status(exact, exact, none, exact))).toBe("CapAmb is 0xe0, not 0x0");
  expect(capabilityFault(status(exact, exact, exact, none))).toBe("CapInh is 0xe0, not 0x0");
  // One more than needed (DAC_OVERRIDE), or one fewer (KILL): refused too.
  expect(capabilityFault(status("00000000000000e2", exact, none, none))).toBe(
    "CapEff is 0xe2, not 0xe0",
  );
  expect(capabilityFault(status(exact, "00000000000000c0", none, none))).toBe(
    "CapPrm is 0xc0, not 0xe0",
  );
  expect(capabilityFault("Name:\tnode\n")).toBe("CapEff is missing, not 0xe0");
});

/**
 * Every child the CLI starts gets its options from childOptions: each call of a node:child_process
 * function in the CLI's sources spreads them into its options, so its environment leaves the
 * secrets out and, where a project uid is configured, it runs as that user. A new call that does
 * not fails here, and so does a file that takes node:child_process other than by named imports.
 */
test("every child process the CLI starts is given childOptions", () => {
  const src = new URL(".", import.meta.url).pathname;
  const missing: string[] = [];
  for (const name of readdirSync(src)) {
    if (!name.endsWith(".ts") || name.endsWith(".test.ts") || name.endsWith(".gen.ts")) continue;
    const text = readFileSync(join(src, name), "utf8");
    const from = /import \{([^}]*)\} from "node:child_process"/.exec(text);
    if (!from) {
      if (/["'](node:)?child_process["']/.test(text))
        missing.push(`${name}: child_process not by named imports`);
      continue;
    }
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
        if (!/\.\.\.childOptions\(/.test(body)) {
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

test("on standard input the two come as JSON, and nothing else is taken", () => {
  holdSecretsFromJson(JSON.stringify({ studioToken: "from-stdin", modelKey: "key-on-stdin" }));
  expect(studioToken()).toBe("from-stdin");
  expect(modelKey()).toBe("key-on-stdin");
  expect(() => holdSecretsFromJson("[]")).toThrow(/JSON object/);
  expect(() => holdSecretsFromJson(JSON.stringify({ PATH: "/bin" }))).toThrow(
    /does not take "PATH"/,
  );
  expect(() => holdSecretsFromJson(JSON.stringify({ modelKey: 4 }))).toThrow(/must be a string/);
});
