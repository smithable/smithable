import { checkKeys, mapEntries, readString } from "../context.js";
import { CURRENCIES } from "../currencies.js";
import { FORMAT_KEYS, FORMATS } from "../formats.js";
import type { AppIR } from "../ir.js";
import type { SpecSection } from "../section.js";
import { didYouMean } from "../suggest.js";
import { TIME_ZONES } from "../time-zones.js";
import { appOperations } from "./app-operations.js";
import { readSemanticText, TEXT_KEYS } from "./text.js";
import { textSchema } from "./text-schema.js";

export const appSection: SpecSection<"app"> = {
  key: "app",
  required: true,
  operations: appOperations,
  schema: {
    type: "object",
    title: "The app",
    description:
      "The app's name, what it is for, its currency, its time zone and how it writes times, dates and numbers.",
    "x-docs": "https://docs.smithable.ai/spec.html#app",
    required: ["name"],
    additionalProperties: false,
    properties: {
      name: {
        type: "string",
        minLength: 1,
        title: "Name",
        description: "The app's name, shown in its header, its tab and its mails.",
      },
      currency: {
        type: "string",
        enum: CURRENCIES,
        title: "Currency",
        description: "The currency of the app's amounts, as its ISO 4217 code, e.g. EUR.",
      },
      timezone: {
        type: "string",
        title: "Time zone",
        description:
          "The time zone dates and times are shown in, as its IANA name, e.g. Europe/Mariehamn.",
        "x-suggest": "time-zones",
      },
      clock: {
        type: "string",
        enum: ["12h", "24h"],
        title: "Clock",
        description: "How times are written: 12h or 24h, the default.",
      },
      date: {
        type: "string",
        enum: ["day-month", "month-day"],
        title: "Date order",
        description:
          "How dates are written: day-month (5 Nov 2026), the default, or month-day (Nov 5, 2026).",
      },
      week: {
        type: "string",
        enum: ["monday", "sunday"],
        title: "First day of the week",
        description: "The day a calendar's week starts on: monday, the default, or sunday.",
      },
      numbers: {
        type: "string",
        enum: ["point", "comma"],
        title: "Numbers",
        description:
          "How numbers and amounts are written: point (1,234.56 and €9.90) or comma (1 234,56 and 9,90 €); unsaid, the language's.",
      },
      ...textSchema,
    },
  },
  parse(ctx, node) {
    const app: AppIR = { name: "" };
    const entries = mapEntries(ctx, node, `"app"`);
    if (!entries) return app;
    const known = checkKeys(ctx, entries, `"app"`, {
      allowed: ["name", "currency", "timezone", "clock", ...FORMAT_KEYS, ...TEXT_KEYS],
      content: ["title", "tagline"],
    });
    Object.assign(app, readSemanticText(ctx, known));
    for (const { key, value } of known) {
      if (key === "name") {
        app.name = readString(ctx, value, `"app.name"`) ?? "";
      } else if (key === "currency") {
        const currency = readString(ctx, value, `"app.currency"`);
        if (currency !== undefined && !CURRENCIES.includes(currency)) {
          ctx.error(
            value,
            "invalid-currency",
            `Currency "${currency}" is not an ISO 4217 code like EUR or USD.`,
            didYouMean(currency, CURRENCIES),
          );
        } else if (currency !== undefined) {
          app.currency = currency;
        }
      } else if (key === "timezone") {
        const timezone = readString(ctx, value, `"app.timezone"`);
        if (timezone !== undefined && !isTimeZone(timezone)) {
          ctx.error(
            value,
            "invalid-timezone",
            `Unknown time zone "${timezone}".`,
            didYouMean(timezone, TIME_ZONES) ?? `Use a name like "Europe/Mariehamn".`,
          );
        } else if (timezone !== undefined) {
          app.timezone = timezone;
        }
      } else if (key === "clock") {
        const clock = readString(ctx, value, `"app.clock"`);
        if (clock === "12h" || clock === "24h") app.clock = clock;
        else if (clock !== undefined)
          ctx.error(value, "invalid-value", `"clock" under "app" is 12h or 24h.`);
      } else if (key === "date" || key === "week" || key === "numbers") {
        const said = readString(ctx, value, `"app.${key}"`);
        const choices = FORMATS[key] as readonly string[];
        if (said !== undefined && choices.includes(said)) Object.assign(app, { [key]: said });
        else if (said !== undefined)
          ctx.error(
            value,
            "invalid-value",
            `"${key}" under "app" is ${choices.join(" or ")}.`,
            didYouMean(said, [...choices]),
          );
      }
    }
    if (!known.some((e) => e.key === "name")) {
      ctx.error(node, "missing-key", `"app" needs a "name".`);
    }
    return app;
  },
};

function isTimeZone(name: string): boolean {
  try {
    new Intl.DateTimeFormat("en", { timeZone: name });
    return true;
  } catch {
    return false;
  }
}
