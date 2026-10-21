// Smithable app kit: choosing a time someone has free (docs/design/appointments.md §1, §4). It is
// the start field's own control: a strip of days from today and the chosen day's free times, the
// first day with any chosen at first. Who (or anyone, when the form leaves it empty) and how long
// come from the form; a time chosen for anyone sets who in the form too. The server checks the
// time again where the record is written. To change it, copy this file into src/custom/components/.
import { useEffect, useState } from "react";
import { Button } from "#/components/ui/button";
import { cn } from "#/lib/utils";
import type { FieldControlProps } from "./model";
import { addDays } from "./slots";
import { language, w } from "./words";
import { wallTime } from "./zoned";

interface Times {
  date: string;
  times: { at: string; resource: number }[];
}

type Load = (options: {
  data: { resource: number | null; length: number; date: string; first?: boolean };
}) => Promise<Times>;

/** The start field's control for a model whose records take someone's time. */
export function bindSlots(load: Load, keys: { resource: string; length: string }) {
  return function SlotsInput(props: FieldControlProps) {
    return <Slots {...props} load={load} keys={keys} />;
  };
}

const DAYS = 14;

function Slots({
  id,
  value,
  onChange,
  values = {},
  set,
  timeZone,
  load,
  keys,
  "aria-describedby": describedBy,
}: FieldControlProps & { load: Load; keys: { resource: string; length: string } }) {
  const today = wallTime(new Date(), timeZone).slice(0, 10);
  const resource = values[keys.resource] ? Number(values[keys.resource]) : null;
  const length = values[keys.length] ? Number(values[keys.length]) : null;
  // A booking being changed opens on its own day; a new one on the first day with a free time.
  const [day, setDay] = useState<string | undefined>(value ? value.slice(0, 10) : undefined);
  const [times, setTimes] = useState<Times | null>();
  // A new choice of what to book looks again from today, for the first day with a free time.
  const [lengthSeen, setLengthSeen] = useState(length);
  if (length !== lengthSeen) {
    setLengthSeen(length);
    setDay(undefined);
  }
  useEffect(() => {
    if (length === null) return setTimes(null);
    let current = true;
    setTimes(undefined);
    load({ data: { resource, length, date: day ?? today, first: day === undefined } }).then(
      (found) => {
        if (!current) return;
        setTimes(found);
        if (day === undefined) setDay(found.date);
      },
      () => current && setTimes({ date: day ?? today, times: [] }),
    );
    return () => {
      current = false;
    };
  }, [load, resource, length, day, today]);

  /** A wall time in the app's zone ("2026-10-21T10:15") as the language writes a clock. */
  const clock = (wall: string) =>
    new Intl.DateTimeFormat(language(), {
      timeZone: "UTC",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(`${wall}:00Z`));
  const dayName = (date: string) =>
    new Intl.DateTimeFormat(language(), {
      timeZone: "UTC",
      weekday: "short",
      day: "numeric",
      month: "short",
    }).format(new Date(`${date}T12:00:00Z`));
  if (length === null)
    return <p className="text-sm text-muted-foreground">{w.chooseLengthFirst}</p>;
  const shown = day ?? today;
  // The time chosen (a booking's own, which its own record takes) is always among those shown.
  const listed = (times?.times ?? []).map((t) => ({
    ...t,
    wall: wallTime(new Date(t.at), timeZone),
  }));
  if (value && value.slice(0, 10) === shown && !listed.some((t) => t.wall === value))
    listed.push({ at: "", resource: resource ?? 0, wall: value });
  listed.sort((a, b) => a.wall.localeCompare(b.wall));
  return (
    <div id={id} data-kit="slots" className="min-w-0 space-y-3" aria-describedby={describedBy}>
      <fieldset className="flex w-0 min-w-full gap-2 overflow-x-auto pb-1">
        <legend className="sr-only">{w.day}</legend>
        {Array.from({ length: DAYS }, (_, i) => addDays(today, i)).map((date) => (
          <button
            key={date}
            type="button"
            aria-pressed={date === shown}
            onClick={() => setDay(date)}
            className={cn(
              "min-h-control shrink-0 rounded-md border px-3 text-sm whitespace-nowrap",
              date === shown
                ? "border-primary bg-primary text-primary-foreground"
                : "bg-background",
            )}
          >
            {dayName(date)}
          </button>
        ))}
      </fieldset>
      {times === undefined ? (
        <p className="text-sm text-muted-foreground">{w.findingTimes}</p>
      ) : !listed.length ? (
        <p className="text-sm text-muted-foreground">{w.noFreeTimes}</p>
      ) : (
        <fieldset className="flex min-w-0 flex-wrap gap-2">
          <legend className="sr-only">{w.chooseTime}</legend>
          {listed.map(({ wall, resource: free }) => {
            return (
              <button
                key={wall}
                type="button"
                aria-pressed={value === wall}
                data-part="time"
                onClick={() => {
                  onChange(wall);
                  if (resource === null && free) set?.(keys.resource, String(free));
                }}
                className={cn(
                  "min-h-control min-w-20 rounded-md border px-3 text-sm tabular-nums",
                  value === wall
                    ? "border-primary bg-primary text-primary-foreground"
                    : "bg-background",
                )}
              >
                {clock(wall)}
              </button>
            );
          })}
        </fieldset>
      )}
    </div>
  );
}

/** Whether the viewer may cancel their own booking now, or it is too late to do it here. */
export interface Cancellable {
  can: boolean;
  late: boolean;
}

/**
 * The owner's Cancel on a booking that takes someone's time (appointments.md §1): offered until
 * the window before the start closes, then a line saying to contact the business. It asks first.
 */
export function CancelOwn({
  id,
  load,
  cancel,
}: {
  id: number;
  load: (options: { data: number }) => Promise<Cancellable | null>;
  cancel: (options: { data: number }) => Promise<unknown>;
}) {
  const [state, setState] = useState<Cancellable | null>();
  const [asking, setAsking] = useState(false);
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<string>();
  useEffect(() => {
    load({ data: id }).then(setState, () => setState(null));
  }, [id, load]);
  if (!state || (!state.can && !state.late)) return null;
  if (!state.can)
    return (
      <p data-kit="cancel-own" className="text-sm text-muted-foreground">
        {w.tooLateToCancel}
      </p>
    );
  const run = async () => {
    setBusy(true);
    setFailure(undefined);
    try {
      await cancel({ data: id });
      window.location.reload();
    } catch {
      setFailure(w.tryAgain);
      setState(await load({ data: id }).catch(() => null));
    } finally {
      setBusy(false);
      setAsking(false);
    }
  };
  return (
    <div data-kit="cancel-own" className="space-y-2">
      {asking ? (
        <div className="flex flex-wrap items-center gap-2">
          <span>{w.cancelYourBooking}</span>
          <Button type="button" variant="destructive" disabled={busy} onClick={run}>
            {w.yesCancelIt}
          </Button>
          <Button type="button" variant="outline" disabled={busy} onClick={() => setAsking(false)}>
            {w.keepIt}
          </Button>
        </div>
      ) : (
        <Button type="button" variant="outline" onClick={() => setAsking(true)}>
          {w.cancelBooking}
        </Button>
      )}
      {failure && (
        <p role="alert" className="text-sm text-destructive">
          {failure}
        </p>
      )}
    </div>
  );
}
