// Limit a theme checkpoint to its source files and compiler-owned output. Preserve concurrent
// editor files instead of sweeping them into a commit or deleting them during rollback.
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { git } from "./git.js";

const TOOLS = [
  ".smithable/files.json",
  ".smithable/oplog.jsonl",
  "smithable.lock",
  "pnpm-lock.yaml",
  "pnpm-workspace.yaml",
  "src/routeTree.gen.ts",
];
const digest = (path: string) =>
  existsSync(path) ? createHash("sha256").update(readFileSync(path)).digest("hex") : "missing";
function generated(dir: string): string[] {
  try {
    const record = JSON.parse(readFileSync(join(dir, ".smithable/files.json"), "utf8"));
    const paths: string[] = Array.isArray(record.files)
      ? record.files.map((file: { path: string }) => file.path)
      : Object.keys(record.files ?? {});
    return paths.filter((path) => !path.startsWith("/") && !path.split(/[\\/]/).includes(".."));
  } catch {
    return [];
  }
}
const paths = (dir: string, args: string[]) => git(dir, args).out.split("\0").filter(Boolean);

export function themeTransaction(dir: string, sourcePaths: string[]) {
  const owned = new Set([...sourcePaths, ...TOOLS, ...generated(dir)]);
  const protectedFiles = new Map(
    paths(dir, ["ls-files", "-z"])
      .filter((path) => !owned.has(path))
      .map((path) => [path, digest(join(dir, path))]),
  );
  const currentOwned = () => new Set([...owned, ...generated(dir)]);
  const externalChanges = (): string[] => {
    try {
      const allowed = currentOwned();
      const changed = [...protectedFiles]
        .filter(([path, hash]) => digest(join(dir, path)) !== hash)
        .map(([path]) => path);
      const appeared = paths(dir, ["ls-files", "--others", "--exclude-standard", "-z"]).filter(
        (path) => !allowed.has(path),
      );
      return [...changed, ...appeared];
    } catch {
      return ["(the working tree could not be read)"];
    }
  };
  return {
    /** The files outside the transaction that changed or appeared since it began, by path. */
    externalChanges,
    externalChange(): boolean {
      return externalChanges().length > 0;
    },
    stage(): boolean {
      // Existing generated files may have been removed, so include both manifests' paths.
      const changed = new Set(paths(dir, ["diff", "--name-only", "-z", "HEAD"]));
      const untracked = new Set(paths(dir, ["ls-files", "--others", "--exclude-standard", "-z"]));
      const names = [...currentOwned()].filter((path) => changed.has(path) || untracked.has(path));
      return names.length === 0 || git(dir, ["add", "-A", "--", ...names]).ok;
    },
  };
}
