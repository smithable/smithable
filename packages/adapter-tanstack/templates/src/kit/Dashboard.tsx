// Smithable app kit: dashboard tiles. A number, and a bar chart with one bar per month.
// To change one, copy this file into src/custom/components/ and edit the copy.
import { Card } from "#/components/ui/card";
import { AppLink } from "./AppLink";
import type { AppUi } from "./model";
import { w } from "./words";

type Kind = "money" | "int" | "decimal";

/** A number as the app shows it: money in the app's currency (stored in cents). */
export function formatNumber(
  kind: Kind,
  value: number | null,
  app: AppUi,
  compact = false,
): string {
  if (value === null) return "—";
  const options: Intl.NumberFormatOptions = compact ? { notation: "compact" } : {};
  if (kind === "money")
    return new Intl.NumberFormat(undefined, {
      ...options,
      style: "currency",
      currency: app.currency,
    }).format(value / 100);
  return new Intl.NumberFormat(undefined, {
    ...options,
    maximumFractionDigits: kind === "int" ? 0 : 2,
  }).format(value);
}

export function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <Card data-kit="tile" className="space-y-2 p-card">
      <h2 className="text-sm font-semibold text-muted-foreground">{label}</h2>
      <p className="text-3xl font-bold tabular-nums">{value}</p>
    </Card>
  );
}

/** Bars with their values written on them, so the chart reads without a pointer or color. */
export function BarChart({
  label,
  kind,
  app,
  bars,
  period,
  labels,
}: {
  label: string;
  kind: Kind;
  app: AppUi;
  /** One bar per period (its key from the kit's byPeriod) or per value of a choice. */
  bars: { key: string; value: number }[];
  /** A date's bars: their span; none for a choice's. */
  period?: "week" | "month" | "quarter" | "year";
  /** A choice's bars: each value's label. */
  labels?: Record<string, string>;
}) {
  const max = Math.max(...bars.map((b) => b.value), 1);
  const month = new Intl.DateTimeFormat(undefined, { month: "short", timeZone: "UTC" });
  const day = new Intl.DateTimeFormat(undefined, {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  });
  // A bar's name: its week's Monday, its month, its quarter or year, or the choice's value.
  const named = (key: string) =>
    period === "week"
      ? day.format(new Date(`${key}T00:00:00Z`))
      : period === "month"
        ? month.format(new Date(`${key}-01T00:00:00Z`))
        : period === "quarter"
          ? w.quarterOf(Number(key.slice(6)), key.slice(0, 4))
          : period === "year"
            ? key
            : (labels?.[key] ?? key);
  return (
    <Card data-kit="tile" className="p-card">
      <h2 className="font-semibold">{label}</h2>
      {bars.length === 0 ? (
        <p className="mt-4 text-muted-foreground">{w.noActivityInPeriod}</p>
      ) : (
        <ol className="mt-6 flex h-56 items-end gap-2 sm:gap-4">
          {bars.map((bar) => (
            <li
              key={bar.key}
              className="flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-1"
            >
              <span className="text-xs font-semibold tabular-nums">
                {formatNumber(kind, bar.value, app, true)}
              </span>
              <span
                aria-hidden
                className="w-full max-w-16 rounded-t-md bg-chart-1"
                style={{ height: `${(bar.value / max) * 100}%` }}
              />
              <span className="text-xs text-muted-foreground">{named(bar.key)}</span>
            </li>
          ))}
        </ol>
      )}
    </Card>
  );
}

/** A day ("YYYY-MM-DD") as the visitor's locale writes it, read as that day wherever they are. */
const dayText = (day: string) =>
  new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeZone: "UTC" }).format(
    new Date(`${day}T00:00:00Z`),
  );

/**
 * What is due (look-gap §4): the records in their date's order, the overdue first and marked, each
 * leading to its page; with nothing due, a line that says so.
 */
export function DueList({
  label,
  rows,
  href,
}: {
  label: string;
  rows: { id: number; title: string; day: string; overdue: boolean }[];
  /** The record's page, with ${id} for its id. */
  href?: string;
}) {
  return (
    <Card data-kit="tile" data-part="due" className="space-y-3 p-card">
      <h2 className="text-sm font-semibold text-muted-foreground">{label}</h2>
      {rows.length ? (
        <ul className="divide-y">
          {rows.map((row) => (
            <li key={row.id} className="flex items-center justify-between gap-3 py-2">
              {href ? (
                <AppLink
                  href={href.replace("${id}", String(row.id))}
                  className="min-w-0 truncate font-medium hover:underline"
                >
                  {row.title}
                </AppLink>
              ) : (
                <span className="min-w-0 truncate font-medium">{row.title}</span>
              )}
              <span className="flex shrink-0 items-center gap-2 text-sm text-muted-foreground tabular-nums">
                {row.overdue && (
                  <span
                    data-part="overdue"
                    className="rounded-full bg-destructive px-2 text-xs font-semibold text-destructive-foreground"
                  >
                    {w.overdue}
                  </span>
                )}
                {dayText(row.day)}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">{w.nothingDue}</p>
      )}
    </Card>
  );
}

/** The app's latest changes, for administrators: who did what, and the way to all of it. */
export function RecentChanges({
  label,
  lines,
  all,
}: {
  label: string;
  lines: { id: number; at: Date; who: string; action: string; record?: string }[];
  /** The Activity page. */
  all: string;
}) {
  return (
    <Card data-kit="tile" data-part="recent" className="space-y-3 p-card">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-sm font-semibold text-muted-foreground">{label}</h2>
        <AppLink href={all} className="text-sm font-medium text-primary hover:underline">
          {w.activity}
        </AppLink>
      </div>
      {lines.length ? (
        <ul className="divide-y text-sm">
          {lines.map((line) => (
            <li key={line.id} className="flex items-baseline justify-between gap-3 py-2">
              <span className="min-w-0">
                <span className="font-medium">{line.who}</span>{" "}
                {line.action.replace(/([a-z0-9])([A-Z])/g, "$1 $2").toLowerCase()}
                {line.record ? <> {line.record}</> : null}
              </span>
              <time
                dateTime={new Date(line.at).toISOString()}
                className="shrink-0 text-muted-foreground tabular-nums"
              >
                {new Intl.DateTimeFormat(undefined, {
                  dateStyle: "short",
                  timeStyle: "short",
                  hourCycle: "h23",
                }).format(new Date(line.at))}
              </time>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">{w.nothingYet}</p>
      )}
    </Card>
  );
}

/** A dashboard over no records yet: one sentence and the way to the first list, not zeros. */
export function QuietDashboard({ href, label }: { href: string; label: string }) {
  return (
    <div data-kit="dashboard" data-part="quiet" className="max-w-prose space-y-3 py-6">
      <p className="text-muted-foreground">{w.nothingHereYet}</p>
      <AppLink href={href} className="font-medium text-primary hover:underline">
        {label}
      </AppLink>
    </div>
  );
}
