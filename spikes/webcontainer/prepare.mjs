// Packs a generated CRM (made by the CLI) into public/app.json for the spike page.
// Run from the repo root after `pnpm build`: node spikes/webcontainer/prepare.mjs
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, relative } from "node:path";

const repo = new URL("../..", import.meta.url).pathname;
const dir = join(mkdtempSync(join(tmpdir(), "smithable-spike-")), "crm");
const cli = join(repo, "packages/cli/dist/bin.js");
if (process.argv[2] === "--no-sign-in") {
  // Without sign-in: WebContainers lose AsyncLocalStorage across await, which sign-in needs
  // (docs/research/webcontainers.md). A customers-only CRM with public pages, made like
  // `smithable new` does.
  mkdirSync(dir, { recursive: true });
  writeFileSync(
    join(dir, "smithable.yml"),
    "smithable: 0.1\napp: { name: Acme CRM, currency: EUR }\nmodels:\n  Customer:\n    fields:\n      name: string!\n      email: email unique\n      segment: smb | enterprise | government\npages:\n  customers:\n    crud: Customer\n",
  );
  writeFileSync(
    join(dir, "smithable.auth.yml"),
    "smithableAuth: 0.1\nsignIn: none\npublic:\n  pages: [customers]\n  read: [Customer]\n  create: [Customer]\n",
  );
  const generated = spawnSync("node", [cli, "generate", dir], { encoding: "utf8" });
  if (generated.status !== 0) throw new Error(generated.stdout + generated.stderr);
} else {
  const result = spawnSync("node", [cli, "new", dir], { encoding: "utf8" });
  if (result.status !== 0) throw new Error(result.stdout + result.stderr);
}

const skip = new Set(["node_modules", "data", ".git", "pnpm-lock.yaml", "dist", ".tanstack"]);
const files = {};
const walk = (d) => {
  for (const entry of readdirSync(d, { withFileTypes: true })) {
    if (skip.has(entry.name)) continue;
    const path = join(d, entry.name);
    if (entry.isDirectory()) walk(path);
    else files[relative(dir, path)] = readFileSync(path, "utf8");
  }
};
walk(dir);
const out = new URL("public/", import.meta.url).pathname;
mkdirSync(out, { recursive: true });
writeFileSync(join(out, "app.json"), JSON.stringify(files));
console.log(`${Object.keys(files).length} files from ${dir}`);
