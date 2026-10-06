// Smithable app kit: the trash (docs/design/trash.md). A deleted record of a model with a trash
// stays there for thirty days: its list's Trash page restores it or removes it for good, its
// own page says so with Restore, and right after "Move to trash" the list offers Undo.
import { useEffect, useRef, useState } from "react";
import { Button } from "#/components/ui/button";
import { Card } from "#/components/ui/card";
import { formatValue } from "./format";
import { ModelTable } from "./ModelTable";
import type { AppUi, RecordUi, Row } from "./model";
import { SelectionBar } from "./SelectionBar";
import { w } from "./words";

const NOTICE = "movedToTrash";

/** Remembers, for the list the page goes back to, what was just moved to the trash. */
export function rememberTrashed(model: string, id: number, title: string): void {
  try {
    sessionStorage.setItem(NOTICE, JSON.stringify({ model, id, title }));
  } catch {
    // Without storage there is no Undo notice; the Trash page still restores it.
  }
}

/** "… is in the trash. Undo", once, on the list after a record was moved there. */
export function TrashNotice({
  model,
  onUndo,
}: {
  model: string;
  onUndo: (id: number) => Promise<unknown>;
}) {
  const [moved, setMoved] = useState<{ id: number; title: string }>();
  useEffect(() => {
    try {
      const kept = JSON.parse(sessionStorage.getItem(NOTICE) ?? "null");
      if (kept?.model === model) {
        sessionStorage.removeItem(NOTICE);
        setMoved({ id: kept.id, title: kept.title });
      }
    } catch {
      // Nothing to say.
    }
  }, [model]);
  if (!moved) return null;
  return (
    <div
      role="status"
      data-part="trash-notice"
      className="mb-4 flex items-center gap-3 rounded-md border bg-card px-4 py-2 text-sm"
    >
      <span className="flex-1">{w.movedToTrash(moved.title)}</span>
      <Button
        variant="outline"
        size="sm"
        onClick={async () => {
          await onUndo(moved.id);
          setMoved(undefined);
        }}
      >
        {w.undoIt}
      </Button>
    </div>
  );
}

/** On a trashed record's page: since when, by whom, when it goes for good, and Restore. */
export function TrashedBanner({
  at,
  by,
  until,
  app,
  onRestore,
}: {
  at: Date;
  by: string | null;
  until: Date;
  app: AppUi;
  onRestore: () => Promise<unknown>;
}) {
  const when = (d: Date) =>
    formatValue({ name: "at", label: "", kind: "datetime", required: false }, d, app);
  const day = (d: Date) =>
    formatValue(
      { name: "at", label: "", kind: "date", required: false },
      new Date(d).toISOString().slice(0, 10),
      app,
    );
  return (
    <div
      role="status"
      data-part="trashed"
      className="mb-6 flex flex-wrap items-center gap-3 rounded-md border border-warning bg-warning/10 px-4 py-3 text-sm"
    >
      <span className="flex-1">{w.inTrash(when(at), by, day(until))}</span>
      <Button variant="outline" size="sm" onClick={() => void onRestore()}>
        {w.restore}
      </Button>
    </div>
  );
}

type Trashed = Row & { deletedAt?: Date | string | null; deletedByName?: string | null };

/**
 * A list's trash: the records with when and by whom, Restore on each, Restore and Delete in the
 * selection bar, and Empty trash for all of them.
 */
export function TrashTable<R extends Trashed>({
  ui,
  app,
  rows,
  restore,
  erase,
  onDone,
  onOpen,
}: {
  ui: RecordUi<R>;
  app: AppUi;
  rows: R[];
  restore: (ids: number[]) => Promise<{ restored: number; skipped: number }>;
  erase: (ids: number[]) => Promise<{ deleted: number; skipped: number }>;
  onDone: () => Promise<unknown>;
  onOpen: (row: R) => void;
}) {
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const confirm = useRef<HTMLDialogElement>(null);
  const chosen = rows.filter((row) => selected.has(row.id));
  const shown: RecordUi<R> = {
    ...ui,
    columns: [...ui.columns, "deletedAt", "deletedByName"],
    fields: [
      ...ui.fields,
      {
        name: "deletedAt",
        label: w.deletedOn,
        kind: "datetime",
        required: false,
        get: (row) => row.deletedAt,
      },
      {
        name: "deletedByName",
        label: w.deletedByColumn,
        kind: "string",
        required: false,
        get: (row) => row.deletedByName,
      },
    ],
  };
  const done = async () => {
    setSelected(new Set());
    await onDone();
  };
  return (
    <div data-kit="trash" className="space-y-4">
      {rows.length > 0 && (
        <div className="flex justify-end">
          <Button variant="outline" onClick={() => confirm.current?.showModal()}>
            {w.emptyTrash}
          </Button>
        </div>
      )}
      <SelectionBar
        count={chosen.length}
        noun={[ui.label.toLowerCase(), ui.pluralLabel.toLowerCase()]}
        app={app}
        titleOf={(id) => String(rows.find((row) => row.id === id)?.[ui.titleField] ?? id)}
        actions={[
          {
            label: w.restore,
            applies: chosen.length,
            run: async () => {
              const r = await restore(chosen.map((row) => row.id));
              return { changed: r.restored, skipped: r.skipped };
            },
          },
        ]}
        deletable={chosen.length}
        onDelete={() => erase(chosen.map((row) => row.id))}
        onDone={done}
      />
      <ModelTable
        ui={shown}
        app={app}
        rows={rows}
        emptyMessage={w.trashEmpty}
        selection={{ ids: selected, onChange: setSelected }}
        rowActions={(row) => (
          <Button
            variant="outline"
            size="sm"
            onClick={async () => {
              await restore([row.id]);
              await done();
            }}
          >
            {w.restore}
          </Button>
        )}
        onOpen={onOpen}
      />
      <dialog
        ref={confirm}
        aria-label={w.emptyTrash}
        className="m-auto w-full max-w-md bg-transparent p-0 backdrop:bg-black/50"
      >
        <Card className="space-y-4 p-card">
          <p className="font-medium">{w.emptyTrashConfirm(rows.length)}</p>
          <div className="flex gap-2">
            <Button
              variant="destructive"
              onClick={async () => {
                await erase(rows.map((row) => row.id));
                confirm.current?.close();
                await done();
              }}
            >
              {w.emptyTrash}
            </Button>
            <Button variant="outline" onClick={() => confirm.current?.close()}>
              {w.cancel}
            </Button>
          </div>
        </Card>
      </dialog>
    </div>
  );
}
