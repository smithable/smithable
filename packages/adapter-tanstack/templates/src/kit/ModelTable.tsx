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
import type { AppUi, ModelUi, Row } from "./model";

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
}

export function ModelTable<R extends Row>({
  ui,
  app,
  rows,
  onOpen,
  hide = [],
  emptyAction,
}: ModelTableProps<R>) {
  const shown = ui.compute ? rows.map((row) => ({ ...row, ...ui.compute?.(row) }) as R) : rows;
  const columns = ui.columns
    .filter((name) => !hide.includes(name))
    .flatMap((name) => ui.fields.filter((f) => f.name === name));
  if (rows.length === 0) {
    return (
      <Card className="flex flex-col items-center gap-3 px-6 py-16 text-center">
        <p className="font-medium">No {ui.pluralLabel.toLowerCase()} yet</p>
        <p className="text-sm text-muted-foreground">Create the first one to get started.</p>
        {emptyAction}
      </Card>
    );
  }
  return (
    <Card>
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
            <TableRow
              key={row.id}
              className={onOpen ? "cursor-pointer" : undefined}
              onClick={onOpen ? () => onOpen(row) : undefined}
            >
              {columns.map((field) => {
                const text = formatValue(field, displayValue(field, row), app);
                return (
                  <TableCell
                    key={field.name}
                    className={cn(
                      numeric(field.kind) && "text-right tabular-nums",
                      field.name === ui.titleField && "font-medium",
                    )}
                  >
                    {field.kind === "choice" && text !== "—" ? <Badge>{text}</Badge> : text}
                  </TableCell>
                );
              })}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Card>
  );
}

function numeric(kind: string): boolean {
  return kind === "int" || kind === "decimal" || kind === "money";
}
