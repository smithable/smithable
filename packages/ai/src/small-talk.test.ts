import { expect, test } from "vitest";
import { smallTalk } from "./small-talk.js";

test("greetings and thanks in Swedish and Finnish, by a word list (T731)", () => {
  for (const text of [
    "Hej!",
    "hejsan",
    "God morgon",
    "moi",
    "Hei Smith",
    "hyvää huomenta",
    "huomenta",
  ])
    expect(smallTalk(text), text).toMatch(/^Hello!/);
  for (const text of ["Tack!", "tack så mycket", "kiitos", "Kiitos paljon"])
    expect(smallTalk(text), text).toMatch(/^You're welcome!/);
  // Not a guess at other words.
  expect(smallTalk("hej, lägg till ett telefonfält")).toBeUndefined();
});
