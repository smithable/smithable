// The isolated copy runs in its own tab so its sign-in cookie works on its separate host.
import { useLayoutEffect, useRef } from "react";
import { versionTime } from "./history";
import { Button } from "./ui";

export interface OpenOld {
  description: string;
  at: string;
  url: string;
  data: "then" | "samples";
  pictures: "today" | "none";
}

/** Open the tab at the user's click so the browser does not block it after preparation. */
export function openOldTab(): Window | null {
  const tab = window.open("", "_blank");
  if (tab) {
    tab.opener = null;
    tab.document.title = "Preparing the old version…";
    tab.document.body.textContent = "Preparing the old version…";
  }
  return tab;
}

export function OldVersion({
  description,
  open,
  closing,
  onBack,
  onOpenAgain,
}: {
  description: string;
  open: OpenOld | undefined;
  closing: boolean;
  onBack: () => void;
  onOpenAgain: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  useLayoutEffect(() => {
    const node = dialog.current;
    node?.showModal();
    return () => node?.close();
  }, []);
  useLayoutEffect(() => {
    if (open && !closing)
      dialog.current?.querySelector<HTMLButtonElement>("[data-back-current]")?.focus();
  }, [open, closing]);

  return (
    <dialog
      ref={dialog}
      aria-label="An old version"
      className="fixed inset-0 m-0 h-full max-h-none w-full max-w-none border-0 bg-panel p-0 text-fg open:flex open:flex-col"
      onCancel={(event) => {
        event.preventDefault();
        if (open && !closing) onBack();
      }}
    >
      <header className="flex flex-wrap items-start justify-between gap-3 border-b border-line bg-subtle px-4 py-3">
        <div className="min-w-0">
          <h2 className="text-base font-semibold">
            {open ? "Viewing an old version" : "Old version"}
          </h2>
          <p className="break-words text-sm text-muted">{description}</p>
          {open && (
            <time dateTime={open.at} className="text-xs text-muted">
              {versionTime(open.at)}
            </time>
          )}
        </div>
        {open && (
          <Button data-back-current variant="ghost" onClick={onBack} disabled={closing}>
            Back to current
          </Button>
        )}
      </header>
      <div className="m-auto max-w-md space-y-3 p-6 text-center text-sm">
        {closing ? (
          <p role="status">Closing the preview…</p>
        ) : open ? (
          <>
            <p>
              The old version is open in its own tab{" "}
              {open.data === "then" ? "with a copy of the data from then" : "with sample data"}
              {open.pictures === "today" ? " and today’s pictures" : ", without pictures"}. You can
              sign in and try it. Changes in that tab are discarded when you go back.
            </p>
            <Button onClick={onOpenAgain}>Show its tab</Button>
          </>
        ) : (
          <p role="status">Preparing the old version…</p>
        )}
      </div>
    </dialog>
  );
}
