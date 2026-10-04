// Smithable app kit: the audit log as administrators read it (docs/design/logging.md §3.3):
// who did what to which record and when, newest first, filtered by person, record, what was done
// and time. A deleted record or a removed user can be forgotten in the log from its line.
import { Button } from "#/components/ui/button";
import type { Forgotten } from "./audit.server";
import { formatValue } from "./format";
import type { AppUi } from "./model";

export interface ActivityLine {
  id: number;
  at: Date;
  /** Who, by name: a user's, "visitor", "the app", or "a removed user (#7)". */
  who: string;
  action: string;
  /** The record, by its title now, or "a deleted customer (#42)". */
  record?: string;
  fields?: string[] | null;
  /** What touches security, with its values (never a secret). */
  details?: Record<string, string> | null;
  /** When the line is about a deleted record or a removed user: what Forget blanks. */
  forget?: Forgotten;
}

/** An action's name as its button reads it: markSent → mark sent. */
const words = (action: string) => action.replace(/([a-z0-9])([A-Z])/g, "$1 $2").toLowerCase();

export interface ActivityFilters {
  who?: string;
  model?: string;
  action?: string;
  from?: string;
  to?: string;
}

export function ActivityLog({
  lines,
  filters,
  people,
  models,
  actions,
  app,
  onFilter,
  onForget,
}: {
  lines: ActivityLine[];
  app: AppUi;
  /** Without filters (a record's own history), only the lines. */
  filters?: ActivityFilters;
  people?: { id: string; name: string }[];
  models?: { name: string; label: string }[];
  actions?: string[];
  onFilter?: (next: ActivityFilters) => void;
  onForget?: (target: Forgotten) => Promise<unknown>;
}) {
  const set = (key: keyof ActivityFilters, value: string) =>
    onFilter?.({ ...filters, [key]: value || undefined });
  const select = "h-control rounded-md border border-input bg-background px-2 text-sm";
  return (
    <div data-kit="activity-log" className="space-y-4">
      {filters && (
        <div className="flex flex-wrap items-end gap-3">
          <label className="grid gap-1 text-sm">
            Person
            <select
              className={select}
              value={filters.who ?? ""}
              onChange={(e) => set("who", e.target.value)}
            >
              <option value="">Everyone</option>
              {people?.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-1 text-sm">
            Records
            <select
              className={select}
              value={filters.model ?? ""}
              onChange={(e) => set("model", e.target.value)}
            >
              <option value="">All</option>
              {models?.map((m) => (
                <option key={m.name} value={m.name}>
                  {m.label}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-1 text-sm">
            What
            <select
              className={select}
              value={filters.action ?? ""}
              onChange={(e) => set("action", e.target.value)}
            >
              <option value="">Anything</option>
              {actions?.map((a) => (
                <option key={a} value={a}>
                  {words(a)}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-1 text-sm">
            From
            <input
              type="date"
              className={select}
              value={filters.from ?? ""}
              onChange={(e) => set("from", e.target.value)}
            />
          </label>
          <label className="grid gap-1 text-sm">
            To
            <input
              type="date"
              className={select}
              value={filters.to ?? ""}
              onChange={(e) => set("to", e.target.value)}
            />
          </label>
        </div>
      )}
      {lines.length === 0 ? (
        <p className="text-muted-foreground">Nothing has happened that matches.</p>
      ) : (
        <ol className="divide-y divide-border rounded-lg border border-border bg-card">
          {lines.map((line) => (
            <li
              key={line.id}
              data-part="line"
              className="flex flex-wrap items-baseline gap-x-3 gap-y-1 px-4 py-3 text-sm"
            >
              <time className="text-muted-foreground tabular-nums">
                {formatValue(
                  { name: "at", kind: "datetime", label: "", required: false },
                  line.at,
                  app,
                )}
              </time>
              <span className="font-medium">{line.who}</span>
              <span>{words(line.action)}</span>
              {line.record && <span className="font-medium">{line.record}</span>}
              {line.fields?.length ? (
                <span className="text-muted-foreground">({line.fields.join(", ")})</span>
              ) : null}
              {line.details && Object.keys(line.details).length ? (
                <span className="text-muted-foreground">
                  {Object.entries(line.details)
                    .map(([k, v]) => `${k}: ${v}`)
                    .join(", ")}
                </span>
              ) : null}
              {line.forget && onForget && (
                <Button
                  type="button"
                  variant="outline"
                  className="ml-auto h-7"
                  onClick={() => line.forget && onForget(line.forget)}
                >
                  Forget in the log
                </Button>
              )}
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
