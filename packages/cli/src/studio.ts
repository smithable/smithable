import { type ChildProcess, spawn } from "node:child_process";
import { randomUUID, timingSafeEqual } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { extname, join, normalize, resolve } from "node:path";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import type { Proposal } from "@smithable/ai";
import { BUILT_IN_THEMES, type OperationArgs, themeThumbnail } from "@smithable/core";
import { applyProposal, proposalOutcome, proposeFor, usageLine } from "./ask.js";
import { customize } from "./customize.js";
import { warmTools } from "./generate.js";
import { git, ownRepository, trailer } from "./git.js";
import { type Io, tool } from "./io.js";
import { mcpServer } from "./mcp.js";
import { runOperation } from "./op.js";
import { declaredPlugins, pluginPath } from "./plugins.js";
import { previewConfig } from "./preview-editor.js";
import { redo, redoTarget } from "./redo.js";
import { type Replacement, reopenDatabase, replaceProject } from "./replace.js";
import {
  buildReport,
  recordFailure,
  reportChoice,
  reportText,
  sendReport,
  setReportChoice,
} from "./report.js";
import { projectIndex } from "./rules.js";
import { undo } from "./undo.js";
import { loadSpec } from "./validate.js";
import { warmPreview } from "./warm.js";

/** The built Studio app (apps/studio), next to the CLI in the repository. */
/** A message shown once when Studio next opens, e.g. why a description could not be used. */
export const NOTICE = "data/.smithable/notice.txt";
// Installed from npm, the Studio app travels in the package (studio/, scripts/prepack.mjs); in the
// repository it is apps/studio's own build.
const PACKAGED = new URL("../studio/", import.meta.url).pathname;
const STUDIO = existsSync(join(PACKAGED, "index.html"))
  ? PACKAGED
  : new URL("../../../apps/studio/dist/", import.meta.url).pathname;

const TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript",
  ".css": "text/css",
  ".svg": "image/svg+xml",
};

/** One entry of the change trace (ARCHITECTURE §9.7), from the project's Git history. */
export interface TraceEntry {
  description: string;
  at: string;
  /** The generator (no model), or the tier of the model that proposed the change. */
  engine: "generator" | "local model" | "Smithable model" | "frontier model";
  model?: string;
  tokens: number;
  cost?: number;
  currency?: "EUR" | "USD";
  ms?: number;
  undone: boolean;
  isUndo: boolean;
  /** The operation, for the Builder to word it like its summary; an undo has the undone one. */
  operation?: { op: string; args: Record<string, unknown> };
}

const ENGINES = {
  generator: "generator",
  local: "local model",
  smithable: "Smithable model",
  frontier: "frontier model",
} as const;

function trace(dir: string): TraceEntry[] {
  // Only the app's own history: a repository around it is someone else's.
  if (!ownRepository(dir)) return [];
  const log = git(dir, ["log", "--format=%H%x1f%s%x1f%aI%x1f%b%x1e"]);
  if (!log.ok) return [];
  const entries = log.out.split("\x1e").filter((e) => e.trim());
  const reverted = new Set(
    entries.flatMap((e) => [...e.matchAll(/This reverts commit ([0-9a-f]{40})/g)].map((m) => m[1])),
  );
  const operations = new Map(
    entries.flatMap((e) => {
      const [sha = "", , , body = ""] = e.trim().split("\x1f");
      const op = trailer(body, "Smithable-Op");
      return op ? [[sha, JSON.parse(op) as TraceEntry["operation"]]] : [];
    }),
  );
  return entries.flatMap((entry) => {
    const [sha = "", subject = "", at = "", body = ""] = entry.trim().split("\x1f");
    const isUndo = subject.startsWith('Revert "smithable: ');
    if (!(subject.startsWith("smithable: ") || isUndo) || subject === "smithable: start of history")
      return [];
    const ms = /^(\d+) ms$/.exec(trailer(body, "Smithable-Duration") ?? "")?.[1];
    const operation = operations.get(
      isUndo ? (/This reverts commit ([0-9a-f]{40})/.exec(body)?.[1] ?? "") : sha,
    );
    const ai = trailer(body, "Smithable-AI");
    const model = ai
      ? (JSON.parse(ai) as {
          tier: keyof typeof ENGINES;
          model: string;
          tokens: number;
          cost: number;
          currency?: "EUR" | "USD";
        })
      : undefined;
    return [
      {
        description: isUndo ? `Undid: ${subject.slice(19, -1)}` : subject.slice(11),
        at,
        // A change a wording rule read, or none a model made: the generator's (tier 0).
        engine: model?.tier ? ENGINES[model.tier] : ("generator" as const),
        tokens: model?.tokens ?? 0,
        ...(model
          ? { model: model.model, cost: model.cost, currency: model.currency ?? "EUR" }
          : {}),
        ...(ms ? { ms: Number(ms) } : {}),
        undone: reverted.has(sha),
        isUndo,
        ...(operation ? { operation } : {}),
      },
    ];
  });
}

