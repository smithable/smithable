import { type ChildProcess, spawn } from "node:child_process";
import { randomUUID, timingSafeEqual } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { extname, join, normalize, resolve } from "node:path";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { describedWith, type Proposal } from "@smithable/ai";
import {
  BUILT_IN_THEMES,
  EDITABLE_FILES,
  type OperationArgs,
  themeThumbnail,
} from "@smithable/core";
import { applyProposal, proposalOutcome, proposeFor, usageLine } from "./ask.js";
import { customize } from "./customize.js";
import { warmTools } from "./generate.js";
import { git, ownRepository, trailer } from "./git.js";
import { type Io, tool } from "./io.js";
import { mcpServer } from "./mcp.js";
import { openQuestions } from "./new.js";
import { runOperation } from "./op.js";
import { readOutbox } from "./outbox.js";
import { declaredPlugins, pluginPath } from "./plugins.js";
import { previewConfig } from "./preview-editor.js";
import { redo, redoTarget } from "./redo.js";
import {
  type AskingStage,
  type MakingStage,
  type Replacement,
  reopenDatabase,
  replaceProject,
} from "./replace.js";
import {
  buildReport,
  recordFailure,
  reportChoice,
  reportText,
  sendReport,
  setReportChoice,
  traceIdOf,
} from "./report.js";
import { projectIndex } from "./rules.js";
import { translate } from "./translate.js";
import { undo, undoChange } from "./undo.js";
import { loadSpec, projectTranslations } from "./validate.js";
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
  /** The change's commit. */
  id: string;
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
  /** The files it changed that a person edits: the spec files and src/custom/** (Code mode). */
  files: string[];
  /** What the person asked a model, for a change it made (several changes may share one). */
  request?: string;
}

/** A file a person edits, as opposed to the generated ones (docs/design/studio-changes.md §3). */
export const ownFile = (path: string) => path in EDITABLE_FILES || path.startsWith("src/custom/");

const ENGINES = {
  generator: "generator",
  local: "local model",
  smithable: "Smithable model",
  frontier: "frontier model",
} as const;

/** The trace as last read, by the head it was read at: Studio asks for it on every poll. */
let traced: { dir: string; head: string; entries: TraceEntry[] } | undefined;

export function trace(dir: string): TraceEntry[] {
  // Only the app's own history: a repository around it is someone else's.
  if (!ownRepository(dir)) return [];
  const head = git(dir, ["rev-parse", "HEAD"]);
  if (head.ok && traced?.dir === dir && traced.head === head.out) return traced.entries;
  const entries = readTrace(dir);
  traced = head.ok ? { dir, head: head.out, entries } : undefined;
  return entries;
}

function readTrace(dir: string): TraceEntry[] {
  // Each commit's fields, then (after \x1d) the files it changed, one a line.
  const log = git(dir, ["log", "--name-only", "--format=%x1e%H%x1f%s%x1f%aI%x1f%b%x1d"]);
  if (!log.ok) return [];
  const records = log.out.split("\x1e").filter((e) => e.trim());
  const entries = records.map((r) => r.split("\x1d")[0] ?? "");
  const changed = new Map(
    records.map((r) => {
      const [head = "", names = ""] = r.split("\x1d");
      return [head.trim().split("\x1f")[0] ?? "", names.split("\n").filter((n) => n && ownFile(n))];
    }),
  );
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
    // A change that set the project up for its owner (op --setup) is not one of the owner's.
    if (trailer(body, "Smithable-Setup")) return [];
    const ms = /^(\d+) ms$/.exec(trailer(body, "Smithable-Duration") ?? "")?.[1];
    const operation = operations.get(
      isUndo ? (/This reverts commit ([0-9a-f]{40})/.exec(body)?.[1] ?? "") : sha,
    );
    const ai = trailer(body, "Smithable-AI");
    const model = ai
      ? (JSON.parse(ai) as {
          request?: string;
          tier: keyof typeof ENGINES;
          model: string;
          tokens: number;
          cost: number;
          currency?: "EUR" | "USD";
        })
      : undefined;
    return [
      {
        id: sha,
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
        files: changed.get(sha) ?? [],
        ...(model?.request ? { request: model.request } : {}),
      },
    ];
  });
}

