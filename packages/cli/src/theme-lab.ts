// `smithable theme lab` (docs/design/theme-lab.md §3, local mode): the theme lab beside a real
// app. Makes the chosen starter's app (booking by default, with the controls it lacks, as the
// theme sheet makes it), serves its preview with the editor's runtime and the lab on the next
// port, and opens the lab; the lab's starter switch makes another starter's app in its place. The lab computes a theme's CSS in the browser and posts it to its frames
// (preview-editor.ts), so nothing is regenerated while a theme is made. Save writes the theme
// through addTheme into the project (--project, or the current folder when it is one), or as
// themes/<name>.yml into a current folder that is no project, never over a file there.
import { type ChildProcess, spawn } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createServer, type IncomingMessage } from "node:http";
import { tmpdir } from "node:os";
import { basename, extname, join, normalize, resolve } from "node:path";
import { formatDiagnostic, parseTheme, type SpecIR } from "@smithable/core";
import { openBrowser } from "./dev.js";
import { type Io, tool } from "./io.js";
import { create } from "./new.js";
import { runOperation } from "./op.js";
import { previewConfig } from "./preview-editor.js";
import { STARTERS } from "./starters.gen.js";
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

/** The lab's app: a starter's, and for booking a field for each control it has none for. */
async function labApp(io: Io, starter: string): Promise<string | undefined> {
  const dir = join(mkdtempSync(join(tmpdir(), "smithable-theme-lab-")), "app");
  io.out(
    starter === "booking"
      ? "Making the lab's app (a booking app with every control)…\n"
      : `Making the lab's app (the ${starter} starter)…\n`,
  );
  // A step that fails leaves no folder behind.
  const failed = () => {
    rmSync(join(dir, ".."), { recursive: true, force: true });
    return undefined;
  };
  if ((await create(dir, quiet(io), starter, { yes: true })) !== 0) return failed();
  if (starter !== "booking") return dir;
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
      return failed();
  return dir;
}

/**
 * The pages the lab frames: the landing page (or the app's front page), then a list, its form
 * and a record; an app with no list of its own but a data page (the api starter) shows that one.
 */
export function labFrames(
  pages: { route: string; pattern: { kind: string } }[],
): { label: string; path: string }[] {
  const landing = pages.find((p) => p.pattern.kind === "landing");
  const list = pages.find((p) => p.pattern.kind === "crud");
  const data = pages.find((p) => p.pattern.kind === "data");
  return [
    { label: "Landing", path: landing?.route ?? "/" },
    ...(list
      ? [
          { label: "List", path: list.route },
          { label: "Form", path: `${list.route}/new` },
          { label: "Record", path: `${list.route}/1` },
        ]
      : data
        ? [{ label: "List", path: data.route }]
        : []),
  ];
}

/** A request's JSON body; {} when it is not JSON, so a malformed one is refused, not a crash. */
const bodyJson = async (req: IncomingMessage): Promise<Record<string, unknown>> => {
  try {
    const parsed = JSON.parse(await body(req));
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
};

const body = (req: IncomingMessage) =>
  new Promise<string>((done) => {
    let text = "";
    req.on("data", (d) => (text += d));
    req.on("end", () => done(text));
  });

export async function themeLab(
  io: Io,
  port: number,
  options: { project?: string; app?: string; starter?: string } = {},
): Promise<number> {
  const starters = Object.keys(STARTERS);
  if (options.starter && !starters.includes(options.starter)) {
    io.err(`There is no starter "${options.starter}": ${starters.join(", ")}.\n`);
    return 2;
  }
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
  // The app shown: one given (tests reuse theirs), or the chosen starter's made now; the lab's
  // switch replaces it with another starter's on the same port.
  const previewPort = port + 1;
  const preview = `http://localhost:${previewPort}`;
  let shown: { starter?: string; app: string; ir: SpecIR; child: ChildProcess } | undefined;
  // The app is forgotten only once it is gone, so a Ctrl+C meanwhile still removes its folder.
  const stop = async () => {
    const was = shown;
    if (!was) return;
    if (was.child.exitCode === null) {
      // Its port is reused: wait for it to go, and after five seconds make it go.
      const exited = new Promise((done) => was.child.once("exit", done));
      was.child.kill();
      const hard = setTimeout(() => was.child.kill("SIGKILL"), 5000);
      await exited;
      clearTimeout(hard);
    }
    if (!options.app) rmSync(join(was.app, ".."), { recursive: true, force: true });
    if (shown === was) shown = undefined;
  };
  const show = async (starter?: string): Promise<boolean> => {
    const app = options.app ? resolve(options.app) : await labApp(io, starter ?? "booking");
    if (!app) return false;
    const { ir } = loadSpec(app, io);
    if (!ir) {
      if (!options.app) rmSync(join(app, ".."), { recursive: true, force: true });
      return false;
    }
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
    shown = { ...(options.app ? {} : { starter: starter ?? "booking" }), app, ir, child };
    // Ready once the app answers (its first page compiles on the first request).
    for (let waited = 0; ; waited += 500) {
      const status = await fetch(`${preview}/sign-in`).then(
        (r) => r.status,
        () => 0,
      );
      if (status > 0 && status < 500) return true;
      if (waited > 120000 || child.exitCode !== null) {
        io.err(`The lab's app did not start at ${preview}.\n`);
        return false;
      }
      await new Promise((done) => setTimeout(done, 500));
    }
  };
  // The app made for this run goes with it.
  process.on("exit", () => {
    shown?.child.kill();
    if (shown && !options.app) rmSync(join(shown.app, ".."), { recursive: true, force: true });
  });
  if (!(await show(options.starter))) {
    await stop();
    return 1;
  }
  let switching = false;

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
        frames: shown ? labFrames(shown.ir.pages) : [],
        // The starters the switch offers: none when the app was given.
        starters: options.app ? [] : starters,
        starter: shown?.starter,
        themes: ownThemes(),
        project: Boolean(project),
        target,
      });
    if (url.pathname === "/api/starter" && req.method === "POST") {
      if (req.headers.origin !== `http://${req.headers.host}`)
        return json(403, { error: "Not from the lab." });
      const { name } = (await bodyJson(req)) as { name?: string };
      if (options.app || !name || !starters.includes(name))
        return json(400, { error: `No starter "${name}" to show.` });
      if (switching) return json(409, { error: "Another starter is being made." });
      switching = true;
      try {
        await stop();
        if (!(await show(name))) {
          await stop();
          return json(500, { error: `The ${name} app did not start.` });
        }
        return json(200, { starter: name, frames: labFrames(shown?.ir.pages ?? []) });
      } finally {
        switching = false;
      }
    }
    if (url.pathname === "/api/save" && req.method === "POST") {
      // Only the lab's own page saves (the request's origin is the lab).
      if (req.headers.origin !== `http://${req.headers.host}`)
        return json(403, { error: "Not from the lab." });
      const { name, text } = (await bodyJson(req)) as { name?: string; text?: string };
      if (!/^[a-z][a-z0-9-]*$/.test(name ?? ""))
        return json(400, { error: "A theme's name is kebab-case." });
      const { theme, diagnostics } = parseTheme({ path: `themes/${name}.yml`, text: text ?? "" });
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
        void stop().then(() => {
          server.close();
          done(0);
        });
      });
  });
}
