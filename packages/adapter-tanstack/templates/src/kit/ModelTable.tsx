// Smithable app kit: a table of records for any model. Choice values show as badges.
// To customise a table, copy this file into src/custom/components/ and edit the copy.
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
import type { AppUi, FieldUi, ModelUi, Row } from "./model";

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
  const cell = (field: FieldUi, row: R) => {
    const text = formatValue(field, displayValue(field, row), app);
    return field.kind === "choice" && text !== "—" ? <Badge>{text}</Badge> : text;
  };
  // Opening a record is a real button (keyboard and screen readers), stretched over the row.
  const open = (row: R, children: React.ReactNode, className?: string) =>
    onOpen ? (
      <button
        type="button"
        onClick={() => onOpen(row)}
        className={cn(
          "text-left font-medium outline-none after:absolute after:inset-0 focus-visible:after:rounded-md focus-visible:after:ring-2 focus-visible:after:ring-ring",
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
      {/* Phones: one card per record, with its name and a few values. */}
      <ul className="space-y-2 md:hidden">
        {shown.map((row) => (
          <li key={row.id}>
            <Card className="relative space-y-1 p-4 hover:bg-accent/40">
              <div className="flex items-baseline justify-between gap-3">
                {title && open(row, cell(title, row), "min-w-0 break-words")}
              </div>
              <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-sm">
                {columns
                  .filter((f) => f !== title)
                  .slice(0, 3)
                  .map((field) => (
                    <div key={field.name} className="contents">
                      <dt className="text-muted-foreground">{field.label}</dt>
                      <dd
                        className={cn("min-w-0 break-words", numeric(field.kind) && "tabular-nums")}
                      >
                        {cell(field, row)}
                      </dd>
                    </div>
                  ))}
              </dl>
            </Card>
          </li>
        ))}
      </ul>
      <Card className="hidden md:block">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              {columns.map((field) => (
                <TableHead
                  key={field.name}
                  className={numeric(field.kind) ? "text-right" : undefined}
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
                      field.name === ui.titleField && "font-medium",
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
