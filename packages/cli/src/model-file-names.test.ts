// A model named like one of the app's own files (T1236): a model Card once wrote the same
// src/generated/card.ts as the app card, the record of written files named the other one, and
// the third change after it was refused as an edit by hand.

import { join } from "node:path";
import { expect, test } from "vitest";
import { run } from "./cli.js";
import { hashFile, readRecord } from "./generate.js";
import { tempDir } from "./test-dir.js";
import { captureIo } from "./test-io.js";

const smithable = async (args: string[]) => {
  const io = captureIo();
  expect(await run(args, io), `${args.join(" ")}\n${io.stderr}`).toBe(0);
  return io;
};

test("a model named Card, then two more changes, all go through", async () => {
  const dir = join(tempDir("smithable-model-card-"), "app");
  await smithable(["new", dir, "--starter", "records"]);
  await smithable(["op", "addModel", "Card", "title=string!", "--dir", dir]);
  await smithable([
    "op",
    "setPublic",
    "--pages",
    "home,items",
    "--read",
    "Item,Card",
    "--dir",
    dir,
  ]);
  await smithable(["op", "setText", "Hello", "pages", "home", "hero", "title", "--dir", dir]);
  // Every file the record names is the file on disk.
  for (const [path, hash] of Object.entries(readRecord(dir).files))
    expect(hashFile(join(dir, path)), path).toBe(hash);
}, 120_000);

test("a model named like a file the app itself writes is refused, and nothing changes", async () => {
  const dir = join(tempDir("smithable-model-site-"), "app");
  await smithable(["new", dir, "--starter", "records"]);
  const io = captureIo();
  expect(await run(["op", "addModel", "Site", "title=string!", "--dir", dir], io)).not.toBe(0);
  expect(io.stderr + io.stdout).toContain(
    "The model Site would write src/generated/site.ts, which the app itself uses: give the model another name.",
  );
  await smithable(["op", "setText", "Hello", "pages", "home", "hero", "title", "--dir", dir]);
}, 120_000);
