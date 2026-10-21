// Smithable app kit: a table of records for any model. Choice values show as badges.
// To customize a table, copy this file into src/custom/components/ and edit the copy.
import {
  ArrowDown,
  ArrowUp,
  ChevronLeft,
  ChevronRight,
  Download,
  Heart,
  ImageIcon,
  type LucideIcon,
} from "lucide-react";
import { useRef, useState } from "react";
import { Badge } from "#/components/ui/badge";
import { Button } from "#/components/ui/button";
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
import { AiMarked } from "./AiMark";
import { csvName, csvOf, download } from "./csv";
import { displayValue, formatValue } from "./format";
import { MoreOnScroll } from "./MoreOnScroll";
import { type AppUi, editorMarker, type RecordFieldUi, type RecordUi, type Row } from "./model";
import { w } from "./words";

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
  /**
   * A conversation on each record (conversation.md §1): the list's name, and each record's
   * count of messages and how many of them the viewer has not read.
   */
  thread?: { label: string; counts: Record<number, { count: number; unread: number }> };
  /** Buttons for a record, e.g. its standard actions; above the row's own link. */
  rowActions?: (row: R) => React.ReactNode;
  /** Checkboxes to choose records (a page offering actions or delete): the chosen ids, and a change. */
  selection?: { ids: ReadonlySet<number>; onChange: (ids: Set<number>) => void };
  /** One page of a longer list (a table): which page, its size, how many in all, and going to another. */
  paging?: { page: number; size: number; total: number; to: (page: number) => void };
  /** More of a longer list as the reader scrolls (cards): how many in all, and loading the next. */
  more?: { total: number; load: () => Promise<void> };
  /** The whole list as it is filtered, for "Export CSV" (the selection bar exports chosen rows). */
  exportRows?: () => Promise<R[]>;
  /**
   * Sorting by a column's header (the page's sortable fields): each column's key in the address,
   * the order now ("key", or "-key" for largest or latest first) and choosing another.
   */
  sorting?: {
    keys: Partial<Record<keyof R & string, string>>;
    value?: string;
    onChange: (sort?: string) => void;
  };
}

/** "1–50 of 1,234" and Previous / Next, under a table that is one page of a longer list. */
export function Pager({ page, size, total, to }: NonNullable<ModelTableProps<Row>["paging"]>) {
  if (total <= size) return null;
  const last = Math.max(1, Math.ceil(total / size));
  const number = (n: number) => new Intl.NumberFormat().format(n);
  return (
    <nav
      aria-label={w.pages}
      data-part="pager"
      className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm text-muted-foreground"
    >
      <span>
        {w.range(
          number((page - 1) * size + 1),
          number(Math.min(page * size, total)),
          number(total),
        )}
      </span>
      <span className="flex gap-2">
        <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => to(page - 1)}>
          <ChevronLeft aria-hidden />
          {w.previous}
        </Button>
        <Button variant="outline" size="sm" disabled={page >= last} onClick={() => to(page + 1)}>
          {w.next}
          <ChevronRight aria-hidden />
        </Button>
      </span>
    </nav>
  );
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
      aria-label={w.saveIt(label)}
      onClick={onToggle}
      className="relative z-10 -m-2.5 flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-full text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
    >
      <Heart aria-hidden className={cn("size-5", saved && "fill-current text-primary")} />
    </button>
  );
}

