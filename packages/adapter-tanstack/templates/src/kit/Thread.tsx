// Smithable app kit: a list of related records as a conversation (docs/design/conversation.md):
// the messages in the order they came, each with who wrote it, when, its text, its badges and its
// files; ours on the right, the other side's on the left; and a reply box that adds one by the
// message model's ordinary create, the record it belongs to filled in.
import { useState } from "react";
import { Badge } from "#/components/ui/badge";
import { Button } from "#/components/ui/button";
import { cn } from "#/lib/utils";
import { displayValue, formatValue } from "./format";
import type { AppUi, RecordUi, Row } from "./model";
import { w } from "./words";

export function Thread<R extends Row>({
  ui,
  app,
  rows,
  text,
  writer,
  side,
  files = [],
  badges = [],
  empty,
  reply,
}: {
  ui: RecordUi<R>;
  app: AppUi;
  rows: R[];
  /** The field that is the message: the model's first long text. */
  text: string;
  /** Who wrote it: the first field that refers to a person, else the first email. */
  writer?: string;
  /** The first two-valued choice, its first value being our side (on the right). */
  side?: { field: string; ours: string };
  /** The files and pictures fields, shown by name under the text. */
  files?: string[];
  /** The other choices, shown as badges. */
  badges?: string[];
  /** "No messages yet". */
  empty: string;
  /** Sends a reply with the text; none for whoever may not add one. */
  reply?: (text: string) => Promise<unknown>;
}) {
  const field = (name: string) => ui.fields.find((f) => f.name === name);
  const shown = [...rows].sort(
    (a, b) =>
      new Date(String(a.createdAt ?? 0)).getTime() - new Date(String(b.createdAt ?? 0)).getTime() ||
      Number(a.id) - Number(b.id),
  );
  const value = (name: string, row: R) => {
    const f = field(name);
    return f ? formatValue(f, displayValue(f, row), app) : "";
  };
  const when = (row: R) =>
    row.createdAt
      ? new Intl.DateTimeFormat(undefined, {
          dateStyle: "medium",
          timeStyle: "short",
          hourCycle: "h23",
          timeZone: app.timeZone,
        }).format(new Date(String(row.createdAt)))
      : "";
  return (
    <div data-kit="thread" className="space-y-4">
      {shown.length === 0 ? (
        <p className="text-muted-foreground">{empty}</p>
      ) : (
        <ol className="space-y-3">
          {shown.map((row) => {
            const ours = side ? String(row[side.field as keyof R] ?? "") === side.ours : false;
            const by = writer ? value(writer, row) : "";
            return (
              <li
                key={String(row.id)}
                data-part="message"
                data-side={side ? (ours ? "ours" : "theirs") : undefined}
                className={cn("flex", ours ? "justify-end" : "justify-start")}
              >
                <article
                  className={cn(
                    "max-w-[85%] space-y-2 rounded-lg border p-3",
                    ours ? "bg-accent text-accent-foreground" : "bg-card",
                  )}
                >
                  <header className="flex flex-wrap items-baseline gap-x-2 text-sm text-muted-foreground">
                    {by && by !== "—" && <span className="font-medium text-foreground">{by}</span>}
                    <time>{when(row)}</time>
                    {badges.map((name) => {
                      const shownValue = value(name, row);
                      return shownValue && shownValue !== "—" ? (
                        <Badge key={name}>{shownValue}</Badge>
                      ) : null;
                    })}
                  </header>
                  <p className="whitespace-pre-wrap [overflow-wrap:anywhere]">
                    {String(row[text as keyof R] ?? "")}
                  </p>
                  {files.map((name) => {
                    const names = value(name, row);
                    return names && names !== "—" ? (
                      <p key={name} className="text-sm text-muted-foreground">
                        {names}
                      </p>
                    ) : null;
                  })}
                </article>
              </li>
            );
          })}
        </ol>
      )}
      {reply && <ReplyBox reply={reply} />}
    </div>
  );
}

/** The reply box: the text and Send; the thread shows the new message once it is added. */
function ReplyBox({ reply }: { reply: (text: string) => Promise<unknown> }) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<string>();
  return (
    <form
      data-part="reply"
      className="space-y-2"
      onSubmit={async (event) => {
        event.preventDefault();
        if (!text.trim() || busy) return;
        setBusy(true);
        setFailure(undefined);
        try {
          await reply(text.trim());
          setText("");
        } catch (error) {
          setFailure(error instanceof Error ? error.message : w.somethingWentWrong);
        } finally {
          setBusy(false);
        }
      }}
    >
      <textarea
        aria-label={w.reply}
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={3}
        className="block w-full rounded-md border border-input bg-card px-3 py-2 text-sm"
      />
      {failure && (
        <p role="alert" className="text-sm text-destructive">
          {failure}
        </p>
      )}
      <Button type="submit" disabled={busy || !text.trim()}>
        {w.send}
      </Button>
    </form>
  );
}
