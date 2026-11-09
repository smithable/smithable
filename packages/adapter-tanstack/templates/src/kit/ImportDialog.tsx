// Smithable app kit: Import on a list page (A 238), for the roles that may add. The person picks a
// CSV file (a spreadsheet saves one); the panel shows which column fills which field, the columns
// left out and every row that would be refused with its line and column, before anything is
// added. Then the rows that fit go in, and for a day "Undo the import" takes them back.
import { useRouter } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { Button } from "#/components/ui/button";
import { Card } from "#/components/ui/card";
import { parseCsv } from "./csv-read";
import type { ImportRefusal } from "./import";
import type { ModelUi } from "./model";
import { tx, w } from "./words";

export interface ImportAnswer {
  columns: { column: string; field: string }[];
  ignored: string[];
  refusals: ImportRefusal[];
  count: number;
  undo?: number;
}

/** At most this many refusals listed; the rest counted. */
const SHOWN = 50;

export function ImportDialog({
  ui,
  run,
  undo,
}: {
  ui: ModelUi;
  run: (data: { file: string; rows: string[][]; dryRun: boolean }) => Promise<ImportAnswer>;
  undo: (id: number) => Promise<{ undone: number; changed: number; kept: string[] }>;
}) {
  const router = useRouter();
  const dialog = useRef<HTMLDialogElement>(null);
  const [file, setFile] = useState<{ name: string; rows: string[][] }>();
  const [preview, setPreview] = useState<ImportAnswer>();
  const [done, setDone] = useState<ImportAnswer>();
  const [undone, setUndone] = useState<string>();
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<string>();
  const reset = () => {
    setFile(undefined);
    setPreview(undefined);
    setDone(undefined);
    setUndone(undefined);
    setFailure(undefined);
  };
  const step = async (work: () => Promise<void>) => {
    setBusy(true);
    setFailure(undefined);
    try {
      await work();
    } catch (error) {
      setFailure((error as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const choose = (picked: File | undefined) =>
    picked &&
    step(async () => {
      const rows = parseCsv(await picked.text());
      setFile({ name: picked.name, rows });
      setPreview(await run({ file: picked.name, rows, dryRun: true }));
    });
  const shown = done ?? preview;
  return (
    <>
      <Button
        type="button"
        variant="outline"
        onClick={() => {
          reset();
          dialog.current?.showModal();
        }}
      >
        {w.importIt}
      </Button>
      <dialog
        ref={dialog}
        aria-label={w.importTitle(tx(ui.pluralLabel))}
        // The list loads again with what went in (or came back out).
        onClose={() => done && void router.invalidate()}
        className="m-auto w-full max-w-2xl bg-transparent p-0 backdrop:bg-black/50"
      >
        <Card className="space-y-4 rounded-xl p-card text-left">
          <h2 className="text-lg font-semibold">{w.importTitle(tx(ui.pluralLabel))}</h2>
          {!done && (
            <div className="space-y-1">
              <input
                type="file"
                accept=".csv,text/csv"
                aria-label={w.importFile}
                disabled={busy}
                onChange={(e) => void choose(e.target.files?.[0])}
                className="block text-sm"
              />
              <p className="text-sm text-muted-foreground">{w.importHint}</p>
            </div>
          )}
          {shown && (
            <div className="space-y-2 text-sm">
              {shown.columns.length > 0 && (
                <p>
                  {w.importColumns}{" "}
                  {shown.columns.map((c) => `${c.column} → ${tx(c.field)}`).join(", ")}
                </p>
              )}
              {shown.ignored.length > 0 && <p>{w.importIgnored(shown.ignored.join(", "))}</p>}
              <p role="status" className="font-medium">
                {done ? w.importAdded(done.count) : w.importWillAdd(shown.count)}
              </p>
              {shown.refusals.length > 0 && (
                <div className="space-y-1">
                  <p>{w.importRefusedRows(shown.refusals.length)}</p>
                  <ul
                    aria-label={w.importRefusals}
                    className="max-h-48 overflow-auto rounded-md border p-2"
                  >
                    {shown.refusals.slice(0, SHOWN).map((r) => (
                      <li key={`${r.line}|${r.column ?? ""}|${r.message}`}>
                        {w.importLine(r.line, r.column)} {r.message}
                      </li>
                    ))}
                    {shown.refusals.length > SHOWN && (
                      <li>{w.importMore(shown.refusals.length - SHOWN)}</li>
                    )}
                  </ul>
                </div>
              )}
            </div>
          )}
          {undone && <p role="status">{undone}</p>}
          {failure && (
            <p role="alert" className="text-sm text-destructive">
              {failure}
            </p>
          )}
          <div className="flex flex-wrap justify-end gap-2">
            {done?.undo !== undefined && !undone && (
              <Button
                type="button"
                variant="outline"
                disabled={busy}
                onClick={() =>
                  void step(async () => {
                    const result = await undo(done.undo as number);
                    setUndone(w.importUndone(result.undone, result.kept));
                  })
                }
              >
                {w.importUndo}
              </Button>
            )}
            <Button type="button" variant="outline" onClick={() => dialog.current?.close()}>
              {done ? w.close : w.cancel}
            </Button>
            {!done && (
              <Button
                type="button"
                disabled={busy || !file || !preview?.count}
                onClick={() =>
                  file &&
                  void step(async () =>
                    setDone(await run({ file: file.name, rows: file.rows, dryRun: false })),
                  )
                }
              >
                {w.importGo(preview?.count ?? 0)}
              </Button>
            )}
          </div>
        </Card>
      </dialog>
    </>
  );
}
