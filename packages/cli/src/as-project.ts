// Work on the project's tree that needs the project's own rights (T1081). Where children run under
// a configured uid (secrets.ts childOptions), this process is another user: the app's database
// is that user's (SQLite makes its files 0644 whatever the umask), and a file this process wrote
// in its place would be this process's, which the app could then not write. Each such function is
// wrapped by asProject: given a project user, it runs in a node child as that user (the CLI's
// as-project-main.js, one call each, the arguments and the answer as JSON); otherwise here.
//
// A child's answer is the project's word, not this process's: another process of the project's
// user may reach the child while it runs. So this process never uses an answer as a path it then
// opens, reads or writes itself. keepImport's answer, for one, only goes into the operation log's
// recorded arguments, which the child then appends to (op.ts).
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { childOptions, projectUser } from "./secrets.js";

const MAIN = fileURLToPath(new URL("../dist/as-project-main.js", import.meta.url));

// biome-ignore lint/suspicious/noExplicitAny: a registry of functions of any shape.
type Op = (...args: any[]) => unknown;
const ops = new Map<string, Op>();

/**
 * JSON that keeps Maps, Sets, bytes and an undefined in a list (an argument left out), and leaves
 * an undefined property out, as a call would see them.
 */
export function encode(value: unknown): string {
  return JSON.stringify(value, function (key, v) {
    // The value before its toJSON (a Buffer's turns it into a list of numbers).
    const raw = (this as Record<string, unknown>)[key];
    if (raw instanceof Uint8Array) return { $bytes: Buffer.from(raw).toString("base64") };
    if (v instanceof Map) return { $map: [...v.entries()] };
    if (v instanceof Set) return { $set: [...v] };
    return v === undefined && Array.isArray(this) ? { $undefined: true } : v;
  });
}
export function decode(text: string): unknown {
  return JSON.parse(text, (_, v) => {
    if (!v || typeof v !== "object" || Array.isArray(v) || Object.keys(v).length !== 1) return v;
    if (Array.isArray(v.$map)) return new Map(v.$map);
    if (Array.isArray(v.$set)) return new Set(v.$set);
    if (typeof v.$bytes === "string") return new Uint8Array(Buffer.from(v.$bytes, "base64"));
    // Left as a hole in its list, which reads as undefined.
    if (v.$undefined === true) return undefined;
    return v;
  });
}

/**
 * `fn`, registered under `name`, run as the project user where one is configured. Only for
 * synchronous functions whose arguments and answer are plain data (and Maps).
 */
export function asProject<F extends Op>(name: string, fn: F): F {
  if (ops.has(name)) throw new Error(`asProject: ${name} is registered twice.`);
  ops.set(name, fn);
  return ((...args: unknown[]) => (projectUser() ? inChild(name, args) : fn(...args))) as F;
}

let calls = 0;
/** For tests: how many calls went to a child. */
export const childCallsForTests = (): number => calls;

function inChild(name: string, args: unknown[]): unknown {
  calls++;
  const run = spawnSync(process.execPath, [MAIN], {
    ...childOptions(),
    cwd: process.cwd(),
    input: encode({ name, args }),
    encoding: "utf8",
    maxBuffer: 256 * 1024 * 1024,
    stdio: ["pipe", "pipe", "pipe"],
  });
  if (run.error) throw run.error;
  let answer:
    | { value?: unknown; error?: { name: string; message: string; code?: string } }
    | undefined;
  try {
    answer = decode(run.stdout) as typeof answer;
  } catch {}
  if (!answer || run.status !== 0) {
    if (answer?.error) {
      const error: Error & { code?: string } = new Error(answer.error.message);
      error.name = answer.error.name;
      if (answer.error.code) error.code = answer.error.code;
      throw error;
    }
    throw new Error(`${name} as the project's user failed: ${run.stderr.trim().slice(-500)}`);
  }
  return answer.value;
}

/** In the child: runs one registered function on the call read from standard input. */
export function answerCall(text: string): { code: number; out: string } {
  const { name, args } = decode(text) as { name: string; args: unknown[] };
  const fn = ops.get(name);
  if (!fn) return { code: 2, out: encode({ error: { name: "Error", message: `No ${name}.` } }) };
  try {
    return { code: 0, out: encode({ value: fn(...args) }) };
  } catch (error) {
    const e: Error & { code?: unknown } = error instanceof Error ? error : new Error(String(error));
    const code = typeof e.code === "string" ? e.code : undefined;
    return { code: 1, out: encode({ error: { name: e.name, message: e.message, code } }) };
  }
}
