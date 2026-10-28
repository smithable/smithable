// The sample users (docs/design/sample-users.md §6): people of the sample data who use the app by
// themselves in the preview. Who they are, what they did and the app's answers, with run, pause
// and step, and Follow, which opens the preview signed in as one of them. A panel beside the
// preview, not over it: the point is to watch the app while they act.
import { useEffect, useRef } from "react";
import { api, type PeopleState } from "./api";
import { Button, cx } from "./ui";

export function PeoplePanel({
  state,
  onState,
  onFollow,
  onClose,
}: {
  state?: PeopleState;
  onState: (state: PeopleState) => void;
  /** Opens the preview signed in as this sample user. */
  onFollow: (id: string) => void;
  onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    dialog.current?.show();
    api.people().then(onState, () => {});
  }, [onState]);
  const act = (what: "run" | "fast" | "pause" | "step" | "clear") =>
    api.peopleDo(what).then(onState, () => {});
  const feed = [...(state?.feed ?? [])].reverse();
  return (
    <dialog
      ref={dialog}
      aria-label="Sample users"
      onClose={onClose}
      className="fixed right-4 bottom-4 left-auto top-auto z-50 m-0 flex max-h-[70vh] w-[min(26rem,94vw)] flex-col rounded-lg border border-line bg-panel p-0 text-fg shadow-xl"
    >
      <div className="flex items-center gap-2 border-b border-line px-3 py-2">
        <h2 className="flex-1 text-sm font-semibold">Sample users</h2>
        <Button variant="ghost" className="h-6" onClick={() => dialog.current?.close()}>
          Close
        </Button>
      </div>
      <div className="min-h-0 space-y-3 overflow-auto p-3 text-sm">
        <p className="text-muted">
          People of the sample data who use the app by themselves, each at their own pace, through
          its own pages and rules. Only in this preview, never in the published app.
        </p>
        {state && state.people.length === 0 && !state.stopped && (
          <p>No sample users yet: add them to samples/people.yml.</p>
        )}
        {state?.stopped && (
          <p role="status" className="text-amber-800">
            {state.stopped}
          </p>
        )}
        <div className="flex flex-wrap items-center gap-2">
          {state?.running ? (
            <Button onClick={() => void act("pause")}>Pause</Button>
          ) : (
            <Button onClick={() => void act("run")}>Let them run</Button>
          )}
          <Button variant="ghost" onClick={() => void act("step")} disabled={state?.running}>
            One move
          </Button>
          <Button
            variant="ghost"
            title="Moves picked at random, one after another, without a model: a quick test"
            onClick={() => void act("fast")}
            disabled={state?.running && state.fast}
          >
            Fast
          </Button>
          <span className="ml-auto text-xs text-muted">
            {state?.moves ?? 0} moves
            {state && state.cost > 0 ? ` · ${state.cost.toFixed(3)} ${state.currency}` : ""}
          </span>
        </div>
        {state && state.people.length > 0 && (
          <ul className="space-y-2">
            {state.people.map((p) => (
              <li key={p.id} className="flex items-start gap-2">
                <div className="min-w-0 flex-1">
                  <p className="font-medium">
                    {p.name} <span className="font-normal text-muted">· {p.role}</span>
                  </p>
                  <p className="truncate text-xs text-muted" title={p.persona}>
                    {p.last ?? p.persona}
                  </p>
                </div>
                {p.id !== "visitor" && (
                  <Button
                    variant="ghost"
                    className="h-6"
                    title={`Open the preview signed in as ${p.name}`}
                    onClick={() => onFollow(p.id)}
                  >
                    Follow
                  </Button>
                )}
              </li>
            ))}
          </ul>
        )}
        {feed.length > 0 && (
          <div className="space-y-1">
            <div className="flex items-center">
              <h3 className="flex-1 text-xs font-semibold text-muted uppercase">What they did</h3>
              <Button variant="ghost" className="h-6" onClick={() => void act("clear")}>
                Clear
              </Button>
            </div>
            <ol aria-label="What they did" className="space-y-1">
              {feed.map((l) => (
                <li
                  key={`${l.at}-${l.id}`}
                  data-outcome={l.outcome}
                  className={cx(
                    "rounded px-2 py-1",
                    l.outcome === "refused" && "bg-amber-50 text-amber-950",
                    l.outcome === "finding" && "bg-red-50 text-red-900",
                    l.outcome === "miss" && "text-muted",
                  )}
                >
                  <span className="text-xs text-muted">{time(l.at)}</span> <b>{l.who}</b>: {l.text}
                  {l.why && <span className="text-muted"> ({l.why})</span>}
                  {l.message && (
                    <span className="block text-xs">
                      {l.outcome === "refused"
                        ? `Refused: ${l.message}`
                        : l.outcome === "finding"
                          ? `The app failed: ${l.message}${l.seed !== undefined ? ` (seed ${l.seed})` : ""}`
                          : l.message}
                    </span>
                  )}
                </li>
              ))}
            </ol>
          </div>
        )}
      </div>
    </dialog>
  );
}

const time = (at: string) =>
  new Date(at).toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
