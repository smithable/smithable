// Smithable app kit: splitting a record in two (docs/design/intents.md §4). The person picks the
// records of a list that go to a new record, at least one and not all; the page then opens the new
// record, which says where it came from and offers Undo.
import { useEffect, useRef, useState } from "react";
import { Button } from "#/components/ui/button";
import { Card } from "#/components/ui/card";
import { tx, w } from "./words";

const NOTICE = "splitFrom";

/** One record of the list, as the form names it. */
export interface SplitChild {
  id: number;
  title: string;
}

/** The record page's "Split…": the picks, the run, and the new record's page. */
export function SplitButton({
  label,
  help,
  concept,
  model,
  title,
  plural,
  children,
  run,
  onDone,
}: {
  label: string;
  help?: string;
  /** The action in the app description, for the preview editor: development only. */
  concept?: string;
  /** The record's model and title, for the new record's notice. */
  model: string;
  title: string;
  /** The list's records, one and several ("Order lines"). */
  plural: string;
  children: SplitChild[];
  /** Splits; the new record's id. */
  run: (picked: number[]) => Promise<number>;
  onDone: (id: number) => Promise<unknown>;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [picked, setPicked] = useState<Set<number>>(new Set());
  const [failure, setFailure] = useState<string>();
  const [busy, setBusy] = useState(false);
  const fits = picked.size > 0 && picked.size < children.length;
  const split = async () => {
    setBusy(true);
    setFailure(undefined);
    try {
      const id = await run([...picked]);
      dialog.current?.close();
      try {
        sessionStorage.setItem(NOTICE, JSON.stringify({ model, id, from: title }));
      } catch {
        // Without storage there is no notice; the split is done.
      }
      await onDone(id);
    } catch (error) {
      setFailure(error instanceof Error ? error.message : w.somethingWentWrong);
    }
    setBusy(false);
  };
  return (
    <span
      data-kit="split-button"
      {...(import.meta.env.DEV && concept ? { "data-sm-concept": concept } : {})}
      className="inline-flex flex-col items-end gap-1"
    >
      <Button
        type="button"
        variant="outline"
        title={help && tx(help)}
        // Splitting needs two to share out.
        disabled={children.length < 2}
        onClick={() => {
          setPicked(new Set());
          setFailure(undefined);
          dialog.current?.showModal();
        }}
      >
        {w.splitIt}
      </Button>
      <dialog
        ref={dialog}
        aria-label={tx(label)}
        className="m-auto w-full max-w-lg bg-transparent p-0 backdrop:bg-black/50"
      >
        <Card className="space-y-4 rounded-xl p-card text-left">
          <div className="space-y-1">
            <h2 className="text-lg font-semibold">{tx(label)}</h2>
            {help && <p className="text-sm text-muted-foreground">{tx(help)}</p>}
          </div>
          <fieldset className="space-y-2">
            <legend className="text-sm font-medium">{w.splitWhich(plural)}</legend>
            {children.map((c) => (
              <label key={c.id} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={picked.has(c.id)}
                  onChange={(e) => {
                    const next = new Set(picked);
                    if (e.target.checked) next.add(c.id);
                    else next.delete(c.id);
                    setPicked(next);
                  }}
                />
                <span className="min-w-0 break-words">{c.title}</span>
              </label>
            ))}
          </fieldset>
          {failure && (
            <p role="alert" className="text-sm text-destructive">
              {failure}
            </p>
          )}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => dialog.current?.close()}>
              {w.cancel}
            </Button>
            <Button type="button" disabled={!fits || busy} onClick={split}>
              {tx(label)}
            </Button>
          </div>
        </Card>
      </dialog>
    </span>
  );
}

/** On the new record's page, once: where it was split off from, and Undo. */
export function SplitNotice({
  model,
  id,
  onUndo,
}: {
  model: string;
  id: number;
  /** Undoes the split; what stayed elsewhere since, counted. */
  onUndo: () => Promise<{ stayed: number }>;
}) {
  const [from, setFrom] = useState<string>();
  const [stayed, setStayed] = useState<number>();
  const [failure, setFailure] = useState<string>();
  useEffect(() => {
    try {
      const kept = JSON.parse(sessionStorage.getItem(NOTICE) ?? "null");
      if (kept?.model === model && kept.id === id) {
        sessionStorage.removeItem(NOTICE);
        setFrom(kept.from);
      }
    } catch {
      // Nothing to say.
    }
  }, [model, id]);
  if (stayed)
    return (
      <p
        role="status"
        data-part="split-notice"
        className="mb-4 rounded-md border bg-card px-4 py-2 text-sm"
      >
        {w.splitStayed(stayed)}
      </p>
    );
  if (!from) return null;
  return (
    <div
      role="status"
      data-part="split-notice"
      className="mb-4 flex flex-wrap items-center gap-3 rounded-md border bg-card px-4 py-2 text-sm"
    >
      <span className="flex-1">{w.splitDone(from)}</span>
      {failure && <span className="text-destructive">{failure}</span>}
      <Button
        variant="outline"
        size="sm"
        onClick={async () => {
          try {
            const result = await onUndo();
            setFrom(undefined);
            setStayed(result.stayed || undefined);
          } catch (error) {
            setFailure(error instanceof Error ? error.message : w.somethingWentWrong);
          }
        }}
      >
        {w.undoIt}
      </Button>
    </div>
  );
}
