import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, test } from "vitest";
import { loadPlugins, pluginPath } from "./plugins.js";

test("a plugin's name is a folder in the project, never a path out of it", () => {
  expect(pluginPath("/app", "newsletter")).toBe(
    join("/app", "smithable/plugins/newsletter/plugin.mjs"),
  );
  for (const name of ["../x", "a/b", "..", "", "x\\y", "/etc"])
    expect(() => pluginPath("/app", name)).toThrow(/plugin's name/);
});

test("loadPlugins refuses a symlinked plugin file", () => {
  const dir = mkdtempSync(join(tmpdir(), "plugin-test-"));
  const outside = mkdtempSync(join(tmpdir(), "plugin-outside-"));
  try {
    writeFileSync(join(outside, "evil.mjs"), "export default {};\n");
    writeFileSync(join(dir, "smithable.context.yml"), "plugins: [newsletter]\n");
    mkdirSync(join(dir, "smithable/plugins/newsletter"), { recursive: true });
    symlinkSync(join(outside, "evil.mjs"), join(dir, "smithable/plugins/newsletter/plugin.mjs"));
    expect(() => loadPlugins(dir)).toThrow(/regular file inside the project/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
    rmSync(outside, { recursive: true, force: true });
  }
});
