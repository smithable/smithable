// The project worker (T991): one long-lived child per project that runs the app's own tools
// (tool-steps.ts) for a process holding Studio's token or the model key, so that process never
// loads code the project can write. The child gets childEnv() and no secret, a pipe on fd 3 and
// nothing else; every answer is data, size-capped and shape-checked, under a time limit. A worker
// that crashes, hangs or answers out of shape is stopped and started again once; after that the
// caller falls back to the tools' own processes (tsr, drizzle-kit, tsx), also on childEnv().
// A process without a secret (local Studio, the CLI on a laptop) runs the steps in itself.
import { type ChildProcess, spawn } from "node:child_process";
import { resolve } from "node:path";
import type { Readable, Writable } from "node:stream";
import { fileURLToPath } from "node:url";
import type { MigrationPlan } from "./generate.js";
import { childEnv, holdsSecret } from "./secrets.js";
import * as local from "./tool-steps.js";

/** The app's own tools, wherever they run. Undefined or false: the caller runs the tool's process. */
export interface Steps {
  createMigration(migration?: MigrationPlan): Promise<boolean | undefined>;
  routeTree(): Promise<boolean>;
  applyMigrations(): Promise<boolean | undefined>;
}

type Step = "warm" | "createMigration" | "routeTree" | "applyMigrations";
interface Answer {
  value: boolean | undefined;
  err: string;
}

// From dist/ and from src/ (the tests) alike: the built entry.
const MAIN = fileURLToPath(new URL("../dist/project-worker-main.js", import.meta.url));
/** An answer is a line of a few dozen bytes; anything near this is not one. */
export const ANSWER_MOST = 16 * 1024;
const ERR_MOST = 4000;
/** A first migration on a slow, sandboxed machine stays well under this. */
const PATIENCE = 120_000;
/** Started once, and again once after it failed. */
const STARTS = 2;

class Worker {
  private child?: ChildProcess;
  private pipe?: Readable & Writable;
  private buffer = "";
  private next = 1;
  private starts = 0;
  private readonly waiting = new Map<number, (answer: Answer | undefined) => void>();
  /** Said once, the first time the worker is given up. */
  failed = false;

  constructor(readonly dir: string) {}

  private start(): boolean {
    if (this.child) return true;
    if (this.starts >= STARTS) return false;
    this.starts++;
    const child = spawn(process.execPath, [MAIN], {
      cwd: this.dir,
      env: childEnv(),
      stdio: ["ignore", "ignore", "ignore", "pipe"],
    });
    const pipe = child.stdio[3] as (Readable & Writable) | null;
    if (!pipe) {
      child.kill("SIGKILL");
      return false;
    }
    this.child = child;
    this.pipe = pipe;
    this.buffer = "";
    pipe.setEncoding("utf8");
    pipe.on("data", (chunk: string) => this.read(chunk));
    pipe.on("error", () => this.stop());
    child.on("exit", () => this.stop(child));
    child.on("error", () => this.stop(child));
    // Neither keeps this process alive on its own: only a question waiting for its answer does.
    child.unref();
    (pipe as unknown as { unref(): void }).unref();
    return true;
  }

  private read(chunk: string): void {
    this.buffer += chunk;
    if (this.buffer.length > ANSWER_MOST) {
      this.stop();
      return;
    }
    for (let end = this.buffer.indexOf("\n"); end >= 0; end = this.buffer.indexOf("\n")) {
      const line = this.buffer.slice(0, end);
      this.buffer = this.buffer.slice(end + 1);
      const answer = shaped(line);
      const reply = answer && this.waiting.get(answer.id);
      if (!answer || !reply) {
        this.stop();
        return;
      }
      this.waiting.delete(answer.id);
      this.hold();
      reply(answer);
    }
  }

  /** Kills the child (if it is still the current one) and answers everything waiting with nothing. */
  private stop(which: ChildProcess | undefined = this.child): void {
    if (!which || which !== this.child) return;
    which.kill("SIGKILL");
    this.child = undefined;
    this.pipe = undefined;
    const waiting = [...this.waiting.values()];
    this.waiting.clear();
    for (const reply of waiting) reply(undefined);
  }

  private hold(): void {
    const pipe = this.pipe as unknown as { ref(): void; unref(): void } | undefined;
    if (this.waiting.size > 0) pipe?.ref();
    else pipe?.unref();
  }

  /** One step in the worker; undefined when it could not be asked or did not answer properly. */
  async ask(step: Step, migration?: MigrationPlan): Promise<Answer | undefined> {
    for (let attempt = 0; attempt < STARTS; attempt++) {
      if (!this.start()) return undefined;
      const answer = await this.once(step, migration);
      if (answer) return answer;
    }
    return undefined;
  }

  private once(step: Step, migration?: MigrationPlan): Promise<Answer | undefined> {
    const id = this.next++;
    const child = this.child;
    return new Promise((done) => {
      const timer = setTimeout(() => this.stop(child), PATIENCE);
      this.waiting.set(id, (answer) => {
        clearTimeout(timer);
        done(answer);
      });
      this.hold();
      this.pipe?.write(`${JSON.stringify({ id, step, migration })}\n`);
    });
  }

  close(): void {
    this.stop();
  }
}

/** An answer as the worker must give it, or undefined: an id, a yes, no or nothing, a short text. */
export function shaped(line: string): (Answer & { id: number }) | undefined {
  let parsed: unknown;
  try {
    parsed = JSON.parse(line);
  } catch {
    return undefined;
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return undefined;
  const { id, value, err, ...rest } = parsed as Record<string, unknown>;
  if (Object.keys(rest).length > 0) return undefined;
  if (typeof id !== "number" || !Number.isSafeInteger(id)) return undefined;
  if (value !== true && value !== false && value !== null) return undefined;
  if (typeof err !== "string" || err.length > ERR_MOST) return undefined;
  return { id, value: value ?? undefined, err };
}

const workers = new Map<string, Worker>();

function workerFor(dir: string): Worker {
  const root = resolve(dir);
  let worker = workers.get(root);
  if (!worker) {
    worker = new Worker(root);
    workers.set(root, worker);
  }
  return worker;
}

/** For tests: stop every worker. */
export function stopWorkers(): void {
  for (const worker of workers.values()) worker.close();
  workers.clear();
}

/** The steps for `dir`: in this process, or in the project worker when this process holds a secret. */
export function stepsFor(dir: string, say: local.Say): Steps {
  if (!holdsSecret())
    return {
      createMigration: (migration) => local.createMigration(dir, migration),
      routeTree: () => local.routeTree(dir, say),
      applyMigrations: async () => local.applyMigrations(dir, say),
    };
  const worker = workerFor(dir);
  const ask = async (step: Step, migration?: MigrationPlan) => {
    const answer = await worker.ask(step, migration);
    if (answer?.err) say.err(answer.err.endsWith("\n") ? answer.err : `${answer.err}\n`);
    if (!answer && !worker.failed) {
      worker.failed = true;
      say.err("The project worker stopped; the app's tools run as processes of their own.\n");
    }
    return answer?.value;
  };
  return {
    createMigration: (migration) => ask("createMigration", migration),
    routeTree: async () => (await ask("routeTree")) === true,
    applyMigrations: () => ask("applyMigrations"),
  };
}

/**
 * Loads the app's tools ahead of the first operation (Studio, once it has started): in this
 * process, or by starting the project worker. Failures only mean no head start.
 */
export async function warmTools(dir: string): Promise<void> {
  if (!holdsSecret()) return local.warmTools(dir);
  await workerFor(dir).ask("warm");
}
