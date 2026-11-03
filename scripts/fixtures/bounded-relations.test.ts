import { expect, test } from "vitest";
import { db } from "#/db";
import { counters, namedCounters, user } from "#/db/schema";
import { counterData } from "#/generated/counter.server";
import { namedCounterData } from "#/generated/named-counter.server";

test("numeric relation titles search and retain older selected ids", async () => {
  const viewer = {
    id: "selection-admin",
    name: "Admin",
    email: "admin@synthetic.example",
    role: "admin",
  };
  db.insert(user).values(viewer).run();
  for (let i = 0; i < 500; i += 100)
    db.insert(counters)
      .values(Array.from({ length: 100 }, (_, n) => ({ id: i + n + 1, enabled: i + n === 0 })))
      .run();
  db.insert(namedCounters)
    .values([
      { id: 1, counterId: 1, label: "Oldest composed" },
      { id: 2, counterId: 500, label: "Latest composed" },
    ])
    .run();
  const named = namedCounterData.pick(viewer, "Oldest");
  expect(named.map((row) => row.value)).toEqual(["1"]);
  expect(named[0].label).toContain("Oldest composed");
  expect(namedCounterData.pick(viewer, "", [2])[0].label).toContain("Latest composed");
  expect(() =>
    counterData.pick(
      viewer,
      "",
      Array.from({ length: 101 }, (_, i) => i + 1),
    ),
  ).toThrow("at most 100");
  expect(counterData.pickCount(viewer)).toBe(500);
  expect(counterData.pick(viewer, "499").map((row) => row.value)).toEqual(["499"]);
  expect(counterData.pick(viewer, "", [1, 500]).map((row) => row.value)).toEqual(["1", "500"]);
  expect(await counterData.candidateIds(viewer, (row) => row.enabled === true)).toEqual([1]);
});
