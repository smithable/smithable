import { expect, test } from "vitest";
import { pairwise, VISUAL_DIMENSIONS } from "./test-pairwise.js";

test("deterministic pairwise selection covers every declared value pair in a bounded browser set", () => {
  const rows = pairwise(VISUAL_DIMENSIONS),
    keys = Object.keys(VISUAL_DIMENSIONS) as (keyof typeof VISUAL_DIMENSIONS)[];
  expect(rows).toEqual(pairwise(VISUAL_DIMENSIONS));
  expect(rows.length).toBeLessThan(40);
  for (const [index, key] of keys.entries())
    for (const other of keys.slice(index + 1))
      for (const value of VISUAL_DIMENSIONS[key])
        for (const second of VISUAL_DIMENSIONS[other])
          expect(
            rows.some((row) => row[key] === value && row[other] === second),
            `${key}=${value},${other}=${second}`,
          ).toBe(true);
});
test("mandatory risky combinations stay in the matrix, and impossible declarations refuse", () => {
  const risk = {
    viewport: "320",
    appearance: "dark",
    type: "condensed-upper",
    surface: "glass",
    media: "portrait-edge",
    composition: "record-inline-summary",
    motion: "reduced",
    copy: "swedish-long",
    zoom: "200",
  };
  expect(pairwise(VISUAL_DIMENSIONS, [risk])[0]).toEqual(risk);
  expect(() => pairwise(VISUAL_DIMENSIONS, [{ ...risk, viewport: "17" }])).toThrow(/outside/);
});
