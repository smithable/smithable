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
  /^(writeFileSync|appendFileSync|mkdirSync|rmSync|unlinkSync|cpSync|copyFileSync|renameSync|symlinkSync|utimesSync|createWriteStream|writeFile|appendFile|rm|mkdir|cp|rename|unlink)$/;

test("every module that writes files itself is placed, with its reason", () => {
  const here = new URL(".", import.meta.url).pathname;
  const writers = readdirSync(here)
    .filter((f) => f.endsWith(".ts") && !f.endsWith(".test.ts"))
    .filter((f) =>
      [
        ...readFileSync(join(here, f), "utf8").matchAll(
          /import\s*\{([^}]*)\}\s*from\s*"node:fs(?:\/promises)?"/g,
        ),
      ]
        .flatMap((m) => (m[1] ?? "").split(","))
        .some((name) => WRITE.test(name.trim())),
    );
  expect(writers.sort()).toEqual(Object.keys(WRITES_ITSELF).sort());
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
