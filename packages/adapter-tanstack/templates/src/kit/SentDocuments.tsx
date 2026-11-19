// Smithable app kit: what was sent of a record's document (docs/design/record-documents.md §5):
// each sent copy, when, to whom, and whether its link still opens. Whoever may change the record
// may withdraw the links; a withdrawn link stays ended. Not printed with the document.
import { ActionButton } from "./ActionButton";
import { instantText } from "./format";
import { w } from "./words";

export interface SentCopy {
  id: number;
  sentAt: Date | string;
  to: { to: string; open: boolean }[];
}

export function SentDocuments({
  sent,
  timeZone,
  withdraw,
}: {
  sent: SentCopy[];
  timeZone?: string;
  /** Ends every open link; absent for whoever may not change the record. */
  withdraw?: () => Promise<unknown>;
}) {
  if (!sent.length) return null;
  const open = sent.some((copy) => copy.to.some((link) => link.open));
  return (
    <section
      data-kit="sent-documents"
      data-print="hide"
      aria-labelledby="sent-documents"
      className="mx-auto max-w-3xl space-y-3 p-8 pt-0"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="sent-documents" className="text-lg font-semibold">
          {w.document.sent}
        </h2>
        {withdraw && open && (
          <ActionButton
            label={w.document.withdraw}
            confirm={{ text: w.document.withdrawAsk }}
            onRun={withdraw}
          />
        )}
      </div>
      <ul className="space-y-2 text-sm">
        {sent.map((copy) => (
          <li key={copy.id}>
            <span className="text-muted-foreground">
              {w.document.sentAt(instantText(copy.sentAt, timeZone))}
            </span>
            <ul className="ms-4">
              {copy.to.map((link) => (
                <li key={link.to} data-open={link.open ? "true" : "false"}>
                  {link.to} · {link.open ? w.document.linkOpen : w.document.linkEnded}
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ul>
    </section>
  );
}
