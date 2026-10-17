import { expect, test } from "vitest";
import { followUp } from "./Ask";

test("words that lean on the last request go with it; anything else stands alone", () => {
  const asked = { text: "Add a date to orders", at: Date.now(), question: false };
  expect(followUp("yes", asked)).toBe("Add a date to orders (yes)");
  expect(followUp("the second one", asked)).toBe("Add a date to orders (the second one)");
  expect(followUp("also for customers", asked)).toBe("Add a date to orders (also for customers)");
  // Smith asked a question: the answer goes with it, however long.
  expect(followUp("on orders, when they were placed", { ...asked, question: true })).toBe(
    "Add a date to orders (on orders, when they were placed)",
  );
  // A request of its own, or a short line long after.
  expect(followUp("Customers should have a website", asked)).toBe(
    "Customers should have a website",
  );
  expect(followUp("orders please", { ...asked, at: Date.now() - 120_000 })).toBe("orders please");
  expect(followUp("yes", undefined)).toBe("yes");
});