/**
 * Why a request may not reach Studio, if it may not. On this machine only this machine's own
 * addresses count, so a web page cannot reach the API through DNS rebinding. Behind a proxy
 * (--host) with a token (SMITHABLE_STUDIO_TOKEN), only requests carrying it: the proxy adds it,
 * so nothing else on the network can use Studio.
 */
export function refusal(
  headers: IncomingMessage["headers"],
  host: string | undefined,
  token: string | undefined,
  method = "GET",
  path = "/",
): { status: number; message: string } | undefined {
  // A change comes from Studio's own page: JSON with Studio's header (which a form or a simple
  // request from another site cannot send), and no other site's origin. MCP clients are not
  // pages, and MCP's own content rules keep simple requests out.
  if (!["GET", "HEAD"].includes(method) && path !== "/mcp") {
    const sameSite = !headers.origin || new URL(headers.origin).host === headers.host;
    if (
      headers["x-smithable"] !== "1" ||
      !String(headers["content-type"] ?? "").startsWith("application/json") ||
      !sameSite
    )
      return { status: 403, message: "Only Studio's own page can make changes." };
  }
  if (!host) {
    const name = (headers.host ?? "").replace(/:\d+$/, "");
    return ["localhost", "127.0.0.1"].includes(name)
      ? undefined
      : { status: 403, message: "Unknown host." };
  }
  if (!token) return undefined;
  const given = headers["x-smithable-studio-token"];
  const ok =
    typeof given === "string" &&
    given.length === token.length &&
    timingSafeEqual(Buffer.from(given), Buffer.from(token));
  return ok ? undefined : { status: 401, message: "Studio needs its token." };
}

/**
 * `smithable studio [dir]`: the local daemon (ARCHITECTURE §11). It runs the app's dev
 * server as the preview (the Local runtime) and serves the Studio app with a small API:
 * the project, operations, undo, the last change's diff, and events.
 */
