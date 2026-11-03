import { mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, expect, test } from "vitest";
import { lookContext } from "./look-context.js";

const roots: string[] = [];
afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});
const spec = `smithable: 0.1
app: {name: Tasks}
models:
  Task: {fields: {title: string!}}
pages:
  tasks: {crud: Task}
  archive: {crud: Task}
`;
function fixture() {
  const dir = mkdtempSync(join(tmpdir(), "smithable-look-context-"));
  roots.push(dir);
  writeFileSync(join(dir, "smithable.yml"), spec);
  writeFileSync(join(dir, "smithable.auth.yml"), "smithableAuth: 0.1\nsignIn: none\n");
  return dir;
}
test("opens the actual known page/state with a full manifest and no write or guessed id", () => {
  const dir = fixture();
  const before = readdirSync(dir);
  const context = lookContext(dir, "http://localhost:18501", "project-one", "/archive/47");
  expect(context.projectId).toBe("project-one");
  expect(context.look.page).toBe("archive");
  expect(context.open).toBe("archive:record");
  expect(context.frames.find((f) => f.id === context.open)?.path).toBe("/archive/47");
  expect(context.frames.find((f) => f.id === "tasks:record")?.path).toBeUndefined();
  expect(readFileSync(join(dir, "smithable.yml"), "utf8")).toBe(spec);
  expect(readdirSync(dir)).toEqual(before);
});
test("a removed page disappears on the next read and invalid/external contexts refuse", () => {
  const dir = fixture();
  writeFileSync(join(dir, "smithable.yml"), spec.replace("  archive: {crud: Task}\n", ""));
  const context = lookContext(dir, "http://localhost:18501", "project-one", "/archive/47");
  expect(context.frames.some((f) => f.page === "archive")).toBe(false);
  expect(context.notice).toMatch(/no longer available/);
  expect(() =>
    lookContext(dir, "http://localhost:18501", "project-one", "//other.test/app"),
  ).toThrow(/app-relative/);
  writeFileSync(join(dir, "smithable.yml"), "invalid: true\n");
  expect(() => lookContext(dir, "http://localhost:18501", "project-one")).toThrow(
    /validation errors/,
  );
});
