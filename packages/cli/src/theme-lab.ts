// `smithable theme lab` (docs/design/theme-lab.md §3, local mode): the theme lab beside a real
// app. Makes the sheet app once (the booking starter with the controls it lacks, as the theme
// sheet makes it), serves its preview with the editor's runtime and the lab on the next port,
// and opens the lab. The lab computes a theme's CSS in the browser and posts it to its frames
// (preview-editor.ts), so nothing is regenerated while a theme is made. Save writes the theme
// through addTheme into the project (--project, or the current folder when it is one), or as
// themes/<name>.yml into a current folder that is no project, never over a file there.
import { type ChildProcess, spawn } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createServer, type IncomingMessage } from "node:http";
import { tmpdir } from "node:os";
import { basename, extname, join, normalize, resolve } from "node:path";
import { formatDiagnostic, parseTheme } from "@smithable/core";
import { openBrowser } from "./dev.js";
import { type Io, tool } from "./io.js";
import { create } from "./new.js";
import { runOperation } from "./op.js";
import { previewConfig } from "./preview-editor.js";
import { loadSpec, projectThemeFiles } from "./validate.js";

const PACKAGED = new URL("../theme-lab/", import.meta.url).pathname;
const LAB = existsSync(join(PACKAGED, "index.html"))
  ? PACKAGED
  : new URL("../../../apps/theme-lab/dist/", import.meta.url).pathname;

const TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript",
  ".css": "text/css",
  ".svg": "image/svg+xml",
  ".woff2": "font/woff2",
};

/** Quiet output for the steps the lab takes on its own. */
const quiet = (io: Io): Io => ({ ...io, out: () => {} });

/** The sheet app: the booking starter, and a field for each control it has none for. */
async function sheetApp(io: Io): Promise<string | undefined> {
  const dir = join(mkdtempSync(join(tmpdir(), "smithable-theme-lab-")), "app");
  io.out("Making the lab's app (a booking app with every control)…\n");
  if ((await create(dir, quiet(io), "booking", { yes: true })) !== 0) return undefined;
  for (const [field, kind] of [
    ["price", "money"],
    ["dropIn", "bool"],
    ["website", "url"],
    ["contact", "email"],
  ])
    if (
      (await runOperation(
        dir,
        quiet(io),
        "addField",
        { model: "ClassType", field: field as string, type: kind as string },
        { yes: true },
      )) !== 0
    )
      return undefined;
  return dir;
}

/** The pages the lab frames: the landing page, then a list, its form and a record. */
export function labFrames(
  pages: { route: string; pattern: { kind: string } }[],
): { label: string; path: string }[] {
  const landing = pages.find((p) => p.pattern.kind === "landing");
  const list = pages.find((p) => p.pattern.kind === "crud");
  return [
    { label: "Landing", path: landing?.route ?? "/" },
    ...(list
      ? [
          { label: "List", path: list.route },
          { label: "Form", path: `${list.route}/new` },
          { label: "Record", path: `${list.route}/1` },
        ]
      : []),
  ];
}

const body = (req: IncomingMessage) =>
  new Promise<string>((done) => {
    let text = "";
    req.on("data", (d) => (text += d));
    req.on("end", () => done(text));
  });