/** A change's operation and file, from its Smithable-Op trailer, for editSpec only. */
function editOf(dir: string, rev: string): string | undefined {
  const op = trailer(git(dir, ["log", "-1", "--format=%B", rev]).out, "Smithable-Op");
  if (!op) return undefined;
  const { op: name, args } = JSON.parse(op) as { op: string; args: { file?: string } };
  return name === "editSpec" ? (args.file ?? "smithable.yml") : undefined;
}

/**
 * An edit that goes on in the same file grows the same change (docs/design/studio-changes.md
 * §4): when the change just made is an editSpec of the file `grow` (the editor's previous save)
 * edited, and `grow` is right before it, the two become one with the first's message and
 * database snapshot and the second's files. Otherwise (the head moved in between) nothing is
 * folded. The newest change's id, either way.
 */
export function foldGrow(dir: string, grow: string): string {
  const head = git(dir, ["rev-parse", "HEAD"]).out;
  const parent = git(dir, ["rev-parse", "--verify", "--quiet", "HEAD~1"]);
  const file = editOf(dir, head);
  if (!parent.ok || parent.out !== grow || !file || editOf(dir, grow) !== file) return head;
  const message = git(dir, ["log", "-1", "--format=%B", grow]).out;
  git(dir, ["reset", "-q", "--soft", `${grow}~1`]);
  // Typed back to where it began: no change at all.
  if (git(dir, ["diff", "--cached", "--quiet"]).ok) return git(dir, ["rev-parse", "HEAD"]).out;
  git(dir, ["commit", "-q", "-m", message]);
  return git(dir, ["rev-parse", "HEAD"]).out;
}

/**
 * One change opened (GET /api/change/<id>): the patch of the person's files (all of it with
 * `all`), the number of other files it changed, and the editable files before and after it.
 */
