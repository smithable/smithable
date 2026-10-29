import { expect, test } from "vitest";
import { feedText } from "./preview.js";

test("a move is a line in the terminal, a refusal and a fault with what the app said", () => {
  const at = new Date(2026, 9, 29, 9, 5, 7).toISOString();
  const base = { n: 0, at, id: "sample-maja", who: "Maja" };
  expect(
    feedText({ ...base, text: "Added a booking", outcome: "done", why: "Tuesday's yoga" }),
  ).toBe("09:05:07 Maja: Added a booking (Tuesday's yoga).\n");
  expect(
    feedText({ ...base, text: "Added a booking", outcome: "refused", message: "No places left." }),
  ).toBe("09:05:07 Maja: Added a booking. Refused: No places left.\n");
  expect(
    feedText({ ...base, text: "Deleted a post", outcome: "finding", message: "boom", seed: 7 }),
  ).toBe("09:05:07 Maja: Deleted a post. The app failed: boom (seed 7)\n");
});
