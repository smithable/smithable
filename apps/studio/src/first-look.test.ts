import { describe, expect, test } from "vitest";
import { LookSession, ThemePreview } from "./first-look";

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

test("picture commit waits for the last theme and receives its exact revision", async () => {
  let release!: () => void;
  const waiting = new Promise<void>((done) => {
    release = done;
  });
  const order: string[] = [];
  const picker = new ThemePreview(
    { preset: "simple", revision: "opening" },
    {
      async apply() {
        await waiting;
        order.push("theme");
        return { ok: true, output: "Theme", change: "theme-commit", revision: "after-theme" };
      },
      async undo() {
        return { ok: true, output: "Undone", revision: "undone" };
      },
    },
  );
  const choice = picker.choose("forest");
  const keep = picker.finish(true, async (revision) => {
    order.push(`pictures:${revision}`);
    return { ok: true, output: "Pictures" };
  });
  release();
  await Promise.all([choice, keep]);
  expect(order).toEqual(["theme", "pictures:after-theme"]);
});

test("a failed picture fetch can be followed by Skip of the picker theme alone", async () => {
  const f = fixture();
  await f.picker.choose("paper");
  await expect(
    f.picker.finish(true, async () => ({ ok: false, output: "Offline" })),
  ).rejects.toThrow("Offline");
  await f.picker.finish(false);
  expect(f.current()).toBe("simple");
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
