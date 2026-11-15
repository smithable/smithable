import { expect, test } from "vitest";
import type { ReleaseReview } from "./api";
import { checksPassed, needsLook, reviewSections } from "./release-review";

function fixture(): ReleaseReview {
  return {
    baselineState: "available",
    baseline: "2026-11-01",
    comparison: "available",
    accessUnchanged: true,
    access: [],
    migrations: [],
    maintenance: {
      generatedEngine: "1",
      currentEngine: "1",
      generatedProfile: "1",
      currentProfile: "1",
      generatedKit: "1",
      currentKit: "1",
      status: "Recorded versions match",
      dependencies: {},
    },
    checks: {
      at: "2026-11-15",
      level: "release",
      current: true,
      results: [{ what: "Tests", ok: true, checked: true }],
    },
    privacy: [{ page: "privacy", state: "reviewed", facts: "current", on: "2026-11-15" }],
    verifiedRestore: "2026-11-14",
  };
}

test("current evidence keeps fine and unchanged sections quiet, with zero attention count", () => {
  const review = fixture();
  expect(needsLook(review)).toBe(0);
  expect(reviewSections(review).find((s) => s.id === "access")?.state).toBe("unchanged");
  expect(reviewSections(review).find((s) => s.id === "checks")?.state).toBe("fine");
});

test("first local release keeps unverified access and migration comparisons visible", () => {
  const review = {
    ...fixture(),
    baseline: undefined,
    baselineState: "none" as const,
    comparison: "unavailable",
    verifiedRestore: undefined,
  };
  const sections = reviewSections(review);
  expect(sections.find((s) => s.id === "access")?.state).toBe("needs-look");
  expect(sections.find((s) => s.id === "migrations")?.state).toBe("needs-look");
  expect(sections.find((s) => s.id === "recovery")?.state).toBe("not-applicable");
});

test("unavailable evidence stays visible even when delta arrays are empty", () => {
  const review = {
    ...fixture(),
    baselineState: "unavailable" as const,
    comparison: "unavailable",
    checks: undefined,
  };
  const sections = reviewSections(review);
  for (const id of ["access", "migrations", "checks"])
    expect(sections.find((s) => s.id === id)?.state).toBe("needs-look");
});

test("changed access without added grants still needs a look", () => {
  const review = { ...fixture(), accessUnchanged: false };
  expect(reviewSections(review).find((s) => s.id === "access")?.state).toBe("needs-look");
});

test.each([
  { level: "fast" },
  { current: false },
  { results: [] },
  { results: [{ what: "Tests", ok: true, checked: false }] },
  { results: [{ what: "Tests", ok: false, checked: true }] },
])("incomplete, stale and failed checks cannot become fine: %j", (change) => {
  const review = fixture();
  review.checks = { ...review.checks!, ...change };
  expect(checksPassed(review)).toBe(false);
  expect(reviewSections(review).find((s) => s.id === "checks")?.state).toBe("needs-look");
});

test("privacy and missing version evidence remain attention items", () => {
  const review = fixture();
  review.privacy = [];
  review.maintenance.generatedKit = undefined;
  expect(needsLook(review)).toBe(2);
});

test("absent version evidence is not fine even when both sides are missing", () => {
  const review = fixture();
  review.maintenance.generatedKit = undefined;
  Reflect.deleteProperty(review.maintenance, "currentKit");
  expect(reviewSections(review).find((s) => s.id === "maintenance")?.state).toBe("needs-look");
});

test("matching development versions still require source compatibility verification", () => {
  const review = fixture();
  review.maintenance.generatedEngine = "0.0.0";
  review.maintenance.currentEngine = "0.0.0";
  review.maintenance.status = "Development version; source compatibility needs verification";
  const maintenance = reviewSections(review).find((s) => s.id === "maintenance");
  expect(maintenance?.state).toBe("needs-look");
  expect(maintenance?.summary).toContain("needs verification");
});
