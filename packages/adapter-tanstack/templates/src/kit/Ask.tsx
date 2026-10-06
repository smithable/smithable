// Smithable app kit: "Ask" for the people who use the app (docs/design/assistant.md §4 and §6): a
// button that opens a sheet with a question field; the answer is worked out by the app with what
// the person may read, marked as from the records or by an AI, and can be read aloud.
import { useRef, useState } from "react";
import { Badge } from "#/components/ui/badge";
import { Button } from "#/components/ui/button";
import { Input } from "#/components/ui/input";
import type { Answer } from "./assistant.server";
import { Shown } from "./Inspector";
import { w } from "./words";

export function Ask({
  ask,
  confirm,
}: {
  ask: (question: string) => Promise<Answer>;
  /** With may: change: makes a proposed change once the person confirms it. */
  confirm?: (proposal: string) => Promise<unknown>;
}) {
  const sheet = useRef<HTMLDialogElement>(null);
  const [question, setQuestion] = useState("");
  const [asked, setAsked] = useState<{ question: string; answer?: Answer; failed?: string }[]>([]);
  const [busy, setBusy] = useState(false);
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    const q = question.trim();
    if (!q || busy) return;
    setBusy(true);
    try {
      const answer = await ask(q);
      setAsked((list) => [{ question: q, answer }, ...list]);
      setQuestion("");
    } catch (error) {
      const failed = error instanceof Error ? error.message : String(error);
      setAsked((list) => [{ question: q, failed }, ...list]);
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      <Button
        type="button"
        className="fixed right-4 bottom-4 z-20 shadow-lg"
        onClick={() => sheet.current?.showModal()}
      >
        {w.ask}
      </Button>
      <dialog
        ref={sheet}
        aria-labelledby="ask-title"
        className="m-0 mt-auto w-full max-w-none rounded-t-xl border bg-background p-0 text-foreground backdrop:bg-black/40 sm:m-auto sm:max-w-xl sm:rounded-xl"
      >
        <div className="flex max-h-[85vh] flex-col gap-4 overflow-y-auto p-4">
          <div className="flex items-center justify-between gap-2">
            <h2 id="ask-title" className="text-lg font-semibold">
              {w.ask}
            </h2>
            <Button type="button" variant="ghost" size="sm" onClick={() => sheet.current?.close()}>
              {w.close}
            </Button>
          </div>
          <form onSubmit={submit} className="space-y-2">
            <div className="flex gap-2">
              <Input
                aria-label={w.question}
                placeholder={w.askPlaceholder}
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                className="flex-1"
              />
              <Button type="submit" disabled={busy || !question.trim()}>
                {busy ? w.asking : w.ask}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">{w.aiMayBeWrong}</p>
          </form>
          <ol className="space-y-3">
            {asked.map((a, i) => (
              <li
                key={`${asked.length - i}`}
                data-answer
                className="space-y-2 rounded-lg border p-3"
              >
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p className="font-medium">{a.question}</p>
                  {a.answer?.source === "records" && (
                    <Badge variant="success">{w.fromYourRecords}</Badge>
                  )}
                  {a.answer?.source === "ai" && <Badge>{w.ai}</Badge>}
                </div>
                {a.failed && <p className="text-sm text-destructive">{a.failed}</p>}
                {a.answer && <Shown answer={a.answer} trace={false} confirm={confirm} />}
              </li>
            ))}
          </ol>
        </div>
      </dialog>
    </>
  );
}
