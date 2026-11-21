// Studio's token and the model key (T991): taken out of process.env when a smithable process
// starts, so no child it runs inherits them (pnpm and its scripts, git and its hooks, the
// project's tests, the preview's dev server), and handed only to the engine's own calls that need
// them. Every child's options are built by childOptions, which leaves both out whatever it is given.
import { readFileSync } from "node:fs";

const NAMES = ["SMITHABLE_STUDIO_TOKEN", "SMITHABLE_MODEL_KEY"] as const;
type SecretName = (typeof NAMES)[number];

const held: Partial<Record<SecretName, string>> = {};
/** The values came on standard input, as only a hosted workspace's start passes them. */
let fromStdin = false;

/** At start: the two names out of the environment, into this module only. Idempotent. */
export function holdSecrets(env: NodeJS.ProcessEnv = process.env): void {
  for (const name of NAMES) {
    const value = env[name];
    if (value !== undefined) held[name] = value;
    delete env[name];
  }
}

/**
 * From the process's standard input (`--secrets-stdin`): a JSON object with `studioToken` and
 * `modelKey`, each a string or left out, as a hosted workspace's start passes them, so they are
 * never in the environment at all. Anything else in it is refused.
 */
export function holdSecretsFromJson(text: string): void {
  const given = JSON.parse(text) as unknown;
  if (!given || typeof given !== "object" || Array.isArray(given))
    throw new Error("--secrets-stdin wants a JSON object.");
  const keys: Record<string, SecretName> = {
    studioToken: "SMITHABLE_STUDIO_TOKEN",
    modelKey: "SMITHABLE_MODEL_KEY",
  };
  for (const [key, value] of Object.entries(given)) {
    const name = keys[key];
    if (!name) throw new Error(`--secrets-stdin does not take "${key}".`);
    if (typeof value !== "string" || !value)
      throw new Error(`--secrets-stdin: "${key}" must be a string.`);
    held[name] = value;
  }
  fromStdin = true;
}

/** Studio's token (the proxy's bearer), for Studio's own checks and its requests to the preview. */
export const studioToken = (): string | undefined => held.SMITHABLE_STUDIO_TOKEN;

/** The hosted model's key, for the engine's own calls to the model. */
export const modelKey = (): string | undefined => held.SMITHABLE_MODEL_KEY;

/**
 * Whether this process holds a value it must keep from the project's code: Studio's token, values
 * given on standard input, or anything held in a hosted workspace (SMITHABLE_HOSTED_LEVEL set).
 * Such a process loads no code the project can write: no plugin, and the app's own tools only in
 * the project worker. A model key from the environment alone, on someone's own machine, is the
 * local product (docs/ai.md): the key is theirs and so is the project's code, so plugins load.
 */
export const holdsSecret = (env: NodeJS.ProcessEnv = process.env): boolean =>
  held.SMITHABLE_STUDIO_TOKEN !== undefined ||
  (NAMES.some((name) => held[name] !== undefined) &&
    (fromStdin || Boolean(env.SMITHABLE_HOSTED_LEVEL?.trim())));

/** The user children may run as, by `SMITHABLE_PROJECT_UID` and `_GID`; none when they are not set. */
const PROJECT = ["SMITHABLE_PROJECT_UID", "SMITHABLE_PROJECT_GID"] as const;

export type ProjectUser = { uid: number; gid: number; home?: string; name?: string };

/** An id as the environment gives it: digits only, or nothing. */
function idOf(value: string | undefined, name: string): number | undefined {
  if (value === undefined || value === "") return undefined;
  if (!/^\d+$/.test(value)) throw new Error(`${name} must be a number.`);
  return Number(value);
}

let project: ProjectUser | null | undefined;
/**
 * The user the project's processes run as, when this process was started with one (both ids or
 * neither); its home and name from /etc/passwd, so a child's tools find that user's settings. Read
 * once, from the environment as the process started.
 */
export function projectUser(env: NodeJS.ProcessEnv = process.env): ProjectUser | undefined {
  if (project !== undefined) return project ?? undefined;
  const uid = idOf(env.SMITHABLE_PROJECT_UID, "SMITHABLE_PROJECT_UID");
  const gid = idOf(env.SMITHABLE_PROJECT_GID, "SMITHABLE_PROJECT_GID");
  if ((uid === undefined) !== (gid === undefined))
    throw new Error("SMITHABLE_PROJECT_UID and SMITHABLE_PROJECT_GID go together.");
  if (uid === undefined || gid === undefined) {
    project = null;
    return undefined;
  }
  let passwd = "";
  try {
    passwd = readFileSync("/etc/passwd", "utf8");
  } catch {}
  const line = passwd.split("\n").find((l) => l.split(":")[2] === String(uid));
  const [name, , , , , home] = line?.split(":") ?? [];
  project = { uid, gid, ...(home ? { home } : {}), ...(name ? { name } : {}) };
  return project;
}

/** A child's environment: the one given (this process's by default) and extras, without the two. */
function childEnv(base: NodeJS.ProcessEnv, extra: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
  const out: NodeJS.ProcessEnv = { ...base, ...extra };
  for (const name of [...NAMES, ...PROJECT]) delete out[name];
  return out;
}

/**
 * A child's options, spread into every spawn: its environment without the two secrets, and, where
 * this process was given a project user, that user's uid, gid, home and name, so nothing the
 * project runs runs as this process's own user. On someone's own machine, the environment alone.
 */
export function childOptions(
  base: NodeJS.ProcessEnv = process.env,
  extra: NodeJS.ProcessEnv = {},
): { env: NodeJS.ProcessEnv; uid?: number; gid?: number } {
  const user = projectUser();
  if (!user) return { env: childEnv(base, extra) };
  const env = childEnv(base, {
    ...extra,
    ...(user.home ? { HOME: user.home } : {}),
    ...(user.name ? { USER: user.name, LOGNAME: user.name } : {}),
  });
  return { env, uid: user.uid, gid: user.gid };
}

/** CAP_KILL, CAP_SETGID and CAP_SETUID: what starts and stops a child as the project user. */
const CAPS = (1n << 5n) | (1n << 6n) | (1n << 7n);

/**
 * Whether a process given a project user holds exactly the capabilities it needs and can pass none
 * on: effective and permitted exactly KILL, SETGID and SETUID, inheritable and ambient none. Without
 * that, a child started as the project user could keep a capability across its exec. The reason it
 * is not, or nothing when it is; `status` is /proc/self/status's text.
 */
export function capabilityFault(status: string): string | undefined {
  const caps = (name: string) => {
    const hex = new RegExp(`^${name}:\\s*([0-9a-f]+)$`, "m").exec(status)?.[1];
    return hex === undefined ? undefined : BigInt(`0x${hex}`);
  };
  for (const [name, want] of [
    ["CapEff", CAPS],
    ["CapPrm", CAPS],
    ["CapInh", 0n],
    ["CapAmb", 0n],
  ] as const) {
    const has = caps(name);
    if (has !== want)
      return `${name} is ${has === undefined ? "missing" : `0x${has.toString(16)}`}, not 0x${want.toString(16)}`;
  }
  return undefined;
}

/** For tests: forget the project user read, so the next call reads the environment again. */
export function forgetProjectUserForTests(): void {
  project = undefined;
}

/** For tests: forget what is held. */
export function releaseSecretsForTests(): void {
  for (const name of NAMES) delete held[name];
  fromStdin = false;
}
