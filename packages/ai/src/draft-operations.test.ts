import { expect, test } from "vitest";
import { checkSpecFiles } from "./draft.js";
import { BLANK, draftOperations, repairFieldShorthand } from "./draft-operations.js";

test("the empty app is valid, and the draft's operations leave out what a draft never needs", () => {
  expect(checkSpecFiles(BLANK)).toEqual([]);
  const names = draftOperations().map((o) => o.name);
  expect(names).toEqual(
    expect.arrayContaining(["setApp", "addModel", "addPage", "setRoles", "setPublic"]),
  );
  expect(names).not.toContain("editSpec");
  expect(names).not.toContain("removeField");
});

test("field shorthand slips are mended", () => {
  expect(repairFieldShorthand("email unique!")).toBe("email! unique");
  expect(repairFieldShorthand("string required")).toBe("string!");
  expect(repairFieldShorthand("low | normal | high = normal")).toBe("normal | low | high");
  expect(repairFieldShorthand("choices: good | worn")).toBe("good | worn");
  expect(repairFieldShorthand("boolean")).toBe("bool");
  expect(repairFieldShorthand("integer! = 12")).toBe("int! = 12");
  expect(repairFieldShorthand("Customer!")).toBe("Customer!");
});
