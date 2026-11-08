// "Leave feedback" (A 242): the person's words, and up to three things they choose to add, each
// off at first and shown in full before anything leaves: what they did in Studio this session
// (the Changes lines), the spec files as a report sends them, and the last failure's report. It
// goes where Report this goes (cli/src/report.ts): the service when hosted; otherwise a public
// GitHub issue the panel says is public, or a mail. No "always" or "never": each time a choice.
import { useEffect, useRef, useState } from "react";
import { api } from "./api";
import { Button } from "./ui";

export function FeedbackDialog({
  changes,
  prefill = "",
  onClose,
}: {
  /** This session's Changes lines, as Changes words them. */
  changes: string[];
  /** Words already said to Smith ("feedback: …"). */
  prefill?: string;
  onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [comment, setComment] = useState(prefill);
  const [info, setInfo] = useState<{
    hosted: boolean;
    specFiles: Record<string, string>;
    failure?: string;
  }>();
  const [add, setAdd] = useState({ changes: false, specFiles: false, failure: false });
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<string>();
  const [link, setLink] = useState<string>();
  useEffect(() => {
    dialog.current?.showModal();
    api.feedback().then(setInfo, () => setInfo({ hosted: false, specFiles: {} }));
  }, []);
  const send = async (via: "issue" | "mail") => {
    setBusy(true);
    const result = await api
      .sendFeedback(
        comment.trim(),
        {
          ...(add.changes ? { changes } : {}),
          ...(add.specFiles ? { specFiles: true } : {}),
          ...(add.failure ? { failure: true } : {}),
        },
        via,
      )
      .catch((e: Error) => ({ ok: false, message: e.message, url: undefined, sent: undefined }));
    setBusy(false);
    // Opened after a wait, a browser may block the new tab: the link stays in the panel too.
    if (result.url) {
      setLink(result.url);
      window.open(result.url, "_blank", "noopener");
    }
    setDone(
      !result.ok
        ? (result.message ?? "The feedback could not be sent.")
        : result.url
          ? via === "mail"
            ? "It is ready in your mail program. Thank you."
            : "It is ready as an issue on GitHub: send it there. Thank you."
          : (result.message ?? "Sent to the Smithable team. Thank you."),
    );
  };
  const part = (
    key: "changes" | "specFiles" | "failure",
    label: string,
    shown: string | undefined,
  ) =>
    shown === undefined ? null : (
      <div className="space-y-1">
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={add[key]}
            onChange={(e) => setAdd({ ...add, [key]: e.target.checked })}
          />
          {label}
        </label>
        <details className="pl-6 text-xs">
          <summary className="cursor-pointer text-accent">What this sends</summary>
          <pre className="mt-1 max-h-40 overflow-auto rounded border border-line bg-surface p-2 whitespace-pre-wrap">
            {shown}
          </pre>
        </details>
      </div>
    );
  return (
    <dialog
      ref={dialog}
      aria-label="Leave feedback"
      onClose={onClose}
      className="m-auto w-[min(40rem,92vw)] rounded-lg bg-panel p-0 text-fg shadow-xl backdrop:bg-black/40"
    >
      <div className="space-y-3 p-4">
        <h2 className="text-base font-semibold">Leave feedback</h2>
        <textarea
          aria-label="Your feedback"
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          maxLength={5000}
          rows={5}
          placeholder="What works, what does not, what you wish it did"
          className="block w-full resize-y rounded-md border border-line-strong bg-panel px-2 py-1.5 text-sm"
        />
        <p className="text-xs text-muted">You may add, each only if you tick it:</p>
        {part(
          "changes",
          "What I did in Studio this session",
          changes.length ? changes.join("\n") : undefined,
        )}
        {part(
          "specFiles",
          "My app's spec files",
          info && Object.keys(info.specFiles).length
            ? Object.entries(info.specFiles)
                .map(([name, text]) => `# ${name}\n${text}`)
                .join("\n")
            : undefined,
        )}
        {part("failure", "The last failure's report", info?.failure)}
        {info && !info.hosted && (
          <p className="text-xs text-muted">
            It opens as an issue on GitHub, which anyone can read; or send it by mail instead.
          </p>
        )}
        {done && (
          <p role="status" className="text-sm">
            {done}{" "}
            {link && (
              <a href={link} target="_blank" rel="noreferrer" className="text-accent underline">
                {link.startsWith("mailto:") ? "Open the mail" : "Open the issue"}
              </a>
            )}
          </p>
        )}
        <div className="flex flex-wrap justify-end gap-2">
          {done ? (
            <Button onClick={() => dialog.current?.close()}>Close</Button>
          ) : (
            <>
              <Button variant="ghost" onClick={() => dialog.current?.close()}>
                Cancel
              </Button>
              {info && !info.hosted && (
                <Button
                  variant="ghost"
                  disabled={busy || !comment.trim()}
                  onClick={() => void send("mail")}
                >
                  Send by mail
                </Button>
              )}
              <Button
                disabled={busy || !comment.trim() || !info}
                onClick={() => void send("issue")}
              >
                {info?.hosted ? "Send" : "Open the issue"}
              </Button>
            </>
          )}
        </div>
      </div>
    </dialog>
  );
}
