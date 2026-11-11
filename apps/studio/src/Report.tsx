// "Report this": the report of a failure, shown in full before it is sent (cli/src/report.ts).
// Sent to the service when hosted; self-hosted, a prefilled GitHub issue opens. Each report is
// sent by hand (legal-1.0 section 3); "Never ask" is remembered for the person.
import { useEffect, useRef, useState } from "react";
import { api } from "./api";
import { Button } from "./ui";

export function ReportDialog({ onClose }: { onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [text, setText] = useState<string>();
  const [done, setDone] = useState<string>();
  useEffect(() => {
    dialog.current?.showModal();
    api
      .report()
      .then((r) => setText(r.text ?? "Nothing has failed, so there is nothing to report."))
      .catch((e: Error) => setText(e.message));
  }, []);
  const send = async (choice?: "never") => {
    if (choice === "never") {
      await api.sendReport(false, "never");
      onClose();
      return;
    }
    const result = await api.sendReport(true);
    if (result.url) window.open(result.url, "_blank", "noopener");
    setDone(
      !result.ok
        ? (result.message ?? "The report could not be sent.")
        : result.url
          ? "The issue opened on GitHub; attach the spec files there if you can."
          : (result.message ?? "Sent. Thank you."),
    );
  };
  return (
    <dialog
      ref={dialog}
      aria-label="Report this"
      onClose={onClose}
      className="m-auto w-[min(48rem,92vw)] rounded-lg bg-panel p-0 text-fg shadow-xl backdrop:bg-black/40"
    >
      <div className="space-y-3 p-4">
        <h2 className="text-base font-semibold">Report this</h2>
        {/* The error report's notice, as legal-1.0 U6 words it. */}
        <p className="text-sm text-muted">
          Send this report to Smithable to investigate the failure. Review the attached prompt, spec
          and log excerpt below: it is everything the report sends, with no records, uploads or code
          of your own. It is retained for 90 days unless an identified dispute requires restricted
          retention. Sending is optional.
        </p>
        <pre className="max-h-[50vh] overflow-auto rounded border border-line bg-surface p-2 text-xs whitespace-pre-wrap">
          {text ?? "…"}
        </pre>
        {done ? (
          <p role="status" className="text-sm">
            {done}
          </p>
        ) : null}
        <div className="flex flex-wrap justify-end gap-2">
          {done ? (
            <Button onClick={() => dialog.current?.close()}>Close</Button>
          ) : (
            <>
              <Button variant="ghost" onClick={() => void send("never")}>
                Never ask
              </Button>
              <Button variant="ghost" onClick={() => dialog.current?.close()}>
                Cancel
              </Button>
              <Button disabled={!text} onClick={() => void send()}>
                Send report
              </Button>
            </>
          )}
        </div>
      </div>
    </dialog>
  );
}
