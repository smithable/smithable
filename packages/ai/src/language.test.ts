import { expect, test } from "vitest";
import { describedWith } from "./clarify.js";
import {
  languageNote,
  languageQuestion,
  otherLanguages,
  PAGE_START,
  textLanguage,
  writtenIn,
  writtenInEnglish,
} from "./language.js";

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

test("a Swedish description is Swedish, and the note says so; a mixed or short line is neither", () => {
  expect(
    writtenIn(
      "En bokningssida för min lilla yogastudio i Åbo: ett schema med klasser, en lärare, en tid och antal platser; folk bokar en plats och kan avboka, och jag ser vem som kommer.",
    ),
  ).toBe("sv");
  expect(writtenIn("A football club's site: teams, players, matches and results.")).toBe("en");
  expect(writtenIn("Un mercado de segunda mano para nuestro pueblo.")).toBeUndefined();
  expect(writtenIn("Yoga Åbo")).toBeUndefined();
  expect(
    languageNote("Ett schema med klasser som folk kan boka och avboka när de vill."),
  ).toContain("texts are in Swedish");
});

test("the app's language: the language question's answer, else the page's or description's own words", () => {
  const page = `${PAGE_START} (https://el.ax/). Derive its records, pages, roles and sections; write new texts for it, never copy the site's.
Title: Ålands Elandelslag
Text:
Vi levererar el till hushåll och företag på Åland. Här kan du anmäla avbrott och se när de är lagade, och läsa våra nyheter.`;
  expect(textLanguage(page)).toBe("sv");
  const question = languageQuestion("sv");
  expect(question).toEqual({
    question: "The site is in Swedish. Should the app's texts be in Swedish or English?",
    options: ["Swedish", "English"],
  });
  const answered = (answer: string) =>
    describedWith(page, [
      { question: "Who will use it?", answer: "Our customers and the staff who handle them" },
      { question: question.question, answer },
    ]);
  expect(textLanguage(answered("English"))).toBe("en");
  expect(textLanguage(answered("Swedish"))).toBe("sv");
  // Answered in order (--answers), the language's name alone is the answer.
  expect(
    textLanguage(
      describedWith(page, [
        { question: "(1)", answer: "Our customers" },
        { question: "(2)", answer: "English" },
      ]),
    ),
  ).toBe("en");
  // Unanswered, English answers to the other questions do not make the app English.
  expect(textLanguage(answered(""))).toBe("sv");
});

test("the other languages a description asks for: two named together, never one word alone", () => {
  expect(otherLanguages("En bokningssida på svenska och engelska", "sv")).toEqual(["en"]);
  expect(otherLanguages("A shop site in English and Swedish for our customers", "en")).toEqual([
    "sv",
  ]);
  expect(otherLanguages("A CRM for our Swedish customers", "en")).toEqual([]);
  expect(otherLanguages("A CRM in English", "en")).toEqual([]);
});

test("the answer to which languages names the main one first; a pair adds the other", () => {
  const answered = (answer: string) =>
    `A booking app for our Swedish customers.\n\nAnswers:\n- Which languages should the app be in? ${answer}`;
  expect(textLanguage(answered("Swedish"))).toBe("sv");
  expect(textLanguage(answered("Swedish and English"))).toBe("sv");
  expect(otherLanguages(answered("Swedish and English"), "sv")).toEqual(["en"]);
  expect(otherLanguages(answered("Swedish"), "sv")).toEqual([]);
});
