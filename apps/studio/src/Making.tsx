// While a described app is being made (docs/design/while-it-is-made.md, stage one): the
// description, the stage, a bar on the usual time, and "What it does" as soon as the model has
// answered. Until the app is in place the project's own files are the waiting workspace's
// placeholder, so nothing of them is shown.
import { summarize } from "@smithable/index";
import { useEffect, useMemo, useState } from "react";
import { api, type Making as MakingState, type Project } from "./api";
import { useSpec } from "./engine";
import { Button } from "./ui";

const STAGES: Record<MakingState["stage"], string> = {
  drafting: "Drafting your app",
  building: "Building it",
  arriving: "Starting the preview",
  failed: "It could not be made",
};

/** The usual time a draft takes, when the service has not said. */
const USUAL = 25_000;

/**
 * How far the bar is: along the usual time to nine tenths, then ever slower towards the end,
 * which it reaches only when the app is in place (the bar is gone then).
 */
export function progress(elapsed: number, usual = USUAL): number {
  if (elapsed <= usual) return (0.9 * Math.max(elapsed, 0)) / usual;
  return 0.9 + 0.09 * (1 - Math.exp(-(elapsed - usual) / usual));
}

export function Making({
  making,
  project,
}: {
  making: MakingState;
  project: Pick<Project, "plugins" | "ownThemes">;
}) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (making.stage === "failed") return;
    const timer = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(timer);
  }, [making.stage]);
  const usual = making.usual ?? USUAL;
  const elapsed = now - Date.parse(making.since);
  // "What it does" of the drafted app, as Builder says it for any app.
  const drafted = useMemo(
    () => (making.files ? { ...project, files: making.files } : undefined),
    [making.files, project],
  );
  const spec = useSpec(drafted);
  const sections = useMemo(
    () => (spec.ir ? summarize(spec.ir, spec.auth, spec.content, spec.plugins) : []),
    [spec],
  );
  const [retrying, setRetrying] = useState(false);
  const failed = making.stage === "failed";
  return (
    <section aria-label="Your app is being made" className="mx-auto w-full max-w-2xl space-y-6 p-6">
      <div className="space-y-2">
        <h1 className="text-lg font-semibold">
          {failed ? "Your app could not be made" : "Your app is being made"}
        </h1>
        {sections.length === 0 && (
          <blockquote className="border-l-2 border-neutral-300 pl-3 text-sm text-neutral-700">
            {making.description}
          </blockquote>
        )}
      </div>
      {failed ? (
        <div
          role="alert"
          className="space-y-3 rounded-md border border-red-200 bg-red-50 p-3 text-sm"
        >
          {making.error && <p className="text-red-800">{making.error}</p>}
          <Button
            disabled={retrying}
            onClick={async () => {
              setRetrying(true);
              await api.retryMaking().catch(() => undefined);
              setRetrying(false);
            }}
          >
            Try again
          </Button>
        </div>
      ) : (
        <div className="space-y-1.5">
          <div className="flex justify-between text-xs text-neutral-600">
            <span role="status">{STAGES[making.stage]}…</span>
            {elapsed > usual && <span>Taking a little longer than usual</span>}
          </div>
          <div
            role="progressbar"
            aria-label="How far it is"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(progress(elapsed, usual) * 100)}
            className="h-1.5 overflow-hidden rounded-full bg-neutral-200"
          >
            <div
              className="h-full rounded-full bg-accent transition-[width] duration-300 ease-out"
              style={{ width: `${progress(elapsed, usual) * 100}%` }}
            />
          </div>
        </div>
      )}
      {sections.length > 0 && (
        <section aria-label="What it does" className="space-y-4">
          <h2 className="text-sm font-semibold text-neutral-600">What it does</h2>
          {sections.map((s) => (
            <div key={s.concept} className="space-y-1">
              <h3 className="text-sm font-medium">{s.title}</h3>
              {s.sentences.map((line) => (
                <p key={line} className="text-sm text-neutral-700">
                  {line}
                </p>
              ))}
            </div>
          ))}
        </section>
      )}
      {/* A place for an animation later (docs/design/while-it-is-made.md §7). */}
      <div data-slot="making-animation" />
    </section>
  );
}
