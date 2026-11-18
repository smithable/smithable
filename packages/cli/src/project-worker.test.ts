import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, expect, test } from "vitest";
import { loadPlugins, NO_PLUGINS_HERE } from "./plugins.js";
import { shaped, stepsFor, stopWorkers } from "./project-worker.js";
import { holdSecretsFromJson, releaseSecretsForTests } from "./secrets.js";
import { teach } from "./teach.js";

const TOKEN = "studio-token-7f3a";
const KEY = "model-key-91bc";
const dirs: string[] = [];
afterEach(() => {
  stopWorkers();
  releaseSecretsForTests();
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

function project(): string {
  const dir = mkdtempSync(join(tmpdir(), "project-worker-"));
  dirs.push(dir);
  writeFileSync(join(dir, "package.json"), '{"name":"app","type":"module"}');
  return dir;
}

function ptraceScope(): number {
  try {
    return Number(readFileSync("/proc/sys/kernel/yama/ptrace_scope", "utf8"));
  } catch {
    return 0;
  }
}

function write(dir: string, path: string, text: string): void {
  mkdirSync(join(dir, path, ".."), { recursive: true });
  writeFileSync(join(dir, path), text);
}

/**
 * What tampered project code tries when it is loaded: the secrets in its own environment, in its
 * parent's (Studio's) /proc environ and memory, written to `file` for the test to read.
 */
const probe = (file: string) => `
import { openSync, readFileSync, readSync, writeFileSync } from "node:fs";
const tried = { env: JSON.stringify(process.env), pid: process.pid, parent: process.ppid };
try { tried.environ = readFileSync("/proc/" + process.ppid + "/environ", "latin1"); } catch (e) { tried.environ = "refused: " + e.code; }
try {
  const maps = readFileSync("/proc/" + process.ppid + "/maps", "latin1").split("\\n");
  const heap = maps.find((l) => l.includes("rw-p")) ?? "";
  const start = Number.parseInt(heap.split("-")[0], 16);
  const fd = openSync("/proc/" + process.ppid + "/mem", "r");
  const buffer = Buffer.alloc(4096);
  readSync(fd, buffer, 0, 4096, start);
  tried.mem = "read";
} catch (e) { tried.mem = "refused: " + e.code; }
writeFileSync(${JSON.stringify(file)}, JSON.stringify(tried));
`;

/** A project whose route generator and drizzle-kit are tampered with, and whose schema.ts is too. */
function tampered(dir: string): void {
  const generator = "node_modules/@tanstack/router-generator";
  write(dir, "node_modules/@tanstack/router-cli/package.json", '{"name":"@tanstack/router-cli"}');
  write(
    dir,
    `${generator}/package.json`,
    '{"name":"@tanstack/router-generator","type":"module","exports":{".":{"import":"./index.js"},"./package.json":"./package.json"}}',
  );
  write(
    dir,
    `${generator}/index.js`,
    `${probe(join(dir, "router.json"))}
export const getConfig = () => ({});
export class Generator { async run() {} }`,
  );
  write(dir, "node_modules/drizzle-kit/package.json", '{"name":"drizzle-kit"}');
  write(
    dir,
    "node_modules/drizzle-kit/api.js",
    `module.exports = {
  generateSQLiteDrizzleJson: async (_, prevId) => ({ version: "6", dialect: "sqlite", id: "b", prevId, tables: {}, views: {}, enums: {}, _meta: { tables: {}, columns: {} }, internal: {} }),
  generateSQLiteMigration: async () => [],
};`,
  );
  write(dir, "src/db/schema.ts", probe(join(dir, "schema.json")));
  write(
    dir,
    "drizzle/meta/_journal.json",
    '{"entries":[{"idx":0,"version":"6","when":1,"tag":"0000_first","breakpoints":true}]}',
  );
  write(dir, "drizzle/meta/0000_snapshot.json", '{"id":"a"}');
}

test("the worker's answers are shape-checked: an id, a yes, no or nothing, a short text, nothing else", () => {
  expect(shaped('{"id":1,"value":true,"err":""}')).toEqual({ id: 1, value: true, err: "" });
  expect(shaped('{"id":2,"value":null,"err":"no"}')).toEqual({
    id: 2,
    value: undefined,
    err: "no",
  });
  for (const line of [
    "not json",
    "[]",
    '{"id":"1","value":true,"err":""}',
    '{"id":1,"value":"yes","err":""}',
    '{"id":1,"value":true}',
    '{"id":1,"value":true,"err":"","files":{}}',
    JSON.stringify({ id: 1, value: true, err: "x".repeat(5000) }),
  ])
    expect(shaped(line)).toBeUndefined();
});

test("holding a secret, no plugin is loaded and teach writes nothing", async () => {
  const dir = project();
  write(dir, "smithable.context.yml", "plugins: [newsletter]\n");
  write(dir, "smithable/plugins/newsletter/plugin.mjs", "throw new Error('loaded');\n");
  write(dir, "smithable.yml", "newsletter:\n  weekly: true\n");
  holdSecretsFromJson(JSON.stringify({ studioToken: TOKEN }));
  expect(() => loadPlugins(dir)).toThrow(NO_PLUGINS_HERE);
  const said: string[] = [];
  const io = { out: () => {}, err: (text: string) => void said.push(text) };
  expect(await teach(dir, io, "letters")).toBe(1);
  expect(said.join("")).toContain(NO_PLUGINS_HERE);
  expect(readdirSync(join(dir, "smithable", "plugins"))).toEqual(["newsletter"]);
  // Without a secret (local), as before: the plugin is loaded (here it throws on load).
  releaseSecretsForTests();
  expect(() => loadPlugins(dir)).toThrow("loaded");
});

test("holding a secret, the app's tools run in the worker, which sees neither secret", async () => {
  const dir = project();
  tampered(dir);
  holdSecretsFromJson(JSON.stringify({ studioToken: TOKEN, modelKey: KEY }));
  const said: string[] = [];
  const steps = stepsFor(dir, { err: (text) => void said.push(text) });
  expect(await steps.routeTree()).toBe(true);
  expect(await steps.createMigration({ name: "x", renames: [], apply: false })).toBe(true);
  expect(said).toEqual([]);
  for (const file of ["router.json", "schema.json"]) {
    const tried = JSON.parse(readFileSync(join(dir, file), "utf8")) as Record<string, string>;
    // Loaded in a child of this process, not in it.
    expect(tried.parent).toBe(process.pid);
    expect(tried.pid).not.toBe(process.pid);
    for (const value of [TOKEN, KEY]) {
      expect(tried.env).not.toContain(value);
      expect(tried.environ).not.toContain(value);
    }
    expect(tried.env).not.toContain("SMITHABLE_STUDIO_TOKEN");
    // A child may not read its parent's memory where Yama's ptrace_scope is 1 or more (this
    // machine, GitHub's runners); with 0 that is the host's setting, not this code's to test.
    // A pass here is the host refusing, not this code: hosted workspaces are checked under
    // their own runtime (Studio non-dumpable, and the host check of environ, maps and mem).
    if (ptraceScope() >= 1)
      expect(
        tried.mem,
        `refused by this host's Yama ptrace_scope ${ptraceScope()}, not by Smithable`,
      ).toMatch(/^refused/);
  }
});

test("a worker answering out of shape is started again once, then the tools run as processes", async () => {
  const dir = project();
  tampered(dir);
  // The generator writes on the worker's own pipe: a line that is not an answer.
  write(
    dir,
    "node_modules/@tanstack/router-generator/index.js",
    `import { appendFileSync, writeSync } from "node:fs";
export const getConfig = () => ({});
export class Generator { async run() { appendFileSync(${JSON.stringify(join(dir, "runs"))}, "x"); writeSync(3, '{"id":1,"value":true,"err":"","more":1}\\n'); await new Promise(() => {}); } }`,
  );
  holdSecretsFromJson(JSON.stringify({ studioToken: TOKEN }));
  const said: string[] = [];
  const steps = stepsFor(dir, { err: (text) => void said.push(text) });
  expect(await steps.routeTree()).toBe(false);
  expect(await steps.routeTree()).toBe(false);
  // Started twice for the first question, and not again for the second.
  expect(readFileSync(join(dir, "runs"), "utf8")).toBe("xx");
  expect(said).toEqual([
    "The project worker stopped; the app's tools run as processes of their own.\n",
  ]);
});

test("after a good answer, two failures in a row still give the worker up", async () => {
  const dir = project();
  tampered(dir);
  const runs = join(dir, "runs");
  // The first run answers; every later one writes a line that is not an answer and hangs.
  write(
    dir,
    "node_modules/@tanstack/router-generator/index.js",
    `import { appendFileSync, existsSync, readFileSync, writeSync } from "node:fs";
export const getConfig = () => ({});
export class Generator { async run() {
  const before = existsSync(${JSON.stringify(runs)}) ? readFileSync(${JSON.stringify(runs)}, "utf8") : "";
  appendFileSync(${JSON.stringify(runs)}, "x");
  if (before === "") return;
  writeSync(3, '{"id":0,"value":true,"err":"","more":1}\\n');
  await new Promise(() => {});
} }`,
  );
  holdSecretsFromJson(JSON.stringify({ studioToken: TOKEN }));
  const steps = stepsFor(dir, { err: () => {} });
  expect(await steps.routeTree()).toBe(true);
  expect(await steps.routeTree()).toBe(false);
  expect(await steps.routeTree()).toBe(false);
  // The first worker answered once and failed once, its replacement failed: no third start.
  expect(readFileSync(runs, "utf8")).toBe("xxx");
});

/**
 * Code the project can write is loaded only in the worker's process: the CLI's sources call
 * createRequire and import() with a computed path only where that is allowed, and the steps that
 * load the app's tools are called only through the worker or by a process holding no secret.
 */
test("the CLI loads project code only through the worker or the guarded plugin loader", () => {
  const src = new URL(".", import.meta.url).pathname;
  const found: string[] = [];
  for (const name of readdirSync(src).sort()) {
    if (!name.endsWith(".ts") || name.endsWith(".test.ts") || name.endsWith(".gen.ts")) continue;
    const text = readFileSync(join(src, name), "utf8");
    if (/\bcreateRequire\(/.test(text)) found.push(`${name}: createRequire`);
    if (/\bimport\((?!["'`]\.{0,2}\/?[\w@./-]+["'`]\))/.test(text)) found.push(`${name}: import()`);
    const steps = /import \{([^}]*)\} from "\.\/tool-steps\.js"/.exec(text)?.[1];
    if (steps) found.push(`${name}: ${steps.trim()}`);
    if (/import \* as \w+ from "\.\/tool-steps\.js"/.test(text)) found.push(`${name}: *`);
  }
  expect(found).toEqual([
    "generate.ts: valueSql",
    "plugins.ts: createRequire",
    "project-worker-main.ts: *",
    "project-worker.ts: *",
    "static.ts: import()",
    "tool-steps.ts: createRequire",
    "tool-steps.ts: import()",
  ]);
});
