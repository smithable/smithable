import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test, vi } from "vitest";
import { create } from "./new.js";
import { replaceProject } from "./replace.js";
import { tempDir } from "./test-dir.js";

vi.mock("./new.js", async (original) => ({
  ...(await original<typeof import("./new.js")>()),
  create: vi.fn(async (_dir, io) => {
    io.err("The model could not make an app.");
    return 1;
  }),
}));

test("a durable failed draft keeps the waiting project and never falls back to a starter", async () => {
  const dir = tempDir("smithable-durable-replace-");
  mkdirSync(join(dir, "node_modules"));
  writeFileSync(join(dir, "smithable.yml"), "The waiting app");
  const beforeArrival = vi.fn();
  const said: string[] = [];
  expect(
    await replaceProject(
      dir,
      { out: () => {}, err: (text) => said.push(text) },
      { describe: "Observed business facts" },
      () => {},
      { beforeArrival },
    ),
  ).toBe(1);
  expect(create).toHaveBeenCalledTimes(1);
  expect(vi.mocked(create).mock.calls[0]?.[3]).toMatchObject({
    unattended: true,
    sampleData: false,
    pictureData: false,
  });
  expect(beforeArrival).not.toHaveBeenCalled();
  expect(readFileSync(join(dir, "smithable.yml"), "utf8")).toBe("The waiting app");
  expect(existsSync(`${dir}.incoming`)).toBe(false);
  expect(said.join("")).toContain("could not make an app");
});
