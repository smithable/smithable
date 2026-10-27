import { expect, test } from "vitest";
import { fillText, placeholdersOf } from "./template.js";

test("placeholders are read trimmed, in order, and a text without braces has none", () => {
  expect(placeholdersOf("{ customer.name } booked {title} ({title})")).toEqual([
    "customer.name",
    "title",
    "title",
  ]);
  expect(placeholdersOf("Thank you.")).toEqual([]);
});

test("fillText fills from a map or a function, a missing value as nothing, a subject on one line", () => {
  expect(fillText("Your booking #{number} for {date}", { number: "12", date: "12 Oct" })).toBe(
    "Your booking #12 for 12 Oct",
  );
  expect(fillText("Pick up: {wanted}.", {})).toBe("Pick up: .");
  expect(fillText("{a}{b}", (p) => (p === "a" ? "x" : undefined))).toBe("x");
  expect(fillText("Re: {title}", { title: "Two\nlines" }, true)).toBe("Re: Two lines");
  expect(fillText("Re: {title}", { title: "Two\nlines" })).toBe("Re: Two\nlines");
  expect(fillText("No braces", { x: "1" })).toBe("No braces");
});
