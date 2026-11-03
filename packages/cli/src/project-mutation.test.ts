import { spawn } from "node:child_process";
import { mkdtempSync, readdirSync, rmSync, symlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, test } from "vitest";
import { withProjectMutation } from "./project-mutation.js";

const deferred = () => {
  let resolve!: () => void;
  return {
    promise: new Promise<void>((done) => {
      resolve = done;
    }),
    resolve: () => resolve(),
  };
};

test("same-process writers queue without blocking the event loop; aliases share the lock", async () => {
  const root = mkdtempSync(join(tmpdir(), "smithable-mutex-"));
  const alias = `${root}-alias`;
  try {
    symlinkSync(root, alias);
    const entered = deferred();
    const release = deferred();
    const order: string[] = [];
    const first = withProjectMutation(root, async () => {
      order.push("first");
      entered.resolve();
      await release.promise;
      order.push("released");
    });
    await entered.promise;
    const second = withProjectMutation(alias, async () => {
      order.push("second");
    });
    await Promise.resolve();
    expect(order).toEqual(["first"]);
    release.resolve();
    await Promise.all([first, second]);
    expect(order).toEqual(["first", "released", "second"]);
    expect(readdirSync(root)).toEqual([]);
  } finally {
    rmSync(alias, { force: true });
    rmSync(root, { recursive: true, force: true });
  }
});

test("OS coordination locks release after a crashed process, without stale-lock deletion", async () => {
  const root = mkdtempSync(join(tmpdir(), "smithable-mutex-crash-"));
  const module = new URL("../dist/project-mutation.js", import.meta.url).href;
  const child = spawn(
    process.execPath,
    [
      "--input-type=module",
      "-e",
      `import {withProjectMutation} from ${JSON.stringify(module)}; await withProjectMutation(${JSON.stringify(root)}, async () => { process.stdin.resume(); process.stdout.write('locked\\n'); await new Promise(() => {}); });`,
    ],
    { stdio: ["pipe", "pipe", "pipe"] },
  );
  try {
    await new Promise<void>((done, fail) => {
      child.stdout.once("data", () => done());
      child.once("exit", (code) => fail(new Error(`lock holder exited ${code}`)));
    });
    const exited = new Promise((done) => child.once("exit", done));
    child.kill("SIGKILL");
    await exited;
    expect(await withProjectMutation(root, async () => "recovered")).toBe("recovered");
    expect(readdirSync(root)).toEqual([]);
  } finally {
    child.kill();
    rmSync(root, { recursive: true, force: true });
  }
});
