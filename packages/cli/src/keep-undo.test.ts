import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, expect, test, vi } from "vitest";
import { ensureRepository } from "./git.js";
import { runOperation } from "./op.js";
import { captureIo } from "./test-io.js";
import { undo } from "./undo.js";

vi.mock("./generate.js", () => ({ generate: vi.fn(async () => 0) }));
const roots: string[] = [];
afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

const content = `smithableContent: 0.1
languages: [sv]
pages:
  home:
    hero:
      image: { src: images/hero.webp, alt: A roof, generated: true }
    jobs:
      items:
        - image: { src: images/jobs/a.webp, alt: A roof, generated: true }
          caption: The first roof
        - image: { src: images/jobs/b.webp, alt: B roof, generated: true }
          caption: The second roof
`;
const swedish = `smithableContent: 0.1
pages:
  home:
    jobs:
      items:
        - caption: Det första taket
        - caption: Det andra taket
`;

test("undo of a gallery picture's Remove brings back its caption, its translation and its keep (T1175)", async () => {
  const dir = mkdtempSync(join(tmpdir(), "smithable-keep-undo-"));
  roots.push(dir);
  writeFileSync(join(dir, ".gitignore"), "data/\n");
  writeFileSync(
    join(dir, "smithable.yml"),
    "smithable: 0.1\napp: { name: Roofs }\npages:\n  home:\n    route: /\n    landing:\n      hero: {}\n      jobs: { gallery:, pictures: work }\n",
  );
  writeFileSync(join(dir, "smithable.content.yml"), content);
  writeFileSync(join(dir, "smithable.content.sv.yml"), swedish);
  mkdirSync(join(dir, ".smithable"), { recursive: true });
  writeFileSync(join(dir, ".smithable/files.json"), '{"files":{}}\n');
  ensureRepository(dir);
  const flags = { yes: true, reportLater: true };
  const op = async (name: string, args: Record<string, unknown>) => {
    const io = captureIo();
    expect(await runOperation(dir, io, name, args, flags), io.stderr).toBe(0);
  };
  const read = (file: string) => readFileSync(join(dir, file), "utf8");
  await op("keepPicture", { page: "home", section: "jobs", item: 0, was: "images/jobs/a.webp" });
  const kept = read("smithable.content.yml");
  expect(kept).toContain("kept: true");
  await op("setSectionPicture", {
    page: "home",
    section: "jobs",
    item: 0,
    was: "images/jobs/a.webp",
  });
  expect(read("smithable.content.yml")).not.toContain("The first roof");
  expect(read("smithable.content.sv.yml")).not.toContain("Det första taket");
  expect(undo(dir, captureIo())).toBe(0);
  expect(read("smithable.content.yml")).toBe(kept);
  expect(read("smithable.content.sv.yml")).toBe(swedish);
  expect(undo(dir, captureIo())).toBe(0);
  expect(read("smithable.content.yml")).toBe(content);
});
