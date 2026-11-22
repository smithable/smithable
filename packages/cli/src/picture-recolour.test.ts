import { expect, test } from "vitest";
import { INK_WASH_GREYSCALE_CUTOFF, inkWashRule } from "./picture-recolour.js";

test("Ink wash leaves the drawings at the greyscale cutoff and tints above it", () => {
  expect(INK_WASH_GREYSCALE_CUTOFF).toBe(0.02);
  expect(inkWashRule(0.019999)).toBe("none");
  expect(inkWashRule(0.02)).toBe("none");
  expect(inkWashRule(0.020001)).toBe("ink-wash-b90");
  expect(inkWashRule(0.12)).toBe("ink-wash-b90");
});
