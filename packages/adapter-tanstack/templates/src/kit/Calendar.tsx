// Smithable app kit: a calendar of records by week or month, in the app's time zone.
// Each day is a section with its records as a list; on wide screens the week's days become
// columns with the records as blocks from their start to their end, overlapping ones side by
// side. Records that take someone's time (appointments.md §1) also have a day view, a column per
// person. The list is the content and the grid only its layout, so screen readers get one list
// per day. To change it, copy this file into src/custom/components/ and edit the copy.
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useEffect, useRef } from "react";
import { Button } from "#/components/ui/button";
import { w } from "./words";
import { instantOf, wallTime } from "./zoned";

/** Where a calendar is: a day, a week (`2026-W40`) or a month (`2026-10`), as in the page's address. */
/** The period shown, and the record whose panel is open (its id), so a sign-in or a link returns to it. */
export type CalendarSearch = {
  day?: string;
  week?: string;
  month?: string;
  /** The first day of an agenda's or days' view; unsaid, today. */
  from?: string;
  /** The time of day the records start in (the calendar's own filter). */
  time?: TimeOfDay;
  open?: number;
};

/** A record's start by the hour: morning before 12, afternoon 12 to 17, evening from 17. */
export type TimeOfDay = "morning" | "afternoon" | "evening";
const TIMES: Record<TimeOfDay, [from: number, to: number]> = {
  morning: [0, 12 * 60],
  afternoon: [12 * 60, 17 * 60],
  evening: [17 * 60, 24 * 60],
};

export interface CalendarItem {
  id: number;
  start: Date | string;
  end: Date | string;
  title: string;
  /** The person (or room) whose time it takes: its column in the day view. */
  lane?: number;
  /** The block's colour: a choice value's tone, or a hue of the chart's (look-gap §4). */
  tone?: "success" | "warning" | "danger";
  hue?: number;
  /** The places left of the places there are. */
  places?: { left: number; of: number };
}

/**
 * A choice value's colour for a block: its tone where the ux file gives one, else a chart hue by
 * the value's place among the choice's values; none for no value or a neutral tone.
 */
export function colorOf(
  value: unknown,
  values: readonly string[],
  tones: Record<string, string>,
): { tone?: "success" | "warning" | "danger"; hue?: number } {
  if (value === null || value === undefined || value === "") return {};
  const tone = tones[String(value)];
  if (tone === "success" || tone === "warning" || tone === "danger") return { tone };
  if (tone === "neutral") return {};
  const at = values.indexOf(String(value));
  return at < 0 ? {} : { hue: at };
}

/** A block's colour as CSS: the tone's or the hue's, on a soft surface with a strong edge. */
function accentStyle(item: CalendarItem): React.CSSProperties | undefined {
  const accent =
    item.tone !== undefined
      ? `var(--${item.tone === "danger" ? "destructive" : item.tone})`
      : item.hue !== undefined
        ? `var(--chart-${(((item.hue % 5) + 5) % 5) + 1})`
        : undefined;
  return accent
    ? {
        backgroundColor: `color-mix(in oklch, ${accent} 16%, var(--card))`,
        boxShadow: `inset 3px 0 0 ${accent}`,
      }
    : undefined;
}

