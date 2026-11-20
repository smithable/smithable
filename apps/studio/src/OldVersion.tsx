// The isolated copy runs in its own tab so its sign-in cookie works on its separate host.
import { useLayoutEffect, useRef } from "react";
import type { ApplyVersionResult } from "./api";
import { versionTime } from "./history";
import { Button } from "./ui";

export interface OpenOld {
  commit: string;
  revision?: string;
  closeKey?: string;
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
  error,
  onBack,
  onOpenAgain,
  onApply,
}: {
  description: string;
  open: OpenOld | undefined;
  closing: boolean;
  error: string | undefined;
  onBack: () => void;
  onOpenAgain: () => void;
  onApply?: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  useLayoutEffect(() => {
    const node = dialog.current;
    node?.showModal();
    return () => node?.close();
  }, []);
  useLayoutEffect(() => {
    if (!closing) dialog.current?.querySelector<HTMLButtonElement>("[data-back-current]")?.focus();
  }, [closing]);

  return (
    <dialog
      ref={dialog}
      aria-label="An old version"
      className="fixed inset-0 m-0 h-full max-h-none w-full max-w-none border-0 bg-panel p-0 text-fg open:flex open:flex-col"
      onCancel={(event) => {
        event.preventDefault();
        if (event.cancelable && !closing) onBack();
      }}
      onClose={(event) => {
        if (!event.currentTarget.open) event.currentTarget.showModal();
        if (!closing) onBack();
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
        <Button data-back-current variant="ghost" onClick={onBack} disabled={closing}>
          {open ? "Back to current" : "Cancel preview"}
        </Button>
      </header>
      <div className="m-auto max-w-md space-y-3 p-6 text-center text-sm">
        {error && <p role="alert">{error} Try again.</p>}
        {closing ? (
          <p role="status">Closing the preview…</p>
        ) : open ? (
          <>
            <p>
              The old version is open in its own tab{" "}
              {open.data === "then" ? "with a copy of the data from then" : "with sample data"}
              {open.pictures === "today" ? " and today’s pictures" : ", without pictures"}. You can
              sign in and try it. Back to current removes the copy and discards everything you did
              there. Close its tab when you’re done.
            </p>
            <Button onClick={onOpenAgain}>Show its tab</Button>
            {onApply && (
              <Button variant="ghost" onClick={onApply}>
                Apply this version
              </Button>
            )}
          </>
        ) : (
          <p role="status">Preparing the old version…</p>
        )}
      </div>
    </dialog>
  );
}

export function ApplyVersionDialog({
  result,
  applying,
  onApply,
  onClose,
}: {
  result?: ApplyVersionResult;
  applying: boolean;
  onApply: (plan: string) => void;
  onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  useLayoutEffect(() => {
    const node = dialog.current;
    node?.showModal();
    return () => node?.close();
  }, []);
  useLayoutEffect(() => {
    if (!applying) dialog.current?.querySelector<HTMLButtonElement>("[data-close-apply]")?.focus();
  }, [applying]);
  const plan = result?.ok === false ? result.plan : undefined;

  return (
    <dialog
      ref={dialog}
      aria-label="Apply this version"
      aria-busy={applying || !result}
      className="m-auto w-[min(32rem,92vw)] rounded-lg bg-panel p-5 text-fg shadow-xl backdrop:bg-black/30"
      onCancel={(event) => {
        event.preventDefault();
        if (!applying) onClose();
      }}
    >
      <h2 className="mb-3 text-base font-semibold">Apply this version</h2>
      {result?.ok === false && result.changed && (
        <p role="alert" className="mb-2 font-medium">
          The plan changed. Review what applying it would do now.
        </p>
      )}
      {result ? (
        <p className="whitespace-pre-wrap break-words text-sm" role={plan ? undefined : "status"}>
          {result.output}
        </p>
      ) : (
        <p role="status">Checking what would change…</p>
      )}
      <div className="mt-4 flex justify-end gap-2">
        <Button data-close-apply variant="ghost" onClick={onClose} disabled={applying}>
          {plan || !result ? "Cancel" : "Close"}
        </Button>
        {plan && (
          <Button disabled={applying} onClick={() => onApply(plan)}>
            {applying ? "Applying…" : "Apply this version"}
          </Button>
        )}
      </div>
    </dialog>
  );
}
