// Smithable app kit: what to do with the chosen records (docs/design/actions.md §9): each action
// that fits at least one of them, with how many it applies to, and Delete. One run, all or none.
import { useRef, useState } from "react";
import type { z } from "zod";
import { Button } from "#/components/ui/button";
import { Card } from "#/components/ui/card";
import { ActionButton } from "./ActionButton";
import type { AppUi, ModelUi } from "./model";

export interface SelectionAction {
  label: string;
  /** How many of the chosen records it fits and the viewer may run it on. */
  applies: number;
  /** What it asks for, once, for all of them. */
  ask?: { ui: ModelUi; schema: z.ZodType };
  run: (values?: Record<string, unknown>) => Promise<{ changed: number; skipped: number }>;
}

export function SelectionBar({
  count,
  noun,
  actions,
  deletable,
  onDelete,
  titleOf,
  app,
  onDone,
}: {
  count: number;
  /** The records' name, one and several, e.g. ["incident", "incidents"]. */
  noun: [string, string];
  actions: SelectionAction[];
  /** How many of them the viewer may delete. */
  deletable: number;
  onDelete?: () => Promise<{ deleted: number; skipped: number }>;
  /** A record's title, to name one that stopped a run. */
  titleOf: (id: number) => string;
  app: AppUi;
  /** After a run: the selection is cleared and the list loads again. */
  onDone: () => Promise<unknown>;
}) {
  const [message, setMessage] = useState<string>();
  const [failure, setFailure] = useState<string>();
  const [busy, setBusy] = useState(false);
  const confirm = useRef<HTMLDialogElement>(null);
  const counted = (done: number, skipped: number, verb: string) =>
    `${done} ${done === 1 ? noun[0] : noun[1]} ${verb}${skipped ? `, ${skipped} skipped` : ""}.`;
  // A refusal from the server: "in-use:12" names the record still in use.
  const words = (error: unknown) => {
    const text = error instanceof Error ? error.message : String(error);
    const inUse = /^in-use:(\d+)$/.exec(text);
    return inUse ? `"${titleOf(Number(inUse[1]))}" is still in use, so nothing was deleted.` : text;
  };
  if (count === 0 && !message) return null;
  return (
    <div data-kit="selection-bar" className="sticky top-0 z-20 mb-3">
      {count > 0 && (
        <Card className="flex flex-wrap items-center gap-2 p-2 pl-4">
          <span className="mr-auto text-sm font-medium" role="status">
            {count} selected
          </span>
          {actions
            .filter((a) => a.applies > 0)
            .map((a) => (
              <ActionButton
                key={a.label}
                label={`${a.label} (${a.applies})`}
                ask={a.ask && { ...a.ask, initial: {}, app }}
                onRun={async (values) => {
                  setFailure(undefined);
                  try {
                    const r = await a.run(values);
                    setMessage(`${a.label}: ${counted(r.changed, r.skipped, "changed")}`);
                    await onDone();
                  } catch (error) {
                    setFailure(words(error));
                  }
                }}
              />
            ))}
          {onDelete && deletable > 0 && (
            <Button
              type="button"
              variant="outline"
              disabled={busy}
              onClick={() => confirm.current?.showModal()}
            >
              Delete ({deletable})
            </Button>
          )}
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
        aria-label="Delete"
        className="m-auto w-full max-w-md bg-transparent p-0 backdrop:bg-black/50"
      >
        <Card className="space-y-4 p-card">
          <p className="font-medium">
            Delete {deletable} {deletable === 1 ? noun[0] : noun[1]}? This cannot be undone.
          </p>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="destructive"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                setFailure(undefined);
                try {
                  const r = await onDelete?.();
                  if (r) setMessage(counted(r.deleted, r.skipped, "deleted"));
                  await onDone();
                } catch (error) {
                  setFailure(words(error));
                }
                setBusy(false);
                confirm.current?.close();
              }}
            >
              Delete
            </Button>
            <Button type="button" variant="outline" onClick={() => confirm.current?.close()}>
              Cancel
            </Button>
          </div>
        </Card>
      </dialog>
    </div>
  );
}
