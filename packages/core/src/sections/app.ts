import { checkKeys, mapEntries, readString } from "../context.js";
import type { AppIR } from "../ir.js";
import type { SpecSection } from "../section.js";
import { accessOperations } from "./access-operations.js";
import { contentOperations } from "./content-operations.js";
import { ruleOperations } from "./rule-operations.js";
import { specOperations } from "./spec-operations.js";
import { readSemanticText, TEXT_KEYS } from "./text.js";
import { textSchema } from "./text-schema.js";
import { uxOperations } from "./ux-operations.js";

export const appSection: SpecSection<"app"> = {
  key: "app",
  required: true,
  // Rules and access can belong to any concept; their operations live with the app as a whole.
  operations: [
    ...ruleOperations,
    ...accessOperations,
    ...specOperations,
    ...uxOperations,
    ...contentOperations,
  ],
  schema: {
    type: "object",
    description: "The application as a whole.",
    required: ["name"],
    additionalProperties: false,
    properties: {
      name: { type: "string", minLength: 1, description: "The application's name." },
      currency: {
        type: "string",
        pattern: "^[A-Z]{3}$",
        description: "ISO 4217 currency code, e.g. EUR.",
      },
      timezone: { type: "string", description: "IANA time zone, e.g. Europe/Mariehamn." },
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
        if (currency !== undefined && !/^[A-Z]{3}$/.test(currency)) {
          ctx.error(
            value,
            "invalid-currency",
            `Currency "${currency}" must be a three-letter code like EUR or USD.`,
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
            `Use a name like "Europe/Mariehamn".`,
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
