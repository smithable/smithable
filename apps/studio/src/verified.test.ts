import { setCheck, unverified } from "@smithable/core";
import { expect, test } from "vitest";
import { checkLines, nextDepth, verifiedLine } from "./verified";

const applied = () => {
  const v = unverified("base", { where: "studio", engine: "0.0.0" }, "change");
  v.revision = "a".repeat(40);
  for (const id of ["spec", "generate", "migrate"] as const) setCheck(v, id, "passed", "Fine.");
  setCheck(v, "data", "passed", "12 of 12 customers kept their values.");
  setCheck(v, "outside", "not-configured", "Nothing goes outside the app.");
  return v;
};

test("the one line: applied, data, then the deepest check not run, never a check not run as passed", () => {
  expect(verifiedLine(applied())).toBe("Change applied. Data preserved. Browser flow not tested.");
  const v = applied();
  setCheck(v, "data", "failed", "3 of 12 customers lost their phone");
  expect(verifiedLine(v)).toBe(
    "Change applied. Data not preserved: 3 of 12 customers lost their phone.",
  );
  const refused = unverified("base", { where: "studio", engine: "0.0.0" }, "change");
  setCheck(refused, "spec", "failed", "The spec has errors.");
  expect(verifiedLine(refused)).toBe("Change not applied. Spec failed: The spec has errors.");
  const tested = applied();
  tested.depth = "tests";
  setCheck(tested, "typecheck", "passed", "Fine.");
  setCheck(tested, "tests", "inconclusive", "The tests did not finish.");
  expect(verifiedLine(tested)).toBe(
    "Change applied. Data preserved. Tests inconclusive: The tests did not finish.",
  );
});

test("the checks behind it, and the depth Test it runs next", () => {
  const lines = checkLines(applied());
  expect(lines.find((l) => l.id === "data")?.text).toBe(
    "Data: passed. 12 of 12 customers kept their values.",
  );
  expect(lines.find((l) => l.id === "browser")?.text).toMatch(/^Browser flow: not run \(/);
  expect(nextDepth(applied())).toBe("tests");
  const deep = applied();
  deep.depth = "browser";
  expect(nextDepth(deep)).toBeUndefined();
});
