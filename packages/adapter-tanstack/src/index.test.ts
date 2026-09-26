import { expect, test } from "vitest";
import { adapter } from "./index.js";

test("identifies itself and the spec version it targets", () => {
  expect(adapter).toEqual({ name: "tanstack", specVersion: "0.1" });
});