export function changeDetail(dir: string, id: string, all = false) {
  if (!/^[0-9a-f]{40}$/.test(id) || !git(dir, ["cat-file", "-e", `${id}^{commit}`]).ok)
    return undefined;
  const names = git(dir, ["show", "--format=", "--name-only", id]).out.split("\n").filter(Boolean);
  const own = names.filter(ownFile);
  const parent = git(dir, ["rev-parse", "--verify", "--quiet", `${id}^`]);
  // (git() trims its output, so a file comes back without its final newline.)
  const at = (rev: string) =>
    Object.fromEntries(
      Object.entries(EDITABLE_FILES).flatMap(([path, key]) => {
        const shown = git(dir, ["show", `${rev}:${path}`]);
        return shown.ok ? [[key, shown.out]] : [];
      }),
    );
  return {
    patch:
      all || own.length
        ? git(dir, ["show", "--format=", id, ...(all ? [] : ["--", ...own])]).out
        : "",
    generated: names.length - own.length,
    before: parent.ok ? at(parent.out.trim()) : {},
    after: at(id),
  };
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
  // pages and send no origin: one that names another site is a page there (MCP's own advice).
  const sameSite = !headers.origin || URL.parse(headers.origin)?.host === headers.host;
  if (path === "/mcp" && !sameSite)
    return { status: 403, message: "Only Studio's own page or an MCP client may use /mcp." };
  if (!["GET", "HEAD"].includes(method) && path !== "/mcp") {
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
/** The most a request to Studio may carry: a change with a picture it brings (base64) fits. */
export const BODY_MAX = 20_000_000;

export class TooLarge extends Error {
  constructor() {
    super(`The request is larger than ${BODY_MAX / 1_000_000} MB.`);
  }
}

/** A request's JSON body, refused past `max` bytes: by its stated length before anything is read, and while it is read. */
export async function readJson(
  chunks: AsyncIterable<Buffer | string>,
  length: string | undefined,
  max = BODY_MAX,
): Promise<Record<string, unknown>> {
  if (Number(length ?? 0) > max) throw new TooLarge();
  const parts: Buffer[] = [];
  let size = 0;
  for await (const chunk of chunks) {
    const part = typeof chunk === "string" ? Buffer.from(chunk) : chunk;
    size += part.length;
    if (size > max) throw new TooLarge();
    parts.push(part);
  }
  return JSON.parse(Buffer.concat(parts).toString("utf8") || "{}") as Record<string, unknown>;
}

/**
 * A dev server line about a module the project no longer has, within ten seconds of the app being
 * replaced: the old app's route tree asked for it while the files were exchanged ("Failed to load
 * url /src/generated/item.ts"), so it is about the app that was there, not this one.
 */
export function oldAppEcho(
  line: string,
  dir: string,
  replacedAt: number,
  now = Date.now(),
): boolean {
  if (!replacedAt || now - replacedAt > 10_000) return false;
  const path = /Failed to load url (\/src\/[^\s?]+)/.exec(line)?.[1];
  return path !== undefined && !existsSync(join(dir, path));
}

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
  // When the app was last replaced: the dev server's last word about the old app's modules comes
  // just after, and is not about the app that is here now.
  let replacedAt = 0;
  const log = (text: string) => {
    for (const line of text.split("\n").filter((l) => l.trim())) {
      if (oldAppEcho(line, dir, replacedAt)) continue;
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
      // Studio reloads the preview itself after a change (one reload, when the daemon says so).
      { holdUpdates: true },
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
   * A described app that is being made for this workspace while its person already looks at
   * Studio (docs/design/while-it-is-made.md): what they asked for, where the making is, when it
   * began and how long it usually takes, and the draft's files once the model has answered
   * (the page makes "What it does" from them). Until it is in place the project on disk is
   * still the one that waited here, which is nobody's app.
   */
  let making:
    | {
        description: string;
        stage: AskingStage | MakingStage | "failed";
        /** What the description leaves open, while the person is asked (stage "asking"). */
        questions?: { about?: string; question: string; options: string[] }[];
        since: string;
        usual?: number;
        files?: { spec?: string; auth?: string; content?: string; ux?: string; context?: string };
        error?: string;
      }
    | undefined;

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
        context: read("smithable.context.yml"),
        translations: projectTranslations(dir),
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
      ...(making ? { making } : {}),
      ...(waiting.length ? { waiting } : {}),
    };
  };

  /** What a replacement was asked with; a making that fails is tried again with it. */
  type Asked = Replacement & {
    wait?: boolean;
    usual?: number;
    /** Studio reads the description and asks what it leaves open, before the draft. */
    ask?: boolean;
  };
  /** Takes the person's answers to the questions that are being asked. */
  let answer: ((answers: string[]) => void) | undefined;
  /** What the person typed while their app was being made, to be made once it is in place. */
  let waiting: string[] = [];
  let asked: Asked | undefined;
  const replaceWith = async (to: Asked) => {
    const result = await capture((io) =>
      replaceProject(dir, io, to, (stage, draft) => {
        if (!making) return;
        making = {
          ...making,
          stage,
          ...(draft
            ? {
                files: {
                  spec: draft["smithable.yml"],
                  auth: draft["smithable.auth.yml"],
                  content: draft["smithable.content.yml"],
                  ux: draft["smithable.ux.yml"],
                  context: draft["smithable.context.yml"],
                },
              }
            : {}),
        };
        send("making", making);
      }),
    );
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
    if (result.ok) replacedAt = Date.now();
    if (making)
      making = result.ok
        ? undefined
        : { ...making, stage: "failed", error: result.output.trim().split("\n").at(-1) };
    send("making", making ?? null);
    send("changed", {});
    return result;
  };
  /**
   * Reads the description before the draft, when asked to: the starter that is its example,
   * and the person's answers to what it leaves open, folded into it as the draft takes them.
   * Asking waits for the person as long as they take; nothing is drafted meanwhile.
   */
  const settle = async (to: Asked): Promise<Asked> => {
    const description = (to.describe ?? "").trim();
    if (!to.ask || to.answers?.trim()) return to;
    const open = await openQuestions(description);
    const starter = to.starter ?? open.starter;
    if (open.questions.length === 0) return { ...to, ...(starter ? { starter } : {}) };
    if (making) making = { ...making, stage: "asking", questions: open.questions };
    send("making", making ?? null);
    const answers = await new Promise<string[]>((resolve) => {
      answer = resolve;
    });
    answer = undefined;
    return {
      ...to,
      ...(starter ? { starter } : {}),
      describe: describedWith(
        description,
        open.questions.map((q, i) => ({ question: q.question, answer: answers[i] ?? "" })),
      ),
    };
  };
  /** Takes a described app on and answers for it later, through `making`. */
  const startMaking = (to: Asked) => {
    asked = to;
    replaceable = false;
    making = {
      description: (to.describe ?? "").trim(),
      stage: to.ask && !to.answers?.trim() ? "reading" : "drafting",
      since: new Date().toISOString(),
      ...(typeof to.usual === "number" && to.usual > 0 ? { usual: to.usual } : {}),
    };
    send("making", making);
    const make = async () => {
      const settled = await settle(to);
      // Tried again, it is not asked again; and the bar runs from where the draft begins.
      asked = { ...settled, ask: false };
      if (making) {
        const { questions: _, ...rest } = making;
        making = { ...rest, stage: "drafting", since: new Date().toISOString() };
        send("making", making);
      }
      return replaceWith(settled);
    };
    void make().catch((error) => {
      replaceable = true;
      if (making) making = { ...making, stage: "failed", error: String(error) };
      send("making", making ?? null);
    });
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
    const body = () => readJson(req, req.headers["content-length"]);
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
      // What the preview kept instead of sending: invitations, sign-in codes, notifications.
      if (url.pathname === "/api/outbox") return json(readOutbox(dir));
      // A picture of the project's (the Look tab shows its logo); an SVG may not run anything.
      const image =
        /^\/api\/images\/((?:[\w-][\w.-]*\/)*[\w-][\w.-]*\.(webp|avif|jpe?g|png|svg))$/.exec(
          url.pathname,
        );
      if (image) {
        const file = join(dir, "public", "images", image[1] as string);
        if (!existsSync(file)) return json({ ok: false }, 404);
        res.writeHead(200, {
          "Content-Type":
            image[2] === "svg"
              ? "image/svg+xml"
              : `image/${image[2] === "jpg" ? "jpeg" : image[2]}`,
          "Content-Security-Policy": "sandbox; default-src 'none'; style-src 'unsafe-inline'",
          "Cache-Control": "no-cache",
        });
        return res.end(readFileSync(file));
      }
      const plugin = /^\/api\/plugins\/([\w-]+)\.mjs$/.exec(url.pathname)?.[1];
      if (plugin && declaredPlugins(dir).includes(plugin)) {
        res.writeHead(200, { "Content-Type": "text/javascript", "Cache-Control": "no-cache" });
        return res.end(readFileSync(pluginPath(dir, plugin)));
      }
      const change = /^\/api\/change\/([0-9a-f]{40})$/.exec(url.pathname)?.[1];
      if (change && ownRepository(dir)) {
        const detail = changeDetail(dir, change, url.searchParams.has("all"));
        if (!detail) return json({ error: "There is no such change." }, 404);
        return json(detail);
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
      // While a described app is being made, the project here is not the person's yet:
      // nothing else changes it (what they type waits on the page until it is in place).
      if (
        making &&
        making.stage !== "failed" &&
        !["GET", "HEAD"].includes(req.method ?? "GET") &&
        ![
          "/api/project/replace",
          "/api/making/retry",
          "/api/making/answer",
          "/api/waiting",
          "/mcp",
        ].includes(url.pathname) &&
        !url.pathname.startsWith("/api/preview/")
      )
        return json(
          { ok: false, output: "Your app is being made. This can be done once it is in place." },
          409,
        );
      if (req.method === "POST" && url.pathname === "/api/op") {
        const { name, args, confirm, file } = await body();
        // A picture the change brings (the Look tab's logo): under public/images/, at most 2 MB.
        const given = file as { path?: unknown; data?: unknown } | undefined;
        const bytes =
          typeof given?.data === "string" ? Buffer.from(given.data, "base64") : undefined;
        if (
          given &&
          (typeof given.path !== "string" ||
            !/^public\/images\/[\w-][\w.-]*\.(webp|avif|jpe?g|png|svg)$/.test(given.path) ||
            !bytes ||
            bytes.byteLength === 0 ||
            bytes.byteLength > 2 * 1024 * 1024)
        )
          return json(
            {
              ok: false,
              output: "A picture must be a webp, avif, jpg, png or svg file of at most 2 MB.",
            },
            400,
          );
        const asked = new Date().toISOString();
        const packages = installed();
        const result = await capture((io) =>
          runOperation(dir, io, String(name), (args ?? {}) as OperationArgs, {
            yes: confirm === true,
            reportLater: true,
            trace: traceIdOf(req.headers.traceparent),
            ...(given && bytes ? { files: [{ path: given.path as string, bytes }] } : {}),
          }),
        );
        // A destructive operation stops to ask; the Studio shows the impact and a confirm button.
        const needsConfirm = !result.ok && result.output.includes("Run again with --yes");
        // An edit in Code mode that goes on grows its change; the editor keeps the id.
        const grow = (args as { grow?: unknown } | undefined)?.grow;
        const change =
          result.ok && name === "editSpec"
            ? typeof grow === "string" && /^[0-9a-f]{40}$/.test(grow)
              ? foldGrow(dir, grow)
              : git(dir, ["rev-parse", "HEAD"]).out
            : undefined;
        if (result.ok) changed({ description: result.output });
        // A change that failed halfway was rolled back, its database included: the preview
        // reopens it, as after an undo.
        else if (result.output.includes("Nothing was changed.")) restored(packages);
        // A failure of this change (not a refusal, and not an earlier failure).
        const report = result.ok ? undefined : await offerReport(asked);
        return json({ ...result, needsConfirm, report, ...(change ? { change } : {}) });
      }
      // The preview has not answered within Studio's wait: its last log lines, and the failure
      // kept for a report (seen on the hosted beta: a preview that never started).
      if (req.method === "POST" && url.pathname === "/api/preview/stuck") {
        const tail = logs.slice(-40);
        // Each Retry asks again: recorded, and sent for "always", once while it stays stuck.
        if (!stuck) {
          recordFailure(
            dir,
            "preview",
            { url: preview },
            tail.join("\n") || "No log lines.",
            traceIdOf(req.headers.traceparent),
          );
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
        const { why } = await body();
        if (why === "unstyled")
          log("The preview's page came without its stylesheet; starting the preview again.\n");
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
      // A language's empty texts drafted by the configured model, as one change.
      if (req.method === "POST" && url.pathname === "/api/translate") {
        const { language } = await body();
        const result = await capture((io) => translate(dir, io, String(language)));
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
        const to = (await body()) as Asked;
        // A described app whose person is let in at once: the answer says only that it was
        // taken on; where it is, and that it is in place or failed, Studio's pages are told.
        if (to.wait === false && typeof to.describe === "string" && to.describe.trim()) {
          startMaking(to);
          return json({ ok: true, accepted: true }, 202);
        }
        const result = await replaceWith(to);
        return json(result, result.ok ? 200 : 422);
      }
      // The person's answers to what is being asked, in the questions' order ("" skips one).
      if (req.method === "POST" && url.pathname === "/api/making/answer") {
        if (making?.stage !== "asking" || !answer)
          return json({ ok: false, output: "Nothing is being asked." }, 409);
        const given = (await body()).answers;
        answer(Array.isArray(given) ? given.map((a) => String(a ?? "")) : []);
        return json({ ok: true });
      }
      // What the person types while their app is being made waits here (so another tab or a
      // reload shows the same), and is theirs to take back; the page makes it afterwards.
      if (req.method === "POST" && url.pathname === "/api/waiting") {
        const { add, remove } = await body();
        if (typeof add === "string" && add.trim()) waiting = [...waiting, add.trim()].slice(-20);
        if (typeof remove === "number") waiting = waiting.filter((_, i) => i !== remove);
        send("waiting", waiting);
        return json({ ok: true, waiting });
      }
      // A making that failed is tried again as it was asked.
      if (req.method === "POST" && url.pathname === "/api/making/retry") {
        if (making?.stage !== "failed" || !asked)
          return json({ ok: false, output: "Nothing is waiting to be tried again." }, 409);
        startMaking(asked);
        return json({ ok: true, accepted: true }, 202);
      }
      if (req.method === "POST" && url.pathname === "/api/undo") {
        const { change, check, confirm } = await body();
        const packages = installed();
        // One change by its id (studio-v3.md §3): the newest as before, an earlier one reversed
        // as a new change, or refused; `check` only asks.
        if (typeof change === "string") {
          const result = await capture((io) =>
            undoChange(dir, io, change, { check: check === true, yes: confirm === true }),
          );
          const needsConfirm = !result.ok && result.output.includes("Run again with --yes");
          if (result.ok && !check) changed({ description: result.output });
          return json({ ...result, needsConfirm });
        }
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
      // A body too large was not read to its end: the connection closes, so no unread bytes meet the next request.
      if (error instanceof TooLarge) res.setHeader("Connection", "close");
      if (res.headersSent) res.end();
      else
        json(
          { ok: false, output: error instanceof Error ? error.message : String(error) },
          error instanceof TooLarge ? 413 : 500,
        );
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
