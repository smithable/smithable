import { expect, test } from "vitest";
import type { ReleaseReview } from "./api";
import {
  checksPassed,
  needsLook,
  releaseProgress,
  reviewSections,
  trustedRelease,
} from "./release-review";

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
  expect(sections.find((s) => s.id === "access")?.summary).toContain("comparison unavailable");
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

test("the release flow's saved progress names the next step; a change since the review starts again from it (T879 S2)", () => {
  const base = {
    url: "https://smithable.test/projects/p1/release",
    reviewed: "a".repeat(40),
    staging: "todo",
    production: "locked",
    changed: false,
  } as const;
  expect(releaseProgress({ ...base, reviewed: null }).line).toMatch(/review this version/);
  expect(releaseProgress({ ...base, changed: true }).line).toMatch(/changed since you reviewed/);
  expect(releaseProgress(base).label).toBe("Continue: publish to staging");
  expect(releaseProgress({ ...base, staging: "ready" }).label).toBe("Continue: try staging");
  expect(releaseProgress({ ...base, staging: "confirmed", production: "todo" }).label).toBe(
    "Continue: put it live",
  );
  expect(releaseProgress({ ...base, staging: "confirmed", production: "live" }).line).toBe(
    "This version is live.",
  );
  expect(releaseProgress({ ...base, staging: "failed" }).line).toMatch(/failed/);
  expect(releaseProgress({ ...base, staging: "replaced" }).line).toMatch(/another build/);
});

test("the progress is shown only when its link is the service's own release page (a second reviewer)", () => {
  const home = "https://smithable.test/projects/p1";
  const release = {
    url: "https://smithable.test/projects/p1/release",
    reviewed: null,
    staging: "locked",
    production: "locked",
    changed: false,
  } as const;
  expect(trustedRelease(release, home)).toBe(release);
  expect(
    trustedRelease({ ...release, url: "https://evil.example/projects/p1/release" }, home),
  ).toBeUndefined();
  expect(
    trustedRelease({ ...release, url: "https://smithable.test/elsewhere" }, home),
  ).toBeUndefined();
  // Another project's release page on the same service is not this one's.
  expect(
    trustedRelease({ ...release, url: "https://smithable.test/projects/p2/release" }, home),
  ).toBeUndefined();
  expect(trustedRelease(release, undefined)).toBeUndefined();
});

test("hosted: only what the owner can check, warnings first, access quiet without a comparison", () => {
  const review: ReleaseReview = {
    ...fixture(),
    baselineState: "unavailable",
    comparison: "unavailable",
    accessUnchanged: false,
    checks: undefined,
    verifiedRestore: undefined,
    maintenance: { ...fixture().maintenance, currentEngine: "0.0.0" },
    warnings: ["The staff role can open the users page."],
  };
  const ids = reviewSections(review, { hosted: true }).map((s) => s.id);
  expect(ids).toEqual(["noting", "access", "privacy"]);
  expect(reviewSections(review, { hosted: true })[1]?.state).toBe("fine");
  expect(needsLook(review, { hosted: true })).toBe(1);
  // Locally (self-hosting) every part stays, as before.
  expect(reviewSections(review).map((s) => s.id)).toEqual([
    "noting",
    "access",
    "privacy",
    "migrations",
    "checks",
    "maintenance",
    "recovery",
  ]);
});

test("hosted: model changes still show when a comparison found them", () => {
  const review: ReleaseReview = { ...fixture(), migrations: ["Added model Booking."] };
  expect(reviewSections(review, { hosted: true }).map((s) => s.id)).toEqual([
    "access",
    "privacy",
    "migrations",
  ]);
});

test("pictures an AI made are a suggestion: shown, never counted, publishing stays open (T1175)", () => {
  const review = {
    ...fixture(),
    pictures: [{ page: "home", section: "hero", src: "images/hero.webp", alt: "A roof" }],
  };
  expect(reviewSections(review).find((s) => s.id === "pictures")?.state).toBe("suggestion");
  expect(needsLook(review)).toBe(0);
  expect(needsLook(review, { hosted: true })).toBe(0);
  expect(reviewSections(fixture()).find((s) => s.id === "pictures")).toBeUndefined();
});
