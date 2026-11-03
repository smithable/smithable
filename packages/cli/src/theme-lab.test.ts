import { validateSpec } from "@smithable/core";
import { expect, test } from "vitest";
import type { Io } from "./io.js";
import { STARTERS } from "./starters.gen.js";
import { labFrames, themeLab } from "./theme-lab.js";

test("every real page and instance is inventoried; no invented root or record id", () => {
  const { ir } = validateSpec({
    path: "smithable.yml",
    text: `smithable: 0.1
app: { name: Inventory }
models:
  Task: { fields: { title: string! } }
pages:
  tasks: { crud: Task }
  archive: { crud: Task }
  team: { users: manage }
`,
  });
  if (!ir) throw new Error("invalid fixture");
  const frames = labFrames(ir.pages, { tasks: "Work queue" });
  expect(frames.map((f) => f.label)).toEqual([
    "Work queue",
    "Work queue · New",
    "Work queue · Record",
    "Archive",
    "Archive · New",
    "Archive · Record",
    "Team",
  ]);
  expect(frames.filter((f) => f.kind === "record").every((f) => !f.path && !!f.discoverFrom)).toBe(
    true,
  );
  expect(new Set(frames.map((f) => f.id)).size).toBe(frames.length);
});

test("a starter the lab does not know is refused, naming the ones it has", async () => {
  const said: string[] = [];
  const io = { out: (t: string) => said.push(t), err: (t: string) => said.push(t) };
  expect(await themeLab(io as Io, 4390, { starter: "bakery" })).toBe(2);
  expect(said.join("")).toMatch(/There is no starter "bakery": .*booking.*crm/);
});

test("every starter page has a preview, including non-list page patterns", () => {
  for (const name of Object.keys(STARTERS)) {
    const { ir } = validateSpec({
      path: "smithable.yml",
      text: STARTERS[name]?.["smithable.yml"] ?? "",
    });
    if (!ir) throw new Error(`invalid starter ${name}`);
    const frames = labFrames(ir.pages);
    expect(frames.filter((f) => f.id === `${f.page}:page`).map((f) => f.page)).toEqual(
      ir.pages.map((p) => p.id),
    );
    expect(frames.some((f) => f.path?.endsWith("/1"))).toBe(false);
  }
});
