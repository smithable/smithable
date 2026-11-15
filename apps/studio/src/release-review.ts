import type { ReleaseReview as Review } from "./api";

export type ReviewState = "needs-look" | "fine" | "unchanged" | "not-applicable";
export type ReviewPart =
  | "access"
  | "privacy"
  | "migrations"
  | "checks"
  | "maintenance"
  | "recovery";
export interface ReviewSection {
  id: ReviewPart;
  title: string;
  state: ReviewState;
  summary: string;
}

export function checksPassed(review: Review): boolean {
  return Boolean(
    review.checks?.level === "release" &&
      review.checks.current &&
      review.checks.results.length &&
      review.checks.results.every((r) => r.ok && r.checked),
  );
}

/** Quiet states describe the evidence we have; missing evidence never means a check passed. */
export function reviewSections(review: Review): ReviewSection[] {
  const first = review.baselineState === "none";
  const compared = review.comparison === "available";
  const accessSame = compared && review.accessUnchanged === true;
  const privacyFine = Boolean(
    review.privacy?.length && review.privacy.every((p) => p.state === "reviewed"),
  );
  const versionsMatch = Boolean(
    review.maintenance.currentEngine !== "0.0.0" &&
      review.maintenance.generatedEngine &&
      review.maintenance.generatedProfile &&
      review.maintenance.generatedKit &&
      review.maintenance.generatedEngine === review.maintenance.currentEngine &&
      review.maintenance.generatedProfile === review.maintenance.currentProfile &&
      review.maintenance.generatedKit === review.maintenance.currentKit,
  );
  return [
    {
      id: "access",
      title: "Access",
      state: accessSame ? "unchanged" : "needs-look",
      summary: accessSame
        ? "unchanged since the last local release"
        : first
          ? "review who can use this app"
          : compared
            ? "review changed access settings"
            : "comparison unavailable; review current access",
    },
    {
      id: "privacy",
      title: "Privacy page",
      state: privacyFine ? "fine" : "needs-look",
      summary: privacyFine
        ? "reviewed, with no changes since your review"
        : review.privacy?.length
          ? "needs your review"
          : "no privacy review is recorded",
    },
    {
      id: "migrations",
      title: "Migration impact",
      state: !compared || review.migrations.length ? "needs-look" : "unchanged",
      summary: !compared
        ? "comparison unavailable; review model and field changes"
        : review.migrations.length
          ? "review model and field changes"
          : "no model or field changes detected",
    },
    {
      id: "checks",
      title: "Release checks",
      state: checksPassed(review) ? "fine" : "needs-look",
      summary: checksPassed(review)
        ? "passed for the current project files"
        : "not verified for the current project files",
    },
    {
      id: "maintenance",
      title: "Maintenance",
      state: versionsMatch ? "fine" : "needs-look",
      summary: versionsMatch ? "recorded versions match this tool" : review.maintenance.status,
    },
    {
      id: "recovery",
      title: "Recovery",
      state: review.verifiedRestore ? "fine" : first ? "not-applicable" : "needs-look",
      summary: review.verifiedRestore
        ? `restore verified at ${review.verifiedRestore}`
        : first
          ? "no local release recorded; check your hosting recovery setup"
          : "no verified restore is recorded by this tool",
    },
  ];
}

export const needsLook = (review: Review) =>
  reviewSections(review).filter((s) => s.state === "needs-look").length;