/** Whether a record's picture (for several, the cover) was made by an AI (AiMark.tsx). */
function generatedPicture<R>(row: R, field: RecordFieldUi<R>): boolean {
  const value = field.get(row);
  const picture = Array.isArray(value) ? value[0] : value;
  return Boolean(
    picture && typeof picture === "object" && "generated" in picture && picture.generated,
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
  thread,
  rowActions,
  selection,
  paging,
  more,
  exportRows,
  sorting,
}: ModelTableProps<R>) {
  // The row a shift-click selects from: a range, as in a file list or a spreadsheet.
  const anchor = useRef<number | null>(null);
  // A computed field the server sent is kept: a total over related records is worked out there,
  // where the records are (a list strips them). One it did not (a related list's rows) is filled in.
  const shown = ui.compute
    ? rows.map((row) => {
        const computed = Object.entries(ui.compute?.(row) ?? {}).filter(
          ([name]) => (row as Record<string, unknown>)[name] == null,
        );
        return { ...row, ...Object.fromEntries(computed) } as R;
      })
    : rows;
  const visible = (chosen ?? ui.columns)
    .filter((name) => !(hide as string[]).includes(name))
    .flatMap((name) => ui.fields.filter((f) => f.name === name));
  // Every column hidden (a related list whose only field is the record it is on): the record's
  // own title, so each row can still be told apart and opened.
  const fallback = (hide as string[]).includes(ui.titleField) ? "id" : ui.titleField;
  const columns: RecordFieldUi<R>[] = visible.length
    ? visible
    : [
        ui.fields.find((f) => f.name === fallback) ?? {
          name: fallback,
          label: ui.label,
          kind: fallback === "id" ? "int" : "string",
          required: true,
          get: (row) => (row as Record<string, unknown>)[fallback],
        },
      ];
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
            <p className="font-medium">{w.noneYet(ui.pluralLabel.toLowerCase())}</p>
            {/* Asked to create one only when there is a button for it (a visitor gets none). */}
            {emptyAction && (
              <>
                <p className="text-sm text-muted-foreground">{w.createFirst}</p>
                {emptyAction}
              </>
            )}
          </>
        )}
      </Card>
    );
  }
  // A record's messages, with a badge for those the viewer has not read.
  const messages = (row: R) => {
    const c = thread?.counts[row.id] ?? { count: 0, unread: 0 };
    return (
      <span data-part="thread" className="inline-flex items-center gap-2 tabular-nums">
        {c.count}
        {c.unread > 0 && <Badge>{w.unreadCount(c.unread)}</Badge>}
      </span>
    );
  };
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
    // A long text (a message's words, where a model has nothing shorter to show) cut to two lines.
    if ((field.kind === "text" || field.kind === "markdown") && text !== "—")
      return <span className="line-clamp-2 max-w-md">{text}</span>;
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
        aria-label={w.selectIt(
          title ? formatValue(title, displayValue(title, row), app) : `#${row.id}`,
        )}
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
                "relative space-y-3 p-5 hover:bg-hover",
                view === "cards" && pictureField && "overflow-hidden pt-0",
              )}
            >
              {/* The checkbox sits in the picture's corner, or in a column of its own beside the title. */}
              {selection && view === "cards" && pictureField && (
                <span className="absolute top-3 left-3 z-10 rounded bg-card/90 p-1">
                  {check(row, index, "size-6")}
                </span>
              )}
              {/* Cards of a model with pictures show the record's, or a placeholder without one. */}
              {view === "cards" &&
                pictureField &&
                (formatValue(pictureField, displayValue(pictureField, row), app) !== "—" ? (
                  <AiMarked
                    generated={generatedPicture(row, pictureField)}
                    className="-mx-5 w-[calc(100%+2.5rem)]"
                  >
                    <img
                      src={pictureSrc(pictureField, row)}
                      alt={formatValue(pictureField, displayValue(pictureField, row), app)}
                      loading="lazy"
                      className={cn(
                        "aspect-[3/2] object-cover",
                        generatedPicture(row, pictureField)
                          ? "w-full"
                          : "-mx-5 w-[calc(100%+2.5rem)] max-w-none",
                      )}
                    />
                  </AiMarked>
                ) : (
                  <PicturePlaceholder
                    icon={icon}
                    className="-mx-5 aspect-[3/2] w-[calc(100%+2.5rem)]"
                  />
                ))}
              <div className="flex items-start justify-between gap-3">
                {selection && !(view === "cards" && pictureField) && (
                  <span className="-ml-1 shrink-0">{check(row, index, "size-6")}</span>
                )}
                <div className="min-w-0 flex-1 space-y-1">
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
              {thread && (
                <p className="flex items-center gap-2 text-sm text-muted-foreground">
                  {thread.label} {messages(row)}
                </p>
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
                      aria-label={w.selectAll}
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
                {columns.map((field) => {
                  const label = second(field)
                    ? `${field.label} / ${second(field)?.label}`
                    : field.label;
                  const key = sorting?.keys[field.name as keyof R & string];
                  const order =
                    key && sorting?.value === key
                      ? "ascending"
                      : key && sorting?.value === `-${key}`
                        ? "descending"
                        : undefined;
                  return (
                    <TableHead
                      key={field.name}
                      aria-sort={key ? (order ?? "none") : undefined}
                      className={numeric(field.kind) ? "text-right" : undefined}
                      {...editorMarker(ui, field, "column", page)}
                    >
                      {key && sorting ? (
                        // Once ascending, again descending, a third time the page's own order.
                        <button
                          type="button"
                          onClick={() =>
                            sorting.onChange(
                              order === "ascending" ? `-${key}` : order ? undefined : key,
                            )
                          }
                          className="inline-flex cursor-pointer items-center gap-1 uppercase outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
                        >
                          {label}
                          {order === "ascending" ? (
                            <ArrowUp aria-hidden className="size-3.5" />
                          ) : order === "descending" ? (
                            <ArrowDown aria-hidden className="size-3.5" />
                          ) : null}
                        </button>
                      ) : (
                        label
                      )}
                    </TableHead>
                  );
                })}
                {thread && <TableHead>{thread.label}</TableHead>}
                {saved && (
                  <TableHead className="w-12">
                    <span className="sr-only">{w.saved}</span>
                  </TableHead>
                )}
                {rowActions && (
                  <TableHead className="sticky right-0 bg-muted">
                    <span className="sr-only">{w.actions}</span>
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
                        // The title wraps at words, never one word a line.
                        field.name === ui.titleField && "min-w-40 font-semibold",
                      )}
                    >
                      {field === title ? open(row, cell(field, row)) : stacked(field, row)}
                    </TableCell>
                  ))}
                  {thread && <TableCell>{messages(row)}</TableCell>}
                  {saved && <TableCell className="py-0">{heart(row)}</TableCell>}
                  {rowActions && (
                    // At its natural width, so the title is not the column that wraps; kept at the
                    // right edge when the table is wider than its box, the other columns scrolling
                    // under it.
                    <TableCell
                      data-part="row-actions"
                      className="sticky right-0 z-10 w-px bg-card py-2 shadow-[-8px_0_8px_-8px_rgb(0_0_0/0.3)]"
                    >
                      <div className="flex items-center justify-end gap-2 whitespace-nowrap">
                        {rowActions(row)}
                      </div>
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
      {paging && <Pager {...paging} />}
      {more && <MoreOnScroll shown={rows.length} total={more.total} onMore={more.load} />}
      {exportRows && <ExportCsv ui={ui} all={exportRows} />}
    </div>
  );
}

/** "Export CSV" under a list: every record it shows as filtered, not only this page. */
function ExportCsv<R extends Row>({ ui, all }: { ui: RecordUi<R>; all: () => Promise<R[]> }) {
  const [busy, setBusy] = useState(false);
  const save = async () => {
    setBusy(true);
    try {
      download(csvName(ui), csvOf(ui, await all()));
    } finally {
      setBusy(false);
    }
  };
  return (
    <div data-part="export" className="flex justify-end py-1">
      <Button variant="ghost" size="sm" disabled={busy} onClick={() => void save()}>
        <Download aria-hidden />
        {w.exportCsv}
      </Button>
    </div>
  );
}

function numeric(kind: string): boolean {
  return kind === "int" || kind === "decimal" || kind === "money";
}
