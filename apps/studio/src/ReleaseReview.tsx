import { useEffect, useRef, useState } from "react";
import { api, type ReleaseReview as Review } from "./api";
import { Button } from "./ui";
export function ReleaseReview({ onClose }: { onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [review, setReview] = useState<Review>();
  const [error, setError] = useState<string>();
  useEffect(() => {
    dialog.current?.showModal();
    void api
      .releaseReview()
      .then(setReview)
      .catch((error: Error) => setError(error.message));
  }, []);
  const passed =
    review?.checks?.level === "release" &&
    review.checks.current &&
    review.checks.results.length > 0 &&
    review.checks.results.every((r) => r.ok && r.checked);
  return (
    <dialog
      ref={dialog}
      aria-label="Release review"
      onClose={onClose}
      className="m-auto max-h-[90vh] w-[min(48rem,92vw)] overflow-auto rounded-lg bg-panel p-4 text-fg shadow-xl backdrop:bg-black/40"
    >
      <div className="space-y-4">
        <h2 className="text-lg font-semibold">Release review</h2>
        <p className="text-sm text-muted">
          Review before publishing. This view does not run checks or publish the app.
        </p>
        {error ? (
          <p role="alert">The release review could not be read: {error}</p>
        ) : !review ? (
          <p role="status">Reading release evidence…</p>
        ) : (
          <>
            <section className="space-y-2">
              <h3 className="font-semibold">Access changes</h3>
              {review.comparison !== "available" ? (
                <p>
                  {review.comparisonReason ?? "Comparison is unavailable."} Review the current
                  access map before publishing.
                </p>
              ) : (
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
                      No added access detected in this comparison. Changed conditions still need
                      review.
                    </p>
                  )}
                </>
              )}
            </section>
            <section className="space-y-2">
              <h3 className="font-semibold">Migration impact</h3>
              {review.comparison !== "available" ? (
                <p>Migration comparison unavailable. Review the generated migrations manually.</p>
              ) : review.migrations.length ? (
                <ul className="list-disc pl-5">
                  {review.migrations.map((line) => (
                    <li key={line}>{line}</li>
                  ))}
                </ul>
              ) : (
                <p>
                  No field changes detected. Review generated migrations and model constraints
                  before release.
                </p>
              )}
            </section>
            <section className="space-y-2">
              <h3 className="font-semibold">Release checks</h3>
              <p>
                {passed
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
                        {result.what}:{" "}
                        {!result.checked ? "not checked" : result.ok ? "passed" : "failed"}
                      </li>
                    ))}
                  </ul>
                </>
              )}
              <p className="text-sm text-muted">
                These records cover Git-visible source files. Runtime settings, ignored files and
                hosting checks need separate verification.
              </p>
            </section>
            <section className="space-y-2">
              <h3 className="font-semibold">Maintenance</h3>
              <p>{review.maintenance.status}.</p>
              <p>
                Generated engine: {review.maintenance.generatedEngine ?? "unknown"}; this tool:{" "}
                {review.maintenance.currentEngine}.
              </p>
              <p>
                Generated stack profile: {review.maintenance.generatedProfile ?? "unknown"}; this
                tool: {review.maintenance.currentProfile}.
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
                Deployed apps keep their generated code until updated and released. Test upgrades on
                a staged copy; metadata does not verify the running deployment.
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
            </section>
            <section className="space-y-2">
              <h3 className="font-semibold">Recovery</h3>
              <p>
                Last verified restore:{" "}
                {review.verifiedRestore ?? "none recorded by this local tool"}.
              </p>
              <p>
                A successful backup or file copy does not verify recovery. Use the hosting recovery
                view for deployed evidence.
              </p>
              <ul className="list-disc space-y-1 pl-5">
                <li>
                  <strong>Editor undo</strong> reverses a local change and may restore its
                  development database snapshot. It does not restore a published app.
                </li>
                <li>
                  <strong>Code rollback</strong> restores an earlier version of the code. It may
                  require the matching database schema.
                </li>
                <li>
                  <strong>Data restore</strong> replaces data with a snapshot. Records and uploads
                  added after that snapshot may be lost. Verify credentials and files as well as the
                  database.
                </li>
              </ul>
            </section>
          </>
        )}
        <Button onClick={() => dialog.current?.close()}>Close</Button>
      </div>
    </dialog>
  );
}
