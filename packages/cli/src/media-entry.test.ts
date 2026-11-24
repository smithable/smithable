// Who may name a stored file at the CLI's door (media-storage.md §2): a model never, and only the
// host gives its sizes; and a change that takes one out of its place says which place.
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, expect, test, vi } from "vitest";
import { ensureRepository } from "./git.js";
import { runOperation } from "./op.js";
import { captureIo } from "./test-io.js";

vi.mock("./generate.js", () => ({ generate: vi.fn(async () => 0) }));
const roots: string[] = [];
afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

const ID = "m_01hz8k3q4r5s6t7v8w9x0y1z2a";
const content = `smithableContent: 0.1
pages:
  home:
    hero:
      title: Roofs
      image: { asset: ${ID}, alt: A roof, width: 1600 }
`;

function project() {
  const dir = mkdtempSync(join(tmpdir(), "smithable-media-entry-"));
  roots.push(dir);
  writeFileSync(join(dir, ".gitignore"), "data/\n");
  writeFileSync(
    join(dir, "smithable.yml"),
    "smithable: 0.1\napp: { name: Roofs }\npages:\n  home:\n    route: /\n    landing:\n      hero: {}\n      faq:\n",
  );
  writeFileSync(join(dir, "smithable.content.yml"), content);
  mkdirSync(join(dir, ".smithable"), { recursive: true });
  writeFileSync(join(dir, ".smithable/files.json"), '{"files":{}}\n');
  ensureRepository(dir);
  return dir;
}

const hero = { page: "home", section: "hero" };

test("a model's call naming a stored file, or anyone's giving its sizes, is refused before anything", async () => {
  const dir = project();
  const run = async (name: string, args: Record<string, unknown>, from?: "model") => {
    const io = captureIo();
    const code = await runOperation(dir, io, name, args, { yes: true, reportLater: true, from });
    return { code, says: io.stderr };
  };
  const model = await run("setSectionPicture", { ...hero, asset: ID, alt: "A" }, "model");
  expect(model.code).toBe(2);
  expect(model.says).toContain('"asset" from a person\'s choice only');
  const batch = await run(
    "batch",
    { operations: [{ op: "setSectionPicture", args: { ...hero, asset: ID, alt: "A" } }] },
    "model",
  );
  expect(batch.code).toBe(2);
  const sizes = await run("setSectionPicture", {
    ...hero,
    asset: ID,
    alt: "A",
    rendition: { width: 960 },
  });
  expect(sizes.code).toBe(2);
  expect(sizes.says).toContain("from the host's own record only");
  expect(readFileSync(join(dir, "smithable.content.yml"), "utf8")).toBe(content);
});

test("removing a stored file asks first, naming its place and saying undo brings it back", async () => {
  const dir = project();
  const io = captureIo();
  expect(
    await runOperation(dir, io, "removeSection", hero, { yes: false, reportLater: true }),
  ).toBe(1);
  expect(io.stderr).toContain(
    "this takes the stored file out of the picture of hero on home; the photo library keeps it, and undo puts it back.",
  );
  expect(io.stderr).not.toContain("converts");
  expect(readFileSync(join(dir, "smithable.content.yml"), "utf8")).toBe(content);
});
