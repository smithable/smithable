import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "vitest";
import { arrival, replaceProject, stoppedLine, sync } from "./replace.js";
import { tempDir } from "./test-dir.js";

test("a replacement writes what differs by a rename over the file, and removes the rest", () => {
  const from = tempDir("smithable-from-");
  const dir = tempDir("smithable-dir-");
  mkdirSync(join(from, "public", "images"), { recursive: true });
  mkdirSync(join(dir, "public", "images"), { recursive: true });
  writeFileSync(join(from, "public", "images", "logo.webp"), "new mark");
  writeFileSync(join(dir, "public", "images", "logo.webp"), "old mark");
  writeFileSync(join(from, "public", "images", "hero.webp"), "same");
  writeFileSync(join(dir, "public", "images", "hero.webp"), "same");
  writeFileSync(join(dir, "public", "images", "gone.webp"), "not in the new app");
  // A folder where the new app has a file, and a file where the new app has a folder.
  mkdirSync(join(dir, "README.md"));
  writeFileSync(join(from, "README.md"), "a file now");
  writeFileSync(join(dir, "src"), "a file before");
  mkdirSync(join(from, "src", "custom"), { recursive: true });
  writeFileSync(join(from, "src", "custom", "x.ts"), "export {};");
  sync(from, dir);
  expect(readFileSync(join(dir, "public", "images", "logo.webp"), "utf8")).toBe("new mark");
  expect(readFileSync(join(dir, "public", "images", "hero.webp"), "utf8")).toBe("same");
  expect(existsSync(join(dir, "public", "images", "gone.webp"))).toBe(false);
  expect(readFileSync(join(dir, "README.md"), "utf8")).toBe("a file now");
  expect(readFileSync(join(dir, "src", "custom", "x.ts"), "utf8")).toBe("export {};");
  // Nothing half-written is left beside the files.
  expect(readdirSync(join(dir, "public", "images")).sort()).toEqual(["hero.webp", "logo.webp"]);
});

test("the route tree comes in after the route files it names", () => {
  expect(
    arrival([
      join("src", "routeTree.gen.ts"),
      join("src", "routes", "items", "index.tsx"),
      "smithable.yml",
      join("src", "routes", "__root.tsx"),
    ]),
  ).toEqual([
    join("src", "routes", "items", "index.tsx"),
    "smithable.yml",
    join("src", "routes", "__root.tsx"),
    join("src", "routeTree.gen.ts"),
  ]);
});

test("a time zone Intl does not know is refused before anything is touched", async () => {
  const said: string[] = [];
  const code = await replaceProject(
    tempDir("smithable-dir-"),
    { out: () => {}, err: (text) => said.push(text) },
    { from: "/nowhere", timezone: "Foo/Bar" },
  );
  expect(code).toBe(2);
  expect(said.join("")).toBe('Unknown time zone "Foo/Bar". Use a name like Europe/Mariehamn.\n');
});

test("where a description's making stopped is one fixed line, naming only the stage (T1759)", () => {
  // The hosted service names this line's stage and counts every other line: it must stay fixed.
  for (const stage of ["starting", "preparing", "drafting", "building"] as const)
    expect(stoppedLine(stage)).toBe(`The description's draft stopped while ${stage}.\n`);
});

test("a description that fails, and a starter that fails after it, still say the draft's lines and where it stopped (T1759)", async () => {
  const said: string[] = [];
  const code = await replaceProject(
    tempDir("smithable-dir-"),
    { out: () => {}, err: (text) => said.push(text) },
    { describe: "A small shop", starter: "nope" },
  );
  expect(code).toBe(2);
  const text = said.join("");
  // The starter's own line, then the draft's, then the stage line last, each a line of its own.
  const lines = text.trimEnd().split("\n");
  expect(lines.at(-1)).toBe(stoppedLine("starting").trimEnd());
  expect(lines.at(-2)).toMatch(/^Unknown starter "nope"\./);
  expect(lines.filter((l) => l.startsWith('Unknown starter "nope"'))).toHaveLength(2);
});
