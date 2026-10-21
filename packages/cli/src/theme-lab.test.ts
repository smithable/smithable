import { validateSpec } from "@smithable/core";
import { expect, test } from "vitest";
import type { Io } from "./io.js";
import { STARTERS } from "./starters.gen.js";
import { labFrames, themeLab } from "./theme-lab.js";

test("the lab frames the landing page, then the first list, its form and a record", () => {
  const page = (route: string, kind: string) => ({ route, pattern: { kind } });
  expect(
    labFrames([
      page("/dashboard", "dashboard"),
      page("/", "landing"),
      page("/class-types", "crud"),
    ]),
  ).toEqual([
    { label: "Landing", path: "/" },
    { label: "List", path: "/class-types" },
    { label: "Form", path: "/class-types/new" },
    { label: "Record", path: "/class-types/1" },
  ]);
  expect(labFrames([page("/companies", "crud")])[0]).toEqual({ label: "Landing", path: "/" });
  expect(labFrames([page("/team", "users"), page("/admin", "data")])).toEqual([
    { label: "Landing", path: "/" },
    { label: "List", path: "/admin" },
  ]);
});

test("a starter the lab does not know is refused, naming the ones it has", async () => {
  const said: string[] = [];
  const io = { out: (t: string) => said.push(t), err: (t: string) => said.push(t) };
  expect(await themeLab(io as Io, 4390, { starter: "bakery" })).toBe(2);
  expect(said.join("")).toMatch(/There is no starter "bakery": .*booking.*crm/);
});

test("every starter gives the lab its front page and a list (api: its data page)", () => {
  for (const name of Object.keys(STARTERS)) {
    const { ir } = validateSpec({
      path: "smithable.yml",
      text: STARTERS[name]?.["smithable.yml"] ?? "",
    });
    expect(ir, name).toBeDefined();
    const labels = labFrames(ir?.pages ?? []).map((f) => f.label);
    expect(labels.slice(0, 2), name).toEqual(["Landing", "List"]);
  }
});
