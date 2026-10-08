// The preview's outbox: the mails the app kept instead of sending (a preview sends no mail), so
// a creator can open an invitation's link or read a sign-in code. Served by Studio only.
import { Fragment, useCallback, useEffect, useRef, useState } from "react";
import { api, type KeptMail } from "./api";
import { Button } from "./ui";

export function OutboxDialog({ onClose }: { onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [mails, setMails] = useState<KeptMail[]>();
  const [open, setOpen] = useState<string>();
  const [failure, setFailure] = useState<string>();
  const load = useCallback(
    () =>
      api.outbox().then(
        (list) => {
          setMails(list);
          setOpen((current) => current ?? list[0]?.file);
        },
        (e: Error) => setFailure(e.message),
      ),
    [],
  );
  useEffect(() => {
    dialog.current?.showModal();
    void load();
  }, [load]);
  const shown = mails?.find((m) => m.file === open);
  return (
    <dialog
      ref={dialog}
      aria-label="Outbox"
      onClose={onClose}
      className="m-auto w-[min(56rem,94vw)] rounded-lg p-0 shadow-xl backdrop:bg-black/40"
    >
      <div className="space-y-3 p-4">
        <h2 className="text-base font-semibold">Outbox</h2>
        <p className="text-sm text-neutral-600">
          The preview sends no mail. What the app would have sent is kept here: invitations, sign-in
          codes, messages and notifications. Mail goes out once the app is published.
        </p>
        {failure && (
          <p role="alert" className="text-sm text-red-700">
            {failure}
          </p>
        )}
        {mails?.length === 0 && <p className="text-sm">Nothing yet.</p>}
        {mails && mails.length > 0 && (
          <div className="grid gap-3 sm:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
            <ul className="max-h-[55vh] space-y-1 overflow-auto">
              {mails.map((m) => (
                <li key={m.file}>
                  <button
                    type="button"
                    aria-current={m.file === open || undefined}
                    onClick={() => setOpen(m.file)}
                    className="w-full rounded px-2 py-1.5 text-left text-sm hover:bg-neutral-100 aria-[current]:bg-neutral-100"
                  >
                    <span className="block truncate font-medium">
                      {m.subject || "(no subject)"}
                    </span>
                    <span className="block truncate text-xs text-neutral-600">
                      {m.to} · {when(m.at)}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
            {shown && (
              <div className="min-w-0 space-y-2">
                <p className="text-sm">
                  <span className="text-neutral-600">To</span> {shown.to}
                </p>
                <pre className="max-h-[50vh] overflow-auto rounded border border-neutral-200 bg-neutral-50 p-2 text-xs whitespace-pre-wrap">
                  {linked(shown.text)}
                </pre>
              </div>
            )}
          </div>
        )}
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={() => void load()}>
            Refresh
          </Button>
          <Button onClick={() => dialog.current?.close()}>Close</Button>
        </div>
      </div>
    </dialog>
  );
}

const when = (date: string) => {
  const at = new Date(date);
  return Number.isNaN(at.getTime()) ? date : at.toLocaleString();
};

/** The text with its addresses as links, opened beside Studio (an invitation's link). */
function linked(text: string) {
  // Each part is keyed by where it starts in the text.
  let start = 0;
  return text.split(/(https?:\/\/[^\s<>"]+)/g).map((part) => {
    const at = start;
    start += part.length;
    return /^https?:\/\//.test(part) ? (
      <a key={at} href={part} target="_blank" rel="noreferrer" className="underline">
        {part}
      </a>
    ) : (
      <Fragment key={at}>{part}</Fragment>
    );
  });
}