export async function themeLab(
  io: Io,
  port: number,
  options: { project?: string; app?: string } = {},
): Promise<number> {
  if (!existsSync(join(LAB, "index.html"))) {
    io.err("The theme lab is not built: run `pnpm build` in the Smithable repository.\n");
    return 1;
  }
  // The project a theme is saved into: the one named, or the current folder when it is one.
  const project = options.project
    ? resolve(options.project)
    : existsSync(join(process.cwd(), "smithable.yml"))
      ? process.cwd()
      : undefined;
  if (project && !loadSpec(project, io).ir) return 1;
  // The app shown: one given (tests reuse theirs), or the sheet app made now.
  const app = options.app ? resolve(options.app) : await sheetApp(io);
  if (!app) return 1;
  const { ir } = loadSpec(app, io);
  if (!ir) return 1;
  const previewPort = port + 1;
  const preview = `http://localhost:${previewPort}`;
  const config = join("data", ".smithable", "preview.vite.config.mjs");
  mkdirSync(join(app, "data", ".smithable"), { recursive: true });
  writeFileSync(join(app, config), previewConfig());
  const child: ChildProcess = spawn(
    ...tool(app, "vite", [
      "dev",
      "--config",
      config,
      "--port",
      String(previewPort),
      "--strictPort",
    ]),
    { cwd: app, env: { ...process.env, BETTER_AUTH_URL: preview, NO_COLOR: "1" } },
  );
  child.stderr?.on("data", (d) => io.err(String(d)));
  // The sheet app made for this run goes with it.
  const stop = () => {
    child.kill();
    if (!options.app) rmSync(join(app, ".."), { recursive: true, force: true });
  };
  process.on("exit", stop);
  // The lab opens once the app answers (its first page compiles on the first request).
  for (let waited = 0; ; waited += 500) {
    const status = await fetch(`${preview}/sign-in`).then(
      (r) => r.status,
      () => 0,
    );
    if (status > 0 && status < 500) break;
    if (waited > 120000 || child.exitCode !== null) {
      io.err(`The lab's app did not start at ${preview}.\n`);
      stop();
      return 1;
    }
    await new Promise((done) => setTimeout(done, 500));
  }

  /** Where a save goes, and the project's own themes as starting points. */
  const target = project ?? process.cwd();
  const ownThemes = () =>
    projectThemeFiles(target).map((path) => ({
      name: basename(path).replace(/\.ya?ml$/, ""),
      text: readFileSync(path, "utf8"),
    }));

  const server = createServer(async (req, res) => {
    const url = new URL(req.url ?? "/", "http://localhost");
    const json = (status: number, data: unknown) => {
      res.writeHead(status, { "content-type": "application/json" });
      res.end(JSON.stringify(data));
    };
    if (url.pathname === "/api/start")
      return json(200, {
        preview,
        frames: labFrames(ir.pages),
        themes: ownThemes(),
        project: Boolean(project),
        target,
      });
    if (url.pathname === "/api/save" && req.method === "POST") {
      // Only the lab's own page saves (the request's origin is the lab).
      if (req.headers.origin !== `http://${req.headers.host}`)
        return json(403, { error: "Not from the lab." });
      const { name, text } = JSON.parse(await body(req)) as { name: string; text: string };
      if (!/^[a-z][a-z0-9-]*$/.test(name ?? ""))
        return json(400, { error: "A theme's name is kebab-case." });
      const { theme, diagnostics } = parseTheme({ path: `themes/${name}.yml`, text });
      if (!theme) return json(400, { error: diagnostics.map(formatDiagnostic).join("\n") });
      if (project) {
        const said: string[] = [];
        const code = await runOperation(
          project,
          { ...io, out: (t) => said.push(t), err: (t) => said.push(t) },
          "addTheme",
          { name, text },
          { yes: true },
        );
        return json(
          code === 0 ? 200 : 400,
          code === 0 ? { saved: `themes/${name}.yml` } : { error: said.join("") },
        );
      }
      if (existsSync(join(target, "themes", `${name}.yml`)))
        return json(409, {
          error: `There is already themes/${name}.yml here: give it another name.`,
        });
      mkdirSync(join(target, "themes"), { recursive: true });
      writeFileSync(join(target, "themes", `${name}.yml`), text);
      return json(200, { saved: join(target, "themes", `${name}.yml`) });
    }
    // The lab's own files; any other path is its page.
    const file = normalize(join(LAB, url.pathname));
    const path =
      file.startsWith(LAB) && existsSync(file) && extname(file) ? file : join(LAB, "index.html");
    res.writeHead(200, { "content-type": TYPES[extname(path)] ?? "application/octet-stream" });
    res.end(readFileSync(path));
  });
  await new Promise<void>((done) => server.listen(port, "127.0.0.1", done));
  const lab = `http://localhost:${port}`;
  io.out(
    `The theme lab is at ${lab} (the app at ${preview}). A theme saved goes to ${project ? `the project ${project}, through addTheme` : `${join(target, "themes")}`}. Ctrl+C stops it.\n`,
  );
  if (!process.env.SMITHABLE_NO_OPEN) openBrowser(lab);
  return new Promise<number>((done) => {
    for (const signal of ["SIGINT", "SIGTERM"] as const)
      process.once(signal, () => {
        stop();
        server.close();
        done(0);
      });
  });
}
