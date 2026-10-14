// Smithable app kit: a list's filters and its sort order, above the list beside the search box.
// The state lives in the address (?segment=enterprise&creditLimit=1000..&sort=-creditLimit), so a
// filtered view can be linked and reloaded; the page passes it in and gets the next state back.
// On phones the filters fold behind a "Filters" button; the active ones show as removable chips.
import { SlidersHorizontal, X } from "lucide-react";
import { useEffect, useId, useState } from "react";
import { Button } from "#/components/ui/button";
import { Input, Label } from "#/components/ui/input";
import { cn } from "#/lib/utils";
import { w } from "./words";

export interface FilterUi {
  /** The field's name: its key in the address. */
  name: string;
  label: string;
  /**
   * chips (a choice or a reference), range (a number, amount or date), toggle (yes/no), mine
   * (the viewer's own records, for those signed in), person (a field that refers to a person:
   * Mine, Unassigned and the people by name).
   */
  kind: "chips" | "range" | "toggle" | "mine" | "person";
  options?: { value: string; label: string }[];
  /** A range's inputs: numbers, amounts (in the currency's units) or dates. */
  input?: "number" | "date";
}

export interface SortUi {
  value: string;
  label: string;
}

/** A filter's state in the address: chips as "a,b", a range as "from..to", a toggle as "true". */
export type FilterValues = Record<string, string | undefined>;

