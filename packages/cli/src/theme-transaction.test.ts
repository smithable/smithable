import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, test } from "vitest";
import { ensureRepository, git } from "./git.js";
import { themeTransaction } from "./theme-transaction.js";

test("the actual array-format compiler manifest identifies owned output; unrelated editor files stay outside staging", () => {
  const dir = mkdtempSync(join(tmpdir(), "smithable-theme-owned-"));
  try {
    mkdirSync(join(dir, "src"));
    mkdirSync(join(dir, ".smithable"));
    writeFileSync(join(dir, "src/theme.css"), "old theme");
    writeFileSync(join(dir, "notes.txt"), "old notes");
    writeFileSync(
      join(dir, ".smithable/files.json"),
      JSON.stringify({ files: [{ path: "src/theme.css", sha256: "old" }] }),
    );
    ensureRepository(dir);
    const guard = themeTransaction(dir, ["themes/new.yml"]);
    writeFileSync(join(dir, "src/theme.css"), "new generated theme");
    expect(guard.externalChange()).toBe(false);
    mkdirSync(join(dir, "themes"));
    writeFileSync(join(dir, "themes/new.yml"), "new theme");
    writeFileSync(join(dir, "editor.txt"), "new editor data");
    expect(guard.externalChange()).toBe(true);
    expect(guard.stage()).toBe(true);
    expect(git(dir, ["diff", "--cached", "--name-only"]).out.split("\n")).toEqual([
      "src/theme.css",
      "themes/new.yml",
    ]);
    expect(readFileSync(join(dir, "editor.txt"), "utf8")).toBe("new editor data");
    writeFileSync(join(dir, "notes.txt"), "newer notes");
    expect(guard.externalChange()).toBe(true);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
