import type { YamlEditor } from "../edit.js";
import { type AnyOperation, type Operation, OperationError } from "../operation.js";

/** Sets `value` under `app`, adding the key when it is new; "none" removes an optional key. */
function put(spec: YamlEditor, key: string, value: string | undefined): void {
  if (value === undefined) return;
  const path = ["app", key];
  if (value === "none") {
    if (key === "name") throw new OperationError("An app needs a name.");
    if (spec.has(path)) spec.removeAndPrune(path, 1);
  } else if (spec.has(path)) spec.set(path, value);
  else spec.add(["app"], key, value);
}

const setApp: Operation<{
  name?: string;
  description?: string;
  currency?: string;
  timezone?: string;
  clock?: string;
  date?: string;
  week?: string;
  numbers?: string;
}> = {
  name: "setApp",
  summary:
    'Set what the app is: its name, a one-sentence description, its currency (ISO 4217), time zone, clock, date order, first day of the week or numbers ("none" removes any but the name and description, back to the default).',
  schema: {
    type: "object",
    additionalProperties: false,
    properties: {
      name: { type: "string", description: "The app's name, e.g. Stillwater Yoga." },
      description: { type: "string", description: "One sentence on what the app is for." },
      currency: { type: "string", description: 'ISO 4217 code, e.g. EUR, or "none".' },
      timezone: {
        type: "string",
        description: 'IANA time zone, e.g. Europe/Mariehamn, or "none".',
      },
      clock: { type: "string", description: 'How times are written: 12h, 24h, or "none".' },
      date: {
        type: "string",
        description:
          'How dates are written: day-month (5 Nov 2026), month-day (Nov 5, 2026), or "none".',
      },
      week: {
        type: "string",
        description: 'The first day of a calendar\'s week: monday, sunday, or "none".',
      },
      numbers: {
        type: "string",
        description:
          'How numbers are written: point (1,234.56, €9.90), comma (1 234,56, 9,90 €), or "none" for the language\'s.',
      },
    },
  },
  positional: [],
  describe: (args) =>
    `Set the app: ${Object.entries(args)
      .map(([k, v]) => `${k} ${v}`)
      .join(", ")}`,
  destructive: () => false,
  apply({ spec }, args) {
    if (Object.keys(args).length === 0)
      throw new OperationError(
        "Say what to set: name, description, currency, timezone, clock, date, week or numbers.",
      );
    // One line each: a line break in a name or description would not fit the file.
    const keys = [
      "name",
      "description",
      "currency",
      "timezone",
      "clock",
      "date",
      "week",
      "numbers",
    ] as const;
    for (const key of keys) put(spec, key, args[key]?.replace(/\s+/g, " ").trim());
    return [];
  },
};

export const appOperations: AnyOperation[] = [setApp];