export async function studio(
  dir: string,
  io: Io,
  port: number,
  options: {
    host?: string;
    previewUrl?: string;
    home?: string;
    insecure?: boolean;
    /**
     * The project may be replaced by another app, once (a hosted workspace that waits for
     * whoever claims it; docs/design/fast-start.md). Never for a person's own project.
     */
    replaceable?: boolean;
  } = {},
): Promise<number> {
  // On the network, Studio without a token would let anyone who reaches it change the project:
  // a workspace image started without one refuses to run rather than run open.
  if (options.host && !process.env.SMITHABLE_STUDIO_TOKEN && !options.insecure) {
    io.err(
      `Studio would listen on ${options.host} without a token. Set SMITHABLE_STUDIO_TOKEN (the proxy sends it as X-Smithable-Studio-Token), or pass --insecure to allow anyone who can reach it to change the project.\n`,
    );
    return 1;
  }
  const { ir } = loadSpec(dir, io);
  if (!ir) return 1;
  if (!existsSync(join(STUDIO, "index.html"))) {
    io.err("The Studio app is not built: run `pnpm build` in the Smithable repository.\n");
    return 1;
  }
  const previewPort = port + 1;
  const preview = options.previewUrl ?? `http://localhost:${previewPort}`;
  const logs: string[] = [];
  const clients = new Set<ServerResponse>();
  const send = (event: string, data: unknown) => {
    for (const client of clients)
      client.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  };
  const log = (text: string) => {
    for (const line of text.split("\n").filter((l) => l.trim())) {
      logs.push(line);
      if (logs.length > 500) logs.shift();
      send("log", line);
    }
  };

  let app: ChildProcess | undefined;
  /** The preview's failure to answer, recorded once until it answers (and its report sent once). */
  let stuck: { report?: "sent" | "offer" } | undefined;
  const previewAnswers = () =>
    fetch(`http://localhost:${previewPort}/health`, { signal: AbortSignal.timeout(2000) }).then(
      (answer) => answer.ok,
      () => false,
    );
  /**
   * Tells Studio to reload the preview once the dev server has taken in a change: a moment
   * first (TanStack Start is still rebuilding after its watcher goes quiet), then the editor
   * plugin's /__smithable/settled. Reloading earlier can leave the preview's request hanging;
   * an operation that finished quickly made that likely. The operation's own answer does not
   * wait for this.
   */
  const settled = () =>
    new Promise((r) => setTimeout(r, 800))
      .then(() =>
        fetch(`http://127.0.0.1:${previewPort}/__smithable/settled`, {
          signal: AbortSignal.timeout(5000),
        }),
      )
      .catch(() => undefined);
  const changed = (data: unknown) => void settled().then(() => send("changed", data));
  // The preview runs with the editor (select, drag columns) through a wrapper config in data/,
  // which Git ignores: the app's own config and builds stay as they are.
  const config = join("data", ".smithable", "preview.vite.config.mjs");
  // Packages in a pnpm virtual store outside the project (hosted workspaces with a prepared
  // dependency set) may be served too.
  const store = process.env.pnpm_config_virtual_store_dir;
  // Written only when it is not there as it should be: a dev server that is running starts
  // itself again when its settings file is touched.
  const writePreviewConfig = () => {
    const text = previewConfig(
      options.previewUrl,
      store ? [resolve(dir), resolve(store)] : undefined,
    );
    const path = join(dir, config);
    if (existsSync(path) && readFileSync(path, "utf8") === text) return;
    mkdirSync(join(dir, "data", ".smithable"), { recursive: true });
    writeFileSync(path, text);
  };
  writePreviewConfig();
  // When the preview stops by itself (a crash), it starts again: at once for the first few
  // stops in a minute, then with a growing pause up to two minutes, and never for good, so a
  // burst of crashes after a broken change does not leave the preview dead until a restart.
  let restarts: number[] = [];
  const startApp = () => {
    const child = spawn(
      ...tool(dir, "vite", [
        "dev",
        "--config",
        config,
        "--port",
        String(previewPort),
        "--strictPort",
        ...(options.host ? ["--host", options.host] : []),
      ]),
      {
        cwd: dir,
        env: { ...process.env, BETTER_AUTH_URL: preview, NO_COLOR: "1" },
        detached: true,
      },
    );
    app = child;
    child.stdout?.on("data", (d) => log(String(d)));
    child.stderr?.on("data", (d) => log(String(d)));
    child.on("exit", () => {
      if (app !== child) return;
      restarts = [...restarts.filter((t) => Date.now() - t < RESTART_WINDOW), Date.now()];
      const delay = previewRestartDelay(restarts.length);
      log(
        delay > 1000
          ? `The preview keeps stopping; trying again in ${Math.round(delay / 1000)} s.\n`
          : "The preview stopped; starting it again.\n",
      );
      setTimeout(startApp, delay);
    });
    // Once it answers, a preview that is stuck again later is a new failure to report.
    void warmPreview(previewPort, log).then(async () => {
      if (await previewAnswers()) stuck = undefined;
    });
  };
  /** What decides the install, to tell whether a change put other packages in place. */
  const installed = () => {
    const path = join(dir, "package.json");
    return existsSync(path) ? readFileSync(path, "utf8") : "";
  };
  /**
   * After the database was put back (an undo, a redo, a change that was rolled back): the
   * preview opens it again, without being started again. Its dev server takes in the files that
   * went back as it takes in any change, and a start costs 15 s in a hosted workspace. Only
   * when the packages changed with it (an owner's own package came or went) is it started
   * again, since what it had loaded may be gone.
   */
  const restored = (packagesBefore: string) => {
    if (installed() !== packagesBefore) {
      stopApp();
      startApp();
      send("changed", {});
      return;
    }
    reopenDatabase(dir);
    changed({});
  };
  const stopApp = () => {
    const child = app;
    app = undefined;
    if (child?.pid) {
      try {
        process.kill(-child.pid);
      } catch {}
    }
  };
  startApp();
  // The first operation then finds its tools loaded.
  void warmTools(dir);

  /** The last proposal a model made, waiting to be applied or dropped. */
  let pending: { id: string; request: string; proposal: Proposal } | undefined;
  /** Whether the project may still be replaced by another app (once; see the option). */
  let replaceable = options.replaceable === true;

  /**
   * The last failure, recorded `since` then, is reported at once for someone who chose
   * "always"; else Studio offers it.
   */
  const offerReport = async (since = ""): Promise<"sent" | "offer" | undefined> => {
    const built = buildReport(dir, logs);
    const choice = reportChoice();
    if (!built || built.at < since || choice === "never") return undefined;
    if (choice !== "always") return "offer";
    return "sent" in (await sendReport(built).catch(() => ({ url: "" }))) ? "sent" : "offer";
  };

  /** Runs a command with its output captured for the response. */
  const capture = async (fn: (io: Io) => number | Promise<number>) => {
    let output = "";
    const code = await fn({ out: (t) => (output += t), err: (t) => (output += t) });
    log(output);
    return { ok: code === 0, output: output.trim() };
  };

  // A message for the first to open Studio, left by whoever made the project (a hosted
  // workspace says why a description could not be used), shown once.
  const noticeFile = join(dir, NOTICE);
  let notice = existsSync(noticeFile) ? readFileSync(noticeFile, "utf8").trim() : undefined;
  rmSync(noticeFile, { force: true });

  const state = () => {
    const quiet = { out: () => {}, err: () => {} };
    const { ir, auth, themes } = loadSpec(dir, quiet);
    const read = (f: string) =>
      existsSync(join(dir, f)) ? readFileSync(join(dir, f), "utf8") : undefined;
    return {
      name: ir?.app.name ?? "",
      // The themes the ux file may name, each with its picture, for the Look tab's cards.
      themes: [...BUILT_IN_THEMES, ...(themes ?? [])].map((t) => ({
        name: t.name,
        source: t.source,
        font: t.font,
        thumbnail: themeThumbnail(t),
      })),
      // The project's own themes as parsed, for the engine in the tab to validate the ux file.
      ownThemes: themes ?? [],
      files: {
        spec: read("smithable.yml"),
        auth: read("smithable.auth.yml"),
        content: read("smithable.content.yml"),
        ux: read("smithable.ux.yml"),
      },
      // For the engine in the tab, which imports them from /api/plugins/; the version is for
      // its module cache.
      plugins: declaredPlugins(dir)
        .filter((name) => existsSync(pluginPath(dir, name)))
        .map((name) => ({ name, version: statSync(pluginPath(dir, name)).mtimeMs })),
      concepts: ir && auth ? projectIndex(dir, ir, auth).concepts : [],
      trace: trace(dir),
      // Whether Redo has a change it would make again.
      canRedo: Boolean(redoTarget(dir)),
      preview,
      ...(options.home ? { home: options.home } : {}),
      ...(notice ? { notice } : {}),
    };
  };

  const server = createServer(async (req: IncomingMessage, res: ServerResponse) => {
    const url = new URL(req.url ?? "/", "http://localhost");
    // Studio is never shown inside another site's page (clickjacking its buttons).
    res.setHeader("Content-Security-Policy", "frame-ancestors 'none'");
    res.setHeader("X-Content-Type-Options", "nosniff");
    const json = (data: unknown, status = 200) => {
      res.writeHead(status, { "Content-Type": "application/json" });
      res.end(JSON.stringify(data));
    };
    const body = async () => {
      let text = "";
      for await (const chunk of req) text += chunk;
      return JSON.parse(text || "{}") as Record<string, unknown>;
    };
    try {
      const refused = refusal(
        req.headers,
        options.host,
        process.env.SMITHABLE_STUDIO_TOKEN,
        req.method,
        url.pathname,
      );
      if (refused) return json({ ok: false, output: refused.message }, refused.status);
      // MCP over HTTP: an agent's changes show up in Studio right away.
      if (url.pathname === "/mcp") {
        const transport = new StreamableHTTPServerTransport({
          sessionIdGenerator: undefined,
          enableJsonResponse: true,
        });
        const mcp = mcpServer(dir, () => send("changed", {}));
        res.on("close", () => {
          void transport.close();
          void mcp.close();
        });
        await mcp.connect(transport);
        return await transport.handleRequest(req, res);
      }
      if (url.pathname === "/api/project") {
        const answer = state();
        notice = undefined;
        return json(answer);
      }
      if (url.pathname === "/api/logs") return json(logs);
      const plugin = /^\/api\/plugins\/([\w-]+)\.mjs$/.exec(url.pathname)?.[1];
      if (plugin && declaredPlugins(dir).includes(plugin)) {
        res.writeHead(200, { "Content-Type": "text/javascript", "Cache-Control": "no-cache" });
        return res.end(readFileSync(pluginPath(dir, plugin)));
      }
      if (url.pathname === "/api/diff") {
        // The last change Smithable made, as a patch without its bookkeeping files.
        const last = git(dir, [
          "log",
          "-1",
          "--format=%H",
          "--grep=^smithable: ",
          '--grep=^Revert "smithable: ',
        ]);
        const sha = last.out.trim();
        return json({
          patch: sha
            ? git(dir, [
                "show",
                "--format=%s%n",
                sha,
                "--",
                ".",
                ":!drizzle/meta",
                ":!.smithable",
                ":!src/routeTree.gen.ts",
                ":!pnpm-lock.yaml",
              ]).out
            : "",
        });
      }
      if (url.pathname === "/api/events") {
        res.writeHead(200, {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          Connection: "keep-alive",
        });
        res.write(": connected\n\n");
        clients.add(res);
        req.on("close", () => clients.delete(res));
        return;
      }
      if (req.method === "POST" && url.pathname === "/api/op") {
        const { name, args, confirm } = await body();
        const asked = new Date().toISOString();
        const packages = installed();
        const result = await capture((io) =>
          runOperation(dir, io, String(name), (args ?? {}) as OperationArgs, {
            yes: confirm === true,
            reportLater: true,
          }),
        );
        // A destructive operation stops to ask; the Studio shows the impact and a confirm button.
        const needsConfirm = !result.ok && result.output.includes("Run again with --yes");
        if (result.ok) changed({ description: result.output });
        // A change that failed halfway was rolled back, its database included: the preview
        // reopens it, as after an undo.
        else if (result.output.includes("Nothing was changed.")) restored(packages);
        // A failure of this change (not a refusal, and not an earlier failure).
        const report = result.ok ? undefined : await offerReport(asked);
        return json({ ...result, needsConfirm, report });
      }
      // The preview has not answered within Studio's wait: its last log lines, and the failure
      // kept for a report (seen on the hosted beta: a preview that never started).
      if (req.method === "POST" && url.pathname === "/api/preview/stuck") {
        const tail = logs.slice(-40);
        // Each Retry asks again: recorded, and sent for "always", once while it stays stuck.
        if (!stuck) {
          recordFailure(dir, "preview", { url: preview }, tail.join("\n") || "No log lines.");
          stuck = { report: await offerReport() };
        }
        return json({ log: tail.slice(-12), report: stuck.report });
      }
      // Whether the preview's own server answers, asked from here (inside a hosted workspace too):
      // the browser cannot read a status across origins, and a hosted service's "Starting…"
      // page (503) would pass for the app.
      if (url.pathname === "/api/preview/answers") return json({ ok: await previewAnswers() });
      // Retry: the preview's server starts again, rather than being asked once more.
      if (req.method === "POST" && url.pathname === "/api/preview/restart") {
        stopApp();
        startApp();
        return json({ ok: true });
      }
      // The report of the last failure, exactly as it would be sent, and the person's choice.
      if (req.method === "GET" && url.pathname === "/api/report") {
        const built = buildReport(dir, logs);
        return json({
          text: built ? reportText(built) : undefined,
          choice: reportChoice() ?? "ask",
        });
      }
      if (req.method === "POST" && url.pathname === "/api/report") {
        const { send: sending, choice } = await body();
        if (choice === "always" || choice === "never" || choice === "ask") setReportChoice(choice);
        const built = buildReport(dir, logs);
        if (!sending || !built) return json({ ok: true });
        try {
          return json({ ok: true, ...(await sendReport(built)) });
        } catch (error) {
          return json({ ok: false, message: (error as Error).message });
        }
      }
      if (req.method === "POST" && url.pathname === "/api/ask") {
        // A model proposes; nothing changes until the proposal is applied.
        const { request } = await body();
        const quiet = { out: () => {}, err: (t: string) => log(t) };
        // A proposal shown and never applied was declined.
        if (pending) proposalOutcome(dir, pending.id, "declined");
        const id = randomUUID();
        const proposal = await proposeFor(dir, quiet, String(request ?? ""), id);
        pending = proposal ? { id, request: String(request), proposal } : undefined;
        if (!proposal)
          return json({ kind: "failed", message: "The spec has errors.", usage: "", id });
        const { usage, ...rest } = proposal;
        return json({
          ...rest,
          id,
          ...(rest.kind === "change" ? { files: undefined } : {}),
          usage: usageLine(usage, rest.kind === "change" ? rest.generator : undefined),
        });
      }
      if (req.method === "POST" && url.pathname === "/api/ask/apply") {
        // Only the proposal the page was shown: not a newer one made in another tab.
        const { id } = await body();
        const confirmed = pending?.id === id ? pending : undefined;
        if (confirmed) pending = undefined;
        if (confirmed?.proposal.kind !== "change")
          return json({
            ok: false,
            output: "That proposal is no longer the latest one; describe the change again.",
          });
        const proposal = confirmed.proposal;
        const result = await capture((io) => applyProposal(dir, io, confirmed.request, proposal));
        proposalOutcome(dir, confirmed.id, result.ok ? "applied" : "failed");
        if (result.ok) changed({ description: result.output });
        return json(result);
      }
      if (req.method === "POST" && url.pathname === "/api/customize") {
        const { page } = await body();
        const result = await capture((io) => customize(dir, io, `page:${String(page)}`));
        if (result.ok) changed({});
        return json(result);
      }
      if (req.method === "POST" && url.pathname === "/api/redo") {
        // As an operation: the app regenerates and the preview follows.
        const packages = installed();
        const result = await capture((io) => redo(dir, io));
        if (result.ok) restored(packages);
        return json(result);
      }
      // A workspace that waited for whoever claims it gets their app: once, and only when
      // Studio was started for that. The app comes in under the running preview, which takes
      // it in as it takes in any change (only what differs is written): a finished project
      // as it is, an app from a description once it has been made beside the project. What
      // Studio remembered of the old app (its log, a proposal, a notice) goes with it.
      if (req.method === "POST" && url.pathname === "/api/project/replace") {
        if (!replaceable)
          return json({ ok: false, output: "This project is not one that can be replaced." }, 403);
        replaceable = false;
        const to = (await body()) as Replacement;
        const result = await capture((io) => replaceProject(dir, io, to));
        // Refused (nothing was touched) or failed: it can be asked again.
        if (!result.ok) replaceable = true;
        writePreviewConfig();
        pending = undefined;
        notice = existsSync(noticeFile) ? readFileSync(noticeFile, "utf8").trim() : undefined;
        rmSync(noticeFile, { force: true });
        await settled();
        // The log starts with the person's app: nothing of the app that was here, and nothing
        // of what the dev server said while the files under it were being exchanged.
        logs.length = 0;
        send("changed", {});
        return json(result, result.ok ? 200 : 422);
      }
      if (req.method === "POST" && url.pathname === "/api/undo") {
        const packages = installed();
        const result = await capture((io) => undo(dir, io));
        // The database went back to its snapshot: the preview reopens it.
        if (result.ok) restored(packages);
        return json(result);
      }
      // The Studio app itself; unknown paths get index.html (a single-page app).
      const path = normalize(url.pathname).replace(/^(\.\.[/\\])+/, "");
      let file = join(STUDIO, path);
      if (!existsSync(file) || !statSync(file).isFile()) file = join(STUDIO, "index.html");
      res.writeHead(200, { "Content-Type": TYPES[extname(file)] ?? "application/octet-stream" });
      res.end(readFileSync(file));
    } catch (error) {
      if (res.headersSent) res.end();
      else json({ ok: false, output: error instanceof Error ? error.message : String(error) }, 500);
    }
  });
  server.listen(port, options.host ?? "127.0.0.1");
  if (options.host && !process.env.SMITHABLE_STUDIO_TOKEN)
    io.err(`Studio listens on ${options.host} without a token (--insecure).\n`);
  io.out(`Smithable Studio: http://localhost:${port} (the app's preview runs on ${preview})\n`);
  await new Promise<void>((resolve) => {
    for (const signal of ["SIGINT", "SIGTERM"] as const) process.once(signal, () => resolve());
  });
  stopApp();
  server.close();
  return 0;
}

/** Stops within this long count towards the pause between restarts. */
export const RESTART_WINDOW = 10 * 60_000;

/**
 * How long to wait before starting the preview again after its n-th stop in the window: at
 * once (a second) for the first five, then 10 s, 20 s, 40 s, 80 s and two minutes from then on.
 */
export function previewRestartDelay(stopsInWindow: number): number {
  if (stopsInWindow <= 5) return 1000;
  return Math.min(120_000, 10_000 * 2 ** (stopsInWindow - 6));
}
