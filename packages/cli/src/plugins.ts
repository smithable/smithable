import { existsSync, lstatSync, readFileSync, realpathSync } from "node:fs";
import { createRequire } from "node:module";
import { join, sep } from "node:path";
import { resolvePlugin, type SpecPlugin, YamlEditor } from "@smithable/core";

export const PLUGIN_NAME = /^[A-Za-z0-9][A-Za-z0-9_-]*$/;

const require = createRequire(import.meta.url);

/**
 * Where a project plugin lives: smithable/plugins/<name>/plugin.mjs. A name is one folder's
 * name (letters, digits, dashes and underscores), never a path out of the project ("../x").
 */
export function pluginPath(dir: string, name: string): string {
  if (!PLUGIN_NAME.test(name))
    throw new Error(`A plugin's name is letters, digits, dashes and underscores, not "${name}".`);
  return join(dir, "smithable", "plugins", name, "plugin.mjs");
}

/** The plugins smithable.context.yml declares ("plugins: [newsletter]"), in that order. */
export function declaredPlugins(dir: string): string[] {
  const path = join(dir, "smithable.context.yml");
  if (!existsSync(path)) return [];
  const names = new YamlEditor(readFileSync(path, "utf8")).get(["plugins"]);
  return Array.isArray(names) ? names.map(String) : [];
}

/**
 * Loads the project's plugins (ARCHITECTURE §5.1). They run code: locally they are trusted
 * like any package the project installs. A long-running process (Studio, MCP) keeps the
 * version it loaded first; restart it after changing a plugin.
 */
export function loadPlugins(dir: string, extra: string[] = []): SpecPlugin[] {
  const names = [
    ...declaredPlugins(dir),
    ...extra.filter((n) => !declaredPlugins(dir).includes(n)),
  ];
  if (names.length === 0) return [];
  const root = realpathSync(dir);
  return names.flatMap((name) => {
    const path = pluginPath(dir, name);
    if (!existsSync(path)) throw new Error(`Plugin "${name}" is declared but ${path} is missing.`);
    if (lstatSync(path).isSymbolicLink() || !realpathSync(path).startsWith(`${root}${sep}`)) {
      throw new Error(`Plugin "${name}" must be a regular file inside the project.`);
    }
    return [resolvePlugin((require(path) as { default?: unknown }).default, path)];
  });
}
