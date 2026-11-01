import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
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

test("an operation refused because its result would not validate says why, and offers no report", async () => {
  const dir = mkdtempSync(join(tmpdir(), "smithable-op-refused-"));
  try {
    writeFileSync(
      join(dir, "smithable.yml"),
      "smithable: 0.1\napp: { name: Shop }\nmodels:\n  Item: { fields: { name: string! } }\npages:\n  items: { crud: Item }\n",
    );
    const io = captureIo();
    const code = await op(dir, io, "editSpec", ["--text", "smithable: 0.1\nmodels: nope\n"], {
      yes: false,
    });
    expect(code).toBe(1);
    expect(io.stderr).toContain("editSpec would make smithable.yml invalid.");
    expect(io.stderr).not.toContain("smithable report");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
