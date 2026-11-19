// The preview's outbox: the mails the app kept instead of sending (a preview sends no mail), so
// a creator can open an invitation's link or read a sign-in code. Served by Studio only.
import { humanize } from "@smithable/core";
import { Fragment, type ReactNode, useCallback, useEffect, useState } from "react";
import { api, type KeptMail } from "./api";
import { StudioOverlay } from "./StudioOverlay";
import { Button } from "./ui";

export function OutboxDialog({
  narrow,
  templates,
  editTemplate,
  onClose,
}: {
  narrow: boolean;
  templates: string[];
  editTemplate: (name: string, onBack: () => void) => ReactNode;
  onClose: () => void;
}) {
  const [template, setTemplate] = useState<string>();
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
    void load();
  }, [load]);
  const shown = mails?.find((m) => m.file === open);
  return (
    <>
      <StudioOverlay
        name="outbox"
        title="Outbox"
        narrow={narrow}
        width="wide"
        modal
        onClose={onClose}
      >
        <div className="space-y-3 p-4">
          <p className="text-sm text-muted">
            The preview sends no mail. What the app would have sent is kept here: invitations,
            sign-in codes, messages and notifications. Mail goes out once the app is published.
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
                      className="w-full rounded px-2 py-1.5 text-left text-sm hover:bg-subtle aria-[current]:bg-subtle"
                    >
                      <span className="block truncate font-medium">
                        {m.subject || "(no subject)"}
                      </span>
                      <span className="block truncate text-xs text-muted">
                        {m.to} · {when(m.at)}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
              {shown && (
                <div className="min-w-0 space-y-2">
                  <p className="text-sm">
                    <span className="text-muted">To</span> {shown.to}
                  </p>
                  <pre className="max-h-[50vh] overflow-auto rounded border border-line bg-surface p-2 text-xs whitespace-pre-wrap">
                    {linked(shown.text)}
                  </pre>
                </div>
              )}
            </div>
          )}
          {templates.length > 0 && (
            <section aria-label="Mail templates" className="space-y-2 border-t border-line pt-3">
              <h3 className="text-sm font-semibold">Mail templates</h3>
              <ul className="space-y-1">
                {templates.map((name) => (
                  <li key={name}>
                    <Button variant="ghost" onClick={() => setTemplate(name)}>
                      Edit mail template for {humanize(name)}
                    </Button>
                  </li>
                ))}
              </ul>
            </section>
          )}
          <div className="flex justify-end">
            <Button variant="ghost" onClick={() => void load()}>
              Refresh
            </Button>
          </div>
        </div>
      </StudioOverlay>
      {template && editTemplate(template, () => setTemplate(undefined))}
    </>
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
