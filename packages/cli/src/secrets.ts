// Studio's token and the model key (T991): taken out of process.env when a smithable process
// starts, so no child it runs inherits them (pnpm and its scripts, git and its hooks, the
// project's tests, the preview's dev server), and handed only to the engine's own calls that need
// them. Every child's environment is built by childEnv, which leaves both out whatever it is given.
const NAMES = ["SMITHABLE_STUDIO_TOKEN", "SMITHABLE_MODEL_KEY"] as const;
type SecretName = (typeof NAMES)[number];

const held: Partial<Record<SecretName, string>> = {};

/** At start: the two names out of the environment, into this module only. Idempotent. */
export function holdSecrets(env: NodeJS.ProcessEnv = process.env): void {
  for (const name of NAMES) {
    const value = env[name];
    if (value !== undefined) held[name] = value;
    delete env[name];
  }
}

/** Studio's token (the proxy's bearer), for Studio's own checks and its requests to the preview. */
export const studioToken = (): string | undefined => held.SMITHABLE_STUDIO_TOKEN;

/** The hosted model's key, for the engine's own calls to the model. */
export const modelKey = (): string | undefined => held.SMITHABLE_MODEL_KEY;

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
}
