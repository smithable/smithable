import { expect, test } from "vitest";
import { readDescription, stem } from "./read-description.js";

test("words settle the shape, who signs in and what anyone sees; nothing is asked when all three are said", () => {
  const read = readDescription(
    "A town flea market site where anyone can post things to sell, with photos and a price.",
  );
  expect(read).toMatchObject({ kind: "marketplace", audience: "members", visitors: "read" });
  expect(read.fields).toEqual(["photo", "price"]);
  expect(read.questions).toEqual([]);
});

test("people from outside who add something sign up; people who only look make it open", () => {
  // Residents check: they are visitors, and the team that writes the status signs in.
  expect(
    readDescription(
      "Service status for our municipality's online services, for residents to check outages.",
    ),
  ).toMatchObject({ kind: "status", audience: "team", visitors: "read" });
  // Neighbors lend: they sign up. Whether anyone may look is not said, so it is asked.
  const library = readDescription("A tool library where neighbors lend each other tools.");
  expect(library).toMatchObject({ kind: "marketplace", audience: "members" });
  expect(library.visitors).toBeUndefined();
  expect(library.questions.map((q) => q.about)).toEqual(["visitors"]);
});

test("what a word is about is not what the app is: a web agency's pipeline is not on the web", () => {
  expect(
    readDescription(
      "A sales pipeline for our six-person web agency: leads, deals and who follows up when.",
    ),
  ).toMatchObject({ kind: "crm", audience: "team", visitors: "nothing" });
  // A status page for an API reports on the API; it is not an app for programs.
  expect(
    readDescription("A status page for our API, with incidents and planned maintenance.").kind,
  ).toBe("status");
});

test("nothing said about being seen is closed for one person or a team, and asked for a status page", () => {
  expect(
    readDescription("My vinyl record collection: albums, artists, condition and what I paid."),
  ).toMatchObject({
    kind: "records",
    audience: "me",
    visitors: "nothing",
    questions: [],
  });
  const status = readDescription(
    "A status page for our API, with incidents and planned maintenance.",
  );
  expect(status.visitors).toBeUndefined();
  expect(status.questions.map((q) => q.about)).toEqual(["visitors"]);
});

test("an item of the list that no word list knows is noted, not built: it may be a thing or a wish", () => {
  const read = readDescription(
    "A recipe collection for a family, with ingredients and shopping lists.",
  );
  expect(read.things).toEqual(["recipe", "ingredient"]);
  expect(read.maybe).toEqual(["shopping list"]);
  expect(read.leftover).toEqual(["shopping"]);
  const wish = readDescription("Appointment booking for my clinic with SMS reminders.");
  expect(wish.things).toEqual(["appointment", "booking"]);
  expect(wish.maybe).toEqual(["sms reminder"]);
  expect(
    readDescription("An inventory app for a small bakery: ingredients and suppliers.").leftover,
  ).toEqual(["bakery"]);
});

test("no evidence for a shape and nothing to keep is asked, never guessed", () => {
  const vague = readDescription("I want something good for my shop that works.");
  expect(vague.kind).toBeUndefined();
  expect(vague.questions[0]?.about).toBe("kind");
});

test("another language is not read at all", () => {
  expect(
    readDescription("Bokning för min frisörsalong, kunderna ska kunna boka tid själva på nätet.")
      .read,
  ).toBe(false);
});

test("words are compared in the singular", () => {
  expect(["companies", "classes", "species", "club's", "status"].map(stem)).toEqual([
    "company",
    "class",
    "species",
    "club",
    "status",
  ]);
});

test("a language named, but not two together, asks which languages the app is in", () => {
  const asks = (text: string) =>
    readDescription(text).questions.some((q) => q.about === "languages");
  expect(asks("A booking app for my barbershop, for our Swedish customers.")).toBe(true);
  expect(asks("A booking app for my barbershop, in Swedish and English.")).toBe(false);
  expect(asks("A booking app for my barbershop.")).toBe(false);
});
