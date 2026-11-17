import assert from "node:assert/strict";
import { test } from "node:test";
import { commands, developmentSection } from "./development-commands.mjs";

test("finds pnpm scripts and script files inside code spans only", () => {
  const found = commands(
    "Run `pnpm test:apps:one <example>` and `SESSION=a scripts/gate.sh --queue`, then `node scripts/bench-m7.mjs [S]`; pnpm lint outside code is ignored.",
  );
  assert.deepEqual([...found].sort(), [
    "pnpm test:apps:one",
    "scripts/bench-m7.mjs",
    "scripts/gate.sh",
  ]);
});

test("takes the Development section up to the next heading", () => {
  const section = developmentSection(
    "# X\n\n## Development\n\n- `pnpm build`\n\n## Rules\n\n- `pnpm site`\n",
  );
  assert.deepEqual([...commands(section)], ["pnpm build"]);
});
