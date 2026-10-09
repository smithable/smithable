import { join } from "node:path";
import { expect, test } from "vitest";
import { pluginPath } from "./plugins.js";

test("a plugin's name is a folder in the project, never a path out of it", () => {
  expect(pluginPath("/app", "newsletter")).toBe(
    join("/app", "smithable/plugins/newsletter/plugin.mjs"),
  );
  for (const name of ["../x", "a/b", "..", "", "x\\y", "/etc"])
    expect(() => pluginPath("/app", name)).toThrow(/plugin's name/);
});
