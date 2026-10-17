// Every value written once (docs/design/words-once.md): the words a generated app writes as
// literals in two or more of its files. Makes a starter with the built CLI in a temporary
// folder, reads its generated files, and lists the values found in several files, the most
// spread first; --json gives them as [{ value, files }]. --fail reads the starter's spec files
// with core and exits 1 when a page's title, the app's name, a role's label or a choice's label
// is written in two or more files (the adapter's rule, §2). Not part of `check`.
//   node scripts/measure-duplicates.mjs [starter] [--fail] [--json]

import { spawnSync } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";

import {
  capitalize,
  humanize,
  validateAuth,
  validateContent,
  validateSpec,
} from "../packages/core/dist/index.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");

const options = {
  fail: { type: "boolean" },
  json: { type: "boolean" },
};

const { values, positionals } = parseArgs({
  args: process.argv.slice(2),
  options,
  strict: false,
});
const starter = positionals[0] || "crm";
const fail = values.fail;
const isJson = values.json;

async function findFiles(dir, exts) {
  const result = [];
  async function walk(currentDir) {
    let entries;
    try {
      entries = await fs.readdir(currentDir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const fullPath = path.join(currentDir, entry.name);
      if (entry.isDirectory()) {
        await walk(fullPath);
      } else {
        if (exts.some((ext) => fullPath.endsWith(ext))) {
          result.push(fullPath);
        }
      }
    }
  }
  await walk(dir);
  return result;
}

function shouldKeep(val) {
  if (val.length < 3 || val.length > 80) return false;
  if (/^[a-z_$][a-zA-Z0-9_$.-]*$/.test(val)) return false;
  if (/^[0-9_$.-]+$/.test(val)) return false;
  if (/^[/.#@]/.test(val) || val.includes("://")) return false;
  if (/^(GET|POST|PUT|DELETE|PATCH|OPTIONS|HEAD)$/.test(val)) return false;
  if (!val.includes(" ") && !/[A-Z]/.test(val)) return false;

  const tailwindPrefixes = [
    "flex",
    "grid",
    "text-",
    "bg-",
    "px-",
    "py-",
    "p-",
    "mx-",
    "my-",
    "m-",
    "rounded",
    "border",
    "h-",
    "w-",
    "gap-",
    "space-",
    "items-",
    "justify-",
    "min-",
    "max-",
    "font-",
    "shadow",
    "ring",
    "align-",
    "self-",
    "col-",
    "row-",
    "overflow-",
    "hidden",
    "block",
    "inline-",
    "absolute",
    "relative",
    "sticky",
    "fixed",
    "inset-",
    "top-",
    "bottom-",
    "left-",
    "right-",
    "z-",
    "flex-",
    "cursor-",
    "focus:",
    "hover:",
    "sm:",
    "md:",
    "lg:",
    "xl:",
    "transition",
    "duration-",
    "ease-",
    "opacity-",
    "shrink-",
    "grow-",
    "outline-",
    "truncate",
    "sr-only",
    "aspect-",
    "fill-",
    "stroke-",
    "pointer-events-",
    "select-",
    "group",
    "group-",
  ];
  const isTailwindLike = (w) =>
    tailwindPrefixes.some((p) => w === p || w.startsWith(p)) ||
    /^[a-z]+:[a-z]/.test(w) ||
    w.includes("-");

  const words = val.split(/\s+/).filter(Boolean);
  if (words.length > 0 && words.every(isTailwindLike)) return false;

  return true;
}

async function runFailCheck(duplicates) {
  const specPath = path.join(rootDir, "examples", starter, "smithable.yml");
  const contentPath = path.join(rootDir, "examples", starter, "smithable.content.yml");
  const authPath = path.join(rootDir, "examples", starter, "smithable.auth.yml");

  const readYml = async (p) => {
    try {
      return await fs.readFile(p, "utf-8");
    } catch {
      return null;
    }
  };

  const specText = await readYml(specPath);
  if (!specText) {
    console.error(`Could not read spec file for starter ${starter}`);
    return 1;
  }

  const specRes = validateSpec({ path: specPath, text: specText });
  const ir = specRes.ir;
  if (!ir) {
    console.error("Errors validating spec.");
    return 1;
  }

  const contentText = await readYml(contentPath);
  const contentRes = contentText
    ? validateContent({ path: contentPath, text: contentText }, ir)
    : { content: null };
  const content = contentRes.content;

  const authText = await readYml(authPath);
  const authRes = authText ? validateAuth({ path: authPath, text: authText }, ir) : { auth: null };
  const auth = authRes.auth;

  const requiredWords = new Set();

  requiredWords.add(ir.app.name);

  for (const page of ir.pages) {
    const title = content?.pages?.[page.id]?.title ?? humanize(page.id);
    requiredWords.add(title);
  }

  for (const model of ir.models) {
    for (const field of model.fields) {
      if (field.type.kind === "choice") {
        for (const value of field.type.values) {
          const label =
            content?.models?.[model.name]?.fields?.[field.name]?.values?.[value] ?? humanize(value);
          requiredWords.add(label);
        }
      }
    }
  }

  if (auth?.roles) {
    for (const role of auth.roles) {
      requiredWords.add(capitalize(role.name));
    }
  }

  const failedWords = [];
  for (const dup of duplicates) {
    if (requiredWords.has(dup.value)) {
      failedWords.push(dup);
    }
  }

  if (failedWords.length > 0) {
    console.error("The following values should be written once but appear in multiple files:");
    for (const d of failedWords) {
      console.error(`"${d.value}" appears in ${d.files.length} files:`);
      const limitFiles = d.files.slice(0, 4);
      console.error(`  ${limitFiles.join(", ")}${d.files.length > 4 ? ", …" : ""}`);
    }
    return 1;
  }

  console.log("All 'words once' checks passed.");
  return 0;
}

/** The duplicates of the starter, and the exit code; the temporary folder goes either way. */
async function main() {
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "smithable-duplicates-"));
  const appDir = path.join(tmpDir, "app");

  try {
    const cliPath = path.join(rootDir, "packages/cli/dist/bin.js");
    const result = spawnSync(
      process.execPath,
      [cliPath, "new", appDir, "--starter", starter, "--yes"],
      {
        cwd: rootDir,
        encoding: "utf-8",
      },
    );

    if (result.status !== 0) {
      console.error(result.stderr || result.stdout);
      return 1;
    }

    const dirsToScan = ["src/routes", "src/generated", "src/lib", "src/kit", "src/db"];
    const exts = [".ts", ".tsx", ".css"];
    const files = [];

    for (const d of dirsToScan) {
      const fullDir = path.join(appDir, d);
      files.push(...(await findFiles(fullDir, exts)));
    }

    const literals = new Map();

    for (const file of files) {
      const content = await fs.readFile(file, "utf-8");
      const relPath = path.relative(appDir, file).replace(/\\/g, "/");

      const regex = /"([^"\\]*(?:\\.[^"\\]*)*)"/g;
      for (const match of content.matchAll(regex)) {
        const val = match[1].replace(/\\(.)/g, "$1");
        if (shouldKeep(val)) {
          let paths = literals.get(val);
          if (!paths) {
            paths = new Set();
            literals.set(val, paths);
          }
          paths.add(relPath);
        }
      }
    }

    const duplicates = [];
    for (const [val, paths] of literals.entries()) {
      if (paths.size >= 2) {
        duplicates.push({ value: val, files: Array.from(paths).sort() });
      }
    }

    duplicates.sort((a, b) => b.files.length - a.files.length || a.value.localeCompare(b.value));

    if (fail) return runFailCheck(duplicates);
    if (isJson) {
      console.log(JSON.stringify(duplicates, null, 2));
    } else {
      if (duplicates.length === 0) {
        console.log("No duplicates found.");
      } else {
        for (const d of duplicates) {
          const filesStr = d.files.slice(0, 4).join(", ") + (d.files.length > 4 ? ", …" : "");
          console.log(`${String(d.files.length).padStart(3)} files: "${d.value}"`);
          console.log(`           ${filesStr}`);
        }
      }
    }
  } finally {
    await fs.rm(tmpDir, { recursive: true, force: true });
  }
}

main().then(
  (code) => process.exit(code ?? 0),
  (err) => {
    console.error(err);
    process.exit(1);
  },
);
