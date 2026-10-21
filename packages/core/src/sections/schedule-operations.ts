// The operations of one person's time (docs/design/appointments.md §2): setSchedule on the
// model whose time is booked, setOccupies on the model whose records take it.
import { conditionArgs } from "../condition.js";
import type { YamlValue } from "../edit.js";
import { type Operation, OperationError, refTo } from "../operation.js";

/** Hours given as text, "mon-fri 09:00-17:00, sat 10:00-14:00 17:00-20:00", as the spec writes them. */
function hoursArg(hours: string | Record<string, string | string[]>): Record<string, YamlValue> {
  if (typeof hours !== "string") return hours;
  const result: Record<string, YamlValue> = {};
  for (const part of hours.split(",")) {
    const [day, ...spans] = part.trim().split(/\s+/);
    if (!day || !spans.length)
      throw new OperationError(
        `"${part.trim()}" is not a day and its hours: write "mon-fri 09:00-17:00, sat 10:00-14:00".`,
      );
    result[day] = spans.length === 1 ? (spans[0] as string) : spans;
  }
  return result;
}

/** Spans given as text, "12:00-12:30" or "10:30-10:45, 12:00-12:30". */
function spansArg(spans: string | string[]): YamlValue {
  const list = (Array.isArray(spans) ? spans : spans.split(",")).map((s) => s.trim());
  return list.length === 1 ? (list[0] as string) : list;
}

const setSchedule: Operation<{
  model: string;
  hours: string | Record<string, string | string[]>;
  breaks?: string | string[];
  gap?: number | string;
  away?: string | { model: string; resource?: string; from?: string; until?: string };
}> = {
  name: "setSchedule",
  summary:
    'Say a model\'s records are booked by their time (barbers, rooms): weekly hours, breaks, minutes between bookings, and a model of time away ("none" as hours removes it).',
  schema: {
    type: "object",
    required: ["model", "hours"],
    additionalProperties: false,
    properties: {
      model: refTo({ ref: "model", label: "Kind of record" }),
      hours: {
        type: ["string", "object"],
        description:
          'The weekly hours, e.g. "mon-fri 09:00-17:00, sat 10:00-14:00" or { "mon-fri": "09:00-17:00" }; "none" removes the schedule.',
      },
      breaks: {
        type: ["string", "array"],
        description: 'Kept free every open day, e.g. "12:00-12:30".',
      },
      gap: {
        type: ["integer", "string"],
        description: "Minutes kept free after each booking.",
      },
      away: {
        type: ["string", "object"],
        description:
          'A model whose records block time, e.g. TimeOff: its one reference to this model and its first two date-and-time fields; or { "model": "TimeOff", "resource": "barber", "from": "from", "until": "until" } to say them.',
      },
    },
  },
  positional: ["model", "hours"],
  describe: ({ model, hours }) =>
    hours === "none" ? `Remove the schedule of ${model}` : `Book ${model} by their time`,
  destructive: () => false,
  apply({ spec }, { model, hours, breaks, gap, away }, ir) {
    if (!ir.models.some((m) => m.name === model))
      throw new OperationError(`There is no model named "${model}".`);
    const path = ["models", model, "schedule"];
    if (hours === "none") {
      const taken = ir.models.find((m) => {
        const ref = m.fields.find((f) => f.name === m.occupies?.resource);
        return ref?.type.kind === "relation" && ref.type.model === model;
      });
      if (taken)
        throw new OperationError(
          `${taken.name} takes ${model}'s time; remove its occupies first (setOccupies ${taken.name} none).`,
        );
      if (spec.has(path)) spec.removeAndPrune(path, 0);
      return [];
    }
    const value: Record<string, YamlValue> = { hours: hoursArg(hours) };
    if (breaks !== undefined && breaks !== "") value.breaks = spansArg(breaks);
    if (gap !== undefined && gap !== "") {
      const minutes = Number(gap);
      if (!Number.isInteger(minutes) || minutes < 0)
        throw new OperationError(`"gap" is a whole number of minutes, not "${gap}".`);
      value.gap = minutes;
    }
    if (away) value.away = away;
    if (spec.has(path)) spec.set(path, value);
    else spec.add(["models", model], "schedule", value);
    return [];
  },
};

const setOccupies: Operation<{
  model: string;
  resource: string;
  starts?: string;
  duration?: string;
  while?: Record<string, string | boolean | string[]>;
  cancelUntil?: string;
  cancelTo?: string;
}> = {
  name: "setOccupies",
  summary:
    "Say each record of a model takes a scheduled record's time, e.g. an appointment its barber's, from its start for its service's minutes (\"none\" as resource removes it).",
  schema: {
    type: "object",
    required: ["model", "resource"],
    additionalProperties: false,
    properties: {
      model: refTo({ ref: "model", label: "Kind of record" }),
      resource: refTo(
        { ref: "field", model: "model", label: "Whose time" },
        {
          description:
            'A required reference to a model with a schedule, e.g. barber; "none" removes it.',
        },
      ),
      starts: refTo({ ref: "field", model: "model", label: "Starts" }),
      duration: {
        type: "string",
        description:
          'Minutes: a whole-number field, or one of a referenced record, e.g. "service.minutes".',
      },
      while: {
        type: "object",
        description:
          'Only records with these values take the time, e.g. { "status": "requested | confirmed" }.',
      },
      cancelUntil: {
        type: "string",
        description: 'How long before the start its owner may cancel it: "30m", "12h" or "2d".',
      },
      cancelTo: {
        type: "string",
        description: "The value the owner's Cancel sets, when several are outside while.",
      },
    },
  },
  positional: ["model", "resource", "starts", "duration", "...while"],
  describe: ({ model, resource }) =>
    resource === "none" ? `Remove what ${model} occupies` : `${model} takes its ${resource}'s time`,
  destructive: () => false,
  apply({ spec }, args, ir) {
    const { model, resource, starts, duration, cancelUntil, cancelTo } = args;
    if (!ir.models.some((m) => m.name === model))
      throw new OperationError(`There is no model named "${model}".`);
    const path = ["models", model, "occupies"];
    if (resource === "none") {
      if (spec.has(path)) spec.removeAndPrune(path, 0);
      return [];
    }
    if (!starts || !duration)
      throw new OperationError(
        'Say "starts" (a date-and-time field) and "duration" (minutes, e.g. service.minutes).',
      );
    const value: Record<string, YamlValue> = { resource, starts, duration };
    const conditions = conditionArgs(args.while ?? {});
    if (Object.keys(conditions).length) value.while = conditions;
    if (cancelUntil) value.cancelUntil = cancelUntil;
    if (cancelTo) value.cancelTo = cancelTo;
    if (spec.has(path)) spec.set(path, value);
    else spec.add(["models", model], "occupies", value);
    return [];
  },
};

export const scheduleOperations = [setSchedule, setOccupies];
