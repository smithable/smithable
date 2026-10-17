import { checkKeys, mapEntries, readString } from "../context.js";
import { CURRENCIES } from "../currencies.js";
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
    description: "The app's name, what it is for, its currency and its time zone.",
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
      },
      ...textSchema,
    },
  },
  parse(ctx, node) {
    const app: AppIR = { name: "" };
    const entries = mapEntries(ctx, node, `"app"`);
    if (!entries) return app;
    const known = checkKeys(ctx, entries, `"app"`, {
      allowed: ["name", "currency", "timezone", ...TEXT_KEYS],
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
