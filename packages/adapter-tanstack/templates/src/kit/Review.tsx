// Smithable app kit: the review page (docs/design/file-review.md). The pictures and files people
// sent to reviewed fields, newest first, each with its record, who sent it and when, Approve, and
// Reject with a reason the sender sees; then what was decided in the last thirty days.
import { useState } from "react";
import { Button } from "#/components/ui/button";
import { Card } from "#/components/ui/card";
import { formatValue } from "./format";
import type { AppUi, FieldUi } from "./model";
import { w } from "./words";

export interface ReviewItem {
  id: number;
  label: string;
  title: string;
  href?: string;
  fieldLabel: string;
  kind: "picture" | "file";
  sender: string;
  sentAt: string | Date;
  state: string;
  reason: string | null;
}

/** When a file was sent, in the app's own time zone (the same on the server and in the browser). */
const SENT = { kind: "datetime" } as FieldUi;

export function Review({
  app,
  waiting,
  decided,
  fileUrl,
  onDecide,
}: {
  app: AppUi;
  waiting: ReviewItem[];
  decided: ReviewItem[];
  /** Where a reviewer opens the waiting file itself. */
  fileUrl: (id: number) => string;
  onDecide: (id: number, approve: boolean, reason?: string) => Promise<unknown>;
}) {
  return (
    <div data-kit="review" className="space-y-8">
      {waiting.length === 0 ? (
        <p className="text-muted-foreground">{w.reviewEmpty}</p>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {waiting.map((item) => (
            <li key={item.id}>
              <Waiting app={app} item={item} fileUrl={fileUrl} onDecide={onDecide} />
            </li>
          ))}
        </ul>
      )}
      {decided.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-lg font-semibold">{w.reviewDecided}</h2>
          <ul className="divide-y rounded-md border text-sm">
            {decided.map((item) => (
              <li key={item.id} data-part="decided" className="flex flex-wrap gap-x-3 px-4 py-2">
                <span className="font-medium">
                  {item.state === "approved" ? w.approved : w.rejected}
                </span>
                <span>
                  {item.label}: {item.title} · {item.fieldLabel}
                </span>
                {item.reason && <span className="text-muted-foreground">{item.reason}</span>}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function Waiting({
  app,
  item,
  fileUrl,
  onDecide,
}: {
  app: AppUi;
  item: ReviewItem;
  fileUrl: (id: number) => string;
  onDecide: (id: number, approve: boolean, reason?: string) => Promise<unknown>;
}) {
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const decide = async (approve: boolean) => {
    setBusy(true);
    try {
      await onDecide(item.id, approve, approve ? undefined : reason.trim() || undefined);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Card data-part="waiting" className="space-y-3 p-4">
      {item.kind === "picture" ? (
        <img
          src={fileUrl(item.id)}
          alt={`${item.label}: ${item.title}`}
          className="aspect-video w-full rounded-md bg-muted object-contain"
        />
      ) : (
        <a href={fileUrl(item.id)} target="_blank" rel="noreferrer" className="underline">
          {item.fieldLabel}
        </a>
      )}
      <div className="text-sm">
        <p className="font-medium">
          {item.label}:{" "}
          {item.href ? (
            <a href={item.href} className="underline">
              {item.title}
            </a>
          ) : (
            item.title
          )}{" "}
          · {item.fieldLabel}
        </p>
        <p className="text-muted-foreground">
          {w.sentBy(item.sender, formatValue(SENT, new Date(item.sentAt), app))}
        </p>
      </div>
      {rejecting ? (
        <div className="space-y-2">
          <p className="text-sm">{w.reviewRejectSure}</p>
          <label className="block text-[14px]">
            {w.rejectReason}
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              maxLength={500}
              className="mt-1 block w-full rounded-md border bg-background p-2"
            />
          </label>
          <div className="flex gap-2">
            <Button variant="destructive" disabled={busy} onClick={() => decide(false)}>
              {w.reject}
            </Button>
            <Button variant="outline" disabled={busy} onClick={() => setRejecting(false)}>
              {w.cancel}
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex gap-2">
          <Button disabled={busy} onClick={() => decide(true)}>
            {w.approve}
          </Button>
          <Button variant="outline" disabled={busy} onClick={() => setRejecting(true)}>
            {w.reject}
          </Button>
        </div>
      )}
    </Card>
  );
}

/**
 * On a record's page, for its owner and the reviewers: which of its files wait for review, and
 * which a reviewer rejected, with the reason (until a new file is sent).
 */
export function ReviewNotice({
  notes,
  labels,
}: {
  notes: { field: string; state: string; reason: string | null }[];
  labels: Record<string, string>;
}) {
  if (!notes.length) return null;
  return (
    <div
      role="status"
      data-part="review-notice"
      className="mb-4 space-y-1 rounded-md border bg-card px-4 py-2 text-sm"
    >
      {notes.map((note) => (
        <p key={`${note.field}-${note.state}-${note.reason ?? ""}`}>
          <span className="font-medium">{labels[note.field] ?? note.field}:</span>{" "}
          {note.state === "pending"
            ? w.awaitingReview
            : note.reason
              ? w.rejectedBecause(note.reason)
              : w.rejected}
        </p>
      ))}
    </div>
  );
}
