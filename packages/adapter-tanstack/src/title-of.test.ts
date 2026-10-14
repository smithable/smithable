import { expect, test } from "vitest";

// The kit's format.ts, as the generated apps get it (a path the build does not follow).
const path: string = "../templates/src/kit/format.ts";
const { titleOf } = (await import(path)) as { titleOf(value: unknown): string };

test("a title is its first line, at most sixty characters; a short one stays as it is", () => {
  expect(titleOf("Nordic Timber Oy")).toBe("Nordic Timber Oy");
  expect(titleOf("\n## The checkout fails\nSince this morning.")).toBe("The checkout fails");
  const long = "The payment page shows an error after the card is entered, every single time";
  expect(titleOf(long).length).toBeLessThanOrEqual(60);
  expect(titleOf(long).endsWith("…")).toBe(true);
  expect(titleOf(12)).toBe("12");
});
