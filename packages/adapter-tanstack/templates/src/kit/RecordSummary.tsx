// Smithable app kit: a record's summary (`record.header` and `form.aside: summary`): its status
// as a badge, its amount, its key dates. Which fields they are is decided by type when the app
// is generated (the first choice with tones, the first money field, the first two dates).
import { Badge } from "#/components/ui/badge";
import { cn } from "#/lib/utils";
import { formatValue } from "./format";
import type { AppUi, RecordUi, Row } from "./model";
import { w } from "./words";

export function RecordSummary({
  ui,
  app,
  row,
  status,
  amount,
  dates = [],
  place,
}: {
  // biome-ignore lint/suspicious/noExplicitAny: the page's own model, whichever it is
  ui: RecordUi<any>;
  app: AppUi;
  row: Row;
  status?: string;
  amount?: string;
  dates?: string[];
  /** In the title row, or a panel beside the form. */
  place: "header" | "aside";
}) {
  const field = (name?: string) => ui.fields.find((f) => f.name === name);
  const statusField = field(status);
  const choice = statusField?.choices?.find((c) => c.value === row[statusField.name]);
  const amountField = field(amount);
  const shown = dates.map(field).filter((f) => f && row[f.name] != null);
  const facts = [
    ...(amountField && row[amountField.name] != null
      ? [
          {
            label: amountField.label,
            value: formatValue(amountField, row[amountField.name], app),
            big: true,
          },
        ]
      : []),
    ...shown.map((f) => ({
      label: f?.label ?? "",
      value: f ? formatValue(f, row[f.name], app) : "",
      big: false,
    })),
  ];
  if (!choice && facts.length === 0) return null;
  if (place === "header")
    return (
      <div
        data-kit="record-summary"
        data-place="header"
        className="flex flex-wrap items-center gap-x-5 gap-y-2"
      >
        {choice && <Badge variant={choice.tone}>{choice.label}</Badge>}
        {facts.map((fact) => (
          <span key={fact.label} className="text-sm text-muted-foreground">
            {fact.label}{" "}
            <span className={cn("text-foreground tabular-nums", fact.big && "font-semibold")}>
              {fact.value}
            </span>
          </span>
        ))}
      </div>
    );
  return (
    <aside
      data-kit="record-summary"
      data-place="aside"
      aria-label={w.summary}
      className="rounded-lg border bg-card p-card"
    >
      {choice && (
        <p className="mb-4">
          <Badge variant={choice.tone}>{choice.label}</Badge>
        </p>
      )}
      <dl className="grid gap-4">
        {facts.map((fact) => (
          <div key={fact.label}>
            <dt className="text-sm text-muted-foreground">{fact.label}</dt>
            <dd className={cn("tabular-nums", fact.big ? "text-2xl font-semibold" : "font-medium")}>
              {fact.value}
            </dd>
          </div>
        ))}
      </dl>
    </aside>
  );
}
