// Smithable app kit: a list of related records edited in place on their parent's page
// (`record.lists: { lines: inline }`): a row per record with its fields as inputs, computed
// fields shown, an empty row at the end to add one. Each row saves on its own, through the
// related model's own create, change and delete, when the focus leaves it or on Enter.
import { useState } from "react";
import { Button } from "#/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "#/components/ui/table";
import { FieldInput } from "./FieldInput";
import { displayValue, formatValue, fromInput, toInput } from "./format";
import type { AppUi, FieldUi, Options, RecordUi, Row } from "./model";
import { w } from "./words";

type Inputs = Record<string, string | boolean>;
type Values = Record<string, unknown>;

export function InlineRows({
  ui,
  app,
  rows,
  fields,
  label,
  create,
  update,
  remove,
  options,
  sum,
}: {
  // biome-ignore lint/suspicious/noExplicitAny: the related model's rows, of whichever model
  ui: RecordUi<any>;
  app: AppUi;
  rows: Row[];
  /** The fields a row shows, in order: entered ones as inputs, computed ones as text. */
  fields: string[];
  /** The related record's name, lowercase: "invoice line". */
  label: string;
  create?: (values: Values) => Promise<void>;
  update?: (id: number, values: Values) => Promise<void>;
  remove?: (id: number) => Promise<void>;
  /** The choices for the rows' references. */
  options?: Options;
  /** The parent's own total of these rows, shown under them. */
  sum?: { label: string; value: string };
}) {
  const shown = fields
    .map((name) => ui.fields.find((f) => f.name === name))
    .filter((f): f is FieldUi & (typeof ui.fields)[number] => Boolean(f));
  const editable = Boolean(create || update);
  return (
    <div data-kit="inline-rows">
      <Table>
        <TableHeader>
          <TableRow>
            {shown.map((f) => (
              <TableHead key={f.name} className={f.computed ? "text-right" : undefined}>
                {f.label}
              </TableHead>
            ))}
            {editable && remove && <TableHead className="w-px" />}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <InlineRow
              // A row that changed elsewhere (or was saved) starts again from what is stored.
              key={`${row.id}-${String(row.updatedAt)}`}
              row={row}
              fields={shown}
              app={app}
              label={label}
              options={options}
              save={editable && update ? (values) => update(row.id, values) : undefined}
              remove={editable && remove ? () => remove(row.id) : undefined}
            />
          ))}
          {editable && create && (
            <InlineRow
              key="new"
              fields={shown}
              app={app}
              label={label}
              options={options}
              save={create}
              hasRemove={Boolean(remove)}
            />
          )}
        </TableBody>
        {sum && (
          <tfoot className="border-t">
            <TableRow>
              <TableCell colSpan={Math.max(1, shown.length - 1)} className="text-right font-medium">
                {sum.label}
              </TableCell>
              <TableCell data-part="sum" className="text-right font-semibold tabular-nums">
                {sum.value}
              </TableCell>
              {editable && remove && <TableCell />}
            </TableRow>
          </tfoot>
        )}
      </Table>
    </div>
  );
}

/** One row: its own inputs, saved when the focus leaves the row or on Enter. */
function InlineRow({
  row,
  fields,
  app,
  label,
  save,
  remove,
  hasRemove,
  options,
}: {
  row?: Row;
  fields: FieldUi[];
  app: AppUi;
  label: string;
  save?: (values: Values) => Promise<void>;
  remove?: () => Promise<void>;
  /** The empty row keeps the remove column's place. */
  hasRemove?: boolean;
  options?: Options;
}) {
  const start = (): Inputs =>
    Object.fromEntries(
      fields
        .filter((f) => !f.computed)
        .map((f) => [f.name, toInput(f, row ? row[f.name] : f.default, app.timeZone)]),
    );
  const [inputs, setInputs] = useState<Inputs>(start);
  // What was last saved: a second Enter or the blur after it saves nothing more.
  const [saved, setSaved] = useState<Inputs>(start);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const changed = JSON.stringify(inputs) !== JSON.stringify(saved);
  const commit = async () => {
    if (!save || !changed || busy) return;
    // The empty row adds a record once something is written in it.
    if (!row && Object.values(inputs).every((v) => v === "" || v === false)) return;
    setBusy(true);
    setError(undefined);
    try {
      await save(
        Object.fromEntries(
          fields
            .filter((f) => !f.computed)
            .map((f) => [f.name, fromInput(f, inputs[f.name] ?? "", app.timeZone)]),
        ),
      );
      if (row) setSaved(inputs);
      else setInputs(start());
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };
  const name = row ? String(row[fields[0]?.name ?? "id"] ?? row.id) : w.newOne(label);
  return (
    <>
      <TableRow
        data-part={row ? "row" : "new-row"}
        aria-busy={busy || undefined}
        onBlur={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget as Node | null)) void commit();
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.target as HTMLElement).tagName !== "TEXTAREA") {
            e.preventDefault();
            void commit();
          }
        }}
      >
        {fields.map((f) => (
          <TableCell
            key={f.name}
            className={f.computed ? "text-right tabular-nums" : "py-1.5"}
            data-field={f.name}
          >
            {f.computed ? (
              row ? (
                formatValue(f, row[f.name], app)
              ) : (
                ""
              )
            ) : save ? (
              <>
                <label htmlFor={`${row ? row.id : "new"}-${f.name}`} className="sr-only">
                  {f.label}
                </label>
                <FieldInput
                  field={f}
                  id={`${row ? row.id : "new"}-${f.name}`}
                  value={inputs[f.name] ?? ""}
                  invalid={Boolean(error)}
                  options={options}
                  currency={app.currency}
                  timeZone={app.timeZone}
                  onChange={(value) => setInputs((now) => ({ ...now, [f.name]: value }))}
                />
              </>
            ) : row ? (
              formatValue(f, displayValue(f as never, row), app)
            ) : (
              ""
            )}
          </TableCell>
        ))}
        {(remove || hasRemove) && (
          <TableCell className="w-px">
            {remove && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={busy}
                onClick={async () => {
                  setBusy(true);
                  try {
                    await remove();
                  } catch (e) {
                    setError(e instanceof Error ? e.message : String(e));
                    setBusy(false);
                  }
                }}
              >
                <span className="sr-only">{w.removeIt(name)}</span>
                <span aria-hidden>×</span>
              </Button>
            )}
          </TableCell>
        )}
      </TableRow>
      {error && (
        <TableRow>
          <TableCell
            colSpan={fields.length + (remove || hasRemove ? 1 : 0)}
            role="alert"
            className="text-sm text-destructive"
          >
            {error}
          </TableCell>
        </TableRow>
      )}
    </>
  );
}
