// What Studio shows and a report sends from the tree is read as the project's own file where a
// project user is set (secrets.ts readTree): a link planted at each site shows nothing.
import { mkdirSync, symlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, expect, test } from "vitest";
import { specFilesOf } from "./report.js";
import { forgetProjectUserForTests } from "./secrets.js";
import { projectImage, projectPlugin } from "./studio.js";
import { tempDir } from "./test-dir.js";
import { loadSpec, projectTranslations } from "./validate.js";

const linux = process.platform === "linux";
let dir: string;
let secret: string;
beforeEach(() => {
  dir = tempDir("served-");
  secret = join(tempDir("served-mine-"), "secret");
  writeFileSync(secret, "this process's own");
  process.env.SMITHABLE_PROJECT_UID = String(process.getuid?.());
  process.env.SMITHABLE_PROJECT_GID = String(process.getgid?.());
  forgetProjectUserForTests();
});
afterEach(() => {
  delete process.env.SMITHABLE_PROJECT_UID;
  delete process.env.SMITHABLE_PROJECT_GID;
  forgetProjectUserForTests();
});

test.runIf(linux)("a picture: its own file is served, a link in its place is not", () => {
  mkdirSync(join(dir, "public", "images"), { recursive: true });
  writeFileSync(join(dir, "public", "images", "logo.png"), "png");
  symlinkSync(secret, join(dir, "public", "images", "planted.png"));
  expect(projectImage(dir, "logo.png")?.toString()).toBe("png");
  expect(projectImage(dir, "planted.png")).toBeUndefined();
});

test.runIf(linux)(
  "a declared plugin's code: its own file is served, a link in its place is not",
  () => {
    writeFileSync(join(dir, "smithable.context.yml"), "plugins: [own, planted]\n");
    for (const name of ["own", "planted"])
      mkdirSync(join(dir, "smithable", "plugins", name), { recursive: true });
    writeFileSync(join(dir, "smithable", "plugins", "own", "plugin.mjs"), "export default {};");
    symlinkSync(secret, join(dir, "smithable", "plugins", "planted", "plugin.mjs"));
    expect(projectPlugin(dir, "own")?.toString()).toBe("export default {};");
    expect(projectPlugin(dir, "planted")).toBeUndefined();
  },
);

test.runIf(linux)("a translation shown in Studio is never read through a link", () => {
  writeFileSync(join(dir, "smithable.content.en.yml"), "smithableContent: 0.1\n");
  expect(projectTranslations(dir)).toEqual({ en: "smithableContent: 0.1\n" });
  symlinkSync(secret, join(dir, "smithable.content.sv.yml"));
  expect(() => projectTranslations(dir)).toThrow();
});

test.runIf(linux)("a report's files leave out one that is a link", () => {
  writeFileSync(join(dir, "smithable.yml"), "smithable: 0.1\n");
  symlinkSync(secret, join(dir, "smithable.ux.yml"));
  mkdirSync(join(dir, "themes"));
  symlinkSync(secret, join(dir, "themes", "planted.yml"));
  expect(specFilesOf(dir)).toEqual({ "smithable.yml": "smithable: 0.1\n" });
});

test.runIf(linux)("a report holds at most four megabytes of files", () => {
  writeFileSync(join(dir, "smithable.yml"), "smithable: 0.1\n");
  mkdirSync(join(dir, "themes"));
  for (const n of [1, 2, 3, 4, 5])
    writeFileSync(join(dir, "themes", `t${n}.yml`), "a: 1\n".repeat((1 << 20) / 5));
  writeFileSync(join(dir, "themes", "big.yml"), "a: 1\n".repeat((1 << 20) / 5 + 1));
  const files = specFilesOf(dir);
  expect(files["themes/big.yml"]).toBeUndefined();
  expect(Object.keys(files).filter((f) => f.startsWith("themes/"))).toHaveLength(3);
});

test.runIf(linux)("the spec Studio's page shows is never read through a link", () => {
  writeFileSync(secret, "smithable: 0.1\napp: { name: Mine }\n");
  symlinkSync(secret, join(dir, "smithable.yml"));
  const io = { out: () => {}, err: () => {} };
  expect(() => loadSpec(dir, io as never).ir).not.toThrow();
  expect(loadSpec(dir, io as never).ir).toBeUndefined();
});
