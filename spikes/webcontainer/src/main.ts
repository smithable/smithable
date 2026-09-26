import { generateApp } from "@smithable/adapter-tanstack";
import { applyOperation, validateAuth, validateContent, validateSpec } from "@smithable/core";
import { type FileSystemTree, WebContainer } from "@webcontainer/api";

const log = (line: string) => {
  (document.getElementById("log") as HTMLElement).textContent += `${line}\n`;
  console.log(line);
};
const state = window as unknown as {
  done: boolean;
  previewUrl?: string;
  applyOperation?: (name: string, args: Record<string, unknown>) => Promise<string>;
};
const t0 = performance.now();
const at = () => `${((performance.now() - t0) / 1000).toFixed(1)} s`;

/** The preview uses SQLite compiled to WebAssembly: native modules cannot run here. */
const PREVIEW_DB = `import initSqlJs from "sql.js";
import { drizzle } from "drizzle-orm/sql-js";
import { migrate } from "drizzle-orm/sql-js/migrator";
import * as schema from "./schema";

const SQL = await initSqlJs();
export const db = drizzle(new SQL.Database(), { schema, casing: "snake_case" });

migrate(db, { migrationsFolder: "drizzle" });
`;

function tree(files: Record<string, string>): FileSystemTree {
  const root: FileSystemTree = {};
  for (const [path, contents] of Object.entries(files)) {
    const parts = path.split("/");
    let node = root;
    for (const part of parts.slice(0, -1)) {
      node[part] ??= { directory: {} };
      node = (node[part] as { directory: FileSystemTree }).directory;
    }
    node[parts.at(-1) as string] = { file: { contents } };
  }
  return root;
}

async function run() {
  const files: Record<string, string> = await (await fetch("/app.json")).json();
  const pkg = JSON.parse(files["package.json"] as string);
  delete pkg.dependencies["better-sqlite3"];
  delete pkg.devDependencies["@types/better-sqlite3"];
  pkg.dependencies["sql.js"] = "1.14.2";
  delete pkg.packageManager;
  files["package.json"] = JSON.stringify(pkg, null, 2);
  files["src/db/index.ts"] = PREVIEW_DB;
  delete files["pnpm-workspace.yaml"];

  const container = await WebContainer.boot();
  log(`booted ${at()}`);
  await container.mount(tree(files));
  // WebContainers lose AsyncLocalStorage's store across await (stackblitz/webcontainer-core#1169).
  // For a single-user preview, falling back to the store of the last run() is enough.
  await container.fs.writeFile(
    "als-preview.mjs",
    `import { AsyncLocalStorage } from "node:async_hooks";
const run = AsyncLocalStorage.prototype.run;
const getStore = AsyncLocalStorage.prototype.getStore;
AsyncLocalStorage.prototype.run = function (store, fn, ...args) {
  this.lastStore = store;
  return run.call(this, store, fn, ...args);
};
AsyncLocalStorage.prototype.getStore = function () {
  return getStore.call(this) ?? this.lastStore;
};
`,
  );
  const install = await container.spawn("npm", [
    "install",
    "--no-audit",
    "--no-fund",
    "--color=false",
  ]);
  let output = "";
  install.output.pipeTo(
    new WritableStream({
      write: (c) => {
        output += c;
      },
    }),
  );
  const code = await install.exit;
  log(`npm install exit ${code} at ${at()}`);
  log(
    output
      .split("\n")
      .filter((l) => l.trim())
      .slice(-25)
      .join("\n"),
  );
  if (code !== 0) throw new Error("install failed");

  /**
   * The engine in the browser: applies an operation to the spec, regenerates the app, and
   * writes the files that changed into the container; the dev server updates the preview.
   */
  state.applyOperation = async (name, args) => {
    const t = performance.now();
    const result = applyOperation(
      {
        spec: files["smithable.yml"] as string,
        auth: files["smithable.auth.yml"] as string,
        ...(files["smithable.content.yml"] ? { content: files["smithable.content.yml"] } : {}),
      },
      name,
      args,
    );
    if (!result.ok) throw new Error(result.message);
    files["smithable.yml"] = result.files.spec;
    const ir = validateSpec({ path: "smithable.yml", text: result.files.spec }).ir;
    const auth = validateAuth({
      path: "smithable.auth.yml",
      text: files["smithable.auth.yml"] as string,
    }).auth;
    if (!ir || !auth) throw new Error("invalid spec");
    const content = files["smithable.content.yml"]
      ? validateContent({ path: "smithable.content.yml", text: files["smithable.content.yml"] }, ir)
          .content
      : undefined;
    const generated = generateApp(ir, {
      smithableVersion: "preview",
      auth,
      ...(content ? { content } : {}),
    });
    const engine = performance.now() - t;
    // The preview's own versions of these stay: native SQLite cannot run here.
    const keep = new Set(["package.json", "src/db/index.ts", "pnpm-workspace.yaml"]);
    let written = 0;
    for (const file of generated) {
      if (keep.has(file.path) || file.zone === "custom" || files[file.path] === file.content)
        continue;
      files[file.path] = file.content;
      await container.fs.writeFile(file.path, file.content);
      written++;
    }
    await container.fs.writeFile("smithable.yml", result.files.spec);
    const wrote = performance.now() - t;
    // The migration is only needed to save the new field; the form updates without it.
    const started = performance.now();
    container.spawn("npx", ["drizzle-kit", "generate"]).then(async (migrate) => {
      const code = await migrate.exit;
      log(`drizzle-kit exit ${code} after ${(performance.now() - started).toFixed(0)} ms`);
    });
    return `engine ${engine.toFixed(0)} ms, wrote ${written} files by ${wrote.toFixed(0)} ms`;
  };

  container.on("server-ready", (port, url) => {
    log(`server ready on ${port} at ${at()}: ${url}`);
    state.previewUrl = url;
    (document.getElementById("preview") as HTMLIFrameElement).src = `${url}/customers`;
    state.done = true;
  });
  container.on("error", (e) => log(`container error ${e.message}`));
  const dev = await container.spawn("npx", ["vite", "dev", "--port", "3000"], {
    env: {
      BETTER_AUTH_SECRET: "preview-secret-0123456789abcdef0123456789",
      NODE_OPTIONS: `--import ${container.workdir}/als-preview.mjs`,
    },
  });
  dev.output.pipeTo(new WritableStream({ write: (c) => log(`dev: ${c.trim()}`) }));
  dev.exit.then((c) => {
    log(`dev exited ${c}`);
    state.done = true;
  });
}

run().catch((error) => {
  log(`ERROR ${error instanceof Error ? error.message : String(error)}`);
  state.done = true;
});
