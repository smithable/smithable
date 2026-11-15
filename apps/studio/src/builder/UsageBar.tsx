import { useEffect, useId, useState } from "react";
import { api, type ModelUsage } from "../api";

const kind = {
  change: "Change",
  question: "Question",
  "first build": "First build",
  assistant: "App assistant",
  other: "Other request",
};
const reset = (at: string) =>
  new Date(at).toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

export function UsageBar({ busy, revision }: { busy: boolean; revision?: string }) {
  const [usage, setUsage] = useState<ModelUsage>();
  const [open, setOpen] = useState(false);
  const id = useId();
  // Refresh after a request or an external change, and as the account's window rolls over.
  // biome-ignore lint/correctness/useExhaustiveDependencies: revision refreshes changes made outside this panel
  useEffect(() => {
    if (busy) return;
    let live = true;
    const refresh = () =>
      api.modelUsage().then(
        (next) => {
          if (live) setUsage("window" in next ? (next as ModelUsage) : undefined);
        },
        () => {
          if (live) setUsage(undefined);
        },
      );
    void refresh();
    const timer = setInterval(refresh, 60_000);
    return () => {
      live = false;
      clearInterval(timer);
    };
  }, [busy, revision]);
  if (!usage) return null;
  const { window: allowance, paused, recent } = usage;
  return (
    <section
      aria-label="AI help usage"
      className="shrink-0 space-y-2 border-t border-line px-3 py-2 text-xs"
    >
      <button
        type="button"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen(!open)}
        className="block w-full space-y-1 text-left"
      >
        <span className="flex justify-between gap-2">
          <span>
            AI help: €{allowance.used.toFixed(2)} of €{allowance.allowed.toFixed(2)} used
          </span>
          <span aria-hidden="true">{open ? "▴" : "▾"}</span>
        </span>
        <progress
          aria-label="AI help used"
          value={Math.min(allowance.used, allowance.allowed)}
          max={allowance.allowed || 1}
          className="block h-1.5 w-full accent-accent"
        />
        <span className="block text-muted">Resets {reset(allowance.resetsAt)}</span>
      </button>
      {paused.is && (
        <p>
          {paused.reason === "shared"
            ? "AI help is paused for the service. Your account's allowance is shown above."
            : "Your AI help is paused until its allowance resets."}
        </p>
      )}
      {open && (
        <div id={id} className="max-h-40 overflow-auto">
          {recent.length ? (
            <ol aria-label="Recent AI charges" className="space-y-1">
              {recent.map((row, index) => (
                // biome-ignore lint/suspicious/noArrayIndexKey: identical timestamped charges have no id, and these rows hold no state
                <li key={`${row.at}:${index}`} className="flex justify-between gap-2">
                  <span>
                    {kind[row.kind]} · <time dateTime={row.at}>{reset(row.at)}</time>
                  </span>
                  <span>€{row.cost.toFixed(4)}</span>
                </li>
              ))}
            </ol>
          ) : (
            <p className="text-muted">No charges yet.</p>
          )}
        </div>
      )}
    </section>
  );
}
