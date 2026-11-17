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

/** The hosted release flow's saved progress, as the service writes it (T879 S2). */
export type ReleaseProgress = NonNullable<NonNullable<import("./api").Project["beta"]>["release"]>;

/**
 * The link to the service's release page and one line on where the flow stands (display only:
 * the release page decides). A change since the review starts again from the review.
 */
export function releaseProgress(release: ReleaseProgress): { label: string; line: string } {
  if (!release.reviewed)
    return {
      label: "Continue to publishing",
      line: "Next: review this version on the release page.",
    };
  if (release.changed)
    return {
      label: "Continue to publishing",
      line: "Your app changed since you reviewed it: review the new version first.",
    };
  if (release.production === "live")
    return { label: "Open the release page", line: "This version is live." };
  if (release.production === "todo")
    return {
      label: "Continue: put it live",
      line: "You tried this version on staging and said it works.",
    };
  switch (release.staging) {
    case "building":
      return { label: "Open the release page", line: "Staging is being built for this version." };
    case "ready":
      return {
        label: "Continue: try staging",
        line: "Staging has this version: try it, then confirm it works.",
      };
    case "failed":
      return { label: "Open the release page", line: "The staging build of this version failed." };
    case "replaced":
      return {
        label: "Continue: publish to staging",
        line: "Staging now holds another build: publish this version again.",
      };
    default:
      return {
        label: "Continue: publish to staging",
        line: "Reviewed. Next: publish this version to staging.",
      };
  }
}

/**
 * The progress only when its link is the service's own release page: the same origin as the
 * project's home page (set by the service, not the workspace) and under /projects/. The facts file
 * lives in a workspace its owner can edit, so its address is never trusted on its own.
 */
export function trustedRelease(
  release: ReleaseProgress | undefined,
  home: string | undefined,
): ReleaseProgress | undefined {
  if (!release || !home) return undefined;
  const at = URL.parse(release.url);
  const from = URL.parse(home);
  // This project's own release page: home's origin and path, then /release (a second reviewer).
  return at &&
    from &&
    at.origin === from.origin &&
    at.pathname === `${from.pathname.replace(/\/$/, "")}/release`
    ? release
    : undefined;
}