export function Filters({
  filters,
  values,
  sorts = [],
  sort,
  signedIn = false,
  onChange,
}: {
  filters: FilterUi[];
  values: FilterValues;
  sorts?: SortUi[];
  sort?: string;
  /** Whether the viewer is signed in: only then is there a "Mine". */
  signedIn?: boolean;
  onChange: (next: FilterValues & { sort?: string }) => void;
}) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const shown = filters.filter((f) => f.kind !== "mine" || signedIn);
  const active = shown.filter((f) => values[f.name]);
  const set = (name: string, value: string | undefined) =>
    onChange({ ...values, [name]: value || undefined, sort });
  return (
    <div data-kit="filters" className="mb-6 space-y-3">
      {/* Phones: the Filters button and the sort, the filters under them; wider: the filters, then the sort. */}
      <div className="flex flex-wrap items-end gap-3">
        {shown.length > 0 && (
          <Button
            type="button"
            variant="outline"
            aria-expanded={open}
            aria-controls={`${id}-panel`}
            onClick={() => setOpen(!open)}
            className="order-1 md:hidden"
          >
            <SlidersHorizontal aria-hidden className="size-4" /> {w.filters}
            {active.length > 0 && ` (${active.length})`}
          </Button>
        )}
        {sorts.length > 0 && (
          <div className="order-2 ml-auto flex items-center gap-2 md:order-3">
            <Label htmlFor={`${id}-sort`} className="text-sm">
              {w.sortBy}
            </Label>
            <select
              id={`${id}-sort`}
              value={sort ?? ""}
              onChange={(e) => onChange({ ...values, sort: e.target.value || undefined })}
              className="h-control rounded-md border border-input bg-card px-3 text-sm"
            >
              <option value="">{w.newestFirst}</option>
              {sorts.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>
        )}
        {shown.length > 0 && (
          <div
            id={`${id}-panel`}
            className={cn(
              "order-3 w-full flex-wrap items-start gap-x-6 gap-y-3 md:order-2 md:flex md:w-auto md:flex-1",
              open ? "flex" : "hidden",
            )}
          >
            {shown.map((f) => (
              <Filter
                key={f.name}
                filter={f}
                value={values[f.name]}
                onChange={(v) => set(f.name, v)}
              />
            ))}
          </div>
        )}
      </div>
      {active.length > 0 && (
        <ul aria-label={w.activeFilters} className="flex flex-wrap gap-2">
          {active.map((f) => (
            <li
              key={f.name}
              className="inline-flex items-center gap-1 rounded-full bg-accent py-1 pr-1 pl-3 text-sm text-accent-foreground"
            >
              {f.label}: {describe(f, values[f.name] as string)}
              {/* Only the × removes it, not a click on its words. */}
              <button
                type="button"
                aria-label={w.removeFilter(f.label)}
                onClick={() => set(f.name, undefined)}
                className="cursor-pointer rounded-full p-0.5 outline-none hover:bg-hover focus-visible:ring-2 focus-visible:ring-ring"
              >
                <X aria-hidden className="size-4" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Filter({
  filter,
  value,
  onChange,
}: {
  filter: FilterUi;
  value: string | undefined;
  onChange: (value: string | undefined) => void;
}) {
  const id = useId();
  const chosen = new Set((value ?? "").split(",").filter(Boolean));
  if (filter.kind === "mine")
    return (
      <label className="flex h-control items-center gap-2 text-sm font-semibold">
        <input
          type="checkbox"
          checked={value === "mine"}
          onChange={(e) => onChange(e.target.checked ? "mine" : undefined)}
          className="size-4 accent-primary"
        />
        {filter.label}
      </label>
    );
  if (filter.kind === "toggle")
    return (
      <div className="flex flex-col gap-1">
        <Label htmlFor={id}>{filter.label}</Label>
        <select
          id={id}
          value={value ?? ""}
          onChange={(e) => onChange(e.target.value || undefined)}
          className="h-control rounded-md border border-input bg-card px-3 text-sm"
        >
          <option value="">{w.any}</option>
          <option value="true">{w.yes}</option>
          <option value="false">{w.no}</option>
        </select>
      </div>
    );
  if (filter.kind === "range") return <Range filter={filter} value={value} onChange={onChange} />;
  // A person (record-rules.md §6): Mine and Unassigned, then the people as chips, or a list to
  // pick one from when there are many.
  const people = filter.kind === "person" ? (filter.options ?? []) : [];
  const many = people.length > 8;
  const options =
    filter.kind === "person"
      ? [
          { value: "me", label: w.mine },
          { value: "none", label: w.unassigned },
          ...(many ? [] : people),
        ]
      : (filter.options ?? []);
  if (many) {
    const picked = [...chosen].find((v) => people.some((p) => p.value === v)) ?? "";
    return (
      <fieldset className="space-y-1">
        <legend className="text-sm font-semibold">{filter.label}</legend>
        <div className="flex flex-wrap items-center gap-2">
          {options.map((o) => {
            const on = chosen.has(o.value);
            return (
              <button
                key={o.value}
                type="button"
                aria-pressed={on}
                onClick={() => {
                  const next = new Set(chosen);
                  if (on) next.delete(o.value);
                  else next.add(o.value);
                  onChange([...next].join(",") || undefined);
                }}
                className={cn(
                  "rounded-full border px-3 py-1 text-sm",
                  on
                    ? "border-primary bg-primary text-primary-foreground"
                    : "bg-card hover:bg-hover",
                )}
              >
                {o.label}
              </button>
            );
          })}
          <select
            aria-label={filter.label}
            value={picked}
            onChange={(e) => {
              const next = new Set<string>([...chosen].filter((v) => v === "me" || v === "none"));
              if (e.target.value) next.add(e.target.value);
              onChange([...next].join(",") || undefined);
            }}
            className="h-control max-w-60 rounded-md border border-input bg-card px-3 text-sm"
          >
            <option value="">{w.any}</option>
            {people.map((p) => (
              <option key={p.value} value={p.value}>
                {p.label}
              </option>
            ))}
          </select>
        </div>
      </fieldset>
    );
  }
  // Many values read better as a list to pick one from than as a row of chips.
  if (filter.kind !== "person" && options.length > 8)
    return (
      <div className="flex flex-col gap-1">
        <Label htmlFor={id}>{filter.label}</Label>
        <select
          id={id}
          value={value ?? ""}
          onChange={(e) => onChange(e.target.value || undefined)}
          className="h-control max-w-60 rounded-md border border-input bg-card px-3 text-sm"
        >
          <option value="">{w.any}</option>
          {options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </div>
    );
  return (
    <fieldset className="space-y-1">
      <legend className="text-sm font-semibold">{filter.label}</legend>
      <div className="flex flex-wrap gap-2">
        {options.map((o) => {
          const on = chosen.has(o.value);
          return (
            <button
              key={o.value}
              type="button"
              aria-pressed={on}
              onClick={() => {
                const next = new Set(chosen);
                if (on) next.delete(o.value);
                else next.add(o.value);
                onChange([...next].join(",") || undefined);
              }}
              className={cn(
                "rounded-full border px-3 py-1 text-sm",
                on ? "border-primary bg-primary text-primary-foreground" : "bg-card hover:bg-hover",
              )}
            >
              {o.label}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}

/** "From" and "to", applied once typing pauses, so the list never jumps on every key. */
function Range({
  filter,
  value,
  onChange,
}: {
  filter: FilterUi;
  value: string | undefined;
  onChange: (value: string | undefined) => void;
}) {
  const id = useId();
  const [from = "", to = ""] = (value ?? "").split("..");
  const [text, setText] = useState({ from, to });
  // A change from elsewhere (its chip removed, the address changed) replaces what was typed, or
  // the typed range would come straight back; the range this field sent itself does not.
  const [seen, setSeen] = useState({ value, sent: value });
  if (value !== seen.value) {
    setSeen({ ...seen, value });
    if (value !== seen.sent) setText({ from, to });
  }
  useEffect(() => {
    const next = text.from || text.to ? `${text.from}..${text.to}` : undefined;
    if (next === value) return;
    const timer = setTimeout(() => {
      setSeen((s) => ({ ...s, sent: next }));
      onChange(next);
    }, 400);
    return () => clearTimeout(timer);
  }, [text, value, onChange]);
  const type = filter.input === "date" ? "date" : "number";
  return (
    <fieldset className="space-y-1">
      <legend className="text-sm font-semibold">{filter.label}</legend>
      <div className="flex items-center gap-2">
        <Label htmlFor={`${id}-from`} className="sr-only">
          {w.rangeFrom(filter.label)}
        </Label>
        <Input
          id={`${id}-from`}
          type={type}
          placeholder={w.from}
          value={text.from}
          onChange={(e) => setText({ ...text, from: e.target.value })}
          className="w-32"
        />
        <span aria-hidden>–</span>
        <Label htmlFor={`${id}-to`} className="sr-only">
          {w.rangeTo(filter.label)}
        </Label>
        <Input
          id={`${id}-to`}
          type={type}
          placeholder={w.to}
          value={text.to}
          onChange={(e) => setText({ ...text, to: e.target.value })}
          className="w-32"
        />
      </div>
    </fieldset>
  );
}

/** An active filter in words, for its removable chip. */
function describe(filter: FilterUi, value: string): string {
  if (filter.kind === "mine") return "yes";
  if (filter.kind === "toggle") return value === "true" ? w.yes : w.no;
  if (filter.kind === "range") {
    const [from, to] = value.split("..");
    return from && to ? `${from}–${to}` : from ? w.fromValue(from) : w.upToValue(to);
  }
  const labels = new Map([
    ...(filter.kind === "person"
      ? [
          ["me", w.mine],
          ["none", w.unassigned],
        ]
      : []),
    ...(filter.options ?? []).map((o) => [o.value, o.label]),
  ] as [string, string][]);
  return value
    .split(",")
    .map((v) => labels.get(v) ?? v)
    .join(", ");
}

/** All records or only the viewer's saved ones (marketplace.md §2.3): two tabs above the list. */
export function SavedTabs({
  saved,
  onChange,
}: {
  saved: boolean;
  onChange: (saved: boolean) => void;
}) {
  const tab = (active: boolean, label: string, value: boolean) => (
    <button
      type="button"
      aria-pressed={active}
      onClick={() => onChange(value)}
      className={cn(
        "min-h-11 cursor-pointer rounded-md px-4 text-sm font-medium outline-none focus-visible:ring-2 focus-visible:ring-ring",
        active
          ? "bg-background text-foreground shadow-sm"
          : "text-muted-foreground hover:text-foreground",
      )}
    >
      {label}
    </button>
  );
  return (
    <div data-part="saved-tabs" className="mb-4 inline-flex gap-1 rounded-lg bg-muted p-1">
      {tab(!saved, w.all, false)}
      {tab(saved, w.saved, true)}
    </div>
  );
}
