// Smithable app kit: the trash (docs/design/trash.md). A deleted record of a model with a trash
// stays there for thirty days: its list's Trash page restores it or removes it for good, its
// own page says so with Restore, and right after "Move to trash" the list offers Undo.
import { useEffect, useRef, useState } from "react";
import { Button } from "#/components/ui/button";
import { Card } from "#/components/ui/card";
import { formatValue } from "./format";
import { ModelTable } from "./ModelTable";
import type { AppUi, ModelUi, RecordUi, Row } from "./model";
import { SelectionBar } from "./SelectionBar";
import { w } from "./words";

const NOTICE = "movedToTrash";

/** Remembers, for the list the page goes back to, what was just moved to the trash. */
export function rememberTrashed(model: string, id: number, title: string): void {
  try {
    sessionStorage.setItem(NOTICE, JSON.stringify({ model, id, title }));
    // A list that stays open (a merge in its selection bar) shows it at once.
    window.dispatchEvent(new Event(NOTICE));
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
  const [stayed, setStayed] = useState<number>();
  useEffect(() => {
    const read = () => {
      try {
        const kept = JSON.parse(sessionStorage.getItem(NOTICE) ?? "null");
        if (kept?.model === model) {
          sessionStorage.removeItem(NOTICE);
          setMoved({ id: kept.id, title: kept.title });
          setStayed(undefined);
        }
      } catch {
        // Nothing to say.
      }
    };
    read();
    window.addEventListener(NOTICE, read);
    return () => window.removeEventListener(NOTICE, read);
  }, [model]);
  // After undoing a merge: what was changed since stays, and is said (intents.md §3).
  if (stayed)
    return (
      <p
        role="status"
        data-part="trash-notice"
        className="mb-4 rounded-md border bg-card px-4 py-2 text-sm"
      >
        {w.mergeStayed(stayed)}
      </p>
    );
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
          const result = await onUndo(moved.id);
          setMoved(undefined);
          setStayed((result as { stayed?: number } | undefined)?.stayed || undefined);
        }}
      >
        {w.undoIt}
      </Button>
    </div>
  );
}

/**
 * Why a restore was refused, in the form's words: a live record has taken a unique value since
 * ("Another customer already has this email."), the record went to the trash with another that
 * is still there (docs/design/delete-together.md), or the app's own message.
 */
export function restoreRefusal(ui: Pick<ModelUi, "label" | "fields">, error: unknown): string {
  const message = error instanceof Error ? error.message : "";
  const root = /^restore-root-first:([^:]+):(.*)$/.exec(message);
  if (root) return w.restoreRootFirst(root[1] as string, root[2] as string);
  const column = /^taken:(\w+)$/.exec(message)?.[1];
  const field = ui.fields.find(
    (f) => f.name.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`) === column,
  );
  return field ? w.alreadyHas(ui.label, field.label) : message || w.tryAgain;
}

/** On a trashed record's page: since when, by whom, when it goes for good, and Restore. */
export function TrashedBanner({
  at,
  by,
  until,
  app,
  ui,
  onRestore,
}: {
  at: Date;
  by: string | null;
  until: Date;
  app: AppUi;
  ui: Pick<ModelUi, "label" | "fields">;
  onRestore: () => Promise<unknown>;
}) {
  const [refused, setRefused] = useState<string>();
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
      <Button
        variant="outline"
        size="sm"
        onClick={() => onRestore().catch((error) => setRefused(restoreRefusal(ui, error)))}
      >
        {w.restore}
      </Button>
      {refused && (
        <p role="alert" className="w-full text-destructive">
          {refused}
        </p>
      )}
    </div>
  );
}

type Trashed = Row & {
  deletedAt?: Date | string | null;
  deletedByName?: string | null;
  /** The record it went to the trash with, by title, and how many went with it (delete-together.md). */
  withTitle?: string | null;
  withCount?: number;
  /** The record it was merged into, by title (intents.md §3). */
  mergedInto?: string | null;
};

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
  // A restore refused because a live record has taken a unique value since.
  const [refused, setRefused] = useState<string>();
  const confirm = useRef<HTMLDialogElement>(null);
  const chosen = rows.filter((row) => selected.has(row.id));
  // A record that went with another is restored with it; one that others went with says how many.
  const grouped = rows.some((row) => row.withTitle || row.withCount || row.mergedInto);
  const shown: RecordUi<R> = {
    ...ui,
    columns: [...ui.columns, "deletedAt", "deletedByName", ...(grouped ? ["together"] : [])],
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
      {
        name: "together",
        label: w.togetherColumn,
        kind: "string",
        required: false,
        get: (row) =>
          row.withTitle
            ? w.withRoot(row.withTitle)
            : row.mergedInto
              ? w.mergedIntoTitle(row.mergedInto)
              : row.withCount
                ? w.andRecords(row.withCount)
                : null,
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
              const r = await restore(chosen.map((row) => row.id)).catch((error) => {
                throw new Error(restoreRefusal(ui, error));
              });
              return { changed: r.restored, skipped: r.skipped };
            },
          },
        ]}
        deletable={chosen.length}
        onDelete={() => erase(chosen.map((row) => row.id))}
        onDone={done}
      />
      {refused && (
        <p role="alert" className="text-sm text-destructive">
          {refused}
        </p>
      )}
      <ModelTable
        ui={shown}
        app={app}
        rows={rows}
        emptyMessage={w.trashEmpty}
        selection={{ ids: selected, onChange: setSelected }}
        rowActions={(row) =>
          row.withTitle ? null : (
            <Button
              variant="outline"
              size="sm"
              onClick={async () => {
                try {
                  await restore([row.id]);
                  setRefused(undefined);
                  await done();
                } catch (error) {
                  setRefused(restoreRefusal(ui, error));
                }
              }}
            >
              {w.restore}
            </Button>
          )
        }
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
