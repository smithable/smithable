import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, test } from "vitest";
import { actionNote, op } from "./op.js";
import { captureIo } from "./test-io.js";

test("a new custom action says where its code goes, with an example that sends mail", () => {
  const note = actionNote("contactSeller");
  expect(note).toContain("src/custom/actions/contact-seller.ts");
  expect(note).toContain('import { sendMail } from "#/kit/mail";');
});

test("`op` alone lists the operations and succeeds; an unknown name is a usage error", async () => {
  const dir = mkdtempSync(join(tmpdir(), "smithable-op-list-"));
  try {
    const listed = captureIo();
    expect(await op(dir, listed, undefined, [], { yes: false })).toBe(0);
    expect(listed.stdout).toContain("Available operations:");
    expect(listed.stdout).toContain("  addField ");
    const unknown = captureIo();
    expect(await op(dir, unknown, "frobnicate", [], { yes: false })).toBe(2);
    expect(unknown.stderr).toContain('Unknown operation "frobnicate". Available operations:');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
