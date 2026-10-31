import { readFileSync } from "node:fs";
import { expect, test } from "vitest";

// The published package says which Node it needs (npm warns on an older one), the same major as the
// repository's .node-version. set-version.mjs rewrites only the version and prepack.mjs does not
// touch the manifest, so what is here is what npm gets.
test("the CLI package states the Node version the repository runs on", () => {
  const pkg = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));
  const major = readFileSync(new URL("../../../.node-version", import.meta.url), "utf8").trim();
  expect(pkg.engines?.node).toBe(`>=${major}`);
});
