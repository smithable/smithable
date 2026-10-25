import { expect, it } from "vitest";
import { kitSummary } from "./kit-summary.js";

it("says what the kit does by itself in its own words, the menu that stays in view among them", () => {
  const lines = kitSummary();
  expect(lines.find((l) => l.startsWith("AppShell: "))).toMatch(/menu stays in view/);
  expect(lines.every((l) => /^\w+: .+\.$/.test(l) && !l.includes(".md"))).toBe(true);
  expect(lines.join("\n").length).toBeLessThan(5000);
});
