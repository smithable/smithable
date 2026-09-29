import { existsSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";
import { resolvePlugin, type SpecPlugin, YamlEditor } from "@smithable/core";

const require = createRequire(import.meta.url);

/** Where a project plugin lives: smithable/plugins/<name>/plugin.mjs. */
export function pluginPath(dir: string, name: string): string {
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
  return names.flatMap((name) => {
    const path = pluginPath(dir, name);
    if (!existsSync(path)) throw new Error(`Plugin "${name}" is declared but ${path} is missing.`);
    return [resolvePlugin((require(path) as { default?: unknown }).default, path)];
  });
}
