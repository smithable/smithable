// Smithable app kit: a table of records for any model. Choice values show as badges.
// To customise a table, copy this file into src/custom/components/ and edit the copy.
import { ChevronRight } from "lucide-react";
import { Badge } from "#/components/ui/badge";
import { Card } from "#/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "#/components/ui/table";
import { cn } from "#/lib/utils";
import { displayValue, formatValue } from "./format";
import { type AppUi, editorMarker, type FieldUi, type ModelUi, type Row } from "./model";

interface ModelTableProps<R extends Row> {
  ui: ModelUi;
  app: AppUi;
  rows: R[];
  /** Opens a row; without it rows are not clickable. */
  onOpen?: (row: R) => void;
  /** Columns to leave out, e.g. the reference back to the record a list belongs to. */
  hide?: string[];
  /** Shown when there are no records, e.g. a "New …" button. */
  emptyAction?: React.ReactNode;
  /** Replaces "No … yet", e.g. when a search matches nothing. */
  emptyMessage?: string;
  /** The columns to show, in order, instead of the model's default ones. */
  columns?: string[];
  /** The page showing the table, so the preview editor can change its columns. */
  page?: string;
}

export function ModelTable<R extends Row>({
  ui,
  app,
  rows,
  onOpen,
  hide = [],
  emptyAction,
  emptyMessage,
  columns: chosen,
  page,
}: ModelTableProps<R>) {
  const shown = ui.compute ? rows.map((row) => ({ ...row, ...ui.compute?.(row) }) as R) : rows;
  const columns = (chosen ?? ui.columns)
    .filter((name) => !hide.includes(name))
    .flatMap((name) => ui.fields.filter((f) => f.name === name));
  if (rows.length === 0) {
    return (
      <Card className="flex flex-col items-center gap-3 px-6 py-16 text-center">
        {emptyMessage ? (
          <p className="font-medium">{emptyMessage}</p>
        ) : (
          <>
            <p className="font-medium">No {ui.pluralLabel.toLowerCase()} yet</p>
            <p className="text-sm text-muted-foreground">Create the first one to get started.</p>
            {emptyAction}
          </>
        )}
      </Card>
    );
  }
  const title = columns.find((f) => f.name === ui.titleField) ?? columns[0];
  const others = columns.filter((f) => f !== title);
  const status = others.find((f) => f.kind === "choice");
  const amount = others.find((f) => numeric(f.kind));
  const date = others.find((f) => f.kind === "date" || f.kind === "datetime");
  const secondary = others.find((f) => f !== status && f !== amount && f !== date);
  const cell = (field: FieldUi, row: R) => {
    const text = formatValue(field, displayValue(field, row), app);
    if (field.kind !== "choice" || text === "—") return text;
    const tone = field.choices?.find((c) => c.value === displayValue(field, row))?.tone;
    return <Badge variant={tone}>{text}</Badge>;
  };
  // Opening a record is a real button (keyboard and screen readers), stretched over the row.
  const open = (row: R, children: React.ReactNode, className?: string) =>
    onOpen ? (
      <button
        type="button"
        onClick={() => onOpen(row)}
        className={cn(
          "cursor-pointer text-left font-semibold outline-none after:absolute after:inset-0 focus-visible:after:rounded-md focus-visible:after:ring-2 focus-visible:after:ring-ring",
          className,
        )}
      >
        {children}
      </button>
    ) : (
      children
    );
  return (
    <>
      {/* Phones: one card per record: its name and status, a contact or other identifier, then a date and a key amount. */}
      <ul className="space-y-3 md:hidden">
        {shown.map((row) => (
          <li key={row.id}>
            <Card className="relative space-y-3 p-5 hover:bg-accent/40">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 space-y-1">
                  {title && open(row, cell(title, row), "break-words text-base font-semibold")}
                  {secondary && <p className="break-words text-sm">{cell(secondary, row)}</p>}
                </div>
                {status ? (
                  <div className="shrink-0">{cell(status, row)}</div>
                ) : (
                  onOpen && <ChevronRight aria-hidden className="mt-0.5 size-5 shrink-0" />
                )}
              </div>
              {(date || amount) && (
                <p className="flex items-baseline justify-between gap-3 pt-2 text-sm">
                  <span className="text-muted-foreground">
                    {date ? cell(date, row) : amount?.label}
                  </span>
                  {amount && (
                    <span className="text-lg font-semibold whitespace-nowrap tabular-nums">
                      {cell(amount, row)}
                    </span>
                  )}
                </p>
              )}
            </Card>
          </li>
        ))}
      </ul>
      <Card className="hidden overflow-hidden md:block">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              {columns.map((field) => (
                <TableHead
                  key={field.name}
                  className={numeric(field.kind) ? "text-right" : undefined}
                  {...editorMarker(ui, field, "column", page)}
                >
                  {field.label}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {shown.map((row) => (
              <TableRow key={row.id} className={onOpen ? "relative cursor-pointer" : undefined}>
                {columns.map((field) => (
                  <TableCell
                    key={field.name}
                    className={cn(
                      numeric(field.kind) && "text-right tabular-nums",
                      field.name === ui.titleField && "font-semibold",
                    )}
                  >
                    {field === title ? open(row, cell(field, row)) : cell(field, row)}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </>
  );
}

function numeric(kind: string): boolean {
  return kind === "int" || kind === "decimal" || kind === "money";
}
