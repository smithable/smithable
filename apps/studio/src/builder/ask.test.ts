import { expect, test } from "vitest";
import { followUp, peopleCommand } from "./Ask";

test("words that lean on the last request go with it; anything else stands alone", () => {
  const asked = { text: "Add a date to orders", at: Date.now(), question: false };
  expect(followUp("yes", asked)).toBe("Add a date to orders (yes)");
  expect(followUp("the second one", asked)).toBe("Add a date to orders (the second one)");
  expect(followUp("also for customers", asked)).toBe("Add a date to orders (also for customers)");
  // Smith asked a question: a short answer goes with it for five minutes; a long line that does
  // not lean stands alone.
  const question = { ...asked, question: true, at: Date.now() - 3 * 60_000 };
  expect(followUp("on orders", question)).toBe("Add a date to orders (on orders)");
  expect(followUp("the placing date of each order, please", question)).toBe(
    "the placing date of each order, please",
  );
  expect(followUp("yes", { ...asked, at: Date.now() - 3 * 60_000 })).toBe("yes");
  // A request of its own, or a short line long after.
  expect(followUp("Customers should have a website", asked)).toBe(
    "Customers should have a website",
  );
  expect(followUp("orders please", { ...asked, at: Date.now() - 120_000 })).toBe("orders please");
  expect(followUp("yes", undefined)).toBe("yes");
});

test("Smith lets the sample users run and stops them; other lines are requests", () => {
  expect(peopleCommand("Let them run")).toBe("run");
  expect(peopleCommand("please let the sample users run!")).toBe("run");
  expect(peopleCommand("start the people")).toBe("run");
  expect(peopleCommand("stop")).toBeUndefined();
  expect(peopleCommand("stop", true)).toBe("pause");
  expect(peopleCommand("stop them")).toBe("pause");
  expect(peopleCommand("Pause the sample users.")).toBe("pause");
  expect(peopleCommand("stop showing prices")).toBeUndefined();
  expect(peopleCommand("let customers book")).toBeUndefined();
  // Trying everything; "let them run" after it is sensible again (the last word wins).
  expect(peopleCommand("Try everything.")).toBe("everything");
  expect(peopleCommand("let the sample users try everything")).toBe("everything");
  expect(peopleCommand("try everything on the orders page")).toBeUndefined();
});
