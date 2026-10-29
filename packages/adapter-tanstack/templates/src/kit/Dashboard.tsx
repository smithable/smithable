// Smithable app kit: dashboard tiles. A number, and a bar chart with one bar per month.
// To change one, copy this file into src/custom/components/ and edit the copy.
import { Card } from "#/components/ui/card";
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
