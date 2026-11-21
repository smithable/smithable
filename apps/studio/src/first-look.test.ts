import { describe, expect, test } from "vitest";
import { keepLook, LookSession } from "./first-look";

describe("keep in the first-look picker", () => {
  test("each step runs on the revision the one before left", async () => {
    const seen: string[] = [];
    await keepLook("opening", [
      async (revision) => {
        seen.push(`pictures:${revision}`);
        return { ok: true, output: "Pictures", change: "c1", revision: "after-pictures" };
      },
      async (revision) => {
        seen.push(`theme:${revision}`);
        return { ok: true, output: "Theme", change: "c2", revision: "after-theme" };
      },
    ]);
    expect(seen).toEqual(["pictures:opening", "theme:after-pictures"]);
  });
  test("a refused step stops the rest", async () => {
    const seen: string[] = [];
    await expect(
      keepLook("opening", [
        async () => ({ ok: false, output: "Offline" }),
        async () => {
          seen.push("theme");
          return { ok: true, output: "Theme" };
        },
      ]),
    ).rejects.toThrow("Offline");
    expect(seen).toEqual([]);
  });
  test("nothing chosen makes no change", async () => {
    await expect(keepLook("opening", [])).resolves.toBeUndefined();
  });
});

describe("the Look panel's own changes", () => {
  function panel() {
    let revision = "opening";
    let counter = 0;
    const calls: string[] = [];
    const applied: string[] = [];
    const session = new LookSession(
      { values: { preset: "simple", font: "" }, revision },
      async (change, expected) => {
        calls.push(`undo:${change}`);
        if (expected !== revision || change !== applied.at(-1))
          return { ok: false, output: "Another change came between." };
        applied.pop();
        revision = `undo${++counter}`;
        return { ok: true, output: "Undone", revision };
      },
    );
    const set = (key: string, value: string) =>
      session.set(key, value, async (expected) => {
        calls.push(`${key}:${value}`);
        if (expected !== revision) return { ok: false, output: "Another change came between." };
        revision = `change${++counter}`;
        applied.push(revision);
        return { ok: true, output: "Applied", change: revision, revision };
      });
    return { session, set, calls, external: () => (revision = "someone-else") };
  }
  test("Cancel undoes each setting's change, newest first", async () => {
    const p = panel();
    await p.set("font", "Inter");
    await p.set("preset", "paper");
    await p.session.finish(false);
    expect(p.calls).toEqual(["font:Inter", "preset:paper", "undo:change2", "undo:change1"]);
    expect(p.session.changed).toBe(false);
  });
  test("choosing the latest setting again replaces its change; an earlier one stays", async () => {
    const p = panel();
    await p.set("font", "Inter");
    await p.set("font", "Lora");
    await p.set("preset", "paper");
    await p.set("font", "");
    expect(p.calls).toEqual(["font:Inter", "undo:change1", "font:Lora", "preset:paper", "font:"]);
  });
  test("a value read later counts as the opening value until it is changed", async () => {
    const p = panel();
    p.session.know("pictures", "photos");
    await p.set("pictures", "photos");
    expect(p.calls).toEqual([]);
    await p.set("pictures", "drawings");
    p.session.know("pictures", "photos");
    await p.set("pictures", "drawings");
    expect(p.calls).toEqual(["pictures:drawings"]);
  });
  test("Cancel refuses after another writer's change and undoes nothing more", async () => {
    const p = panel();
    await p.set("font", "Inter");
    p.external();
    await expect(p.session.finish(false)).rejects.toThrow("Another change");
    expect(p.session.changed).toBe(true);
  });
});
