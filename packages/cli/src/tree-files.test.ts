import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "vitest";

/**
 * Every module of the CLI that writes files itself, and why that is not the project's tree done
 * as this process (tree-files.ts says why it must not be). A new one fails here until it is
 * placed: through changeTree, or here with its reason.
 */
const WRITES_ITSELF: Record<string, string> = {
  "advisories.ts": "its cache in the home folder",
  "anthropic.ts": "the usage log named by the environment",
  "ask.ts": "the loose-answer log and the model cache named by the environment",
  "backup.ts":
    "its own scratch folders and the --to folder; restore without --container is the command line's, on a project of the person's own",
  "bedrock.ts": "its own scratch folder (wx) and the usage log",
  "card.ts": "the --out file",
  "claude-code.ts": "removes its own scratch folder",
  "code.ts":
    "the command line's coder and teach (refused where no project code loads): dist and .git's hooks and config of a project of the person's own",
  "customize.ts": "the command line's customize, on a project of the person's own",
  "database.ts": "inside asProject",
  "deploy.ts": "the command line's deploy, on a project of the person's own",
  "detach.ts": "the command line's detach, on a project of the person's own",
  "generation-job.ts": "beside the project, not in it",
  "import.ts": "inside asProject",
  "ink-wash-worker.ts": "the prepared offer in Studio's private scratch folder",
  "managed.ts": "its own scratch folder (wx)",
  "new.ts": "a new folder, or the folder beside the project a replacement is made in",
  "old-version.ts":
    "the old version's worktree in the CLI's cache; its record goes through changeTree",
  "picture-style.ts": "inside asProject",
  "pictures.ts": "the picture cache, and a new app's pictures (from new.ts)",
  "pitr.ts": "its own scratch folders (wx); --yes writes the app's database, command line only",
  "preview-editor.ts":
    "the theme lab's and the frame's own files; the preview's config goes through changeTree",
  "project-mutation.ts": "its lock folder, private under the temp folder",
  "release-review.ts":
    "the command line's deploy and Studio's release review: data/.smithable/release-review, wx and checked links (left for a later step)",
  "replace.ts":
    "the folder beside the project, and syncHere inside asProject; touches src/db/index.ts's time",
  "report.ts": "the reports list in the home folder; the last failure goes through changeTree",
  "rules.ts": "the rule baseline goes through changeTree; nothing else",
  "sample-scenario.ts": "a path its caller gives (wx)",
  "secrets.ts": "its own scratch folders",
  "security.ts":
    "the command line's security and deploy, in data/.smithable/reports of a project of the person's own",
  "static.ts": "--out, or data/static of a project of the person's own (command line only)",
  "studio-ink-wash.ts": "cleans up its private scratch folder outside the project",
  "studio.ts": "the notice goes through changeTree; removes nothing else in the tree",
  "teach.ts": "refused where no project code loads",
  "test-dir.ts": "the tests' folders",
  "theme-fonts.ts": "a folder its caller gives",
  "theme-lab.ts": "its own scratch app, or --app's preview config (a local command)",
  "tool-steps.ts": "the app's tools: in the project worker where no project code loads here",
  "tree-files.ts": "the child's side of changeTree",
  "undo.ts": "its own scratch folder (wx)",
  "upgrade.ts": "the command line's upgrade, on a project of the person's own",
  "validate.ts": "the command line's validate --write",
  "verify.ts": "--out; the kept result goes through changeTree; test runs are the command line's",
  "website-assets.ts":
    "a new app's assets (from new.ts) and review-assets --approve, wx and checked links",
  "website-generation.ts": "a new app's site (from new.ts)",
  "website-input.ts": "the inputs folder beside the project, owner, mode and links checked",
  "context.ts": "the token log goes through changeTree",
  "fix-open.ts": "the kept record goes through changeTree",
};

const WRITE =
  /^(writeFileSync|appendFileSync|mkdirSync|rmSync|unlinkSync|cpSync|copyFileSync|renameSync|symlinkSync|linkSync|utimesSync|truncateSync|ftruncateSync|openSync|writeSync|writevSync|createWriteStream|writeFile|appendFile|rm|mkdir|cp|copyFile|rename|unlink|symlink|link|truncate|open)$/;

/**
 * Whether a module's own code may write files: it imports a writing function of node:fs (by its
 * name, also under another one), or the whole module (`* as fs`, a default import, `import()`),
 * whose every function it may call. A child's code in a string (`require("fs")` sent to a
 * container) is not this process's.
 */
function writesFiles(text: string): boolean {
  const fs = String.raw`"(?:node:)?fs(?:\/promises)?"`;
  if (new RegExp(String.raw`\bimport\s*\(\s*${fs}`).test(text)) return true;
  for (const m of text.matchAll(
    new RegExp(String.raw`^import\s+(?!type\b)([^;]*?)\s+from\s*${fs}`, "gm"),
  )) {
    const clause = m[1] ?? "";
    const named = /\{([^}]*)\}/.exec(clause);
    if (
      clause
        .replace(/\{[^}]*\}/, "")
        .replace(/,/g, "")
        .trim()
    )
      return true;
    const names = (named?.[1] ?? "").split(",").map((n) => n.trim());
    if (names.some((n) => !n.startsWith("type ") && WRITE.test(n.split(/\s+as\s+/)[0] ?? "")))
      return true;
  }
  return false;
}

test("every module that writes files itself is placed, with its reason", () => {
  const here = new URL(".", import.meta.url).pathname;
  const writers = readdirSync(here)
    .filter((f) => f.endsWith(".ts") && !f.endsWith(".test.ts"))
    .filter((f) => writesFiles(readFileSync(join(here, f), "utf8")));
  expect(writers.sort()).toEqual(Object.keys(WRITES_ITSELF).sort());
});

test("a module that writes is found however it imports node:fs", () => {
  for (const text of [
    'import { writeFileSync } from "node:fs";',
    'import { readFileSync, writeFileSync as put } from "node:fs";',
    'import * as fs from "node:fs";',
    'import fs from "fs";',
    'import fs, { readFileSync } from "node:fs";',
    'import { open } from "node:fs/promises";',
    'import {\n  openSync,\n  readSync,\n} from "node:fs";',
    'const fs = await import("node:fs");',
  ])
    expect(writesFiles(text), text).toBe(true);
  for (const text of [
    'import { readFileSync, statSync } from "node:fs";',
    'import type { Stats } from "node:fs";',
    'import { type WriteStream, readFileSync } from "node:fs";',
    'const code = `const fs=require("fs");fs.rmSync("/data/x")`;',
  ])
    expect(writesFiles(text), text).toBe(false);
});

test("a fresh file is written only where none is, and never over one that is there", async () => {
  const { mkdtempSync, rmSync, writeFileSync } = await import("node:fs");
  const { tmpdir } = await import("node:os");
  const { changeTree } = await import("./tree-files.js");
  const dir = mkdtempSync(join(tmpdir(), "fresh-"));
  changeTree([{ path: join(dir, "images", "new.webp"), data: "one", fresh: true }]);
  expect(readFileSync(join(dir, "images", "new.webp"), "utf8")).toBe("one");
  writeFileSync(join(dir, "images", "there.webp"), "theirs");
  expect(() =>
    changeTree([{ path: join(dir, "images", "there.webp"), data: "mine", fresh: true }]),
  ).toThrow();
  expect(readFileSync(join(dir, "images", "there.webp"), "utf8")).toBe("theirs");
  rmSync(dir, { recursive: true, force: true });
});
