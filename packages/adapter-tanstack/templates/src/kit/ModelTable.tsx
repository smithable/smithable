// Smithable app kit: a table of records for any model. Choice values show as badges.
// To customize a table, copy this file into src/custom/components/ and edit the copy.
import { ChevronRight, Heart, ImageIcon, type LucideIcon } from "lucide-react";
import { useRef } from "react";
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
import { type AppUi, editorMarker, type RecordFieldUi, type RecordUi, type Row } from "./model";

interface ModelTableProps<R extends Row> {
  ui: RecordUi<R>;
  app: AppUi;
  rows: R[];
  /** Opens a row; without it rows are not clickable. */
  onOpen?: (row: R) => void;
  /** Columns to leave out, e.g. the reference back to the record a list belongs to. */
  hide?: (keyof R & string)[];
  /** Shown when there are no records, e.g. a "New …" button. */
  emptyAction?: React.ReactNode;
  /** Replaces "No … yet", e.g. when a search matches nothing. */
  emptyMessage?: string;
  /** The columns to show, in order, instead of the model's default ones. */
  columns?: (keyof R & string)[];
  /** A second field shown under a column's value, e.g. { email: "phone" }. */
  below?: Partial<Record<keyof R & string, keyof R & string>>;
  /** The page showing the table, so the preview editor can change its columns. */
  page?: string;
  /** Cards on wide screens too, instead of a table (a phone shows cards anyway). */
  view?: "table" | "cards";
  /** The model's icon, shown where a picture is missing. */
  icon?: LucideIcon;
  /** A heart on each record: the ids the viewer saved, and what a click does (sign in, for a visitor). */
  saved?: { ids: number[]; onToggle: (id: number) => void };
  /** Buttons for a record, e.g. its standard actions; above the row's own link. */
  rowActions?: (row: R) => React.ReactNode;
  /** Checkboxes to choose records (a page offering actions or delete): the chosen ids, and a change. */
  selection?: { ids: ReadonlySet<number>; onChange: (ids: Set<number>) => void };
}

/** Saves a record for the viewer, or unsaves it: a toggle above the row's own link. */
export function SaveButton({
  saved,
  label,
  onToggle,
}: {
  saved: boolean;
  label: string;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      data-part="save"
      aria-pressed={saved}
      aria-label={`Save ${label}`}
      onClick={onToggle}
      className="relative z-10 -m-2.5 flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-full text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
    >
      <Heart aria-hidden className={cn("size-5", saved && "fill-current text-primary")} />
    </button>
  );
}

