import { expect, test } from "vitest";
import { STOPS } from "./guide";

// Every component's source, to find the places the guide's stops are beside.
const sources = import.meta.glob<string>("./**/*.tsx", {
  query: "?raw",
  import: "default",
  eager: true,
});

/** Every data-guide name the components carry, and a tab's guide name (["look", "Look", "look"]). */
const found = new Set(
  Object.values(sources).flatMap((source) => [
    ...[...source.matchAll(/data-guide="([a-z-]+)"/g)].map((m) => m[1] ?? ""),
    ...[...source.matchAll(/\["[a-z]+", "[A-Z][^"]*", "([a-z-]+)"\]/g)].map((m) => m[1] ?? ""),
  ]),
);

test("every stop of the guide has its place in Studio, and every place has a stop", () => {
  const stops = STOPS.map((s) => s.anchor);
  expect(stops.filter((a) => !found.has(a))).toEqual([]);
  expect([...found].filter((a) => !stops.includes(a))).toEqual([]);
  expect(stops).toEqual(["preview", "summary", "change", "look", "publish"]);
});
