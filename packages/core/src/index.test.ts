import { expect, test } from "vitest";
import { MANIFEST_VERSION } from "./index.js";

test("exposes the manifest version", () => {
  expect(MANIFEST_VERSION).toBe("0.1");
});
