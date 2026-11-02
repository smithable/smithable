// Real project history for the bounded extensions, only in the caller's owned disposable app.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { projectRevision } from "../packages/cli/dist/project-revision.js";
import { cli, op, run } from "./dev-app.mjs";
export function checkVisualHistory(dir) {
  assert(/^\/tmp\/smithable-codex-ui-ux-visual-[^/]+\/app$/u.test(dir));
  assert.equal(
    JSON.parse(readFileSync(join(dir, "visual-fixture.json"), "utf8")).owner,
    "codex-ui-ux",
  );
  run(["git", "init"], dir);
  // Checkpoint this synthetic setup so subsequent source edits have a stable history parent.
  run(["git", "add", "-A"], dir);
  run(
    [
      "git",
      "-c",
      "user.name=Visual fixture",
      "-c",
      "user.email=fixture@example.invalid",
      "commit",
      "--allow-empty",
      "-m",
      "test: checkpoint synthetic visual fixture\n\nSigned-off-by: Johan Ekenlycka <johan@smithable.ai>\nCo-Authored-By: Claude <noreply@anthropic.com>",
    ],
    dir,
  );
  const source = () => projectRevision(dir, false);
  const undoRedo = (before, after) => {
    run(["node", cli, "undo", "--dir", dir]);
    assert.equal(source(), before, "Undo did not restore source bytes");
    run(["node", cli, "redo", "--dir", dir]);
    assert.equal(source(), after, "Redo did not restore source bytes");
  };
  const before = source();
  op(dir, "addSection", "visual-editorial", "history-story", "--kind", "mediaText");
  const added = source();
  assert.notEqual(added, before);
  undoRedo(before, added);
  op(dir, "setText", "History caption", "pages", "visual-editorial", "history-story", "caption");
  const words = readFileSync(join(dir, "smithable.content.yml"), "utf8");
  const preMove = source();
  op(dir, "moveSection", "visual-editorial", "history-story", "--before", "story");
  const moved = source();
  assert.equal(readFileSync(join(dir, "smithable.content.yml"), "utf8"), words);
  undoRedo(preMove, moved);
  op(dir, "removeSection", "visual-editorial", "history-story");
  const removed = source();
  assert(!readFileSync(join(dir, "smithable.content.yml"), "utf8").includes("History caption"));
  undoRedo(moved, removed);
  const oldEmphasis = source();
  op(dir, "setRecordEmphasis", "visual-items", "amount", "estimate");
  const emphasis = source();
  assert.notEqual(emphasis, oldEmphasis);
  undoRedo(oldEmphasis, emphasis);
  console.log(
    "  ✓ real add/move/remove media section and named emphasis source-byte Undo/Redo; content retained through move",
  );
}
