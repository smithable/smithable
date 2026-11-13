// Vite's dependency pre-bundle (node_modules/.vite) is kept between starts, keyed by the lockfile
// it can see. Under a shared package store it sees none, so after an install that changed the
// lock it would keep serving the old bundle until the app's Vite config changes (T742). Every
// install the engine runs drops it when the lock changed, so the next start bundles afresh.
import { existsSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";

const LOCK = "pnpm-lock.yaml";
const lockOf = (dir: string) => {
  const path = join(dir, LOCK);
  return existsSync(path) ? readFileSync(path, "utf8") : undefined;
};

/** Runs an install; when it changed the lockfile, the old pre-bundle goes. Returns its result. */
export function installing<T>(dir: string, install: () => T): T {
  const before = lockOf(dir);
  const result = install();
  if (lockOf(dir) !== before)
    rmSync(join(dir, "node_modules", ".vite"), { recursive: true, force: true });
  return result;
}
