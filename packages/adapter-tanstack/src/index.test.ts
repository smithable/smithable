import { expect, test } from "vitest";
import { adapter } from "./index.js";

test("identifies itself and the manifest version it targets", () => {
  expect(adapter).toEqual({ name: "tanstack", manifestVersion: "0.1" });
});
