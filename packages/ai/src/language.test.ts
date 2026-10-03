import { expect, test } from "vitest";
import { languageNote, writtenInEnglish } from "./language.js";

test("an English description is English, also when it names a place; others are left to the model", () => {
  expect(
    writtenInEnglish(
      "A second-hand marketplace for our town, Mariehamn: people list things they want to sell with photos, a price and the condition, others browse by category, save favorites and contact the seller. Anyone can browse; you sign in to sell.",
    ),
  ).toBe(true);
  expect(
    writtenInEnglish(
      "A booking site for my small yoga studio in Turku: a schedule of classes with a teacher, a time and a number of places, people book a place and can cancel, and I see who is coming.",
    ),
  ).toBe(true);
  // A list-like line has few of them (C's bench: 2 of 10).
  expect(writtenInEnglish("A football club's site: teams, players, matches and results.")).toBe(
    true,
  );
  expect(
    writtenInEnglish("En bokningssida för min yogastudio i Åbo: ett schema med klasser."),
  ).toBe(false);
  expect(writtenInEnglish("Un mercado de segunda mano para nuestro pueblo.")).toBe(false);
  expect(languageNote("Mariehamn second hand")).toBe("");
});
