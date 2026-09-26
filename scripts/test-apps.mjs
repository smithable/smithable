// End-to-end test: every example becomes a real app that installs, type-checks, builds,
// serves its pages with sample data, and regenerates without changes.
// Run after `pnpm build`: `pnpm test:apps [example…]`.
import { spawn, spawnSync } from "node:child_process";
import { mkdtempSync, readdirSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const repo = new URL("..", import.meta.url).pathname;
const cli = join(repo, "packages/cli/dist/bin.js");
const examples = process.argv.slice(2).length
  ? process.argv.slice(2)
  : readdirSync(join(repo, "examples"), { withFileTypes: true })
      .filter((e) => e.isDirectory())
      .map((e) => e.name);

const failures = [];

function step(name, fn) {
  try {
    fn();
    console.log(`  ✓ ${name}`);
  } catch (error) {
    console.log(`  ✗ ${name}\n    ${String(error.message).split("\n").join("\n    ")}`);
    failures.push(name);
    throw error;
  }
}

function run(command, args, cwd) {
  const result = spawnSync(command, args, { cwd, encoding: "utf8" });
  if (result.status !== 0)
    throw new Error(`${command} ${args.join(" ")} failed:\n${result.stdout}\n${result.stderr}`);
  return result.stdout;
}

async function waitFor(url) {
  for (let i = 0; i < 60; i++) {
    try {
      if ((await fetch(url)).ok) return;
    } catch {}
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error(`${url} did not respond`);
}

for (const [index, example] of examples.entries()) {
  console.log(`\n${example}`);
  const dir = join(mkdtempSync(join(tmpdir(), `smithable-${example}-`)), "app");
  const port = 4400 + index;
  try {
    step("smithable new", () => run("node", [cli, "new", dir, "--starter", example], repo));
    step("no dependency on Smithable", () => {
      if (/smithable/i.test(readFileSync(join(dir, "package.json"), "utf8")))
        throw new Error("package.json mentions Smithable");
    });
    step("type-checks", () => run("pnpm", ["typecheck"], dir));
    step("builds", () => run("pnpm", ["build"], dir));

    const server = spawn("pnpm", ["start"], {
      cwd: dir,
      env: { ...process.env, PORT: String(port) },
      detached: true,
    });
    try {
      await waitFor(`http://localhost:${port}/health`);
      const spec = readFileSync(join(dir, "smithable.yml"), "utf8");
      const routes = [...spec.matchAll(/^ {2}([a-z][\w-]*):\n {4}(?:route: (\S+)\n {4})?/gm)];
      for (const route of routes.length ? routes : []) {
        const path = route[2] ?? `/${route[1]}`;
        const response = await fetch(`http://localhost:${port}${path}`);
        const html = await response.text();
        const ok = response.status === 200 && html.includes("<table");
        console.log(`  ${ok ? "✓" : "✗"} ${path} lists sample data`);
        if (!ok) failures.push(`${example} ${path}`);
      }
    } finally {
      process.kill(-server.pid);
    }

    step("regenerating changes nothing", () => {
      const out = run("node", [cli, "generate", dir], repo);
      if (!out.includes("(0 changed, 0 removed)")) throw new Error(out);
    });
  } catch {
    // Already reported; continue with the next example.
  }
}

if (failures.length) {
  console.log(`\n${failures.length} failed.`);
  process.exit(1);
}
console.log(`\nAll ${examples.length} example apps passed.`);
