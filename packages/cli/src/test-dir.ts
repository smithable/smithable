// For the tests: a temporary folder that goes when the test ends. Before this, the unit tests
// left about a thousand folders a day under /tmp (docs: backlog Fable 50, 2026-10-18).
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, onTestFinished } from "vitest";

/**
 * A new empty folder under the system's temporary folder, removed when the running test ends;
 * made outside a test (at a file's top), when the file's tests are done.
 */
export function tempDir(prefix = "smithable-"): string {
  const dir = mkdtempSync(join(tmpdir(), prefix));
  const remove = () => rmSync(dir, { recursive: true, force: true });
  try {
    onTestFinished(remove);
  } catch {
    afterAll(remove);
  }
  return dir;
}
