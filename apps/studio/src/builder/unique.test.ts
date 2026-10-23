import { expect, test } from "vitest";
import { uniqueRule } from "./unique";

test("the shorthand says unique or not; a scope, or leaving one, takes setFieldRules", () => {
  // The shorthand's own word: no rule needed.
  expect(uniqueRule("yes", false)).toBeUndefined();
  expect(uniqueRule("no", true)).toBeUndefined();
  expect(uniqueRule("owner", "owner")).toBeUndefined();
  // A scope is the field's key.
  expect(uniqueRule("owner", false)).toBe("owner");
  expect(uniqueRule("app", true)).toBe("app");
  expect(uniqueRule("app")).toBe("app");
  // Leaving a scope: the key goes or becomes the word.
  expect(uniqueRule("no", "app")).toBe("false");
  expect(uniqueRule("yes", "owner")).toBe("true");
});
