// Smithable app kit: a calendar of records by week or month, in the app's time zone.
// Each day is a section with its records as a list; on wide screens the week's days become
// columns with the records as blocks from their start to their end, overlapping ones side by
// side. The list is the content and the grid only its layout, so screen readers get one list
// per day. To change it, copy this file into src/custom/components/ and edit the copy.
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useRef, useState } from "react";
import { Button } from "#/components/ui/button";
import { w } from "./words";
import { instantOf, wallTime } from "./zoned";

/** Where a calendar is: a week (`2026-W40`) or a month (`2026-10`), as in the page's address. */
export type CalendarSearch = { week?: string; month?: string };

export interface CalendarItem {
  id: number;
  start: Date | string;
  end: Date | string;
  title: string;
}

const DAY = 86_400_000;
const day = (text: string) => new Date(`${text}T00:00:00Z`);
const iso = (date: Date) => date.toISOString().slice(0, 10);
const addDays = (text: string, n: number) => iso(new Date(day(text).getTime() + n * DAY));
/** Monday of the week a date is in. */
const monday = (text: string) => addDays(text, -((day(text).getUTCDay() + 6) % 7));

/** The ISO week of a date, e.g. 2026-W40 (the week with the year's first Thursday is week 1). */
function isoWeek(text: string): string {
  const thursday = addDays(monday(text), 3);
  const year = thursday.slice(0, 4);
  const first = monday(addDays(`${year}-01-04`, 0));
  const week = Math.round((day(monday(text)).getTime() - day(first).getTime()) / (7 * DAY)) + 1;
  return `${year}-W${String(week).padStart(2, "0")}`;
}

/** The Monday of an ISO week. */
function weekStart(week: string): string {
  const [year, n] = week.split("-W");
  return addDays(monday(`${year}-01-04`), (Number(n) - 1) * 7);
}

/**
 * What a calendar shows for its address: the days (a week, or the month's full weeks), the range
 * of instants to load (with a day on each side, for records crossing midnight), its heading and
 * where Previous, Today and Next and the other view go.
 */
export function calendarRange(search: CalendarSearch, timeZone?: string) {
  const today = wallTime(new Date(), timeZone).slice(0, 10);
  const view: "week" | "month" = search.month ? "month" : "week";
  let days: string[];
  let label: string;
  let prev: CalendarSearch;
  let next: CalendarSearch;
  const heading = (options: Intl.DateTimeFormatOptions, text: string) =>
    new Intl.DateTimeFormat(undefined, { ...options, timeZone: "UTC" }).format(day(text));
  if (view === "month") {
    const month = search.month as string;
    const first = `${month}-01`;
    const last = addDays(`${addDays(first, 31).slice(0, 7)}-01`, -1);
    const start = monday(first);
    const end = addDays(monday(last), 6);
    days = Array.from({ length: (day(end).getTime() - day(start).getTime()) / DAY + 1 }, (_, i) =>
      addDays(start, i),
    );
    label = heading({ month: "long", year: "numeric" }, first);
    prev = { month: addDays(first, -1).slice(0, 7) };
    next = { month: addDays(last, 1).slice(0, 7) };
  } else {
    const start = search.week ? weekStart(search.week) : monday(today);
    days = Array.from({ length: 7 }, (_, i) => addDays(start, i));
    label = `${heading({ day: "numeric", month: "long" }, start)} – ${heading(
      { day: "numeric", month: "long", year: "numeric" },
      addDays(start, 6),
    )}`;
    prev = { week: isoWeek(addDays(start, -7)) };
    next = { week: isoWeek(addDays(start, 7)) };
  }
  const first = days[0] as string;
  const last = days.at(-1) as string;
  return {
    view,
    days,
    label,
    prev,
    next,
    today: view === "month" ? { month: today.slice(0, 7) } : { week: isoWeek(today) },
    /** The other view, around the same days. */
    other:
      view === "month"
        ? { week: isoWeek(first < today && today <= last ? today : (days[7] ?? first)) }
        : { month: (days[3] as string).slice(0, 7) },
    month: view === "month" ? (search.month as string) : undefined,
    from: instantOf(`${addDays(first, -1)}T00:00`, timeZone),
    to: instantOf(`${addDays(last, 2)}T00:00`, timeZone),
  };
}

interface Placed extends CalendarItem {
  day: string;
  /** Minutes after midnight, in the app's time zone. */
  from: number;
  to: number;
  column: number;
  columns: number;
}

/** A day's records with their columns: overlapping ones side by side (records sorted by start). */
function place(items: Placed[]): Placed[] {
  const sorted = [...items].sort((a, b) => a.from - b.from || b.to - a.to);
  let group: Placed[] = [];
  let groupEnd = -1;
  const close = () => {
    const columns = Math.max(0, ...group.map((p) => p.column)) + 1;
    for (const p of group) p.columns = columns;
    group = [];
  };
  for (const item of sorted) {
    if (item.from >= groupEnd) {
      close();
      groupEnd = -1;
    }
    const busy = new Set(group.filter((p) => p.to > item.from).map((p) => p.column));
    let column = 0;
    while (busy.has(column)) column++;
    item.column = column;
    group.push(item);
    groupEnd = Math.max(groupEnd, item.to);
  }
  close();
  return sorted;
}

