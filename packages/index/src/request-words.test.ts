import { expect, test } from "vitest";
import { looksLikeInstruction } from "./request-words.js";

test.each([
  "Can you add a delivery field?",
  "I want to change the title",
  "Please set the calendar to agenda?",
  "Kan du lägga till ett fält?",
  "Jag vill ändra namnet",
  "Voitko lisätä tehtäviin tunniste-kenttä?",
  "Haluan muuttaa nimeä",
])("routes an instruction to the proposal prompt: %s", (request) => {
  expect(looksLikeInstruction(request)).toBe(true);
});

test.each([
  "Can you explain the calendar?",
  "Can members add bookings?",
  "What changes when a booking is removed?",
  "Kan du förklara sidan?",
  "Voitko selittää sivun?",
  "I want to know who can see bookings",
  "Can you show me how to publish?",
  "Can you show examples of publishing?",
  "Kan du visa varför sidan är offentlig?",
  "Voitko näyttää mitä julkaiseminen tarkoittaa?",
  "Can you show me which pages are public?",
  "Could you show me who can edit bookings?",
  "Kan du visa vem som kan se bokningar?",
  "Voitko näyttää missä julkaisen?",
  "Kan du visa mig hur jag publicerar?",
  "Voitko näyttää miten julkaisen?",
])("keeps an information question in the question route: %s", (request) => {
  expect(looksLikeInstruction(request)).toBe(false);
});
