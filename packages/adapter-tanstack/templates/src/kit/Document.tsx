// Smithable app kit: a record as a document (docs/design/record-documents.md §4.2), printed or
// saved as PDF by the browser's own print. Each block shows exactly the fields it is given; an
// empty stored value is left out. styles.css prints it alone, on the printer's paper size.
import { Link } from "@tanstack/react-router";
import { Button } from "#/components/ui/button";
import { cn } from "#/lib/utils";
import { formatValue } from "./format";
import type { AppUi, RecordUi, Row } from "./model";
import { w } from "./words";

/** Fields of one record: its description, the record, and the fields' keys in order. */
export interface DocumentPart {
  // biome-ignore lint/suspicious/noExplicitAny: the part's own model, whichever it is
  ui: RecordUi<any>;
  row: Row;
  show: string[];
}

/** Why a document cannot be printed: a part the person may not read, a value not there yet. */
export type DocumentRefusal =
  | { refused: "read" }
  | { refused: "missing"; label: string }
  | { refused: "settings" };

const NUMERIC = new Set(["money", "int", "decimal"]);

/** The named fields with a value, as label and text. */
function facts(app: AppUi, part: DocumentPart) {
  return part.show.flatMap((name) => {
    const field = part.ui.fields.find((f) => f.name === name);
    const value = field?.get(part.row);
    if (!field || value === null || value === undefined || value === "") return [];
    return [
      {
        name: field.name,
        label: field.label,
        value: formatValue(field, value, app),
        numeric: NUMERIC.has(field.kind),
      },
    ];
  });
}

function Facts({ app, part, className }: { app: AppUi; part: DocumentPart; className?: string }) {
  return (
    <dl className={cn("grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm", className)}>
      {facts(app, part).map((fact) => (
        <div key={fact.name} className="contents">
          <dt className="text-muted-foreground">{fact.label}</dt>
          <dd className={cn(fact.numeric && "tabular-nums")}>{fact.value}</dd>
        </div>
      ))}
    </dl>
  );
}

/** A block's values on lines of their own, without labels: who it is from or for. */
function Lines({ app, part }: { app: AppUi; part: DocumentPart }) {
  return (
    <address className="text-sm not-italic">
      {facts(app, part).map((fact) => (
        <div key={fact.name}>{fact.value}</div>
      ))}
    </address>
  );
}

export function RecordDocument({
  app,
  title,
  record,
  totals = [],
  note,
  from,
  to,
  lines,
  words = {},
}: {
  app: AppUi;
  /** The document's title: the content file's, else the model's name. */
  title: string;
  record: DocumentPart;
  totals?: string[];
  /** A text field printed at the end. */
  note?: string;
  from?: DocumentPart;
  to?: DocumentPart;
  lines?: { ui: DocumentPart["ui"]; rows: Row[]; show: string[] };
  words?: {
    from?: string;
    to?: string;
    lines?: string;
    totals?: string;
    note?: string;
    print?: string;
  };
}) {
  const columns = (lines?.show ?? []).flatMap((name) => {
    const field = lines?.ui.fields.find((f) => f.name === name);
    return field ? [field] : [];
  });
  const noteText = note ? String(record.row[note] ?? "") : "";
  return (
    <article
      data-kit="document"
      className="mx-auto max-w-3xl space-y-8 bg-background p-8 text-foreground"
    >
      <div data-print="hide" className="flex justify-end">
        <Button type="button" onClick={() => window.print()}>
          {words.print ?? w.document.print}
        </Button>
      </div>
      <header className="flex flex-wrap items-start justify-between gap-6">
        <section aria-label={words.from ?? w.document.from}>
          {from ? (
            <Lines app={app} part={from} />
          ) : (
            <p className="text-sm font-semibold">{app.name}</p>
          )}
        </section>
        <h1 className="text-3xl font-semibold">{title}</h1>
      </header>
      <div className="flex flex-wrap items-start justify-between gap-6">
        {to && (
          <section>
            <h2 className="mb-1 text-xs uppercase tracking-wide text-muted-foreground">
              {words.to ?? w.document.to}
            </h2>
            <Lines app={app} part={to} />
          </section>
        )}
        <Facts app={app} part={record} className="ml-auto" />
      </div>
      {lines && (
        <section>
          {words.lines && <h2 className="mb-2 font-semibold">{words.lines}</h2>}
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b">
                {columns.map((c) => (
                  <th
                    key={c.name}
                    scope="col"
                    className={cn(
                      "py-2 font-medium",
                      NUMERIC.has(c.kind) ? "text-right" : "text-left",
                    )}
                  >
                    {c.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {lines.rows.map((row) => (
                <tr key={row.id} className="border-b">
                  {columns.map((c) => {
                    const value = c.get(row);
                    return (
                      <td
                        key={c.name}
                        className={cn(
                          "py-2 align-top",
                          NUMERIC.has(c.kind) ? "text-right tabular-nums" : "text-left",
                        )}
                      >
                        {value === null || value === undefined || value === ""
                          ? ""
                          : formatValue(c, value, app)}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
      {totals.length > 0 && (
        <section className="flex justify-end">
          <div>
            {words.totals && <h2 className="mb-1 font-semibold">{words.totals}</h2>}
            <Facts
              app={app}
              part={{ ...record, show: totals }}
              className="text-base font-semibold"
            />
          </div>
        </section>
      )}
      {noteText && (
        <section>
          {words.note && <h2 className="mb-1 font-semibold">{words.note}</h2>}
          <p className="whitespace-pre-line text-sm">{noteText}</p>
        </section>
      )}
    </article>
  );
}

/** Why the document cannot be printed, with the way to the settings page when they are missing. */
export function DocumentRefused({
  refusal,
  settings,
}: {
  refusal: DocumentRefusal;
  settings?: string;
}) {
  return (
    <p role="alert" className="mx-auto max-w-3xl p-8">
      {refusal.refused === "read" ? (
        w.document.refused
      ) : refusal.refused === "missing" ? (
        w.document.missing(refusal.label)
      ) : settings ? (
        <Link to={settings} className="underline">
          {w.document.settings}
        </Link>
      ) : (
        w.document.settings
      )}
    </p>
  );
}
