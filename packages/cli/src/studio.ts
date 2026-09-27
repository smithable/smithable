import { type ChildProcess, spawn } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { extname, join, normalize } from "node:path";
import type { Proposal } from "@smithable/ai";
import type { OperationArgs } from "@smithable/core";
import { applyProposal, proposeFor, usageLine } from "./ask.js";
import { customize } from "./customize.js";
import { git } from "./git.js";
import type { Io } from "./io.js";
import { runOperation } from "./op.js";
import { previewConfig } from "./preview-editor.js";
import { projectIndex } from "./rules.js";
import { undo } from "./undo.js";
import { loadSpec } from "./validate.js";

/** The built Studio app (apps/studio), next to the CLI in the repository. */
const STUDIO = new URL("../../../apps/studio/dist/", import.meta.url).pathname;

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
}

const ENGINES = {
  local: "local model",
  smithable: "Smithable model",
  frontier: "frontier model",
} as const;

function trace(dir: string): TraceEntry[] {
  const log = git(dir, ["log", "--format=%H%x1f%s%x1f%aI%x1f%b%x1e"]);
  if (!log.ok) return [];
  const entries = log.out.split("\x1e").filter((e) => e.trim());
  const reverted = new Set(
    entries.flatMap((e) => [...e.matchAll(/This reverts commit ([0-9a-f]{40})/g)].map((m) => m[1])),
  );
  return entries.flatMap((entry) => {
    const [sha = "", subject = "", at = "", body = ""] = entry.trim().split("\x1f");
    const isUndo = subject.startsWith('Revert "smithable: ');
    if (!(subject.startsWith("smithable: ") || isUndo) || subject === "smithable: start of history")
      return [];
    const ms = /^Smithable-Duration: (\d+) ms$/m.exec(body)?.[1];
    const ai = /^Smithable-AI: (.+)$/m.exec(body)?.[1];
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
        engine: model ? ENGINES[model.tier] : ("generator" as const),
        tokens: model?.tokens ?? 0,
        ...(model
          ? { model: model.model, cost: model.cost, currency: model.currency ?? "EUR" }
          : {}),
        ...(ms ? { ms: Number(ms) } : {}),
        undone: reverted.has(sha),
        isUndo,
      },
    ];
  });
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
  options: { host?: string; previewUrl?: string; home?: string } = {},
): Promise<number> {
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
  // The preview runs with the editor (select, drag columns) through a wrapper config in data/,
  // which Git ignores: the app's own config and builds stay as they are.
  const config = join("data", ".smithable", "preview.vite.config.mjs");
  mkdirSync(join(dir, "data", ".smithable"), { recursive: true });
  writeFileSync(join(dir, config), previewConfig(options.previewUrl));
  const startApp = () => {
    app = spawn(
      "pnpm",
      [
        "exec",
        "vite",
        "dev",
        "--config",
        config,
        "--port",
        String(previewPort),
        "--strictPort",
        ...(options.host ? ["--host", options.host] : []),
      ],
      {
        cwd: dir,
        env: { ...process.env, BETTER_AUTH_URL: preview, NO_COLOR: "1" },
        detached: true,
      },
    );
    app.stdout?.on("data", (d) => log(String(d)));
    app.stderr?.on("data", (d) => log(String(d)));
  };
  const stopApp = () => {
    if (app?.pid) {
      try {
        process.kill(-app.pid);
      } catch {}
    }
  };
  startApp();

  /** The last proposal a model made, waiting to be applied or dropped. */
  let pending: { request: string; proposal: Proposal } | undefined;

  /** Runs a command with its output captured for the response. */
  const capture = (fn: (io: Io) => number) => {
    let output = "";
    const code = fn({ out: (t) => (output += t), err: (t) => (output += t) });
    log(output);
    return { ok: code === 0, output: output.trim() };
  };

  const state = () => {
    const quiet = { out: () => {}, err: () => {} };
    const { ir, auth } = loadSpec(dir, quiet);
    const read = (f: string) =>
      existsSync(join(dir, f)) ? readFileSync(join(dir, f), "utf8") : undefined;
    return {
      name: ir?.app.name ?? "",
      files: {
        spec: read("smithable.yml"),
        auth: read("smithable.auth.yml"),
        content: read("smithable.content.yml"),
      },
      concepts: ir && auth ? projectIndex(dir, ir, auth).concepts : [],
      trace: trace(dir),
      preview,
      ...(options.home ? { home: options.home } : {}),
    };
  };

  const server = createServer(async (req: IncomingMessage, res: ServerResponse) => {
    const url = new URL(req.url ?? "/", "http://localhost");
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
      if (url.pathname === "/api/project") return json(state());
      if (url.pathname === "/api/logs") return json(logs);
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
        const result = capture((io) =>
          runOperation(dir, io, String(name), (args ?? {}) as OperationArgs, {
            yes: confirm === true,
          }),
        );
        // A destructive operation stops to ask; the Studio shows the impact and a confirm button.
        const needsConfirm = !result.ok && result.output.includes("Run again with --yes");
        if (result.ok) send("changed", { description: result.output });
        return json({ ...result, needsConfirm });
      }
      if (req.method === "POST" && url.pathname === "/api/ask") {
        // A model proposes; nothing changes until the proposal is applied.
        const { request } = await body();
        const quiet = { out: () => {}, err: (t: string) => log(t) };
        const proposal = await proposeFor(dir, quiet, String(request ?? ""));
        pending = proposal ? { request: String(request), proposal } : undefined;
        if (!proposal) return json({ kind: "failed", message: "The spec has errors.", usage: "" });
        const { usage, ...rest } = proposal;
        return json({
          ...rest,
          ...(rest.kind === "change" ? { files: undefined } : {}),
          usage: usageLine(usage),
        });
      }
      if (req.method === "POST" && url.pathname === "/api/ask/apply") {
        const confirmed = pending;
        pending = undefined;
        if (confirmed?.proposal.kind !== "change")
          return json({ ok: false, output: "There is no proposed change to apply." });
        const proposal = confirmed.proposal;
        const result = capture((io) => applyProposal(dir, io, confirmed.request, proposal));
        if (result.ok) send("changed", { description: result.output });
        return json(result);
      }
      if (req.method === "POST" && url.pathname === "/api/customize") {
        const { page } = await body();
        const result = capture((io) => customize(dir, io, `page:${String(page)}`));
        if (result.ok) send("changed", {});
        return json(result);
      }
      if (req.method === "POST" && url.pathname === "/api/undo") {
        const result = capture((io) => undo(dir, io));
        if (result.ok) {
          // The database went back to its snapshot: the preview reopens it.
          stopApp();
          startApp();
          send("changed", {});
        }
        return json(result);
      }
      // The Studio app itself; unknown paths get index.html (a single-page app).
      const path = normalize(url.pathname).replace(/^(\.\.[/\\])+/, "");
      let file = join(STUDIO, path);
      if (!existsSync(file) || path === "/") file = join(STUDIO, "index.html");
      res.writeHead(200, { "Content-Type": TYPES[extname(file)] ?? "application/octet-stream" });
      res.end(readFileSync(file));
    } catch (error) {
      json({ ok: false, output: error instanceof Error ? error.message : String(error) }, 500);
    }
  });
  server.listen(port, options.host ?? "127.0.0.1");
  io.out(`Smithable Studio: http://localhost:${port} (the app's preview runs on ${preview})\n`);
  await new Promise<void>((resolve) => {
    for (const signal of ["SIGINT", "SIGTERM"] as const) process.once(signal, () => resolve());
  });
  stopApp();
  server.close();
  return 0;
}
