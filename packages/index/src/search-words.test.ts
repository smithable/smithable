import { expect, test } from "vitest";
import { searchWords } from "./docs-search.js";
import { standsFor } from "./search-words.js";

test("a Swedish word is also searched as the English words it stands for (T844 E)", () => {
  // An inflected word by its stem; a short one only as itself.
  expect(standsFor("publicerar")).toEqual(["publish"]);
  expect(standsFor("pass")).toEqual(["session"]);
  expect(standsFor("passenger")).toEqual([]);
  expect(searchWords("hur publicerar jag appen?")).toEqual(["publicerar", "publish", "appen"]);
  expect(searchWords("kan besökare läsa utkast på bloggen?")).toContain("draft");
});
