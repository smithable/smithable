import { useCallback, useEffect, useRef, useState } from "react";
import { api, type Project, type ReleaseReview as Review } from "./api";
import {
  checksPassed,
  needsLook,
  type ReleaseProgress,
  releaseProgress,
  reviewSections,
} from "./release-review";
import { Button } from "./ui";

/** One current read shared by the top-bar count and the open review. Older replies cannot win. */
export function useReleaseReview(files: Project["files"] | undefined, enabled: boolean) {
  const [state, setState] = useState<{ review?: Review; error?: string; loading?: boolean }>({});
  const request = useRef(0);
  const reload = useCallback(async (invalidate = false) => {
    const mine = ++request.current;
    setState((before) =>
      invalidate ? { loading: true } : { ...before, error: undefined, loading: true },
    );
    try {
      const review = await api.releaseReview();
      if (request.current === mine) setState({ review });
    } catch (error) {
      if (request.current === mine)
        setState({ error: error instanceof Error ? error.message : String(error) });
    }
  }, []);
  const source = files ? JSON.stringify(files) : undefined;
  useEffect(() => {
    if (enabled && source) void reload(true);
    else setState({});
    return () => {
      request.current++;
    };
  }, [source, enabled, reload]);
  useEffect(() => {
    if (!enabled) return;
    const focus = () => void reload();
    window.addEventListener("focus", focus);
    return () => window.removeEventListener("focus", focus);
  }, [enabled, reload]);
  return { ...state, reload };
}

