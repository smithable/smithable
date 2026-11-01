import { expect, test } from "vitest";
import { doorSecret, feedText } from "./preview.js";

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

test("the door's secret is the one given when it is long enough, else a new one", () => {
  const given = "a".repeat(32);
  expect(doorSecret({ DEV_DOOR_SECRET: given })).toBe(given);
  // Too short to be a secret, or none: a new one, different each time.
  const short = doorSecret({ DEV_DOOR_SECRET: "secret" });
  expect(short).not.toBe("secret");
  expect(short).toMatch(/^[0-9a-f]{48}$/);
  expect(doorSecret({})).not.toBe(doorSecret({}));
});
