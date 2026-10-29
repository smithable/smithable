// Smithable app kit: what to do with the chosen records (docs/design/actions.md §9): each action
// that fits at least one of them, with how many it applies to, and Delete. One run, all or none.
import { type ReactNode, useRef, useState } from "react";
import type { z } from "zod";
import { Button } from "#/components/ui/button";
import { Card } from "#/components/ui/card";
import { ActionButton } from "./ActionButton";
import type { AppUi, ModelUi, Options } from "./model";
import { Overflow } from "./Overflow";
import { type InUse, inUseFacts, TogetherDialog } from "./Together";
import { tx, w } from "./words";

export interface SelectionAction {
  label: string;
  help?: string;
  /** The action in the app description, for the preview editor. */
  concept?: string;
  /** How many of the chosen records it fits and the viewer may run it on. */
  applies: number;
  /** What it asks for, once, for all of them. */
  ask?: { ui: ModelUi; schema: z.ZodType; loadOptions?: () => Promise<Options> };
  run: (values?: Record<string, unknown>) => Promise<{ changed: number; skipped: number }>;
}

export function SelectionBar({
  count,
  noun: nouns,
  actions,
  deletable,
  onDelete,
  titleOf,
  app,
  onDone,
  onExport,
  trash,
  extra,
}: {
  count: number;
  /** The records' name, one and several, e.g. ["incident", "incidents"]. */
  noun: [string, string];
  actions: SelectionAction[];
  /** How many of them the viewer may delete. */
  deletable: number;
  /** Deletes them; `together` takes what points to them along (docs/design/delete-together.md). */
  onDelete?: (together?: boolean) => Promise<{ deleted: number; skipped: number }>;
  /** A record's title, to name one that stopped a run. */
  titleOf: (id: number) => string;
  app: AppUi;
  /** After a run: the selection is cleared and the list loads again. */
  onDone: () => Promise<unknown>;
  /** Saves the chosen records as a CSV file. */
  onExport?: () => void;
  /** Deleting moves the records to the trash (docs/design/trash.md), where they can be restored. */
  trash?: boolean;
  /** More buttons for the chosen records, e.g. Merge when two are picked (intents.md §3). */
  extra?: ReactNode;
}) {
  const noun: [string, string] = [tx(nouns[0]), tx(nouns[1])];
  const [message, setMessage] = useState<string>();
  const [failure, setFailure] = useState<string>();
  const [busy, setBusy] = useState(false);
  // A delete refused because other records point to one of them: the facts, for the dialog.
  const [inUse, setInUse] = useState<InUse>();
  const confirm = useRef<HTMLDialogElement>(null);
  const counted = (done: number, skipped: number, verb: string) =>
    w.counted(done, noun[0], noun[1], verb, skipped);
  // A refusal from the server: "in-use:12" names the record still in use.
  const words = (error: unknown) => {
    const text = error instanceof Error ? error.message : String(error);
    const inUse = /^in-use:(\d+)$/.exec(text);
    const noRight = /^no-right:(.+)$/.exec(text)?.[1];
    return inUse
      ? w.stillInUse(titleOf(Number(inUse[1])))
      : noRight
        ? w.noRightToDelete(noRight)
        : text;
  };
  const remove = async (together?: boolean) => {
    setBusy(true);
    setFailure(undefined);
    try {
      const r = await onDelete?.(together);
      if (r) setMessage(counted(r.deleted, r.skipped, trash ? w.trashedVerb : w.deletedVerb));
      await onDone();
    } catch (error) {
      const facts = inUseFacts(error);
      if (facts) setInUse(facts);
      else setFailure(words(error));
    }
    setBusy(false);
    confirm.current?.close();
  };
  if (count === 0 && !message) return null;
  return (
    <div data-kit="selection-bar" className="sticky top-0 z-20 mb-3">
      {count > 0 && (
        <Card className="flex flex-wrap items-center gap-2 p-2 pl-4">
          <span className="mr-auto text-sm font-medium" role="status">
            {w.selectedN(count)}
          </span>
          <Overflow>
            {actions
              .filter((a) => a.applies > 0)
              .map((a) => (
                <ActionButton
                  key={a.label}
                  label={`${a.label} (${a.applies})`}
                  help={a.help}
                  concept={a.concept}
                  ask={a.ask && { ...a.ask, initial: {}, app }}
                  onRun={async (values) => {
                    setFailure(undefined);
                    try {
                      const r = await a.run(values);
                      setMessage(`${a.label}: ${counted(r.changed, r.skipped, w.changedVerb)}`);
                      await onDone();
                    } catch (error) {
                      setFailure(words(error));
                    }
                  }}
                />
              ))}
            {extra}
            {onDelete && deletable > 0 && (
              <Button
                type="button"
                variant="outline"
                disabled={busy}
                onClick={() => confirm.current?.showModal()}
              >
                {trash ? w.trashN(deletable) : w.deleteN(deletable)}
              </Button>
            )}
            {onExport && (
              <Button type="button" variant="outline" onClick={onExport}>
                {w.exportCsv}
              </Button>
            )}
          </Overflow>
        </Card>
      )}
      {(message || failure) && (
        <p
          role={failure ? "alert" : "status"}
          className={
            failure ? "mt-2 text-sm text-destructive" : "mt-2 text-sm text-muted-foreground"
          }
        >
          {failure ?? message}
        </p>
      )}
      <dialog
        ref={confirm}
        aria-label={trash ? w.moveToTrash : w.delete}
        className="m-auto w-full max-w-md bg-transparent p-0 backdrop:bg-black/50"
      >
        <Card className="space-y-4 rounded-xl p-card">
          <p className="font-medium">
            {(trash ? w.trashHowMany : w.deleteHowMany)(
              deletable,
              deletable === 1 ? noun[0] : noun[1],
            )}
          </p>
          <div className="flex gap-2">
            <Button type="button" variant="destructive" disabled={busy} onClick={() => remove()}>
              {trash ? w.moveToTrash : w.delete}
            </Button>
            <Button type="button" variant="outline" onClick={() => confirm.current?.close()}>
              {w.cancel}
            </Button>
          </div>
        </Card>
      </dialog>
      {inUse && (
        <TogetherDialog
          facts={inUse}
          what={deletable === 1 ? `“${inUse.title}”` : w.nOf(deletable, noun[0], noun[1])}
          rootLabel={noun[0]}
          busy={busy}
          onTogether={() => {
            setInUse(undefined);
            remove(true);
          }}
          onClose={() => setInUse(undefined)}
        />
      )}
    </div>
  );
}