const minutes = (wall: string) => Number(wall.slice(11, 13)) * 60 + Number(wall.slice(14, 16));
const clock = (m: number) =>
  `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
const HOUR = 3; // rem per hour on the week grid

export function Calendar({
  search,
  items,
  timeZone,
  dateOnly,
  onNavigate,
  onOpen,
  onCreate,
  newLabel,
  details,
}: {
  search: CalendarSearch;
  items: CalendarItem[];
  timeZone?: string;
  /** Records placed by a date, not a date and time: no hours. */
  dateOnly: boolean;
  onNavigate: (search: CalendarSearch) => void;
  /** Opens a record on its own page; without it, a record's details open in a panel. */
  onOpen?: (id: number) => void;
  /** Starts a new record at a wall time ("2026-09-30T09:00"), for those who may create one. */
  onCreate?: (start: string) => void;
  /** "New session", for the empty hours' buttons. */
  newLabel: string;
  /** More about a record in its panel, e.g. its places and a Book button. */
  details?: (id: number) => React.ReactNode;
}) {
  const range = calendarRange(search, timeZone);
  const [shown, setShown] = useState<Placed>();
  const panel = useRef<HTMLDialogElement>(null);
  const today = wallTime(new Date(), timeZone).slice(0, 10);
  const longDay = (text: string) =>
    new Intl.DateTimeFormat(undefined, {
      weekday: "long",
      day: "numeric",
      month: "long",
      timeZone: "UTC",
    }).format(day(text));
  const shortDay = (text: string) =>
    new Intl.DateTimeFormat(undefined, {
      weekday: "short",
      day: "numeric",
      timeZone: "UTC",
    }).format(day(text));

  // Each record on the day it starts, in the app's time zone.
  const placed: Placed[] = items.map((item) => {
    const start = wallTime(new Date(item.start), timeZone);
    const end = wallTime(new Date(item.end), timeZone);
    const sameDay = end.slice(0, 10) === start.slice(0, 10);
    return {
      ...item,
      day: start.slice(0, 10),
      from: dateOnly ? 0 : minutes(start),
      to: dateOnly ? 24 * 60 : sameDay ? Math.max(minutes(end), minutes(start) + 15) : 24 * 60,
      column: 0,
      columns: 1,
    };
  });
  const byDay = new Map(range.days.map((d) => [d, place(placed.filter((p) => p.day === d))]));
  // Hours shown: 07:00 to 21:00, widened to the week's earliest and latest record.
  const timed = !dateOnly && range.view === "week";
  const empty = range.days.every((d) => !byDay.get(d)?.length);
  const inWeek = placed.filter((p) => byDay.has(p.day));
  const firstHour = Math.min(7, ...inWeek.map((p) => Math.floor(p.from / 60)));
  const lastHour = Math.max(21, ...inWeek.map((p) => Math.ceil(p.to / 60)));
  const hours = Array.from({ length: lastHour - firstHour }, (_, i) => firstHour + i);
  const span = (lastHour - firstHour) * 60;

  const when = (p: Placed) =>
    dateOnly
      ? longDay(p.day)
      : `${longDay(p.day)}, ${clock(p.from)}–${clock(Math.min(p.to, 24 * 60 - 1))}`;
  const open = (p: Placed) => {
    if (onOpen) return onOpen(p.id);
    setShown(p);
    panel.current?.showModal();
  };

  return (
    <div
      data-kit="calendar"
      className="flex flex-col gap-6 [@media(min-width:1100px)]:flex-row [@media(min-width:1100px)]:items-start"
    >
      <div className="min-w-0 flex-1 space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            aria-label={w.previous}
            onClick={() => onNavigate(range.prev)}
          >
            <ChevronLeft aria-hidden className="size-4" />
          </Button>
          <Button type="button" variant="outline" onClick={() => onNavigate(range.today)}>
            {w.today}
          </Button>
          <Button
            type="button"
            variant="outline"
            aria-label={w.next}
            onClick={() => onNavigate(range.next)}
          >
            <ChevronRight aria-hidden className="size-4" />
          </Button>
          <h2 aria-live="polite" className="mx-2 text-lg font-semibold">
            {range.label}
          </h2>
          <Button
            type="button"
            variant="ghost"
            className="ml-auto"
            onClick={() => onNavigate(range.other)}
          >
            {range.view === "week" ? w.month : w.week}
          </Button>
        </div>

        <div
          className={
            timed
              ? "md:grid md:grid-cols-[3rem_repeat(7,minmax(0,1fr))] md:gap-x-1"
              : "md:grid md:grid-cols-7 md:gap-1"
          }
        >
          {timed && (
            <div aria-hidden className="hidden md:block md:pt-10">
              {hours.map((h) => (
                <div
                  key={h}
                  className="text-right text-xs text-muted-foreground"
                  style={{ height: `${HOUR}rem` }}
                >
                  {clock(h * 60)}
                </div>
              ))}
            </div>
          )}
          {/* On a phone an empty week or month says so once, not "Nothing" under every day. */}
          {empty && (
            <div className="flex items-center justify-between gap-3 py-3 md:hidden">
              <p className="text-sm text-muted-foreground">
                {range.view === "week" ? w.nothingThisWeek : w.nothingThisMonth}
              </p>
              {/* Whoever may add one gets the button here (the hours to tap are a wide screen's). */}
              {onCreate && (
                <Button
                  variant="outline"
                  onClick={() =>
                    onCreate(`${range.days.find((d) => d >= today) ?? range.days[0]}T09:00`)
                  }
                >
                  {w.newOne(newLabel)}
                </Button>
              )}
            </div>
          )}
          {range.days.map((d) => {
            const records = byDay.get(d) ?? [];
            const outside = range.month !== undefined && !d.startsWith(range.month);
            return (
              <section
                key={d}
                aria-label={longDay(d)}
                className={`border-b py-3 md:border md:border-border md:py-0 ${empty ? "max-md:hidden" : ""} ${outside ? "md:opacity-50" : ""} ${range.view === "month" ? "md:min-h-28 md:p-1" : ""}`}
              >
                <h3
                  className={`text-[14px] font-medium md:flex md:h-10 md:items-center md:justify-center ${d === today ? "text-primary" : ""}`}
                >
                  <span className="md:hidden">{longDay(d)}</span>
                  <span className="hidden md:inline">{shortDay(d)}</span>
                </h3>
                <div
                  className={timed ? "relative md:h-[var(--grid)]" : ""}
                  style={
                    timed
                      ? ({ "--grid": `${(span / 60) * HOUR}rem` } as React.CSSProperties)
                      : undefined
                  }
                >
                  {timed &&
                    onCreate &&
                    // Only hours no record overlaps: a block never hides part of a button.
                    hours
                      .filter((h) => !records.some((p) => p.from < (h + 1) * 60 && p.to > h * 60))
                      .map((h) => (
                        <button
                          key={h}
                          type="button"
                          aria-label={w.newAt(newLabel, longDay(d), clock(h * 60))}
                          className="absolute inset-x-0 hidden border-t border-border/50 hover:bg-muted md:block"
                          style={{
                            top: `${((h - firstHour) * 60 * 100) / span}%`,
                            height: `${HOUR}rem`,
                          }}
                          onClick={() => onCreate(`${d}T${clock(h * 60)}`)}
                        />
                      ))}
                  {records.length === 0 ? (
                    <p className="text-[14px] text-muted-foreground md:sr-only">{w.nothing}</p>
                  ) : (
                    <ol className="space-y-1 md:space-y-0">
                      {records.map((p) => (
                        <li
                          key={p.id}
                          className={timed ? "md:absolute md:px-0.5" : "md:mt-1"}
                          style={
                            timed
                              ? ({
                                  top: `${((p.from - firstHour * 60) * 100) / span}%`,
                                  height: `${((p.to - p.from) * 100) / span}%`,
                                  left: `${(p.column * 100) / p.columns}%`,
                                  width: `${100 / p.columns}%`,
                                } as React.CSSProperties)
                              : undefined
                          }
                        >
                          <button
                            type="button"
                            onClick={() => open(p)}
                            className="block h-full w-full overflow-hidden rounded-md bg-primary/10 px-2 py-1 text-left text-[14px] text-foreground hover:bg-primary/20 md:text-xs"
                          >
                            <span className="font-medium">{p.title}</span>
                            <span className="sr-only">, {when(p)}</span>
                            {!dateOnly && (
                              <span aria-hidden className="block text-muted-foreground">
                                {clock(p.from)}
                              </span>
                            )}
                          </button>
                        </li>
                      ))}
                    </ol>
                  )}
                </div>
              </section>
            );
          })}
        </div>
      </div>

      {shown && !onOpen && (
        <div className="w-full shrink-0 rounded-lg border bg-card p-card text-card-foreground [@media(min-width:1100px)]:w-[360px] [@media(min-width:1280px)]:w-[400px]">
          <div className="flex items-start justify-between gap-4">
            <h2 id="calendar-record" className="text-lg font-semibold">
              {shown.title}
            </h2>
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={() => setShown(undefined)}
              aria-label={w.close}
            >
              <X aria-hidden className="size-4" />
            </Button>
          </div>
          <p className="mt-2 text-muted-foreground">{when(shown)}</p>
          {details && <div className="mt-4">{details(shown.id)}</div>}
        </div>
      )}
    </div>
  );
}