export function ReleaseReview({
  review,
  error,
  loading = false,
  reload,
  home,
  release,
  onClose,
}: {
  review?: Review;
  error?: string;
  loading?: boolean;
  reload: () => Promise<void>;
  home?: string;
  /** The hosted release flow's saved progress (T879 S2), when the service has written it. */
  release?: ReleaseProgress;
  onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [refused, setRefused] = useState<string>();
  const [reviewingPrivacy, setReviewingPrivacy] = useState(false);
  // The page just confirmed, said in its section, which stays open (Johan, 2026-11-18: the button
  // seemed to do nothing but disable itself).
  const [readPrivacy, setReadPrivacy] = useState<string>();
  const hosted = Boolean(home || release);
  useEffect(() => {
    dialog.current?.showModal();
  }, []);
  // This existing operation records only that the owner read the privacy description.
  const reviewPrivacy = async (page: string, facts: string) => {
    setReviewingPrivacy(true);
    setRefused(undefined);
    const on = new Date().toISOString().slice(0, 10);
    const result = await api
      .operation("reviewPrivacyPage", { page, facts, on })
      .catch((e: Error) => ({ ok: false, output: e.message }));
    if (!result.ok) setRefused(result.output);
    else setReadPrivacy(page);
    await reload();
    setReviewingPrivacy(false);
  };
  const content = review && {
    noting: (
      <ul className="list-disc space-y-1 pl-5" data-review-warnings>
        {review.warnings?.map((line) => (
          <li key={line}>{line}</li>
        ))}
      </ul>
    ),
    access: (
      <>
        {review.noSignIn && (
          <p role="note" className="font-medium">
            {review.noSignIn}
          </p>
        )}
        {review.currentAccess?.length ? (
          <details data-review-roles>
            <summary className="cursor-pointer font-semibold">Who can use the current app</summary>
            <ul className="mt-2 space-y-1">
              {review.currentAccess.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          </details>
        ) : (
          <p>
            Current access could not be read. Review the app's access settings before publishing.
          </p>
        )}
        {review.comparison === "available" ? (
          <>
            <p className="text-sm text-muted">
              Compared with the local deployment recorded at {review.baseline}.
            </p>
            {review.access.length ? (
              <ul className="list-disc pl-5">
                {review.access.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            ) : (
              <p>
                {review.accessUnchanged
                  ? "Access is unchanged in this comparison."
                  : "No added access detected. Other access settings changed; review the current map."}
              </p>
            )}
          </>
        ) : (
          review.baselineState !== "none" &&
          !hosted && (
            <p>
              {review.comparisonReason ?? "Comparison is unavailable."} Review the current access
              map before publishing.
            </p>
          )
        )}
      </>
    ),
    privacy: (
      <>
        {!review.privacy?.length && (
          <p>
            No privacy-page review is recorded. Check what the app needs to tell the people who use
            it.
          </p>
        )}
        {review.privacy?.map((p) => (
          <div key={p.page} className="space-y-1" data-privacy={p.state}>
            <p>
              {p.state === "reviewed"
                ? `You reviewed the description of the app on the ${p.page} page on ${p.on}.`
                : p.state === "changed"
                  ? `The description of the app on the ${p.page} page changed since your review on ${p.on}.`
                  : `The description of the app on the ${p.page} page has not been reviewed yet.`}
            </p>
            {p.changed && (
              <ul className="list-disc pl-5">
                {p.changed.map((part) => (
                  <li key={part}>{part}</li>
                ))}
              </ul>
            )}
            {p.state === "reviewed" && readPrivacy === p.page && (
              <p role="status" data-privacy-recorded>
                Recorded: you read it today.
              </p>
            )}
            {p.state !== "reviewed" && (
              <div className="space-y-2">
                <p className="text-sm text-muted">
                  Open the {p.page} page in the preview and read it. When it says what the app does,
                  confirm here.
                </p>
                <Button
                  disabled={reviewingPrivacy}
                  onClick={() => void reviewPrivacy(p.page, p.facts)}
                >
                  {reviewingPrivacy ? "Recording…" : "I have read it"}
                </Button>
              </div>
            )}
          </div>
        ))}
        {refused && <p role="alert">{refused}</p>}
        <p className="text-sm text-muted">
          Confirming records that you read this description as it is now, until it changes. It is
          not legal advice.
        </p>
      </>
    ),
    migrations:
      review.comparison !== "available" ? (
        <p>Migration comparison unavailable. Review the generated migrations manually.</p>
      ) : review.migrations.length ? (
        <ul className="list-disc pl-5">
          {review.migrations.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      ) : (
        <p>
          No field changes detected. Review generated migrations and model constraints before
          release.
        </p>
      ),
    checks: (
      <>
        <p>
          {checksPassed(review)
            ? "Release checks passed for the current project files."
            : "Release checks are not verified for the current project files."}
        </p>
        {review.checks && (
          <>
            <p className="text-sm text-muted">
              Latest recorded run: {review.checks.level}, {review.checks.at}.{" "}
              {review.checks.current
                ? "Project files match that run."
                : "Project files differ or their revision is unknown."}
            </p>
            <ul className="list-disc pl-5">
              {review.checks.results.map((result) => (
                <li key={result.what}>
                  {result.what}: {!result.checked ? "not checked" : result.ok ? "passed" : "failed"}
                </li>
              ))}
            </ul>
          </>
        )}
        <p className="text-sm text-muted">
          These records cover Git-visible source files. Runtime settings, ignored files and hosting
          checks need separate verification.
        </p>
      </>
    ),
    maintenance: (
      <>
        <p>{review.maintenance.status}.</p>
        <p>
          Generated engine: {review.maintenance.generatedEngine ?? "unknown"}; this tool:{" "}
          {review.maintenance.currentEngine}.
        </p>
        <p>
          Generated stack profile: {review.maintenance.generatedProfile ?? "unknown"}; this tool:{" "}
          {review.maintenance.currentProfile}.
        </p>
        <p>Recorded template kit: {review.maintenance.generatedKit ?? "unknown"}.</p>
        <p>
          Last recorded tested upgrade:{" "}
          {review.maintenance.upgrade
            ? `${review.maintenance.upgrade.from} to ${review.maintenance.upgrade.to} (${review.maintenance.upgrade.commit.slice(0, 12)})`
            : "none recorded"}
          .
        </p>
        <p>
          Deployed apps keep their generated code until updated and released. Test upgrades on a
          staged copy; metadata does not verify the running deployment.
        </p>
        <details>
          <summary>Declared dependency versions</summary>
          <ul className="list-disc pl-5">
            {Object.entries(review.maintenance.dependencies).map(([name, version]) => (
              <li key={name}>
                {name}: {version}
              </li>
            ))}
          </ul>
        </details>
      </>
    ),
    recovery: (
      <>
        <p>
          Last verified restore: {review.verifiedRestore ?? "none recorded by this local tool"}.
        </p>
        <p>
          A successful backup or file copy does not verify recovery. Use the hosting recovery view
          for deployed evidence.
        </p>
        <ul className="list-disc space-y-1 pl-5">
          <li>
            <strong>Editor undo</strong> reverses a local change and may restore its development
            database snapshot. It does not restore a published app.
          </li>
          <li>
            <strong>Code rollback</strong> restores an earlier version of the code. It may require
            the matching database schema.
          </li>
          <li>
            <strong>Data restore</strong> replaces data with a snapshot. Records and uploads added
            after that snapshot may be lost. Verify credentials and files as well as the database.
          </li>
        </ul>
      </>
    ),
  };
  return (
    <dialog
      ref={dialog}
      aria-label="Review and publish"
      aria-busy={loading || undefined}
      onClose={onClose}
      className="m-auto max-h-[90vh] w-[min(48rem,92vw)] overflow-auto rounded-lg bg-panel p-4 text-fg shadow-xl backdrop:bg-black/40"
    >
      <div className="space-y-4">
        <h2 className="text-lg font-semibold">
          Review and publish
          {review && (
            <span className="ml-2 text-sm font-normal" data-review-count>
              {needsLook(review, { hosted })}{" "}
              {needsLook(review, { hosted }) === 1 ? "needs" : "need"} a look
            </span>
          )}
        </h2>
        <p className="text-sm text-muted">
          Review before publishing. This view does not run checks or publish the app. Publishing
          still performs its own checks.
        </p>
        {loading && review && (
          <p role="status" className="text-sm text-muted">
            Refreshing release evidence…
          </p>
        )}
        {error ? (
          <p role="alert">The release review could not be read: {error}</p>
        ) : !review ? (
          <p role="status">Reading release evidence…</p>
        ) : (
          <>
            {review.baselineState === "none" && (
              <p data-first-release>
                No local release is recorded yet. Review who can use the current app, its privacy
                page and whether the checks are current. Hosted publishing has its own evidence.
              </p>
            )}
            {reviewSections(review, { hosted }).map((part) => (
              <details
                key={`${part.id}:${part.state}:${part.summary}`}
                data-review-part={part.id}
                data-review-state={part.state}
                open={
                  part.state === "needs-look" ||
                  (part.id === "privacy" && readPrivacy !== undefined)
                }
                className={`rounded-md border p-3 ${part.state === "needs-look" ? "border-accent text-fg" : "border-line text-muted open:text-fg"}`}
              >
                <summary className="cursor-pointer text-sm">
                  <span className="font-semibold">{part.title}:</span> {part.summary}
                </summary>
                <div className="mt-3 space-y-2 text-sm">{content?.[part.id]}</div>
              </details>
            ))}
            <div className="flex flex-wrap items-center gap-3 border-t border-line pt-3">
              {release ? (
                <>
                  <a
                    href={release.url}
                    data-release-step
                    className="text-sm font-medium text-accent hover:underline"
                  >
                    {releaseProgress(release).label}
                  </a>
                  <span className="text-sm text-muted" data-release-line>
                    {releaseProgress(release).line}
                  </span>
                </>
              ) : home ? (
                <a href={home} className="text-sm font-medium text-accent hover:underline">
                  Continue to publishing
                </a>
              ) : (
                <a
                  href="https://docs.smithable.ai/self-host.html"
                  target="_blank"
                  rel="noreferrer"
                  className="text-sm font-medium text-accent hover:underline"
                >
                  Publish on your own server
                </a>
              )}
            </div>
          </>
        )}
        <Button onClick={() => dialog.current?.close()}>Close</Button>
      </div>
    </dialog>
  );
}
