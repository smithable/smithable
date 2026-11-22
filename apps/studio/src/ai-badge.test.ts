import { expect, test } from "vitest";
import { badgeLine, badgeValue, kindChoices, startingKind, styleKind } from "./AiBadge";
import { BADGE_WORDS } from "./badge-words";

const photos = { id: "photos", generated: 0 };
const painted = { id: "painted", generated: 6, kind: "ai-drawn" as const };
const real = { id: "real", generated: 6 };

test("a style's kind is the library's word, else told by whether an AI made its pictures", () => {
  expect(styleKind(photos)).toBe("photograph");
  expect(styleKind(real)).toBe("ai-realistic");
  expect(styleKind(painted)).toBe("ai-drawn");
});

test("the three kinds are always offered, a kind without styles as not yet", () => {
  const choices = kindChoices([photos, real]);
  expect(choices.map((c) => [c.kind, c.styles.map((s) => s.id)])).toEqual([
    ["ai-realistic", ["real"]],
    ["ai-drawn", []],
    ["photograph", ["photos"]],
  ]);
  expect(startingKind([photos, real], "photos")).toBe("photograph");
  expect(startingKind([photos, painted], undefined)).toBe("ai-drawn");
  expect(startingKind([], undefined)).toBe("ai-realistic");
});

test("the badge's three states, and what a style's card says of it", () => {
  expect([undefined, true, false].map(badgeValue)).toEqual(["default", "on", "off"]);
  expect(badgeLine(undefined, "ai-realistic")).toBe(BADGE_WORDS.markedByKind);
  expect(badgeLine(undefined, "ai-drawn")).toBe(BADGE_WORDS.drawnUnmarked);
  expect(badgeLine(true, "ai-drawn")).toBe(BADGE_WORDS.marked);
  expect(badgeLine(false, "ai-realistic")).toBe(BADGE_WORDS.markOff);
  expect(badgeLine(true, "photograph")).toBeUndefined();
});