/** Where a picture is missing: the theme's muted tone with the model's icon. */
export function PicturePlaceholder({
  icon: Icon = ImageIcon,
  className,
}: {
  icon?: LucideIcon;
  className?: string;
}) {
  return (
    <div
      aria-hidden
      data-part="placeholder"
      className={cn("flex items-center justify-center bg-muted text-muted-foreground", className)}
    >
      <Icon className="size-1/3 max-h-12 max-w-12 min-h-4 min-w-4" />
    </div>
  );
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
  below = {},
  page,
  view = "table",
  icon,
  saved,
  rowActions,
  selection,
}: ModelTableProps<R>) {
  // The row a shift-click selects from: a range, as in a file list or a spreadsheet.
  const anchor = useRef<number | null>(null);
  const shown = ui.compute ? rows.map((row) => ({ ...row, ...ui.compute?.(row) }) as R) : rows;
  const columns = (chosen ?? ui.columns)
    .filter((name) => !(hide as string[]).includes(name))
    .flatMap((name) => ui.fields.filter((f) => f.name === name));
  if (rows.length === 0) {
    return (
      <Card
        data-kit="model-table"
        data-part="empty"
        className="flex flex-col items-center gap-3 px-6 py-16 text-center"
      >
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
  const second = (field: RecordFieldUi<R>) =>
    ui.fields.find((f) => f.name === (below as Record<string, string>)[field.name]);
  // A column with a second field below its value: both on their own line.
  const stacked = (field: RecordFieldUi<R>, row: R) => {
    const other = second(field);
    return other ? (
      <>
        <span className="block">{cell(field, row)}</span>
        <span className="block text-muted-foreground">{cell(other, row)}</span>
      </>
    ) : (
      cell(field, row)
    );
  };
  const title = columns.find((f) => f.name === ui.titleField) ?? columns[0];
  // Cards view shows the picture on top, so not again among the details.
  const others = columns.filter(
    (f) => f !== title && !(view === "cards" && (f.kind === "picture" || f.kind === "pictures")),
  );
  const status = others.find((f) => f.kind === "choice");
  const amount = others.find((f) => numeric(f.kind));
  const date = others.find((f) => f.kind === "date" || f.kind === "datetime");
  const secondary = others.find((f) => f !== status && f !== amount && f !== date);
  const description = ui.fields.find((f) => f.name === ui.descriptionField);
  const pictureField = ui.fields.find((f) => f.kind === "picture" || f.kind === "pictures");
  // A picture's address; for several pictures, the cover's (the first).
  const pictureSrc = (field: RecordFieldUi<R>, row: R) =>
    `/files/${ui.model?.replace(/[A-Z]/g, (c, i) => `${i ? "-" : ""}${c.toLowerCase()}`)}/${row.id}/${field.name}${field.kind === "pictures" ? "/0" : ""}`;
  const cell = (field: RecordFieldUi<R>, row: R) => {
    const text = formatValue(field, displayValue(field, row), app);
    if ((field.kind === "picture" || field.kind === "pictures") && text === "—")
      return <PicturePlaceholder icon={icon} className="size-10 rounded-md border" />;
    // A picture as a thumbnail; its address is the record's, so it is as private as the record.
    if ((field.kind === "picture" || field.kind === "pictures") && text !== "—" && ui.model)
      return (
        <img
          src={pictureSrc(field, row)}
          alt={text}
          className="h-10 w-10 rounded-md border object-cover"
        />
      );
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
  // A record's checkbox; shift-click sets the range from the last one clicked to its state.
  const check = (row: R, index: number, size = "size-4") =>
    selection && (
      <input
        type="checkbox"
        data-part="select"
        aria-label={`Select ${title ? formatValue(title, displayValue(title, row), app) : `#${row.id}`}`}
        checked={selection.ids.has(row.id)}
        onChange={(e) => {
          const next = new Set(selection.ids);
          const from =
            (e.nativeEvent as MouseEvent).shiftKey && anchor.current !== null
              ? anchor.current
              : index;
          for (let i = Math.min(from, index); i <= Math.max(from, index); i++) {
            const id = shown[i]?.id;
            if (id === undefined) continue;
            if (e.target.checked) next.add(id);
            else next.delete(id);
          }
          anchor.current = index;
          selection.onChange(next);
        }}
        className={`relative z-10 ${size} cursor-pointer accent-primary`}
      />
    );
  const all =
    selection !== undefined && shown.length > 0 && shown.every((r) => selection.ids.has(r.id));
  const some = selection !== undefined && shown.some((r) => selection.ids.has(r.id));
  const heart = (row: R) =>
    saved && (
      <SaveButton
        saved={saved.ids.includes(row.id)}
        label={title ? formatValue(title, displayValue(title, row), app) : String(row.id)}
        onToggle={() => saved.onToggle(row.id)}
      />
    );
  return (
    <div data-kit="model-table">
      {/* Phones: one card per record: its name and status, a contact or other identifier, its description, then a date and a key amount. */}
      <ul
        className={
          view === "cards" ? "grid gap-3 md:grid-cols-2 xl:grid-cols-3" : "space-y-3 md:hidden"
        }
      >
        {shown.map((row, index) => (
          <li key={row.id} data-part="row">
            <Card
              className={cn(
                "relative space-y-3 p-5 hover:bg-accent/40",
                view === "cards" && pictureField && "overflow-hidden pt-0",
              )}
            >
              {selection && (
                <span className="absolute top-3 left-3 z-10 rounded bg-card/90 p-1">
                  {check(row, index, "size-6")}
                </span>
              )}
              {/* Cards of a model with pictures show the record's, or a placeholder without one. */}
              {view === "cards" &&
                pictureField &&
                (formatValue(pictureField, displayValue(pictureField, row), app) !== "—" ? (
                  <img
                    src={pictureSrc(pictureField, row)}
                    alt={formatValue(pictureField, displayValue(pictureField, row), app)}
                    loading="lazy"
                    className="-mx-5 aspect-[3/2] w-[calc(100%+2.5rem)] max-w-none object-cover"
                  />
                ) : (
                  <PicturePlaceholder
                    icon={icon}
                    className="-mx-5 aspect-[3/2] w-[calc(100%+2.5rem)]"
                  />
                ))}
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 space-y-1">
                  {title && open(row, cell(title, row), "break-words text-base font-semibold")}
                  {secondary && <p className="break-words text-sm">{stacked(secondary, row)}</p>}
                  {description && Boolean(displayValue(description, row)) && (
                    <p
                      data-part="description"
                      className="line-clamp-2 break-words text-sm text-muted-foreground"
                    >
                      {formatValue(description, displayValue(description, row), app)}
                    </p>
                  )}
                </div>
                {status || saved ? (
                  <div className="flex shrink-0 items-start gap-3">
                    {status && cell(status, row)}
                    {heart(row)}
                  </div>
                ) : (
                  onOpen && <ChevronRight aria-hidden className="mt-0.5 size-5 shrink-0" />
                )}
              </div>
              {rowActions && (
                <div data-part="row-actions" className="relative z-10 flex flex-wrap gap-2">
                  {rowActions(row)}
                </div>
              )}
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
      {view === "table" && (
        <Card className="hidden overflow-hidden md:block">
          <Table>
            <TableHeader data-part="header">
              <TableRow className="hover:bg-transparent">
                {selection && (
                  <TableHead className="w-10">
                    <input
                      type="checkbox"
                      data-part="select-all"
                      aria-label="Select all"
                      checked={all}
                      ref={(el) => {
                        if (el) el.indeterminate = some && !all;
                      }}
                      onChange={(e) =>
                        selection.onChange(
                          e.target.checked ? new Set(shown.map((r) => r.id)) : new Set(),
                        )
                      }
                      className="size-4 cursor-pointer accent-primary"
                    />
                  </TableHead>
                )}
                {columns.map((field) => (
                  <TableHead
                    key={field.name}
                    className={numeric(field.kind) ? "text-right" : undefined}
                    {...editorMarker(ui, field, "column", page)}
                  >
                    {second(field) ? `${field.label} / ${second(field)?.label}` : field.label}
                  </TableHead>
                ))}
                {saved && (
                  <TableHead className="w-12">
                    <span className="sr-only">Saved</span>
                  </TableHead>
                )}
                {rowActions && (
                  <TableHead>
                    <span className="sr-only">Actions</span>
                  </TableHead>
                )}
              </TableRow>
            </TableHeader>
            <TableBody>
              {shown.map((row, index) => (
                <TableRow
                  key={row.id}
                  data-part="row"
                  data-state={selection?.ids.has(row.id) ? "selected" : undefined}
                  className={onOpen ? "relative cursor-pointer" : undefined}
                >
                  {selection && <TableCell className="py-0">{check(row, index)}</TableCell>}
                  {columns.map((field) => (
                    <TableCell
                      key={field.name}
                      data-part="cell"
                      data-field={field.name}
                      className={cn(
                        numeric(field.kind) && "text-right tabular-nums",
                        // A date and its time on one line.
                        (field.kind === "date" || field.kind === "datetime") && "whitespace-nowrap",
                        field.name === ui.titleField && "font-semibold",
                      )}
                    >
                      {field === title ? open(row, cell(field, row)) : stacked(field, row)}
                    </TableCell>
                  ))}
                  {saved && <TableCell className="py-0">{heart(row)}</TableCell>}
                  {rowActions && (
                    <TableCell data-part="row-actions" className="relative z-10 py-0 text-right">
                      {rowActions(row)}
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  );
}

function numeric(kind: string): boolean {
  return kind === "int" || kind === "decimal" || kind === "money";
}
