import { expect, test } from "vitest";
import { languageNote, writtenInEnglish } from "./language.js";

test("an English description is English, also when it names a place; others are left to the model", () => {
  expect(
    writtenInEnglish(
      "A second-hand marketplace for our town, Mariehamn: people list things they want to sell with photos, a price and the condition, others browse by category, save favorites and contact the seller. Anyone can browse; you sign in to sell.",
    ),
  ).toBe(true);
  expect(
    writtenInEnglish("En bokningssida för min yogastudio i Åbo: ett schema med klasser."),
  ).toBe(false);
  expect(writtenInEnglish("Un mercado de segunda mano para nuestro pueblo.")).toBe(false);
  expect(languageNote("Mariehamn second hand")).toBe("");
});
