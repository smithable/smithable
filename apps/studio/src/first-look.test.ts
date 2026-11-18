import { describe, expect, test } from "vitest";
import { ThemePreview } from "./first-look";

function fixture() {
  let revision = "opening";
  let preset = "simple";
  let counter = 0;
  const calls: string[] = [];
  const picker = new ThemePreview(
    { preset, revision },
    {
      async apply(next, expected) {
        calls.push(`apply:${next}`);
        if (expected !== revision) return { ok: false, output: "Another change came between." };
        preset = next;
        revision = `change${++counter}`;
        return { ok: true, output: "Applied", change: revision, revision };
      },
      async undo(change, expected) {
        calls.push(`undo:${change}`);
        if (expected !== revision || change !== revision)
          return { ok: false, output: "Another change came between." };
        preset = "simple";
        revision = `undo${++counter}`;
        return { ok: true, output: "Undone", revision };
      },
    },
  );
  return { picker, calls, current: () => preset, external: () => (revision = "someone-else") };
}

describe("first look's own changes", () => {
  test("rapid choices are serialized and the previous choice is undone first", async () => {
    const f = fixture();
    await Promise.all([f.picker.choose("paper"), f.picker.choose("forest")]);
    expect(f.calls).toEqual(["apply:paper", "undo:change1", "apply:forest"]);
    await f.picker.finish(false);
    expect(f.current()).toBe("simple");
    expect(f.calls.at(-1)).toBe("undo:change3");
  });
  test("keep waits for queued choices and leaves the chosen theme", async () => {
    const f = fixture();
    const choose = f.picker.choose("paper");
    await f.picker.finish(true);
    await choose;
    await f.picker.choose("forest");
    expect(f.current()).toBe("paper");
    expect(f.calls).toEqual(["apply:paper"]);
  });
  test("returning to the opening card removes the picker change without another operation", async () => {
    const f = fixture();
    await f.picker.choose("paper");
    await f.picker.choose("simple");
    await f.picker.finish(false);
    expect(f.calls).toEqual(["apply:paper", "undo:change1"]);
  });
  test("skip without a choice never invokes undo", async () => {
    const f = fixture();
    f.external();
    await f.picker.finish(false);
    expect(f.calls).toEqual([]);
  });
  test("an intervening change refuses skip, preserving the other writer's work", async () => {
    const f = fixture();
    await f.picker.choose("paper");
    f.external();
    await expect(f.picker.finish(false)).rejects.toThrow("Another change");
    expect(f.current()).toBe("paper");
    expect(f.calls).toEqual(["apply:paper", "undo:change1"]);
  });
  test("an intervening change refuses a second choice before applying anything new", async () => {
    const f = fixture();
    await f.picker.choose("paper");
    f.external();
    await expect(f.picker.choose("forest")).rejects.toThrow("Another change");
    await expect(f.picker.choose("other")).rejects.toThrow("Another change");
    expect(f.calls).toEqual(["apply:paper", "undo:change1"]);
  });
});
