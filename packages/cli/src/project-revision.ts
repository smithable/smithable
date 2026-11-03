import { createHash } from "node:crypto";
import { existsSync, lstatSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { git, ownRepository } from "./git.js";

/** Include working bytes and the set of theme/translation files, not only Git HEAD. */
export function projectRevision(dir: string, includeHead = true): string {
  const hash = createHash("sha256").update(
    includeHead && ownRepository(dir) ? git(dir, ["rev-parse", "HEAD"]).out : "no-head",
  );
  for (const [name, digest] of Object.entries(sourceDigests(dir)))
    hash.update(JSON.stringify(name)).update(":").update(digest).update("\n");
  return hash.digest("hex");
}

/** Each source file's digest by its path (a missing one is "missing"), sorted; what a change in the revision is of. */
export function sourceDigests(dir: string): Record<string, string> {
  const names = new Set([
    "smithable.yml",
    "smithable.ux.yml",
    "smithable.auth.yml",
    "smithable.content.yml",
    "smithable.context.yml",
    "samples/people.yml",
  ]);
  for (const name of readdirSync(dir))
    if (/^smithable\.content\.[a-z]+\.ya?ml$/.test(name)) names.add(name);
  const themes = join(dir, "themes");
  if (existsSync(themes)) {
    if (!lstatSync(themes).isDirectory() || lstatSync(themes).isSymbolicLink())
      throw new Error("The themes folder must be a directory inside this project.");
    for (const name of readdirSync(themes)) if (/\.ya?ml$/.test(name)) names.add(`themes/${name}`);
  }
  const digests: Record<string, string> = {};
  for (const name of [...names].sort()) {
    const path = join(dir, name);
    if (!existsSync(path)) {
      digests[name] = "missing";
      continue;
    }
    if (!lstatSync(path).isFile() || lstatSync(path).isSymbolicLink())
      throw new Error(`The source ${name} must be a regular file inside this project.`);
    const bytes = readFileSync(path);
    digests[name] = createHash("sha256")
      .update(String(bytes.length))
      .update(":")
      .update(bytes)
      .digest("hex");
  }
  return digests;
}