/** The places left: a number, a dot a place (filled when taken, up to 20), or a thin bar. */
function Places({
  places,
  look,
  plain,
}: {
  places: { left: number; of: number };
  look: "number" | "pips" | "bar";
  /** On the block's plain surface the number may be muted; on a coloured one it may not. */
  plain: boolean;
}) {
  const taken = Math.max(0, places.of - places.left);
  const label = w.placesLeft(places.left, places.of);
  if (look === "pips" && places.of > 0 && places.of <= 20)
    return (
      <span
        data-part="places"
        role="img"
        aria-label={label}
        className="mt-1 flex flex-wrap gap-0.5"
      >
        {Array.from({ length: places.of }, (_, i) => (
          <span
            key={i}
            aria-hidden
            className={`size-1.5 rounded-full ${i < taken ? "bg-foreground/70" : "border border-foreground/40"}`}
          />
        ))}
      </span>
    );
  if (look === "bar" && places.of > 0)
    return (
      <span
        data-part="places"
        role="img"
        aria-label={label}
        className="mt-1 block h-1 overflow-hidden rounded-full bg-foreground/15"
      >
        <span
          aria-hidden
          className="block h-full bg-foreground/60"
          style={{ width: `${(taken * 100) / places.of}%` }}
        />
      </span>
    );
  return (
    <span
      data-part="places"
      className={`block ${plain ? "text-muted-foreground" : "text-foreground"}`}
    >
      {label}
    </span>
  );
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
export function calendarRange(
  search: CalendarSearch,
  timeZone?: string,
  /** The page's own view (smithable.ux.yml): week unless agenda or days. */
  own: "week" | "agenda" | "days" = "week",
) {
  const today = wallTime(new Date(), timeZone).slice(0, 10);
  const view: "day" | "week" | "month" | "agenda" | "days" = search.day
    ? "day"
    : search.month
      ? "month"
      : search.week
        ? "week"
        : own;
  let days: string[];
  let label: string;
  let prev: CalendarSearch;
  let next: CalendarSearch;
  const heading = (options: Intl.DateTimeFormatOptions, text: string) =>
    new Intl.DateTimeFormat(undefined, { ...options, timeZone: "UTC" }).format(day(text));
  if (view === "day") {
    const shown = search.day as string;
    days = [shown];
    label = heading({ weekday: "long", day: "numeric", month: "long", year: "numeric" }, shown);
    prev = { day: addDays(shown, -1) };
    next = { day: addDays(shown, 1) };
  } else if (view === "month") {
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
  } else if (view === "agenda" || view === "days") {
    // From a day (today unsaid): seven days side by side, or four weeks as one list.
    const start = search.from ?? today;
    const length = view === "days" ? 7 : 28;
    days = Array.from({ length }, (_, i) => addDays(start, i));
    label = `${heading({ day: "numeric", month: "long" }, start)} – ${heading(
      { day: "numeric", month: "long", year: "numeric" },
      addDays(start, length - 1),
    )}`;
    prev = { from: addDays(start, -length) };
    next = { from: addDays(start, length) };
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
    today:
      view === "day"
        ? { day: today }
        : view === "month"
          ? { month: today.slice(0, 7) }
          : view === "week"
            ? { week: isoWeek(today) }
            : {},
    /** The other view, around the same days: a day goes back to its week. */
    other:
      view === "day"
        ? { week: isoWeek(first) }
        : view === "month"
          ? { week: isoWeek(first < today && today <= last ? today : (days[7] ?? first)) }
          : { month: (days[3] as string).slice(0, 7) },
    /** The page's own view, back from a month or a day. */
    own,
    /** The day view of a week: today when it is in it, else its Monday. */
    oneDay: { day: first <= today && today <= last ? today : first },
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
  lanes,
  places = "number",
  view: own = "week",
  timeOfDay,
}: {
  search: CalendarSearch;
  items: CalendarItem[];
  timeZone?: string;
  /** Records placed by a date, not a date and time: no hours. */
  dateOnly: boolean;
  /** `replace`: no history entry of its own (closing a panel opened from an address). */
  onNavigate: (search: CalendarSearch, replace?: boolean) => void;
  /** Opens a record on its own page; without it, a record's details open in a panel. */
  onOpen?: (id: number) => void;
  /** Starts a new record at a wall time ("2026-09-30T09:00"), for those who may create one. */
  onCreate?: (start: string) => void;
  /** "New session", for the empty hours' buttons. */
  newLabel: string;
  /** More about a record in its panel, e.g. its places and a Book button. */
  details?: (id: number) => React.ReactNode;
  /** The people (or rooms) whose time the records take: the day view has a column for each. */
  lanes?: { id: number; title: string }[];
  /** How a block's places left show (the ux file's calendar capacity look). */
  places?: "number" | "pips" | "bar";
  /** The page's own view (smithable.ux.yml): week unless agenda or days. */
  view?: "week" | "agenda" | "days";
  /** Morning, afternoon and evening as chips over the records (the calendar's own filter). */
  timeOfDay?: boolean;
}) {
  const range = calendarRange(search, timeZone, own);
  const panel = useRef<HTMLDialogElement>(null);
  // The panel was opened here (a history entry of its own): closing it steps back, so Back and
  // Close agree. Opened from an address (a return from sign-in), closing takes `open` away.
  const pushed = useRef(false);
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
  // The time of day chosen: the records that start in it.
  const time = timeOfDay && !dateOnly && search.time ? TIMES[search.time] : undefined;
  const kept = time ? placed.filter((p) => p.from >= time[0] && p.from < time[1]) : placed;
  const byDay = new Map(range.days.map((d) => [d, place(kept.filter((p) => p.day === d))]));
  // The columns: the days, or in the day view each person's records that day.
  const shownDay = range.days[0] as string;
  const columns =
    range.view === "day" && lanes?.length
      ? lanes.map((l) => ({
          key: `lane-${l.id}`,
          day: shownDay,
          long: l.title,
          short: l.title,
          records: place(kept.filter((p) => p.day === shownDay && p.lane === l.id)),
        }))
      : range.days.map((d) => ({
          key: d,
          day: d,
          long: longDay(d),
          short: shortDay(d),
          records: byDay.get(d) ?? [],
        }));
  // Hours shown: the week's earliest to its latest record (07:00 to 21:00 for an empty one). The
  // agenda and the days are lists, with no hours.
  const listed = range.view === "agenda" || range.view === "days";
  const timed = !dateOnly && range.view !== "month" && !listed;
  const empty = range.days.every((d) => !byDay.get(d)?.length);
  const inWeek = kept.filter((p) => byDay.has(p.day));
  const firstHour = inWeek.length ? Math.min(...inWeek.map((p) => Math.floor(p.from / 60))) : 7;
  const lastHour = inWeek.length
    ? Math.max(firstHour + 4, ...inWeek.map((p) => Math.ceil(p.to / 60)))
    : 21;
  const hours = Array.from({ length: lastHour - firstHour }, (_, i) => firstHour + i);
  const span = (lastHour - firstHour) * 60;

  const when = (p: Placed) =>
    dateOnly
      ? longDay(p.day)
      : `${longDay(p.day)}, ${clock(p.from)}–${clock(Math.min(p.to, 24 * 60 - 1))}`;
  const open = (p: Placed) => {
    if (onOpen) return onOpen(p.id);
    pushed.current = true;
    onNavigate({ ...search, open: p.id });
  };
  // The open record's panel follows the address; one not among those shown is said so.
  const shown = search.open === undefined ? undefined : placed.find((p) => p.id === search.open);
  useEffect(() => {
    const dialog = panel.current;
    if (!dialog) return;
    if (search.open !== undefined && !dialog.open) dialog.showModal();
    if (search.open === undefined && dialog.open) dialog.close();
  }, [search.open]);
  // Elsewhere in time, the time of day chosen stays chosen.
  // Previous, Today, Next and the views move the days; the page's filters and the time of day stay.
  const { day: _day, week: _week, month: _month, from: _from, open: _open, ...stays } = search;
  const go = (to: CalendarSearch) => onNavigate({ ...stays, ...to });
  const closed = () => {
    if (search.open === undefined) return;
    if (pushed.current) {
      pushed.current = false;
      window.history.back();
    } else onNavigate({ ...search, open: undefined }, true);
  };

  return (
    <div data-kit="calendar" className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant="outline"
          aria-label={w.previous}
          onClick={() => go(range.prev)}
        >
          <ChevronLeft aria-hidden className="size-4" />
        </Button>
        <Button type="button" variant="outline" onClick={() => go(range.today)}>
          {w.today}
        </Button>
        <Button type="button" variant="outline" aria-label={w.next} onClick={() => go(range.next)}>
          <ChevronRight aria-hidden className="size-4" />
        </Button>
        <h2 aria-live="polite" className="mx-2 text-lg font-semibold">
          {range.label}
        </h2>
        {lanes && range.view === "week" && (
          <Button
            type="button"
            variant="ghost"
            className="ml-auto"
            onClick={() => go(range.oneDay)}
          >
            {w.day}
          </Button>
        )}
        <Button
          type="button"
          variant="ghost"
          className={lanes && range.view === "week" ? "" : "ml-auto"}
          onClick={() =>
            go(
              (range.view === "month" || range.view === "day") && range.own !== "week"
                ? // Back to the page's own view, around the days that were shown.
                  {
                    from: range.days.includes(today)
                      ? today
                      : range.month
                        ? `${range.month}-01`
                        : range.days[0],
                  }
                : range.other,
            )
          }
        >
          {range.view === "month" || range.view === "day"
            ? range.own === "agenda"
              ? w.agenda
              : range.own === "days"
                ? w.days
                : w.week
            : w.month}
        </Button>
      </div>
      {timeOfDay && !dateOnly && (
        <fieldset data-part="time-of-day" className="m-0 flex flex-wrap gap-2 border-0 p-0">
          <legend className="sr-only">{w.timeOfDay}</legend>
          {([undefined, "morning", "afternoon", "evening"] as const).map((t) => (
            <Button
              key={t ?? "any"}
              type="button"
              size="sm"
              variant={search.time === t ? "default" : "outline"}
              aria-pressed={search.time === t}
              className="rounded-full"
              onClick={() => onNavigate({ ...search, time: t, open: undefined })}
            >
              {t ? w[t] : w.anyTime}
            </Button>
          ))}
        </fieldset>
      )}

      <div
        className={
          range.view === "day"
            ? "md:grid md:gap-x-1"
            : range.view === "days" && !empty
              ? // Positioned, so what is absolutely placed inside (screen-reader text) scrolls with it.
                "relative grid snap-x auto-cols-[calc((100%-1rem)/3)] grid-flow-col gap-2 overflow-x-auto md:auto-cols-auto md:grid-flow-row md:grid-cols-7 md:gap-1 md:overflow-visible"
              : range.view === "agenda"
                ? "space-y-2"
                : timed
                  ? "md:grid md:grid-cols-[3rem_repeat(7,minmax(0,1fr))] md:gap-x-1"
                  : "md:grid md:grid-cols-7 md:gap-1"
        }
        style={
          range.view === "day"
            ? { gridTemplateColumns: `3rem repeat(${columns.length}, minmax(0, 1fr))` }
            : undefined
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
          <div
            className={`flex items-center justify-between gap-3 py-3 ${listed ? "col-span-full" : "md:hidden"}`}
          >
            <p className="text-sm text-muted-foreground">
              {listed
                ? w.nothingInTheseDays
                : range.view === "day"
                  ? w.nothing
                  : range.view === "week"
                    ? w.nothingThisWeek
                    : w.nothingThisMonth}
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
        {columns.map(({ key, day: d, long, short, records }) => {
          const outside = range.month !== undefined && !d.startsWith(range.month);
          return (
            <section
              key={key}
              aria-label={long}
              className={`border-b py-3 ${range.view === "agenda" ? "" : "md:border md:border-border md:py-0"} ${empty ? (listed ? "hidden" : "max-md:hidden") : ""} ${range.view === "agenda" && records.length === 0 ? "hidden" : ""} ${range.view === "days" ? "snap-start" : ""} ${outside ? "md:opacity-50" : ""} ${range.view === "month" ? "md:min-h-28 md:p-1" : ""}`}
            >
              <h3
                className={`text-sm font-medium md:flex md:h-10 md:items-center md:justify-center ${d === today && range.view !== "day" ? "text-primary" : ""}`}
              >
                {range.view === "agenda" ? (
                  long
                ) : (
                  <>
                    <span className="md:hidden">{long}</span>
                    <span className="hidden md:inline">{short}</span>
                  </>
                )}
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
                  <p className="text-sm text-muted-foreground md:sr-only">{w.nothing}</p>
                ) : (
                  <ol className="space-y-1 md:space-y-0">
                    {records.map((p) => {
                      const accent = accentStyle(p);
                      return (
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
                            className="block h-full w-full overflow-hidden rounded-md bg-primary/10 px-2 py-1 text-left text-sm text-foreground hover:bg-primary/20 md:text-xs"
                            style={accent}
                          >
                            <span className="font-medium">{p.title}</span>
                            <span className="sr-only">, {when(p)}</span>
                            {!dateOnly && (
                              // On a coloured block the muted text would not read: the text's own colour.
                              <span
                                aria-hidden
                                className={`block ${accent ? "text-foreground" : "text-muted-foreground"}`}
                              >
                                {clock(p.from)}
                              </span>
                            )}
                            {p.places && <Places places={p.places} look={places} plain={!accent} />}
                          </button>
                        </li>
                      );
                    })}
                  </ol>
                )}
              </div>
            </section>
          );
        })}
      </div>

      <dialog
        ref={panel}
        onClose={closed}
        aria-labelledby="calendar-record"
        className="m-auto w-[calc(100%-2.5rem)] max-w-sm rounded-xl border bg-card p-card text-card-foreground backdrop:bg-black/50"
      >
        {shown ? (
          <>
            <h2 id="calendar-record" className="text-lg font-semibold">
              {shown.title}
            </h2>
            <p className="mt-2 text-muted-foreground">{when(shown)}</p>
            {details && <div className="mt-4">{details(shown.id)}</div>}
          </>
        ) : (
          search.open !== undefined && (
            <p id="calendar-record" role="status">
              {w.notInCalendar}
            </p>
          )
        )}
        <div className="mt-6 flex justify-end">
          <Button type="button" variant="outline" onClick={() => panel.current?.close()}>
            {w.close}
          </Button>
        </div>
      </dialog>
    </div>
  );
}
