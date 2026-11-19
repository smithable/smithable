// Studio's token and the model key (T991): taken out of process.env when a smithable process
// starts, so no child it runs inherits them (pnpm and its scripts, git and its hooks, the
// project's tests, the preview's dev server), and handed only to the engine's own calls that need
// them. Every child's environment is built by childEnv, which leaves both out whatever it is given.
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

/** A child's environment: the one given (this process's by default) and extras, without the two. */
export function childEnv(
  base: NodeJS.ProcessEnv = process.env,
  extra: NodeJS.ProcessEnv = {},
): NodeJS.ProcessEnv {
  const out: NodeJS.ProcessEnv = { ...base, ...extra };
  for (const name of NAMES) delete out[name];
  return out;
}

/** For tests: forget what is held. */
export function releaseSecretsForTests(): void {
  for (const name of NAMES) delete held[name];
  fromStdin = false;
}
