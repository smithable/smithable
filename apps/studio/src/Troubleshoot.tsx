// Troubleshoot (docs/design/studio-v3.md §6): there is no Logs tab; when something went wrong
// the bar at the top offers this. The error in words, the dev server's last lines, and what the
// person can do: report it, undo the last change, or load Studio again. No "fix it with AI": a
// change Studio allowed that broke the app is Smithable's bug, not theirs to fix.
import { useEffect, useRef } from "react";
import { useLogs } from "./logs";
import { Button } from "./ui";

export function TroubleshootDialog({
  error,
  canUndo,
  onReport,
  onUndo,
  onClose,
}: {
  error: string;
  canUndo: boolean;
  onReport: () => void;
  onUndo: () => void;
  onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const logs = useLogs();
  useEffect(() => {
    dialog.current?.showModal();
  }, []);
  return (
    <dialog
      ref={dialog}
      aria-label="Troubleshoot"
      onClose={onClose}
      className="m-auto w-[min(48rem,92vw)] rounded-lg bg-panel p-0 text-fg shadow-xl backdrop:bg-black/40"
    >
      <div className="space-y-3 p-4">
        <h2 className="text-sm font-semibold">What went wrong</h2>
        <p className="whitespace-pre-wrap text-sm">{error}</p>
        <section aria-label="Logs" className="space-y-1">
          <h3 className="text-xs font-semibold text-quiet">The last lines of the app's log</h3>
          <pre className="max-h-64 overflow-auto whitespace-pre-wrap rounded-md bg-subtle p-2 font-mono text-xs text-fg-soft">
            {logs.slice(-60).join("\n") || "Nothing in the log."}
          </pre>
        </section>
        <div className="flex flex-wrap justify-end gap-2">
          <Button variant="ghost" onClick={onReport}>
            Report
          </Button>
          <Button
            variant="ghost"
            disabled={!canUndo}
            onClick={() => {
              onUndo();
              onClose();
            }}
          >
            Undo last change
          </Button>
          <Button variant="ghost" onClick={() => location.reload()}>
            Reload Studio
          </Button>
          <Button onClick={onClose}>Close</Button>
        </div>
      </div>
    </dialog>
  );
}
