// The starter suggestion weighs who the app is for (T767): a private description never gets a starter
// that lets anyone read its records unsaid, and a public catalogue still gets the collection starter.
import { expect, test } from "vitest";
import { openQuestions, publicNote, publicRecords, starterFor } from "./new.js";

const PRIVATE = [
  "A recipe collection for a family, with ingredients and shopping lists",
  "A list of our team's equipment and who has what",
  "My own collection of vinyl records",
];

test("a private description never gets a public starter unsaid", async () => {
  for (const description of PRIVATE) {
    // As the questions step and Studio read it, with no model.
    const asked = await openQuestions(description);
    if (asked.starter && publicRecords(asked.starter).length)
      expect(asked.note, description).toMatch(/is a public site: anyone can read/);
    // As new --describe weighs the closest starter by words, whichever it was.
    for (const picked of ["records", "booking", "barbers", "marketplace"]) {
      const chosen = starterFor(description, picked);
      if (publicRecords(chosen.name).length)
        expect(chosen.note, `${description} / ${picked}`).toBeTruthy();
    }
  }
});

test("a description that asks for a public catalogue still gets the collection starter", async () => {
  const asked = await openQuestions(
    "A public catalogue of our museum's objects for visitors to browse online",
  );
  expect(asked.starter).toBe("records");
  expect(asked.note).toMatch(/records starter is a public site/);
});

test("the note names what anyone can read and the operation that closes it", () => {
  expect(publicNote("records")).toBe(
    'The records starter is a public site: anyone can read its Item records without signing in. To keep them private: smithable op setPublic --pages home --read ""',
  );
  expect(publicNote("crm")).toBeUndefined();
});
