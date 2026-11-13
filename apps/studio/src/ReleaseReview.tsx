import { useEffect, useRef, useState } from "react";
import { api, type ReleaseReview as Review } from "./api";
import { Button } from "./ui";

/** The release review as the server reads it now, or why it could not be read. */
const read = (setReview: (r: Review) => void, setError: (e: string) => void) =>
  api
    .releaseReview()
    .then(setReview)
    .catch((error: Error) => setError(error.message));

export function ReleaseReview({ onClose }: { onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [review, setReview] = useState<Review>();
  const [error, setError] = useState<string>();
  const [refused, setRefused] = useState<string>();
  const load = () => read(setReview, setError);
  useEffect(() => {
    dialog.current?.showModal();
    void read(setReview, setError);
  }, []);
  // The owner reads the privacy page and says so: the facts as they are now, today (UTC).
  const reviewPrivacy = async (page: string, facts: string) => {
    setRefused(undefined);
    const on = new Date().toISOString().slice(0, 10);
    const result = await api
      .operation("reviewPrivacyPage", { page, facts, on })
      .catch((e: Error) => ({ ok: false, output: e.message }));
    if (!result.ok) setRefused(result.output);
    await load();
  };
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
            {review.privacy && review.privacy.length > 0 && (
              <section className="space-y-2" aria-label="Privacy page">
                <h3 className="font-semibold">Privacy page</h3>
                {review.privacy.map((p) => (
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
                    {p.state !== "reviewed" && (
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-muted">Read it in the preview first.</span>
                        <Button onClick={() => void reviewPrivacy(p.page, p.facts)}>
                          {p.state === "changed" ? "Review it again" : "Review it"}
                        </Button>
                      </div>
                    )}
                  </div>
                ))}
                {refused && <p role="alert">{refused}</p>}
                <p className="text-sm text-muted">
                  Reviewing records that you read this description as it is now. The page says so
                  until it changes; it is not legal advice.
                </p>
              </section>
            )}
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
